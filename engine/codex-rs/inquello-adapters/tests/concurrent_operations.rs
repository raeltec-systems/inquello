//! Review finding R10: overlapping requests with the same operation ID against
//! a real SQLite working store. A barrier holds both requests after their
//! receipt lookup (and pre-commit reads) so that both miss the receipt; the one
//! that loses the commit must replay the winner's receipt, not report the
//! winner's change as a conflict. A different request under the same operation
//! ID, and an independent request at a stale revision, must still be refused.

use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::CommandOutcome;
use inquello_domain::DomainError;
use inquello_domain::InitializeStore;
use inquello_domain::OperationId;
use inquello_domain::Receipt;
use inquello_domain::Revision;
use inquello_domain::StateChange;
use inquello_domain::StoreError;
use inquello_domain::StoreInfo;
use inquello_domain::WorkingStore;
use inquello_domain::execution_policy::BroadModeChange;
use inquello_domain::execution_policy::BroadModeOutcome;
use inquello_domain::execution_policy::BroadModeReceipt;
use inquello_domain::execution_policy::BroadModeRecord;
use inquello_domain::execution_policy::BroadModeStore;
use inquello_domain::execution_policy::BroadModeTask;
use inquello_domain::execution_policy::DeviceRequirements;
use inquello_domain::execution_policy::EffectivePolicy;
use inquello_domain::execution_policy::ExecutionPolicy;
use inquello_domain::execution_policy::SetBroadMode;
use inquello_domain::execution_policy::UserConfig;
use inquello_domain::execution_policy::WorkspaceLayer;
use inquello_domain::execution_policy::effective_policy;
use inquello_domain::execution_policy::set_broad_mode;
use inquello_domain::initialize_store;
use inquello_domain::organise::Actor;
use inquello_domain::organise::CreateEngagement;
use inquello_domain::organise::CreateTask;
use inquello_domain::organise::Engagement;
use inquello_domain::organise::EngagementId;
use inquello_domain::organise::Folder;
use inquello_domain::organise::FolderId;
use inquello_domain::organise::KnownWorkspace;
use inquello_domain::organise::OrganiseChange;
use inquello_domain::organise::OrganiseOutcome;
use inquello_domain::organise::OrganiseReceipt;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::OrganiseStore;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::RenameTask;
use inquello_domain::organise::ServiceEngagementId;
use inquello_domain::organise::Task;
use inquello_domain::organise::TaskId;
use inquello_domain::organise::WorkspaceId;
use inquello_domain::organise::WorkspaceLabel;
use inquello_domain::organise::WorkspaceTree;
use inquello_domain::organise::create_engagement;
use inquello_domain::organise::create_task;
use inquello_domain::organise::rename_task;
use inquello_domain::state::RecordTaskState;
use inquello_domain::state::StateOutcome;
use inquello_domain::state::StateReceipt;
use inquello_domain::state::StateRecord;
use inquello_domain::state::StateWriter;
use inquello_domain::state::TaskStateChange;
use inquello_domain::state::TaskStateStore;
use inquello_domain::state::TaskStates;
use inquello_domain::state::record_task_state;
use inquello_domain::state::task_states;
use pretty_assertions::assert_eq;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::AtomicUsize;
use std::sync::atomic::Ordering;
use tempfile::TempDir;
use tokio::sync::Barrier;
use uuid::Uuid;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";

/// Where the gate holds each request until both have arrived.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Pause {
    /// After the store revision read (InitializeStore).
    StoreInfo,
    /// After the first receipt lookup.
    ReceiptLookup,
    /// After the shared-service link lookup (CreateEngagement).
    EngagementByService,
    /// After the Task read (Task updates).
    TaskLoad,
    /// After the Task-state history read (state writes).
    StatesLoad,
    /// After the broad-mode read (broad-mode writes, Story 1.18).
    BroadModeLoad,
}

/// The real store, with a two-party barrier at `pause` and, optionally, a
/// first receipt lookup that answers "none" as if it ran before another
/// writer committed.
struct Gate {
    store: SqliteWorkingStore,
    pause: Option<Pause>,
    barrier: Barrier,
    arrivals: AtomicUsize,
    hide_first_lookup: AtomicBool,
}

