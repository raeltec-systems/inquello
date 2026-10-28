//! `inquello-service admin`: the operator CLI (Story 1.11).
//!
//! ```text
//! inquello-service admin create-workspace --name NAME --policy FILE \
//!     --first-admin-issuer ISSUER --first-admin-subject SUBJECT \
//!     --invite-lifetime-seconds N [--kind internal_company] [--operator NAME]
//! inquello-service admin update-policy --workspace ID --policy FILE [--operator NAME]
//! ```
//!
//! The database comes from `--database-url` or `INQUELLO_DATABASE_URL`. The CLI
//! connects to PostgreSQL directly; no HTTP route reaches these commands. On
//! success it prints one JSON line with the outcome (IDs and revisions only); on
//! failure it prints the reason to stderr and exits non-zero. The database URL
//! is never printed.

use inquello_service::DatabaseConfig;
use inquello_service::SystemClock;
use inquello_service::admin;
use inquello_service::admin::AdminError;
use sqlx::postgres::PgConnectOptions;
use std::collections::BTreeMap;
use std::process::ExitCode;
use std::str::FromStr;
use std::time::Duration;
use uuid::Uuid;

const USAGE: &str = "usage:
  inquello-service admin create-workspace --name NAME --policy FILE \\
      --first-admin-issuer ISSUER --first-admin-subject SUBJECT \\
      --invite-lifetime-seconds N [--kind internal_company] [--operator NAME] \\
      [--database-url URL]
  inquello-service admin update-policy --workspace ID --policy FILE \\
      [--operator NAME] [--database-url URL]

The database URL defaults to INQUELLO_DATABASE_URL.";

#[derive(Debug)]
enum CliError {
    Usage(String),
    Admin(AdminError),
}

impl From<AdminError> for CliError {
    fn from(error: AdminError) -> Self {
        CliError::Admin(error)
    }
}

/// Parses `--flag value` pairs, refusing unknown or repeated flags. A client or
/// independence flag is refused as `route_not_available` (OQ-15).
fn flags(args: &[String], allowed: &[&str]) -> Result<BTreeMap<String, String>, CliError> {
    let mut out = BTreeMap::new();
    let mut iter = args.iter();
    while let Some(flag) = iter.next() {
        let Some(name) = flag.strip_prefix("--") else {
            return Err(CliError::Usage(format!("unexpected argument `{flag}`")));
        };
        let lower = name.to_ascii_lowercase();
        if lower.contains("client") || lower.contains("independence") {
            return Err(CliError::Admin(AdminError::RouteNotAvailable(format!(
                "`--{name}` is an external-audit attribute"
            ))));
        }
        if !allowed.contains(&name) {
            return Err(CliError::Usage(format!("unknown flag `--{name}`")));
        }
        let value = iter
            .next()
            .ok_or_else(|| CliError::Usage(format!("`--{name}` needs a value")))?;
        if out.insert(name.to_string(), value.clone()).is_some() {
            return Err(CliError::Usage(format!("`--{name}` given twice")));
        }
    }
    Ok(out)
}

fn take(flags: &mut BTreeMap<String, String>, name: &str) -> Result<String, CliError> {
    flags
        .remove(name)
        .ok_or_else(|| CliError::Usage(format!("`--{name}` is required")))
}

fn operator(flags: &mut BTreeMap<String, String>) -> String {
    flags
        .remove("operator")
        .or_else(|| std::env::var("USER").ok())
        .unwrap_or_else(|| "operator".to_string())
}

fn read_policy(path: &str) -> Result<String, CliError> {
    std::fs::read_to_string(path).map_err(|error| {
        CliError::Admin(AdminError::Invalid(format!(
            "cannot read the policy file: {error}"
        )))
    })
}

fn database(flags: &mut BTreeMap<String, String>) -> Result<DatabaseConfig, CliError> {
    let url = flags
        .remove("database-url")
        .or_else(|| std::env::var("INQUELLO_DATABASE_URL").ok())
        .ok_or_else(|| {
            CliError::Usage("give --database-url or set INQUELLO_DATABASE_URL".to_string())
        })?;
    let connect = PgConnectOptions::from_str(&url)
        .map_err(|_| CliError::Usage("the database URL is not valid".to_string()))?;
    Ok(DatabaseConfig {
        connect,
        max_connections: 1,
        acquire_timeout: Duration::from_secs(10),
    })
}

fn now() -> chrono::DateTime<chrono::Utc> {
    use inquello_service::Clock as _;
    SystemClock.now()
}

async fn run(args: &[String]) -> Result<String, CliError> {
    match args {
        [admin, command, rest @ ..] if admin == "admin" && command == "create-workspace" => {
            let mut flags = flags(
                rest,
                &[
                    "name",
                    "policy",
                    "first-admin-issuer",
                    "first-admin-subject",
                    "invite-lifetime-seconds",
                    "kind",
                    "operator",
                    "database-url",
                ],
            )?;
            let invite_lifetime = take(&mut flags, "invite-lifetime-seconds")?
                .parse::<u64>()
                .map_err(|_| {
                    CliError::Usage("`--invite-lifetime-seconds` must be a number".to_string())
                })?;
            let request = admin::CreateWorkspace {
                name: take(&mut flags, "name")?,
                kind: flags
                    .remove("kind")
                    .unwrap_or_else(|| "internal_company".to_string()),
                policy: read_policy(&take(&mut flags, "policy")?)?,
                first_admin_issuer: take(&mut flags, "first-admin-issuer")?,
                first_admin_subject: take(&mut flags, "first-admin-subject")?,
                invite_lifetime: Duration::from_secs(invite_lifetime),
                operator: operator(&mut flags),
            };
            let config = database(&mut flags)?;
            let pool = admin::open(&config).await?;
            let outcome = admin::create_workspace(&pool, request, now()).await;
            pool.close().await;
            Ok(serde_json::to_string(&outcome?).unwrap_or_default())
        }
        [admin, command, rest @ ..] if admin == "admin" && command == "update-policy" => {
            let mut flags = flags(rest, &["workspace", "policy", "operator", "database-url"])?;
            let workspace_id = Uuid::parse_str(&take(&mut flags, "workspace")?)
                .map_err(|_| CliError::Usage("`--workspace` must be a UUID".to_string()))?;
            let request = admin::UpdatePolicy {
                workspace_id,
                policy: read_policy(&take(&mut flags, "policy")?)?,
                operator: operator(&mut flags),
            };
            let config = database(&mut flags)?;
            let pool = admin::open(&config).await?;
            let outcome = admin::update_policy(&pool, request, now()).await;
            pool.close().await;
            Ok(serde_json::to_string(&outcome?).unwrap_or_default())
        }
        _ => Err(CliError::Usage("unknown command".to_string())),
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run(&args).await {
        Ok(line) => {
            println!("{line}");
            ExitCode::SUCCESS
        }
        Err(CliError::Usage(message)) => {
            eprintln!("error: {message}\n\n{USAGE}");
            ExitCode::from(2)
        }
        Err(CliError::Admin(error)) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}
