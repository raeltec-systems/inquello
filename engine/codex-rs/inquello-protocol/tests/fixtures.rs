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
use inquello_protocol::workspace::AcceptInviteResponse;
use inquello_protocol::workspace::AccessCheckRequest;
use inquello_protocol::workspace::AccessCheckResponse;
use inquello_protocol::workspace::DenyReason;
use inquello_protocol::workspace::ExecutionPolicyView;
use inquello_protocol::workspace::ExecutionSection;
use inquello_protocol::workspace::RoleKind;
use inquello_protocol::workspace::RolesView;
use inquello_protocol::workspace::WorkspaceCommand;
use inquello_protocol::workspace::WorkspaceCommandEnvelope;
use inquello_protocol::workspace::WorkspacesView;
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

/// The Story 1.11 Workspace fixtures, under `fixtures/workspace/`.
const WORKSPACE_FIXTURES: &[&str] = &[
    "workspace/accept_invite_response.json",
    "workspace/access_check_requests.json",
    "workspace/access_check_response.json",
    "workspace/command_envelopes.json",
    "workspace/command_response.json",
    "workspace/execution_policy_view.json",
    "workspace/refusals.json",
    "workspace/policy.json",
    "workspace/roles_view.json",
    "workspace/workspaces_view.json",
];

/// Every entry of `dir`, as `prefix` + name, split into files and directories.
fn entries(dir: &std::path::Path, prefix: &str) -> (BTreeSet<String>, BTreeSet<String>) {
    let mut files = BTreeSet::new();
    let mut dirs = BTreeSet::new();
    for entry in std::fs::read_dir(dir).expect("fixtures dir") {
        let entry = entry.expect("entry");
        let name = format!("{prefix}{}", entry.file_name().to_string_lossy());
        if entry.file_type().expect("file type").is_dir() {
            dirs.insert(name);
        } else {
            files.insert(name);
        }
    }
    (files, dirs)
}

#[test]
fn every_fixture_file_is_covered() {
    let (top, dirs) = entries(&fixtures_dir(), "");
    let covered: BTreeSet<String> = FIXTURES.iter().map(ToString::to_string).collect();
    assert_eq!(top, covered);
    assert_eq!(dirs, BTreeSet::from(["workspace".to_string()]));
    let (workspace, nested) = entries(&fixtures_dir().join("workspace"), "workspace/");
    let covered: BTreeSet<String> = WORKSPACE_FIXTURES.iter().map(ToString::to_string).collect();
    assert_eq!(workspace, covered);
    assert!(nested.is_empty());
}

