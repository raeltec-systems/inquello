//! The Story 1.18 I/O matrix at the domain level: the `execution` section,
//! the effective computation and the broad-mode command, against an
//! in-memory port with the same atomic compare-and-set contract as SQLite.

use super::*;
use crate::DomainError;
use crate::OperationId;
use crate::Revision;
use crate::StoreError;
use crate::Timestamp;
use crate::authorization::PolicyError;
use crate::authorization::WorkspacePolicy;
use crate::organise::Actor;
use crate::organise::PrincipalId;
use crate::organise::TaskId;
use crate::organise::WorkspaceId;
use crate::state::StateWriter;
use pretty_assertions::assert_eq;
use serde_json::Value;
use serde_json::json;
use std::collections::BTreeSet;
use std::collections::HashMap;
use std::pin::pin;
use std::sync::Mutex;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::task::Context;
use std::task::Poll;
use std::task::Waker;

fn block_on<F: std::future::Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut context = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut context) {
            return output;
        }
    }
}

fn roles() -> Value {
    json!([{ "id": "lead", "kind": "audit_team", "label": "Lead", "actions": ["read", "manage_membership"] }])
}

fn policy_with(execution: Value) -> Result<WorkspacePolicy, PolicyError> {
    WorkspacePolicy::from_value(
        &json!({ "policy_version": 1, "roles": roles(), "execution": execution }),
    )
}

fn permissive() -> ExecutionPolicy {
    ExecutionPolicy::from_value(&json!({
        "sandbox": "full_access",
        "approvals": ["on_request", "untrusted", "never"],
        "network": "allowed",
        "mcp_tools": "allowed",
        "extensions": "allowed",
        "allow_full_access": true,
        "allow_no_prompt": true,
    }))
    .unwrap_or_else(|error| panic!("{error}"))
}

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

fn workspace_id() -> WorkspaceId {
    WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}"))
}

fn layer(execution: Option<ExecutionPolicy>, revision: u64) -> WorkspaceLayer {
    WorkspaceLayer {
        workspace_id: workspace_id(),
        policy_revision: Revision::new(revision),
        authorization_epoch: Revision::new(7),
        execution,
    }
}

fn workspace_rule(revision: u64) -> SettingSource {
    SettingSource::WorkspacePolicy {
        revision: Revision::new(revision),
    }
}

// ---- the `execution` section ---------------------------------------------------

#[test]
fn a_policy_without_execution_keeps_none_and_round_trips() {
    let policy = WorkspacePolicy::from_value(&json!({ "policy_version": 1, "roles": roles() }))
        .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(policy.execution(), None);
    assert_eq!(policy.to_value().get("execution"), None);
}

#[test]
fn the_execution_section_round_trips_canonically() {
    let policy = policy_with(json!({
        "approvals": ["never", "on_request"],
        "sandbox": "full_access",
        "network": "allowed",
        "allow_no_prompt": true,
    }))
    .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(
        policy.to_value()["execution"],
        json!({
            "sandbox": "full_access",
            "approvals": ["on_request", "never"],
            "network": "allowed",
            "allow_no_prompt": true,
        })
    );
    let again =
        WorkspacePolicy::from_value(&policy.to_value()).unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(again, policy);
}

#[test]
fn unknown_fields_and_external_audit_attributes_are_refused() {
    assert_eq!(
        policy_with(json!({ "sandbox": "read_only", "hosted_sandbox": true })),
        Err(PolicyError::Malformed(
            "unknown field `hosted_sandbox` in the execution policy".to_string()
        ))
    );
    assert_eq!(
        policy_with(json!({ "client_independence": "x" })),
        Err(PolicyError::RouteNotAvailable(
            "client_independence".to_string()
        ))
    );
    assert_eq!(
        policy_with(json!({ "external_reviewer": true })),
        Err(PolicyError::RouteNotAvailable(
            "external_reviewer".to_string()
        ))
    );
}

