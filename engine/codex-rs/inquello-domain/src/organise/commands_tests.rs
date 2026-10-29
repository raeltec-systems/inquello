//! The Story 1.14 I/O matrix at the domain level, against an in-memory port with
//! the same atomic compare-and-set contract as the SQLite adapter.

use super::*;
use crate::model::Timestamp;
use pretty_assertions::assert_eq;
use std::collections::HashMap;
use std::pin::pin;
use std::sync::Mutex;
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

#[derive(Default)]
struct FakeState {
    receipts: HashMap<OperationId, OrganiseReceipt>,
    engagements: HashMap<EngagementId, Engagement>,
    folders: HashMap<FolderId, Folder>,
    tasks: HashMap<TaskId, Task>,
    labels: HashMap<(PrincipalId, WorkspaceId), WorkspaceLabel>,
}

#[derive(Default)]
struct FakeStore {
    state: Mutex<FakeState>,
}

impl FakeStore {
    fn with<T>(&self, f: impl FnOnce(&mut FakeState) -> T) -> T {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        f(&mut state)
    }

    fn counts(&self) -> (usize, usize, usize, usize) {
        self.with(|s| {
            (
                s.engagements.len(),
                s.folders.len(),
                s.tasks.len(),
                s.receipts.len(),
            )
        })
    }
}

impl OrganiseStore for FakeStore {
    async fn find_organise_receipt(
        &self,
        operation_id: &OperationId,
    ) -> Result<Option<OrganiseReceipt>, StoreError> {
        Ok(self.with(|s| s.receipts.get(operation_id).cloned()))
    }

    async fn load_engagement(&self, id: EngagementId) -> Result<Option<Engagement>, StoreError> {
        Ok(self.with(|s| s.engagements.get(&id).cloned()))
    }

    async fn find_engagement_by_service_id(
        &self,
        id: ServiceEngagementId,
    ) -> Result<Option<Engagement>, StoreError> {
        Ok(self.with(|s| {
            s.engagements
                .values()
                .find(|e| e.service_engagement_id == id)
                .cloned()
        }))
    }

    async fn load_folder(&self, id: FolderId) -> Result<Option<Folder>, StoreError> {
        Ok(self.with(|s| s.folders.get(&id).cloned()))
    }

    async fn load_task(&self, id: TaskId) -> Result<Option<Task>, StoreError> {
        Ok(self.with(|s| s.tasks.get(&id).cloned()))
    }

    async fn load_workspace_label(
        &self,
        principal_id: PrincipalId,
        workspace_id: WorkspaceId,
    ) -> Result<Option<WorkspaceLabel>, StoreError> {
        Ok(self.with(|s| s.labels.get(&(principal_id, workspace_id)).cloned()))
    }

    async fn commit_organise(&self, change: OrganiseChange) -> Result<(), StoreError> {
        self.with(|s| {
            let actual = match &change.record {
                OrganiseRecord::Engagement(r) => {
                    s.engagements.get(&r.engagement_id).map(|x| x.revision)
                }
                OrganiseRecord::Folder(r) => s.folders.get(&r.folder_id).map(|x| x.revision),
                OrganiseRecord::Task(r) => s.tasks.get(&r.task_id).map(|x| x.revision),
                OrganiseRecord::WorkspaceLabel(r) => s
                    .labels
                    .get(&(r.principal_id, r.workspace_id))
                    .map(|x| x.revision),
            }
            .unwrap_or(Revision::ZERO);
            if actual != change.expected_revision {
                return Err(StoreError::RevisionConflict {
                    expected: change.expected_revision,
                    actual,
                });
            }
            if s.receipts.contains_key(&change.receipt.operation_id) {
                return Err(StoreError::DuplicateOperation {
                    operation_id: change.receipt.operation_id,
                });
            }
            match change.record {
                OrganiseRecord::Engagement(r) => {
                    s.engagements.insert(r.engagement_id, r);
                }
                OrganiseRecord::Folder(r) => {
                    s.folders.insert(r.folder_id, r);
                }
                OrganiseRecord::Task(r) => {
                    s.tasks.insert(r.task_id, r);
                }
                OrganiseRecord::WorkspaceLabel(r) => {
                    s.labels.insert((r.principal_id, r.workspace_id), r);
                }
            }
            s.receipts
                .insert(change.receipt.operation_id.clone(), change.receipt);
            Ok(())
        })
    }

