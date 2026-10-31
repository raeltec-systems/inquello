//! Immutable hash/owner corroboration only. A receipt never grants current
//! content use: the desktop also checks native bytes/ownership and route policy.
use crate::{commands, sessions, workspaces};
use crate::digest::request_digest;
use crate::error::ApiError;
use crate::server::AppState;
use crate::sessions::{Authenticated, LockMode};
use inquello_domain::authorization::{Action, DenyReason};
use inquello_domain::routes::sha256_digest;
use inquello_protocol::workspace::{CreateExportReceiptRequest, ExportReceiptView, ValidateExportReceiptRequest};
use sqlx::{PgConnection, Row};
use uuid::Uuid;

fn unavailable() -> ApiError { ApiError::refused(DenyReason::NoGrant) }
fn validate_ids(ids: &[Uuid]) -> bool {
    !ids.is_empty() && ids.len() <= 1000 && ids.iter().all(|id| !id.is_nil())
        && ids.windows(2).all(|pair| pair[0] < pair[1])
}
async fn current_access(conn: &mut PgConnection, auth: &Authenticated, ids: &[Uuid], action: Action,
    state: &AppState) -> Result<(), ApiError>
{
    if !validate_ids(ids) { return Err(unavailable()); }
    // Input/stored order is canonical, so multi-Workspace requests never invert locks.
    for id in ids {
        workspaces::resolve(conn, auth, *id, LockMode::Share).await?
            .require(action).map_err(|_| unavailable())?;
    }
    // Workspace lock waits can cross session expiry; no offline/TTL grace.
    let expiry: chrono::DateTime<chrono::Utc> = sqlx::query_scalar("SELECT expires_at FROM sessions WHERE session_id=$1")
        .bind(auth.session_id).fetch_one(&mut *conn).await?;
    if expiry <= state.clock.now() { return Err(unavailable()); }
    Ok(())
}
fn view(row: &sqlx::postgres::PgRow) -> Result<ExportReceiptView, ApiError> {
    Ok(ExportReceiptView { receipt_id:row.try_get("receipt_id")?, principal_id:row.try_get("principal_id")?,
        manifest_digest:row.try_get("manifest_digest")?, workspace_ids:row.try_get("workspace_ids")? })
}
pub(crate) async fn create(state: &AppState, access: &str, mut request: CreateExportReceiptRequest)
    -> Result<ExportReceiptView, ApiError>
{
    if !sha256_digest(&request.manifest_digest) || request.operation_id.is_nil()
        || request.workspace_ids.is_empty() || request.workspace_ids.len() > 1000 { return Err(unavailable()); }
    request.workspace_ids.sort_unstable();
    if !validate_ids(&request.workspace_ids) { return Err(unavailable()); }
    let digest = request_digest(&serde_json::to_value(&request).map_err(|_| unavailable())?);
    let mut tx = state.pool.begin().await?;
    // UPDATE serializes same-principal receipt creation/retries, before any Workspace lock.
    let auth = sessions::authenticate(&mut tx, access, state.clock.as_ref(), LockMode::Update, LockMode::Share)
        .await.map_err(ApiError::on_workspace_route)?;
    let epoch = commands::current_epoch(&mut tx, true).await?;
    current_access(&mut tx, &auth, &request.workspace_ids, Action::Export, state).await?;
    if let Some(row) = sqlx::query("SELECT receipt_id,principal_id,request_digest,manifest_digest,workspace_ids FROM export_provenance_receipts WHERE principal_id=$1 AND operation_id=$2")
        .bind(auth.principal_id).bind(request.operation_id).fetch_optional(&mut *tx).await?
    {
        if row.try_get::<String,_>("request_digest")? != digest { return Err(ApiError::version_conflict("operation ID already used")); }
        let result=view(&row)?; tx.commit().await?; return Ok(result);
    }
    if request.command_epoch != epoch { return Err(ApiError::unsupported_contract("command epoch is not current")); }
    let result=ExportReceiptView { receipt_id:Uuid::new_v4(),principal_id:auth.principal_id,
        manifest_digest:request.manifest_digest,workspace_ids:request.workspace_ids };
    sqlx::query("INSERT INTO export_provenance_receipts (receipt_id,principal_id,operation_id,command_epoch,request_digest,manifest_digest,workspace_ids,recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(result.receipt_id).bind(auth.principal_id).bind(request.operation_id)
        .bind(i64::try_from(epoch.get()).map_err(|_| unavailable())?).bind(digest)
        .bind(&result.manifest_digest).bind(&result.workspace_ids).bind(state.clock.now()).execute(&mut *tx).await?;
    tx.commit().await.map_err(|error|ApiError::uncertain(&error))?;
    Ok(result)
}
pub(crate) async fn validate(state: &AppState, access: &str, receipt_id: Uuid, request: ValidateExportReceiptRequest)
    -> Result<ExportReceiptView, ApiError>
{
    if !sha256_digest(&request.manifest_digest) { return Err(unavailable()); }
    let mut tx=state.pool.begin().await?;
    let auth=sessions::authenticate(&mut tx,access,state.clock.as_ref(),LockMode::Share,LockMode::Share)
        .await.map_err(ApiError::on_workspace_route)?;
    // The immutable record is filtered by current principal before any disclosure.
    let row=sqlx::query("SELECT receipt_id,principal_id,manifest_digest,workspace_ids FROM export_provenance_receipts WHERE receipt_id=$1 AND principal_id=$2 AND manifest_digest=$3")
        .bind(receipt_id).bind(auth.principal_id).bind(&request.manifest_digest).fetch_optional(&mut *tx).await?
        .ok_or_else(unavailable)?;
    let result=view(&row)?;
    current_access(&mut tx,&auth,&result.workspace_ids,Action::Read,state).await.map_err(|_|unavailable())?;
    tx.commit().await?;
    Ok(result)
}
