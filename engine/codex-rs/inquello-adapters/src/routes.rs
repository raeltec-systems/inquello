//! Atomic processing-route records. No runtime credential/evidence state is stored.
use crate::SqliteWorkingStore;
use inquello_domain::organise::{PrincipalId, TaskId, WorkspaceId};
use inquello_domain::routes::*;
use inquello_domain::{OperationId, ReceiptStatus, Revision, StoreError, Timestamp};
use sqlx::sqlite::SqliteRow;
use sqlx::{Row, Sqlite, Transaction};
use uuid::Uuid;

const SELECTION_COLUMNS: &str = "t.task_id, t.revision, t.principal_id, t.route_id, t.configuration_revision, t.recorded_at_ms, c.configuration";
const SELECTION_JOIN: &str = "task_processing_routes t JOIN processing_route_candidates c ON c.principal_id = t.principal_id AND c.route_id = t.route_id AND c.revision = t.configuration_revision";

impl RouteStore for SqliteWorkingStore {
    async fn load_route_task(&self, task_id: TaskId) -> Result<Option<RouteTask>, StoreError> {
        let row = sqlx::query("SELECT creator_principal_id, workspace_id FROM tasks WHERE task_id = ?")
            .bind(task_id.to_string()).fetch_optional(self.pool()).await.map_err(backend)?;
        row.map(|r| Ok(RouteTask {
            creator: PrincipalId::from_uuid(uuid(&r, "creator_principal_id")?),
            workspace_id: WorkspaceId::from_uuid(uuid(&r, "workspace_id")?),
        })).transpose()
    }