impl Gate {
    fn racing(store: &SqliteWorkingStore, pause: Pause) -> Self {
        Self {
            store: store.clone(),
            pause: Some(pause),
            barrier: Barrier::new(2),
            arrivals: AtomicUsize::new(0),
            hide_first_lookup: AtomicBool::new(false),
        }
    }

    /// No barrier: the first receipt lookup misses a receipt that is already
    /// committed (the lookup "ran before" the other writer's commit).
    fn stale_lookup(store: &SqliteWorkingStore) -> Self {
        Self {
            store: store.clone(),
            pause: None,
            barrier: Barrier::new(1),
            arrivals: AtomicUsize::new(0),
            hide_first_lookup: AtomicBool::new(true),
        }
    }

    /// Waits at the barrier the first time each of the two requests gets here.
    async fn arrive(&self, at: Pause) {
        if self.pause == Some(at) && self.arrivals.fetch_add(1, Ordering::SeqCst) < 2 {
            self.barrier.wait().await;
        }
    }

    fn hide_lookup(&self) -> bool {
        self.hide_first_lookup.swap(false, Ordering::SeqCst)
    }
}

impl WorkingStore for Gate {
    async fn load_store_info(&self) -> Result<Option<StoreInfo>, StoreError> {
        let result = self.store.load_store_info().await;
        self.arrive(Pause::StoreInfo).await;
        result
    }

    async fn find_receipt(&self, id: &OperationId) -> Result<Option<Receipt>, StoreError> {
        if self.hide_lookup() {
            return Ok(None);
        }
        let result = self.store.find_receipt(id).await;
        self.arrive(Pause::ReceiptLookup).await;
        result
    }

    async fn commit(&self, change: StateChange) -> Result<(), StoreError> {
        self.store.commit(change).await
    }
}

impl OrganiseStore for Gate {
    async fn find_organise_receipt(
        &self,
        id: &OperationId,
    ) -> Result<Option<OrganiseReceipt>, StoreError> {
        if self.hide_lookup() {
            return Ok(None);
        }
        let result = self.store.find_organise_receipt(id).await;
        self.arrive(Pause::ReceiptLookup).await;
        result
    }

    async fn load_engagement(&self, id: EngagementId) -> Result<Option<Engagement>, StoreError> {
        self.store.load_engagement(id).await
    }

    async fn find_engagement_by_service_id(
        &self,
        id: ServiceEngagementId,
    ) -> Result<Option<Engagement>, StoreError> {
        let result = self.store.find_engagement_by_service_id(id).await;
        self.arrive(Pause::EngagementByService).await;
        result
    }

    async fn load_folder(&self, id: FolderId) -> Result<Option<Folder>, StoreError> {
        self.store.load_folder(id).await
    }

    async fn load_task(&self, id: TaskId) -> Result<Option<Task>, StoreError> {
        let result = self.store.load_task(id).await;
        self.arrive(Pause::TaskLoad).await;
        result
    }

    async fn load_workspace_label(
        &self,
        principal_id: PrincipalId,
        workspace_id: WorkspaceId,
    ) -> Result<Option<WorkspaceLabel>, StoreError> {
        self.store
            .load_workspace_label(principal_id, workspace_id)
            .await
    }

    async fn commit_organise(&self, change: OrganiseChange) -> Result<(), StoreError> {
        self.store.commit_organise(change).await
    }

    async fn load_workspace_tree(
        &self,
        workspace_id: WorkspaceId,
        creator: PrincipalId,
    ) -> Result<WorkspaceTree, StoreError> {
        self.store.load_workspace_tree(workspace_id, creator).await
    }

    async fn load_known_workspaces(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<KnownWorkspace>, StoreError> {
        self.store.load_known_workspaces(principal_id).await
    }
}

impl TaskStateStore for Gate {
    async fn find_state_receipt(
        &self,
        id: &OperationId,
    ) -> Result<Option<StateReceipt>, StoreError> {
        if self.hide_lookup() {
            return Ok(None);
        }
        let result = self.store.find_state_receipt(id).await;
        self.arrive(Pause::ReceiptLookup).await;
        result
    }

    async fn load_task_creator(&self, id: TaskId) -> Result<Option<PrincipalId>, StoreError> {
        self.store.load_task_creator(id).await
    }

