//! Story 1.22 persistence/privacy/race tests. These do not prove live inference.
use inquello_adapters::{SqliteWorkingStore, SystemClock};
use inquello_domain::organise::{Actor, CreateTask, OrganiseRecord, OrganiseStore, PrincipalId, Task, create_task};
use inquello_domain::routes::*;
use inquello_domain::{DomainError, Revision};
use tempfile::TempDir;
use uuid::Uuid;

fn ok<T, E: std::fmt::Debug>(value: Result<T, E>) -> T {
    value.unwrap_or_else(|error| panic!("unexpected error: {error:?}"))
}
fn actor(n: u8) -> Actor { Actor { principal_id: PrincipalId::from_uuid(Uuid::from_bytes([n; 16])) } }
async fn open(dir: &TempDir) -> SqliteWorkingStore {
    ok(SqliteWorkingStore::open(&dir.path().join("working.sqlite"), &[]).await)
}
async fn task(store: &SqliteWorkingStore, actor: Actor) -> Task {
    let outcome = ok(create_task(store, &SystemClock, actor, CreateTask {
        operation_id: format!("task-{}", Uuid::new_v4()), expected_revision: Revision::ZERO,
        workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(), engagement_id: None, folder_id: None,
        title: "Private route task".into(),
    }).await);
    match outcome.record { OrganiseRecord::Task(task) => task, other => panic!("not a Task: {other:?}") }
}
fn configuration(route_id: RouteId) -> RouteConfigurationInput {
    match route_id {
        RouteId::ClaudeApiKey => RouteConfigurationInput {
            route_id: route_id.as_str().into(), deployment: "anthropic-direct".into(), model: CLAUDE_MODEL.into(),
            api_version: CLAUDE_API_VERSION.into(), account_ref: "11111111-1111-4111-8111-111111111111".into(), region: None,
        },
        RouteId::CodexResponses => RouteConfigurationInput {
            route_id: route_id.as_str().into(), deployment: "openai-api".into(), model: "fixture-model-20261030".into(),
            api_version: "responses-v1".into(), account_ref: "22222222-2222-4222-8222-222222222222".into(), region: None,
        },
    }
}
fn configure(id: &str, revision: u64, route_id: RouteId) -> ConfigureRoute {
    ConfigureRoute { operation_id: id.into(), expected_revision: Revision::new(revision), configuration: configuration(route_id) }
}
fn select(id: &str, revision: u64, task: &Task, route_id: RouteId, configuration_revision: u64) -> SetTaskRoute {
    SetTaskRoute { operation_id: id.into(), expected_revision: Revision::new(revision), task_id: task.task_id.to_string(),
        route_id: route_id.as_str().into(), configuration_revision: Revision::new(configuration_revision) }
}

#[tokio::test]
async fn explicit_selection_reopens_without_changing_task_organisation_revision() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1); let task = task(&store, owner).await;
    let before = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert_eq!(before.revision, Revision::ZERO); assert_eq!(before.current, None);
    assert!(set_task_route(&store, &SystemClock, owner, select("missing", 0, &task, RouteId::ClaudeApiKey, 0)).await.is_err());
    for id in RouteId::ALL { ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await); }
    let first = ok(set_task_route(&store, &SystemClock, owner, select("select-claude", 0, &task, RouteId::ClaudeApiKey, 1)).await);
    assert_eq!(first.record.configuration.endpoint(), CLAUDE_ENDPOINT);
    assert_eq!(first.record.configuration.region(), None);
    let second = ok(set_task_route(&store, &SystemClock, owner, select("select-codex", 1, &task, RouteId::CodexResponses, 1)).await);
    assert_eq!(second.record.revision, Revision::new(2));
    store.close().await;
    let reopened = open(&dir).await;
    let selected = ok(task_route(&reopened, owner, &task.task_id.to_string()).await);
    assert_eq!(selected.current, Some(second.record)); assert!(!selected.stale_configuration);
    // Organisation is never written by either route command.
    let task_row = ok(reopened.load_task(task.task_id).await).unwrap_or_else(|| panic!("Task missing"));
    assert_eq!(task_row.revision, task.revision);
}

