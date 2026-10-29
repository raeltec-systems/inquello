//! The Story 1.20 matrix against a real SQLite working store in a temp
//! directory: a person's rules, permission requests and decisions, reopen,
//! privacy, single use, no state bleed into the Story 1.15 dimensions, and
//! the schema's own guards.

use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::DomainError;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::execution_policy::BroadModeStatus;
use inquello_domain::execution_policy::CommandEvaluation;
use inquello_domain::execution_policy::DECIDE_PERMISSION_COMMAND;
use inquello_domain::execution_policy::DecidePermission;
use inquello_domain::execution_policy::Decider;
use inquello_domain::execution_policy::DeciderKind;
use inquello_domain::execution_policy::DeviceRequirements;
use inquello_domain::execution_policy::ExecutionPolicy;
use inquello_domain::execution_policy::PermissionDecision;
use inquello_domain::execution_policy::PermissionDecisionChange;
use inquello_domain::execution_policy::PermissionOutcome;
use inquello_domain::execution_policy::PermissionReceipt;
use inquello_domain::execution_policy::PermissionStore;
use inquello_domain::execution_policy::RequestPermission;
use inquello_domain::execution_policy::RequestStatus;
use inquello_domain::execution_policy::RuleDecision;
use inquello_domain::execution_policy::RuleSource;
use inquello_domain::execution_policy::SetUserRules;
use inquello_domain::execution_policy::UserConfig;
use inquello_domain::execution_policy::UserRuleInput;
use inquello_domain::execution_policy::WorkspaceLayer;
use inquello_domain::execution_policy::decide_permission;
use inquello_domain::execution_policy::effective_policy;
use inquello_domain::execution_policy::effective_rules;
use inquello_domain::execution_policy::evaluate_command;
use inquello_domain::execution_policy::pending_requests;
use inquello_domain::execution_policy::permission_request;
use inquello_domain::execution_policy::request_permission;
use inquello_domain::execution_policy::set_user_rules;
use inquello_domain::execution_policy::use_permission;
use inquello_domain::execution_policy::user_rules;
use inquello_domain::organise::Actor;
use inquello_domain::organise::CreateTask;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::PermissionRequestId;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::Task;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::organise::create_task;
use inquello_domain::state::RecordTaskState;
use inquello_domain::state::StateDimension;
use inquello_domain::state::StateWriter;
use inquello_domain::state::record_task_state;
use inquello_domain::state::task_states;
use pretty_assertions::assert_eq;
use tempfile::TempDir;
use uuid::Uuid;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

async fn open(dir: &TempDir) -> SqliteWorkingStore {
    SqliteWorkingStore::open(&dir.path().join("working.sqlite"), &[])
        .await
        .unwrap_or_else(|error| panic!("open store: {error}"))
}

fn actor(n: u8) -> Actor {
    Actor {
        principal_id: PrincipalId::from_uuid(Uuid::from_bytes([n; 16])),
    }
}

fn ok<T>(result: Result<T, DomainError>) -> T {
    result.unwrap_or_else(|error| panic!("command failed: {error}"))
}

fn words(command: &[&str]) -> Vec<String> {
    command.iter().map(|word| (*word).to_string()).collect()
}

async fn new_task(store: &SqliteWorkingStore, creator: Actor) -> Task {
    let outcome = ok(create_task(
        store,
        &SystemClock,
        creator,
        CreateTask {
            operation_id: format!("task-{}", Uuid::new_v4()),
            expected_revision: Revision::ZERO,
            workspace_id: WORKSPACE.to_string(),
            engagement_id: None,
            folder_id: None,
            title: "Untitled thread".to_string(),
        },
    )
    .await);
    match outcome.record {
        OrganiseRecord::Task(task) => task,
        other => panic!("expected a Task, got {other:?}"),
    }
}

/// The evaluation of `command` under a Workspace prompt rule on its first word.
fn prompt(command: &[&str]) -> CommandEvaluation {
    let policy = effective_policy(
        &WorkspaceLayer {
            workspace_id: WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}")),
            policy_revision: Revision::new(3),
            authorization_epoch: Revision::new(1),
            execution: Some(
                ExecutionPolicy::from_value(&serde_json::json!({
                    "command_rules": [{ "prefix": [command[0]], "decision": "prompt" }],
                }))
                .unwrap_or_else(|error| panic!("{error}")),
            ),
        },
        &DeviceRequirements::default(),
        &UserConfig::default(),
    );
    let rules = effective_rules(&policy, &[], Revision::ZERO);
    evaluate_command(
        &words(command),
        &rules,
        &[true],
        &policy,
        BroadModeStatus::Standard,
    )
}

async fn ask(
    store: &SqliteWorkingStore,
    me: Actor,
    task: &Task,
    command: &[&str],
) -> PermissionRequestId {
    let request_id = PermissionRequestId::from_uuid(Uuid::new_v4());
    ok(request_permission(
        store,
        &SystemClock,
        me,
        RequestPermission {
            operation_id: format!("ask-{request_id}"),
            request_id: request_id.to_string(),
            task_id: task.task_id.to_string(),
            origin: "tools_exec".to_string(),
            evaluation: prompt(command),
            ttl_ms: 600_000,
        },
    )
    .await);
    request_id
}