#[test]
fn malformed_execution_values_are_refused() {
    for execution in [
        json!("read_only"),
        json!({ "sandbox": "danger" }),
        json!({ "approvals": "never" }),
        json!({ "approvals": ["sometimes"] }),
        json!({ "approvals": ["on_request", "on_request"] }),
        json!({ "approvals": ["never"] }),
        json!({ "approvals": [] }),
        json!({ "network": true }),
        json!({ "mcp_tools": "yes" }),
        json!({ "allow_no_prompt": "true" }),
        // Broad modes need their prerequisites.
        json!({ "allow_no_prompt": true }),
        json!({ "sandbox": "workspace_write", "allow_full_access": true }),
        json!({ "sandbox": "full_access", "approvals": ["on_request", "never"], "allow_no_prompt": true, "allow_full_access": true }),
        json!({ "sandbox": "full_access", "network": "allowed", "allow_full_access": true }),
    ] {
        assert!(
            matches!(
                policy_with(execution.clone()),
                Err(PolicyError::InvalidExecution(_))
            ),
            "{execution} must be refused"
        );
    }
}

// ---- the effective computation -------------------------------------------------

#[test]
fn no_policy_and_no_device_requirements_use_the_inquello_defaults() {
    let effective = effective_policy(
        &layer(None, 1),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    assert_eq!(effective.environment, Environment::LocalDevice);
    assert!(!effective.device_configured);
    let default = SettingSource::InquelloDefault;
    assert_eq!(
        effective.sandbox,
        Setting {
            value: SandboxLevel::WorkspaceWrite,
            source: default,
            restricted: true
        }
    );
    assert_eq!(
        effective.approval,
        Setting {
            value: ApprovalBehaviour::OnRequest,
            source: default,
            restricted: false
        }
    );
    for setting in [
        effective.network,
        effective.mcp_tools,
        effective.extensions,
        effective.full_access,
        effective.no_prompt,
    ] {
        assert_eq!(
            setting,
            Setting {
                value: false,
                source: default,
                restricted: true
            }
        );
    }
}

#[test]
fn an_empty_execution_section_is_attributed_to_the_defaults() {
    let effective = effective_policy(
        &layer(Some(ExecutionPolicy::default()), 3),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    assert_eq!(effective.sandbox.source, SettingSource::InquelloDefault);
    assert_eq!(effective.full_access.source, SettingSource::InquelloDefault);
}

#[test]
fn a_workspace_restriction_names_its_revision() {
    let execution =
        ExecutionPolicy::from_value(&json!({ "sandbox": "read_only", "allow_full_access": false }))
            .unwrap_or_else(|error| panic!("{error}"));
    let effective = effective_policy(
        &layer(Some(execution), 4),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    assert_eq!(
        effective.sandbox,
        Setting {
            value: SandboxLevel::ReadOnly,
            source: workspace_rule(4),
            restricted: true
        }
    );
    assert_eq!(
        effective.sandbox.source.to_string(),
        "Workspace policy, revision 4"
    );
    assert_eq!(effective.full_access.source, workspace_rule(4));
    // Fields the section does not name stay with the default.
    assert_eq!(effective.network.source, SettingSource::InquelloDefault);
}

#[test]
fn stricter_device_requirements_win_over_the_workspace() {
    let device = DeviceRequirements {
        sandbox_modes: Some(
            [SandboxLevel::ReadOnly, SandboxLevel::WorkspaceWrite]
                .into_iter()
                .collect(),
        ),
        approvals: Some([ApprovalBehaviour::OnRequest].into_iter().collect()),
    };
    let effective = effective_policy(
        &layer(Some(permissive()), 2),
        &device,
        &UserConfig::default(),
    );
    assert!(effective.device_configured);
    assert_eq!(
        effective.sandbox,
        Setting {
            value: SandboxLevel::WorkspaceWrite,
            source: SettingSource::DeviceRequirements,
            restricted: true
        }
    );
    assert_eq!(effective.approval.value, ApprovalBehaviour::OnRequest);
    assert_eq!(
        effective.full_access,
        Setting {
            value: false,
            source: SettingSource::DeviceRequirements,
            restricted: true
        }
    );
    assert_eq!(
        effective.no_prompt.source,
        SettingSource::DeviceRequirements
    );
}

#[test]
fn a_device_without_a_prompting_approval_fails_closed_to_untrusted() {
    let device = DeviceRequirements {
        sandbox_modes: None,
        approvals: Some(BTreeSet::from([ApprovalBehaviour::Never])),
    };
    let effective = effective_policy(&layer(None, 1), &device, &UserConfig::default());
    assert_eq!(
        effective.approval,
        Setting {
            value: ApprovalBehaviour::Untrusted,
            source: SettingSource::DeviceRequirements,
            restricted: true
        }
    );
}

#[test]
fn a_stricter_user_configuration_wins_where_it_is_stricter() {
    let user = UserConfig {
        sandbox: Some(SandboxLevel::ReadOnly),
        approval: Some(ApprovalBehaviour::Untrusted),
        network: Some(false),
    };
    let effective = effective_policy(
        &layer(Some(permissive()), 2),
        &DeviceRequirements::default(),
        &user,
    );
    assert_eq!(
        effective.sandbox,
        Setting {
            value: SandboxLevel::ReadOnly,
            source: SettingSource::UserConfig,
            restricted: true
        }
    );
    assert_eq!(effective.approval.source, SettingSource::UserConfig);
    assert_eq!(effective.network.source, SettingSource::UserConfig);
    // A more permissive user value changes nothing.
    let lax = UserConfig {
        sandbox: Some(SandboxLevel::FullAccess),
        approval: Some(ApprovalBehaviour::Never),
        network: Some(true),
    };
    let effective = effective_policy(&layer(None, 1), &DeviceRequirements::default(), &lax);
    assert_eq!(effective.sandbox.source, SettingSource::InquelloDefault);
    assert_eq!(effective.approval.value, ApprovalBehaviour::OnRequest);
    assert!(!effective.network.value);
}

#[test]
fn a_permissive_policy_permits_both_broad_modes() {
    let effective = effective_policy(
        &layer(Some(permissive()), 5),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    assert_eq!(
        effective.full_access,
        Setting {
            value: true,
            source: workspace_rule(5),
            restricted: false
        }
    );
    assert_eq!(
        effective.no_prompt,
        Setting {
            value: true,
            source: workspace_rule(5),
            restricted: false
        }
    );
    assert_eq!(check_permitted(&effective, BroadMode::FullAccess), Ok(()));
}

// ---- broad mode status and thread settings ---------------------------------------

#[test]
fn thread_settings_derive_only_from_the_policy_and_the_mode() {
    let open = effective_policy(
        &layer(Some(permissive()), 5),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    let standard = thread_settings(&open, BroadModeStatus::of(&open, BroadMode::Standard));
    assert_eq!(
        standard,
        ThreadSettings {
            sandbox: SandboxLevel::WorkspaceWrite,
            approval: ApprovalBehaviour::OnRequest,
            network: true,
            mode: BroadMode::Standard
        }
    );
    let full = thread_settings(&open, BroadModeStatus::of(&open, BroadMode::FullAccess));
    assert_eq!(
        full,
        ThreadSettings {
            sandbox: SandboxLevel::FullAccess,
            approval: ApprovalBehaviour::Never,
            network: true,
            mode: BroadMode::FullAccess
        }
    );
    let no_prompt = thread_settings(&open, BroadModeStatus::of(&open, BroadMode::NoPrompt));
    assert_eq!(no_prompt.approval, ApprovalBehaviour::Never);
    assert_eq!(no_prompt.sandbox, SandboxLevel::WorkspaceWrite);
}

#[test]
fn a_tightened_policy_suspends_the_recorded_mode() {
    let closed = effective_policy(
        &layer(None, 6),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    let status = BroadModeStatus::of(&closed, BroadMode::FullAccess);
    assert_eq!(
        status,
        BroadModeStatus::Suspended {
            mode: BroadMode::FullAccess,
            rule: SettingSource::InquelloDefault
        }
    );
    assert_eq!(status.effective_mode(), BroadMode::Standard);
    let settings = thread_settings(&closed, status);
    assert_eq!(settings.sandbox, SandboxLevel::WorkspaceWrite);
    assert_eq!(settings.approval, ApprovalBehaviour::OnRequest);
    assert_eq!(settings.mode, BroadMode::Standard);
}

#[test]
fn broad_mode_wording_is_never_review_or_approval() {
    let mut words = vec![BROAD_MODE_LABEL.to_string()];
    for mode in BroadMode::ALL {
        words.push(mode.title().to_string());
        words.push(mode.reach().to_string());
    }
    for text in words {
        let lower = text.to_lowercase();
        for forbidden in ["review", "approv", "accept", "professional"] {
            assert!(
                !lower.contains(forbidden),
                "{text:?} contains {forbidden:?}"
            );
        }
    }
    assert_eq!(
        BroadMode::FullAccess.reach(),
        "Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions."
    );
}

// ---- the broad-mode command --------------------------------------------------

#[derive(Default)]
struct FakeState {
    tasks: HashMap<TaskId, BroadModeTask>,
    records: Vec<BroadModeRecord>,
    receipts: HashMap<OperationId, BroadModeReceipt>,
}

#[derive(Default)]
struct FakeStore {
    state: Mutex<FakeState>,
    hide_next_lookup: AtomicBool,
}

impl FakeStore {
    fn with<T>(&self, f: impl FnOnce(&mut FakeState) -> T) -> T {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        f(&mut state)
    }

    fn add_task(&self, creator: Actor, workspace_id: WorkspaceId) -> TaskId {
        let task_id = TaskId::new_random();
        self.with(|s| {
            s.tasks.insert(
                task_id,
                BroadModeTask {
                    creator: creator.principal_id,
                    workspace_id,
                },
            )
        });
        task_id
    }

    fn revision_of(state: &FakeState, task_id: TaskId) -> Revision {
        state
            .records
            .iter()
            .filter(|r| r.task_id == task_id)
            .map(|r| r.revision)
            .max()
            .unwrap_or(Revision::ZERO)
    }
}

impl BroadModeStore for FakeStore {
    async fn find_broad_mode_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<BroadModeReceipt>, StoreError> {
        if self.hide_next_lookup.swap(false, Ordering::SeqCst) {
            return Ok(None);
        }
        Ok(self.with(|s| s.receipts.get(operation_id).cloned()))
    }

    async fn load_broad_mode_task(
        &self,
        task_id: TaskId,
    ) -> Result<Option<BroadModeTask>, StoreError> {
        Ok(self.with(|s| s.tasks.get(&task_id).copied()))
    }

    async fn load_broad_mode(
        &self,
        task_id: TaskId,
    ) -> Result<(Revision, Option<BroadModeRecord>), StoreError> {
        Ok(self.with(|s| {
            let revision = FakeStore::revision_of(s, task_id);
            let latest = s
                .records
                .iter()
                .find(|r| r.task_id == task_id && r.revision == revision)
                .cloned();
            (revision, latest)
        }))
    }

    async fn load_broad_mode_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> Result<Option<BroadModeRecord>, StoreError> {
        Ok(self.with(|s| {
            s.records
                .iter()
                .find(|r| r.task_id == task_id && r.revision == revision)
                .cloned()
        }))
    }

    async fn commit_broad_mode(&self, change: BroadModeChange) -> Result<(), StoreError> {
        self.with(|s| {
            if s.receipts.contains_key(&change.receipt.operation_id) {
                return Err(StoreError::DuplicateOperation {
                    operation_id: change.receipt.operation_id,
                });
            }
            let actual = FakeStore::revision_of(s, change.record.task_id);
            if actual != change.expected_revision {
                return Err(StoreError::RevisionConflict {
                    expected: change.expected_revision,
                    actual,
                });
            }
            s.records.push(change.record);
            s.receipts
                .insert(change.receipt.operation_id.clone(), change.receipt);
            Ok(())
        })
    }
}

struct FixedClock;

impl crate::Clock for FixedClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_unix_millis(1_000)
    }
}

fn actor() -> Actor {
    Actor {
        principal_id: PrincipalId::new_random(),
    }
}

fn set(task_id: TaskId, revision: u64, mode: BroadMode, operation: &str) -> SetBroadMode {
    SetBroadMode {
        operation_id: operation.to_string(),
        expected_revision: Revision::new(revision),
        task_id: task_id.to_string(),
        mode: mode.as_str().to_string(),
        confirmation: mode.is_broad().then(|| mode.reach().to_string()),
        writer: StateWriter::Human,
    }
}

fn open_policy() -> EffectivePolicy {
    effective_policy(
        &layer(Some(permissive()), 5),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

fn closed_policy() -> EffectivePolicy {
    effective_policy(
        &layer(None, 1),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

#[test]
fn a_permitted_confirmed_broad_mode_is_recorded_and_replayed() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, workspace_id());
    let policy = open_policy();
    let outcome = block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::FullAccess, "op-1"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    assert!(!outcome.replayed);
    assert_eq!(outcome.record.mode, BroadMode::FullAccess);
    assert_eq!(outcome.record.revision, Revision::new(1));
    assert_eq!(outcome.record.actor_ref, me.principal_id.to_string());
    let again = block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::FullAccess, "op-1"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    assert!(again.replayed);
    assert_eq!(again.record, outcome.record);
    let read = block_on(task_broad_mode(&store, me, &task.to_string()))
        .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(read.recorded(), BroadMode::FullAccess);
    assert_eq!(read.revision, Revision::new(1));
    // Back to standard needs no confirmation.
    let standard = block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &closed_policy(),
        set(task, 1, BroadMode::Standard, "op-2"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(standard.record.mode, BroadMode::Standard);
}

#[test]
fn a_broad_mode_the_policy_does_not_permit_is_refused_with_its_rule() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, workspace_id());
    for mode in [BroadMode::FullAccess, BroadMode::NoPrompt] {
        assert_eq!(
            block_on(set_broad_mode(
                &store,
                &FixedClock,
                me,
                &closed_policy(),
                set(task, 0, mode, "op-1")
            )),
            Err(DomainError::BroadModeNotPermitted {
                rule: SettingSource::InquelloDefault
            })
        );
    }
    let read_only = ExecutionPolicy::from_value(&json!({ "sandbox": "read_only" }))
        .unwrap_or_else(|error| panic!("{error}"));
    let policy = effective_policy(
        &layer(Some(read_only), 4),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    assert_eq!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &policy,
            set(task, 0, BroadMode::FullAccess, "op-1")
        )),
        Err(DomainError::BroadModeNotPermitted {
            rule: SettingSource::InquelloDefault
        })
    );
    let denied = ExecutionPolicy::from_value(&json!({ "allow_full_access": false }))
        .unwrap_or_else(|error| panic!("{error}"));
    let policy = effective_policy(
        &layer(Some(denied), 4),
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    let refusal = block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::FullAccess, "op-1"),
    ));
    assert_eq!(
        refusal,
        Err(DomainError::BroadModeNotPermitted {
            rule: workspace_rule(4)
        })
    );
    assert_eq!(
        refusal.err().map(|error| error.to_string()),
        Some("broad_mode_not_permitted: governed by Workspace policy, revision 4".to_string())
    );
    assert!(store.with(|s| s.records.is_empty()));
}

#[test]
fn a_broad_mode_without_its_confirmation_or_a_human_is_refused() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, workspace_id());
    let policy = open_policy();
    let mut command = set(task, 0, BroadMode::FullAccess, "op-1");
    command.confirmation = None;
    assert!(matches!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &policy,
            command.clone()
        )),
        Err(DomainError::InvalidCommand(_))
    ));
    command.confirmation = Some(BroadMode::NoPrompt.reach().to_string());
    assert!(matches!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &policy,
            command
        )),
        Err(DomainError::InvalidCommand(_))
    ));
    let mut by_runtime = set(task, 0, BroadMode::FullAccess, "op-1");
    by_runtime.writer = StateWriter::Runtime {
        reference: "codex".to_string(),
    };
    assert_eq!(
        block_on(set_broad_mode(&store, &FixedClock, me, &policy, by_runtime)),
        Err(DomainError::HumanActorRequired)
    );
    let mut standard = set(task, 0, BroadMode::Standard, "op-1");
    standard.confirmation = Some(BroadMode::Standard.reach().to_string());
    assert!(matches!(
        block_on(set_broad_mode(&store, &FixedClock, me, &policy, standard)),
        Err(DomainError::InvalidCommand(_))
    ));
    let mut unknown = set(task, 0, BroadMode::Standard, "op-1");
    unknown.mode = "approved".to_string();
    assert!(matches!(
        block_on(set_broad_mode(&store, &FixedClock, me, &policy, unknown)),
        Err(DomainError::InvalidCommand(_))
    ));
    assert!(store.with(|s| s.records.is_empty()));
}

