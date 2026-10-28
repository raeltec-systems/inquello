//! Test harness: an isolated PostgreSQL database per test, the service on a
//! loopback listener, the in-process test issuer, a manual clock, and the
//! credential-leak checks every test ends with.

#![allow(dead_code)]

use chrono::DateTime;
use chrono::TimeDelta;
use chrono::Utc;
use inquello_protocol::error::ErrorBody;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::login::LoginTransaction;
use inquello_protocol::login::SessionCredentials;
use inquello_service::Clock;
use inquello_service::DatabaseConfig;
use inquello_service::Deployment;
use inquello_service::Lifetimes;
use inquello_service::RunningService;
use inquello_service::ServiceConfig;
use inquello_service::postgres;
use inquello_service::test_issuer::TestIssuer;
use inquello_service::test_issuer::TokenFixture;
use pretty_assertions::assert_eq;
use reqwest::StatusCode;
use serde_json::Value;
use serde_json::json;
use sqlx::AssertSqlSafe;
use sqlx::PgPool;
use sqlx::postgres::PgConnectOptions;
use std::io::Write;
use std::str::FromStr;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::Duration;
use uuid::Uuid;

pub const DATABASE_ENV: &str = "INQUELLO_TEST_DATABASE_URL";
pub const CLIENT_ID: &str = "inquello-desktop-synthetic";
pub const REDIRECT_URI: &str = "http://127.0.0.1:53682/callback";

/// Every table the service owns, for the raw-credential scan.
const TABLES: &[&str] = &[
    "service_state",
    "principals",
    "login_transactions",
    "consumed_id_tokens",
    "refresh_families",
    "sessions",
    "session_credentials",
    "memberships",
    "operation_receipts",
    "invalidation_events",
];

pub fn lifetimes() -> Lifetimes {
    Lifetimes {
        login_transaction: Duration::from_secs(10 * 60),
        access: Duration::from_secs(15 * 60),
        refresh: Duration::from_secs(24 * 60 * 60),
        session: Duration::from_secs(30 * 24 * 60 * 60),
        id_token_clock_skew: Duration::from_secs(60),
    }
}

/// A clock the test moves explicitly.
#[derive(Debug)]
pub struct ManualClock(Mutex<DateTime<Utc>>);

impl ManualClock {
    pub fn new() -> Self {
        let start = DateTime::parse_from_rfc3339("2026-10-28T12:00:00Z")
            .expect("start time")
            .with_timezone(&Utc);
        Self(Mutex::new(start))
    }

    pub fn advance(&self, by: TimeDelta) {
        let mut now = self.0.lock().expect("clock lock");
        *now += by;
    }
}

impl Clock for ManualClock {
    fn now(&self) -> DateTime<Utc> {
        *self.0.lock().expect("clock lock")
    }
}

// ---- log capture ---------------------------------------------------------

fn log_buffer() -> &'static Mutex<Vec<u8>> {
    static BUFFER: OnceLock<Mutex<Vec<u8>>> = OnceLock::new();
    BUFFER.get_or_init(|| Mutex::new(Vec::new()))
}

struct BufferWriter;

impl Write for BufferWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        log_buffer()
            .lock()
            .expect("log buffer")
            .extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

/// Captures every log line of every crate, at TRACE, into one buffer.
fn init_logging() {
    static INIT: OnceLock<()> = OnceLock::new();
    INIT.get_or_init(|| {
        let _ = tracing_subscriber::fmt()
            .with_max_level(tracing::Level::TRACE)
            .with_ansi(false)
            .with_writer(|| BufferWriter)
            .try_init();
    });
}

pub fn captured_logs() -> String {
    String::from_utf8_lossy(&log_buffer().lock().expect("log buffer")).into_owned()
}

// ---- isolated database ---------------------------------------------------

fn admin_options() -> PgConnectOptions {
    let url = std::env::var(DATABASE_ENV).unwrap_or_else(|_| {
        panic!(
            "{DATABASE_ENV} must name the PostgreSQL 18 test database (see the Story 1.10a spec)"
        )
    });
    PgConnectOptions::from_str(&url).unwrap_or_else(|_| panic!("{DATABASE_ENV} is not a valid URL"))
}