    async fn load_task_states(&self, id: TaskId) -> Result<TaskStates, StoreError> {
        let result = self.store.load_task_states(id).await;
        self.arrive(Pause::StatesLoad).await;
        result
    }

    async fn load_state_record(
        &self,
        id: TaskId,
        revision: Revision,
    ) -> Result<Option<StateRecord>, StoreError> {
        self.store.load_state_record(id, revision).await
    }

    async fn commit_state(&self, change: TaskStateChange) -> Result<(), StoreError> {
        self.store.commit_state(change).await
    }
}

impl BroadModeStore for Gate {
    async fn find_broad_mode_receipt(
        &self,
        id: &OperationId,
    ) -> Result<Option<BroadModeReceipt>, StoreError> {
        if self.hide_lookup() {
            return Ok(None);
        }
        let result = self.store.find_broad_mode_receipt(id).await;
        self.arrive(Pause::ReceiptLookup).await;
        result
    }

    async fn load_broad_mode_task(&self, id: TaskId) -> Result<Option<BroadModeTask>, StoreError> {
        self.store.load_broad_mode_task(id).await
    }

    async fn load_broad_mode(
        &self,
        id: TaskId,
    ) -> Result<(Revision, Option<BroadModeRecord>), StoreError> {
        let result = self.store.load_broad_mode(id).await;
        self.arrive(Pause::BroadModeLoad).await;
        result
    }

    async fn load_broad_mode_record(
        &self,
        id: TaskId,
        revision: Revision,
    ) -> Result<Option<BroadModeRecord>, StoreError> {
        self.store.load_broad_mode_record(id, revision).await
    }

    async fn commit_broad_mode(&self, change: BroadModeChange) -> Result<(), StoreError> {
        self.store.commit_broad_mode(change).await
    }
}

async fn open() -> (TempDir, SqliteWorkingStore) {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("tempdir: {error}"));
    let store = SqliteWorkingStore::open(&dir.path().join("working.sqlite"), &[])
        .await
        .unwrap_or_else(|error| panic!("open store: {error}"));
    (dir, store)
}

fn ok<T>(result: Result<T, DomainError>) -> T {
    result.unwrap_or_else(|error| panic!("command failed: {error}"))
}

fn actor() -> Actor {
    Actor {
        principal_id: PrincipalId::from_uuid(Uuid::from_bytes([1; 16])),
    }
}

fn op(id: &str) -> OperationId {
    OperationId::parse(id).unwrap_or_else(|error| panic!("{error}"))
}

/// Exactly one of the two outcomes applied and the other replayed its receipt.
fn applied_once<T: std::fmt::Debug>(
    first: Result<T, DomainError>,
    second: Result<T, DomainError>,
    replayed: impl Fn(&T) -> bool,
) -> (T, T) {
    let (first, second) = (ok(first), ok(second));
    let (applied, replay) = match (replayed(&first), replayed(&second)) {
        (false, true) => (first, second),
        (true, false) => (second, first),
        other => panic!("expected one applied and one replayed outcome, got {other:?}"),
    };
    (applied, replay)
}

fn initialize(id: &str, expected: u64) -> InitializeStore {
    InitializeStore {
        operation_id: id.to_string(),
        expected_revision: Revision::new(expected),
    }
}

// ---- InitializeStore ----------------------------------------------------------