#[tokio::test]
async fn other_principal_is_unknown_even_with_real_operation_id() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1); let other = actor(2); let task = task(&store, owner).await;
    ok(configure_route(&store, &SystemClock, owner, configure("candidate", 0, RouteId::ClaudeApiKey)).await);
    let command = select("selection", 0, &task, RouteId::ClaudeApiKey, 1);
    ok(set_task_route(&store, &SystemClock, owner, command.clone()).await);
    assert_eq!(task_route(&store, other, &task.task_id.to_string()).await, Err(DomainError::NotFound));
    assert_eq!(set_task_route(&store, &SystemClock, other, command).await, Err(DomainError::NotFound));
    assert!(ok(candidate_routes(&store, other).await).is_empty());
}

#[tokio::test]
async fn candidate_replacement_stales_selection_and_requires_explicit_reselection() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1); let task = task(&store, owner).await;
    ok(configure_route(&store, &SystemClock, owner, configure("candidate", 0, RouteId::ClaudeApiKey)).await);
    let selected = ok(set_task_route(&store, &SystemClock, owner, select("selection", 0, &task, RouteId::ClaudeApiKey, 1)).await);
    let mut replacement = configure("replace", 1, RouteId::ClaudeApiKey);
    replacement.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    ok(configure_route(&store, &SystemClock, owner, replacement).await);
    let stale = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert!(stale.stale_configuration); assert_eq!(stale.current, Some(selected.record));
    assert!(matches!(set_task_route(&store, &SystemClock, owner, select("stale", 1, &task, RouteId::ClaudeApiKey, 1)).await, Err(DomainError::RevisionConflict { .. })));
    ok(set_task_route(&store, &SystemClock, owner, select("reselect", 1, &task, RouteId::ClaudeApiKey, 2)).await);
    assert!(!ok(task_route(&store, owner, &task.task_id.to_string()).await).stale_configuration);
}

#[tokio::test]
async fn same_operation_is_replayed_once_and_different_payload_is_refused() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1); let task = task(&store, owner).await;
    let config = configure("candidate", 0, RouteId::ClaudeApiKey);
    let first = ok(configure_route(&store, &SystemClock, owner, config.clone()).await);
    let replay = ok(configure_route(&store, &SystemClock, owner, config.clone()).await);
    assert!(replay.replayed); assert_eq!(first.record, replay.record);
    let mut changed = config; changed.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    assert!(matches!(configure_route(&store, &SystemClock, owner, changed).await, Err(DomainError::OperationConflict { .. })));
    let selection = select("selection", 0, &task, RouteId::ClaudeApiKey, 1);
    let (left, right) = tokio::join!(
        set_task_route(&store, &SystemClock, owner, selection.clone()),
        set_task_route(&store, &SystemClock, owner, selection.clone()),
    );
    let left = ok(left); let right = ok(right);
    assert_eq!(left.record, right.record); assert_ne!(left.replayed, right.replayed);
    assert_eq!(ok(task_route(&store, owner, &task.task_id.to_string()).await).revision, Revision::new(1));
    let mut different = selection; different.expected_revision = Revision::new(1);
    assert!(matches!(set_task_route(&store, &SystemClock, owner, different).await, Err(DomainError::OperationConflict { .. })));
}

#[tokio::test]
async fn competing_selections_have_one_atomic_winner_and_receipt() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1); let task = task(&store, owner).await;
    for id in RouteId::ALL { ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await); }
    let (left, right) = tokio::join!(
        set_task_route(&store, &SystemClock, owner, select("left", 0, &task, RouteId::ClaudeApiKey, 1)),
        set_task_route(&store, &SystemClock, owner, select("right", 0, &task, RouteId::CodexResponses, 1)),
    );
    assert_ne!(left.is_ok(), right.is_ok());
    let error = if let Err(error) = left { error } else { right.err().unwrap_or_else(|| panic!("one conflict required")) };
    assert!(matches!(error, DomainError::RevisionConflict { .. }));
    let selection = ok(task_route(&store, owner, &task.task_id.to_string()).await);
    assert_eq!(selection.revision, Revision::new(1));
    let winner = selection.current.unwrap_or_else(|| panic!("selection missing"));
    assert!(!route_eligibility(Some(&winner.configuration), true, true, DataTier::Synthetic).enabled);
}

