//! SC-2 Workspace-scoped membership-management commands and their receipts.
//!
//! One transaction covers, in lock order: authenticating the caller (principal
//! `FOR UPDATE`, session `FOR SHARE`), the command epoch and schema checks, the
//! Workspace authorization-epoch lock (`FOR UPDATE` for commands that change
//! authority, `FOR SHARE` otherwise), the receipt lookup under the key
//! `(principal_id, 'workspace', workspace_id, operation_id)`, the authorization
//! decision, the target resource lock and expected-revision check, the mutation,
//! any epoch increment with its durable Workspace event, and the receipt. A
//! removal or role change that commits first is therefore always seen by a later
//! command, which cannot commit on its old authority.
//!
//! An exact retry returns the recorded response only after rechecking that the
//! caller still holds `manage_membership` in the Workspace; otherwise it is
//! refused like a new command. The same key with a different request digest is
//! `version_conflict`.

use crate::commands::current_epoch;
use crate::digest::request_digest;
use crate::error::ApiError;
use crate::server::AppState;
use crate::sessions;
use crate::sessions::LockMode;
use crate::workspaces;
use crate::workspaces::WorkspaceAuthority;
use crate::workspaces::revision;
use chrono::DateTime;
use chrono::Utc;
use inquello_domain::OperationId;
use inquello_domain::authorization::Action;
use inquello_domain::authorization::WorkspacePolicy;
use inquello_protocol::Revision;
use inquello_protocol::SCHEMA_VERSION;
use inquello_protocol::command::CommandResponse;
use inquello_protocol::command::CommandStatus;
use inquello_protocol::command::ScopeKind;
use inquello_protocol::workspace::WorkspaceCommand;
use inquello_protocol::workspace::WorkspaceCommandEnvelope;
use sqlx::PgConnection;
use sqlx::Row;
use sqlx::types::Json;
use std::collections::BTreeSet;
use uuid::Uuid;

/// The longest invite issuer accepted.
const MAX_ISSUER_BYTES: usize = 2048;
/// The longest invite subject accepted.
const MAX_SUBJECT_CHARS: usize = 255;
/// The longest Engagement name accepted.
const MAX_ENGAGEMENT_NAME_CHARS: usize = 200;

/// Whether a command changes authority, so it takes the Workspace row
/// `FOR UPDATE` and increments the authorization epoch.
fn changes_authority(command: &WorkspaceCommand) -> bool {
    matches!(
        command,
        WorkspaceCommand::ChangeRoles { .. }
            | WorkspaceCommand::RemoveMember { .. }
            | WorkspaceCommand::RemoveEngagementMember { .. }
    )
}