#[tokio::test]
async fn identical_initialize_requests_racing_both_succeed() {
    let (_dir, store) = open().await;
    let gate = Gate::racing(&store, Pause::StoreInfo);
    let (first, second) = tokio::join!(
        initialize_store(&gate, &SystemClock, initialize("identical-op", 0)),
        initialize_store(&gate, &SystemClock, initialize("identical-op", 0)),
    );
    let (applied, replay) = applied_once(first, second, |o: &CommandOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    let info = store.load_store_info().await.ok().flatten();
    assert_eq!(info.map(|i| i.revision), Some(Revision::new(1)));
}

#[tokio::test]
async fn an_initialize_whose_lookup_missed_a_committed_receipt_replays_it() {
    let (_dir, store) = open().await;
    let applied = ok(initialize_store(&store, &SystemClock, initialize("identical-op", 0)).await);
    let gate = Gate::stale_lookup(&store);
    let replay = ok(initialize_store(&gate, &SystemClock, initialize("identical-op", 0)).await);
    assert!(replay.replayed);
    assert_eq!(replay.receipt, applied.receipt);
}

#[tokio::test]
async fn a_different_initialize_request_racing_under_the_same_operation_id_is_refused() {
    let (_dir, store) = open().await;
    let gate = Gate::racing(&store, Pause::StoreInfo);
    let (first, second) = tokio::join!(
        initialize_store(&gate, &SystemClock, initialize("shared-op", 0)),
        initialize_store(&gate, &SystemClock, initialize("shared-op", 1)),
    );
    let applied = ok(first);
    // Refused either by its revision (before the other commit landed) or as a
    // reused operation ID (after); never replayed as the other request.
    assert!(
        matches!(
            second,
            Err(DomainError::OperationConflict { .. } | DomainError::RevisionConflict { .. })
        ),
        "{second:?}"
    );
    assert_eq!(
        store.find_receipt(&op("shared-op")).await.ok().flatten(),
        Some(applied.receipt)
    );
}

#[tokio::test]
async fn a_different_initialize_whose_lookup_missed_the_receipt_is_an_operation_conflict() {
    let (_dir, store) = open().await;
    ok(initialize_store(&store, &SystemClock, initialize("shared-op", 0)).await);
    let gate = Gate::stale_lookup(&store);
    assert_eq!(
        initialize_store(&gate, &SystemClock, initialize("shared-op", 1))
            .await
            .err(),
        Some(DomainError::OperationConflict {
            operation_id: op("shared-op"),
        })
    );
}

#[tokio::test]
async fn independent_initialize_requests_racing_still_conflict() {
    let (_dir, store) = open().await;
    let gate = Gate::racing(&store, Pause::StoreInfo);
    let (first, second) = tokio::join!(
        initialize_store(&gate, &SystemClock, initialize("op-a", 0)),
        initialize_store(&gate, &SystemClock, initialize("op-b", 0)),
    );
    let conflict = Some(DomainError::RevisionConflict {
        expected: Revision::ZERO,
        actual: Revision::new(1),
    });
    match (first, second) {
        (Ok(_), Err(error)) | (Err(error), Ok(_)) => assert_eq!(Some(error), conflict),
        other => panic!("expected one applied and one conflict, got {other:?}"),
    }
    assert!(
        store
            .find_receipt(&op("op-a"))
            .await
            .ok()
            .flatten()
            .is_some()
            != store
                .find_receipt(&op("op-b"))
                .await
                .ok()
                .flatten()
                .is_some()
    );
}

// ---- Organise commands ----------------------------------------------------------

fn engagement_command(id: &str, service_engagement_id: Uuid, name: &str) -> CreateEngagement {
    CreateEngagement {
        operation_id: id.to_string(),
        expected_revision: Revision::ZERO,
        workspace_id: WORKSPACE.to_string(),
        service_engagement_id: service_engagement_id.to_string(),
        name: name.to_string(),
        objectives: "Opinion".to_string(),
        scope: "Group".to_string(),
        client_entity: None,
        period_start: None,
        period_end: None,
    }
}

fn task_command(id: &str, title: &str) -> CreateTask {
    CreateTask {
        operation_id: id.to_string(),
        expected_revision: Revision::ZERO,
        workspace_id: WORKSPACE.to_string(),
        engagement_id: None,
        folder_id: None,
        title: title.to_string(),
    }
}

fn rename(task: &Task, id: &str, expected: u64, title: &str) -> RenameTask {
    RenameTask {
        operation_id: id.to_string(),
        expected_revision: Revision::new(expected),
        workspace_id: WORKSPACE.to_string(),
        task_id: task.task_id.to_string(),
        title: title.to_string(),
    }
}

async fn new_task(store: &SqliteWorkingStore) -> Task {
    match ok(create_task(
        store,
        &SystemClock,
        actor(),
        task_command("op-task", "Planning"),
    )
    .await)
    .record
    {
        OrganiseRecord::Task(task) => task,
        other => panic!("expected a Task, got {other:?}"),
    }
}

async fn stored_task(store: &SqliteWorkingStore, task: &Task) -> Task {
    store
        .load_task(task.task_id)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| panic!("the Task is stored"))
}