fn decide(
    id: &str,
    request: PermissionRequestId,
    outcome: &str,
    decider: Decider,
) -> DecidePermission {
    DecidePermission {
        operation_id: id.to_string(),
        expected_revision: Revision::new(1),
        request_id: request.to_string(),
        outcome: outcome.to_string(),
        decider,
    }
}

#[tokio::test]
async fn requests_and_decisions_survive_a_reopen_and_are_used_once() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let me = actor(1);
    let (task, request) = {
        let store = open(&dir).await;
        let task = new_task(&store, me).await;
        let request = ask(&store, me, &task, &["git", "push", "origin", "main"]).await;
        (task, request)
    };
    let store = open(&dir).await;
    let read = ok(permission_request(&store, me, &request.to_string()).await);
    assert_eq!(read.evaluation, prompt(&["git", "push", "origin", "main"]));
    assert_eq!(read.status(read.created_at), RequestStatus::Pending);
    let pending =
        ok(pending_requests(&store, me, Some(&task.task_id.to_string()), read.created_at).await);
    assert_eq!(pending.len(), 1);
    let allowed = ok(decide_permission(
        &store,
        &SystemClock,
        me,
        decide("op-allow", request, "allowed", Decider::Human),
    )
    .await);
    let decision = allowed
        .request
        .decision
        .clone()
        .unwrap_or_else(|| panic!("no decision"));
    assert_eq!(
        (decision.outcome, decision.actor_kind),
        (PermissionOutcome::Allowed, DeciderKind::Human)
    );
    let reread = ok(permission_request(&store, me, &request.to_string()).await);
    assert_eq!(reread.decision, Some(decision));
    let command = words(&["git", "push", "origin", "main"]);
    ok(use_permission(
        &store,
        &SystemClock,
        me,
        &request.to_string(),
        task.task_id,
        &command,
    )
    .await);
    assert_eq!(
        use_permission(
            &store,
            &SystemClock,
            me,
            &request.to_string(),
            task.task_id,
            &command
        )
        .await,
        Err(DomainError::PermissionNotGranted)
    );
    assert_eq!(
        decide_permission(
            &store,
            &SystemClock,
            me,
            decide("op-late", request, "denied", Decider::Human)
        )
        .await,
        Err(DomainError::RequestNotPending)
    );
}

#[tokio::test]
async fn a_denial_leaves_other_requests_pending_and_another_principal_sees_nothing() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let store = open(&dir).await;
    let (me, other) = (actor(1), actor(2));
    let task = new_task(&store, me).await;
    let first = ask(&store, me, &task, &["git", "push"]).await;
    let second = ask(&store, me, &task, &["make", "deploy"]).await;
    ok(decide_permission(
        &store,
        &SystemClock,
        me,
        decide("op-deny", first, "denied", Decider::Human),
    )
    .await);
    let now = ok(permission_request(&store, me, &second.to_string()).await).created_at;
    let pending = ok(pending_requests(&store, me, None, now).await);
    assert_eq!(
        pending
            .iter()
            .map(|request| request.request_id)
            .collect::<Vec<_>>(),
        vec![second]
    );
    assert_eq!(
        permission_request(&store, other, &second.to_string()).await,
        Err(DomainError::NotFound)
    );
    assert_eq!(
        decide_permission(
            &store,
            &SystemClock,
            other,
            decide("op-other", second, "allowed", Decider::Human)
        )
        .await,
        Err(DomainError::NotFound)
    );
    assert!(ok(pending_requests(&store, other, None, now).await).is_empty());
    assert_eq!(
        pending_requests(&store, other, Some(&task.task_id.to_string()), now).await,
        Err(DomainError::NotFound)
    );
}

#[tokio::test]
async fn permission_decisions_never_write_review_or_approval_states() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let store = open(&dir).await;
    let me = actor(1);
    let task = new_task(&store, me).await;
    ok(record_task_state(
        &store,
        &SystemClock,
        me,
        RecordTaskState {
            operation_id: "state-1".to_string(),
            expected_revision: Revision::ZERO,
            task_id: task.task_id.to_string(),
            dimension: "task".to_string(),
            scope_kind: "task".to_string(),
            scope_id: task.task_id.to_string(),
            value: "running".to_string(),
            writer: StateWriter::Human,
        },
    )
    .await);
    let before = ok(task_states(&store, me, &task.task_id.to_string()).await);
    let allowed = ask(&store, me, &task, &["git", "push"]).await;
    let denied = ask(&store, me, &task, &["make", "deploy"]).await;
    ok(decide_permission(
        &store,
        &SystemClock,
        me,
        decide("op-a", allowed, "allowed", Decider::Human),
    )
    .await);
    ok(decide_permission(
        &store,
        &SystemClock,
        me,
        decide("op-d", denied, "denied", Decider::Human),
    )
    .await);
    ok(use_permission(
        &store,
        &SystemClock,
        me,
        &allowed.to_string(),
        task.task_id,
        &words(&["git", "push"]),
    )
    .await);
    let after = ok(task_states(&store, me, &task.task_id.to_string()).await);
    assert_eq!(after, before);
    for dimension in [StateDimension::Review, StateDimension::ApprovalMarker] {
        assert_eq!(after.history(dimension).count(), 0);
    }
}