/// What a command changed.
struct Applied {
    resource_id: Uuid,
    revision: i64,
    /// The Workspace event to record with an epoch increment, if any.
    epoch_event: Option<(&'static str, Uuid)>,
}

fn expect_revision(current: i64, expected: Revision) -> Result<(), ApiError> {
    if u64::try_from(current).ok() == Some(expected.get()) {
        Ok(())
    } else {
        Err(ApiError::version_conflict(
            "expected revision does not match",
        ))
    }
}

/// Validates role bindings against the current policy: non-empty, no
/// duplicates, every role defined. A role the policy lacks is a conflict with
/// the current state (the policy may have changed), not a malformed request.
fn validate_roles(policy: &WorkspacePolicy, roles: &[String]) -> Result<(), ApiError> {
    if roles.is_empty() {
        return Err(ApiError::unsupported_contract("no roles given"));
    }
    let unique: BTreeSet<&str> = roles.iter().map(String::as_str).collect();
    if unique.len() != roles.len() {
        return Err(ApiError::unsupported_contract("duplicate roles"));
    }
    if roles.iter().any(|role| policy.role(role).is_none()) {
        return Err(ApiError::version_conflict("role not in the current policy"));
    }
    Ok(())
}

/// Refuses a change that would leave the Workspace with no active member holding
/// `manage_membership`. `excluding` is the member being changed or removed;
/// `replacement` its new roles, if it stays.
async fn keep_an_administrator(
    conn: &mut PgConnection,
    authority: &WorkspaceAuthority,
    excluding: Uuid,
    replacement: Option<&[String]>,
) -> Result<(), ApiError> {
    if replacement.is_some_and(|roles| authority.policy.permits(roles, Action::ManageMembership)) {
        return Ok(());
    }
    let others: Vec<Vec<String>> = sqlx::query_scalar(
        "SELECT roles FROM memberships \
         WHERE workspace_id = $1 AND principal_id <> $2 AND status = 'active'",
    )
    .bind(authority.workspace.workspace_id)
    .bind(excluding)
    .fetch_all(&mut *conn)
    .await?;
    if others
        .iter()
        .any(|roles| authority.policy.permits(roles, Action::ManageMembership))
    {
        Ok(())
    } else {
        Err(ApiError::version_conflict(
            "the change would leave no administrator",
        ))
    }
}

/// Locks an active member's row for a change, checking its revision.
async fn lock_active_member(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    principal_id: Uuid,
    expected: Revision,
) -> Result<(), ApiError> {
    let row = workspaces::membership(conn, workspace_id, principal_id, Some(LockMode::Update))
        .await?
        .filter(|m| m.active)
        .ok_or_else(|| ApiError::version_conflict("target is not an active member"))?;
    expect_revision(row.revision, expected)
}

/// Locks an Engagement of this Workspace, checking its revision.
async fn lock_engagement(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    engagement_id: Uuid,
    expected: Revision,
) -> Result<(), ApiError> {
    let current: i64 = sqlx::query_scalar(
        "SELECT revision FROM engagements \
         WHERE engagement_id = $1 AND workspace_id = $2 FOR UPDATE",
    )
    .bind(engagement_id)
    .bind(workspace_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| ApiError::version_conflict("engagement not found in this workspace"))?;
    expect_revision(current, expected)
}

async fn bump_engagement(
    conn: &mut PgConnection,
    engagement_id: Uuid,
    now: DateTime<Utc>,
) -> Result<i64, ApiError> {
    Ok(sqlx::query_scalar(
        "UPDATE engagements SET revision = revision + 1, updated_at = $2 \
         WHERE engagement_id = $1 RETURNING revision",
    )
    .bind(engagement_id)
    .bind(now)
    .fetch_one(&mut *conn)
    .await?)
}

async fn apply(
    conn: &mut PgConnection,
    state: &AppState,
    authority: &WorkspaceAuthority,
    command: &WorkspaceCommand,
    expected: Revision,
    now: DateTime<Utc>,
) -> Result<Applied, ApiError> {
    let workspace_id = authority.workspace.workspace_id;
    let policy_revision = authority.workspace.policy_revision;
    match command {
        WorkspaceCommand::IssueInvite {
            issuer,
            subject,
            roles,
        } => {
            expect_revision(0, expected)?;
            if issuer.is_empty() || issuer.len() > MAX_ISSUER_BYTES {
                return Err(ApiError::unsupported_contract("invalid invite issuer"));
            }
            if subject.is_empty() || subject.chars().count() > MAX_SUBJECT_CHARS {
                return Err(ApiError::unsupported_contract("invalid invite subject"));
            }
            validate_roles(&authority.policy, roles)?;
            let invite_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO invites (invite_id, workspace_id, issuer, subject, roles, \
                 policy_revision, issued_by, state, revision, created_at, expires_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 1, $8, $9)",
            )
            .bind(invite_id)
            .bind(workspace_id)
            .bind(issuer)
            .bind(subject)
            .bind(roles)
            .bind(policy_revision)
            .bind(authority.principal_id)
            .bind(now)
            .bind(now + state.lifetimes.invite)
            .execute(&mut *conn)
            .await?;
            Ok(Applied {
                resource_id: invite_id,
                revision: 1,
                epoch_event: None,
            })
        }
        WorkspaceCommand::RevokeInvite { invite_id } => {
            let row = sqlx::query(
                "SELECT state, revision FROM invites \
                 WHERE invite_id = $1 AND workspace_id = $2 FOR UPDATE",
            )
            .bind(invite_id)
            .bind(workspace_id)
            .fetch_optional(&mut *conn)
            .await?
            .ok_or_else(|| ApiError::version_conflict("invite not found in this workspace"))?;
            let invite_state: String = row.try_get("state")?;
            expect_revision(row.try_get("revision")?, expected)?;
            if invite_state != "pending" {
                return Err(ApiError::version_conflict("invite is not pending"));
            }
            let revision: i64 = sqlx::query_scalar(
                "UPDATE invites SET state = 'revoked', closed_at = $2, revision = revision + 1 \
                 WHERE invite_id = $1 RETURNING revision",
            )
            .bind(invite_id)
            .bind(now)
            .fetch_one(&mut *conn)
            .await?;
            Ok(Applied {
                resource_id: *invite_id,
                revision,
                epoch_event: None,
            })
        }
        WorkspaceCommand::ChangeRoles {
            principal_id,
            roles,
        } => {
            lock_active_member(conn, workspace_id, *principal_id, expected).await?;
            validate_roles(&authority.policy, roles)?;
            keep_an_administrator(conn, authority, *principal_id, Some(roles)).await?;
            let revision: i64 = sqlx::query_scalar(
                "UPDATE memberships SET roles = $3, policy_revision = $4, \
                 revision = revision + 1, updated_at = $5 \
                 WHERE workspace_id = $1 AND principal_id = $2 RETURNING revision",
            )
            .bind(workspace_id)
            .bind(principal_id)
            .bind(roles)
            .bind(policy_revision)
            .bind(now)
            .fetch_one(&mut *conn)
            .await?;
            Ok(Applied {
                resource_id: *principal_id,
                revision,
                epoch_event: Some(("roles_changed", *principal_id)),
            })
        }
        WorkspaceCommand::RemoveMember { principal_id } => {
            lock_active_member(conn, workspace_id, *principal_id, expected).await?;
            keep_an_administrator(conn, authority, *principal_id, None).await?;
            sqlx::query(
                "UPDATE engagement_memberships SET status = 'removed', \
                 revision = revision + 1, updated_at = $3 \
                 WHERE workspace_id = $1 AND principal_id = $2 AND status = 'active'",
            )
            .bind(workspace_id)
            .bind(principal_id)
            .bind(now)
            .execute(&mut *conn)
            .await?;
            let revision: i64 = sqlx::query_scalar(
                "UPDATE memberships SET status = 'removed', roles = '{}', \
                 revision = revision + 1, updated_at = $3 \
                 WHERE workspace_id = $1 AND principal_id = $2 RETURNING revision",
            )
            .bind(workspace_id)
            .bind(principal_id)
            .bind(now)
            .fetch_one(&mut *conn)
            .await?;
            Ok(Applied {
                resource_id: *principal_id,
                revision,
                epoch_event: Some(("member_removed", *principal_id)),
            })
        }
        WorkspaceCommand::CreateEngagement { name } => {
            expect_revision(0, expected)?;
            let chars = name.chars().count();
            if name.trim().is_empty()
                || chars > MAX_ENGAGEMENT_NAME_CHARS
                || name.chars().any(char::is_control)
            {
                return Err(ApiError::unsupported_contract("invalid engagement name"));
            }
            let engagement_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO engagements (engagement_id, workspace_id, name, revision, \
                 created_by, created_at, updated_at) VALUES ($1, $2, $3, 1, $4, $5, $5)",
            )
            .bind(engagement_id)
            .bind(workspace_id)
            .bind(name)
            .bind(authority.principal_id)
            .bind(now)
            .execute(&mut *conn)
            .await?;
            Ok(Applied {
                resource_id: engagement_id,
                revision: 1,
                epoch_event: None,
            })
        }
        WorkspaceCommand::AddEngagementMember {
            engagement_id,
            principal_id,
        } => {
            lock_engagement(conn, workspace_id, *engagement_id, expected).await?;
            // Engagement membership needs an active Workspace membership.
            workspaces::membership(conn, workspace_id, *principal_id, Some(LockMode::Share))
                .await?
                .filter(|m| m.active)
                .ok_or_else(|| ApiError::version_conflict("principal is not an active member"))?;
            let current: Option<String> = sqlx::query_scalar(
                "SELECT status FROM engagement_memberships \
                 WHERE engagement_id = $1 AND principal_id = $2 FOR UPDATE",
            )
            .bind(engagement_id)
            .bind(principal_id)
            .fetch_optional(&mut *conn)
            .await?;
            match current.as_deref() {
                Some("active") => {
                    return Err(ApiError::version_conflict("already an engagement member"));
                }
                Some(_) => {
                    sqlx::query(
                        "UPDATE engagement_memberships SET status = 'active', \
                         revision = revision + 1, updated_at = $3 \
                         WHERE engagement_id = $1 AND principal_id = $2",
                    )
                    .bind(engagement_id)
                    .bind(principal_id)
                    .bind(now)
                    .execute(&mut *conn)
                    .await?;
                }
                None => {
                    sqlx::query(
                        "INSERT INTO engagement_memberships (engagement_id, workspace_id, \
                         principal_id, status, revision, updated_at) \
                         VALUES ($1, $2, $3, 'active', 1, $4)",
                    )
                    .bind(engagement_id)
                    .bind(workspace_id)
                    .bind(principal_id)
                    .bind(now)
                    .execute(&mut *conn)
                    .await?;
                }
            }
            let revision = bump_engagement(conn, *engagement_id, now).await?;
            Ok(Applied {
                resource_id: *engagement_id,
                revision,
                epoch_event: None,
            })
        }
        WorkspaceCommand::RemoveEngagementMember {
            engagement_id,
            principal_id,
        } => {
            lock_engagement(conn, workspace_id, *engagement_id, expected).await?;
            let updated = sqlx::query(
                "UPDATE engagement_memberships SET status = 'removed', \
                 revision = revision + 1, updated_at = $3 \
                 WHERE engagement_id = $1 AND principal_id = $2 AND status = 'active'",
            )
            .bind(engagement_id)
            .bind(principal_id)
            .bind(now)
            .execute(&mut *conn)
            .await?;
            if updated.rows_affected() == 0 {
                return Err(ApiError::version_conflict("not an engagement member"));
            }
            let revision = bump_engagement(conn, *engagement_id, now).await?;
            Ok(Applied {
                resource_id: *engagement_id,
                revision,
                epoch_event: Some(("engagement_member_removed", *principal_id)),
            })
        }
    }
}

