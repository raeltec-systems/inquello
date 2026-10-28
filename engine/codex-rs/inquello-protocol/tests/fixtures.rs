//! Conformance fixtures: every JSON file under `fixtures/` parses into its wire type
//! and serializes back to the same JSON value, and malformed variants are refused.

#![allow(
    clippy::expect_used,
    reason = "test helpers fail the test on any unexpected error"
)]

use inquello_protocol::CommandEpoch;
use inquello_protocol::Revision;
use inquello_protocol::command::Capabilities;
use inquello_protocol::command::CommandResponse;
use inquello_protocol::command::SessionCommand;
use inquello_protocol::command::SessionCommandEnvelope;
use inquello_protocol::error::ErrorBody;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::login::AbandonLoginRequest;
use inquello_protocol::login::AbandonLoginResponse;
use inquello_protocol::login::BootstrapRequest;
use inquello_protocol::login::CreateLoginTransactionRequest;
use inquello_protocol::login::Credential;
use inquello_protocol::login::LoginTransaction;
use inquello_protocol::login::SessionCredentials;
use inquello_protocol::session::MembershipsView;
use inquello_protocol::session::RefreshRequest;
use inquello_protocol::session::RevokeFamilyRequest;
use inquello_protocol::session::RevokeFamilyResponse;
use inquello_protocol::session::SessionView;
use pretty_assertions::assert_eq;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;
use serde_json::json;
use std::collections::BTreeSet;
use std::path::PathBuf;

fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures")
}

fn load(name: &str) -> Value {
    let path = fixtures_dir().join(name);
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("read {}: {error}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|error| panic!("parse {name}: {error}"))
}

/// Parses `name` as `T` and asserts it re-serializes to the identical JSON value.
fn round_trip<T: Serialize + DeserializeOwned>(name: &str) -> T {
    let fixture = load(name);
    let parsed: T = serde_json::from_value(fixture.clone())
        .unwrap_or_else(|error| panic!("{name} does not match its type: {error}"));
    let back = serde_json::to_value(&parsed).expect("serialize");
    assert_eq!(back, fixture, "{name} did not round-trip");
    parsed
}

const FIXTURES: &[&str] = &[
    "abandon_login_request.json",
    "abandon_login_response.json",
    "bootstrap_request.json",
    "capabilities.json",
    "command_envelope_logout.json",
    "command_response.json",
    "errors.json",
    "login_transaction.json",
    "login_transaction_request.json",
    "memberships_view.json",
    "refresh_request.json",
    "revoke_family_request.json",
    "revoke_family_request_bearer.json",
    "revoke_family_response.json",
    "session_credentials.json",
    "session_view.json",
];

#[test]
fn every_fixture_file_is_covered() {
    let on_disk: BTreeSet<String> = std::fs::read_dir(fixtures_dir())
        .expect("fixtures dir")
        .map(|entry| {
            entry
                .expect("entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    let covered: BTreeSet<String> = FIXTURES.iter().map(ToString::to_string).collect();
    assert_eq!(on_disk, covered);
}

#[test]
fn sc1_fixtures_round_trip() {
    round_trip::<CreateLoginTransactionRequest>("login_transaction_request.json");
    round_trip::<LoginTransaction>("login_transaction.json");
    round_trip::<BootstrapRequest>("bootstrap_request.json");
    round_trip::<SessionCredentials>("session_credentials.json");
    round_trip::<AbandonLoginRequest>("abandon_login_request.json");
    round_trip::<AbandonLoginResponse>("abandon_login_response.json");
    round_trip::<RefreshRequest>("refresh_request.json");
    let bearer = round_trip::<RevokeFamilyRequest>("revoke_family_request_bearer.json");
    assert_eq!(bearer.refresh_credential, None);
    round_trip::<RevokeFamilyRequest>("revoke_family_request.json");
    round_trip::<RevokeFamilyResponse>("revoke_family_response.json");
    let view = round_trip::<SessionView>("session_view.json");
    assert_eq!(view.revoked_at, None);
    round_trip::<MembershipsView>("memberships_view.json");
}

#[test]
fn sc2_fixtures_round_trip() {
    let capabilities = round_trip::<Capabilities>("capabilities.json");
    assert_eq!(capabilities.command_epoch, CommandEpoch::new(1));
    let envelope = round_trip::<SessionCommandEnvelope>("command_envelope_logout.json");
    assert_eq!(envelope.expected_revision, Revision::new(1));
    assert!(matches!(envelope.payload, SessionCommand::Logout { .. }));
    let response = round_trip::<CommandResponse>("command_response.json");
    assert_eq!(response.authorization_epoch, None);
}

#[test]
fn error_fixture_lists_every_kind_with_its_fixed_message() {
    let bodies = round_trip::<Vec<ErrorBody>>("errors.json");
    let expected: Vec<ErrorBody> = ErrorKind::ALL.into_iter().map(ErrorBody::new).collect();
    assert_eq!(bodies, expected);
}

#[test]
fn envelopes_refuse_unknown_fields_commands_and_actor_claims() {
    let base = load("command_envelope_logout.json");
    let mutate = |f: &dyn Fn(&mut Value)| {
        let mut value = base.clone();
        f(&mut value);
        serde_json::from_value::<SessionCommandEnvelope>(value).is_err()
    };
    assert!(
        mutate(&|v| v["actor"] = json!("someone-else")),
        "actor field"
    );
    assert!(mutate(
        &|v| v["workspace_id"] = json!("5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e")
    ));
    assert!(mutate(
        &|v| v["payload"]["command"] = json!("delete_everything")
    ));
    assert!(
        mutate(&|v| v["payload"]["principal_id"] = json!("x")),
        "extra payload field"
    );
    assert!(
        mutate(&|v| v["expected_revision"] = json!(1)),
        "numeric revision"
    );
    assert!(
        mutate(&|v| v["expected_revision"] = json!("01")),
        "non-canonical revision"
    );
    assert!(mutate(&|v| v["command_epoch"] = json!("-1")));
    assert!(mutate(&|v| {
        v.as_object_mut().expect("object").remove("operation_id");
    }));
}

#[test]
fn credential_debug_output_is_redacted() {
    let request: SessionCredentials =
        serde_json::from_value(load("session_credentials.json")).expect("fixture parses");
    let debug = format!("{request:?}");
    assert!(!debug.contains("iqa_FIXTURE"), "{debug}");
    assert!(!debug.contains("iqr_FIXTURE"), "{debug}");
    assert_eq!(
        format!("{:?}", Credential::new("secret")),
        "Credential(<redacted>)"
    );
}
