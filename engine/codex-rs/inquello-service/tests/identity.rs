//! Story 1.10a conformance: every I/O matrix row, against PostgreSQL 18 and the
//! in-process test issuer. Each test uses its own database and ends with
//! `Harness::finish`, which asserts that no credential issued during the test
//! appears in a receipt, an error body, a log line or a database row.
//!
//! Run with `INQUELLO_TEST_DATABASE_URL` set and `--features test-issuer`.

#![allow(
    clippy::expect_used,
    reason = "test helpers fail the test on any unexpected error"
)]

mod support;

use chrono::TimeDelta;
use inquello_protocol::command::CommandResponse;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::login::AbandonLoginResponse;
use inquello_protocol::login::SessionCredentials;
use inquello_protocol::session::MembershipsView;
use inquello_protocol::session::RevokeFamilyResponse;
use inquello_protocol::session::RevokeFamilyStatus;
use inquello_protocol::session::SessionView;
use inquello_service::ConfigError;
use inquello_service::Deployment;
use inquello_service::StartError;
use inquello_service::test_issuer::TestIssuer;
use jsonwebtoken::Algorithm;
use jsonwebtoken::Header;
use pretty_assertions::assert_eq;
use reqwest::StatusCode;
use serde_json::Value;
use serde_json::json;
use std::sync::Arc;
use support::CLIENT_ID;
use support::Harness;
use support::ManualClock;
use support::REDIRECT_URI;
use uuid::Uuid;

async fn session_view(h: &Harness, access: &str) -> SessionView {
    h.get("/v1/session", Some(access)).await.ok()
}

fn logout_envelope(epoch: &str, operation_id: &str, session_id: Uuid, expected: &str) -> Value {
    json!({
        "command_epoch": epoch,
        "operation_id": operation_id,
        "expected_revision": expected,
        "schema_version": 1,
        "payload": { "command": "logout", "session_id": session_id },
    })
}

/// Signs `subject` in on a second device: same principal, separate session.
async fn second_device(h: &Harness, subject: &str) -> SessionCredentials {
    h.sign_in(subject).await
}

#[tokio::test(flavor = "multi_thread")]
async fn postgres_server_is_version_18_or_later() {
    let h = Harness::start().await;
    let version = support::assert_postgres_18(&h.pool).await;
    assert!(version >= 180_000);
    h.sign_in("version-check").await;
    h.finish().await;
}

// Matrix: Sign-in.
#[tokio::test(flavor = "multi_thread")]
async fn sign_in_creates_a_session_and_consumes_the_transaction() {
    let h = Harness::start().await;
    let device_id = Uuid::new_v4();
    let transaction = h.create_transaction(device_id).await;
    assert_eq!(transaction.issuer, h.issuer.issuer());
    assert_eq!(transaction.redirect_uri, REDIRECT_URI);
    assert_eq!(transaction.expires_at, h.now() + TimeDelta::minutes(10));

    let token = h.sign(&h.valid_fixture("alice", &transaction));
    let credentials: SessionCredentials = h.bootstrap(&transaction, &token).await.ok();
    assert_eq!(
        credentials.access_expires_at,
        h.now() + TimeDelta::minutes(15)
    );
    assert_eq!(credentials.refresh_expires_at, h.now() + TimeDelta::days(1));
    assert_eq!(
        credentials.session_expires_at,
        h.now() + TimeDelta::days(30)
    );
    assert_ne!(
        credentials.access_credential,
        credentials.refresh_credential
    );

    let view = session_view(&h, credentials.access_credential.expose()).await;
    assert_eq!(view.session_id, credentials.session_id);
    assert_eq!(view.principal.principal_id, credentials.principal_id);
    assert_eq!(view.device_id, device_id);
    assert_eq!(view.issuer, h.issuer.issuer());
    assert_eq!(view.subject, "alice");
    assert_eq!(view.created_at, h.now());
    assert_eq!(view.last_authenticated_at, h.now());
    assert_eq!(view.revoked_at, None);
    assert_eq!(view.revision.get(), 1);
    assert_eq!(
        view.principal.email.as_deref(),
        Some("alice@synthetic.invalid")
    );

    let (reason, session_id): (Option<String>, Option<Uuid>) = sqlx::query_as(
        "SELECT consumed_reason, session_id FROM login_transactions WHERE login_transaction_id = $1",
    )
    .bind(transaction.login_transaction_id)
    .fetch_one(&h.pool)
    .await
    .expect("transaction row");
    assert_eq!(reason.as_deref(), Some("bootstrapped"));
    assert_eq!(session_id, Some(credentials.session_id));
    // Only hashes are stored.
    assert_eq!(
        h.count(
            "SELECT count(*) FROM session_credentials WHERE octet_length(credential_hash) = 32"
        )
        .await,
        2
    );
    h.finish().await;
}