fn database_config(connect: PgConnectOptions) -> DatabaseConfig {
    DatabaseConfig {
        connect,
        max_connections: 4,
        acquire_timeout: Duration::from_secs(2),
    }
}

async fn admin_pool() -> PgPool {
    postgres::connect(&database_config(admin_options()))
        .await
        .expect("connect to the admin test database")
}

/// Fails the suite when the test server is older than PostgreSQL 18.
pub async fn assert_postgres_18(pool: &PgPool) -> i32 {
    let version = postgres::server_version_num(pool)
        .await
        .expect("server version");
    assert!(
        version >= postgres::MINIMUM_SERVER_VERSION_NUM,
        "the test database must be PostgreSQL 18 or later, found server_version_num {version}"
    );
    version
}

/// One freshly created database, dropped (forcibly) when this value drops, even
/// after a panic.
pub struct TestDatabase {
    pub name: String,
}

impl TestDatabase {
    async fn create() -> Self {
        let admin = admin_pool().await;
        assert_postgres_18(&admin).await;
        let name = format!("inquello_t_{}", Uuid::new_v4().simple());
        sqlx::query(AssertSqlSafe(format!("CREATE DATABASE \"{name}\"")))
            .execute(&admin)
            .await
            .expect("create the per-test database");
        admin.close().await;
        Self { name }
    }

    pub fn options(&self) -> PgConnectOptions {
        admin_options().database(&self.name)
    }

    /// Makes the database refuse connections and drops every open one: the
    /// authority is down.
    pub async fn take_down(&self) {
        let admin = admin_pool().await;
        sqlx::query(AssertSqlSafe(format!(
            "ALTER DATABASE \"{}\" ALLOW_CONNECTIONS false",
            self.name
        )))
        .execute(&admin)
        .await
        .expect("disallow connections");
        sqlx::query(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
             WHERE datname = $1 AND pid <> pg_backend_pid()",
        )
        .bind(&self.name)
        .execute(&admin)
        .await
        .expect("terminate connections");
        admin.close().await;
    }

    pub async fn bring_up(&self) {
        let admin = admin_pool().await;
        sqlx::query(AssertSqlSafe(format!(
            "ALTER DATABASE \"{}\" ALLOW_CONNECTIONS true",
            self.name
        )))
        .execute(&admin)
        .await
        .expect("allow connections");
        admin.close().await;
    }
}

impl Drop for TestDatabase {
    fn drop(&mut self) {
        let name = self.name.clone();
        let _ = std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("teardown runtime");
            runtime.block_on(async move {
                let admin = admin_pool().await;
                let _ = sqlx::query(AssertSqlSafe(format!(
                    "DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)"
                )))
                .execute(&admin)
                .await;
                admin.close().await;
            });
        })
        .join();
    }
}

// ---- harness -------------------------------------------------------------

pub struct Response {
    pub status: StatusCode,
    pub body: Value,
}

impl Response {
    pub fn ok<T: serde::de::DeserializeOwned>(self) -> T {
        assert_eq!(
            self.status,
            StatusCode::OK,
            "unexpected response: {}",
            self.body
        );
        serde_json::from_value(self.body).expect("response matches its wire type")
    }

    /// Asserts an SC-2 error of `kind` whose body is exactly the fixed body.
    pub fn assert_error(&self, kind: ErrorKind) {
        assert_eq!(
            self.status.as_u16(),
            kind.http_status(),
            "body: {}",
            self.body
        );
        let body: ErrorBody = serde_json::from_value(self.body.clone()).expect("error body");
        assert_eq!(body, ErrorBody::new(kind));
    }
}

pub struct Harness {
    pub client: reqwest::Client,
    pub base: String,
    pub clock: Arc<ManualClock>,
    pub issuer: TestIssuer,
    pub db: TestDatabase,
    /// A direct pool to the test database for seeding and assertions.
    pub pool: PgPool,
    service: Option<RunningService>,
    secrets: Mutex<Vec<String>>,
    error_bodies: Mutex<Vec<String>>,
}