async fn task_count(store: &SqliteWorkingStore) -> usize {
    let workspace = WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}"));
    store
        .load_workspace_tree(workspace, actor().principal_id)
        .await
        .unwrap_or_else(|error| panic!("{error}"))
        .tasks
        .len()
}

#[tokio::test]
async fn identical_create_engagement_requests_racing_both_succeed() {
    let (_dir, store) = open().await;
    let gate = Gate::racing(&store, Pause::EngagementByService);
    let service = Uuid::new_v4();
    let (first, second) = tokio::join!(
        create_engagement(
            &gate,
            &SystemClock,
            actor(),
            engagement_command("op-eng", service, "Audit 2026")
        ),
        create_engagement(
            &gate,
            &SystemClock,
            actor(),
            engagement_command("op-eng", service, "Audit 2026")
        ),
    );
    let (applied, replay) = applied_once(first, second, |o: &OrganiseOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(replay.record, applied.record);
    let linked = store
        .find_engagement_by_service_id(
            ServiceEngagementId::parse(&service.to_string()).unwrap_or_else(|e| panic!("{e}")),
        )
        .await
        .ok()
        .flatten();
    assert_eq!(
        linked.map(|e| e.engagement_id),
        Some(match applied.record {
            OrganiseRecord::Engagement(e) => e.engagement_id,
            other => panic!("expected an Engagement, got {other:?}"),
        })
    );
}

#[tokio::test]
async fn identical_create_task_requests_racing_create_one_task() {
    let (_dir, store) = open().await;
    let gate = Gate::racing(&store, Pause::ReceiptLookup);
    let (first, second) = tokio::join!(
        create_task(
            &gate,
            &SystemClock,
            actor(),
            task_command("op-task", "Planning")
        ),
        create_task(
            &gate,
            &SystemClock,
            actor(),
            task_command("op-task", "Planning")
        ),
    );
    let (applied, replay) = applied_once(first, second, |o: &OrganiseOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(replay.record, applied.record);
    assert_eq!(task_count(&store).await, 1);
}

#[tokio::test]
async fn identical_rename_requests_racing_both_succeed() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::TaskLoad);
    let (first, second) = tokio::join!(
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-r", 1, "Bank")
        ),
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-r", 1, "Bank")
        ),
    );
    let (applied, replay) = applied_once(first, second, |o: &OrganiseOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    let stored = stored_task(&store, &task).await;
    assert_eq!(
        (stored.revision, stored.title),
        (Revision::new(2), "Bank".to_string())
    );
}

#[tokio::test]
async fn a_rename_whose_lookup_missed_a_committed_receipt_replays_it() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let applied = ok(rename_task(
        &store,
        &SystemClock,
        actor(),
        rename(&task, "op-r", 1, "Bank"),
    )
    .await);
    let gate = Gate::stale_lookup(&store);
    let replay = ok(rename_task(
        &gate,
        &SystemClock,
        actor(),
        rename(&task, "op-r", 1, "Bank"),
    )
    .await);
    assert!(replay.replayed);
    assert_eq!(replay.receipt, applied.receipt);
}

#[tokio::test]
async fn a_different_rename_racing_under_the_same_operation_id_conflicts() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::TaskLoad);
    let (first, second) = tokio::join!(
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-r", 1, "Bank")
        ),
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-r", 1, "Cash")
        ),
    );
    let conflict = DomainError::OperationConflict {
        operation_id: op("op-r"),
    };
    let winner = match (first, second) {
        (Ok(outcome), Err(error)) | (Err(error), Ok(outcome)) => {
            assert_eq!(error, conflict);
            outcome
        }
        other => panic!("expected one applied and one operation conflict, got {other:?}"),
    };
    assert!(!winner.replayed);
    let stored = stored_task(&store, &task).await;
    assert_eq!(stored.revision, Revision::new(2));
}