#[test]
fn another_creator_sees_the_task_as_unknown() {
    let store = FakeStore::default();
    let me = actor();
    let other = actor();
    let task = store.add_task(me, workspace_id());
    let policy = open_policy();
    assert_eq!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            other,
            &policy,
            set(task, 0, BroadMode::FullAccess, "op-1")
        )),
        Err(DomainError::NotFound)
    );
    assert_eq!(
        block_on(task_broad_mode(&store, other, &task.to_string())),
        Err(DomainError::NotFound)
    );
    assert_eq!(
        block_on(task_broad_mode(
            &store,
            me,
            &TaskId::new_random().to_string()
        )),
        Err(DomainError::NotFound)
    );
}

#[test]
fn the_policy_must_be_the_tasks_own_workspace() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, WorkspaceId::new_random());
    assert_eq!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &open_policy(),
            set(task, 0, BroadMode::FullAccess, "op-1")
        )),
        Err(DomainError::WorkspaceMismatch)
    );
}

#[test]
fn stale_revisions_and_reused_operation_ids_are_refused() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, workspace_id());
    let policy = open_policy();
    block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::NoPrompt, "op-1"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &policy,
            set(task, 0, BroadMode::FullAccess, "op-2")
        )),
        Err(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1)
        })
    );
    assert!(matches!(
        block_on(set_broad_mode(
            &store,
            &FixedClock,
            me,
            &policy,
            set(task, 1, BroadMode::FullAccess, "op-1")
        )),
        Err(DomainError::OperationConflict { .. })
    ));
}

#[test]
fn a_concurrent_commit_of_the_same_operation_is_replayed() {
    let store = FakeStore::default();
    let me = actor();
    let task = store.add_task(me, workspace_id());
    let policy = open_policy();
    block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::NoPrompt, "op-1"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    // The first lookup misses, as if it ran before the other writer's commit;
    // the revision refusal then finds the receipt and replays it (R10).
    store.hide_next_lookup.store(true, Ordering::SeqCst);
    let outcome = block_on(set_broad_mode(
        &store,
        &FixedClock,
        me,
        &policy,
        set(task, 0, BroadMode::NoPrompt, "op-1"),
    ))
    .unwrap_or_else(|error| panic!("{error}"));
    assert!(outcome.replayed);
    assert_eq!(store.with(|s| s.records.len()), 1);
}
