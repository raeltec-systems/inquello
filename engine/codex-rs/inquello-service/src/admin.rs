//! Operator commands behind `inquello-service admin` (Story 1.11).
//!
//! Workspace creation and policy changes are operator bootstrap commands, not a
//! public API: the CLI connects to PostgreSQL directly and no HTTP route reaches
//! these functions, so nobody can create a Workspace or elevate themselves over
//! HTTP.
//!
//! - [`create_workspace`] validates the policy, creates the `internal_company`
//!   Workspace with policy revision 1 and a pending, expiring, one-use invite for
//!   the first administrator bound to `(issuer, subject)` with every policy role
//!   that permits `manage_membership`, and writes an operator receipt. The person
//!   accepts the invite after signing in.
//! - [`update_policy`] stores a new policy revision, increments the Workspace
//!   authorization epoch and writes an operator receipt.
//!
//! `external_audit` Workspaces and client or independence attributes are refused
//! as `route_not_available` (OQ-15).

use crate::config::DatabaseConfig;
use crate::digest::request_digest;
use crate::postgres;
use crate::workspace_commands::increment_epoch;
use crate::workspaces::lock_workspace;
use chrono::DateTime;
use chrono::Utc;
use inquello_domain::authorization::Action;
use inquello_domain::authorization::PolicyError;
use inquello_domain::authorization::WorkspaceKind;
use inquello_domain::authorization::WorkspacePolicy;
use inquello_protocol::rfc3339_millis;
use serde::Serialize;
use serde_json::json;
use sqlx::PgPool;
use sqlx::types::Json;
use std::time::Duration;
use uuid::Uuid;

const MAX_NAME_CHARS: usize = 200;
const MAX_ISSUER_BYTES: usize = 2048;
const MAX_SUBJECT_CHARS: usize = 255;
const MAX_OPERATOR_CHARS: usize = 128;

