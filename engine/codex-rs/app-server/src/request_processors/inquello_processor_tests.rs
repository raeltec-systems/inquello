//! The `inquello/*` methods against a real working store in a temp directory.

use super::*;
use codex_app_server_protocol::InquelloWorkspaceListParams;
use pretty_assertions::assert_eq;
use serde::de::DeserializeOwned;
use tempfile::TempDir;

const WORKSPACE: &str = "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e";
const OTHER_WORKSPACE: &str = "6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f";
const ALICE: &str = "11111111-1111-4111-8111-111111111111";
const BOB: &str = "22222222-2222-4222-8222-222222222222";
const DESKTOP: ConnectionId = ConnectionId(1);
const OTHER: ConnectionId = ConnectionId(2);

struct Fixture {
    dir: TempDir,
    processor: InquelloRequestProcessor,
}

fn fixture() -> Fixture {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("tempdir: {error}"));
    let runtime_home = dir.path().join("runtime-home");
    let processor = InquelloRequestProcessor::with_store_path(
        Some(dir.path().join("working.sqlite")),
        vec![runtime_home],
    );
    Fixture { dir, processor }
}

fn decode<T: DeserializeOwned>(
    result: Result<Option<ClientResponsePayload>, JSONRPCErrorError>,
) -> T {
    let payload = result
        .unwrap_or_else(|error| panic!("request failed: {error:?}"))
        .unwrap_or_else(|| panic!("no response payload"));
    let value = serde_json::to_value(payload).unwrap_or_else(|error| panic!("encode: {error}"));
    serde_json::from_value(value).unwrap_or_else(|error| panic!("decode: {error}"))
}

fn kind(result: Result<Option<ClientResponsePayload>, JSONRPCErrorError>) -> String {
    let error = result.err().unwrap_or_else(|| panic!("expected a refusal"));
    error
        .data
        .as_ref()
        .and_then(|data| data["inquello"]["kind"].as_str())
        .map(str::to_string)
        .unwrap_or_default()
}

fn sign_in(processor: &InquelloRequestProcessor, connection: ConnectionId, principal: &str) {
    let bound: InquelloSetPrincipalResponse = decode(processor.set_principal(
        connection,
        InquelloSetPrincipalParams {
            principal_id: Some(principal.to_string()),
        },
    ));
    assert_eq!(bound.principal_id.as_deref(), Some(principal));
}

fn engagement_params(op: &str, workspace: &str) -> InquelloEngagementCreateParams {
    InquelloEngagementCreateParams {
        operation_id: op.to_string(),
        expected_revision: 0,
        workspace_id: workspace.to_string(),
        service_engagement_id: uuid::Uuid::new_v4().to_string(),
        name: "FY26 audit".to_string(),
        objectives: "Opinion".to_string(),
        scope: "Group".to_string(),
        client_entity: Some("Synthetic Client Ltd".to_string()),
        period_start: Some("2026-01-01".to_string()),
        period_end: Some("2026-12-31".to_string()),
    }
}

fn task_params(
    op: &str,
    engagement: Option<&str>,
    folder: Option<&str>,
) -> InquelloTaskCreateParams {
    InquelloTaskCreateParams {
        operation_id: op.to_string(),
        expected_revision: 0,
        workspace_id: WORKSPACE.to_string(),
        engagement_id: engagement.map(str::to_string),
        folder_id: folder.map(str::to_string),
        title: "Untitled thread".to_string(),
    }
}

#[tokio::test]
async fn calls_before_set_principal_are_unauthenticated() {
    let Fixture { dir, processor } = fixture();
    assert_eq!(
        kind(processor.workspace_list(DESKTOP).await),
        "unauthenticated"
    );
    assert_eq!(
        kind(
            processor
                .task_create(DESKTOP, task_params("op", None, None))
                .await
        ),
        "unauthenticated"
    );
    // Refused before the store was touched.
    assert!(!dir.path().join("working.sqlite").exists());
    assert_eq!(
        kind(processor.set_principal(
            DESKTOP,
            InquelloSetPrincipalParams {
                principal_id: Some("not-a-uuid".to_string()),
            },
        )),
        "invalid"
    );
}