    async fn load_workspace_tree(
        &self,
        workspace_id: WorkspaceId,
        creator: PrincipalId,
    ) -> Result<WorkspaceTree, StoreError> {
        Ok(self.with(|s| WorkspaceTree {
            engagements: s
                .engagements
                .values()
                .filter(|e| e.workspace_id == workspace_id)
                .cloned()
                .collect(),
            folders: s
                .folders
                .values()
                .filter(|f| f.workspace_id == workspace_id)
                .cloned()
                .collect(),
            tasks: s
                .tasks
                .values()
                .filter(|t| t.workspace_id == workspace_id && t.creator_principal_id == creator)
                .cloned()
                .collect(),
        }))
    }

    async fn load_known_workspaces(
        &self,
        principal_id: PrincipalId,
    ) -> Result<Vec<KnownWorkspace>, StoreError> {
        Ok(self.with(|s| {
            let mut ids: Vec<WorkspaceId> = s
                .labels
                .keys()
                .filter(|(p, _)| *p == principal_id)
                .map(|(_, w)| *w)
                .chain(
                    s.tasks
                        .values()
                        .filter(|t| t.creator_principal_id == principal_id)
                        .map(|t| t.workspace_id),
                )
                .collect();
            ids.sort();
            ids.dedup();
            ids.into_iter()
                .map(|workspace_id| KnownWorkspace {
                    workspace_id,
                    label: s.labels.get(&(principal_id, workspace_id)).cloned(),
                })
                .collect()
        }))
    }
}

struct FixedClock;

impl Clock for FixedClock {
    fn now(&self) -> Timestamp {
        Timestamp::from_unix_millis(1_700_000_000_000)
    }
}

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const OTHER_WORKSPACE: &str = "6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f";
const SERVICE_ENGAGEMENT: &str = "1f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b";
const SERVICE_ENGAGEMENT_2: &str = "2f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b";
const SERVICE_ENGAGEMENT_3: &str = "3f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b";

fn actor(n: u8) -> Actor {
    let uuid = Uuid::from_bytes([n; 16]);
    Actor {
        principal_id: PrincipalId::from_uuid(uuid),
    }
}

fn create_engagement_cmd(op: &str, workspace: &str, service: &str) -> CreateEngagement {
    CreateEngagement {
        operation_id: op.to_string(),
        expected_revision: Revision::ZERO,
        workspace_id: workspace.to_string(),
        service_engagement_id: service.to_string(),
        name: "FY26 audit".to_string(),
        objectives: "Opinion on FY26 statements".to_string(),
        scope: "Group entities".to_string(),
        client_entity: Some("Synthetic Client Ltd".to_string()),
        period_start: Some("2026-01-01".to_string()),
        period_end: Some("2026-12-31".to_string()),
    }
}

fn engagement_of(outcome: &OrganiseOutcome) -> Engagement {
    match &outcome.record {
        OrganiseRecord::Engagement(e) => e.clone(),
        other => panic!("expected an Engagement, got {other:?}"),
    }
}

fn folder_of(outcome: &OrganiseOutcome) -> Folder {
    match &outcome.record {
        OrganiseRecord::Folder(f) => f.clone(),
        other => panic!("expected a folder, got {other:?}"),
    }
}

fn task_of(outcome: &OrganiseOutcome) -> Task {
    match &outcome.record {
        OrganiseRecord::Task(t) => t.clone(),
        other => panic!("expected a Task, got {other:?}"),
    }
}

fn ok<T>(result: Result<T, DomainError>) -> T {
    result.unwrap_or_else(|error| panic!("command failed: {error}"))
}

fn new_engagement(store: &FakeStore, op: &str, workspace: &str, service: &str) -> Engagement {
    engagement_of(&ok(block_on(create_engagement(
        store,
        &FixedClock,
        actor(1),
        create_engagement_cmd(op, workspace, service),
    ))))
}

fn new_folder(store: &FakeStore, op: &str, engagement: &Engagement) -> Folder {
    folder_of(&ok(block_on(create_folder(
        store,
        &FixedClock,
        actor(1),
        CreateFolder {
            operation_id: op.to_string(),
            expected_revision: Revision::ZERO,
            workspace_id: engagement.workspace_id.to_string(),
            engagement_id: engagement.engagement_id.to_string(),
            name: "Planning".to_string(),
        },
    ))))
}