#[derive(Debug, thiserror::Error)]
pub enum AdminError {
    #[error("invalid policy: {0}")]
    Policy(PolicyError),
    /// External-audit kinds and attributes (OQ-15).
    #[error("route_not_available: {0}")]
    RouteNotAvailable(String),
    #[error("invalid request: {0}")]
    Invalid(String),
    #[error("workspace not found")]
    WorkspaceNotFound,
    #[error("conflict: {0}")]
    Conflict(&'static str),
    #[error("database unavailable: {0}")]
    Database(String),
    #[error("PostgreSQL server_version_num {found} is older than the required 18")]
    UnsupportedPostgres { found: i32 },
    #[error("database migration failed: {0}")]
    Migration(String),
}

impl From<sqlx::Error> for AdminError {
    fn from(error: sqlx::Error) -> Self {
        AdminError::Database(postgres::error_category(&error))
    }
}

impl From<crate::error::ApiError> for AdminError {
    fn from(_: crate::error::ApiError) -> Self {
        AdminError::Database("stored workspace state unreadable".to_string())
    }
}

fn policy_error(error: PolicyError) -> AdminError {
    match error {
        PolicyError::RouteNotAvailable(attribute) => {
            AdminError::RouteNotAvailable(format!("`{attribute}` is an external-audit attribute"))
        }
        other => AdminError::Policy(other),
    }
}

/// Opens the database for the operator: refuses PostgreSQL older than 18 and
/// applies the embedded migrations.
pub async fn open(config: &DatabaseConfig) -> Result<PgPool, AdminError> {
    let pool = postgres::connect(config).await?;
    let version = postgres::server_version_num(&pool).await?;
    if version < postgres::MINIMUM_SERVER_VERSION_NUM {
        pool.close().await;
        return Err(AdminError::UnsupportedPostgres { found: version });
    }
    if let Err(error) = postgres::migrate(&pool).await {
        pool.close().await;
        return Err(AdminError::Migration(error.to_string()));
    }
    Ok(pool)
}

/// `admin create-workspace`.
#[derive(Clone, Debug)]
pub struct CreateWorkspace {
    pub name: String,
    /// Only `internal_company` is accepted.
    pub kind: String,
    /// The policy document, as read from `--policy FILE`.
    pub policy: String,
    pub first_admin_issuer: String,
    pub first_admin_subject: String,
    /// How long the first administrator's invite stays acceptable.
    pub invite_lifetime: Duration,
    /// Who ran the command, for the operator receipt.
    pub operator: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct CreateWorkspaceOutcome {
    pub workspace_id: Uuid,
    pub policy_revision: String,
    pub first_admin_invite_id: Uuid,
    pub first_admin_roles: Vec<String>,
    #[serde(with = "rfc3339_millis")]
    pub invite_expires_at: DateTime<Utc>,
    pub receipt_id: Uuid,
}

/// `admin update-policy`.
#[derive(Clone, Debug)]
pub struct UpdatePolicy {
    pub workspace_id: Uuid,
    pub policy: String,
    pub operator: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct UpdatePolicyOutcome {
    pub workspace_id: Uuid,
    pub policy_revision: String,
    pub authorization_epoch: String,
    pub receipt_id: Uuid,
}

fn check_text(value: &str, what: &str, max_chars: usize) -> Result<(), AdminError> {
    if value.trim().is_empty()
        || value.chars().count() > max_chars
        || value.chars().any(char::is_control)
    {
        return Err(AdminError::Invalid(format!(
            "{what} must be 1 to {max_chars} printable characters"
        )));
    }
    Ok(())
}

fn check_operator(operator: &str) -> Result<(), AdminError> {
    check_text(operator, "the operator name", MAX_OPERATOR_CHARS)
}

/// Creates an `internal_company` Workspace, its policy revision 1 and the first
/// administrator's invite, with an operator receipt, in one transaction.
pub async fn create_workspace(
    pool: &PgPool,
    request: CreateWorkspace,
    now: DateTime<Utc>,
) -> Result<CreateWorkspaceOutcome, AdminError> {
    match WorkspaceKind::parse(&request.kind) {
        Some(WorkspaceKind::InternalCompany) => {}
        Some(WorkspaceKind::ExternalAudit) => {
            return Err(AdminError::RouteNotAvailable(
                "`external_audit` Workspaces are not available (OQ-15)".to_string(),
            ));
        }
        None => {
            return Err(AdminError::Invalid(
                "the Workspace kind must be `internal_company`".to_string(),
            ));
        }
    }
    check_text(&request.name, "the Workspace name", MAX_NAME_CHARS)?;
    check_operator(&request.operator)?;
    if request.first_admin_issuer.is_empty()
        || request.first_admin_issuer.len() > MAX_ISSUER_BYTES
        || !request.first_admin_issuer.starts_with("https://")
    {
        return Err(AdminError::Invalid(
            "the first administrator's issuer must be an https URL".to_string(),
        ));
    }
    if request.first_admin_subject.is_empty()
        || request.first_admin_subject.chars().count() > MAX_SUBJECT_CHARS
    {
        return Err(AdminError::Invalid(
            "the first administrator's subject must be 1 to 255 characters".to_string(),
        ));
    }
    let lifetime = chrono::TimeDelta::from_std(request.invite_lifetime)
        .ok()
        .filter(|lifetime| *lifetime > chrono::TimeDelta::zero())
        .ok_or_else(|| AdminError::Invalid("the invite lifetime must be positive".to_string()))?;
    let policy = WorkspacePolicy::parse(&request.policy).map_err(policy_error)?;
    let document = policy.to_value();
    let admin_roles: Vec<String> = policy
        .administrator_roles()
        .iter()
        .map(|role| role.as_str().to_string())
        .collect();

    let digest = request_digest(&json!({
        "command": "create_workspace",
        "name": request.name,
        "kind": request.kind,
        "policy": document,
        "first_admin_issuer": request.first_admin_issuer,
        "first_admin_subject": request.first_admin_subject,
        "invite_lifetime_seconds": request.invite_lifetime.as_secs(),
        "operator": request.operator,
    }));
    let workspace_id = Uuid::new_v4();
    let invite_id = Uuid::new_v4();
    let receipt_id = Uuid::new_v4();
    let expires_at = now + lifetime;
    let outcome = CreateWorkspaceOutcome {
        workspace_id,
        policy_revision: "1".to_string(),
        first_admin_invite_id: invite_id,
        first_admin_roles: admin_roles.clone(),
        invite_expires_at: expires_at,
        receipt_id,
    };

    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO workspaces (workspace_id, name, kind, policy_revision, \
         authorization_epoch, revision, created_at, updated_at) \
         VALUES ($1, $2, 'internal_company', 1, 1, 1, $3, $3)",
    )
    .bind(workspace_id)
    .bind(&request.name)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO workspace_policies (workspace_id, policy_revision, document, created_at) \
         VALUES ($1, 1, $2, $3)",
    )
    .bind(workspace_id)
    .bind(&document)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO operator_receipts (receipt_id, operator, command, workspace_id, \
         request_digest, response, recorded_at) \
         VALUES ($1, $2, 'create_workspace', $3, $4, $5, $6)",
    )
    .bind(receipt_id)
    .bind(&request.operator)
    .bind(workspace_id)
    .bind(&digest)
    .bind(Json(&outcome))
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO invites (invite_id, workspace_id, issuer, subject, roles, \
         policy_revision, operator_receipt_id, state, revision, created_at, expires_at) \
         VALUES ($1, $2, $3, $4, $5, 1, $6, 'pending', 1, $7, $8)",
    )
    .bind(invite_id)
    .bind(workspace_id)
    .bind(&request.first_admin_issuer)
    .bind(&request.first_admin_subject)
    .bind(&admin_roles)
    .bind(receipt_id)
    .bind(now)
    .bind(expires_at)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::info!(%workspace_id, %receipt_id, "workspace created by operator");
    Ok(outcome)
}