// Matrix: Wrong issuer / audience / nonce (and every other token check).
#[tokio::test(flavor = "multi_thread")]
async fn a_token_failing_any_check_creates_no_session_and_leaves_the_transaction_open() {
    let h = Harness::start().await;
    let transaction = h.create_transaction(Uuid::new_v4()).await;
    let valid = h.valid_fixture("bob", &transaction);
    let now = h.now();
    let untrusted = TestIssuer::with_issuer("https://untrusted.inquello.invalid");

    let mut bad_tokens: Vec<(&str, String)> = vec![
        (
            "wrong issuer",
            h.sign(&valid.clone().with_issuer("https://other.inquello.invalid")),
        ),
        (
            "wrong audience",
            h.sign(&valid.clone().with_audience(&["someone-else"])),
        ),
        (
            "wrong nonce",
            h.sign(&valid.clone().with_nonce(Some("not-the-nonce"))),
        ),
        ("missing nonce", h.sign(&valid.clone().with_nonce(None))),
        (
            "wrong authorized party",
            h.sign(&valid.clone().with_authorized_party(Some("someone-else"))),
        ),
        (
            "several audiences without azp",
            h.sign(
                &valid
                    .clone()
                    .with_audience(&[CLIENT_ID, "other"])
                    .with_authorized_party(None),
            ),
        ),
        (
            "expired",
            h.sign(&valid.clone().expiring_at(now - TimeDelta::minutes(5))),
        ),
    ];
    // Signed by a key the service does not trust, under the trusted kid.
    let mut forged_header = Header::new(Algorithm::ES256);
    forged_header.kid = Some(h.issuer.kid().to_string());
    bad_tokens.push((
        "forged signature",
        untrusted.sign_with_header(&forged_header, &valid),
    ));
    // Unknown kid and no kid.
    bad_tokens.push(("unknown kid", untrusted.sign(&valid)));
    bad_tokens.push((
        "no kid",
        h.issuer
            .sign_with_header(&Header::new(Algorithm::ES256), &valid),
    ));
    // alg "none" with the claims of a valid token.
    let valid_token = h.sign(&valid);
    let mut parts = valid_token.split('.');
    let _header = parts.next();
    let payload = parts.next().expect("payload");
    bad_tokens.push(("alg none", format!("eyJhbGciOiJub25lIn0.{payload}.")));
    bad_tokens.push(("garbage", "not-a-jwt".to_string()));
    for (_, token) in &bad_tokens {
        h.remember(token);
    }

    for (what, token) in &bad_tokens {
        let response = h.bootstrap(&transaction, token).await;
        assert_eq!(response.status, StatusCode::UNAUTHORIZED, "{what}");
        response.assert_error(ErrorKind::Unauthenticated);
    }
    // Right token, wrong redirect URI or wrong proof.
    let mut body = h.bootstrap_body(&transaction, &valid_token);
    body["redirect_uri"] = json!("http://127.0.0.1:1/elsewhere");
    h.post("/v1/login/bootstrap", &body, None)
        .await
        .assert_error(ErrorKind::Unauthenticated);
    let mut body = h.bootstrap_body(&transaction, &valid_token);
    body["transaction_proof"] = json!("iqp_wrong");
    h.post("/v1/login/bootstrap", &body, None)
        .await
        .assert_error(ErrorKind::Unauthenticated);

    assert_eq!(h.count("SELECT count(*) FROM sessions").await, 0);
    assert_eq!(h.count("SELECT count(*) FROM principals").await, 0);
    assert_eq!(
        h.count("SELECT count(*) FROM login_transactions WHERE consumed_at IS NULL")
            .await,
        1
    );

    // The transaction is still open: the valid token now succeeds on it.
    let credentials: SessionCredentials = h.bootstrap(&transaction, &valid_token).await.ok();
    session_view(&h, credentials.access_credential.expose()).await;
    h.finish().await;
}