/// Increments the Workspace authorization epoch and records the durable
/// invalidation event in the same transaction. Returns the new epoch.
pub(crate) async fn increment_epoch(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    kind: &str,
    principal_id: Option<Uuid>,
    now: DateTime<Utc>,
) -> Result<i64, sqlx::Error> {
    let epoch: i64 = sqlx::query_scalar(
        "UPDATE workspaces SET authorization_epoch = authorization_epoch + 1, \
         revision = revision + 1, updated_at = $2 WHERE workspace_id = $1 \
         RETURNING authorization_epoch",
    )
    .bind(workspace_id)
    .bind(now)
    .fetch_one(&mut *conn)
    .await?;
    sqlx::query(
        "INSERT INTO workspace_events (workspace_id, authorization_epoch, kind, principal_id, \
         recorded_at) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(workspace_id)
    .bind(epoch)
    .bind(kind)
    .bind(principal_id)
    .bind(now)
    .execute(&mut *conn)
    .await?;
    Ok(epoch)
}

/// `POST /v1/workspaces/{workspace_id}/commands`.
pub(crate) async fn handle(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
    envelope: WorkspaceCommandEnvelope,
) -> Result<CommandResponse, ApiError> {
    let now = state.clock.now();
    if envelope.workspace_id != workspace_id {
        return Err(ApiError::unsupported_contract(
            "envelope workspace does not match the path",
        ));
    }
    let digest = request_digest(
        &serde_json::to_value(&envelope)
            .map_err(|_| ApiError::unsupported_contract("envelope not serializable"))?,
    );
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(&mut tx, access, now, LockMode::Update, LockMode::Share)
        .await
        .map_err(ApiError::on_workspace_route)?;
    if envelope.command_epoch != current_epoch(&mut tx, true).await? {
        return Err(ApiError::unsupported_contract(
            "command epoch is not current",
        ));
    }
    if envelope.schema_version != SCHEMA_VERSION {
        return Err(ApiError::unsupported_contract("unsupported schema version"));
    }
    let operation_id = OperationId::parse(&envelope.operation_id)
        .map_err(|_| ApiError::unsupported_contract("invalid operation ID"))?;

    let lock = if changes_authority(&envelope.payload) {
        LockMode::Update
    } else {
        LockMode::Share
    };
    let authority = workspaces::resolve(&mut tx, &auth, workspace_id, lock).await?;

    let scope = ScopeKind::Workspace.as_str();
    let existing = sqlx::query(
        "SELECT request_digest, response FROM operation_receipts \
         WHERE principal_id = $1 AND scope_kind = $2 AND scope_id = $3 AND operation_id = $4",
    )
    .bind(auth.principal_id)
    .bind(scope)
    .bind(workspace_id)
    .bind(operation_id.as_str())
    .fetch_optional(&mut *tx)
    .await?;
    if let Some(receipt) = existing {
        let recorded_digest: String = receipt.try_get("request_digest")?;
        if recorded_digest != digest {
            return Err(ApiError::version_conflict(
                "operation ID reused for a different request",
            ));
        }
        // Present-access recheck: the recorded outcome is shown again only to a
        // caller who still manages this Workspace's membership.
        authority.require(Action::ManageMembership)?;
        let Json(response): Json<CommandResponse> = receipt.try_get("response")?;
        tx.commit().await?;
        tracing::info!(principal_id = %auth.principal_id, %workspace_id, %operation_id, "workspace receipt replayed");
        return Ok(response);
    }

    authority.require(Action::ManageMembership)?;
    let applied = apply(
        &mut tx,
        state,
        &authority,
        &envelope.payload,
        envelope.expected_revision,
        now,
    )
    .await?;
    let epoch = match applied.epoch_event {
        Some((kind, principal_id)) => {
            increment_epoch(&mut tx, workspace_id, kind, Some(principal_id), now).await?
        }
        None => authority.workspace.authorization_epoch,
    };

    let receipt_id = Uuid::new_v4();
    let response = CommandResponse {
        operation_id: operation_id.as_str().to_string(),
        resource_id: applied.resource_id,
        revision: revision(applied.revision)?,
        authorization_epoch: Some(revision(epoch)?),
        status: CommandStatus::Applied,
        receipt_id,
    };
    let command_epoch = i64::try_from(envelope.command_epoch.get())
        .map_err(|_| ApiError::unsupported_contract("command epoch out of range"))?;
    sqlx::query(
        "INSERT INTO operation_receipts (receipt_id, principal_id, scope_kind, scope_id, \
         operation_id, command_epoch, command, request_digest, response, recorded_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
    )
    .bind(receipt_id)
    .bind(auth.principal_id)
    .bind(scope)
    .bind(workspace_id)
    .bind(operation_id.as_str())
    .bind(command_epoch)
    .bind(envelope.payload.name())
    .bind(&digest)
    .bind(Json(&response))
    .bind(now)
    .execute(&mut *tx)
    .await?;
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    tracing::info!(
        principal_id = %auth.principal_id,
        %workspace_id,
        %operation_id,
        %receipt_id,
        command = envelope.payload.name(),
        "workspace command applied"
    );
    Ok(response)
}
