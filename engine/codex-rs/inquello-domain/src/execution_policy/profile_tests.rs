//! The Story 1.19 I/O matrix at the domain level: `allowed_domains`, the
//! effective destinations and the tool profile derivation.

use super::*;
use crate::Revision;
use crate::authorization::PolicyError;
use crate::authorization::WorkspacePolicy;
use crate::organise::TaskId;
use crate::organise::WorkspaceId;
use pretty_assertions::assert_eq;
use serde_json::Value;
use serde_json::json;
use std::collections::BTreeSet;
use std::path::PathBuf;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const TASK: &str = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

fn policy_with(execution: Value) -> Result<WorkspacePolicy, PolicyError> {
    WorkspacePolicy::from_value(&json!({
        "policy_version": 1,
        "roles": [{ "id": "lead", "kind": "audit_team", "label": "Lead", "actions": ["read", "manage_membership"] }],
        "execution": execution,
    }))
}

fn execution(value: Value) -> ExecutionPolicy {
    ExecutionPolicy::from_value(&value).unwrap_or_else(|error| panic!("{error}"))
}

fn layer(execution: Option<ExecutionPolicy>) -> WorkspaceLayer {
    WorkspaceLayer {
        workspace_id: WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}")),
        policy_revision: Revision::new(4),
        authorization_epoch: Revision::new(2),
        execution,
    }
}

