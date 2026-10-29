//! The Story 1.15 I/O matrix against a real SQLite working store in a temp
//! directory: separate dimensions, writer rules, history, revisions, replay,
//! privacy, reopen, and the schema's own guards.

use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::DomainError;
use inquello_domain::OperationId;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::Timestamp;
use inquello_domain::organise::Actor;
use inquello_domain::organise::CreateTask;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::Task;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::create_task;
use inquello_domain::state::ActorKind;
use inquello_domain::state::RecordTaskState;
use inquello_domain::state::ScopeKind;
use inquello_domain::state::StateDimension;
use inquello_domain::state::StateOutcome;
use inquello_domain::state::StateRecord;
use inquello_domain::state::StateWriter;
use inquello_domain::state::TaskStateChange;
use inquello_domain::state::TaskStateStore;
use inquello_domain::state::record_task_state;
use inquello_domain::state::task_states;
use pretty_assertions::assert_eq;
use std::path::PathBuf;
use tempfile::TempDir;
use uuid::Uuid;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

struct Fixture {
    _dir: TempDir,
    path: PathBuf,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("tempdir: {error}"));
    Fixture {
        path: dir.path().join("working.sqlite"),
        _dir: dir,
    }
}

async fn open(fixture: &Fixture) -> SqliteWorkingStore {
    SqliteWorkingStore::open(&fixture.path, &[])
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

fn system() -> StateWriter {
    StateWriter::System {
        reference: "inquello-desktop".to_string(),
    }
}

fn runtime() -> StateWriter {
    StateWriter::Runtime {
        reference: "codex-app-server".to_string(),
    }
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

fn state(
    op: &str,
    expected: u64,
    task: &Task,
    dimension: &str,
    value: &str,
    writer: StateWriter,
) -> RecordTaskState {
    let (scope_kind, scope_id) = match dimension {
        "task" => ("task", task.task_id.to_string()),
        "run" => ("run", "run-1".to_string()),
        _ => ("output", "output-1@v1".to_string()),
    };
    RecordTaskState {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        task_id: task.task_id.to_string(),
        dimension: dimension.to_string(),
        scope_kind: scope_kind.to_string(),
        scope_id,
        value: value.to_string(),
        writer,
    }
}

async fn record(
    store: &SqliteWorkingStore,
    who: Actor,
    command: RecordTaskState,
) -> Result<StateOutcome, DomainError> {
    record_task_state(store, &SystemClock, who, command).await
}

#[tokio::test]
async fn history_survives_reopen_with_versions_actors_and_revisions() {
    let fixture = fixture();
    let task;
    {
        let store = open(&fixture).await;
        task = new_task(&store, actor(1)).await;
        ok(record(
            &store,
            actor(1),
            state("op-1", 0, &task, "task", "planned", system()),
        )
        .await);
        ok(record(
            &store,
            actor(1),
            state("op-2", 1, &task, "task", "running", runtime()),
        )
        .await);
        ok(record(
            &store,
            actor(1),
            state("op-3", 2, &task, "task", "interrupted", system()),
        )
        .await);
        ok(record(
            &store,
            actor(1),
            state("op-4", 3, &task, "run", "execution_finished", runtime()),
        )
        .await);
    }
    let store = open(&fixture).await;
    let states = ok(task_states(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!(states.revision, Revision::new(4));
    let task_history: Vec<_> = states
        .history(StateDimension::Task)
        .map(|r| {
            (
                r.value,
                r.version,
                r.revision.get(),
                r.actor_kind,
                r.actor_ref.as_str(),
            )
        })
        .collect();
    assert_eq!(
        task_history,
        vec![
            ("interrupted", 3, 3, ActorKind::System, "inquello-desktop"),
            ("running", 2, 2, ActorKind::Runtime, "codex-app-server"),
            ("planned", 1, 1, ActorKind::System, "inquello-desktop"),
        ]
    );
    let latest: Vec<_> = StateDimension::ALL
        .into_iter()
        .map(|d| states.latest(d).map(|r| r.value))
        .collect();
    assert_eq!(
        latest,
        vec![
            Some("interrupted"),
            Some("execution_finished"),
            None,
            None,
            None,
            None,
            None
        ]
    );
    let run = states
        .latest(StateDimension::Run)
        .map(|r| (r.scope_kind, r.scope_id.clone()));
    assert_eq!(run, Some((ScopeKind::Run, "run-1".to_string())));
}

#[tokio::test]
async fn writer_rules_vocabularies_and_enablement_are_enforced() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let task = new_task(&store, actor(1)).await;
    assert_eq!(
        record(
            &store,
            actor(1),
            state("op", 0, &task, "review", "requested", system())
        )
        .await
        .err(),
        Some(DomainError::HumanActorRequired)
    );
    assert_eq!(
        record(
            &store,
            actor(1),
            state(
                "op",
                0,
                &task,
                "approval_marker",
                "noted_locally",
                runtime()
            )
        )
        .await
        .err(),
        Some(DomainError::HumanActorRequired)
    );
    assert_eq!(
        record(
            &store,
            actor(1),
            state("op", 0, &task, "delivery_marker", "attempted", system())
        )
        .await
        .err(),
        Some(DomainError::DimensionNotEnabled)
    );
    assert_eq!(
        record(
            &store,
            actor(1),
            state("op", 0, &task, "run", "done", system())
        )
        .await
        .err(),
        Some(DomainError::InvalidValue)
    );
    let states = ok(task_states(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!((states.revision, states.records.len()), (Revision::ZERO, 0));
}

#[tokio::test]
async fn stale_revisions_conflict_and_replays_answer_from_the_receipt() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let task = new_task(&store, actor(1)).await;
    let first = ok(record(
        &store,
        actor(1),
        state("op-1", 0, &task, "task", "planned", system()),
    )
    .await);
    assert_eq!(
        record(
            &store,
            actor(1),
            state("op-2", 0, &task, "task", "running", system())
        )
        .await
        .err(),
        Some(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
    let again = ok(record(
        &store,
        actor(1),
        state("op-1", 0, &task, "task", "planned", system()),
    )
    .await);
    assert!(again.replayed);
    assert_eq!((again.receipt, again.record), (first.receipt, first.record));
    assert_eq!(
        record(
            &store,
            actor(1),
            state("op-1", 0, &task, "task", "blocked", system())
        )
        .await
        .err(),
        Some(DomainError::OperationConflict {
            operation_id: OperationId::parse("op-1").unwrap_or_else(|e| panic!("{e}")),
        })
    );
    let states = ok(task_states(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!(states.records.len(), 1);
}

#[tokio::test]
async fn another_creator_is_refused_like_an_unknown_task() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let task = new_task(&store, actor(1)).await;
    ok(record(
        &store,
        actor(1),
        state("op-1", 0, &task, "task", "planned", system()),
    )
    .await);
    assert_eq!(
        task_states(&store, actor(2), &task.task_id.to_string())
            .await
            .err(),
        Some(DomainError::NotFound)
    );
    assert_eq!(
        record(
            &store,
            actor(2),
            state("op-2", 1, &task, "task", "running", system())
        )
        .await
        .err(),
        Some(DomainError::NotFound)
    );
    assert_eq!(
        task_states(&store, actor(1), &TaskId::new_random().to_string())
            .await
            .err(),
        Some(DomainError::NotFound)
    );
}

fn raw_record(
    task: &Task,
    dimension: StateDimension,
    value: &'static str,
    actor_kind: ActorKind,
) -> StateRecord {
    StateRecord {
        task_id: task.task_id,
        dimension,
        scope_kind: ScopeKind::Output,
        scope_id: "output-1@v1".to_string(),
        value,
        version: 1,
        actor_kind,
        actor_ref: "probe".to_string(),
        recorded_at: Timestamp::from_unix_millis(1),
        revision: Revision::new(1),
    }
}

fn change(record: StateRecord, op: &str) -> TaskStateChange {
    TaskStateChange {
        expected_revision: Revision::ZERO,
        receipt: inquello_domain::state::StateReceipt {
            operation_id: OperationId::parse(op).unwrap_or_else(|e| panic!("{e}")),
            principal_id: actor(1).principal_id,
            task_id: record.task_id,
            expected_revision: Revision::ZERO,
            resulting_revision: record.revision,
            request: "{}".to_string(),
            status: inquello_domain::ReceiptStatus::Applied,
            recorded_at: Timestamp::from_unix_millis(1),
        },
        record,
    }
}

#[tokio::test]
async fn the_schema_refuses_a_non_human_review_even_past_the_domain() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let task = new_task(&store, actor(1)).await;
    let refused = store
        .commit_state(change(
            raw_record(
                &task,
                StateDimension::Review,
                "decision_recorded",
                ActorKind::System,
            ),
            "raw-1",
        ))
        .await;
    assert!(
        matches!(refused, Err(StoreError::Backend(_))),
        "{refused:?}"
    );
    // A later epic's checks record is independent of review: it stores alone.
    store
        .commit_state(change(
            raw_record(&task, StateDimension::Checks, "complete", ActorKind::System),
            "raw-2",
        ))
        .await
        .unwrap_or_else(|error| panic!("{error}"));
    let states = ok(task_states(&store, actor(1), &task.task_id.to_string()).await);
    assert_eq!(
        states.latest(StateDimension::Checks).map(|r| r.value),
        Some("complete")
    );
    assert_eq!(states.latest(StateDimension::Review), None);
}
