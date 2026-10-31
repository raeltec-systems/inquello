//! The Story 1.14 I/O matrix against a real SQLite working store in a temp
//! directory: records, receipts, replay, revisions, privacy and reopen.

use inquello_adapters::SqliteWorkingStore;
use inquello_adapters::SystemClock;
use inquello_domain::DomainError;
use inquello_domain::OperationId;
use inquello_domain::Revision;
use inquello_domain::StoreError;
use inquello_domain::organise::Actor;
use inquello_domain::organise::AttachThread;
use inquello_domain::organise::CreateEngagement;
use inquello_domain::organise::CreateFolder;
use inquello_domain::organise::CreateTask;
use inquello_domain::organise::Engagement;
use inquello_domain::organise::Folder;
use inquello_domain::organise::MoveTask;
use inquello_domain::organise::OrganiseChange;
use inquello_domain::organise::OrganiseOutcome;
use inquello_domain::organise::OrganiseRecord;
use inquello_domain::organise::OrganiseStore;
use inquello_domain::organise::PrincipalId;
use inquello_domain::organise::RememberWorkspace;
use inquello_domain::organise::RenameTask;
use inquello_domain::organise::Task;
use inquello_domain::organise::Visibility;
use inquello_domain::organise::attach_thread;
use inquello_domain::organise::create_engagement;
use inquello_domain::organise::create_folder;
use inquello_domain::organise::create_task;
use inquello_domain::organise::known_workspaces;
use inquello_domain::organise::move_task;
use inquello_domain::organise::remember_workspace;
use inquello_domain::organise::rename_task;
use inquello_domain::organise::workspace_tree;
use pretty_assertions::assert_eq;
use std::path::PathBuf;
use tempfile::TempDir;
use uuid::Uuid;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const OTHER_WORKSPACE: &str = "6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f";

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

async fn engagement(store: &SqliteWorkingStore, op: &str, workspace: &str) -> Engagement {
    engagement_of(&ok(create_engagement(
        store,
        &SystemClock,
        actor(1),
        CreateEngagement {
            operation_id: op.to_string(),
            expected_revision: Revision::ZERO,
            workspace_id: workspace.to_string(),
            service_engagement_id: Uuid::new_v4().to_string(),
            name: format!("Engagement {op}"),
            objectives: "Opinion".to_string(),
            scope: "Group".to_string(),
            client_entity: Some("Synthetic Client Ltd".to_string()),
            period_start: Some("2026-01-01".to_string()),
            period_end: Some("2026-12-31".to_string()),
        },
    )
    .await))
}

async fn folder(store: &SqliteWorkingStore, op: &str, engagement: &Engagement) -> Folder {
    folder_of(&ok(create_folder(
        store,
        &SystemClock,
        actor(1),
        CreateFolder {
            operation_id: op.to_string(),
            expected_revision: Revision::ZERO,
            workspace_id: engagement.workspace_id.to_string(),
            engagement_id: engagement.engagement_id.to_string(),
            name: "Planning".to_string(),
        },
    )
    .await))
}

fn task_command(op: &str, engagement: Option<&Engagement>, folder: Option<&Folder>) -> CreateTask {
    CreateTask {
        operation_id: op.to_string(),
        expected_revision: Revision::ZERO,
        workspace_id: WORKSPACE.to_string(),
        engagement_id: engagement.map(|e| e.engagement_id.to_string()),
        folder_id: folder.map(|f| f.folder_id.to_string()),
        title: "Untitled thread".to_string(),
    }
}

async fn task(
    store: &SqliteWorkingStore,
    who: Actor,
    op: &str,
    engagement: Option<&Engagement>,
    folder: Option<&Folder>,
) -> Task {
    task_of(&ok(create_task(
        store,
        &SystemClock,
        who,
        task_command(op, engagement, folder),
    )
    .await))
}