fn task_cmd(op: &str, engagement: Option<&Engagement>, folder: Option<&Folder>) -> CreateTask {
    CreateTask {
        operation_id: op.to_string(),
        expected_revision: Revision::ZERO,
        workspace_id: WORKSPACE.to_string(),
        engagement_id: engagement.map(|e| e.engagement_id.to_string()),
        folder_id: folder.map(|f| f.folder_id.to_string()),
        title: "Untitled thread".to_string(),
    }
}

fn new_task(
    store: &FakeStore,
    who: Actor,
    op: &str,
    engagement: Option<&Engagement>,
    folder: Option<&Folder>,
) -> Task {
    task_of(&ok(block_on(create_task(
        store,
        &FixedClock,
        who,
        task_cmd(op, engagement, folder),
    ))))
}

#[test]
fn create_engagement_records_service_link_client_and_period() {
    let store = FakeStore::default();
    let outcome = ok(block_on(create_engagement(
        &store,
        &FixedClock,
        actor(1),
        create_engagement_cmd("op-e1", WORKSPACE, SERVICE_ENGAGEMENT),
    )));
    let engagement = engagement_of(&outcome);
    assert!(!outcome.replayed);
    assert_eq!(engagement.revision, Revision::new(1));
    assert_eq!(engagement.workspace_id.to_string(), WORKSPACE);
    assert_eq!(
        engagement.service_engagement_id.to_string(),
        SERVICE_ENGAGEMENT
    );
    assert_eq!(
        engagement.client_entity.as_deref(),
        Some("Synthetic Client Ltd")
    );
    assert_eq!(
        engagement.period_start.as_ref().map(PeriodDate::as_str),
        Some("2026-01-01")
    );
    assert_eq!(
        engagement.period_end.as_ref().map(PeriodDate::as_str),
        Some("2026-12-31")
    );
    assert_eq!(
        outcome.receipt.command,
        OrganiseCommandKind::CreateEngagement
    );
    assert_eq!(
        outcome.receipt.resource_id,
        *engagement.engagement_id.as_uuid()
    );
    assert_eq!(outcome.receipt.expected_revision, Revision::ZERO);
    assert_eq!(outcome.receipt.resulting_revision, Revision::new(1));

    // One local record per shared-service Engagement.
    let again = block_on(create_engagement(
        &store,
        &FixedClock,
        actor(1),
        create_engagement_cmd("op-e2", WORKSPACE, SERVICE_ENGAGEMENT),
    ));
    assert!(
        matches!(again, Err(DomainError::InvalidCommand(_))),
        "{again:?}"
    );
    assert_eq!(store.counts().0, 1);
}

#[test]
fn engagement_input_is_validated_before_the_store() {
    let store = FakeStore::default();
    let mut bad_period = create_engagement_cmd("op-1", WORKSPACE, SERVICE_ENGAGEMENT);
    bad_period.period_start = Some("2026-12-31".to_string());
    bad_period.period_end = Some("2026-01-01".to_string());
    let mut bad_name = create_engagement_cmd("op-2", WORKSPACE, SERVICE_ENGAGEMENT);
    bad_name.name = "  ".to_string();
    let mut bad_workspace = create_engagement_cmd("op-3", WORKSPACE, SERVICE_ENGAGEMENT);
    bad_workspace.workspace_id = "workspace".to_string();
    let bad_op = create_engagement_cmd("", WORKSPACE, SERVICE_ENGAGEMENT);
    let mut not_creation = create_engagement_cmd("op-4", WORKSPACE, SERVICE_ENGAGEMENT);
    not_creation.expected_revision = Revision::new(3);
    for command in [bad_period, bad_name, bad_workspace, bad_op] {
        let result = block_on(create_engagement(&store, &FixedClock, actor(1), command));
        assert!(
            matches!(result, Err(DomainError::InvalidCommand(_))),
            "{result:?}"
        );
    }
    assert_eq!(
        block_on(create_engagement(
            &store,
            &FixedClock,
            actor(1),
            not_creation
        )),
        Err(DomainError::RevisionConflict {
            expected: Revision::new(3),
            actual: Revision::ZERO,
        })
    );
    assert_eq!(store.counts(), (0, 0, 0, 0));
}

