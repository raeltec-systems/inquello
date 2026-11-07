//! The SQLite implementation of the domain's [`BroadModeStore`] port (Story 1.18).

use crate::store::SqliteWorkingStore;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::execution_policy::BroadMode;
use inquello_domain::execution_policy::BroadModeChange;
use inquello_domain::execution_policy::BroadModeReceipt;
use inquello_domain::execution_policy::BroadModeRecord;
use inquello_domain::execution_policy::BroadModeStore;
use inquello_domain::execution_policy::BroadModeTask;
use inquello_domain::execution_policy::SET_BROAD_MODE_COMMAND;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::state::ActorKind;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;
use uuid::Uuid;

const RECORD_COLUMNS: &str = "task_id, revision, mode, actor_kind, actor_ref, recorded_at_ms";

impl BroadModeStore for SqliteWorkingStore {
    async fn find_broad_mode_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<BroadModeReceipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, principal_id, command, task_id, expected_revision, \
             resulting_revision, request, status, recorded_at_ms FROM broad_mode_receipts \
             WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(receipt_from_row).transpose()
    }

    async fn load_broad_mode_task(
        &self,
        task_id: TaskId,
    ) -> Result<Option<BroadModeTask>, StoreError> {
        let row =
            sqlx::query("SELECT creator_principal_id, workspace_id FROM tasks WHERE task_id = ?")
                .bind(task_id.to_string())
                .fetch_optional(self.pool())
                .await
                .map_err(backend)?;
        row.map(|row| {
            Ok(BroadModeTask {
                creator: PrincipalId::from_uuid(uuid(&row, "creator_principal_id")?),
                workspace_id: WorkspaceId::from_uuid(uuid(&row, "workspace_id")?),
            })
        })
        .transpose()
    }

    async fn load_broad_mode(
        &self,
        task_id: TaskId,
    ) -> Result<(Revision, Option<BroadModeRecord>), StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {RECORD_COLUMNS} FROM task_broad_modes WHERE task_id = ? \
             ORDER BY revision DESC LIMIT 1"
        )))
        .bind(task_id.to_string())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        let record = row.as_ref().map(record_from_row).transpose()?;
        let revision = record
            .as_ref()
            .map_or(Revision::ZERO, |record| record.revision);
        Ok((revision, record))
    }

    async fn load_broad_mode_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> Result<Option<BroadModeRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {RECORD_COLUMNS} FROM task_broad_modes WHERE task_id = ? AND revision = ?"
        )))
        .bind(task_id.to_string())
        .bind(to_db(revision)?)
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(record_from_row).transpose()
    }

    async fn commit_broad_mode(&self, change: BroadModeChange) -> Result<(), StoreError> {
        let BroadModeChange {
            expected_revision,
            record,
            receipt,
        } = change;
        let consistent = expected_revision.next().ok() == Some(record.revision)
            && receipt.expected_revision == expected_revision
            && receipt.resulting_revision == record.revision
            && receipt.task_id == record.task_id;
        if !consistent {
            return Err(StoreError::Backend(
                "broad-mode change revisions are inconsistent".to_string(),
            ));
        }

        // IMMEDIATE takes the write lock first, so the revision read cannot go
        // stale before the writes; dropping the transaction rolls everything back.
        let mut tx = self
            .pool()
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        // A receipt recorded by a concurrent writer of the same operation wins
        // over the revision check, so the caller replays (or refuses) it (R10).
        let recorded: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM broad_mode_receipts WHERE operation_id = ?")
                .bind(receipt.operation_id.as_str())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if recorded.is_some() {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }
        let task = record.task_id.to_string();
        let actual: i64 = sqlx::query_scalar(
            "SELECT COALESCE(MAX(revision), 0) FROM task_broad_modes WHERE task_id = ?",
        )
        .bind(&task)
        .fetch_one(&mut *tx)
        .await
        .map_err(backend)?;
        let actual = Revision::new(from_db(actual, "revision")?);
        if actual != expected_revision {
            return Err(StoreError::RevisionConflict {
                expected: expected_revision,
                actual,
            });
        }

        sqlx::query(
            "INSERT INTO task_broad_modes (task_id, revision, mode, actor_kind, actor_ref, \
             recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&task)
        .bind(to_db(record.revision)?)
        .bind(record.mode.as_str())
        .bind(record.actor_kind.as_str())
        .bind(&record.actor_ref)
        .bind(record.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(backend)?;

        sqlx::query(
            "INSERT INTO broad_mode_receipts (operation_id, principal_id, command, task_id, \
             expected_revision, resulting_revision, request, status, recorded_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(receipt.operation_id.as_str())
        .bind(receipt.principal_id.to_string())
        .bind(SET_BROAD_MODE_COMMAND)
        .bind(&task)
        .bind(to_db(receipt.expected_revision)?)
        .bind(to_db(receipt.resulting_revision)?)
        .bind(&receipt.request)
        .bind(receipt.status.as_str())
        .bind(receipt.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(|error| {
            if error
                .as_database_error()
                .is_some_and(sqlx::error::DatabaseError::is_unique_violation)
            {
                StoreError::DuplicateOperation {
                    operation_id: receipt.operation_id.clone(),
                }
            } else {
                backend(error)
            }
        })?;

        tx.commit().await.map_err(backend)
    }
}

fn receipt_from_row(row: &SqliteRow) -> Result<BroadModeReceipt, StoreError> {
    let operation_id: String = row.try_get("operation_id").map_err(backend)?;
    let operation_id = OperationId::parse(&operation_id)
        .map_err(|error| corrupt(format!("broad_mode_receipts.operation_id: {error}")))?;
    let command: String = row.try_get("command").map_err(backend)?;
    if command != SET_BROAD_MODE_COMMAND {
        return Err(corrupt(format!(
            "broad_mode_receipts.command: unknown {command:?}"
        )));
    }
    let status: String = row.try_get("status").map_err(backend)?;
    let status = ReceiptStatus::parse(&status)
        .ok_or_else(|| corrupt(format!("broad_mode_receipts.status: unknown {status:?}")))?;
    Ok(BroadModeReceipt {
        operation_id,
        principal_id: PrincipalId::from_uuid(uuid(row, "principal_id")?),
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        expected_revision: revision(row, "expected_revision")?,
        resulting_revision: revision(row, "resulting_revision")?,
        request: row.try_get("request").map_err(backend)?,
        status,
        recorded_at: timestamp(row, "recorded_at_ms")?,
    })
}

fn record_from_row(row: &SqliteRow) -> Result<BroadModeRecord, StoreError> {
    let mode: String = row.try_get("mode").map_err(backend)?;
    let mode = BroadMode::parse(&mode)
        .ok_or_else(|| corrupt(format!("task_broad_modes.mode: unknown {mode:?}")))?;
    let actor_kind: String = row.try_get("actor_kind").map_err(backend)?;
    let actor_kind = ActorKind::parse(&actor_kind).ok_or_else(|| {
        corrupt(format!(
            "task_broad_modes.actor_kind: unknown {actor_kind:?}"
        ))
    })?;
    Ok(BroadModeRecord {
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        mode,
        actor_kind,
        actor_ref: row.try_get("actor_ref").map_err(backend)?,
        recorded_at: timestamp(row, "recorded_at_ms")?,
        revision: revision(row, "revision")?,
    })
}

fn uuid(row: &SqliteRow, column: &str) -> Result<Uuid, StoreError> {
    let value: String = row.try_get(column).map_err(backend)?;
    Uuid::parse_str(&value).map_err(|error| corrupt(format!("{column}: {error}")))
}

fn revision(row: &SqliteRow, column: &str) -> Result<Revision, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Revision::new(from_db(value, column)?))
}

fn timestamp(row: &SqliteRow, column: &str) -> Result<Timestamp, StoreError> {
    let value: i64 = row.try_get(column).map_err(backend)?;
    Ok(Timestamp::from_unix_millis(value))
}

fn corrupt(message: String) -> StoreError {
    StoreError::Corrupt(message)
}

fn backend(error: sqlx::Error) -> StoreError {
    StoreError::Backend(error.to_string())
}

fn to_db(revision: Revision) -> Result<i64, StoreError> {
    i64::try_from(revision.get())
        .map_err(|_| StoreError::Backend(format!("revision {revision} exceeds SQLite range")))
}

fn from_db(value: i64, column: &str) -> Result<u64, StoreError> {
    u64::try_from(value).map_err(|_| corrupt(format!("{column} is negative")))
}