fn effective(execution: Option<ExecutionPolicy>) -> EffectivePolicy {
    effective_policy(
        &layer(execution),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

fn task_id() -> TaskId {
    TaskId::parse(TASK).unwrap_or_else(|error| panic!("{error}"))
}

fn folder() -> TaskFolder {
    TaskFolder::new(PathBuf::from(format!("/data/tasks/{TASK}")), task_id())
        .unwrap_or_else(|error| panic!("{error}"))
}

fn rule() -> SettingSource {
    SettingSource::WorkspacePolicy {
        revision: Revision::new(4),
    }
}

fn networked(domains: Value) -> ExecutionPolicy {
    execution(json!({ "network": "allowed", "allowed_domains": domains }))
}

// ---- `allowed_domains` -----------------------------------------------------------

#[test]
fn allowed_domains_accept_hosts_and_wildcards_and_round_trip() {
    let policy = policy_with(json!({
        "network": "allowed",
        "allowed_domains": ["example.org", "*.example.com", "**.registry.example", "localhost"],
    }))
    .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(
        policy.to_value()["execution"]["allowed_domains"],
        json!([
            "example.org",
            "*.example.com",
            "**.registry.example",
            "localhost"
        ])
    );
    let again =
        WorkspacePolicy::from_value(&policy.to_value()).unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(again, policy);
    // An empty list is valid and means no destination.
    assert!(policy_with(json!({ "allowed_domains": [] })).is_ok());
}

#[test]
fn a_scheme_port_path_or_malformed_domain_refuses_the_policy() {
    for (domain, why) in [
        ("https://example.org", "must not include a scheme"),
        ("example.org:443", "must not include a port"),
        ("example.org/api", "must not include a path"),
        ("user@example.org", "must be a host name only"),
        ("exa mple.org", "must be a host name only"),
        ("Example.org", "must be a lowercase host name"),
        ("*", "must be a lowercase host name"),
        ("*.org", "at least two labels"),
        ("-bad.example.org", "must be a lowercase host name"),
        ("bad..example.org", "must be a lowercase host name"),
        ("example.*.org", "must be a lowercase host name"),
    ] {
        match policy_with(json!({ "network": "allowed", "allowed_domains": [domain] })) {
            Err(PolicyError::InvalidExecution(message)) => {
                assert!(message.contains(why), "{domain}: {message}");
            }
            other => panic!("{domain} must be refused, got {other:?}"),
        }
    }
    for execution in [
        json!({ "network": "allowed", "allowed_domains": "example.org" }),
        json!({ "network": "allowed", "allowed_domains": [7] }),
        json!({ "network": "allowed", "allowed_domains": [""] }),
        json!({ "network": "allowed", "allowed_domains": ["example.org", "example.org"] }),
        // A listed destination needs network allowed.
        json!({ "allowed_domains": ["example.org"] }),
        json!({ "network": "denied", "allowed_domains": ["example.org"] }),
    ] {
        assert!(
            matches!(
                policy_with(execution.clone()),
                Err(PolicyError::InvalidExecution(_))
            ),
            "{execution} must be refused"
        );
    }
    let too_many: Vec<String> = (0..=MAX_ALLOWED_DOMAINS)
        .map(|n| format!("h{n}.example.org"))
        .collect();
    assert!(matches!(
        policy_with(json!({ "network": "allowed", "allowed_domains": too_many })),
        Err(PolicyError::InvalidExecution(_))
    ));
}

#[test]
fn listed_destinations_apply_only_while_network_is_allowed() {
    let listed = effective(Some(networked(json!(["example.org"]))));
    assert_eq!(
        listed.allowed_domains,
        Setting {
            value: vec!["example.org".to_string()],
            source: rule(),
            restricted: true,
        }
    );
    // No list: no destination, attributed to the default.
    let none = effective(Some(execution(json!({ "network": "allowed" }))));
    assert_eq!(none.allowed_domains.value, Vec::<String>::new());
    assert_eq!(none.allowed_domains.source, SettingSource::InquelloDefault);
    // The user's configuration denies network: the list does not apply.
    let user = effective_policy(
        &layer(Some(networked(json!(["example.org"])))),
        &DeviceRequirements::default(),
        &UserConfig {
            network: Some(false),
            ..UserConfig::default()
        },
    );
    assert_eq!(user.allowed_domains.value, Vec::<String>::new());
    assert_eq!(user.allowed_domains.source, SettingSource::UserConfig);
}

// ---- the tool profile ------------------------------------------------------------

#[test]
fn a_standard_task_reaches_its_folder_output_and_read_only_system() {
    let policy = effective(Some(networked(json!(["example.org"]))));
    let profile = tool_profile(&policy, BroadModeStatus::Standard, folder());
    assert!(profile.reach.bounded);
    assert_eq!(
        profile.reach.boundaries,
        vec![
            Boundary::WorkingFolder(FolderAccess::ReadWrite),
            Boundary::OutputFolder(FolderAccess::ReadWrite),
            Boundary::System,
        ]
    );
    assert_eq!(
        profile
            .reach
            .boundaries
            .iter()
            .map(|boundary| boundary.label())
            .collect::<Vec<_>>(),
        vec![
            "working folder (read/write)",
            "output folder",
            "system (read-only)"
        ]
    );
    assert_eq!(
        profile.writable_roots(),
        vec![
            PathBuf::from(format!("/data/tasks/{TASK}")),
            PathBuf::from(format!("/data/tasks/{TASK}/output")),
        ]
    );
    assert_eq!(
        profile.network_allowlist(),
        Some(&["example.org".to_string()][..])
    );
    assert_eq!(profile.reach.network_source, rule());
    assert!(profile.reach.writes());
}

#[test]
fn no_list_means_no_destination() {
    let profile = tool_profile(&effective(None), BroadModeStatus::Standard, folder());
    assert_eq!(profile.reach.network, NetworkReach::Listed(Vec::new()));
    assert_eq!(profile.reach.network_source, SettingSource::InquelloDefault);
}

#[test]
fn a_read_only_ceiling_makes_the_task_folder_read_only() {
    let policy = effective(Some(execution(json!({ "sandbox": "read_only" }))));
    let profile = tool_profile(&policy, BroadModeStatus::Standard, folder());
    assert!(profile.reach.bounded);
    assert_eq!(
        profile.reach.boundaries,
        vec![
            Boundary::WorkingFolder(FolderAccess::ReadOnly),
            Boundary::OutputFolder(FolderAccess::ReadOnly),
            Boundary::System,
        ]
    );
    assert_eq!(profile.writable_roots(), Vec::<PathBuf>::new());
    assert!(!profile.reach.writes());
    assert_eq!(
        Boundary::WorkingFolder(FolderAccess::ReadOnly).label(),
        "working folder (read-only)"
    );
}

fn permissive() -> ExecutionPolicy {
    execution(json!({
        "sandbox": "full_access",
        "approvals": ["on_request", "untrusted", "never"],
        "network": "allowed",
        "allowed_domains": ["example.org"],
        "allow_full_access": true,
        "allow_no_prompt": true,
    }))
}

#[test]
fn a_permitted_full_access_mode_states_its_true_reach() {
    let policy = effective(Some(permissive()));
    let status = BroadModeStatus::of(&policy, BroadMode::FullAccess);
    let profile = tool_profile(&policy, status, folder());
    assert!(!profile.reach.bounded);
    assert_eq!(profile.reach.boundaries, Vec::<Boundary>::new());
    assert_eq!(profile.reach.network, NetworkReach::Unrestricted);
    assert_eq!(profile.network_allowlist(), None);
    assert_eq!(profile.folders(), Vec::new());
    assert!(profile.reach.writes());
    // It agrees with the thread settings.
    assert_eq!(
        thread_settings(&policy, status).sandbox,
        SandboxLevel::FullAccess
    );
}

#[test]
fn no_prompt_and_a_suspended_full_access_stay_bounded() {
    let policy = effective(Some(permissive()));
    let no_prompt = tool_profile(
        &policy,
        BroadModeStatus::of(&policy, BroadMode::NoPrompt),
        folder(),
    );
    assert!(no_prompt.reach.bounded);
    assert_eq!(
        no_prompt.reach.network,
        NetworkReach::Listed(vec!["example.org".to_string()])
    );
    let closed = effective(None);
    let suspended = BroadModeStatus::of(&closed, BroadMode::FullAccess);
    assert!(matches!(suspended, BroadModeStatus::Suspended { .. }));
    let profile = tool_profile(&closed, suspended, folder());
    assert!(profile.reach.bounded);
    assert_eq!(profile.reach.network, NetworkReach::Listed(Vec::new()));
}

#[test]
fn a_device_limited_to_read_only_bounds_the_profile_too() {
    let device = DeviceRequirements {
        sandbox_modes: Some(BTreeSet::from([SandboxLevel::ReadOnly])),
        approvals: None,
    };
    let policy = effective_policy(&layer(None), &device, &UserConfig::default());
    let profile = tool_profile(&policy, BroadModeStatus::Standard, folder());
    assert_eq!(
        profile.reach.boundaries[0],
        Boundary::WorkingFolder(FolderAccess::ReadOnly)
    );
}

#[test]
fn the_task_folder_must_be_absolute_normalised_and_named_after_the_task() {
    for path in [
        format!("data/tasks/{TASK}"),
        format!("/data/../tasks/{TASK}"),
        format!("/data/./tasks/{TASK}"),
        "/data/tasks/another".to_string(),
        format!("/data/tasks/{TASK}/output"),
    ] {
        assert!(
            TaskFolder::new(PathBuf::from(&path), task_id()).is_err(),
            "{path} must be refused"
        );
    }
    let folder = folder();
    assert_eq!(folder.task_id(), task_id());
    assert_eq!(
        folder.output(),
        PathBuf::from(format!("/data/tasks/{TASK}/{TASK_OUTPUT_DIR}"))
    );
}
