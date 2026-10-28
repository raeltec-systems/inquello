//! The service's PostgreSQL connection shim: the only place in this crate that
//! connects to PostgreSQL. Tests reach the database through it too.

#![expect(
    clippy::disallowed_methods,
    reason = "this is the inquello-service PostgreSQL connection shim"
)]

use crate::config::DatabaseConfig;
use sqlx::PgPool;
use sqlx::migrate::MigrateError;
use sqlx::migrate::Migrator;
use sqlx::postgres::PgPoolOptions;

/// The oldest PostgreSQL the service accepts, as `server_version_num` (18.0).
pub const MINIMUM_SERVER_VERSION_NUM: i32 = 180_000;

static MIGRATOR: Migrator = sqlx_macros::migrate!("./migrations");

/// Opens a pool with the configured size and acquire timeout. One connection is
/// established before this returns, so an unreachable database fails here; every
/// later acquire pings its connection first.
pub async fn connect(config: &DatabaseConfig) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(config.max_connections)
        .acquire_timeout(config.acquire_timeout)
        .test_before_acquire(true)
        .connect_with(config.connect.clone())
        .await
}

/// The server's `server_version_num`, for example `180006` for 18.6.
pub async fn server_version_num(pool: &PgPool) -> Result<i32, sqlx::Error> {
    sqlx::query_scalar("SELECT current_setting('server_version_num')::integer")
        .fetch_one(pool)
        .await
}

/// Applies the embedded migrations.
pub(crate) async fn migrate(pool: &PgPool) -> Result<(), MigrateError> {
    MIGRATOR.run(pool).await
}

/// A short, credential-free category for a database error, safe to log.
pub(crate) fn error_category(error: &sqlx::Error) -> String {
    match error {
        sqlx::Error::Database(db) => format!(
            "database error {}",
            db.code().as_deref().unwrap_or("without code")
        ),
        sqlx::Error::PoolTimedOut => "pool timed out".to_string(),
        sqlx::Error::PoolClosed => "pool closed".to_string(),
        sqlx::Error::Io(_) => "io error".to_string(),
        sqlx::Error::Tls(_) => "tls error".to_string(),
        sqlx::Error::Protocol(_) => "protocol error".to_string(),
        sqlx::Error::RowNotFound => "row not found".to_string(),
        sqlx::Error::ColumnDecode { .. } | sqlx::Error::Decode(_) => "decode error".to_string(),
        _ => "other database error".to_string(),
    }
}