#[tokio::test]
async fn without_a_store_path_methods_answer_store_not_configured() {
    let processor = InquelloRequestProcessor::with_store_path(None, Vec::new());
    sign_in(&processor, DESKTOP, ALICE);
    assert_eq!(
        kind(processor.workspace_list(DESKTOP).await),
        "store_not_configured"
    );
    let _ = InquelloWorkspaceListParams {};
}

#[tokio::test]
async fn a_store_inside_the_runtime_home_is_refused() {
    let dir = tempfile::tempdir().unwrap_or_else(|error| panic!("tempdir: {error}"));
    let processor = InquelloRequestProcessor::with_store_path(
        Some(dir.path().join("working.sqlite")),
        vec![dir.path().to_path_buf()],
    );
    sign_in(&processor, DESKTOP, ALICE);
    assert_eq!(
        kind(processor.workspace_list(DESKTOP).await),
        "store_unavailable"
    );
}

#[tokio::test]
async fn organise_engagement_folder_and_task_then_move_it() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let created: InquelloEngagementResponse = decode(
        processor
            .engagement_create(DESKTOP, engagement_params("op-e", WORKSPACE))
            .await,
    );
    let engagement = created.engagement;
    assert_eq!(
        engagement.client_entity.as_deref(),
        Some("Synthetic Client Ltd")
    );
    assert_eq!(engagement.period_start.as_deref(), Some("2026-01-01"));
    assert_eq!(created.receipt.resulting_revision, 1);
    let folder: InquelloFolderResponse = decode(
        processor
            .folder_create(
                DESKTOP,
                InquelloFolderCreateParams {
                    operation_id: "op-f".to_string(),
                    expected_revision: 0,
                    workspace_id: WORKSPACE.to_string(),
                    engagement_id: engagement.engagement_id.clone(),
                    name: "Planning".to_string(),
                },
            )
            .await,
    );
    let task: InquelloTaskResponse = decode(
        processor
            .task_create(
                DESKTOP,
                task_params(
                    "op-t",
                    Some(&engagement.engagement_id),
                    Some(&folder.folder.folder_id),
                ),
            )
            .await,
    );
    assert_eq!(task.task.visibility, InquelloTaskVisibility::Private);
    assert_eq!(task.task.creator_principal_id, ALICE);
    let attached: InquelloTaskResponse = decode(
        processor
            .task_attach_thread(
                DESKTOP,
                InquelloTaskAttachThreadParams {
                    operation_id: "op-a".to_string(),
                    expected_revision: 1,
                    workspace_id: WORKSPACE.to_string(),
                    task_id: task.task.task_id.clone(),
                    runtime_thread_id: "thread-1".to_string(),
                },
            )
            .await,
    );
    let moved: InquelloTaskResponse = decode(
        processor
            .task_move(
                DESKTOP,
                InquelloTaskMoveParams {
                    operation_id: "op-m".to_string(),
                    expected_revision: 2,
                    workspace_id: WORKSPACE.to_string(),
                    task_id: task.task.task_id.clone(),
                    engagement_id: None,
                    folder_id: None,
                },
            )
            .await,
    );
    assert_eq!(moved.task.task_id, attached.task.task_id);
    assert_eq!(moved.task.runtime_thread_id.as_deref(), Some("thread-1"));
    assert_eq!(moved.task.source_refs, attached.task.source_refs);
    assert_eq!(moved.task.artifact_refs, attached.task.artifact_refs);
    assert_eq!(
        (moved.task.engagement_id, moved.task.folder_id),
        (None, None)
    );

    let tree: InquelloWorkspaceTreeResponse = decode(
        processor
            .workspace_tree(
                DESKTOP,
                InquelloWorkspaceTreeParams {
                    workspace_id: WORKSPACE.to_string(),
                },
            )
            .await,
    );
    assert_eq!(tree.engagements, vec![engagement]);
    assert_eq!(tree.folders, vec![folder.folder]);
    assert_eq!(tree.tasks.len(), 1);
}

