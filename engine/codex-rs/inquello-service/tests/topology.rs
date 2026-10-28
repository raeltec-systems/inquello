//! Story 1.10b: the HTTPS synthetic topology. HTTPS with scoped trust of an
//! ephemeral test CA, loopback redirect URIs on any port, the synthetic OIDC
//! provider's authorization-code + PKCE flow into a real bootstrap, and the
//! `inquello-dev-topology` binary.
//!
//! Run with `INQUELLO_TEST_DATABASE_URL` set and `--features test-issuer`.

#![allow(
    clippy::expect_used,
    reason = "test helpers fail the test on any unexpected error"
)]

mod support;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::TimeDelta;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::login::LoginTransaction;
use inquello_protocol::login::SessionCredentials;
use inquello_service::ConfigError;
use inquello_service::StartError;
use inquello_service::test_provider::ProviderSettings;
use inquello_service::test_provider::RunningProvider;
use inquello_service::test_provider::start_provider;
use inquello_service::test_tls::TestCertificateAuthority;
use pretty_assertions::assert_eq;
use reqwest::StatusCode;
use reqwest::header::LOCATION;
use serde_json::Value;
use serde_json::json;
use sha2::Digest;
use sha2::Sha256;
use std::collections::HashMap;
use std::io::BufRead;
use std::io::BufReader;
use std::process::Command;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use support::CLIENT_ID;
use support::Harness;
use support::ManualClock;
use uuid::Uuid;

const LOOPBACK_REGISTRATION: &str = "http://127.0.0.1/callback";

fn trusting(ca: &TestCertificateAuthority) -> reqwest::Client {
    reqwest::Client::builder()
        .tls_built_in_root_certs(false)
        .add_root_certificate(
            reqwest::Certificate::from_pem(ca.ca_pem().as_bytes()).expect("CA certificate"),
        )
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("client")
}

// ---- HTTPS ---------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn https_serves_only_clients_that_trust_the_configured_ca() {
    let ca = TestCertificateAuthority::new("topology test CA");
    let tls = ca.loopback_server_tls();
    let h = Harness::start_with(|config| config.tls = Some(tls), trusting(&ca)).await;
    assert!(h.base.starts_with("https://127.0.0.1:"), "{}", h.base);

    let capabilities = h.get("/v1/capabilities", None).await;
    assert_eq!(capabilities.status, StatusCode::OK);
    h.sign_in("tls-alice").await;

    // A client that trusts a different CA refuses the service's certificate.
    let other = TestCertificateAuthority::new("unrelated CA");
    let refused = trusting(&other)
        .get(format!("{}/v1/capabilities", h.base))
        .send()
        .await;
    assert!(refused.is_err(), "an untrusted certificate was accepted");

    // Plain HTTP to the HTTPS listener gets no response.
    let plain = reqwest::Client::new()
        .get(h.base.replacen("https://", "http://", 1) + "/v1/capabilities")
        .timeout(Duration::from_secs(5))
        .send()
        .await;
    assert!(
        plain
            .map(|response| !response.status().is_success())
            .unwrap_or(true),
        "plain HTTP was served"
    );

    h.finish().await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_non_loopback_bind_is_accepted_only_with_tls() {
    let ca = TestCertificateAuthority::new("bind test CA");
    let tls = ca.loopback_server_tls();
    let mut h = Harness::start_with(
        |config| {
            config.tls = Some(tls);
            config.bind = "0.0.0.0:0".parse().expect("address");
        },
        trusting(&ca),
    )
    .await;
    // Reach the wildcard listener through loopback, which the certificate names.
    let port = h.base.rsplit(':').next().expect("port").to_string();
    h.base = format!("https://127.0.0.1:{port}");
    let response = h
        .client
        .get(format!("https://127.0.0.1:{port}/v1/capabilities"))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status(), StatusCode::OK);

    let mut config = support::synthetic_config(&h.issuer, h.db.options());
    config.bind = "0.0.0.0:0".parse().expect("address");
    let error = inquello_service::start(config, Arc::new(ManualClock::new()))
        .await
        .err()
        .expect("plain HTTP on a wildcard address is refused");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::NonLoopbackBind { .. })
    ));

    let mut config = support::synthetic_config(&h.issuer, h.db.options());
    config.tls = Some(inquello_service::TlsConfig {
        cert_chain: Vec::new(),
        private_key: ca.loopback_server_tls().private_key,
    });
    let error = inquello_service::start(config, Arc::new(ManualClock::new()))
        .await
        .err()
        .expect("an empty chain is refused");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::InvalidTls(_))
    ));

    h.sign_in("bind-check").await;
    h.finish().await;
}

