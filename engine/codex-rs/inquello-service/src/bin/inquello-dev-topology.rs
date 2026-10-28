//! `inquello-dev-topology`: the SC-7 synthetic topology for desktop development
//! and tests. Built only with the `test-issuer` feature.
//!
//! It starts, on loopback HTTPS with one ephemeral test CA:
//!
//! - the synthetic OIDC provider (`/authorize`, `/token`, discovery, JWKS) for
//!   the public native client `inquello-desktop-synthetic`, whose registered
//!   redirect is `http://127.0.0.1/callback` on any port;
//! - the Inquello shared service, allowlisting that provider, on a fresh
//!   PostgreSQL 18 database created for this run and dropped when it ends.
//!
//! It then prints exactly one JSON line on stdout:
//! `{"service_url", "issuer_url", "issuer_label", "ca_path", "client_id"}`.
//! That line is also a valid desktop `INQUELLO_SERVICE_CONFIG` file.
//!
//! Only the CA *certificate* is written to disk (`ca.pem`, world-readable, in a
//! fresh world-readable directory unless `--ca-dir` names one). No key, token or
//! credential is written anywhere. The topology stops on SIGINT or SIGTERM, or,
//! with `--exit-on-stdin-eof`, when stdin closes; it then removes the CA file it
//! wrote and drops its database.
//!
//! The administrative database URL comes from `INQUELLO_DEV_DATABASE_URL` or, if
//! unset, `INQUELLO_TEST_DATABASE_URL`; its role needs `CREATEDB`.

use chrono::TimeDelta;
use inquello_service::DatabaseConfig;
use inquello_service::Deployment;
use inquello_service::Lifetimes;
use inquello_service::ServiceConfig;
use inquello_service::SystemClock;
use inquello_service::postgres;
use inquello_service::test_provider::ProviderSettings;
use inquello_service::test_provider::start_provider;
use inquello_service::test_tls::TestCertificateAuthority;
use serde_json::json;
use sqlx::AssertSqlSafe;
use sqlx::postgres::PgConnectOptions;
use std::io::Read;
use std::io::Write;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::process::ExitCode;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

const CLIENT_ID: &str = "inquello-desktop-synthetic";
const REDIRECT_URI: &str = "http://127.0.0.1/callback";
const ISSUER_LABEL: &str = "Synthetic test issuer";
const SUBJECT: &str = "synthetic-developer";
const SUBJECT_NAME: &str = "Synthetic Developer";
const SUBJECT_EMAIL: &str = "developer@synthetic.invalid";

const USAGE: &str = "usage: inquello-dev-topology [--service-bind ADDR] [--issuer-bind ADDR] \
[--ca-dir DIR] [--access-lifetime-secs N] [--exit-on-stdin-eof]";

struct Options {
    service_bind: SocketAddr,
    issuer_bind: SocketAddr,
    ca_dir: Option<PathBuf>,
    access_lifetime: Duration,
    exit_on_stdin_eof: bool,
}

fn parse_options() -> Result<Options, String> {
    let loopback: SocketAddr = SocketAddr::from(([127, 0, 0, 1], 0));
    let mut options = Options {
        service_bind: loopback,
        issuer_bind: loopback,
        ca_dir: None,
        access_lifetime: Duration::from_secs(15 * 60),
        exit_on_stdin_eof: false,
    };
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        let mut value = |name: &str| args.next().ok_or_else(|| format!("{name} needs a value"));
        match arg.as_str() {
            "--service-bind" => {
                options.service_bind = value("--service-bind")?
                    .parse()
                    .map_err(|_| "--service-bind is not a socket address".to_string())?;
            }
            "--issuer-bind" => {
                options.issuer_bind = value("--issuer-bind")?
                    .parse()
                    .map_err(|_| "--issuer-bind is not a socket address".to_string())?;
            }
            "--ca-dir" => options.ca_dir = Some(PathBuf::from(value("--ca-dir")?)),
            "--access-lifetime-secs" => {
                let secs: u64 = value("--access-lifetime-secs")?
                    .parse()
                    .map_err(|_| "--access-lifetime-secs is not a number".to_string())?;
                options.access_lifetime = Duration::from_secs(secs);
            }
            "--exit-on-stdin-eof" => options.exit_on_stdin_eof = true,
            "-h" | "--help" => return Err(USAGE.to_string()),
            other => return Err(format!("unknown argument {other}\n{USAGE}")),
        }
    }
    Ok(options)
}