#[test]
fn update_engagement_edits_fields_and_checks_revision() {
    let store = FakeStore::default();
    let engagement = new_engagement(&store, "op-e", WORKSPACE, SERVICE_ENGAGEMENT);
    let update = |op: &str, expected: u64| UpdateEngagement {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        workspace_id: WORKSPACE.to_string(),
        engagement_id: engagement.engagement_id.to_string(),
        name: "FY26 group audit".to_string(),
        objectives: String::new(),
        scope: "All entities".to_string(),
        client_entity: None,
        period_start: None,
        period_end: Some("2026-12-31".to_string()),
    };
    let updated = engagement_of(&ok(block_on(update_engagement(
        &store,
        &FixedClock,
        actor(2),
        update("op-u1", 1),
    ))));
    assert_eq!(updated.engagement_id, engagement.engagement_id);
    assert_eq!(
        updated.service_engagement_id,
        engagement.service_engagement_id
    );
    assert_eq!(updated.name, "FY26 group audit");
    assert_eq!(updated.client_entity, None);
    assert_eq!(updated.revision, Revision::new(2));
    assert_eq!(
        block_on(update_engagement(
            &store,
            &FixedClock,
            actor(1),
            update("op-u2", 1)
        )),
        Err(DomainError::RevisionConflict {
            expected: Revision::new(1),
            actual: Revision::new(2),
        })
    );
    let mut elsewhere = update("op-u3", 2);
    elsewhere.workspace_id = OTHER_WORKSPACE.to_string();
    assert_eq!(
        block_on(update_engagement(&store, &FixedClock, actor(1), elsewhere)),
        Err(DomainError::NotFound)
    );
}

#[test]
fn ad_hoc_task_has_no_engagement_and_is_private_to_its_creator() {
    let store = FakeStore::default();
    let task = new_task(&store, actor(1), "op-t", None, None);
    assert_eq!(task.engagement_id, None);
    assert_eq!(task.folder_id, None);
    assert_eq!(task.creator_principal_id, actor(1).principal_id);
    assert_eq!(task.visibility, Visibility::Private);
    assert_eq!(task.runtime_thread_id, None);
    assert!(task.source_refs.is_empty() && task.artifact_refs.is_empty());
    assert_eq!(task.revision, Revision::new(1));
    let tree = ok(block_on(workspace_tree(&store, actor(1), WORKSPACE)));
    assert_eq!(tree.tasks, vec![task]);
}

#[test]
fn folder_and_task_are_listed_under_engagement_then_folder() {
    let store = FakeStore::default();
    let engagement = new_engagement(&store, "op-e", WORKSPACE, SERVICE_ENGAGEMENT);
    let folder = new_folder(&store, "op-f", &engagement);
    assert_eq!(folder.engagement_id, engagement.engagement_id);
    let task = new_task(&store, actor(1), "op-t", Some(&engagement), Some(&folder));
    let tree = ok(block_on(workspace_tree(&store, actor(1), WORKSPACE)));
    assert_eq!(tree.engagements, vec![engagement.clone()]);
    assert_eq!(tree.folders, vec![folder.clone()]);
    assert_eq!(tree.tasks.len(), 1);
    assert_eq!(tree.tasks[0].engagement_id, Some(engagement.engagement_id));
    assert_eq!(tree.tasks[0].folder_id, Some(folder.folder_id));
    assert_eq!(tree.tasks[0].task_id, task.task_id);

    // A folder needs its Engagement, and must be that Engagement's.
    let other = new_engagement(&store, "op-e2", WORKSPACE, SERVICE_ENGAGEMENT_2);
    let orphan = block_on(create_task(
        &store,
        &FixedClock,
        actor(1),
        task_cmd("op-x", None, Some(&folder)),
    ));
    assert!(
        matches!(orphan, Err(DomainError::InvalidCommand(_))),
        "{orphan:?}"
    );
    let wrong = block_on(create_task(
        &store,
        &FixedClock,
        actor(1),
        task_cmd("op-y", Some(&other), Some(&folder)),
    ));
    assert!(
        matches!(wrong, Err(DomainError::InvalidCommand(_))),
        "{wrong:?}"
    );
}