// ---- loopback redirects ----------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_loopback_registration_accepts_any_port_with_the_exact_path() {
    let h = Harness::start_with(
        |config| config.issuers[0].redirect_uris = vec![LOOPBACK_REGISTRATION.to_string()],
        reqwest::Client::new(),
    )
    .await;
    let body = |redirect: &str| {
        json!({
            "issuer": h.issuer.issuer(),
            "client_id": CLIENT_ID,
            "redirect_uri": redirect,
            "device_id": Uuid::new_v4(),
        })
    };

    for redirect in [
        "http://127.0.0.1:40123/callback",
        "http://127.0.0.1:1/callback",
        LOOPBACK_REGISTRATION,
    ] {
        let transaction: LoginTransaction = h
            .post("/v1/login/transactions", &body(redirect), None)
            .await
            .ok();
        h.remember(transaction.transaction_proof.expose());
        // The transaction binds the exact URI requested.
        assert_eq!(transaction.redirect_uri, redirect);
    }
    for redirect in [
        "http://127.0.0.1:40123/other",
        "http://127.0.0.1:40123/callback/",
        "http://127.0.0.1:40123/callback?x=1",
        "http://localhost:40123/callback",
        "http://[::1]:40123/callback",
        "https://127.0.0.1:40123/callback",
    ] {
        h.post("/v1/login/transactions", &body(redirect), None)
            .await
            .assert_error(ErrorKind::Denied);
    }

    // Bootstrap must present the exact bound URI, not just any loopback port.
    let transaction: LoginTransaction = h
        .post(
            "/v1/login/transactions",
            &body("http://127.0.0.1:40123/callback"),
            None,
        )
        .await
        .ok();
    h.remember(transaction.transaction_proof.expose());
    let token = h.sign(&h.valid_fixture("redirect-alice", &transaction));
    let mut wrong_port = h.bootstrap_body(&transaction, &token);
    wrong_port["redirect_uri"] = json!("http://127.0.0.1:40124/callback");
    h.post("/v1/login/bootstrap", &wrong_port, None)
        .await
        .assert_error(ErrorKind::Unauthenticated);
    let _: SessionCredentials = h.bootstrap(&transaction, &token).await.ok();

    h.finish().await;
}

// ---- synthetic provider ----------------------------------------------------

struct ProviderHarness {
    h: Harness,
    provider: RunningProvider,
    client: reqwest::Client,
}

fn pkce() -> (String, String) {
    let mut bytes = [0_u8; 32];
    rand::fill(&mut bytes);
    let verifier = URL_SAFE_NO_PAD.encode(bytes);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    (verifier, challenge)
}

fn query_of(location: &str) -> HashMap<String, String> {
    let query = location.split_once('?').map(|(_, q)| q).unwrap_or_default();
    url::form_urlencoded::parse(query.as_bytes())
        .into_owned()
        .collect()
}

