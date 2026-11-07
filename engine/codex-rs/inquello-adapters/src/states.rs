//! The SQLite implementation of the domain's [`TaskStateStore`] port (Story 1.15).

use crate::store::SqliteWorkingStore;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::TaskId;
use inquello_domain::state::ActorKind;
use inquello_domain::state::RECORD_STATE_COMMAND;
use inquello_domain::state::ScopeKind;
use inquello_domain::state::StateDimension;
use inquello_domain::state::StateReceipt;
use inquello_domain::state::StateRecord;
use inquello_domain::state::TaskStateChange;
use inquello_domain::state::TaskStateStore;
use inquello_domain::state::TaskStates;
use sqlx::Row;
use sqlx::sqlite::SqliteRow;
use uuid::Uuid;

const STATE_COLUMNS: &str = "task_id, revision, dimension, scope_kind, scope_id, value, version, \
     actor_kind, actor_ref, recorded_at_ms";

impl TaskStateStore for SqliteWorkingStore {
    async fn find_state_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<StateReceipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, principal_id, command, task_id, expected_revision, \
             resulting_revision, request, status, recorded_at_ms FROM state_receipts \
             WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(receipt_from_row).transpose()
    }

    async fn load_task_creator(&self, task_id: TaskId) -> Result<Option<PrincipalId>, StoreError> {
        let creator: Option<String> =
            sqlx::query_scalar("SELECT creator_principal_id FROM tasks WHERE task_id = ?")
                .bind(task_id.to_string())
                .fetch_optional(self.pool())
                .await
                .map_err(backend)?;
        creator
            .map(|value| {
                parse_uuid(&value, "tasks.creator_principal_id").map(PrincipalId::from_uuid)
            })
            .transpose()
    }

    async fn load_task_states(&self, task_id: TaskId) -> Result<TaskStates, StoreError> {
        let rows = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {STATE_COLUMNS} FROM task_states WHERE task_id = ? ORDER BY revision DESC"
        )))
        .bind(task_id.to_string())
        .fetch_all(self.pool())
        .await
        .map_err(backend)?;
        let records = rows
            .iter()
            .map(record_from_row)
            .collect::<Result<Vec<_>, _>>()?;
        let revision = records
            .first()
            .map_or(Revision::ZERO, |record| record.revision);
        Ok(TaskStates {
            task_id,
            revision,
            records,
        })
    }

    async fn load_state_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> Result<Option<StateRecord>, StoreError> {
        let row = sqlx::query(sqlx::AssertSqlSafe(format!(
            "SELECT {STATE_COLUMNS} FROM task_states WHERE task_id = ? AND revision = ?"
        )))
        .bind(task_id.to_string())
        .bind(to_db(revision)?)
        .fetch_optional(self.pool())
        .await
        .map_err(backend)?;
        row.as_ref().map(record_from_row).transpose()
    }

    async fn commit_state(&self, change: TaskStateChange) -> Result<(), StoreError> {
        let TaskStateChange {
            expected_revision,
            record,
            receipt,
        } = change;
        let consistent = expected_revision.next().ok() == Some(record.revision)
            && receipt.expected_revision == expected_revision
            && receipt.resulting_revision == record.revision
            && receipt.task_id == record.task_id
            && record.dimension.value(record.value) == Some(record.value);
        if !consistent {
            return Err(StoreError::Backend(
                "state change revisions are inconsistent".to_string(),
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
        // over the revision check, so the caller replays (or refuses) it
        // instead of reporting that writer's change as a conflict (R10).
        let recorded: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM state_receipts WHERE operation_id = ?")
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
            "SELECT COALESCE(MAX(revision), 0) FROM task_states WHERE task_id = ?",
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
            "INSERT INTO task_states (task_id, revision, dimension, scope_kind, scope_id, value, \
             version, actor_kind, actor_ref, recorded_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&task)
        .bind(to_db(record.revision)?)
        .bind(record.dimension.as_str())
        .bind(record.scope_kind.as_str())
        .bind(&record.scope_id)
        .bind(record.value)
        .bind(
            i64::try_from(record.version)
                .map_err(|_| StoreError::Backend("version exceeds SQLite range".to_string()))?,
        )
        .bind(record.actor_kind.as_str())
        .bind(&record.actor_ref)
        .bind(record.recorded_at.unix_millis())
        .execute(&mut *tx)
        .await
        .map_err(backend)?;

        sqlx::query(
            "INSERT INTO state_receipts (operation_id, principal_id, command, task_id, \
             expected_revision, resulting_revision, request, status, recorded_at_ms) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(receipt.operation_id.as_str())
        .bind(receipt.principal_id.to_string())
        .bind(RECORD_STATE_COMMAND)
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

fn receipt_from_row(row: &SqliteRow) -> Result<StateReceipt, StoreError> {
    let operation_id: String = row.try_get("operation_id").map_err(backend)?;
    let operation_id = OperationId::parse(&operation_id)
        .map_err(|error| corrupt(format!("state_receipts.operation_id: {error}")))?;
    let command: String = row.try_get("command").map_err(backend)?;
    if command != RECORD_STATE_COMMAND {
        return Err(corrupt(format!(
            "state_receipts.command: unknown {command:?}"
        )));
    }
    let status: String = row.try_get("status").map_err(backend)?;
    let status = ReceiptStatus::parse(&status)
        .ok_or_else(|| corrupt(format!("state_receipts.status: unknown {status:?}")))?;
    Ok(StateReceipt {
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

fn record_from_row(row: &SqliteRow) -> Result<StateRecord, StoreError> {
    let dimension: String = row.try_get("dimension").map_err(backend)?;
    let dimension = StateDimension::parse(&dimension)
        .ok_or_else(|| corrupt(format!("task_states.dimension: unknown {dimension:?}")))?;
    let value: String = row.try_get("value").map_err(backend)?;
    let value = dimension.value(&value).ok_or_else(|| {
        corrupt(format!(
            "task_states.value: {value:?} is not a {} state",
            dimension.as_str()
        ))
    })?;
    let scope_kind: String = row.try_get("scope_kind").map_err(backend)?;
    let scope_kind = ScopeKind::parse(&scope_kind)
        .ok_or_else(|| corrupt(format!("task_states.scope_kind: unknown {scope_kind:?}")))?;
    let actor_kind: String = row.try_get("actor_kind").map_err(backend)?;
    let actor_kind = ActorKind::parse(&actor_kind)
        .ok_or_else(|| corrupt(format!("task_states.actor_kind: unknown {actor_kind:?}")))?;
    let version: i64 = row.try_get("version").map_err(backend)?;
    Ok(StateRecord {
        task_id: TaskId::from_uuid(uuid(row, "task_id")?),
        dimension,
        scope_kind,
        scope_id: row.try_get("scope_id").map_err(backend)?,
        value,
        version: from_db(version, "version")?,
        actor_kind,
        actor_ref: row.try_get("actor_ref").map_err(backend)?,
        recorded_at: timestamp(row, "recorded_at_ms")?,
        revision: revision(row, "revision")?,
    })
}

fn parse_uuid(value: &str, column: &str) -> Result<Uuid, StoreError> {
    Uuid::parse_str(value).map_err(|error| corrupt(format!("{column}: {error}")))
}

fn uuid(row: &SqliteRow, column: &str) -> Result<Uuid, StoreError> {
    let value: String = row.try_get(column).map_err(backend)?;
    parse_uuid(&value, column)
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