#[tokio::test]
async fn independent_renames_racing_at_the_same_revision_still_conflict() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::TaskLoad);
    let (first, second) = tokio::join!(
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-a", 1, "Bank")
        ),
        rename_task(
            &gate,
            &SystemClock,
            actor(),
            rename(&task, "op-b", 1, "Cash")
        ),
    );
    let conflict = DomainError::RevisionConflict {
        expected: Revision::new(1),
        actual: Revision::new(2),
    };
    match (first, second) {
        (Ok(_), Err(error)) | (Err(error), Ok(_)) => assert_eq!(error, conflict),
        other => panic!("expected one applied and one revision conflict, got {other:?}"),
    }
    assert_eq!(stored_task(&store, &task).await.revision, Revision::new(2));
}

// ---- Task states (Story 1.15) ----------------------------------------------------

fn state(task: &Task, id: &str, expected: u64, value: &str) -> RecordTaskState {
    RecordTaskState {
        operation_id: id.to_string(),
        expected_revision: Revision::new(expected),
        task_id: task.task_id.to_string(),
        dimension: "task".to_string(),
        scope_kind: "task".to_string(),
        scope_id: task.task_id.to_string(),
        value: value.to_string(),
        writer: StateWriter::System {
            reference: "inquello-desktop".to_string(),
        },
    }
}

async fn state_count(store: &SqliteWorkingStore, task: &Task) -> usize {
    task_states(store, actor(), &task.task_id.to_string())
        .await
        .unwrap_or_else(|error| panic!("{error}"))
        .records
        .len()
}

#[tokio::test]
async fn identical_state_writes_racing_record_one_state() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::StatesLoad);
    let (first, second) = tokio::join!(
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-s", 0, "planned")
        ),
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-s", 0, "planned")
        ),
    );
    let (applied, replay) = applied_once(first, second, |o: &StateOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(replay.record, applied.record);
    assert_eq!(state_count(&store, &task).await, 1);
}

#[tokio::test]
async fn a_state_write_whose_lookup_missed_a_committed_receipt_replays_it() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let applied = ok(record_task_state(
        &store,
        &SystemClock,
        actor(),
        state(&task, "op-s", 0, "planned"),
    )
    .await);
    let gate = Gate::stale_lookup(&store);
    let replay = ok(record_task_state(
        &gate,
        &SystemClock,
        actor(),
        state(&task, "op-s", 0, "planned"),
    )
    .await);
    assert!(replay.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(state_count(&store, &task).await, 1);
}

#[tokio::test]
async fn a_different_state_write_racing_under_the_same_operation_id_conflicts() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::StatesLoad);
    let (first, second) = tokio::join!(
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-s", 0, "planned")
        ),
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-s", 0, "running")
        ),
    );
    let conflict = DomainError::OperationConflict {
        operation_id: op("op-s"),
    };
    let winner = match (first, second) {
        (Ok(outcome), Err(error)) | (Err(error), Ok(outcome)) => {
            assert_eq!(error, conflict);
            outcome
        }
        other => panic!("expected one applied and one operation conflict, got {other:?}"),
    };
    assert!(!winner.replayed);
    assert_eq!(state_count(&store, &task).await, 1);
}

#[tokio::test]
async fn independent_state_writes_racing_at_the_same_revision_still_conflict() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let gate = Gate::racing(&store, Pause::StatesLoad);
    let (first, second) = tokio::join!(
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-a", 0, "planned")
        ),
        record_task_state(
            &gate,
            &SystemClock,
            actor(),
            state(&task, "op-b", 0, "running")
        ),
    );
    let conflict = DomainError::RevisionConflict {
        expected: Revision::ZERO,
        actual: Revision::new(1),
    };
    match (first, second) {
        (Ok(_), Err(error)) | (Err(error), Ok(_)) => assert_eq!(error, conflict),
        other => panic!("expected one applied and one revision conflict, got {other:?}"),
    }
    assert_eq!(state_count(&store, &task).await, 1);
}

// ---- Task broad modes (Story 1.18) -------------------------------------------------

/// A policy that permits both broad modes for the test Workspace.
fn open_policy() -> EffectivePolicy {
    let execution = ExecutionPolicy::from_value(&serde_json::json!({
        "sandbox": "full_access",
        "approvals": ["on_request", "never"],
        "network": "allowed",
        "allow_full_access": true,
        "allow_no_prompt": true,
    }))
    .unwrap_or_else(|error| panic!("{error}"));
    effective_policy(
        &WorkspaceLayer {
            workspace_id: WorkspaceId::parse(WORKSPACE).unwrap_or_else(|error| panic!("{error}")),
            policy_revision: Revision::new(2),
            authorization_epoch: Revision::new(2),
            execution: Some(execution),
        },
        &DeviceRequirements::default(),
        &UserConfig::default(),
    )
}