#[test]
fn move_keeps_identity_thread_ref_references_and_visibility() {
    let store = FakeStore::default();
    let first = new_engagement(&store, "op-e1", WORKSPACE, SERVICE_ENGAGEMENT);
    let second = new_engagement(&store, "op-e2", WORKSPACE, SERVICE_ENGAGEMENT_2);
    let folder = new_folder(&store, "op-f", &second);
    let task = new_task(&store, actor(1), "op-t", Some(&first), None);
    let attached = task_of(&ok(block_on(attach_thread(
        &store,
        &FixedClock,
        actor(1),
        AttachThread {
            operation_id: "op-a".to_string(),
            expected_revision: Revision::new(1),
            workspace_id: WORKSPACE.to_string(),
            task_id: task.task_id.to_string(),
            runtime_thread_id: "thread-synthetic-1".to_string(),
        },
    ))));
    let moved = task_of(&ok(block_on(move_task(
        &store,
        &FixedClock,
        actor(1),
        MoveTask {
            operation_id: "op-m".to_string(),
            expected_revision: Revision::new(2),
            workspace_id: WORKSPACE.to_string(),
            task_id: task.task_id.to_string(),
            engagement_id: Some(second.engagement_id.to_string()),
            folder_id: Some(folder.folder_id.to_string()),
        },
    ))));
    assert_eq!(moved.task_id, task.task_id);
    assert_eq!(
        moved.runtime_thread_id.as_deref(),
        Some("thread-synthetic-1")
    );
    assert_eq!(moved.source_refs, attached.source_refs);
    assert_eq!(moved.artifact_refs, attached.artifact_refs);
    assert_eq!(moved.visibility, Visibility::Private);
    assert_eq!(moved.creator_principal_id, task.creator_principal_id);
    assert_eq!(moved.engagement_id, Some(second.engagement_id));
    assert_eq!(moved.folder_id, Some(folder.folder_id));
    assert_eq!(moved.revision, Revision::new(3));

    // To none: an ad hoc Task again, same ID.
    let ad_hoc = task_of(&ok(block_on(move_task(
        &store,
        &FixedClock,
        actor(1),
        MoveTask {
            operation_id: "op-m2".to_string(),
            expected_revision: Revision::new(3),
            workspace_id: WORKSPACE.to_string(),
            task_id: task.task_id.to_string(),
            engagement_id: None,
            folder_id: None,
        },
    ))));
    assert_eq!(
        (ad_hoc.task_id, ad_hoc.engagement_id, ad_hoc.folder_id),
        (task.task_id, None, None)
    );
}

#[test]
fn move_to_an_engagement_of_another_workspace_is_rejected() {
    let store = FakeStore::default();
    let elsewhere = new_engagement(&store, "op-e", OTHER_WORKSPACE, SERVICE_ENGAGEMENT_3);
    let task = new_task(&store, actor(1), "op-t", None, None);
    let result = block_on(move_task(
        &store,
        &FixedClock,
        actor(1),
        MoveTask {
            operation_id: "op-m".to_string(),
            expected_revision: Revision::new(1),
            workspace_id: WORKSPACE.to_string(),
            task_id: task.task_id.to_string(),
            engagement_id: Some(elsewhere.engagement_id.to_string()),
            folder_id: None,
        },
    ));
    assert_eq!(result, Err(DomainError::WorkspaceMismatch));
    let unchanged = block_on(store.load_task(task.task_id)).ok().flatten();
    assert_eq!(unchanged, Some(task));
}

#[test]
fn stale_revision_rename_is_rejected_and_writes_nothing() {
    let store = FakeStore::default();
    let task = new_task(&store, actor(1), "op-t", None, None);
    let rename = |op: &str, expected: u64, title: &str| RenameTask {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        workspace_id: WORKSPACE.to_string(),
        task_id: task.task_id.to_string(),
        title: title.to_string(),
    };
    let renamed = task_of(&ok(block_on(rename_task(
        &store,
        &FixedClock,
        actor(1),
        rename("op-r1", 1, "Bank confirmations"),
    ))));
    assert_eq!(renamed.title, "Bank confirmations");
    let before = store.counts();
    assert_eq!(
        block_on(rename_task(
            &store,
            &FixedClock,
            actor(1),
            rename("op-r2", 1, "Stale draft")
        )),
        Err(DomainError::RevisionConflict {
            expected: Revision::new(1),
            actual: Revision::new(2),
        })
    );
    assert_eq!(store.counts(), before);
    assert_eq!(
        block_on(store.load_task(task.task_id))
            .ok()
            .flatten()
            .map(|t| t.title),
        Some("Bank confirmations".to_string())
    );
}

