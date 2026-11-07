//! Maintained, explicitly configured loopback HTTPS entry point. No fixture authority.
//! The caller owns database creation/removal and certificate provisioning. This
//! module never seeds membership, enables delivery, or changes a trust store.
use crate::{
    DatabaseConfig, Deployment, IssuerConfig, Lifetimes, ServiceConfig, SystemClock, TlsConfig,
};
use jsonwebtoken::jwk::JwkSet;
use rustls::pki_types::{CertificateDer, PrivateKeyDer, pem::PemObject};
use serde::Deserialize;
use sqlx::postgres::PgConnectOptions;
use std::fs;
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

/// Fixed safe categories only: never include private paths, values or parse errors.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("{0}")]
pub struct ServeError(&'static str);
const FLAGS: ServeError = ServeError("invalid serve flags");
const CONFIG: ServeError = ServeError("invalid serve configuration");
const FILE: ServeError = ServeError("serve configuration or TLS file unavailable");
const TLS: ServeError = ServeError("invalid serve TLS material");
const DATABASE: ServeError =
    ServeError("explicit serve database environment unavailable or invalid");

pub struct ServeOptions {
    pub config: PathBuf,
    pub exit_on_stdin_eof: bool,
}
impl ServeOptions {
    /// Fully reject duplicate/unknown flags before reading config or environment.
    pub fn parse(args: &[String]) -> Result<Self, ServeError> {
        let mut config = None;
        let mut eof = false;
        let mut iter = args.iter();
        while let Some(arg) = iter.next() {
            match arg.as_str() {
                "--config" if config.is_none() => {
                    let value = iter.next().ok_or(FLAGS)?;
                    if value.is_empty() || value.starts_with("--") {
                        return Err(FLAGS);
                    }
                    config = Some(PathBuf::from(value));
                }
                "--exit-on-stdin-eof" if !eof => eof = true,
                _ => return Err(FLAGS),
            }
        }
        Ok(Self {
            config: config.ok_or(FLAGS)?,
            exit_on_stdin_eof: eof,
        })
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FileConfig {
    bind: SocketAddr,
    database_env: String,
    tls: FileTls,
    issuer: FileIssuer,
    lifetimes: FileLifetimes,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FileTls {
    cert_chain_path: PathBuf,
    private_key_path: PathBuf,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FileIssuer {
    issuer: String,
    client_id: String,
    redirect_uri: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct FileLifetimes {
    login_transaction_seconds: u64,
    access_seconds: u64,
    refresh_seconds: u64,
    session_seconds: u64,
    id_token_clock_skew_seconds: u64,
    invite_seconds: u64,
}

fn read_regular(path: &Path, max: u64) -> Result<Vec<u8>, ServeError> {
    if !path.is_absolute() {
        return Err(FILE);
    }
    let before = fs::symlink_metadata(path).map_err(|_| FILE)?;
    if !before.is_file() || before.file_type().is_symlink() || before.len() > max {
        return Err(FILE);
    }
    let file = fs::File::open(path).map_err(|_| FILE)?;
    let opened = file.metadata().map_err(|_| FILE)?;
    if !opened.is_file() || opened.len() > max {
        return Err(FILE);
    }
    let mut bytes = Vec::new();
    file.take(max + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| FILE)?;
    if bytes.len() as u64 > max {
        return Err(FILE);
    }
    Ok(bytes)
}
fn validate_addresses(raw: &FileConfig) -> Result<(), ServeError> {
    if raw.bind.ip() != IpAddr::V4(Ipv4Addr::LOCALHOST)
        || (raw.bind.port() != 0 && raw.bind.port() < 1024)
    {
        return Err(CONFIG);
    }
    let issuer = url::Url::parse(&raw.issuer.issuer).map_err(|_| CONFIG)?;
    let host = issuer.host_str().ok_or(CONFIG)?;
    if issuer.scheme() != "https"
        || !issuer.username().is_empty()
        || issuer.password().is_some()
        || issuer.query().is_some()
        || issuer.fragment().is_some()
        || host.trim_end_matches('.').eq_ignore_ascii_case("localhost")
        || host.trim_end_matches('.').ends_with(".localhost")
        || host.trim_end_matches('.').ends_with(".invalid")
        || host.trim_end_matches('.') == "invalid"
        || !matches!(issuer.host(), Some(url::Host::Domain(_)))
        || issuer.to_string() != raw.issuer.issuer
        || raw.issuer.issuer.len() > 2048
    {
        return Err(CONFIG);
    }
    if raw.issuer.client_id.trim().is_empty()
        || raw.issuer.client_id.len() > 256
        || raw.issuer.client_id.chars().any(char::is_whitespace)
    {
        return Err(CONFIG);
    }
    let redirect = url::Url::parse(&raw.issuer.redirect_uri).map_err(|_| CONFIG)?;
    if redirect.scheme() != "http"
        || redirect.host_str() != Some("127.0.0.1")
        || !redirect.port().is_some_and(|port| port >= 1024)
        || redirect.path() != "/callback"
        || !redirect.username().is_empty()
        || redirect.password().is_some()
        || redirect.query().is_some()
        || redirect.fragment().is_some()
        || redirect.to_string() != raw.issuer.redirect_uri
    {
        return Err(CONFIG);
    }
    if !raw.database_env.starts_with("INQUELLO_")
        || !raw.database_env.ends_with("_DATABASE_URL")
        || raw.database_env.len() > 128
        || !raw
            .database_env
            .bytes()
            .all(|b| b.is_ascii_uppercase() || b.is_ascii_digit() || b == b'_')
    {
        return Err(CONFIG);
    }
    Ok(())
}
/// Injectable environment reader keeps tests isolated; no ambient database fallback.
pub fn load_config(
    path: &Path,
    environment: impl FnOnce(&str) -> Option<String>,
) -> Result<ServiceConfig, ServeError> {
    let document = read_regular(path, 64 * 1024)?;
    let raw: FileConfig = serde_json::from_slice(&document).map_err(|_| CONFIG)?;
    validate_addresses(&raw)?;
    let lifetime = |seconds| Duration::from_secs(seconds);
    let lifetimes = Lifetimes {
        login_transaction: lifetime(raw.lifetimes.login_transaction_seconds),
        access: lifetime(raw.lifetimes.access_seconds),
        refresh: lifetime(raw.lifetimes.refresh_seconds),
        session: lifetime(raw.lifetimes.session_seconds),
        id_token_clock_skew: lifetime(raw.lifetimes.id_token_clock_skew_seconds),
        invite: lifetime(raw.lifetimes.invite_seconds),
    };
    // Same policy validator, before TLS/environment reads; no overflow conversion.
    lifetimes.validate().map_err(|_| CONFIG)?;
    let certificates = read_regular(&raw.tls.cert_chain_path, 256 * 1024)?;
    let key = read_regular(&raw.tls.private_key_path, 64 * 1024)?;
    let cert_chain = CertificateDer::pem_slice_iter(&certificates)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| TLS)?;
    let private_key = PrivateKeyDer::from_pem_slice(&key).map_err(|_| TLS)?;
    if cert_chain.is_empty() {
        return Err(TLS);
    }
    let database = environment(&raw.database_env).ok_or(DATABASE)?;
    let database_url = url::Url::parse(&database).map_err(|_| DATABASE)?;
    if !matches!(database_url.scheme(), "postgres" | "postgresql")
        || database_url.host_str().is_none()
        || database_url.username().is_empty()
        || database_url.path().trim_matches('/').is_empty()
    {
        return Err(DATABASE);
    }
    let config = ServiceConfig {
        deployment: Deployment::Production,
        bind: raw.bind,
        tls: Some(TlsConfig {
            cert_chain,
            private_key,
        }),
        issuers: vec![IssuerConfig {
            issuer: raw.issuer.issuer,
            client_id: raw.issuer.client_id,
            redirect_uris: vec![raw.issuer.redirect_uri],
            jwks: JwkSet { keys: vec![] },
        }],
        lifetimes,
        database: DatabaseConfig {
            connect: database.parse::<PgConnectOptions>().map_err(|_| DATABASE)?,
            max_connections: 4,
            acquire_timeout: Duration::from_secs(10),
        },
    };
    config.validate().map_err(|_| CONFIG)?;
    Ok(config)
}
async fn stop_requested(eof: bool) {
    let (sender, mut receiver) = tokio::sync::mpsc::channel::<()>(1);
    if eof {
        let sender = sender.clone();
        std::thread::spawn(move || {
            let mut buffer = [0_u8; 256];
            while matches!(std::io::stdin().read(&mut buffer), Ok(n) if n > 0) {}
            let _ = sender.blocking_send(());
        });
    }
    #[cfg(unix)]
    {
        let sender = sender.clone();
        tokio::spawn(async move {
            if let Ok(mut signal) =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            {
                signal.recv().await;
                let _ = sender.send(()).await;
            }
        });
    }
    tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = receiver.recv() => {} }
}
/// Library routes/authentication are unchanged; normal start leaves delivery disabled.
/// Shutdown owns this service only. Never drops an operator-supplied database.
pub async fn run(options: ServeOptions) -> Result<(), ServeError> {
    let config = load_config(&options.config, |name| std::env::var(name).ok())?;
    let running = crate::start(config, Arc::new(SystemClock))
        .await
        .map_err(|_| ServeError("serve startup failed"))?;
    let line = serde_json::json!({"service_url":running.base_url(),"deployment":"production","delivery":"not_configured"});
    let written = {
        let mut stdout = std::io::stdout().lock();
        writeln!(stdout, "{line}").and_then(|()| stdout.flush())
    };
    if written.is_ok() {
        stop_requested(options.exit_on_stdin_eof).await;
    }
    tokio::time::timeout(Duration::from_secs(15), running.shutdown())
        .await
        .map_err(|_| ServeError("serve shutdown deadline exceeded"))?;
    written.map_err(|_| ServeError("serve readiness output unavailable"))
}