#[tokio::test]
async fn rejected_config_does_not_record_receipt_or_change_selection() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1);
    let mut command = configure("invalid", 0, RouteId::ClaudeApiKey);
    command.configuration.account_ref = "sk-ant-secret-sentinel".into();
    assert!(configure_route(&store, &SystemClock, owner, command).await.is_err());
    assert!(ok(candidate_routes(&store, owner).await).is_empty());
    assert!(ok(store.find_candidate_route_receipt(&ok(inquello_domain::OperationId::parse("invalid"))).await).is_none());
}

#[tokio::test]
async fn candidate_configuration_race_and_failed_commit_are_atomic() {
    let dir = ok(TempDir::new()); let store = open(&dir).await; let owner = actor(1);
    let command = configure("configure-once", 0, RouteId::ClaudeApiKey);
    let (left, right) = tokio::join!(
        configure_route(&store, &SystemClock, owner, command.clone()),
        configure_route(&store, &SystemClock, owner, command),
    );
    let left = ok(left); let right = ok(right);
    assert_eq!(left.record, right.record); assert_ne!(left.replayed, right.replayed);
    let invalid = CandidateRouteChange {
        expected_revision: Revision::new(1), record: left.record.clone(), receipt: left.receipt.clone(),
    };
    assert!(store.commit_candidate_route(invalid).await.is_err());
    let current = ok(candidate_routes(&store, owner).await);
    assert_eq!(current, vec![left.record]);
}

#[tokio::test]
async fn selecting_one_task_leaves_other_task_route_and_revision_unchanged() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    let first = task(&store, owner).await;
    let second = task(&store, owner).await;
    for id in RouteId::ALL {
        ok(configure_route(&store, &SystemClock, owner, configure(id.as_str(), 0, id)).await);
    }
    ok(set_task_route(&store, &SystemClock, owner, select("first-initial", 0, &first, RouteId::ClaudeApiKey, 1)).await);
    ok(set_task_route(&store, &SystemClock, owner, select("second-initial", 0, &second, RouteId::ClaudeApiKey, 1)).await);
    let second_before = ok(task_route(&store, owner, &second.task_id.to_string()).await);
    ok(set_task_route(&store, &SystemClock, owner, select("first-switch", 1, &first, RouteId::CodexResponses, 1)).await);
    assert_eq!(ok(task_route(&store, owner, &second.task_id.to_string()).await), second_before);
    assert_eq!(ok(task_route(&store, owner, &first.task_id.to_string()).await).revision, Revision::new(2));
}

#[tokio::test]
async fn stale_configuration_draft_cannot_overwrite_a_newer_window() {
    let dir = ok(TempDir::new());
    let store = open(&dir).await;
    let owner = actor(1);
    ok(configure_route(&store, &SystemClock, owner, configure("initial", 0, RouteId::ClaudeApiKey)).await);
    let stale_draft = configure("stale-draft", 1, RouteId::ClaudeApiKey);
    let mut newer = configure("other-window", 1, RouteId::ClaudeApiKey);
    newer.configuration.account_ref = "33333333-3333-4333-8333-333333333333".into();
    let current = ok(configure_route(&store, &SystemClock, owner, newer).await);
    assert!(matches!(configure_route(&store, &SystemClock, owner, stale_draft).await,
        Err(DomainError::RevisionConflict { expected, actual })
        if expected == Revision::new(1) && actual == Revision::new(2)));
    assert_eq!(ok(candidate_routes(&store, owner).await), vec![current.record]);
    assert!(ok(store.find_candidate_route_receipt(&ok(inquello_domain::OperationId::parse("stale-draft"))).await).is_none());
}