#[tokio::test]
async fn engagement_folder_and_task_persist_and_reopen() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let created = engagement(&store, "op-e", WORKSPACE).await;
    let planning = folder(&store, "op-f", &created).await;
    let in_folder = task(&store, actor(1), "op-t", Some(&created), Some(&planning)).await;
    let ad_hoc = task(&store, actor(1), "op-t2", None, None).await;
    assert_eq!(ad_hoc.visibility, Visibility::Private);
    store.close().await;

    let reopened = open(&fixture).await;
    let tree = ok(workspace_tree(&reopened, actor(1), WORKSPACE).await);
    assert_eq!(tree.engagements, vec![created]);
    assert_eq!(tree.folders, vec![planning]);
    let mut ids: Vec<_> = tree.tasks.iter().map(|t| t.task_id).collect();
    ids.sort();
    let mut expected = vec![in_folder.task_id, ad_hoc.task_id];
    expected.sort();
    assert_eq!(ids, expected);
    assert_eq!(
        tree.tasks.iter().find(|t| t.task_id == in_folder.task_id),
        Some(&in_folder)
    );
}

#[tokio::test]
async fn move_keeps_ids_thread_ref_and_refs_and_rejects_another_workspace() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let first = engagement(&store, "op-e1", WORKSPACE).await;
    let second = engagement(&store, "op-e2", WORKSPACE).await;
    let elsewhere = engagement(&store, "op-e3", OTHER_WORKSPACE).await;
    let target = folder(&store, "op-f", &second).await;
    let created = task(&store, actor(1), "op-t", Some(&first), None).await;
    ok(attach_thread(
        &store,
        &SystemClock,
        actor(1),
        AttachThread {
            operation_id: "op-a".to_string(),
            expected_revision: Revision::new(1),
            workspace_id: WORKSPACE.to_string(),
            task_id: created.task_id.to_string(),
            runtime_thread_id: "thread-1".to_string(),
        },
    )
    .await);
    let move_to =
        |op: &str, expected: u64, engagement: &Engagement, folder: Option<&Folder>| MoveTask {
            operation_id: op.to_string(),
            expected_revision: Revision::new(expected),
            workspace_id: WORKSPACE.to_string(),
            task_id: created.task_id.to_string(),
            engagement_id: Some(engagement.engagement_id.to_string()),
            folder_id: folder.map(|f| f.folder_id.to_string()),
        };
    let moved = task_of(&ok(move_task(
        &store,
        &SystemClock,
        actor(1),
        move_to("op-m", 2, &second, Some(&target)),
    )
    .await));
    assert_eq!(moved.task_id, created.task_id);
    assert_eq!(moved.runtime_thread_id.as_deref(), Some("thread-1"));
    assert_eq!((moved.source_refs.len(), moved.artifact_refs.len()), (0, 0));
    assert_eq!(moved.visibility, Visibility::Private);
    assert_eq!(
        (moved.engagement_id, moved.folder_id),
        (Some(second.engagement_id), Some(target.folder_id))
    );

    let rejected = move_task(
        &store,
        &SystemClock,
        actor(1),
        move_to("op-m2", 3, &elsewhere, None),
    )
    .await;
    assert_eq!(rejected.err(), Some(DomainError::WorkspaceMismatch));
    assert_eq!(
        store.load_task(created.task_id).await.ok().flatten(),
        Some(moved)
    );
}

