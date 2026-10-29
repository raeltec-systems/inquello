//! The Story 1.15 I/O matrix at the domain level, against an in-memory port
//! with the same atomic compare-and-set contract as the SQLite adapter.

use super::*;
use crate::model::Timestamp;
use crate::organise::PrincipalId;
use crate::state::model::ActorKind;
use pretty_assertions::assert_eq;
use std::collections::HashMap;
use std::pin::pin;
use std::sync::Mutex;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::task::Context;
use std::task::Poll;
use std::task::Waker;
use uuid::Uuid;

fn block_on<F: std::future::Future>(future: F) -> F::Output {
    let mut future = pin!(future);
    let mut context = Context::from_waker(Waker::noop());
    loop {
        if let Poll::Ready(output) = future.as_mut().poll(&mut context) {
            return output;
        }
    }
}

#[derive(Default)]
struct FakeState {
    creators: HashMap<TaskId, PrincipalId>,
    records: Vec<StateRecord>,
    receipts: HashMap<OperationId, StateReceipt>,
}

#[derive(Default)]
struct FakeStore {
    state: Mutex<FakeState>,
    /// The next receipt lookup answers "none", as if it ran before another
    /// writer's commit.
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

    fn add_task(&self, creator: Actor) -> TaskId {
        let task_id = TaskId::new_random();
        self.with(|s| s.creators.insert(task_id, creator.principal_id));
        task_id
    }

    fn record_count(&self) -> usize {
        self.with(|s| s.records.len())
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

    /// Writes a record directly, as a later epic's writer would.
    fn seed(&self, task_id: TaskId, dimension: StateDimension, value: &'static str) {
        self.with(|s| {
            let revision = FakeStore::revision_of(s, task_id)
                .next()
                .unwrap_or_else(|e| panic!("{e}"));
            s.records.push(StateRecord {
                task_id,
                dimension,
                scope_kind: ScopeKind::Output,
                scope_id: "output-1@v1".to_string(),
                value,
                version: 1,
                actor_kind: ActorKind::System,
                actor_ref: "later-epic".to_string(),
                recorded_at: Timestamp::from_unix_millis(1),
                revision,
            });
        });
    }
}

impl TaskStateStore for FakeStore {
    async fn find_state_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<StateReceipt>, StoreError> {
        if self.hide_next_lookup.swap(false, Ordering::SeqCst) {
            return Ok(None);
        }
        Ok(self.with(|s| s.receipts.get(operation_id).cloned()))
    }

    async fn load_task_creator(&self, task_id: TaskId) -> Result<Option<PrincipalId>, StoreError> {
        Ok(self.with(|s| s.creators.get(&task_id).copied()))
    }

    async fn load_task_states(&self, task_id: TaskId) -> Result<TaskStates, StoreError> {
        Ok(self.with(|s| {
            let mut records: Vec<StateRecord> = s
                .records
                .iter()
                .filter(|r| r.task_id == task_id)
                .cloned()
                .collect();
            records.sort_by_key(|r| std::cmp::Reverse(r.revision));
            TaskStates {
                task_id,
                revision: FakeStore::revision_of(s, task_id),
                records,
            }
        }))
    }

    async fn load_state_record(
        &self,
        task_id: TaskId,
        revision: Revision,
    ) -> Result<Option<StateRecord>, StoreError> {
        Ok(self.with(|s| {
            s.records
                .iter()
                .find(|r| r.task_id == task_id && r.revision == revision)
                .cloned()
        }))
    }