    async fn load_task_route(&self, task_id: TaskId) -> Result<(Revision, Option<TaskRouteRecord>), StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {SELECTION_COLUMNS} FROM {SELECTION_JOIN} WHERE t.task_id = ? ORDER BY t.revision DESC LIMIT 1")))
            .bind(task_id.to_string()).fetch_optional(self.pool()).await.map_err(backend)?;
        let record = row.as_ref().map(selection).transpose()?;
        Ok((record.as_ref().map_or(Revision::ZERO, |r| r.revision), record))
    }

    async fn load_task_route_record(&self, task_id: TaskId, revision: Revision) -> Result<Option<TaskRouteRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!("SELECT {SELECTION_COLUMNS} FROM {SELECTION_JOIN} WHERE t.task_id = ? AND t.revision = ?")))
            .bind(task_id.to_string()).bind(db(revision)?).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(selection).transpose()
    }

    async fn find_route_receipt(&self, operation_id: &OperationId) -> Result<Option<RouteReceipt>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str()).fetch_optional(self.pool()).await.map_err(backend)?;
        let Some(row) = row else { return Ok(None); };
        // An operation cannot be reused across candidate/selection commands.
        if text(&row, "command")? != SET_TASK_ROUTE_COMMAND {
            return Err(StoreError::DuplicateOperation { operation_id: operation_id.clone() });
        }
        Ok(Some(RouteReceipt {
            operation_id: operation_id.clone(), principal_id: PrincipalId::from_uuid(uuid(&row, "principal_id")?),
            task_id: TaskId::from_uuid(uuid(&row, "scope_id")?),
            expected_revision: rev(&row, "expected_revision")?, resulting_revision: rev(&row, "resulting_revision")?,
            request: text(&row, "request")?, status: receipt_status(&row)?, recorded_at: timestamp(&row)?,
        }))
    }

    async fn load_candidate_route(&self, principal_id: PrincipalId, route_id: RouteId) -> Result<(Revision, Option<CandidateRouteRecord>), StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_candidates WHERE principal_id = ? AND route_id = ? ORDER BY revision DESC LIMIT 1")
            .bind(principal_id.to_string()).bind(route_id.as_str()).fetch_optional(self.pool()).await.map_err(backend)?;
        let record = row.as_ref().map(candidate).transpose()?;
        Ok((record.as_ref().map_or(Revision::ZERO, |r| r.revision), record))
    }

    async fn load_candidate_route_record(&self, principal_id: PrincipalId, route_id: RouteId, revision: Revision) -> Result<Option<CandidateRouteRecord>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_candidates WHERE principal_id = ? AND route_id = ? AND revision = ?")
            .bind(principal_id.to_string()).bind(route_id.as_str()).bind(db(revision)?).fetch_optional(self.pool()).await.map_err(backend)?;
        row.as_ref().map(candidate).transpose()
    }

    async fn find_candidate_route_receipt(&self, operation_id: &OperationId) -> Result<Option<CandidateRouteReceipt>, StoreError> {
        let row = sqlx::query("SELECT * FROM processing_route_receipts WHERE operation_id = ?")
            .bind(operation_id.as_str()).fetch_optional(self.pool()).await.map_err(backend)?;
        let Some(row) = row else { return Ok(None); };
        if text(&row, "command")? != CONFIGURE_ROUTE_COMMAND {
            return Err(StoreError::DuplicateOperation { operation_id: operation_id.clone() });
        }
        let route_id = RouteId::parse(&text(&row, "scope_id")?).ok_or_else(|| corrupt("unknown route receipt scope"))?;
        Ok(Some(CandidateRouteReceipt {
            operation_id: operation_id.clone(), principal_id: PrincipalId::from_uuid(uuid(&row, "principal_id")?), route_id,
            expected_revision: rev(&row, "expected_revision")?, resulting_revision: rev(&row, "resulting_revision")?,
            request: text(&row, "request")?, status: receipt_status(&row)?, recorded_at: timestamp(&row)?,
        }))
    }

    async fn commit_candidate_route(&self, change: CandidateRouteChange) -> Result<(), StoreError> {
        let CandidateRouteChange { expected_revision, record, receipt } = change;
        if expected_revision.next().ok() != Some(record.revision)
            || receipt.expected_revision != expected_revision || receipt.resulting_revision != record.revision
            || receipt.principal_id != record.principal_id || receipt.route_id != record.configuration.route_id()
            || receipt.recorded_at != record.recorded_at || receipt.status != ReceiptStatus::Applied
        { return Err(corrupt("inconsistent candidate route change")); }
        let configuration = serde_json::to_string(&record.configuration.input()).map_err(|_| corrupt("invalid configuration"))?;
        if receipt.request != configuration { return Err(corrupt("candidate receipt/configuration mismatch")); }
        let mut tx = self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
        check_operation(&mut tx, &receipt.operation_id).await?;
        let current: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(revision), 0) FROM processing_route_candidates WHERE principal_id = ? AND route_id = ?")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).fetch_one(&mut *tx).await.map_err(backend)?;
        check_revision(expected_revision, current)?;
        sqlx::query("INSERT INTO processing_route_candidates (principal_id, route_id, revision, configuration, recorded_at_ms) VALUES (?, ?, ?, ?, ?)")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).bind(db(record.revision)?)
            .bind(configuration).bind(record.recorded_at.unix_millis()).execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(&mut tx, &receipt.operation_id, record.principal_id, CONFIGURE_ROUTE_COMMAND, receipt.route_id.as_str(), expected_revision, record.revision, &receipt.request, record.recorded_at).await?;
        tx.commit().await.map_err(backend)
    }

    async fn commit_task_route(&self, change: RouteChange) -> Result<(), StoreError> {
        let RouteChange { expected_revision, record, receipt } = change;
        if expected_revision.next().ok() != Some(record.revision)
            || receipt.expected_revision != expected_revision || receipt.resulting_revision != record.revision
            || receipt.principal_id != record.principal_id || receipt.task_id != record.task_id
            || receipt.recorded_at != record.recorded_at || receipt.status != ReceiptStatus::Applied
        { return Err(corrupt("inconsistent Task route change")); }
        let canonical = serde_json::json!({ "task_id": record.task_id.to_string(), "route_id": record.configuration.route_id().as_str(), "configuration_revision": record.configuration_revision.get() }).to_string();
        if receipt.request != canonical { return Err(corrupt("selection receipt/configuration mismatch")); }
        let mut tx = self.pool().begin_with("BEGIN IMMEDIATE").await.map_err(backend)?;
        check_operation(&mut tx, &receipt.operation_id).await?;
        let creator: Option<String> = sqlx::query_scalar("SELECT creator_principal_id FROM tasks WHERE task_id = ?")
            .bind(record.task_id.to_string()).fetch_optional(&mut *tx).await.map_err(backend)?;
        if creator.as_deref() != Some(record.principal_id.to_string().as_str()) { return Err(corrupt("Task route creator mismatch")); }
        let candidate_row = sqlx::query("SELECT * FROM processing_route_candidates WHERE principal_id = ? AND route_id = ? ORDER BY revision DESC LIMIT 1")
            .bind(record.principal_id.to_string()).bind(record.configuration.route_id().as_str()).fetch_optional(&mut *tx).await.map_err(backend)?;
        let candidate = candidate_row.as_ref().map(candidate).transpose()?.ok_or_else(|| corrupt("missing route candidate"))?;
        if candidate.revision != record.configuration_revision {
            return Err(StoreError::RevisionConflict { expected: record.configuration_revision, actual: candidate.revision });
        }
        if candidate.configuration != record.configuration { return Err(corrupt("selection metadata does not match candidate")); }
        let current: i64 = sqlx::query_scalar("SELECT COALESCE(MAX(revision), 0) FROM task_processing_routes WHERE task_id = ?")
            .bind(record.task_id.to_string()).fetch_one(&mut *tx).await.map_err(backend)?;
        check_revision(expected_revision, current)?;
        sqlx::query("INSERT INTO task_processing_routes (task_id, revision, principal_id, route_id, configuration_revision, recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?)")
            .bind(record.task_id.to_string()).bind(db(record.revision)?).bind(record.principal_id.to_string())
            .bind(record.configuration.route_id().as_str()).bind(db(record.configuration_revision)?).bind(record.recorded_at.unix_millis())
            .execute(&mut *tx).await.map_err(backend)?;
        insert_receipt(&mut tx, &receipt.operation_id, record.principal_id, SET_TASK_ROUTE_COMMAND, &record.task_id.to_string(), expected_revision, record.revision, &receipt.request, record.recorded_at).await?;
        tx.commit().await.map_err(backend)
    }
}