#[tokio::test]
async fn stale_rename_replay_and_operation_reuse() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let created = task(&store, actor(1), "op-t", None, None).await;
    let rename = |op: &str, expected: u64, title: &str| RenameTask {
        operation_id: op.to_string(),
        expected_revision: Revision::new(expected),
        workspace_id: WORKSPACE.to_string(),
        task_id: created.task_id.to_string(),
        title: title.to_string(),
    };
    let first = ok(rename_task(
        &store,
        &SystemClock,
        actor(1),
        rename("op-r", 1, "Bank confirmations"),
    )
    .await);
    let replay = ok(rename_task(
        &store,
        &SystemClock,
        actor(1),
        rename("op-r", 1, "Bank confirmations"),
    )
    .await);
    assert!(replay.replayed);
    assert_eq!(replay.receipt, first.receipt);
    assert_eq!(task_of(&replay).revision, Revision::new(2));

    assert_eq!(
        rename_task(&store, &SystemClock, actor(1), rename("op-r2", 1, "Stale"))
            .await
            .err(),
        Some(DomainError::RevisionConflict {
            expected: Revision::new(1),
            actual: Revision::new(2),
        })
    );
    assert!(matches!(
        rename_task(&store, &SystemClock, actor(1), rename("op-r", 1, "Other")).await,
        Err(DomainError::OperationConflict { .. })
    ));
    assert_eq!(receipts_found(&store, &["op-t", "op-r", "op-r2"]).await, 2);
}

#[tokio::test]
async fn other_creators_tasks_are_never_listed() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let shared = engagement(&store, "op-e", WORKSPACE).await;
    let mine = task(&store, actor(1), "op-t1", Some(&shared), None).await;
    let theirs = task(&store, actor(2), "op-t2", Some(&shared), None).await;
    let tree = ok(workspace_tree(&store, actor(1), WORKSPACE).await);
    assert_eq!(tree.tasks, vec![mine]);
    let theirs_view = ok(workspace_tree(&store, actor(2), WORKSPACE).await);
    assert_eq!(theirs_view.tasks, vec![theirs.clone()]);
    let rename = rename_task(
        &store,
        &SystemClock,
        actor(1),
        RenameTask {
            operation_id: "op-r".to_string(),
            expected_revision: Revision::new(1),
            workspace_id: WORKSPACE.to_string(),
            task_id: theirs.task_id.to_string(),
            title: "Taken".to_string(),
        },
    )
    .await;
    assert_eq!(rename.err(), Some(DomainError::NotFound));
}

#[tokio::test]
async fn known_workspaces_come_from_labels_and_own_tasks() {
    let fixture = fixture();
    let store = open(&fixture).await;
    task(&store, actor(1), "op-t", None, None).await;
    ok(remember_workspace(
        &store,
        &SystemClock,
        actor(1),
        RememberWorkspace {
            operation_id: "op-w".to_string(),
            expected_revision: Revision::ZERO,
            workspace_id: OTHER_WORKSPACE.to_string(),
            name: "Other Co".to_string(),
        },
    )
    .await);
    let known = ok(known_workspaces(&store, actor(1)).await);
    let summary: Vec<_> = known
        .iter()
        .map(|k| {
            (
                k.workspace_id.to_string(),
                k.label.as_ref().map(|l| l.name.clone()),
            )
        })
        .collect();
    assert_eq!(summary.len(), 2);
    assert!(summary.contains(&(WORKSPACE.to_string(), None)));
    assert!(summary.contains(&(OTHER_WORKSPACE.to_string(), Some("Other Co".to_string()))));
    assert!(ok(known_workspaces(&store, actor(9)).await).is_empty());
}

#[tokio::test]
async fn a_failed_receipt_write_rolls_back_the_record() {
    let fixture = fixture();
    let store = open(&fixture).await;
    let first = ok(create_task(
        &store,
        &SystemClock,
        actor(1),
        task_command("op-t", None, None),
    )
    .await);
    // A second, new Task whose receipt reuses the first operation ID: the record
    // insert succeeds, the receipt insert fails, and both roll back.
    let mut record = task_of(&first);
    record.task_id = inquello_domain::organise::TaskId::new_random();
    let mut receipt = first.receipt.clone();
    receipt.resource_id = *record.task_id.as_uuid();
    let result = store
        .commit_organise(OrganiseChange {
            expected_revision: Revision::ZERO,
            record: OrganiseRecord::Task(record.clone()),
            receipt,
        })
        .await;
    assert_eq!(
        result,
        Err(StoreError::DuplicateOperation {
            operation_id: OperationId::parse("op-t").unwrap_or_else(|e| panic!("{e}")),
        })
    );
    assert_eq!(store.load_task(record.task_id).await.ok().flatten(), None);
}

