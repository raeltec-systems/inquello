//! Service startup: validate config, open PostgreSQL, migrate, bind and serve
//! (plain HTTP on loopback, or HTTPS when TLS is configured).

use crate::clock::Clock;
use crate::config::ConfigError;
use crate::config::ServiceConfig;
use crate::oidc::KeyConfigError;
use crate::oidc::TrustedIssuer;
use crate::postgres;
use crate::routes;
use crate::tls;
use crate::tls::TlsListener;
use crate::tls::TlsSetupError;
use axum::Router;
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
    pub(crate) invite: TimeDelta,
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
    #[error(transparent)]
    Tls(#[from] TlsSetupError),
}

/// A running service. Dropping it does not stop the server; call
/// [`RunningService::shutdown`].
pub struct RunningService {
    local_addr: SocketAddr,
    https: bool,
    shutdown: Option<oneshot::Sender<()>>,
    task: JoinHandle<std::io::Result<()>>,
}

impl RunningService {
    pub fn local_addr(&self) -> SocketAddr {
        self.local_addr
    }

    /// Whether the listener terminates TLS.
    pub fn is_https(&self) -> bool {
        self.https
    }

    /// `https://<addr>` with TLS, otherwise `http://<addr>`.
    pub fn base_url(&self) -> String {
        let scheme = if self.https { "https" } else { "http" };
        format!("{scheme}://{}", self.local_addr)
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
/// configured address: HTTPS when TLS is configured, otherwise plain HTTP on
/// loopback.
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
        invite: delta(config.lifetimes.invite)?,
    };
    let tls_config = tls_server_config(config.tls.as_ref())?;

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
    let state = Arc::new(AppState {
        pool,
        clock,
        issuers,
        lifetimes,
    });
    let service = serve(listener, tls_config, routes::router(state))?;
    tracing::info!(local_addr = %service.local_addr, https = service.https, "inquello service listening");
    Ok(service)
}

/// Serves `router` on `listener`, terminating TLS with `tls_config` when given.
pub(crate) fn serve(
    listener: tokio::net::TcpListener,
    tls_config: Option<Arc<rustls::ServerConfig>>,
    router: Router,
) -> Result<RunningService, StartError> {
    let local_addr = listener.local_addr()?;
    let (sender, receiver) = oneshot::channel::<()>();
    let shutdown = async move {
        let _ = receiver.await;
    };
    let https = tls_config.is_some();
    let task = match tls_config {
        Some(tls_config) => {
            let listener = TlsListener::new(listener, tls_config)?;
            tokio::spawn(async move {
                axum::serve(listener, router)
                    .with_graceful_shutdown(shutdown)
                    .await
            })
        }
        None => tokio::spawn(async move {
            axum::serve(listener, router)
                .with_graceful_shutdown(shutdown)
                .await
        }),
    };
    Ok(RunningService {
        local_addr,
        https,
        shutdown: Some(sender),
        task,
    })
}

/// Builds the rustls server configuration for an optional TLS identity.
pub(crate) fn tls_server_config(
    tls: Option<&crate::config::TlsConfig>,
) -> Result<Option<Arc<rustls::ServerConfig>>, StartError> {
    tls.map(tls::server_config).transpose().map_err(Into::into)
}
