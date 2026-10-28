//! Service startup: validate config, open PostgreSQL, migrate, bind and serve.

use crate::clock::Clock;
use crate::config::ConfigError;
use crate::config::ServiceConfig;
use crate::oidc::KeyConfigError;
use crate::oidc::TrustedIssuer;
use crate::postgres;
use crate::routes;
use chrono::TimeDelta;
use sqlx::PgPool;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;
use tokio::task::JoinHandle;

/// Lifetimes converted for time arithmetic (validated as representable).
#[derive(Clone, Copy, Debug)]
pub(crate) struct EffectiveLifetimes {
    pub(crate) login_transaction: TimeDelta,
    pub(crate) access: TimeDelta,
    pub(crate) refresh: TimeDelta,
    pub(crate) session: TimeDelta,
    pub(crate) id_token_clock_skew: Duration,
}

pub(crate) struct AppState {
    pub(crate) pool: PgPool,
    pub(crate) clock: Arc<dyn Clock>,
    pub(crate) issuers: Vec<TrustedIssuer>,
    pub(crate) lifetimes: EffectiveLifetimes,
}

impl AppState {
    pub(crate) fn issuer(&self, issuer: &str) -> Option<&TrustedIssuer> {
        self.issuers
            .iter()
            .find(|candidate| candidate.issuer == issuer)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StartError {
    #[error("invalid configuration: {0}")]
    Config(#[from] ConfigError),
    #[error("invalid issuer key: {0}")]
    IssuerKey(#[from] KeyConfigError),
    #[error("database unavailable: {0}")]
    Database(String),
    #[error("PostgreSQL server_version_num {found} is older than the required 18")]
    UnsupportedPostgres { found: i32 },
    #[error("database migration failed: {0}")]
    Migration(String),
    #[error("could not bind the listener: {0}")]
    Bind(#[from] std::io::Error),
}

/// A running service. Dropping it does not stop the server; call
/// [`RunningService::shutdown`].
pub struct RunningService {
    local_addr: SocketAddr,
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<std::io::Result<()>>,
}

impl RunningService {
    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }

    /// `http://<addr>` for the loopback listener.
    pub fn base_url(&self) -> String {
        format!("http://{}", self.local_addr)
    }

    /// Stops accepting connections and waits for in-flight requests.
    pub async fn shutdown(mut self) {
        if let Some(sender) = self.shutdown.take() {
            let _ = sender.send(());
        }
        let _ = self.task.await;
    }
}

fn delta(value: Duration) -> Result<TimeDelta, ConfigError> {
    TimeDelta::from_std(value).map_err(|_| ConfigError::InvalidLifetime {
        name: "lifetime",
        reason: "is too large",
    })
}

/// Validates `config` (before touching the database or the network), opens and
/// migrates the database, refuses PostgreSQL older than 18, then serves on the
/// configured loopback address.
pub async fn start(
    config: ServiceConfig,
    clock: Arc<dyn Clock>,
) -> Result<RunningService, StartError> {
    config.validate()?;
    let issuers = config
        .issuers
        .iter()
        .map(TrustedIssuer::from_config)
        .collect::<Result<Vec<_>, _>>()?;
    let lifetimes = EffectiveLifetimes {
        login_transaction: delta(config.lifetimes.login_transaction)?,
        access: delta(config.lifetimes.access)?,
        refresh: delta(config.lifetimes.refresh)?,
        session: delta(config.lifetimes.session)?,
        id_token_clock_skew: config.lifetimes.id_token_clock_skew,
    };

    let pool = postgres::connect(&config.database)
        .await
        .map_err(|error| StartError::Database(postgres::error_category(&error)))?;
    let version = postgres::server_version_num(&pool)
        .await
        .map_err(|error| StartError::Database(postgres::error_category(&error)))?;
    if version < postgres::MINIMUM_SERVER_VERSION_NUM {
        pool.close().await;
        return Err(StartError::UnsupportedPostgres { found: version });
    }
    if let Err(error) = postgres::migrate(&pool).await {
        pool.close().await;
        return Err(StartError::Migration(error.to_string()));
    }

    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    let local_addr = listener.local_addr()?;
    let state = Arc::new(AppState {
        pool,
        clock,
        issuers,
        lifetimes,
    });
    let router = routes::router(state);
    let (sender, receiver) = oneshot::channel::<()>();
    let task = tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = receiver.await;
            })
            .await
    });
    tracing::info!(%local_addr, "inquello service listening");
    Ok(RunningService {
        local_addr,
        shutdown: Some(sender),
        task,
    })
}
