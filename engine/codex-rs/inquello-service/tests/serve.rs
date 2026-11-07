#![cfg(feature = "test-issuer")]
#![allow(clippy::expect_used, reason = "owned integration assertions")]
mod support;
use base64::{Engine, engine::general_purpose::STANDARD};
use inquello_service::serve::{ServeOptions, load_config};
use inquello_service::test_tls::TestCertificateAuthority;
use serde_json::{Value, json};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};
struct Fixture {
    dir: tempfile::TempDir,
    file: PathBuf,
    value: Value,
    ca: String,
}
fn pem(label: &str, der: &[u8]) -> String {
    format!(
        "-----BEGIN {label}-----\n{}\n-----END {label}-----\n",
        STANDARD.encode(der)
    )
}
impl Fixture {
    fn new() -> Self {
        let dir = tempfile::tempdir().expect("fixture directory");
        let ca = TestCertificateAuthority::new("owned serve test CA");
        let tls = ca.loopback_server_tls();
        let cert = dir.path().join("certificate.pem");
        let key = dir.path().join("private.pem");
        fs::write(&cert, pem("CERTIFICATE", tls.cert_chain[0].as_ref()))
            .expect("fixture certificate");
        fs::write(&key, pem("PRIVATE KEY", tls.private_key.secret_der())).expect("fixture key");
        let file = dir.path().join("serve.json");
        let value = json!({"bind":"127.0.0.1:0","database_env":"INQUELLO_SERVE_TEST_DATABASE_URL","tls":{"cert_chain_path":cert,"private_key_path":key},"issuer":{"issuer":"https://login.example.com/","client_id":"public-native-client","redirect_uri":"http://127.0.0.1:43821/callback"},"lifetimes":{"login_transaction_seconds":600,"access_seconds":900,"refresh_seconds":3600,"session_seconds":86400,"id_token_clock_skew_seconds":60,"invite_seconds":604800}});
        let fixture = Self {
            dir,
            file,
            value,
            ca: ca.ca_pem(),
        };
        fixture.save();
        fixture
    }
    fn save(&self) {
        fs::write(
            &self.file,
            serde_json::to_vec(&self.value).expect("config JSON"),
        )
        .expect("fixture config");
    }
    fn load(&self) -> Result<inquello_service::ServiceConfig, inquello_service::serve::ServeError> {
        load_config(&self.file, |_| {
            Some("postgresql://fake:fake@127.0.0.1/explicit".into())
        })
    }
}
#[test]
fn serve_flags_are_explicit_unique_and_never_accept_seed_or_delivery() {
    for args in [
        vec![],
        vec!["--config"],
        vec!["--config", "one", "--config", "two"],
        vec![
            "--config",
            "one",
            "--exit-on-stdin-eof",
            "--exit-on-stdin-eof",
        ],
        vec!["--config", "one", "--seed-workspace", "no"],
        vec!["--database-url", "secret"],
        vec!["--config", "one", "--delivery"],
    ] {
        assert!(
            ServeOptions::parse(&args.into_iter().map(String::from).collect::<Vec<_>>()).is_err()
        );
    }
    assert!(
        ServeOptions::parse(&[
            "--config".into(),
            "one".into(),
            "--exit-on-stdin-eof".into()
        ])
        .is_ok()
    );
}
#[test]
fn serve_config_is_production_empty_jwks_and_explicit_tls_without_ambient_database() {
    let f = Fixture::new();
    let config = f.load().expect("explicit config");
    assert_eq!(config.deployment, inquello_service::Deployment::Production);
    assert!(config.tls.is_some());
    assert!(config.issuers[0].jwks.keys.is_empty());
    assert_eq!(config.issuers[0].issuer, "https://login.example.com/");
    assert!(load_config(&f.file, |_| None).is_err());
    for value in [
        "not-a-database",
        "postgresql:///missing-host",
        "postgresql://127.0.0.1/database",
        "postgresql://user@127.0.0.1/",
    ] {
        assert!(load_config(&f.file, |_| Some(value.into())).is_err());
    }
}
#[test]
fn duplicate_unknown_and_missing_config_fields_fail_before_environment_reads() {
    let f = Fixture::new();
    let text = serde_json::to_string(&f.value).expect("JSON");
    for text in [
        text.replacen("\"bind\":", "\"bind\":\"127.0.0.1:0\",\"bind\":", 1),
        text.replacen(
            "\"client_id\":",
            "\"client_id\":\"duplicate\",\"client_id\":",
            1,
        ),
        text.replacen('{', "{\"delivery\":true,", 1),
        "{}".into(),
    ] {
        fs::write(&f.file, text).expect("invalid fixture");
        assert!(load_config(&f.file, |_| panic!("environment must not be read")).is_err());
    }
}
#[test]
fn unsafe_bind_issuer_redirect_and_lifetimes_fail_closed() {
    for (pointer, value) in [
        ("/bind", json!("0.0.0.0:4443")),
        ("/bind", json!("127.0.0.2:4443")),
        ("/bind", json!("127.0.0.1:443")),
        ("/issuer/issuer", json!("https://localhost/")),
        ("/issuer/issuer", json!("https://127.0.0.1:4443/")),
        ("/issuer/issuer", json!("https://[::1]/")),
        (
            "/issuer/issuer",
            json!("https://test-issuer.inquello.invalid"),
        ),
        (
            "/issuer/issuer",
            json!("https://user:secret@login.example.com/"),
        ),
        (
            "/issuer/issuer",
            json!("https://login.example.com/?query=1"),
        ),
        (
            "/issuer/redirect_uri",
            json!("http://127.0.0.1:80/callback"),
        ),
        (
            "/issuer/redirect_uri",
            json!("http://127.0.0.1:43821/other"),
        ),
        (
            "/issuer/redirect_uri",
            json!("http://localhost:43821/callback"),
        ),
        ("/lifetimes/access_seconds", json!(0)),
        ("/lifetimes/session_seconds", json!(u64::MAX)),
        ("/lifetimes/id_token_clock_skew_seconds", json!(301)),
        ("/database_env", json!("PGPASSWORD")),
    ] {
        let mut f = Fixture::new();
        *f.value.pointer_mut(pointer).expect("field") = value;
        f.save();
        assert!(
            load_config(&f.file, |_| panic!("invalid config must fail before env")).is_err(),
            "{pointer}"
        );
    }
}
#[test]
fn missing_oversized_unreadable_or_invalid_tls_files_do_not_leak_paths_or_contents() {
    for field in ["cert_chain_path", "private_key_path"] {
        let mut f = Fixture::new();
        let missing = f.dir.path().join("private-secret-sentinel");
        f.value["tls"][field] = json!(missing);
        f.save();
        let error = f.load().expect_err("missing rejected").to_string();
        assert!(!error.contains("sentinel"));
        fs::create_dir(&missing).expect("nonfile");
        assert!(f.load().is_err());
        fs::remove_dir(&missing).expect("remove fixture dir");
        fs::write(&missing, vec![b'x'; 262145]).expect("oversize");
        assert!(f.load().is_err());
        fs::write(&missing, "fake-private-secret-sentinel").expect("bad PEM");
        assert!(f.load().is_err());
    }
    let f = Fixture::new();
    fs::write(&f.file, vec![b'x'; 65537]).expect("oversize config");
    assert!(f.load().is_err());
    assert!(load_config(&f.dir.path().join("absent"), |_| None).is_err());
}
struct OwnedChild(Child);
impl Drop for OwnedChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
#[tokio::test(flavor = "multi_thread")]
async fn ordinary_serve_binary_starts_empty_https_and_stdin_shutdown_preserves_database() {
    let database = support::TestDatabase::create().await;
    let f = Fixture::new();
    let url = database.url();
    let child = Command::new(env!("CARGO_BIN_EXE_inquello-service"))
        .args(["serve", "--config"])
        .arg(&f.file)
        .arg("--exit-on-stdin-eof")
        .env("INQUELLO_SERVE_TEST_DATABASE_URL", &url)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("owned serve process");
    let mut child = OwnedChild(child);
    let stdout = child.0.stdout.take().expect("stdout");
    let (send, receive) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        let _ = reader.read_line(&mut line);
        let _ = send.send(line);
    });
    let line = receive
        .recv_timeout(Duration::from_secs(45))
        .expect("bounded readiness");
    assert!(!line.contains(&url));
    let ready: Value = serde_json::from_str(&line).expect("public readiness JSON");
    assert_eq!(ready["deployment"], "production");
    assert_eq!(ready["delivery"], "not_configured");
    let base = ready["service_url"].as_str().expect("service URL");
    let client = reqwest::Client::builder()
        .add_root_certificate(reqwest::Certificate::from_pem(f.ca.as_bytes()).expect("scoped CA"))
        .timeout(Duration::from_secs(5))
        .build()
        .expect("client");
    let response = client
        .get(format!("{base}/v1/capabilities"))
        .send()
        .await
        .expect("HTTPS response");
    assert!(response.status().is_success());
    drop(response);
    drop(client);
    let pool = inquello_service::postgres::connect(&inquello_service::DatabaseConfig {
        connect: database.options(),
        max_connections: 1,
        acquire_timeout: Duration::from_secs(5),
    })
    .await
    .expect("owned test database");
    for table in ["workspaces", "memberships", "principals"] {
        let count: i64 =
            sqlx::query_scalar(sqlx::AssertSqlSafe(format!("SELECT count(*) FROM {table}")))
                .fetch_one(&pool)
                .await
                .expect("empty table");
        assert_eq!(count, 0);
    }
    child.0.stdin.take();
    let end = Instant::now() + Duration::from_secs(20);
    loop {
        if let Some(status) = child.0.try_wait().expect("owned wait") {
            assert!(status.success());
            break;
        }
        assert!(Instant::now() < end, "shutdown deadline");
        std::thread::sleep(Duration::from_millis(50));
    }
    let address = url::Url::parse(base).expect("service URL");
    assert!(std::net::TcpStream::connect(("127.0.0.1", address.port().expect("port"))).is_err());
    let alive: i32 = sqlx::query_scalar("SELECT 1")
        .fetch_one(&pool)
        .await
        .expect("service must not drop operator database");
    assert_eq!(alive, 1);
    pool.close().await;
}
#[test]
fn serve_cli_errors_never_print_private_config_or_environment_values() {
    let f = Fixture::new();
    let output = Command::new(env!("CARGO_BIN_EXE_inquello-service"))
        .args(["serve", "--config"])
        .arg(&f.file)
        .env(
            "INQUELLO_SERVE_TEST_DATABASE_URL",
            "private-db-secret-sentinel",
        )
        .output()
        .expect("invalid CLI config");
    assert!(!output.status.success());
    let all = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(!all.contains("private-db-secret-sentinel"));
    assert!(!all.contains(f.file.to_string_lossy().as_ref()));
    assert!(output.stdout.is_empty());
}

#[tokio::test]
async fn mismatched_tls_key_is_refused_before_database_connection() {
    let f = Fixture::new();
    let mut config = f.load().expect("explicit config");
    let other = TestCertificateAuthority::new("other synthetic key").loopback_server_tls();
    config.tls.as_mut().expect("TLS").private_key = other.private_key;
    let result =
        inquello_service::start(config, std::sync::Arc::new(inquello_service::SystemClock)).await;
    assert!(matches!(result, Err(inquello_service::StartError::Tls(_))));
}