#[tokio::test]
async fn user_rules_are_versioned_per_principal_and_refuse_allow() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let (me, other) = (actor(1), actor(2));
    {
        let store = open(&dir).await;
        let refused = set_user_rules(
            &store,
            &SystemClock,
            me,
            SetUserRules {
                operation_id: "op-allow".to_string(),
                expected_revision: Revision::ZERO,
                rules: vec![UserRuleInput {
                    prefix: words(&["curl"]),
                    decision: "allow".to_string(),
                    note: None,
                }],
            },
        )
        .await;
        assert_eq!(refused, Err(DomainError::UserRuleCannotAllow));
        let outcome = ok(set_user_rules(
            &store,
            &SystemClock,
            me,
            SetUserRules {
                operation_id: "op-forbid".to_string(),
                expected_revision: Revision::ZERO,
                rules: vec![
                    UserRuleInput {
                        prefix: words(&["git", "push"]),
                        decision: "forbid".to_string(),
                        note: Some("Never from here".to_string()),
                    },
                    UserRuleInput {
                        prefix: words(&["make"]),
                        decision: "prompt".to_string(),
                        note: None,
                    },
                ],
            },
        )
        .await);
        assert_eq!(outcome.receipt.resulting_revision, Revision::new(1));
    }
    let store = open(&dir).await;
    let mine = ok(user_rules(&store, me).await);
    assert_eq!(mine.revision, Revision::new(1));
    assert_eq!(mine.rules[0].decision, RuleDecision::Forbid);
    assert_eq!(mine.rules[0].note.as_deref(), Some("Never from here"));
    assert_eq!(ok(user_rules(&store, other).await).revision, Revision::ZERO);
    // The person's forbid controls, named as their rule.
    let rules = effective_rules(
        &effective_policy(
            &WorkspaceLayer {
                workspace_id: WorkspaceId::parse(WORKSPACE)
                    .unwrap_or_else(|error| panic!("{error}")),
                policy_revision: Revision::new(3),
                authorization_epoch: Revision::new(1),
                execution: None,
            },
            &DeviceRequirements::default(),
            &UserConfig::default(),
        ),
        &mine.rules,
        mine.revision,
    );
    assert_eq!(
        rules[0].source,
        RuleSource::UserRule {
            version: Revision::new(1)
        }
    );
}

#[tokio::test]
async fn the_schema_refuses_a_host_allow_and_a_second_decision() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let store = open(&dir).await;
    let me = actor(1);
    let task = new_task(&store, me).await;
    let request = ask(&store, me, &task, &["git", "push"]).await;
    assert_eq!(
        decide_permission(
            &store,
            &SystemClock,
            me,
            decide(
                "op-sys",
                request,
                "allowed",
                Decider::System {
                    reference: "inquello-desktop".to_string()
                }
            )
        )
        .await,
        Err(DomainError::HumanActorRequired)
    );
    // Past the domain, the schema still refuses an allow by the host.
    let refused = store
        .commit_permission_decision(PermissionDecisionChange {
            request_id: request,
            decision: PermissionDecision {
                outcome: PermissionOutcome::Allowed,
                actor_kind: DeciderKind::System,
                actor_ref: "inquello-desktop".to_string(),
                decided_at: Timestamp::from_unix_millis(1),
            },
            receipt: PermissionReceipt {
                operation_id: OperationId::parse("op-raw")
                    .unwrap_or_else(|error| panic!("{error}")),
                principal_id: me.principal_id,
                command: DECIDE_PERMISSION_COMMAND.to_string(),
                request_id: request,
                expected_revision: Revision::new(1),
                resulting_revision: Revision::new(2),
                request: "{}".to_string(),
                status: ReceiptStatus::Applied,
                recorded_at: Timestamp::from_unix_millis(1),
            },
        })
        .await;
    assert!(
        matches!(refused, Err(StoreError::Backend(_))),
        "{refused:?}"
    );
    ok(decide_permission(
        &store,
        &SystemClock,
        me,
        decide(
            "op-exp",
            request,
            "expired",
            Decider::System {
                reference: "inquello-desktop".to_string(),
            },
        ),
    )
    .await);
    assert_eq!(
        decide_permission(
            &store,
            &SystemClock,
            me,
            decide("op-2", request, "denied", Decider::Human)
        )
        .await,
        Err(DomainError::RequestNotPending)
    );
}