// Matrix: Replayed token.
#[tokio::test(flavor = "multi_thread")]
async fn a_replayed_token_is_rejected() {
    let h = Harness::start().await;
    let transaction = h.create_transaction(Uuid::new_v4()).await;
    let token = h.sign(&h.valid_fixture("carol", &transaction));
    h.bootstrap(&transaction, &token)
        .await
        .ok::<SessionCredentials>();

    // Same token, same transaction.
    h.bootstrap(&transaction, &token)
        .await
        .assert_error(ErrorKind::Unauthenticated);
    // Same token on a fresh transaction (its nonce differs).
    let fresh = h.create_transaction(Uuid::new_v4()).await;
    h.bootstrap(&fresh, &token)
        .await
        .assert_error(ErrorKind::Unauthenticated);

    assert_eq!(h.count("SELECT count(*) FROM sessions").await, 1);
    assert_eq!(h.count("SELECT count(*) FROM consumed_id_tokens").await, 1);
    h.finish().await;
}

// Matrix: Email collision.
#[tokio::test(flavor = "multi_thread")]
async fn a_new_subject_with_an_existing_email_gets_a_new_principal() {
    let h = Harness::start().await;
    let shared = Some("shared@synthetic.invalid");
    let alice = h.sign_in_with("alice", |f| f.with_email(shared)).await;
    let mallory = h.sign_in_with("mallory", |f| f.with_email(shared)).await;
    assert_ne!(alice.principal_id, mallory.principal_id);

    let view = session_view(&h, mallory.access_credential.expose()).await;
    assert_eq!(view.principal.principal_id, mallory.principal_id);
    assert_eq!(view.subject, "mallory");
    assert_eq!(
        view.principal.display_name.as_deref(),
        Some("Synthetic mallory")
    );
    let serialized = serde_json::to_string(&view).expect("view");
    assert!(!serialized.contains(&alice.principal_id.to_string()));
    assert!(!serialized.contains("alice"));

    // Signing in again as alice reaches alice's principal, keyed by (issuer, subject).
    let again = h
        .sign_in_with("alice", |f| f.with_email(Some("new@synthetic.invalid")))
        .await;
    assert_eq!(again.principal_id, alice.principal_id);
    let view = session_view(&h, again.access_credential.expose()).await;
    assert_eq!(
        view.principal.email.as_deref(),
        Some("new@synthetic.invalid")
    );
    assert_eq!(view.principal.revision.get(), 2);
    assert_eq!(h.count("SELECT count(*) FROM principals").await, 2);
    h.finish().await;
}