fn broad(task: &Task, id: &str, expected: u64, mode: &str, reach: &str) -> SetBroadMode {
    SetBroadMode {
        operation_id: id.to_string(),
        expected_revision: Revision::new(expected),
        task_id: task.task_id.to_string(),
        mode: mode.to_string(),
        confirmation: Some(reach.to_string()),
        writer: StateWriter::Human,
    }
}

const NO_PROMPT: &str = "No prompt: commands on this Task run inside the sandbox on this device, and you will not be asked before actions.";
const FULL_ACCESS: &str = "Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions.";

async fn broad_revision(store: &SqliteWorkingStore, task: &Task) -> Revision {
    store
        .load_broad_mode(task.task_id)
        .await
        .unwrap_or_else(|error| panic!("{error}"))
        .0
}

#[tokio::test]
async fn identical_broad_mode_writes_racing_record_one_mode() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let policy = open_policy();
    let gate = Gate::racing(&store, Pause::BroadModeLoad);
    let (first, second) = tokio::join!(
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-b", 0, "no_prompt", NO_PROMPT)
        ),
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-b", 0, "no_prompt", NO_PROMPT)
        ),
    );
    let (applied, replay) = applied_once(first, second, |o: &BroadModeOutcome| o.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(replay.record, applied.record);
    assert_eq!(broad_revision(&store, &task).await, Revision::new(1));
}

#[tokio::test]
async fn a_broad_mode_write_whose_lookup_missed_a_committed_receipt_replays_it() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let policy = open_policy();
    let applied = ok(set_broad_mode(
        &store,
        &SystemClock,
        actor(),
        &policy,
        broad(&task, "op-b", 0, "no_prompt", NO_PROMPT),
    )
    .await);
    let gate = Gate::stale_lookup(&store);
    let replay = ok(set_broad_mode(
        &gate,
        &SystemClock,
        actor(),
        &policy,
        broad(&task, "op-b", 0, "no_prompt", NO_PROMPT),
    )
    .await);
    assert!(replay.replayed);
    assert_eq!(replay.receipt, applied.receipt);
    assert_eq!(broad_revision(&store, &task).await, Revision::new(1));
}

#[tokio::test]
async fn a_different_broad_mode_write_racing_under_the_same_operation_id_conflicts() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let policy = open_policy();
    let gate = Gate::racing(&store, Pause::BroadModeLoad);
    let (first, second) = tokio::join!(
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-b", 0, "no_prompt", NO_PROMPT)
        ),
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-b", 0, "full_access", FULL_ACCESS)
        ),
    );
    let conflict = DomainError::OperationConflict {
        operation_id: op("op-b"),
    };
    match (first, second) {
        (Ok(outcome), Err(error)) | (Err(error), Ok(outcome)) => {
            assert_eq!(error, conflict);
            assert!(!outcome.replayed);
        }
        other => panic!("expected one applied and one operation conflict, got {other:?}"),
    }
    assert_eq!(broad_revision(&store, &task).await, Revision::new(1));
}

#[tokio::test]
async fn independent_broad_mode_writes_racing_at_the_same_revision_still_conflict() {
    let (_dir, store) = open().await;
    let task = new_task(&store).await;
    let policy = open_policy();
    let gate = Gate::racing(&store, Pause::BroadModeLoad);
    let (first, second) = tokio::join!(
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-x", 0, "no_prompt", NO_PROMPT)
        ),
        set_broad_mode(
            &gate,
            &SystemClock,
            actor(),
            &policy,
            broad(&task, "op-y", 0, "full_access", FULL_ACCESS)
        ),
    );
    let conflict = DomainError::RevisionConflict {
        expected: Revision::ZERO,
        actual: Revision::new(1),
    };
    match (first, second) {
        (Ok(_), Err(error)) | (Err(error), Ok(_)) => assert_eq!(error, conflict),
        other => panic!("expected one applied and one revision conflict, got {other:?}"),
    }
    assert_eq!(broad_revision(&store, &task).await, Revision::new(1));
}