pub fn synthetic_config(issuer: &TestIssuer, connect: PgConnectOptions) -> ServiceConfig {
    ServiceConfig {
        deployment: Deployment::SyntheticTest,
        bind: "127.0.0.1:0".parse().expect("loopback"),
        tls: None,
        issuers: vec![issuer.issuer_config(CLIENT_ID, &[REDIRECT_URI])],
        lifetimes: lifetimes(),
        database: database_config(connect),
    }
}

impl Harness {
    pub async fn start() -> Self {
        Self::start_with(|_| {}, reqwest::Client::new()).await
    }

    /// Starts with the synthetic config adjusted by `adjust` (for example TLS or
    /// another issuer), talking to the service through `client`.
    pub async fn start_with(
        adjust: impl FnOnce(&mut ServiceConfig),
        client: reqwest::Client,
    ) -> Self {
        init_logging();
        let db = TestDatabase::create().await;
        let issuer = TestIssuer::new();
        let clock = Arc::new(ManualClock::new());
        let mut config = synthetic_config(&issuer, db.options());
        adjust(&mut config);
        let service = inquello_service::start(config, clock.clone())
            .await
            .expect("service starts");
        let pool = postgres::connect(&database_config(db.options()))
            .await
            .expect("test pool");
        Self {
            client,
            base: service.base_url(),
            clock,
            issuer,
            db,
            pool,
            service: Some(service),
            secrets: Mutex::new(Vec::new()),
            error_bodies: Mutex::new(Vec::new()),
        }
    }

    pub fn now(&self) -> DateTime<Utc> {
        self.clock.now()
    }

    /// Registers a secret that must never appear in logs, receipts, error bodies
    /// or any database row.
    pub fn remember(&self, secret: &str) {
        self.secrets
            .lock()
            .expect("secrets")
            .push(secret.to_string());
    }

    fn remember_credentials(&self, credentials: &SessionCredentials) {
        self.remember(credentials.access_credential.expose());
        self.remember(credentials.refresh_credential.expose());
    }

    async fn record(&self, response: reqwest::Response) -> Response {
        let status = response.status();
        let text = response.text().await.expect("response body");
        if !status.is_success() {
            self.error_bodies.lock().expect("bodies").push(text.clone());
        }
        let body = if text.is_empty() {
            Value::Null
        } else {
            serde_json::from_str(&text).expect("JSON body")
        };
        Response { status, body }
    }

    pub async fn post(&self, path: &str, body: &Value, bearer: Option<&str>) -> Response {
        let mut request = self.client.post(format!("{}{path}", self.base)).json(body);
        if let Some(bearer) = bearer {
            request = request.bearer_auth(bearer);
        }
        self.record(request.send().await.expect("request")).await
    }

    pub async fn get(&self, path: &str, bearer: Option<&str>) -> Response {
        let mut request = self.client.get(format!("{}{path}", self.base));
        if let Some(bearer) = bearer {
            request = request.bearer_auth(bearer);
        }
        self.record(request.send().await.expect("request")).await
    }

    pub async fn create_transaction(&self, device_id: Uuid) -> LoginTransaction {
        let transaction: LoginTransaction = self
            .post(
                "/v1/login/transactions",
                &json!({
                    "issuer": self.issuer.issuer(),
                    "client_id": CLIENT_ID,
                    "redirect_uri": REDIRECT_URI,
                    "device_id": device_id,
                }),
                None,
            )
            .await
            .ok();
        self.remember(transaction.transaction_proof.expose());
        transaction
    }

    pub fn valid_fixture(&self, subject: &str, transaction: &LoginTransaction) -> TokenFixture {
        TokenFixture::valid(
            &self.issuer,
            CLIENT_ID,
            subject,
            &transaction.nonce,
            self.now(),
        )
    }

    pub fn sign(&self, fixture: &TokenFixture) -> String {
        let token = self.issuer.sign(fixture);
        self.remember(&token);
        token
    }