    async fn commit_state(&self, change: TaskStateChange) -> Result<(), StoreError> {
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

impl Clock for FixedClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_unix_millis(1_761_700_000_000)
    }
}

fn actor(n: u8) -> Actor {
    Actor {
        principal_id: PrincipalId::from_uuid(Uuid::from_bytes([n; 16])),
    }
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

fn command(
    op: &str,
    expected: u64,
    task_id: TaskId,
    dimension: &str,
    value: &str,
    writer: StateWriter,
) -> RecordTaskState {
    let (scope_kind, scope_id) = match dimension {
        "task" => ("task", task_id.to_string()),
        "run" => ("run", "run-1".to_string()),
        _ => ("output", "output-1@v1".to_string()),
    };
    RecordTaskState {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        task_id: task_id.to_string(),
        dimension: dimension.to_string(),
        scope_kind: scope_kind.to_string(),
        scope_id,
        value: value.to_string(),
        writer,
    }
}

fn record(
    store: &FakeStore,
    who: Actor,
    command: RecordTaskState,
) -> Result<StateOutcome, DomainError> {
    block_on(record_task_state(store, &FixedClock, who, command))
}

fn ok<T>(result: Result<T, DomainError>) -> T {
    result.unwrap_or_else(|error| panic!("command failed: {error}"))
}

fn latest_values(states: &TaskStates) -> Vec<(StateDimension, Option<&'static str>)> {
    StateDimension::ALL
        .into_iter()
        .map(|dimension| (dimension, states.latest(dimension).map(|r| r.value)))
        .collect()
}

#[test]
fn a_finished_run_records_execution_finished_and_nothing_else() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    let outcome = ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "run", "execution_finished", runtime()),
    ));
    assert!(!outcome.replayed);
    assert_eq!(
        (
            outcome.record.value,
            outcome.record.version,
            outcome.record.revision,
            outcome.record.actor_kind,
            outcome.record.actor_ref.as_str(),
        ),
        (
            "execution_finished",
            1,
            Revision::new(1),
            ActorKind::Runtime,
            "codex-app-server"
        )
    );
    let states = ok(block_on(task_states(&store, actor(1), &task.to_string())));
    assert_eq!(
        latest_values(&states),
        vec![
            (StateDimension::Task, None),
            (StateDimension::Run, Some("execution_finished")),
            (StateDimension::Output, None),
            (StateDimension::Checks, None),
            (StateDimension::Review, None),
            (StateDimension::ApprovalMarker, None),
            (StateDimension::DeliveryMarker, None),
        ]
    );
}

#[test]
fn dimensions_are_independent() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    // Checks complete (written as a later epic would) implies no review.
    store.seed(task, StateDimension::Checks, "complete");
    let states = ok(block_on(task_states(&store, actor(1), &task.to_string())));
    assert_eq!(
        states.latest(StateDimension::Checks).map(|r| r.value),
        Some("complete")
    );
    assert_eq!(states.latest(StateDimension::Review), None);
    assert_eq!(states.latest(StateDimension::ApprovalMarker), None);
    // A run state is recorded without any route through checks, review or markers.
    ok(record(
        &store,
        actor(1),
        command("op-run", 1, task, "run", "execution_finished", system()),
    ));
    // And the writer rules accept checks from a non-human writer.
    assert_eq!(check_writer(StateDimension::Checks, &system()), Ok(()));
    assert_eq!(
        check_writer(StateDimension::Review, &StateWriter::Human),
        Ok(())
    );
    assert_eq!(
        check_writer(StateDimension::ApprovalMarker, &StateWriter::Human),
        Ok(())
    );
}

#[test]
fn review_and_approval_need_a_human_writer() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    for (dimension, value) in [
        ("review", "requested"),
        ("approval_marker", "noted_locally"),
    ] {
        for writer in [runtime(), system()] {
            assert_eq!(
                record(
                    &store,
                    actor(1),
                    command("op", 0, task, dimension, value, writer)
                )
                .err(),
                Some(DomainError::HumanActorRequired),
                "{dimension}"
            );
        }
    }
    assert_eq!(store.record_count(), 0);
}

#[test]
fn dimensions_without_a_writer_yet_are_refused() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    for (dimension, value, writer) in [
        ("delivery_marker", "attempted", system()),
        ("output", "produced", runtime()),
        ("checks", "complete", system()),
        ("review", "requested", StateWriter::Human),
        ("approval_marker", "noted_locally", StateWriter::Human),
    ] {
        assert_eq!(
            record(
                &store,
                actor(1),
                command("op", 0, task, dimension, value, writer)
            )
            .err(),
            Some(DomainError::DimensionNotEnabled),
            "{dimension}"
        );
    }
    assert_eq!(
        ENABLED_DIMENSIONS,
        [StateDimension::Task, StateDimension::Run]
    );
    assert_eq!(store.record_count(), 0);
}

#[test]
fn values_outside_a_dimension_vocabulary_are_refused() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    for (dimension, value) in [
        ("run", "done"),
        ("run", "accepted"),
        ("task", "execution_finished"),
        ("task", "Planned"),
        ("review", "approved"),
    ] {
        assert_eq!(
            record(
                &store,
                actor(1),
                command("op", 0, task, dimension, value, system())
            )
            .err(),
            Some(DomainError::InvalidValue),
            "{dimension}={value}"
        );
    }
    assert!(matches!(
        record(
            &store,
            actor(1),
            command("op", 0, task, "done", "done", system())
        ),
        Err(DomainError::InvalidCommand(_))
    ));
    assert_eq!(store.record_count(), 0);
}