#[test]
fn workspace_fixtures_round_trip() {
    let view = round_trip::<WorkspacesView>("workspace/workspaces_view.json");
    assert_eq!(view.workspaces[0].kind, "internal_company");
    let roles = round_trip::<RolesView>("workspace/roles_view.json");
    assert!(
        roles
            .roles
            .iter()
            .all(|role| matches!(role.kind, RoleKind::AuditTeam | RoleKind::Reviewer))
    );
    round_trip::<AcceptInviteResponse>("workspace/accept_invite_response.json");
    let envelopes = round_trip::<Vec<WorkspaceCommandEnvelope>>("workspace/command_envelopes.json");
    let names: Vec<&str> = envelopes.iter().map(|e| e.payload.name()).collect();
    assert_eq!(
        names,
        [
            "issue_invite",
            "revoke_invite",
            "change_roles",
            "remove_member",
            "create_engagement",
            "add_engagement_member",
            "remove_engagement_member"
        ]
    );
    let response = round_trip::<CommandResponse>("workspace/command_response.json");
    assert_eq!(response.authorization_epoch, Some(Revision::new(4)));
    let checks = round_trip::<Vec<AccessCheckRequest>>("workspace/access_check_requests.json");
    assert_eq!(checks[0].resource, None);
    round_trip::<AccessCheckResponse>("workspace/access_check_response.json");
    let denied = round_trip::<Vec<ErrorBody>>("workspace/refusals.json");
    let expected: Vec<ErrorBody> = DenyReason::ALL
        .into_iter()
        .map(ErrorBody::refused)
        .collect();
    assert_eq!(denied, expected);
    let execution = round_trip::<ExecutionPolicyView>("workspace/execution_policy_view.json");
    assert_eq!(execution.authorization_epoch, Revision::new(5));
    assert!(execution.execution.is_some());
    // A policy without an `execution` section is `null`, and an empty section
    // serializes as an empty object.
    let mut absent = load("workspace/execution_policy_view.json");
    absent["execution"] = Value::Null;
    let parsed: ExecutionPolicyView =
        serde_json::from_value(absent.clone()).expect("null execution");
    assert_eq!(serde_json::to_value(&parsed).expect("serialize"), absent);
    assert_eq!(
        serde_json::to_value(ExecutionSection::default()).expect("serialize"),
        json!({})
    );
    // Unknown fields and values are refused.
    let mut unknown = load("workspace/execution_policy_view.json");
    unknown["execution"]["hosted_sandbox"] = json!(true);
    assert!(serde_json::from_value::<ExecutionPolicyView>(unknown).is_err());
    let mut bad = load("workspace/execution_policy_view.json");
    bad["execution"]["sandbox"] = json!("danger");
    assert!(serde_json::from_value::<ExecutionPolicyView>(bad).is_err());
    // The policy document is validated by the domain; here it is plain JSON.
    let policy = load("workspace/policy.json");
    assert_eq!(policy["policy_version"], json!(1));
}

#[test]
fn workspace_wire_types_refuse_guest_roles_unknown_commands_and_actor_claims() {
    let roles = load("workspace/roles_view.json");
    let mut guest = roles.clone();
    guest["roles"][0]["kind"] = json!("guest");
    assert!(serde_json::from_value::<RolesView>(guest).is_err());
    let mut action = roles;
    action["roles"][0]["actions"] = json!(["approve"]);
    assert!(serde_json::from_value::<RolesView>(action).is_err());

    let envelopes = load("workspace/command_envelopes.json");
    let base = envelopes[0].clone();
    let mutate = |f: &dyn Fn(&mut Value)| {
        let mut value = base.clone();
        f(&mut value);
        serde_json::from_value::<WorkspaceCommandEnvelope>(value).is_err()
    };
    assert!(mutate(&|v| v["actor"] = json!("someone-else")));
    assert!(mutate(&|v| {
        v.as_object_mut().expect("object").remove("workspace_id");
    }));
    assert!(mutate(
        &|v| v["payload"]["command"] = json!("create_workspace")
    ));
    assert!(mutate(&|v| v["payload"]["command"] = json!("grant")));
    assert!(mutate(&|v| v["payload"]["email"] = json!("a@b.invalid")));
    assert!(mutate(&|v| v["expected_revision"] = json!(0)));
    let parsed: WorkspaceCommandEnvelope = serde_json::from_value(base).expect("base parses");
    assert!(matches!(
        parsed.payload,
        WorkspaceCommand::IssueInvite { .. }
    ));

    let denied = load("workspace/refusals.json");
    let mut unknown = denied[0].clone();
    unknown["error"]["reason"] = json!("resource_missing");
    assert!(serde_json::from_value::<ErrorBody>(unknown).is_err());
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

#[test]
fn local_mcp_switch_round_trips_without_coercion() {
    for enabled in [false, true] {
        let value = json!({ "allow_local_mcp_servers": enabled });
        let parsed: ExecutionSection = serde_json::from_value(value.clone()).expect("boolean switch");
        assert_eq!(parsed.allow_local_mcp_servers, Some(enabled));
        assert_eq!(serde_json::to_value(parsed).expect("serialize switch"), value);
    }
    for invalid in [json!("true"), json!(1), json!([]), json!({})] {
        assert!(serde_json::from_value::<ExecutionSection>(json!({
            "allow_local_mcp_servers": invalid,
        })).is_err());
    }
}