    pub fn bootstrap_body(&self, transaction: &LoginTransaction, id_token: &str) -> Value {
        json!({
            "login_transaction_id": transaction.login_transaction_id,
            "transaction_proof": transaction.transaction_proof.expose(),
            "redirect_uri": transaction.redirect_uri,
            "id_token": id_token,
        })
    }

    pub async fn bootstrap(&self, transaction: &LoginTransaction, id_token: &str) -> Response {
        let response = self
            .post(
                "/v1/login/bootstrap",
                &self.bootstrap_body(transaction, id_token),
                None,
            )
            .await;
        if response.status.is_success() {
            let credentials: SessionCredentials =
                serde_json::from_value(response.body.clone()).expect("credentials");
            self.remember_credentials(&credentials);
        }
        response
    }

    /// A full synthetic sign-in for `subject` on a new device.
    pub async fn sign_in(&self, subject: &str) -> SessionCredentials {
        self.sign_in_with(subject, |fixture| fixture).await
    }

    pub async fn sign_in_with(
        &self,
        subject: &str,
        adjust: impl FnOnce(TokenFixture) -> TokenFixture,
    ) -> SessionCredentials {
        let transaction = self.create_transaction(Uuid::new_v4()).await;
        let token = self.sign(&adjust(self.valid_fixture(subject, &transaction)));
        self.bootstrap(&transaction, &token).await.ok()
    }

    pub async fn refresh(&self, refresh_credential: &str) -> Response {
        let response = self
            .post(
                "/v1/session/refresh",
                &json!({ "refresh_credential": refresh_credential }),
                None,
            )
            .await;
        if response.status.is_success() {
            let credentials: SessionCredentials =
                serde_json::from_value(response.body.clone()).expect("credentials");
            self.remember_credentials(&credentials);
        }
        response
    }

    pub async fn command_epoch(&self) -> String {
        let capabilities = self.get("/v1/capabilities", None).await;
        assert_eq!(capabilities.status, StatusCode::OK);
        capabilities.body["command_epoch"]
            .as_str()
            .expect("epoch string")
            .to_string()
    }

    pub async fn count(&self, sql: &'static str) -> i64 {
        sqlx::query_scalar(sql)
            .fetch_one(&self.pool)
            .await
            .expect("count")
    }

    /// Asserts no remembered secret appears in any receipt, error body, captured
    /// log line or database row, then stops the service and drops the database.
    pub async fn finish(mut self) {
        let secrets = self.secrets.lock().expect("secrets").clone();
        assert!(
            !secrets.is_empty(),
            "the test should have issued credentials"
        );

        let receipts: Vec<String> =
            sqlx::query_scalar("SELECT row_to_json(r)::text FROM operation_receipts r")
                .fetch_all(&self.pool)
                .await
                .expect("receipts");
        let mut rows = Vec::new();
        for table in TABLES {
            let table_rows: Vec<String> = sqlx::query_scalar(AssertSqlSafe(format!(
                "SELECT row_to_json(t)::text FROM {table} t"
            )))
            .fetch_all(&self.pool)
            .await
            .expect("table rows");
            rows.extend(table_rows);
        }
        let bodies = self.error_bodies.lock().expect("bodies").clone();
        let logs = captured_logs();
        assert!(
            logs.contains("session created"),
            "log capture is not working, so the log check would prove nothing"
        );
        for secret in &secrets {
            for receipt in &receipts {
                assert!(
                    !receipt.contains(secret.as_str()),
                    "a credential appears in a receipt"
                );
            }
            for body in &bodies {
                assert!(
                    !body.contains(secret.as_str()),
                    "a credential appears in an error body"
                );
            }
            for row in &rows {
                assert!(
                    !row.contains(secret.as_str()),
                    "a raw credential is stored in the database"
                );
            }
            assert!(
                !logs.contains(secret.as_str()),
                "a credential appears in a log line"
            );
        }

        self.pool.close().await;
        if let Some(service) = self.service.take() {
            service.shutdown().await;
        }
    }
}
