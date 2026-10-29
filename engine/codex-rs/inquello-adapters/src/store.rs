//! The SQLite implementation of the domain's [`WorkingStore`] port.

use crate::error::OpenError;
use crate::location;
use crate::sqlite;
use inquello_domain::CommandKind;
use inquello_domain::OperationId;
use inquello_domain::Receipt;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StateChange;
use inquello_domain::StoreError;
use inquello_domain::StoreId;
use inquello_domain::StoreInfo;
use inquello_domain::Timestamp;
use inquello_domain::WorkingStore;
use sqlx::Row;
use sqlx::SqlitePool;
use sqlx::sqlite::SqliteRow;
use std::path::Path;
use std::path::PathBuf;
use uuid::Uuid;

/// Inquello's local working store: a separate SQLite file holding working metadata.
///
/// Mutations reach it only through [`WorkingStore::commit`], which domain commands
/// call after validating the operation ID and expected revision.
#[derive(Clone, Debug)]
pub struct SqliteWorkingStore {
    pool: SqlitePool,
    path: PathBuf,
}

impl SqliteWorkingStore {
    /// Opens (creating if needed) the store file at `path`.
    ///
    /// In order, this refuses a path inside any of `agent_writable_roots`
    /// ([`OpenError::StoreLocationNotProtected`]), refuses a linked SQLite older than
    /// [`crate::MINIMUM_SQLITE_VERSION`] ([`OpenError::UnsupportedSqlite`]), creates
    /// the file with owner-only permissions on Unix, opens it in WAL mode with a busy
    /// timeout and applies the embedded migrations. Neither refusal creates the file.
    pub async fn open(path: &Path, agent_writable_roots: &[PathBuf]) -> Result<Self, OpenError> {
        let path = location::resolve_protected_store_path(path, agent_writable_roots)?;
        sqlite::ensure_supported_sqlite().await?;
        location::ensure_owner_only_file(&path)?;
        let pool = sqlite::open_pool(&path).await?;
        Ok(Self { pool, path })
    }

    pub(crate) fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// The canonical path of the store file.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// The version of the SQLite library serving this store.
    pub async fn sqlite_version(&self) -> Result<String, StoreError> {
        sqlx::query_scalar("SELECT sqlite_version()")
            .fetch_one(&self.pool)
            .await
            .map_err(backend)
    }

    /// Closes every connection; later calls fail.
    pub async fn close(&self) {
        self.pool.close().await;
    }
}

impl WorkingStore for SqliteWorkingStore {
    async fn load_store_info(&self) -> Result<Option<StoreInfo>, StoreError> {
        let row = sqlx::query(
            "SELECT store_id, schema_version, revision, created_at_ms FROM store_info WHERE id = 1",
        )
        .fetch_optional(&self.pool)
        .await
        .map_err(backend)?;
        row.as_ref().map(store_info_from_row).transpose()
    }

    async fn find_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<Receipt>, StoreError> {
        let row = sqlx::query(
            "SELECT operation_id, command, expected_revision, resulting_revision, status, \
             recorded_at_ms FROM operation_receipts WHERE operation_id = ?",
        )
        .bind(operation_id.as_str())
        .fetch_optional(&self.pool)
        .await
        .map_err(backend)?;
        row.as_ref().map(receipt_from_row).transpose()
    }