/// Stores a new policy revision for an `internal_company` Workspace and
/// increments its authorization epoch, with an operator receipt. Refused when
/// the Workspace has active members and none of them would hold
/// `manage_membership` under the new policy.
pub async fn update_policy(
    pool: &PgPool,
    request: UpdatePolicy,
    now: DateTime<Utc>,
) -> Result<UpdatePolicyOutcome, AdminError> {
    check_operator(&request.operator)?;
    let policy = WorkspacePolicy::parse(&request.policy).map_err(policy_error)?;
    let document = policy.to_value();
    let digest = request_digest(&json!({
        "command": "update_policy",
        "workspace_id": request.workspace_id,
        "policy": document,
        "operator": request.operator,
    }));

    let mut tx = pool.begin().await?;
    let workspace = lock_workspace(
        &mut tx,
        request.workspace_id,
        crate::sessions::LockMode::Update,
    )
    .await?
    .ok_or(AdminError::WorkspaceNotFound)?;
    if !workspace.kind.is_some_and(WorkspaceKind::is_enabled) {
        return Err(AdminError::RouteNotAvailable(
            "only `internal_company` Workspaces have an editable policy (OQ-15)".to_string(),
        ));
    }
    let members: Vec<Vec<String>> = sqlx::query_scalar(
        "SELECT roles FROM memberships WHERE workspace_id = $1 AND status = 'active'",
    )
    .bind(request.workspace_id)
    .fetch_all(&mut *tx)
    .await?;
    if !members.is_empty()
        && !members
            .iter()
            .any(|roles| policy.permits(roles, Action::ManageMembership))
    {
        return Err(AdminError::Conflict(
            "no active member would hold manage_membership under the new policy",
        ));
    }
    let policy_revision = workspace.policy_revision + 1;
    sqlx::query(
        "INSERT INTO workspace_policies (workspace_id, policy_revision, document, created_at) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(request.workspace_id)
    .bind(policy_revision)
    .bind(&document)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    sqlx::query("UPDATE workspaces SET policy_revision = $2 WHERE workspace_id = $1")
        .bind(request.workspace_id)
        .bind(policy_revision)
        .execute(&mut *tx)
        .await?;
    let epoch = increment_epoch(&mut tx, request.workspace_id, "policy_updated", None, now).await?;
    let receipt_id = Uuid::new_v4();
    let outcome = UpdatePolicyOutcome {
        workspace_id: request.workspace_id,
        policy_revision: policy_revision.to_string(),
        authorization_epoch: epoch.to_string(),
        receipt_id,
    };
    sqlx::query(
        "INSERT INTO operator_receipts (receipt_id, operator, command, workspace_id, \
         request_digest, response, recorded_at) \
         VALUES ($1, $2, 'update_policy', $3, $4, $5, $6)",
    )
    .bind(receipt_id)
    .bind(&request.operator)
    .bind(request.workspace_id)
    .bind(&digest)
    .bind(Json(&outcome))
    .bind(now)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    tracing::info!(workspace_id = %request.workspace_id, %receipt_id, "workspace policy updated by operator");
    Ok(outcome)
}

// Story 1.28: operator-only route approval control plane.
pub use crate::route_eligibility::{RouteApprovalChange, RouteApprovalCommand, RouteApprovalOutcome};
pub use crate::route_eligibility::apply as route_approval;
