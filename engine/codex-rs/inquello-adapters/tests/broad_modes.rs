//! The Story 1.18 broad-mode matrix against a real SQLite working store in a
//! temp directory: recording, reopen, privacy, refusals and the schema's own
//! guard against a non-human broader mode.

use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::DomainError;
use inquello_domain::OperationId;
use inquello_domain::ReceiptStatus;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::execution_policy::BroadMode;
use inquello_domain::execution_policy::BroadModeChange;
use inquello_domain::execution_policy::BroadModeReceipt;
use inquello_domain::execution_policy::BroadModeRecord;
use inquello_domain::execution_policy::BroadModeStore;
use inquello_domain::execution_policy::DeviceRequirements;
use inquello_domain::execution_policy::EffectivePolicy;
use inquello_domain::execution_policy::ExecutionPolicy;
use inquello_domain::execution_policy::SetBroadMode;
use inquello_domain::execution_policy::SettingSource;
use inquello_domain::execution_policy::UserConfig;
use inquello_domain::execution_policy::WorkspaceLayer;
use inquello_domain::execution_policy::effective_policy;
use inquello_domain::execution_policy::set_broad_mode;
use inquello_domain::execution_policy::task_broad_mode;
use inquello_domain::organise::Actor;
use inquello_domain::organise::CreateTask;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::Task;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::organise::create_task;
use inquello_domain::state::ActorKind;
use inquello_domain::state::StateWriter;
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

fn policy(execution: Option<serde_json::Value>, revision: u64) -> EffectivePolicy {
    effective_policy(
        &WorkspaceLayer {
            workspace_id: WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}")),
            policy_revision: Revision::new(revision),
            authorization_epoch: Revision::new(revision),
            execution: execution.map(|value| {
                ExecutionPolicy::from_value(&value).unwrap_or_else(|error| panic!("{error}"))
            }),
        },
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

fn permissive() -> EffectivePolicy {
    policy(
        Some(serde_json::json!({
            "sandbox": "full_access",
            "approvals": ["on_request", "never"],
            "network": "allowed",
            "allow_full_access": true,
            "allow_no_prompt": true,
        })),
        3,
    )
}

fn set(task: &Task, op: &str, expected: u64, mode: BroadMode) -> SetBroadMode {
    SetBroadMode {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        task_id: task.task_id.to_string(),
        mode: mode.as_str().to_string(),
        confirmation: mode.is_broad().then(|| mode.reach().to_string()),
        writer: StateWriter::Human,
    }
}

#[tokio::test]
async fn a_recorded_mode_survives_reopen_with_its_history() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let task;
    {
        let store = open(&dir).await;
        task = new_task(&store, actor(1)).await;
        let read = ok(task_broad_mode(&store, actor(1), &task.task_id.to_string()).await);
        assert_eq!(read.revision, Revision::ZERO);
        assert_eq!(read.recorded(), BroadMode::Standard);
        ok(set_broad_mode(
            &store,
            &SystemClock,
            actor(1),
            &permissive(),
            set(&task, "op-1", 0, BroadMode::FullAccess),
        )
        .await);
        ok(set_broad_mode(
            &store,
            &SystemClock,
            actor(1),
            &permissive(),
            set(&task, "op-2", 1, BroadMode::NoPrompt),
        )
        .await);
    }
    let store = open(&dir).await;
    let read = ok(task_broad_mode(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!(read.revision, Revision::new(2));
    assert_eq!(read.recorded(), BroadMode::NoPrompt);
    assert_eq!(read.workspace_id.to_string(), WORKSPACE);
    let current = read.current.unwrap_or_else(|| panic!("a record"));
    assert_eq!(current.actor_kind, ActorKind::Human);
    assert_eq!(current.actor_ref, actor(1).principal_id.to_string());
    let first = store
        .load_broad_mode_record(task.task_id, Revision::new(1))
        .await
        .unwrap_or_else(|error| panic!("{error}"))
        .unwrap_or_else(|| panic!("revision 1"));
    assert_eq!(first.mode, BroadMode::FullAccess);
    // The replay of the first write still answers from its receipt.
    let replay = ok(set_broad_mode(
        &store,
        &SystemClock,
        actor(1),
        &permissive(),
        set(&task, "op-1", 0, BroadMode::FullAccess),
    )
    .await);
    assert!(replay.replayed);
    assert_eq!(replay.record, first);
}

#[tokio::test]
async fn refusals_write_nothing_and_another_creator_sees_no_task() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let store = open(&dir).await;
    let task = new_task(&store, actor(1)).await;
    assert_eq!(
        set_broad_mode(
            &store,
            &SystemClock,
            actor(1),
            &policy(None, 1),
            set(&task, "op-1", 0, BroadMode::FullAccess)
        )
        .await,
        Err(DomainError::BroadModeNotPermitted {
            rule: SettingSource::InquelloDefault
        })
    );
    assert_eq!(
        set_broad_mode(
            &store,
            &SystemClock,
            actor(2),
            &permissive(),
            set(&task, "op-1", 0, BroadMode::FullAccess)
        )
        .await,
        Err(DomainError::NotFound)
    );
    assert_eq!(
        task_broad_mode(&store, actor(2), &task.task_id.to_string()).await,
        Err(DomainError::NotFound)
    );
    let mut unconfirmed = set(&task, "op-1", 0, BroadMode::FullAccess);
    unconfirmed.confirmation = None;
    assert!(matches!(
        set_broad_mode(&store, &SystemClock, actor(1), &permissive(), unconfirmed).await,
        Err(DomainError::InvalidCommand(_))
    ));
    let read = ok(task_broad_mode(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!(read.revision, Revision::ZERO);
    assert!(read.current.is_none());
}

#[tokio::test]
async fn the_schema_refuses_a_non_human_broader_mode_even_past_the_domain() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("{error}"));
    let store = open(&dir).await;
    let task = new_task(&store, actor(1)).await;
    let change = |op: &str, mode: BroadMode, actor_kind: ActorKind| BroadModeChange {
        expected_revision: Revision::ZERO,
        record: BroadModeRecord {
            task_id: task.task_id,
            mode,
            actor_kind,
            actor_ref: "codex".to_string(),
            recorded_at: Timestamp::from_unix_millis(1),
            revision: Revision::new(1),
        },
        receipt: BroadModeReceipt {
            operation_id: OperationId::parse(op).unwrap_or_else(|error| panic!("{error}")),
            principal_id: actor(1).principal_id,
            task_id: task.task_id,
            expected_revision: Revision::ZERO,
            resulting_revision: Revision::new(1),
            request: "{}".to_string(),
            status: ReceiptStatus::Applied,
            recorded_at: Timestamp::from_unix_millis(1),
        },
    };
    let refused = store
        .commit_broad_mode(change("op-1", BroadMode::FullAccess, ActorKind::Runtime))
        .await;
    assert!(
        matches!(refused, Err(StoreError::Backend(_))),
        "{refused:?}"
    );
    assert_eq!(
        store
            .load_broad_mode(task.task_id)
            .await
            .unwrap_or_else(|error| panic!("{error}"))
            .0,
        Revision::ZERO
    );
    // A standard record from the host is allowed.
    store
        .commit_broad_mode(change("op-2", BroadMode::Standard, ActorKind::System))
        .await
        .unwrap_or_else(|error| panic!("{error}"));
}