impl ProviderHarness {
    async fn start() -> Self {
        let ca = TestCertificateAuthority::new("provider test CA");
        let tls = ca.loopback_server_tls();
        let provider = start_provider(
            "127.0.0.1:0".parse().expect("address"),
            &tls,
            ProviderSettings {
                client_id: CLIENT_ID.to_string(),
                redirect_uris: vec![LOOPBACK_REGISTRATION.to_string()],
                subject: "synthetic-provider-subject".to_string(),
                email: Some("provider@synthetic.invalid".to_string()),
                name: Some("Provider Subject".to_string()),
                code_lifetime: TimeDelta::minutes(1),
                id_token_lifetime: TimeDelta::minutes(5),
            },
            Arc::new(ManualClock::new()),
        )
        .await
        .expect("provider starts");
        let issuer_config = provider.issuer_config();
        let client = trusting(&ca);
        let h = Harness::start_with(
            move |config| {
                config.tls = Some(tls);
                config.issuers.push(issuer_config);
            },
            client.clone(),
        )
        .await;
        Self {
            h,
            provider,
            client,
        }
    }

    async fn transaction(&self, redirect_uri: &str) -> LoginTransaction {
        let transaction: LoginTransaction = self
            .h
            .post(
                "/v1/login/transactions",
                &json!({
                    "issuer": self.provider.issuer_url(),
                    "client_id": CLIENT_ID,
                    "redirect_uri": redirect_uri,
                    "device_id": Uuid::new_v4(),
                }),
                None,
            )
            .await
            .ok();
        self.h.remember(transaction.transaction_proof.expose());
        transaction
    }

    /// `GET /authorize`; returns the status and the `Location`, if any.
    async fn authorize(&self, params: &[(&str, &str)]) -> (StatusCode, Option<String>) {
        let response = self
            .client
            .get(format!("{}/authorize", self.provider.issuer_url()))
            .query(params)
            .send()
            .await
            .expect("authorize");
        let location = response
            .headers()
            .get(LOCATION)
            .map(|value| value.to_str().expect("location").to_string());
        (response.status(), location)
    }

    async fn token(&self, params: &[(&str, &str)]) -> (StatusCode, Value) {
        let body = url::form_urlencoded::Serializer::new(String::new())
            .extend_pairs(params)
            .finish();
        let response = self
            .client
            .post(format!("{}/token", self.provider.issuer_url()))
            .header("content-type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .expect("token");
        let status = response.status();
        (status, response.json().await.expect("token body"))
    }

    /// Runs `/authorize` for `transaction` and returns the code.
    async fn code(&self, transaction: &LoginTransaction, challenge: &str, state: &str) -> String {
        let (status, location) = self
            .authorize(&[
                ("response_type", "code"),
                ("client_id", CLIENT_ID),
                ("redirect_uri", &transaction.redirect_uri),
                ("scope", "openid profile email"),
                ("state", state),
                ("nonce", &transaction.nonce),
                ("code_challenge", challenge),
                ("code_challenge_method", "S256"),
            ])
            .await;
        assert_eq!(status, StatusCode::FOUND);
        let location = location.expect("redirect");
        assert!(
            location.starts_with(&format!("{}?", transaction.redirect_uri)),
            "{location}"
        );
        let query = query_of(&location);
        assert_eq!(query.get("state").map(String::as_str), Some(state));
        assert_eq!(
            query.get("iss").map(String::as_str),
            Some(self.provider.issuer_url())
        );
        let code = query.get("code").expect("code").clone();
        self.h.remember(&code);
        code
    }

    async fn finish(self) {
        self.h.finish().await;
        self.provider.shutdown().await;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn the_provider_issues_an_id_token_the_service_accepts_after_pkce() {
    let p = ProviderHarness::start().await;
    let redirect = "http://127.0.0.1:41234/callback";
    let transaction = p.transaction(redirect).await;
    let (verifier, challenge) = pkce();
    p.h.remember(&verifier);
    let code = p.code(&transaction, &challenge, "state-1").await;

    let (status, body) = p
        .token(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", redirect),
            ("client_id", CLIENT_ID),
            ("code_verifier", &verifier),
        ])
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["token_type"], "Bearer");
    let id_token = body["id_token"].as_str().expect("id token").to_string();
    p.h.remember(&id_token);
    p.h.remember(body["access_token"].as_str().expect("access token"));

    let credentials: SessionCredentials = p.h.bootstrap(&transaction, &id_token).await.ok();
    let view: inquello_protocol::session::SessionView =
        p.h.get("/v1/session", Some(credentials.access_credential.expose()))
            .await
            .ok();
    assert_eq!(view.issuer, p.provider.issuer_url());
    assert_eq!(view.subject, "synthetic-provider-subject");
    assert_eq!(
        view.principal.display_name.as_deref(),
        Some("Provider Subject")
    );

    // The code is one-use: redeeming it again fails.
    let (status, body) = p
        .token(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", redirect),
            ("client_id", CLIENT_ID),
            ("code_verifier", &verifier),
        ])
        .await;
    assert_eq!(
        (status, body["error"].as_str()),
        (StatusCode::BAD_REQUEST, Some("invalid_grant"))
    );

