//! SC-2 principal-scoped session commands and their durable receipts.
//!
//! One transaction covers, in order: authenticating the caller (principal locked
//! `FOR UPDATE`, which serializes this principal's commands), checking the command
//! epoch and schema version, looking up the receipt key
//! `(principal_id, 'principal', principal_id, operation_id)`, authorizing the
//! target, comparing the expected revision, applying the mutation and writing the
//! receipt. An exact retry returns the recorded response; the same key with a
//! different request digest is `version_conflict`.

use crate::digest::request_digest;
use crate::error::ApiError;
use crate::server::AppState;
use crate::sessions;
use crate::sessions::LockMode;
use inquello_domain::OperationId;
use inquello_protocol::CommandEpoch;
use inquello_protocol::Revision;
use inquello_protocol::SCHEMA_VERSION;
use inquello_protocol::command::CommandResponse;
use inquello_protocol::command::CommandStatus;
use inquello_protocol::command::ScopeKind;
use inquello_protocol::command::SessionCommand;
use inquello_protocol::command::SessionCommandEnvelope;
use sqlx::PgConnection;
use sqlx::Row;
use sqlx::types::Json;
use uuid::Uuid;

/// Reads the current command epoch. `FOR SHARE` makes an epoch rotation wait for
/// in-flight commands, and commands wait for a rotation.
pub(crate) async fn current_epoch(
    conn: &mut PgConnection,
    lock: bool,
) -> Result<CommandEpoch, ApiError> {
    let sql = if lock {
        "SELECT command_epoch FROM service_state WHERE singleton FOR SHARE"
    } else {
        "SELECT command_epoch FROM service_state WHERE singleton"
    };
    let epoch: i64 = sqlx::query_scalar(sql).fetch_one(&mut *conn).await?;
    u64::try_from(epoch)
        .map(CommandEpoch::new)
        .map_err(|_| ApiError::dependency(&sqlx::Error::Decode("negative command epoch".into())))
}

/// `POST /v1/session/commands`.
pub(crate) async fn handle_session_command(
    state: &AppState,
    access: &str,
    envelope: SessionCommandEnvelope,
) -> Result<CommandResponse, ApiError> {
    let now = state.clock.now();
    let digest = request_digest(
        &serde_json::to_value(&envelope)
            .map_err(|_| ApiError::unsupported_contract("envelope not serializable"))?,
    );
    let mut tx = state.pool.begin().await?;
    let auth =
        sessions::authenticate(&mut tx, access, now, LockMode::Update, LockMode::Share).await?;

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

    let scope = ScopeKind::Principal.as_str();
    let existing = sqlx::query(
        "SELECT request_digest, response FROM operation_receipts \
         WHERE principal_id = $1 AND scope_kind = $2 AND scope_id = $1 AND operation_id = $3",
    )
    .bind(auth.principal_id)
    .bind(scope)
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
        let Json(response): Json<CommandResponse> = receipt.try_get("response")?;
        // Present-access check: the recorded resource must still be one of this
        // principal's sessions before its outcome is shown again.
        let owned: Option<i32> = sqlx::query_scalar(
            "SELECT 1 FROM sessions WHERE session_id = $1 AND principal_id = $2",
        )
        .bind(response.resource_id)
        .bind(auth.principal_id)
        .fetch_optional(&mut *tx)
        .await?;
        if owned.is_none() {
            return Err(ApiError::denied("recorded resource no longer accessible"));
        }
        tx.commit().await?;
        tracing::info!(principal_id = %auth.principal_id, %operation_id, "receipt replayed");
        return Ok(response);
    }

    let command_name = envelope.payload.name();
    let (resource_id, revision) = match envelope.payload {
        SessionCommand::Logout { session_id } => {
            logout(
                &mut tx,
                auth.principal_id,
                session_id,
                envelope.expected_revision,
                now,
            )
            .await?
        }
    };
    let receipt_id = Uuid::new_v4();
    let response = CommandResponse {
        operation_id: operation_id.as_str().to_string(),
        resource_id,
        revision,
        authorization_epoch: None,
        status: CommandStatus::Applied,
        receipt_id,
    };
    let epoch = i64::try_from(envelope.command_epoch.get())
        .map_err(|_| ApiError::unsupported_contract("command epoch out of range"))?;
    sqlx::query(
        "INSERT INTO operation_receipts (receipt_id, principal_id, scope_kind, scope_id, \
         operation_id, command_epoch, command, request_digest, response, recorded_at) \
         VALUES ($1, $2, $3, $2, $4, $5, $6, $7, $8, $9)",
    )
    .bind(receipt_id)
    .bind(auth.principal_id)
    .bind(scope)
    .bind(operation_id.as_str())
    .bind(epoch)
    .bind(command_name)
    .bind(&digest)
    .bind(Json(&response))
    .bind(now)
    .execute(&mut *tx)
    .await?;
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    tracing::info!(principal_id = %auth.principal_id, %operation_id, %receipt_id, "command applied");
    Ok(response)
}

/// Revokes one of the principal's sessions (and its refresh family). A session
/// that does not exist and one that belongs to someone else are refused the same
/// way, so the answer never confirms another principal's session exists.
async fn logout(
    conn: &mut PgConnection,
    principal_id: Uuid,
    session_id: Uuid,
    expected: Revision,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<(Uuid, Revision), ApiError> {
    let row = sqlx::query(
        "SELECT revision, family_id FROM sessions \
         WHERE session_id = $1 AND principal_id = $2 FOR UPDATE",
    )
    .bind(session_id)
    .bind(principal_id)
    .fetch_optional(&mut *conn)
    .await?
    .ok_or_else(|| ApiError::denied("target session not accessible"))?;
    let current: i64 = row.try_get("revision")?;
    let family_id: Uuid = row.try_get("family_id")?;
    if u64::try_from(current).ok() != Some(expected.get()) {
        return Err(ApiError::version_conflict(
            "expected revision does not match",
        ));
    }
    let revision: i64 = sqlx::query_scalar(
        "UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2), revision = revision + 1 \
         WHERE session_id = $1 RETURNING revision",
    )
    .bind(session_id)
    .bind(now)
    .fetch_one(&mut *conn)
    .await?;
    // Also revoke the family; the target is already revoked, so only its
    // credentials and any sibling sessions change here.
    sessions::revoke_family_locked(conn, principal_id, family_id, now, "logout").await?;
    sqlx::query(
        "INSERT INTO invalidation_events (principal_id, session_id, family_id, reason, recorded_at) \
         VALUES ($1, $2, $3, 'logout', $4)",
    )
    .bind(principal_id)
    .bind(session_id)
    .bind(family_id)
    .bind(now)
    .execute(&mut *conn)
    .await?;
    let revision = u64::try_from(revision)
        .map(Revision::new)
        .map_err(|_| ApiError::dependency(&sqlx::Error::Decode("negative revision".into())))?;
    Ok((session_id, revision))
}
