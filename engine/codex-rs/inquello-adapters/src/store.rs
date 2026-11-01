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

        // A receipt recorded by a concurrent writer of the same operation wins
        // over the revision check, so the caller replays it instead of seeing
        // the revision that writer produced as a conflict.
        let recorded: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM operation_receipts WHERE operation_id = ?")
                .bind(receipt.operation_id.as_str())
                .fetch_optional(&mut *tx)
                .await
                .map_err(backend)?;
        if recorded.is_some() {
            return Err(StoreError::DuplicateOperation {
                operation_id: receipt.operation_id,
            });
        }

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

/// A request-scoped, never-writing SQLite observer. data_version is compared on
/// the SAME dedicated connection, so every commit on the working pool (including
/// deletion, routes and prior-run lineage) invalidates the observation. No pool
/// slot or writer lock is held while service/network checks are pending.
pub struct SavedQueueGuard {
    _transaction: sqlx::Transaction<'static, sqlx::Sqlite>,
}

pub struct SavedReadFence {
    connection: sqlx::SqliteConnection,
    version: i64,
    path: PathBuf,
    identity: (u64, u64),
    _identity_file: std::fs::File,
}
impl SqliteWorkingStore {
    pub async fn saved_read_fence(&self) -> Result<SavedReadFence, StoreError> {
        use sqlx::ConnectOptions;
        let identity_file = open_saved_identity(&self.path)?;
        let identity = saved_file_identity(&identity_file)?;
        let mut connection = sqlx::sqlite::SqliteConnectOptions::new()
            .filename(&self.path)
            .read_only(true)
            .connect()
            .await
            .map_err(backend)?;
        let version = sqlx::query_scalar("PRAGMA data_version")
            .fetch_one(&mut connection)
            .await
            .map_err(backend)?;
        Ok(SavedReadFence {
            connection,
            version,
            path: self.path.clone(),
            identity,
            _identity_file: identity_file,
        })
    }
    /// Short local-only queue lease: acquire after all service awaits, then
    /// compare the observer. The caller retains the transaction through queueing.
    pub async fn seal_saved_read(
        &self,
        fence: &mut SavedReadFence,
    ) -> Result<SavedQueueGuard, StoreError> {
        let tx = self
            .pool
            .begin_with("BEGIN IMMEDIATE")
            .await
            .map_err(backend)?;
        let current: i64 = sqlx::query_scalar("PRAGMA data_version")
            .fetch_one(&mut fence.connection)
            .await
            .map_err(backend)?;
        let current_file = open_saved_identity(&fence.path)?;
        let same_file = saved_file_identity(&current_file)? == fence.identity;
        if current != fence.version || !same_file {
            return Err(StoreError::Backend(
                "Saved work changed during inspection".into(),
            ));
        }
        Ok(SavedQueueGuard { _transaction: tx })
    }
}

/// Keep the exact opened object alive for the observation. On Windows omission
/// of FILE_SHARE_DELETE prevents rename/unlink of that object while SQL awaits.
fn open_saved_identity(path: &Path) -> Result<std::fs::File, StoreError> {
    let mut options = std::fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0x00000001 | 0x00000002);
    }
    #[cfg(not(any(unix, windows)))]
    {
        return Err(StoreError::Backend(
            "Stable saved-store identity is unsupported on this platform".into(),
        ));
    }
    let file = options
        .open(path)
        .map_err(|e| StoreError::Backend(e.to_string()))?;
    if !file
        .metadata()
        .map_err(|e| StoreError::Backend(e.to_string()))?
        .is_file()
    {
        return Err(StoreError::Backend(
            "Saved store is not a regular file".into(),
        ));
    }
    Ok(file)
}
fn saved_file_identity(file: &std::fs::File) -> Result<(u64, u64), StoreError> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let metadata = file
            .metadata()
            .map_err(|e| StoreError::Backend(e.to_string()))?;
        Ok((metadata.dev(), metadata.ino()))
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            BY_HANDLE_FILE_INFORMATION, GetFileInformationByHandle,
        };
        let mut info = std::mem::MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
        // SAFETY: a live File owns the handle; Windows writes the complete output
        // struct on success, which is the only branch where it is read.
        if unsafe { GetFileInformationByHandle(file.as_raw_handle() as _, info.as_mut_ptr()) } == 0
        {
            return Err(StoreError::Backend(
                std::io::Error::last_os_error().to_string(),
            ));
        }
        let info = unsafe { info.assume_init() };
        Ok((
            u64::from(info.dwVolumeSerialNumber),
            (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
        ))
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = file;
        Err(StoreError::Backend(
            "Stable saved-store identity is unsupported on this platform".into(),
        ))
    }
}

#[cfg(all(test, windows))]
mod saved_windows_identity_tests {
    use super::*;
    #[test]
    fn saved_observer_denies_replacement_and_compares_file_ids_not_timestamps() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("working.sqlite");
        let old = directory.path().join("old.sqlite");
        let replacement = directory.path().join("replacement.sqlite");
        std::fs::write(&path, b"same-size").unwrap();
        std::fs::write(&replacement, b"same-size").unwrap();
        let held = open_saved_identity(&path).unwrap();
        let original = saved_file_identity(&held).unwrap();
        let replacement_handle = std::fs::File::options()
            .write(true)
            .open(&replacement)
            .unwrap();
        replacement_handle
            .set_times(
                std::fs::FileTimes::new()
                    .set_modified(held.metadata().unwrap().modified().unwrap()),
            )
            .unwrap();
        drop(replacement_handle);
        assert!(
            std::fs::rename(&path, &old).is_err(),
            "held observer must deny delete sharing"
        );
        assert!(std::fs::remove_file(&path).is_err());
        assert_eq!(
            saved_file_identity(&open_saved_identity(&path).unwrap()).unwrap(),
            original
        );
        drop(held);
        std::fs::rename(&path, &old).unwrap();
        std::fs::rename(&replacement, &path).unwrap();
        assert_ne!(
            saved_file_identity(&open_saved_identity(&path).unwrap()).unwrap(),
            original,
            "same length/modified time is not object identity"
        );
    }
}