#[test]
fn replay_returns_the_recorded_outcome_without_a_duplicate() {
    let store = FakeStore::default();
    let first = ok(block_on(create_task(
        &store,
        &FixedClock,
        actor(1),
        task_cmd("op-t", None, None),
    )));
    let again = ok(block_on(create_task(
        &store,
        &FixedClock,
        actor(1),
        task_cmd("op-t", None, None),
    )));
    assert!(again.replayed);
    assert_eq!(again.receipt, first.receipt);
    assert_eq!(again.record, first.record);
    assert_eq!(store.counts(), (0, 0, 1, 1));

    // The same operation ID with another request, or for another principal.
    let mut other_title = task_cmd("op-t", None, None);
    other_title.title = "Different".to_string();
    for (who, command) in [
        (actor(1), other_title),
        (actor(2), task_cmd("op-t", None, None)),
    ] {
        let result = block_on(create_task(&store, &FixedClock, who, command));
        assert!(
            matches!(result, Err(DomainError::OperationConflict { .. })),
            "{result:?}"
        );
    }
    assert_eq!(store.counts(), (0, 0, 1, 1));
}

#[test]
fn another_creators_task_is_never_listed_or_reachable() {
    let store = FakeStore::default();
    let engagement = new_engagement(&store, "op-e", WORKSPACE, SERVICE_ENGAGEMENT);
    let mine = new_task(&store, actor(1), "op-t1", Some(&engagement), None);
    let theirs = new_task(&store, actor(2), "op-t2", Some(&engagement), None);
    let tree = ok(block_on(workspace_tree(&store, actor(1), WORKSPACE)));
    assert_eq!(
        tree.tasks.iter().map(|t| t.task_id).collect::<Vec<_>>(),
        vec![mine.task_id]
    );
    assert_eq!(tree.engagements.len(), 1);

    // Acting on the other creator's Task looks exactly like an unknown Task.
    let unknown = TaskId::new_random();
    for task_id in [theirs.task_id, unknown] {
        let result = block_on(rename_task(
            &store,
            &FixedClock,
            actor(1),
            RenameTask {
                operation_id: format!("op-r-{task_id}"),
                expected_revision: Revision::new(1),
                workspace_id: WORKSPACE.to_string(),
                task_id: task_id.to_string(),
                title: "Mine now".to_string(),
            },
        ));
        assert_eq!(result, Err(DomainError::NotFound));
    }
    let known = ok(block_on(known_workspaces(&store, actor(2))));
    assert_eq!(known.len(), 1);
}

#[test]
fn remembered_workspace_labels_keep_tasks_listable_offline() {
    let store = FakeStore::default();
    let task = new_task(&store, actor(1), "op-t", None, None);
    let known = ok(block_on(known_workspaces(&store, actor(1))));
    assert_eq!(
        known,
        vec![KnownWorkspace {
            workspace_id: task.workspace_id,
            label: None,
        }]
    );
    let remember = |op: &str, expected: u64, name: &str| RememberWorkspace {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        workspace_id: WORKSPACE.to_string(),
        name: name.to_string(),
    };
    ok(block_on(remember_workspace(
        &store,
        &FixedClock,
        actor(1),
        remember("op-w1", 0, "Synthetic Audit Co"),
    )));
    let renamed = ok(block_on(remember_workspace(
        &store,
        &FixedClock,
        actor(1),
        remember("op-w2", 1, "Synthetic Audit Group"),
    )));
    assert_eq!(renamed.record.revision(), Revision::new(2));
    let known = ok(block_on(known_workspaces(&store, actor(1))));
    assert_eq!(
        known[0].label.as_ref().map(|l| l.name.as_str()),
        Some("Synthetic Audit Group")
    );
    // Labels are per principal.
    assert!(ok(block_on(known_workspaces(&store, actor(3)))).is_empty());
}
