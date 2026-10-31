//! Current, transaction-ordered route authority. Discovery and historical
//! receipts are not leases; every protected operation obtains a new check.
use crate::admin::AdminError;
use crate::commands;
use crate::digest::request_digest;
use crate::error::ApiError;
use crate::server::AppState;
use crate::sessions::{self, LockMode};
use crate::workspace_commands::increment_epoch;
use crate::workspaces;
use chrono::{DateTime, Utc};
use inquello_domain::authorization::{Action, DenyReason};
use inquello_domain::routes::{
    CurrentRouteAuthority, OrganizationRouteApproval, ProtectedRouteAction,
    RouteEvidenceIdentity, RouteId, compiled_route_evidence, sha256_digest,
};
use inquello_protocol::workspace as wire;
use serde::{Deserialize, Serialize};
use sqlx::{PgConnection, PgPool, Row};
use sqlx::types::Json;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteApprovalCommand {
    pub workspace_id: Uuid,
    pub operation_id: Uuid,
    #[serde(with = "decimal_revision")]
    pub command_epoch: u64,
    #[serde(with = "decimal_revision")]
    pub expected_revision: u64,
    pub operator: String,
    pub payload: RouteApprovalChange,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
pub enum RouteApprovalChange {
    Approve { identity: RouteEvidenceIdentity, approval: OrganizationRouteApproval },
    Revoke { route_id: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteApprovalOutcome {
    pub workspace_id: Uuid,
    pub route_id: String,
    pub revision: String,
    pub authorization_epoch: String,
    pub receipt_id: Uuid,
}

fn bounded(value: &str, max: usize) -> bool {
    !value.trim().is_empty() && value.len() <= max && !value.chars().any(char::is_control)
}

fn unavailable() -> ApiError { ApiError::refused(DenyReason::RouteNotAvailable) }

fn valid_approval(a: &OrganizationRouteApproval, now: i64) -> bool {
    Uuid::parse_str(&a.workspace_id).is_ok()
        && RouteId::parse(&a.route_id).is_some()
        && sha256_digest(&a.evidence_digest) && sha256_digest(&a.data_policy_digest)
        && bounded(&a.processing_scope, 256) && bounded(&a.issuer, 512)
        && bounded(&a.operator_reference, 512)
        && !a.revoked && a.revision > 0 && a.policy_revision > 0
        && a.valid_from <= now && now < a.review_at && a.review_at <= a.expires_at
}

async fn stored(conn: &mut PgConnection, workspace: Uuid, route: &str)
    -> Result<Option<(i64, RouteEvidenceIdentity, OrganizationRouteApproval)>, ApiError>
{
    let row = sqlx::query("SELECT revision, identity, approval FROM route_approvals WHERE workspace_id = $1 AND route_id = $2")
        .bind(workspace).bind(route).fetch_optional(&mut *conn).await?;
    row.map(|row| {
        let identity: Json<RouteEvidenceIdentity> = row.try_get("identity")?;
        let approval: Json<OrganizationRouteApproval> = row.try_get("approval")?;
        Ok((row.try_get("revision")?, identity.0, approval.0))
    }).transpose()
}

/// Operator-only entry point. No HTTP route reaches it. Exact retries return
/// metadata, not the approval document and never permission to use it.
pub async fn apply(pool: &PgPool, request: RouteApprovalCommand, now: DateTime<Utc>)
    -> Result<RouteApprovalOutcome, AdminError>
{
    apply_with_evidence(pool,request,now,compiled_route_evidence).await
}
// Private dependency seam: production entry points always use the compiled
// register. Only cfg(test) unit tests supply a fixture lookup; no runtime input.
type EvidenceLookup = fn(&RouteEvidenceIdentity,&str) -> Option<inquello_domain::routes::NegativeAuthorizationEvidence>;
async fn apply_with_evidence(pool: &PgPool, request: RouteApprovalCommand, now: DateTime<Utc>, evidence: EvidenceLookup)
    -> Result<RouteApprovalOutcome, AdminError>
{
    if !bounded(&request.operator, 128) || request.operation_id.is_nil() {
        return Err(AdminError::Invalid("explicit operator and operation ID required".into()));
    }
    let route = match &request.payload {
        RouteApprovalChange::Approve { identity, .. } => &identity.route_id,
        RouteApprovalChange::Revoke { route_id } => route_id,
    };
    if RouteId::parse(route).is_none() { return Err(AdminError::RouteNotAvailable("unsupported route".into())); }
    let digest = request_digest(&serde_json::to_value(&request)
        .map_err(|_| AdminError::Invalid("invalid approval command".into()))?);
    let mut tx = pool.begin().await?;
    let epoch = commands::current_epoch(&mut tx, true).await?;
    let workspace = workspaces::lock_workspace(&mut tx, request.workspace_id, LockMode::Update)
        .await?.ok_or(AdminError::WorkspaceNotFound)?;
    if !workspace.kind.is_some_and(|kind| kind.is_enabled()) {
        return Err(AdminError::RouteNotAvailable("unsupported Workspace".into()));
    }
    if let Some(row) = sqlx::query("SELECT request_digest, response FROM route_approval_receipts WHERE workspace_id = $1 AND operation_id = $2")
        .bind(request.workspace_id).bind(request.operation_id).fetch_optional(&mut *tx).await?
    {
        if row.try_get::<String, _>("request_digest")? != digest {
            return Err(AdminError::Conflict("operation ID already used with different payload"));
        }
        let response: Json<RouteApprovalOutcome> = row.try_get("response")?;
        tx.commit().await?;
        return Ok(response.0);
    }
    if request.command_epoch != epoch.get() {
        return Err(AdminError::Conflict("command epoch is not current"));
    }
    let previous = stored(&mut tx, request.workspace_id, route).await?;
    let revision = previous.as_ref().map_or(0, |(revision, _, _)| *revision);
    if u64::try_from(revision).ok() != Some(request.expected_revision) {
        return Err(AdminError::Conflict("approval revision changed"));
    }
    let next = revision.checked_add(1).ok_or(AdminError::Conflict("revision exhausted"))?;
    let (identity, approval) = match &request.payload {
        RouteApprovalChange::Approve { identity, approval } => {
            if !valid_approval(approval, now.timestamp())
                || approval.workspace_id != request.workspace_id.to_string()
                || approval.route_id != identity.route_id
                || approval.revision != next as u64
                || approval.policy_revision != workspace.policy_revision as u64
                || evidence(identity, &approval.evidence_digest).is_none_or(|proof| proof.processing_scope != approval.processing_scope || proof.data_policy_digest != approval.data_policy_digest)
            {
                return Err(AdminError::RouteNotAvailable("complete compiled exact-route evidence and valid scoped approval required".into()));
            }
            (identity.clone(), approval.clone())
        }
        RouteApprovalChange::Revoke { .. } => {
            let (_, identity, mut approval) = previous.ok_or(AdminError::Conflict("no approval to revoke"))?;
            approval.revoked = true;
            approval.revision = next as u64;
            (identity, approval)
        }
    };
    sqlx::query("INSERT INTO route_approvals (workspace_id, route_id, revision, identity, approval, updated_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (workspace_id,route_id) DO UPDATE SET revision = EXCLUDED.revision, identity = EXCLUDED.identity, approval = EXCLUDED.approval, updated_at = EXCLUDED.updated_at")
        .bind(request.workspace_id).bind(route).bind(next).bind(Json(&identity)).bind(Json(&approval)).bind(now)
        .execute(&mut *tx).await?;
    let epoch = increment_epoch(&mut tx, request.workspace_id, "route_approval_changed", None, now).await?;
    let outcome = RouteApprovalOutcome { workspace_id: request.workspace_id, route_id: route.clone(),
        revision: next.to_string(), authorization_epoch: epoch.to_string(), receipt_id: Uuid::new_v4() };
    sqlx::query("INSERT INTO route_approval_receipts (workspace_id,operation_id,receipt_id,operator,command_epoch,request_digest,response,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(request.workspace_id).bind(request.operation_id).bind(outcome.receipt_id).bind(&request.operator)
        .bind(i64::try_from(request.command_epoch).map_err(|_| AdminError::Invalid("command epoch out of range".into()))?)
        .bind(digest).bind(Json(&outcome)).bind(now).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO route_approval_history (workspace_id,route_id,revision,identity,approval,receipt_id,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7)")
        .bind(request.workspace_id).bind(route).bind(next).bind(Json(&identity)).bind(Json(&approval))
        .bind(outcome.receipt_id).bind(now).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(outcome)
}

pub(crate) async fn view(state: &AppState, access: &str, workspace_id: Uuid, route: &str)
    -> Result<wire::RouteApprovalView, ApiError>
{
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(&mut tx, access, state.clock.as_ref(), LockMode::Share, LockMode::Share)
        .await.map_err(ApiError::on_workspace_route)?;
    let authority = workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share).await?;
    authority.require_member()?;
    if RouteId::parse(route).is_none() { return Err(unavailable()); }
    let approval = stored(&mut tx, workspace_id, route).await?.map(|(_, _, approval)| approval);
    let expires_at:DateTime<Utc>=sqlx::query_scalar("SELECT expires_at FROM sessions WHERE session_id=$1").bind(auth.session_id).fetch_one(&mut *tx).await?;
    if expires_at<=state.clock.now() {return Err(unavailable());}
    let view = wire::RouteApprovalView { approval, authorization_epoch: authority.epoch()?,
        policy_revision: workspaces::revision(authority.workspace.policy_revision)? };
    tx.commit().await?;
    Ok(view)
}

pub(crate) async fn check(state: &AppState, access: &str, workspace_id: Uuid, request: wire::RouteEligibilityCheckRequest)
    -> Result<wire::RouteEligibilityCheckResponse, ApiError>
{
    check_with_evidence(state,access,workspace_id,request,compiled_route_evidence).await
}
async fn check_with_evidence(state: &AppState, access: &str, workspace_id: Uuid,
    request: wire::RouteEligibilityCheckRequest, evidence: EvidenceLookup)
    -> Result<wire::RouteEligibilityCheckResponse, ApiError>
{
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(&mut tx, access, state.clock.as_ref(), LockMode::Share, LockMode::Share)
        .await.map_err(ApiError::on_workspace_route)?;
    let authority = workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share).await?;
    authority.require(match request.binding.action {
        ProtectedRouteAction::Read => Action::Read,
        ProtectedRouteAction::Derive | ProtectedRouteAction::Resume => Action::Derive,
        ProtectedRouteAction::Export => Action::Export,
    })?;
    let binding = &request.binding;
    let principal_revision: i64 = sqlx::query_scalar("SELECT revision FROM principals WHERE principal_id = $1")
        .bind(auth.principal_id).fetch_one(&mut *tx).await?;
    let session_revision: i64 = sqlx::query_scalar("SELECT revision FROM sessions WHERE session_id = $1")
        .bind(auth.session_id).fetch_one(&mut *tx).await?;
    if binding.principal_id != auth.principal_id.to_string() || binding.session_id != auth.session_id.to_string()
        || binding.workspace_id != workspace_id.to_string()
        || Uuid::parse_str(&binding.task_id).is_err() || Uuid::parse_str(&binding.operation_id).is_err()
        || binding.principal_revision != principal_revision as u64 || binding.session_revision != session_revision as u64
        || binding.authorization_epoch != authority.workspace.authorization_epoch as u64
        || binding.policy_revision != authority.workspace.policy_revision as u64
        || !bounded(&binding.processing_scope, 256) || !sha256_digest(&binding.data_policy_digest)
        || evidence(&request.identity, &request.report_digest).is_none_or(|proof| proof.processing_scope != binding.processing_scope || proof.data_policy_digest != binding.data_policy_digest)
    { return Err(unavailable()); }
    let (revision, identity, approval) = stored(&mut tx, workspace_id, &request.identity.route_id).await?
        .ok_or_else(unavailable)?;
    let decision_time = state.clock.now();
    let expires_at: DateTime<Utc> = sqlx::query_scalar("SELECT expires_at FROM sessions WHERE session_id=$1")
        .bind(auth.session_id).fetch_one(&mut *tx).await?;
    if expires_at <= decision_time { return Err(unavailable()); }
    let checked_at = decision_time.timestamp();
    if identity != request.identity || !valid_approval(&approval, checked_at)
        || approval.workspace_id != workspace_id.to_string() || approval.route_id != identity.route_id
        || approval.revision != revision as u64 || approval.revision != binding.approval_revision
        || approval.policy_revision != binding.policy_revision || approval.evidence_digest != request.report_digest
        || approval.processing_scope != binding.processing_scope || approval.data_policy_digest != binding.data_policy_digest
    { return Err(unavailable()); }
    let response = wire::RouteEligibilityCheckResponse { authority: CurrentRouteAuthority {
        binding: request.binding, approval, checked_at,
    }};
    tx.commit().await?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn approval() -> OrganizationRouteApproval {
        OrganizationRouteApproval {
            workspace_id: Uuid::new_v4().to_string(), route_id: "codex-responses".into(),
            evidence_digest: "a".repeat(64), processing_scope: "fixture".into(), data_policy_digest: "b".repeat(64),
            issuer: "fixture-issuer".into(), operator_reference: "fixture-reference".into(),
            valid_from: 10, review_at: 20, expires_at: 30, revision: 1, policy_revision: 1, revoked: false,
        }
    }
    #[test]
    fn validity_is_half_open_and_revocation_is_not_a_ttl() {
        let a = approval();
        assert!(!valid_approval(&a, 9)); assert!(valid_approval(&a, 10));
        assert!(valid_approval(&a, 19)); assert!(!valid_approval(&a, 20));
        let mut a = a; a.revoked = true; assert!(!valid_approval(&a, 11));
    }
    #[test]
    fn approval_scope_and_issuer_must_be_explicit_bounded_and_known() {
        let mutations: [fn(&mut OrganizationRouteApproval); 6] = [
            |a: &mut OrganizationRouteApproval| a.issuer.clear(),
            |a: &mut OrganizationRouteApproval| a.processing_scope.clear(),
            |a: &mut OrganizationRouteApproval| a.operator_reference.clear(),
            |a: &mut OrganizationRouteApproval| a.data_policy_digest = "unknown".into(),
            |a: &mut OrganizationRouteApproval| a.route_id = "claude-subscription".into(),
            |a: &mut OrganizationRouteApproval| a.review_at = 31,
        ];
        for mutate in mutations { let mut a = approval(); mutate(&mut a); assert!(!valid_approval(&a, 11)); }
    }
    #[test]
    fn additive_migration_neither_seeds_approval_nor_replaces_identity_tables() {
        let migration = include_str!("../migrations/0003_route_eligibility.sql").to_uppercase();
        assert!(!migration.contains("INSERT INTO")); assert!(!migration.contains("DROP TABLE"));
        assert!(migration.contains("PRIMARY KEY (WORKSPACE_ID, OPERATION_ID)"));
    }
}

mod decimal_revision {
    use serde::{Deserialize, Serialize, Deserializer, Serializer};
    pub fn serialize<S:Serializer>(value:&u64,serializer:S)->Result<S::Ok,S::Error>{inquello_protocol::Revision::new(*value).serialize(serializer)}
    pub fn deserialize<'de,D:Deserializer<'de>>(deserializer:D)->Result<u64,D::Error>{Ok(inquello_protocol::Revision::deserialize(deserializer)?.get())}
}

#[cfg(all(test,feature="test-issuer"))]
#[path="route_eligibility_fixture_tests.rs"]
mod transaction_tests;