/// How many of `ops` have a receipt: one per applied operation, none for a refusal.
async fn receipts_found(store: &SqliteWorkingStore, ops: &[&str]) -> usize {
    let mut count = 0;
    for op in ops {
        let id = OperationId::parse(op).unwrap_or_else(|e| panic!("{e}"));
        if store
            .find_organise_receipt(&id)
            .await
            .ok()
            .flatten()
            .is_some()
        {
            count += 1;
        }
    }
    count
}

#[tokio::test]
async fn actual_draft_creation_is_owned_metadata_not_synthetic_or_inference_authority() {
    let f=fixture();let store=open(&f).await;
    let draft=task_of(&ok(create_task(&store,&SystemClock,actor(1),task_command("draft-native",None,None)).await));
    assert!(ok(store.task_is_native_draft(actor(1).principal_id,&draft.task_id.to_string()).await));
    assert!(!ok(store.task_is_native_draft(actor(2).principal_id,&draft.task_id.to_string()).await));
    assert_eq!(ok(store.task_data_tier(actor(1).principal_id,&draft.task_id.to_string()).await),None);
    let renamed=task_of(&ok(rename_task(&store,&SystemClock,actor(1),RenameTask{operation_id:"draft-rename".into(),expected_revision:draft.revision,workspace_id:WORKSPACE.into(),task_id:draft.task_id.to_string(),title:"Company information is not synthetic".into()}).await));
    assert!(ok(store.task_is_native_draft(actor(1).principal_id,&draft.task_id.to_string()).await));
    store.close().await;
    let inspected=inquello_adapters::data_provenance::inspect(inquello_adapters::data_provenance::InspectRequest{version:1,store_path:f.path.clone(),principal_id:actor(1).principal_id.to_string(),task_root:None,runtime_home:None}).await;
    assert!(inspected.available,"{:?}",inspected.reason);
    assert_eq!(inspected.workspaces[0].tasks[0].provenance_kind,"draft_metadata");
    assert_eq!(inspected.workspaces[0].tasks[0].data_tier,"not-applicable");
    assert!(inspected.workspaces[0].tasks[0].route_configuration.is_none());
    let store=open(&f).await;
    ok(attach_thread(&store,&SystemClock,actor(1),AttachThread{operation_id:"attach-invalidates-draft".into(),expected_revision:renamed.revision,workspace_id:WORKSPACE.into(),task_id:draft.task_id.to_string(),runtime_thread_id:Uuid::new_v4().to_string()}).await);
    assert!(!ok(store.task_is_native_draft(actor(1).principal_id,&draft.task_id.to_string()).await));
}

#[tokio::test]
async fn actual_creation_tree_keeps_own_draft_but_never_returns_peer_or_company_ids() {
    let f=fixture();let store=open(&f).await;
    let own=task_of(&ok(create_task(&store,&SystemClock,actor(1),task_command("own-draft",None,None)).await));
    let peer=task_of(&ok(create_task(&store,&SystemClock,actor(2),task_command("peer-draft",None,None)).await));
    let mut command=task_command("foreign-company-draft",None,None);command.workspace_id=OTHER_WORKSPACE.into();
    let foreign=task_of(&ok(create_task(&store,&SystemClock,actor(1),command).await));
    let tree=ok(workspace_tree(&store,actor(1),WORKSPACE).await);
    assert_eq!(tree.tasks.len(),1);assert_eq!(tree.tasks[0].task_id,own.task_id);
    assert!(tree.tasks.iter().all(|task|task.task_id!=peer.task_id&&task.task_id!=foreign.task_id));
}
