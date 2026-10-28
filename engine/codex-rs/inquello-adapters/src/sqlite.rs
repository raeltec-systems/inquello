//! The working store's SQLite connection shim: the only place in this crate that
//! connects to SQLite.

#![expect(
    clippy::disallowed_methods,
    reason = "this is the inquello-adapters SQLite connection shim"
)]

use crate::error::OpenError;
use sqlx::ConnectOptions;
use sqlx::Connection;
use sqlx::SqlitePool;
use sqlx::migrate::Migrator;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::sqlite::SqliteJournalMode;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::sqlite::SqliteSynchronous;
use std::path::Path;
use std::time::Duration;

/// The oldest SQLite the working store accepts. 3.51.3 carries the WAL-reset fix.
pub const MINIMUM_SQLITE_VERSION: &str = "3.51.3";
const MINIMUM: (u32, u32, u32) = (3, 51, 3);

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_CONNECTIONS: u32 = 4;

static MIGRATOR: Migrator = sqlx_macros::migrate!("./migrations");

/// Refuses a SQLite version string older than [`MINIMUM_SQLITE_VERSION`] or one
/// that does not parse as `major.minor.patch`.
pub fn check_sqlite_version(found: &str) -> Result<(), OpenError> {
    let unsupported = || OpenError::UnsupportedSqlite {
        found: found.to_string(),
    };
    let mut parts = found.trim().split('.');
    let mut next = || -> Result<u32, OpenError> {
        parts
            .next()
            .and_then(|part| part.parse().ok())
            .ok_or_else(unsupported)
    };
    let version = (next()?, next()?, next()?);
    if parts.next().is_some() || version < MINIMUM {
        return Err(unsupported());
    }
    Ok(())
}

/// Checks the linked SQLite version on a throwaway in-memory connection, so an
/// unsupported SQLite never creates or touches the store file.
pub(crate) async fn ensure_supported_sqlite() -> Result<(), OpenError> {
    let mut connection = SqliteConnectOptions::new()
        .in_memory(true)
        .connect()
        .await?;
    let found: String = sqlx::query_scalar("SELECT sqlite_version()")
        .fetch_one(&mut connection)
        .await?;
    connection.close().await?;
    check_sqlite_version(&found)
}

/// Opens a pool on an existing store file with WAL, full sync and a busy timeout,
/// then applies the embedded migrations.
pub(crate) async fn open_pool(path: &Path) -> Result<SqlitePool, OpenError> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Full)
        .busy_timeout(BUSY_TIMEOUT)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(MAX_CONNECTIONS)
        .connect_with(options)
        .await?;
    if let Err(error) = MIGRATOR.run(&pool).await {
        pool.close().await;
        return Err(error.into());
    }
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_gate_accepts_the_floor_and_later() {
        for version in ["3.51.3", "3.51.10", "3.52.0", "4.0.0"] {
            assert!(check_sqlite_version(version).is_ok(), "{version}");
        }
    }

    #[test]
    fn version_gate_refuses_older_or_unparseable_versions() {
        for version in [
            "3.51.2", "3.50.9", "3.9.99", "2.99.99", "", "3.51", "x.y.z", "3.51.3.1",
        ] {
            assert!(
                matches!(
                    check_sqlite_version(version),
                    Err(OpenError::UnsupportedSqlite { found }) if found == version
                ),
                "{version}"
            );
        }
    }
}
