use std::path::PathBuf;

/// Why [`crate::SqliteWorkingStore::open`] refused or failed to open a store.
#[derive(Debug, thiserror::Error)]
pub enum OpenError {
    /// The linked SQLite is older than [`crate::MINIMUM_SQLITE_VERSION`].
    #[error(
        "SQLite {found} is not supported; Inquello needs {} or later",
        crate::MINIMUM_SQLITE_VERSION
    )]
    UnsupportedSqlite { found: String },
    /// The store path lies inside a root the agent can write to.
    #[error("store path {} is inside agent-writable root {}", path.display(), root.display())]
    StoreLocationNotProtected { path: PathBuf, root: PathBuf },
    /// The store path cannot name a store file.
    #[error("invalid store path {}: {reason}", path.display())]
    InvalidPath { path: PathBuf, reason: String },
    #[error("store file I/O failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("SQLite failed: {0}")]
    Sqlite(#[from] sqlx::Error),
    #[error("store migration failed: {0}")]
    Migration(#[from] sqlx::migrate::MigrateError),
}