async fn check_operation(tx: &mut Transaction<'_, Sqlite>, operation_id: &OperationId) -> Result<(), StoreError> {
    let exists: Option<i64> = sqlx::query_scalar("SELECT 1 FROM processing_route_receipts WHERE operation_id = ?")
        .bind(operation_id.as_str()).fetch_optional(&mut **tx).await.map_err(backend)?;
    if exists.is_some() { return Err(StoreError::DuplicateOperation { operation_id: operation_id.clone() }); }
    Ok(())
}

#[expect(clippy::too_many_arguments, reason = "one validated atomic receipt row")]
async fn insert_receipt(tx: &mut Transaction<'_, Sqlite>, operation_id: &OperationId, principal_id: PrincipalId,
    command: &str, scope: &str, expected: Revision, resulting: Revision, request: &str, time: Timestamp) -> Result<(), StoreError> {
    sqlx::query("INSERT INTO processing_route_receipts (operation_id, principal_id, command, scope_id, expected_revision, resulting_revision, request, status, recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, 'applied', ?)")
        .bind(operation_id.as_str()).bind(principal_id.to_string()).bind(command).bind(scope).bind(db(expected)?).bind(db(resulting)?)
        .bind(request).bind(time.unix_millis()).execute(&mut **tx).await.map_err(backend)?;
    Ok(())
}

fn configuration(row: &SqliteRow) -> Result<RouteConfiguration, StoreError> {
    let input = serde_json::from_str::<RouteConfigurationInput>(&text(row, "configuration")?).map_err(|_| corrupt("invalid stored route configuration"))?;
    let value = RouteConfiguration::parse(input).map_err(|_| corrupt("unsupported stored route configuration"))?;
    if value.route_id().as_str() != text(row, "route_id")? { return Err(corrupt("route ID/configuration mismatch")); }
    Ok(value)
}
fn candidate(row: &SqliteRow) -> Result<CandidateRouteRecord, StoreError> {
    Ok(CandidateRouteRecord { principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?), configuration: configuration(row)?, revision: rev(row, "revision")?, recorded_at: timestamp(row)? })
}
fn selection(row: &SqliteRow) -> Result<TaskRouteRecord, StoreError> {
    Ok(TaskRouteRecord { task_id: TaskId::from_uuid(uuid(row, "task_id")?), principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        configuration: configuration(row)?, configuration_revision: rev(row, "configuration_revision")?, revision: rev(row, "revision")?, recorded_at: timestamp(row)? })
}
fn check_revision(expected: Revision, actual: i64) -> Result<(), StoreError> {
    let actual = Revision::new(u64::try_from(actual).map_err(|_| corrupt("negative route revision"))?);
    if actual != expected { return Err(StoreError::RevisionConflict { expected, actual }); }
    Ok(())
}
fn receipt_status(row: &SqliteRow) -> Result<ReceiptStatus, StoreError> {
    if text(row, "status")? != "applied" { return Err(corrupt("unknown route receipt status")); }
    Ok(ReceiptStatus::Applied)
}
fn text(row: &SqliteRow, key: &str) -> Result<String, StoreError> { row.try_get(key).map_err(backend) }
fn uuid(row: &SqliteRow, key: &str) -> Result<Uuid, StoreError> { Uuid::parse_str(&text(row, key)?).map_err(|_| corrupt("invalid route UUID")) }
fn rev(row: &SqliteRow, key: &str) -> Result<Revision, StoreError> {
    let value: i64 = row.try_get(key).map_err(backend)?;
    Ok(Revision::new(u64::try_from(value).map_err(|_| corrupt("negative route revision"))?))
}
fn timestamp(row: &SqliteRow) -> Result<Timestamp, StoreError> { Ok(Timestamp::from_unix_millis(row.try_get("recorded_at_ms").map_err(backend)?)) }
fn db(value: Revision) -> Result<i64, StoreError> { i64::try_from(value.get()).map_err(|_| corrupt("route revision exceeds SQLite range")) }
fn corrupt(message: &str) -> StoreError { StoreError::Corrupt(message.to_string()) }
fn backend(error: sqlx::Error) -> StoreError { StoreError::Backend(error.to_string()) }