    async fn commit(&self, change: StateChange) -> Result<(), StoreError> {
        let StateChange {
            expected_revision,
            store_info,
            receipt,
        } = change;
        let consistent = expected_revision.next().ok() == Some(store_info.revision)
            && receipt.expected_revision == expected_revision
            && receipt.resulting_revision == store_info.revision;
        if !consistent {
            return Err(StoreError::Backend(
                "state change revisions are inconsistent".to_string(),
            ));
        }
        let expected = to_db(expected_revision.get())?;
        let resulting = to_db(store_info.revision.get())?;

        // IMMEDIATE takes the write lock up front, so the revision read below cannot
        // go stale before the writes. Dropping the transaction without commit rolls
        // back everything written in it.
        let mut tx = self
            .pool
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;

        let actual: Option<i64> =
            sqlx::query_scalar("SELECT revision FROM store_info WHERE id = 1")
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        let actual = actual.unwrap_or(0);
        if actual != expected {
            return Err(StoreError::RevisionConflict {
                expected: expected_revision,
                actual: Revision::new(from_db(actual, "store_info.revision")?),
            });
        }

        // State first, then the receipt: both commit together or not at all.
        let state_sql = if expected == 0 {
            "INSERT INTO store_info (id, store_id, schema_version, revision, created_at_ms) \
             VALUES (1, ?1, ?2, ?3, ?4)"
        } else {
            "UPDATE store_info SET store_id = ?1, schema_version = ?2, revision = ?3, \
             created_at_ms = ?4 WHERE id = 1 AND revision = ?5"
        };
        let mut state_query = sqlx::query(state_sql)
            .bind(store_info.store_id.to_string())
            .bind(i64::from(store_info.schema_version))
            .bind(resulting)
            .bind(store_info.created_at.unix_millis());
        if expected != 0 {
            state_query = state_query.bind(expected);
        }
        let written = state_query.execute(&mut *tx).await.map_err(backend)?;
        if written.rows_affected() != 1 {
            return Err(StoreError::Backend(
                "store_info was not written".to_string(),
            ));
        }

        sqlx::query(
            "INSERT INTO operation_receipts (operation_id, command, expected_revision, \
             resulting_revision, status, recorded_at_ms) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(receipt.operation_id.as_str())
        .bind(receipt.command.as_str())
        .bind(to_db(receipt.expected_revision.get())?)
        .bind(to_db(receipt.resulting_revision.get())?)
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

fn store_info_from_row(row: &SqliteRow) -> Result<StoreInfo, StoreError> {
    let store_id: String = row.try_get("store_id").map_err(backend)?;
    let store_id = Uuid::parse_str(&store_id)
        .map_err(|error| StoreError::Corrupt(format!("store_info.store_id: {error}")))?;
    let schema_version: i64 = row.try_get("schema_version").map_err(backend)?;
    let schema_version = u32::try_from(schema_version)
        .map_err(|_| StoreError::Corrupt("store_info.schema_version out of range".to_string()))?;
    let revision: i64 = row.try_get("revision").map_err(backend)?;
    let created_at: i64 = row.try_get("created_at_ms").map_err(backend)?;
    Ok(StoreInfo {
        store_id: StoreId::from_uuid(store_id),
        schema_version,
        revision: Revision::new(from_db(revision, "store_info.revision")?),
        created_at: Timestamp::from_unix_millis(created_at),
    })
}

fn receipt_from_row(row: &SqliteRow) -> Result<Receipt, StoreError> {
    let operation_id: String = row.try_get("operation_id").map_err(backend)?;
    let operation_id = OperationId::parse(&operation_id).map_err(|error| {
        StoreError::Corrupt(format!("operation_receipts.operation_id: {error}"))
    })?;
    let command: String = row.try_get("command").map_err(backend)?;
    let command = CommandKind::parse(&command).ok_or_else(|| {
        StoreError::Corrupt(format!("operation_receipts.command: unknown {command:?}"))
    })?;
    let status: String = row.try_get("status").map_err(backend)?;
    let status = ReceiptStatus::parse(&status).ok_or_else(|| {
        StoreError::Corrupt(format!("operation_receipts.status: unknown {status:?}"))
    })?;
    let expected: i64 = row.try_get("expected_revision").map_err(backend)?;
    let resulting: i64 = row.try_get("resulting_revision").map_err(backend)?;
    let recorded_at: i64 = row.try_get("recorded_at_ms").map_err(backend)?;
    Ok(Receipt {
        operation_id,
        command,
        expected_revision: Revision::new(from_db(
            expected,
            "operation_receipts.expected_revision",
        )?),
        resulting_revision: Revision::new(from_db(
            resulting,
            "operation_receipts.resulting_revision",
        )?),
        status,
        recorded_at: Timestamp::from_unix_millis(recorded_at),
    })
}

fn backend(error: sqlx::Error) -> StoreError {
    StoreError::Backend(error.to_string())
}

fn to_db(revision: u64) -> Result<i64, StoreError> {
    i64::try_from(revision)
        .map_err(|_| StoreError::Backend(format!("revision {revision} exceeds SQLite range")))
}

fn from_db(value: i64, column: &str) -> Result<u64, StoreError> {
    u64::try_from(value).map_err(|_| StoreError::Corrupt(format!("{column} is negative")))
}