#[test]
fn scopes_must_fit_the_dimension() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    let other = TaskId::new_random();
    let mut wrong_task = command("op", 0, task, "task", "planned", system());
    wrong_task.scope_id = other.to_string();
    let mut run_on_task = command("op", 0, task, "run", "running", system());
    run_on_task.scope_kind = "task".to_string();
    run_on_task.scope_id = task.to_string();
    let mut bad_ref = command("op", 0, task, "run", "running", system());
    bad_ref.scope_id = "run 1".to_string();
    let mut bad_actor = command(
        "op",
        0,
        task,
        "run",
        "running",
        StateWriter::System {
            reference: String::new(),
        },
    );
    bad_actor.scope_id = "run-1".to_string();
    for bad in [wrong_task, run_on_task, bad_ref, bad_actor] {
        assert!(
            matches!(
                record(&store, actor(1), bad.clone()),
                Err(DomainError::InvalidCommand(_))
            ),
            "{bad:?}"
        );
    }
    assert_eq!(store.record_count(), 0);
}

#[test]
fn a_stale_expected_revision_is_refused_and_history_is_unchanged() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    assert_eq!(
        record(
            &store,
            actor(1),
            command("op-2", 0, task, "task", "running", system())
        )
        .err(),
        Some(DomainError::RevisionConflict {
            expected: Revision::ZERO,
            actual: Revision::new(1),
        })
    );
    let states = ok(block_on(task_states(&store, actor(1), &task.to_string())));
    assert_eq!(states.revision, Revision::new(1));
    assert_eq!(states.records.len(), 1);
}

#[test]
fn a_replay_answers_from_the_receipt_and_a_different_payload_conflicts() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    let first = ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    let again = ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    assert!(again.replayed);
    assert_eq!((again.receipt, again.record), (first.receipt, first.record));
    let conflict = Some(DomainError::OperationConflict {
        operation_id: OperationId::parse("op-1").unwrap_or_else(|e| panic!("{e}")),
    });
    assert_eq!(
        record(
            &store,
            actor(1),
            command("op-1", 0, task, "task", "running", system())
        )
        .err(),
        conflict
    );
    assert_eq!(
        record(
            &store,
            actor(2),
            command("op-1", 0, task, "task", "planned", system())
        )
        .err(),
        conflict
    );
    assert_eq!(store.record_count(), 1);
}

#[test]
fn a_write_whose_lookup_missed_a_committed_receipt_replays_it() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    let first = ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    store.hide_next_lookup.store(true, Ordering::SeqCst);
    let again = ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    assert!(again.replayed);
    assert_eq!(again.receipt, first.receipt);
    store.hide_next_lookup.store(true, Ordering::SeqCst);
    assert!(matches!(
        record(
            &store,
            actor(1),
            command("op-1", 0, task, "task", "running", system())
        ),
        Err(DomainError::OperationConflict { .. })
    ));
    assert_eq!(store.record_count(), 1);
}

#[test]
fn another_principal_is_refused_like_an_unknown_task() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    let unknown = TaskId::new_random();
    for task_id in [task, unknown] {
        assert_eq!(
            block_on(task_states(&store, actor(2), &task_id.to_string())).err(),
            Some(DomainError::NotFound)
        );
        assert_eq!(
            record(
                &store,
                actor(2),
                command("op-2", 1, task_id, "task", "running", system())
            )
            .err(),
            Some(DomainError::NotFound)
        );
    }
    assert_eq!(store.record_count(), 1);
}

#[test]
fn history_lists_every_state_with_its_version_and_actor_latest_first() {
    let store = FakeStore::default();
    let task = store.add_task(actor(1));
    ok(record(
        &store,
        actor(1),
        command("op-1", 0, task, "task", "planned", system()),
    ));
    ok(record(
        &store,
        actor(1),
        command("op-2", 1, task, "task", "running", runtime()),
    ));
    ok(record(
        &store,
        actor(1),
        command("op-3", 2, task, "run", "running", runtime()),
    ));
    ok(record(
        &store,
        actor(1),
        command("op-4", 3, task, "task", "interrupted", system()),
    ));
    let states = ok(block_on(task_states(&store, actor(1), &task.to_string())));
    assert_eq!(states.revision, Revision::new(4));
    let history: Vec<_> = states
        .history(StateDimension::Task)
        .map(|r| (r.value, r.version, r.revision.get(), r.actor_kind))
        .collect();
    assert_eq!(
        history,
        vec![
            ("interrupted", 3, 4, ActorKind::System),
            ("running", 2, 2, ActorKind::Runtime),
            ("planned", 1, 1, ActorKind::System),
        ]
    );
    let run: Vec<_> = states
        .history(StateDimension::Run)
        .map(|r| (r.value, r.version))
        .collect();
    assert_eq!(run, vec![("running", 1)]);
}