// Matrix: Refresh.
#[tokio::test(flavor = "multi_thread")]
async fn refresh_issues_a_new_pair_and_invalidates_the_old_one() {
    let h = Harness::start().await;
    let first = h.sign_in("dave").await;
    h.clock.advance(TimeDelta::minutes(1));
    let second: SessionCredentials = h.refresh(first.refresh_credential.expose()).await.ok();
    assert_eq!(second.session_id, first.session_id);
    assert_ne!(second.access_credential, first.access_credential);
    assert_ne!(second.refresh_credential, first.refresh_credential);
    // Refresh never extends the absolute session expiry.
    assert_eq!(second.session_expires_at, first.session_expires_at);

    h.get("/v1/session", Some(first.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    session_view(&h, second.access_credential.expose()).await;
    h.finish().await;
}

// Matrix: Family replay.
#[tokio::test(flavor = "multi_thread")]
async fn reusing_a_rotated_refresh_credential_revokes_the_family() {
    let h = Harness::start().await;
    let first = h.sign_in("erin").await;
    let second: SessionCredentials = h.refresh(first.refresh_credential.expose()).await.ok();

    h.refresh(first.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Every credential of the family, including the newest pair, is now blocked.
    h.get("/v1/session", Some(second.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.refresh(second.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::Unauthenticated);
    let reason: Option<String> = sqlx::query_scalar("SELECT revoked_reason FROM refresh_families")
        .fetch_one(&h.pool)
        .await
        .expect("family");
    assert_eq!(reason.as_deref(), Some("refresh_reuse"));
    assert_eq!(
        h.count("SELECT count(*) FROM sessions WHERE revoked_at IS NULL")
            .await,
        0
    );
    assert_eq!(
        h.count("SELECT count(*) FROM invalidation_events WHERE reason = 'refresh_reuse'")
            .await,
        1
    );
    // A fresh sign-in works.
    let fresh = h.sign_in("erin").await;
    assert_eq!(fresh.principal_id, first.principal_id);
    h.finish().await;
}

// The bounded family-revoke endpoint touches only one family.
#[tokio::test(flavor = "multi_thread")]
async fn the_family_revoke_endpoint_revokes_exactly_one_family() {
    let h = Harness::start().await;
    let laptop = h.sign_in("frank").await;
    let desktop = second_device(&h, "frank").await;
    let tablet = second_device(&h, "frank").await;

    let revoked: RevokeFamilyResponse = h
        .post(
            "/v1/session/refresh-family/revoke",
            &json!({ "refresh_credential": laptop.refresh_credential.expose() }),
            None,
        )
        .await
        .ok();
    assert_eq!(revoked.status, RevokeFamilyStatus::Revoked);
    h.get("/v1/session", Some(laptop.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    session_view(&h, desktop.access_credential.expose()).await;

    // Bearer form, with an empty body.
    let response = h
        .client
        .post(format!("{}/v1/session/refresh-family/revoke", h.base))
        .bearer_auth(desktop.access_credential.expose())
        .send()
        .await
        .expect("request");
    assert_eq!(response.status(), StatusCode::OK);
    h.get("/v1/session", Some(desktop.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    session_view(&h, tablet.access_credential.expose()).await;

    // An unknown credential proves nothing.
    h.post(
        "/v1/session/refresh-family/revoke",
        &json!({ "refresh_credential": "iqr_unknown" }),
        None,
    )
    .await
    .assert_error(ErrorKind::Unauthenticated);
    h.finish().await;
}

// Matrix: Expired / revoked session (and disabled principal).
#[tokio::test(flavor = "multi_thread")]
async fn expired_revoked_and_disabled_sessions_are_blocked() {
    let h = Harness::start().await;
    let grace = h.sign_in("grace").await;

    // Access expiry blocks; a current refresh still works.
    h.clock.advance(TimeDelta::minutes(15));
    h.get("/v1/session", Some(grace.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    let refreshed: SessionCredentials = h.refresh(grace.refresh_credential.expose()).await.ok();
    session_view(&h, refreshed.access_credential.expose()).await;

    // Refresh expiry blocks refresh.
    h.clock.advance(TimeDelta::days(1));
    h.refresh(refreshed.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Absolute session expiry blocks everything, even with a fresh refresh.
    let heidi = h.sign_in("heidi").await;
    let mut latest = heidi;
    for _ in 0..40 {
        h.clock.advance(TimeDelta::hours(23));
        let response = h.refresh(latest.refresh_credential.expose()).await;
        if response.status != StatusCode::OK {
            response.assert_error(ErrorKind::Unauthenticated);
            break;
        }
        latest = response.ok();
    }
    assert!(h.now() >= latest.session_expires_at);
    h.get("/v1/session", Some(latest.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Revoked by logout from another device.
    let ivan = h.sign_in("ivan").await;
    let ivan_phone = second_device(&h, "ivan").await;
    let epoch = h.command_epoch().await;
    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-revoke-phone", ivan_phone.session_id, "1"),
        Some(ivan.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    h.get("/v1/session", Some(ivan_phone.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.refresh(ivan_phone.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Disabled principal.
    sqlx::query("UPDATE principals SET status = 'disabled' WHERE principal_id = $1")
        .bind(ivan.principal_id)
        .execute(&h.pool)
        .await
        .expect("disable");
    h.get("/v1/session", Some(ivan.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.refresh(ivan.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::Unauthenticated);
    let transaction = h.create_transaction(Uuid::new_v4()).await;
    let token = h.sign(&h.valid_fixture("ivan", &transaction));
    h.bootstrap(&transaction, &token)
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Unknown and malformed credentials.
    h.get("/v1/session", Some("iqa_unknown"))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.get("/v1/session", None)
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.finish().await;
}

// Matrix: Receipt retry.
#[tokio::test(flavor = "multi_thread")]
async fn an_exact_logout_retry_returns_the_recorded_outcome_without_a_second_mutation() {
    let h = Harness::start().await;
    let laptop = h.sign_in("judy").await;
    let phone = second_device(&h, "judy").await;
    let epoch = h.command_epoch().await;
    let envelope = logout_envelope(&epoch, "op-logout-1", phone.session_id, "1");

    let first: CommandResponse = h
        .post(
            "/v1/session/commands",
            &envelope,
            Some(laptop.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(first.operation_id, "op-logout-1");
    assert_eq!(first.resource_id, phone.session_id);
    assert_eq!(first.revision.get(), 2);
    assert_eq!(first.authorization_epoch, None);

    let state = || async {
        (
            h.count("SELECT revision FROM sessions WHERE revoked_at IS NOT NULL")
                .await,
            h.count("SELECT count(*) FROM operation_receipts").await,
            h.count("SELECT count(*) FROM invalidation_events").await,
        )
    };
    let after_first = state().await;

    // Exact retry, also with the keys in a different order on the wire.
    let retry: CommandResponse = h
        .post(
            "/v1/session/commands",
            &envelope,
            Some(laptop.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(retry, first);
    let reordered = r#"{"payload":{"session_id":"SID","command":"logout"},"schema_version":1,"operation_id":"op-logout-1","expected_revision":"1","command_epoch":"EPOCH"}"#
        .replace("SID", &phone.session_id.to_string())
        .replace("EPOCH", &epoch);
    let response = h
        .client
        .post(format!("{}/v1/session/commands", h.base))
        .bearer_auth(laptop.access_credential.expose())
        .header("content-type", "application/json")
        .body(reordered)
        .send()
        .await
        .expect("request");
    assert_eq!(response.status(), StatusCode::OK);
    let reordered: CommandResponse = response.json().await.expect("response");
    assert_eq!(reordered, first);
    assert_eq!(state().await, after_first);

    // The receipt is keyed by the principal and holds no credential.
    let (scope_kind, scope_id, principal_id): (String, Uuid, Uuid) =
        sqlx::query_as("SELECT scope_kind, scope_id, principal_id FROM operation_receipts")
            .fetch_one(&h.pool)
            .await
            .expect("receipt");
    assert_eq!(scope_kind, "principal");
    assert_eq!(scope_id, laptop.principal_id);
    assert_eq!(principal_id, laptop.principal_id);
    h.finish().await;
}

// Matrix: Receipt conflict.
#[tokio::test(flavor = "multi_thread")]
async fn the_same_operation_id_with_a_different_payload_conflicts() {
    let h = Harness::start().await;
    let laptop = h.sign_in("ken").await;
    let phone = second_device(&h, "ken").await;
    let tablet = second_device(&h, "ken").await;
    let epoch = h.command_epoch().await;
    let bearer = Some(laptop.access_credential.expose());

    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-1", phone.session_id, "1"),
        bearer,
    )
    .await
    .ok::<CommandResponse>();
    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-1", tablet.session_id, "1"),
        bearer,
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-1", phone.session_id, "2"),
        bearer,
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    // Nothing happened to the tablet.
    session_view(&h, tablet.access_credential.expose()).await;

    // A stale expected revision is a conflict too, and writes nothing.
    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-2", phone.session_id, "1"),
        bearer,
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    assert_eq!(h.count("SELECT count(*) FROM operation_receipts").await, 1);
    h.finish().await;
}

// Matrix: Stale epoch.
#[tokio::test(flavor = "multi_thread")]
async fn an_old_or_unknown_command_epoch_is_rejected() {
    let h = Harness::start().await;
    let laptop = h.sign_in("leo").await;
    let phone = second_device(&h, "leo").await;
    let tablet = second_device(&h, "leo").await;
    let bearer = Some(laptop.access_credential.expose());
    assert_eq!(h.command_epoch().await, "1");

    // Unknown (future) epoch.
    h.post(
        "/v1/session/commands",
        &logout_envelope("2", "op-a", phone.session_id, "1"),
        bearer,
    )
    .await
    .assert_error(ErrorKind::UnsupportedContract);
    // Apply under epoch 1, then rotate the epoch (as after a restore).
    let applied: CommandResponse = h
        .post(
            "/v1/session/commands",
            &logout_envelope("1", "op-a", phone.session_id, "1"),
            bearer,
        )
        .await
        .ok();
    sqlx::query("UPDATE service_state SET command_epoch = 2")
        .execute(&h.pool)
        .await
        .expect("rotate epoch");
    assert_eq!(h.command_epoch().await, "2");

    // The old epoch is never replayed and never treated as fresh.
    for (operation_id, session_id) in [("op-a", phone.session_id), ("op-b", tablet.session_id)] {
        h.post(
            "/v1/session/commands",
            &logout_envelope("1", operation_id, session_id, "1"),
            bearer,
        )
        .await
        .assert_error(ErrorKind::UnsupportedContract);
    }
    session_view(&h, tablet.access_credential.expose()).await;

    // An unsupported schema version is refused as well.
    let mut envelope = logout_envelope("2", "op-c", tablet.session_id, "1");
    envelope["schema_version"] = json!(2);
    h.post("/v1/session/commands", &envelope, bearer)
        .await
        .assert_error(ErrorKind::UnsupportedContract);
    // Malformed envelopes (actor field, unknown command) are refused.
    let mut envelope = logout_envelope("2", "op-c", tablet.session_id, "1");
    envelope["actor"] = json!(phone.principal_id);
    h.post("/v1/session/commands", &envelope, bearer)
        .await
        .assert_error(ErrorKind::UnsupportedContract);

    // The current epoch works.
    let current: CommandResponse = h
        .post(
            "/v1/session/commands",
            &logout_envelope("2", "op-c", tablet.session_id, "1"),
            bearer,
        )
        .await
        .ok();
    assert_ne!(current.receipt_id, applied.receipt_id);
    h.finish().await;
}

// Errors never confirm another principal's resource exists.
#[tokio::test(flavor = "multi_thread")]
async fn logout_of_a_foreign_or_unknown_session_is_denied_identically() {
    let h = Harness::start().await;
    let mia = h.sign_in("mia").await;
    let nick = h.sign_in("nick").await;
    let epoch = h.command_epoch().await;
    let bearer = Some(mia.access_credential.expose());

    let foreign = h
        .post(
            "/v1/session/commands",
            &logout_envelope(&epoch, "op-x", nick.session_id, "1"),
            bearer,
        )
        .await;
    let unknown = h
        .post(
            "/v1/session/commands",
            &logout_envelope(&epoch, "op-y", Uuid::new_v4(), "1"),
            bearer,
        )
        .await;
    foreign.assert_error(ErrorKind::Denied);
    unknown.assert_error(ErrorKind::Denied);
    assert_eq!(foreign.body, unknown.body);
    session_view(&h, nick.access_credential.expose()).await;

    // Self-logout works and blocks the caller's own session afterwards.
    let own: CommandResponse = h
        .post(
            "/v1/session/commands",
            &logout_envelope(&epoch, "op-z", mia.session_id, "1"),
            bearer,
        )
        .await
        .ok();
    assert_eq!(own.resource_id, mia.session_id);
    h.get("/v1/session", bearer)
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.finish().await;
}

// Matrix: Authority unavailable.
#[tokio::test(flavor = "multi_thread")]
async fn a_protected_request_is_blocked_while_the_database_is_down() {
    let h = Harness::start().await;
    let olivia = h.sign_in("olivia").await;
    let phone = second_device(&h, "olivia").await;
    let epoch = h.command_epoch().await;
    session_view(&h, olivia.access_credential.expose()).await;

    h.db.take_down().await;
    let bearer = Some(olivia.access_credential.expose());
    h.get("/v1/session", bearer)
        .await
        .assert_error(ErrorKind::DependencyUnavailable);
    h.get("/v1/memberships", bearer)
        .await
        .assert_error(ErrorKind::DependencyUnavailable);
    h.post(
        "/v1/session/commands",
        &logout_envelope(&epoch, "op-down", phone.session_id, "1"),
        bearer,
    )
    .await
    .assert_error(ErrorKind::DependencyUnavailable);
    h.refresh(olivia.refresh_credential.expose())
        .await
        .assert_error(ErrorKind::DependencyUnavailable);
    h.get("/v1/capabilities", None)
        .await
        .assert_error(ErrorKind::DependencyUnavailable);

    // Recovery resolves authority afresh; nothing was cached or applied.
    h.db.bring_up().await;
    session_view(&h, olivia.access_credential.expose()).await;
    session_view(&h, phone.access_credential.expose()).await;
    assert_eq!(h.count("SELECT count(*) FROM operation_receipts").await, 0);
    h.finish().await;
}

// Matrix: Test issuer in production.
#[tokio::test(flavor = "multi_thread")]
async fn a_production_config_naming_the_test_issuer_refuses_to_start() {
    let h = Harness::start().await;
    let issuer = TestIssuer::new();
    let clock = Arc::new(ManualClock::new());

    let mut config = support::synthetic_config(&issuer, h.db.options());
    config.deployment = Deployment::Production;
    let error = inquello_service::start(config, clock.clone())
        .await
        .err()
        .expect("production refuses the test issuer");
    assert!(
        matches!(&error, StartError::Config(ConfigError::TestIssuerRefused { issuer: i }) if i == issuer.issuer()),
        "{error:?}"
    );

    // Also when the test key is presented under another issuer URL.
    let mut config = support::synthetic_config(&issuer, h.db.options());
    config.deployment = Deployment::Production;
    config.issuers[0].issuer = "https://idp.example.com".to_string();
    let error = inquello_service::start(config, clock.clone())
        .await
        .err()
        .expect("production refuses a test key");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::TestIssuerRefused { .. })
    ));

    // Config is refused before any database work: an unreachable database
    // does not change the answer.
    let mut config = support::synthetic_config(
        &issuer,
        sqlx::postgres::PgConnectOptions::new()
            .host("127.0.0.1")
            .port(1),
    );
    config.deployment = Deployment::Production;
    let error = inquello_service::start(config, clock.clone())
        .await
        .err()
        .expect("refused");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::TestIssuerRefused { .. })
    ));

    // A non-loopback bind is refused without TLS.
    let mut config = support::synthetic_config(&issuer, h.db.options());
    config.bind = "0.0.0.0:0".parse().expect("addr");
    let error = inquello_service::start(config, clock.clone())
        .await
        .err()
        .expect("non-loopback refused");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::NonLoopbackBind { .. })
    ));

    // Lifetimes are explicit and validated.
    let mut config = support::synthetic_config(&issuer, h.db.options());
    config.lifetimes.access = std::time::Duration::ZERO;
    let error = inquello_service::start(config, clock)
        .await
        .err()
        .expect("zero lifetime refused");
    assert!(matches!(
        error,
        StartError::Config(ConfigError::InvalidLifetime { .. })
    ));

    h.sign_in("production-check").await;
    h.finish().await;
}

// Memberships are displayable revisions from the fixture-seeded table.
#[tokio::test(flavor = "multi_thread")]
async fn memberships_are_returned_as_displayable_revisions_for_the_caller_only() {
    let h = Harness::start().await;
    let paul = h.sign_in("paul").await;
    let quinn = h.sign_in("quinn").await;
    let workspace_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO memberships (principal_id, workspace_id, workspace_kind, role, status, revision) \
         VALUES ($1, $2, 'internal_company', 'member', 'active', 3)",
    )
    .bind(paul.principal_id)
    .bind(workspace_id)
    .execute(&h.pool)
    .await
    .expect("seed membership");

    let view: MembershipsView = h
        .get("/v1/memberships", Some(paul.access_credential.expose()))
        .await
        .ok();
    assert_eq!(view.principal_id, paul.principal_id);
    assert_eq!(view.memberships.len(), 1);
    assert_eq!(view.memberships[0].workspace_id, workspace_id);
    assert_eq!(view.memberships[0].revision.get(), 3);

    let response = h
        .get("/v1/memberships", Some(quinn.access_credential.expose()))
        .await;
    assert_eq!(response.body["memberships"], json!([]));
    h.finish().await;
}

// Login transactions are allowlisted, expiring and abandonable.
#[tokio::test(flavor = "multi_thread")]
async fn login_transactions_are_allowlisted_expiring_and_abandonable() {
    let h = Harness::start().await;
    for (issuer, client, redirect) in [
        ("https://other.inquello.invalid", CLIENT_ID, REDIRECT_URI),
        (h.issuer.issuer(), "other-client", REDIRECT_URI),
        (h.issuer.issuer(), CLIENT_ID, "http://127.0.0.1:9/other"),
    ] {
        h.post(
            "/v1/login/transactions",
            &json!({"issuer": issuer, "client_id": client, "redirect_uri": redirect, "device_id": Uuid::new_v4()}),
            None,
        )
        .await
        .assert_error(ErrorKind::Denied);
    }

    // Expired transaction.
    let expiring = h.create_transaction(Uuid::new_v4()).await;
    h.clock.advance(TimeDelta::minutes(10));
    let fresh_token = h.sign(&h.valid_fixture("rita", &expiring));
    h.bootstrap(&expiring, &fresh_token)
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Abandon an open transaction: it can no longer bootstrap.
    let open = h.create_transaction(Uuid::new_v4()).await;
    let abandon = json!({
        "login_transaction_id": open.login_transaction_id,
        "transaction_proof": open.transaction_proof.expose(),
    });
    let response: AbandonLoginResponse = h.post("/v1/login/abandon", &abandon, None).await.ok();
    assert_eq!(response.login_transaction_id, open.login_transaction_id);
    let token = h.sign(&h.valid_fixture("rita", &open));
    h.bootstrap(&open, &token)
        .await
        .assert_error(ErrorKind::Unauthenticated);

    // Abandon after a (lost) bootstrap response: the created session is revoked.
    let used = h.create_transaction(Uuid::new_v4()).await;
    let token = h.sign(&h.valid_fixture("rita", &used));
    let lost: SessionCredentials = h.bootstrap(&used, &token).await.ok();
    let abandon = json!({
        "login_transaction_id": used.login_transaction_id,
        "transaction_proof": used.transaction_proof.expose(),
    });
    h.post("/v1/login/abandon", &abandon, None)
        .await
        .ok::<AbandonLoginResponse>();
    h.get("/v1/session", Some(lost.access_credential.expose()))
        .await
        .assert_error(ErrorKind::Unauthenticated);
    h.finish().await;
}