fn database_config(connect: PgConnectOptions) -> DatabaseConfig {
    DatabaseConfig {
        connect,
        max_connections: 8,
        acquire_timeout: Duration::from_secs(2),
    }
}

fn admin_options() -> Result<PgConnectOptions, String> {
    let url = std::env::var("INQUELLO_DEV_DATABASE_URL")
        .or_else(|_| std::env::var("INQUELLO_TEST_DATABASE_URL"))
        .map_err(|_| {
            "set INQUELLO_DEV_DATABASE_URL or INQUELLO_TEST_DATABASE_URL to a PostgreSQL 18 \
             role with CREATEDB"
                .to_string()
        })?;
    PgConnectOptions::from_str(&url).map_err(|_| "the database URL is not valid".to_string())
}

/// A per-run database, dropped by [`RunDatabase::drop_now`].
struct RunDatabase {
    admin: PgConnectOptions,
    name: String,
}

impl RunDatabase {
    async fn create(admin: PgConnectOptions) -> Result<Self, String> {
        let pool = postgres::connect(&database_config(admin.clone()))
            .await
            .map_err(|_| "could not connect to the administrative database".to_string())?;
        let version = postgres::server_version_num(&pool)
            .await
            .map_err(|_| "could not read the server version".to_string())?;
        if version < postgres::MINIMUM_SERVER_VERSION_NUM {
            pool.close().await;
            return Err(format!(
                "PostgreSQL server_version_num {version} is older than 18"
            ));
        }
        let name = format!("inquello_dev_{}", uuid::Uuid::new_v4().simple());
        let created = sqlx::query(AssertSqlSafe(format!("CREATE DATABASE \"{name}\"")))
            .execute(&pool)
            .await;
        pool.close().await;
        created.map_err(|_| "could not create the run database".to_string())?;
        Ok(Self { admin, name })
    }

    fn options(&self) -> PgConnectOptions {
        self.admin.clone().database(&self.name)
    }

    async fn drop_now(self) {
        if let Ok(pool) = postgres::connect(&database_config(self.admin.clone())).await {
            let _ = sqlx::query(AssertSqlSafe(format!(
                "DROP DATABASE IF EXISTS \"{}\" WITH (FORCE)",
                self.name
            )))
            .execute(&pool)
            .await;
            pool.close().await;
        }
    }
}

/// Where the CA certificate lives and what to remove at the end.
struct CaFile {
    path: PathBuf,
    /// The directory, when this run created it.
    created_dir: Option<PathBuf>,
}

impl CaFile {
    fn write(ca_dir: Option<PathBuf>, pem: &str) -> Result<Self, String> {
        let (dir, created_dir) = match ca_dir {
            Some(dir) => (dir, None),
            None => {
                let dir = std::env::temp_dir().join(format!(
                    "inquello-dev-topology-{}",
                    uuid::Uuid::new_v4().simple()
                ));
                std::fs::create_dir(&dir)
                    .map_err(|error| format!("could not create the CA directory: {error}"))?;
                set_mode(&dir, 0o755)?;
                (dir.clone(), Some(dir))
            }
        };
        let path = dir.join("ca.pem");
        std::fs::write(&path, pem)
            .map_err(|error| format!("could not write the CA certificate: {error}"))?;
        set_mode(&path, 0o644)?;
        Ok(Self { path, created_dir })
    }

    fn remove(self) {
        let _ = std::fs::remove_file(&self.path);
        if let Some(dir) = self.created_dir {
            let _ = std::fs::remove_dir(dir);
        }
    }
}

#[cfg(unix)]
fn set_mode(path: &std::path::Path, mode: u32) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode))
        .map_err(|error| format!("could not set permissions: {error}"))
}

#[cfg(not(unix))]
fn set_mode(_path: &std::path::Path, _mode: u32) -> Result<(), String> {
    Ok(())
}