#[tokio::test]
async fn refusals_carry_kinds_stale_revisions_and_replays() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let elsewhere: InquelloEngagementResponse = decode(
        processor
            .engagement_create(DESKTOP, engagement_params("op-e", OTHER_WORKSPACE))
            .await,
    );
    let task: InquelloTaskResponse = decode(
        processor
            .task_create(DESKTOP, task_params("op-t", None, None))
            .await,
    );
    let replay: InquelloTaskResponse = decode(
        processor
            .task_create(DESKTOP, task_params("op-t", None, None))
            .await,
    );
    assert!(replay.receipt.replayed);
    assert_eq!(replay.task.task_id, task.task.task_id);

    let rename = |op: &str, expected: u64| InquelloTaskRenameParams {
        operation_id: op.to_string(),
        expected_revision: expected,
        workspace_id: WORKSPACE.to_string(),
        task_id: task.task.task_id.clone(),
        title: "Bank confirmations".to_string(),
    };
    let _: InquelloTaskResponse = decode(processor.task_rename(DESKTOP, rename("op-r1", 1)).await);
    let stale = processor
        .task_rename(DESKTOP, rename("op-r2", 1))
        .await
        .err()
        .unwrap_or_else(|| panic!("stale rename must fail"));
    assert_eq!(
        stale.data,
        Some(json!({ "inquello": { "kind": "revision_conflict", "expected": 1, "actual": 2 } }))
    );
    assert_eq!(
        kind(
            processor
                .task_move(
                    DESKTOP,
                    InquelloTaskMoveParams {
                        operation_id: "op-m".to_string(),
                        expected_revision: 2,
                        workspace_id: WORKSPACE.to_string(),
                        task_id: task.task.task_id.clone(),
                        engagement_id: Some(elsewhere.engagement.engagement_id),
                        folder_id: None,
                    },
                )
                .await
        ),
        "workspace_mismatch"
    );
    let mut reused = task_params("op-t", None, None);
    reused.title = "Another".to_string();
    assert_eq!(
        kind(processor.task_create(DESKTOP, reused).await),
        "operation_conflict"
    );
}

#[tokio::test]
async fn tasks_are_listed_only_for_their_creator() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    sign_in(&processor, OTHER, BOB);
    let shared: InquelloEngagementResponse = decode(
        processor
            .engagement_create(DESKTOP, engagement_params("op-e", WORKSPACE))
            .await,
    );
    let id = shared.engagement.engagement_id;
    let _: InquelloTaskResponse = decode(
        processor
            .task_create(DESKTOP, task_params("op-a", Some(&id), None))
            .await,
    );
    let bobs: InquelloTaskResponse = decode(
        processor
            .task_create(OTHER, task_params("op-b", Some(&id), None))
            .await,
    );
    let tree = |connection| {
        processor.workspace_tree(
            connection,
            InquelloWorkspaceTreeParams {
                workspace_id: WORKSPACE.to_string(),
            },
        )
    };
    let alices: InquelloWorkspaceTreeResponse = decode(tree(DESKTOP).await);
    assert_eq!(alices.tasks.len(), 1);
    assert_eq!(alices.tasks[0].creator_principal_id, ALICE);
    assert_eq!(
        kind(
            processor
                .task_rename(
                    DESKTOP,
                    InquelloTaskRenameParams {
                        operation_id: "op-r".to_string(),
                        expected_revision: 1,
                        workspace_id: WORKSPACE.to_string(),
                        task_id: bobs.task.task_id,
                        title: "Taken".to_string(),
                    },
                )
                .await
        ),
        "not_found"
    );

    // Signing out (or closing the connection) unbinds the principal.
    let _: InquelloSetPrincipalResponse =
        decode(processor.set_principal(DESKTOP, InquelloSetPrincipalParams { principal_id: None }));
    assert_eq!(kind(tree(DESKTOP).await), "unauthenticated");
    processor.connection_closed(OTHER);
    assert_eq!(kind(tree(OTHER).await), "unauthenticated");
}