    p.finish().await;
}

#[tokio::test(flavor = "multi_thread")]
async fn the_token_endpoint_rejects_a_wrong_verifier_client_or_redirect() {
    let p = ProviderHarness::start().await;
    let redirect = "http://127.0.0.1:41235/callback";
    let transaction = p.transaction(redirect).await;
    let (verifier, challenge) = pkce();
    let (other_verifier, _) = pkce();
    p.h.remember(&verifier);

    type Case = (
        &'static str,
        Vec<(&'static str, String)>,
        StatusCode,
        &'static str,
    );
    let cases: Vec<Case> = vec![
        (
            "PKCE mismatch",
            vec![("code_verifier", other_verifier.clone())],
            StatusCode::BAD_REQUEST,
            "invalid_grant",
        ),
        (
            "short verifier",
            vec![("code_verifier", "short".to_string())],
            StatusCode::BAD_REQUEST,
            "invalid_grant",
        ),
        (
            "other redirect port",
            vec![(
                "redirect_uri",
                "http://127.0.0.1:41236/callback".to_string(),
            )],
            StatusCode::BAD_REQUEST,
            "invalid_grant",
        ),
        (
            "unknown client",
            vec![("client_id", "someone-else".to_string())],
            StatusCode::UNAUTHORIZED,
            "invalid_client",
        ),
        (
            "client secret",
            vec![("client_secret", "nope".to_string())],
            StatusCode::UNAUTHORIZED,
            "invalid_client",
        ),
        (
            "grant type",
            vec![("grant_type", "refresh_token".to_string())],
            StatusCode::BAD_REQUEST,
            "unsupported_grant_type",
        ),
    ];
    for (label, overrides, expected_status, expected_error) in cases {
        let code = p.code(&transaction, &challenge, "state-x").await;
        let mut params: Vec<(&str, String)> = vec![
            ("grant_type", "authorization_code".to_string()),
            ("code", code.clone()),
            ("redirect_uri", redirect.to_string()),
            ("client_id", CLIENT_ID.to_string()),
            ("code_verifier", verifier.clone()),
        ];
        for (key, value) in overrides {
            match params.iter_mut().find(|(name, _)| *name == key) {
                Some(entry) => entry.1 = value,
                None => params.push((key, value)),
            }
        }
        let borrowed: Vec<(&str, &str)> = params.iter().map(|(k, v)| (*k, v.as_str())).collect();
        let (status, body) = p.token(&borrowed).await;
        assert_eq!(status, expected_status, "{label}: {body}");
        assert_eq!(body["error"].as_str(), Some(expected_error), "{label}");
        assert!(body.get("id_token").is_none(), "{label}");

        // Every presentation consumed the code, even a failed one.
        let (status, body) = p
            .token(&[
                ("grant_type", "authorization_code"),
                ("code", &code),
                ("redirect_uri", redirect),
                ("client_id", CLIENT_ID),
                ("code_verifier", &verifier),
            ])
            .await;
        if expected_error == "invalid_grant" {
            assert_eq!(
                body["error"].as_str(),
                Some("invalid_grant"),
                "{label}: {status}"
            );
        }
    }

    // The transaction stayed open; a correct exchange still signs in.
    let code = p.code(&transaction, &challenge, "state-ok").await;
    let (status, body) = p
        .token(&[
            ("grant_type", "authorization_code"),
            ("code", &code),
            ("redirect_uri", redirect),
            ("client_id", CLIENT_ID),
            ("code_verifier", &verifier),
        ])
        .await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let id_token = body["id_token"].as_str().expect("id token").to_string();
    p.h.remember(&id_token);
    let _: SessionCredentials = p.h.bootstrap(&transaction, &id_token).await.ok();

    p.finish().await;
}

#[tokio::test(flavor = "multi_thread")]
async fn authorize_never_redirects_to_an_unregistered_client_and_requires_s256() {
    let p = ProviderHarness::start().await;
    let (_, challenge) = pkce();
    let good = |overrides: &[(&'static str, &'static str)]| {
        let mut params: Vec<(&str, String)> = vec![
            ("response_type", "code".to_string()),
            ("client_id", CLIENT_ID.to_string()),
            (
                "redirect_uri",
                "http://127.0.0.1:41237/callback".to_string(),
            ),
            ("scope", "openid".to_string()),
            ("state", "s".to_string()),
            ("nonce", "n".to_string()),
            ("code_challenge", challenge.clone()),
            ("code_challenge_method", "S256".to_string()),
        ];
        for (key, value) in overrides {
            match params.iter_mut().find(|(name, _)| name == key) {
                Some(entry) => entry.1 = (*value).to_string(),
                None => params.push((key, (*value).to_string())),
            }
        }
        params
    };
    let call = |params: Vec<(&'static str, String)>| {
        let p = &p;
        async move {
            let borrowed: Vec<(&str, &str)> =
                params.iter().map(|(k, v)| (*k, v.as_str())).collect();
            p.authorize(&borrowed).await
        }
    };

    // Unregistered client or redirect URI: no redirect at all.
    for overrides in [
        vec![("client_id", "someone-else")],
        vec![("redirect_uri", "http://127.0.0.1:41237/other")],
        vec![("redirect_uri", "http://localhost:41237/callback")],
        vec![("redirect_uri", "https://attacker.example/callback")],
    ] {
        let (status, location) = call(good(&overrides)).await;
        assert_eq!(
            (status, location),
            (StatusCode::BAD_REQUEST, None),
            "{overrides:?}"
        );
    }

    // Other errors go back to the registered loopback client with the state.
    for (overrides, error) in [
        (vec![("code_challenge_method", "plain")], "invalid_request"),
        (vec![("code_challenge", "too-short")], "invalid_request"),
        (
            vec![("response_type", "token")],
            "unsupported_response_type",
        ),
        (vec![("scope", "profile")], "invalid_scope"),
        (vec![("nonce", "")], "invalid_request"),
    ] {
        let (status, location) = call(good(&overrides)).await;
        assert_eq!(status, StatusCode::FOUND, "{overrides:?}");
        let query = query_of(&location.expect("redirect"));
        assert_eq!(
            query.get("error").map(String::as_str),
            Some(error),
            "{overrides:?}"
        );
        assert_eq!(query.get("state").map(String::as_str), Some("s"));
        assert!(!query.contains_key("code"));
    }

    // Discovery and JWKS describe this issuer.
    let discovery: Value = p
        .client
        .get(format!(
            "{}/.well-known/openid-configuration",
            p.provider.issuer_url()
        ))
        .send()
        .await
        .expect("discovery")
        .json()
        .await
        .expect("discovery body");
    assert_eq!(discovery["issuer"], p.provider.issuer_url());
    assert_eq!(
        discovery["token_endpoint"],
        format!("{}/token", p.provider.issuer_url())
    );
    assert_eq!(
        discovery["code_challenge_methods_supported"],
        json!(["S256"])
    );
    let jwks: Value = p
        .client
        .get(format!("{}/jwks", p.provider.issuer_url()))
        .send()
        .await
        .expect("jwks")
        .json()
        .await
        .expect("jwks body");
    assert_eq!(jwks["keys"][0]["kty"], "EC");
    assert!(
        jwks["keys"][0].get("d").is_none(),
        "the private key is never served"
    );

    p.h.sign_in("provider-checks").await;
    p.finish().await;
}

// ---- the dev topology binary -------------------------------------------------

#[test]
fn the_dev_topology_prints_one_line_writes_only_the_ca_and_cleans_up() {
    let binary = env!("CARGO_BIN_EXE_inquello-dev-topology");
    let mut child = Command::new(binary)
        .arg("--exit-on-stdin-eof")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("spawn the topology");
    let mut stdout = BufReader::new(child.stdout.take().expect("stdout"));
    let mut line = String::new();
    stdout.read_line(&mut line).expect("read the line");
    let config: Value = serde_json::from_str(&line).expect("one JSON line");

    let keys: Vec<&str> = config
        .as_object()
        .expect("object")
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(
        keys,
        vec![
            "ca_path",
            "client_id",
            "issuer_label",
            "issuer_url",
            "service_url"
        ]
    );
    let service_url = config["service_url"].as_str().expect("service URL");
    let issuer_url = config["issuer_url"].as_str().expect("issuer URL");
    assert!(
        service_url.starts_with("https://127.0.0.1:"),
        "{service_url}"
    );
    assert!(issuer_url.starts_with("https://127.0.0.1:"), "{issuer_url}");
    assert_eq!(config["client_id"], "inquello-desktop-synthetic");

    let ca_path = std::path::PathBuf::from(config["ca_path"].as_str().expect("CA path"));
    let ca_dir = ca_path.parent().expect("CA dir").to_path_buf();
    let pem = std::fs::read_to_string(&ca_path).expect("CA file");
    assert!(pem.starts_with("-----BEGIN CERTIFICATE-----"));
    assert!(!pem.contains("PRIVATE KEY"));
    let entries: Vec<_> = std::fs::read_dir(&ca_dir)
        .expect("CA dir")
        .map(|entry| entry.expect("entry").file_name())
        .collect();
    assert_eq!(entries, vec![std::ffi::OsString::from("ca.pem")]);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(&ca_path)
            .expect("meta")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o644);
        let mode = std::fs::metadata(&ca_dir)
            .expect("meta")
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o755);
    }

    let runtime = tokio::runtime::Runtime::new().expect("runtime");
    runtime.block_on(async {
        let client = reqwest::Client::builder()
            .tls_built_in_root_certs(false)
            .add_root_certificate(reqwest::Certificate::from_pem(pem.as_bytes()).expect("CA"))
            .build()
            .expect("client");
        let capabilities: Value = client
            .get(format!("{service_url}/v1/capabilities"))
            .send()
            .await
            .expect("capabilities")
            .json()
            .await
            .expect("capabilities body");
        assert_eq!(capabilities["protocol_major"], 1);
        let discovery: Value = client
            .get(format!("{issuer_url}/.well-known/openid-configuration"))
            .send()
            .await
            .expect("discovery")
            .json()
            .await
            .expect("discovery body");
        assert_eq!(discovery["issuer"], issuer_url);
    });

    drop(child.stdin.take());
    let deadline = std::time::Instant::now() + Duration::from_secs(30);
    let status = loop {
        if let Some(status) = child.try_wait().expect("wait") {
            break status;
        }
        assert!(
            std::time::Instant::now() < deadline,
            "the topology did not stop"
        );
        std::thread::sleep(Duration::from_millis(50));
    };
    assert!(status.success(), "{status}");
    assert!(!ca_path.exists(), "the CA file was left behind");
    assert!(!ca_dir.exists(), "the CA directory was left behind");
}