/// Resolves when the topology should stop.
async fn stop_requested(exit_on_stdin_eof: bool) {
    let (sender, mut receiver) = mpsc::channel::<()>(1);
    if exit_on_stdin_eof {
        let sender = sender.clone();
        std::thread::spawn(move || {
            let mut sink = [0_u8; 256];
            let mut stdin = std::io::stdin();
            while matches!(stdin.read(&mut sink), Ok(n) if n > 0) {}
            let _ = sender.blocking_send(());
        });
    }
    #[cfg(unix)]
    {
        let sender = sender.clone();
        tokio::spawn(async move {
            if let Ok(mut terminate) =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            {
                terminate.recv().await;
                let _ = sender.send(()).await;
            }
        });
    }
    tokio::select! {
        _ = tokio::signal::ctrl_c() => {}
        _ = receiver.recv() => {}
    }
}

async fn run(options: Options) -> Result<(), String> {
    let database = RunDatabase::create(admin_options()?).await?;
    let ca = TestCertificateAuthority::new("Inquello synthetic dev-topology CA");
    let tls = ca.loopback_server_tls();
    let ca_file = match CaFile::write(options.ca_dir, &ca.ca_pem()) {
        Ok(ca_file) => ca_file,
        Err(error) => {
            database.drop_now().await;
            return Err(error);
        }
    };

    let started = async {
        let provider = start_provider(
            options.issuer_bind,
            &tls,
            ProviderSettings {
                client_id: CLIENT_ID.to_string(),
                redirect_uris: vec![REDIRECT_URI.to_string()],
                subject: SUBJECT.to_string(),
                email: Some(SUBJECT_EMAIL.to_string()),
                name: Some(SUBJECT_NAME.to_string()),
                code_lifetime: TimeDelta::minutes(1),
                id_token_lifetime: TimeDelta::minutes(5),
            },
            Arc::new(SystemClock),
        )
        .await
        .map_err(|error| format!("the synthetic provider did not start: {error}"))?;
        let config = ServiceConfig {
            deployment: Deployment::SyntheticTest,
            bind: options.service_bind,
            tls: Some(tls.clone()),
            issuers: vec![provider.issuer_config()],
            lifetimes: Lifetimes {
                login_transaction: Duration::from_secs(5 * 60),
                access: options.access_lifetime,
                refresh: Duration::from_secs(24 * 60 * 60),
                session: Duration::from_secs(30 * 24 * 60 * 60),
                id_token_clock_skew: Duration::from_secs(60),
            },
            database: database_config(database.options()),
        };
        match inquello_service::start(config, Arc::new(SystemClock)).await {
            Ok(service) => Ok((provider, service)),
            Err(error) => {
                provider.shutdown().await;
                Err(format!("the shared service did not start: {error}"))
            }
        }
    }
    .await;
    let (provider, service) = match started {
        Ok(running) => running,
        Err(error) => {
            ca_file.remove();
            database.drop_now().await;
            return Err(error);
        }
    };

    let line = json!({
        "service_url": service.base_url(),
        "issuer_url": provider.issuer_url(),
        "issuer_label": ISSUER_LABEL,
        "ca_path": ca_file.path.to_string_lossy(),
        "client_id": CLIENT_ID,
    });
    {
        let mut stdout = std::io::stdout().lock();
        let _ = writeln!(stdout, "{line}");
        let _ = stdout.flush();
    }

    stop_requested(options.exit_on_stdin_eof).await;
    tracing::info!("dev topology stopping");
    service.shutdown().await;
    provider.shutdown().await;
    ca_file.remove();
    database.drop_now().await;
    Ok(())
}

fn main() -> ExitCode {
    let options = match parse_options() {
        Ok(options) => options,
        Err(message) => {
            eprintln!("{message}");
            return ExitCode::from(2);
        }
    };
    let _ = tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_ansi(false)
        .with_writer(std::io::stderr)
        .try_init();
    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(error) => {
            eprintln!("could not start the async runtime: {error}");
            return ExitCode::FAILURE;
        }
    };
    match runtime.block_on(run(options)) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("inquello-dev-topology: {message}");
            ExitCode::FAILURE
        }
    }
}
