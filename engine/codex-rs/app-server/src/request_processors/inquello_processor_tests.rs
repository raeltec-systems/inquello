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

// ---- Task states (Story 1.15) ----------------------------------------------------

fn state_params(
    op: &str,
    expected: u64,
    task_id: &str,
    dimension: &str,
    value: &str,
    actor_kind: &str,
) -> InquelloStateRecordParams {
    let (scope_kind, scope_id) = match dimension {
        "task" => ("task", task_id.to_string()),
        "run" => ("run", "run-1".to_string()),
        _ => ("task", task_id.to_string()),
    };
    InquelloStateRecordParams {
        operation_id: op.to_string(),
        expected_revision: expected,
        task_id: task_id.to_string(),
        dimension: dimension.to_string(),
        scope_kind: scope_kind.to_string(),
        scope_id,
        value: value.to_string(),
        actor_kind: actor_kind.to_string(),
        actor_ref: (actor_kind != "human").then(|| "inquello-desktop".to_string()),
    }
}

async fn new_task(
    processor: &InquelloRequestProcessor,
    connection: ConnectionId,
    op: &str,
) -> String {
    let created: InquelloTaskResponse = decode(
        processor
            .task_create(connection, task_params(op, None, None))
            .await,
    );
    created.task.task_id
}

#[tokio::test]
async fn task_states_are_recorded_and_listed_by_dimension() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let task_id = new_task(&processor, DESKTOP, "op-t").await;
    let list = || {
        processor.state_list(
            DESKTOP,
            InquelloStateListParams {
                task_id: task_id.clone(),
            },
        )
    };
    let empty: InquelloStateListResponse = decode(list().await);
    assert_eq!(empty.revision, 0);
    assert_eq!(
        empty
            .dimensions
            .iter()
            .map(|d| (d.dimension.as_str(), d.records.len()))
            .collect::<Vec<_>>(),
        vec![
            ("task", 0),
            ("run", 0),
            ("output", 0),
            ("checks", 0),
            ("review", 0),
            ("approval_marker", 0),
            ("delivery_marker", 0),
        ]
    );

    for (op, expected, dimension, value) in [
        ("op-1", 0, "task", "planned"),
        ("op-2", 1, "task", "running"),
        ("op-3", 2, "run", "execution_finished"),
    ] {
        let recorded: InquelloStateRecordResponse = decode(
            processor
                .state_record(
                    DESKTOP,
                    state_params(op, expected, &task_id, dimension, value, "system"),
                )
                .await,
        );
        assert_eq!(
            (
                recorded.record.value.as_str(),
                recorded.record.revision,
                recorded.record.actor_kind.as_str(),
                recorded.receipt.command.as_str(),
                recorded.receipt.replayed,
            ),
            (value, expected + 1, "system", "record_state", false)
        );
    }
    let listed: InquelloStateListResponse = decode(list().await);
    assert_eq!(listed.revision, 3);
    let task_history: Vec<_> = listed.dimensions[0]
        .records
        .iter()
        .map(|r| (r.value.as_str(), r.version, r.actor_ref.as_str()))
        .collect();
    assert_eq!(
        task_history,
        vec![
            ("running", 2, "inquello-desktop"),
            ("planned", 1, "inquello-desktop")
        ]
    );
    assert_eq!(listed.dimensions[1].records[0].value, "execution_finished");
    assert!(listed.dimensions[2..].iter().all(|d| d.records.is_empty()));

    // A replay answers from the receipt.
    let replay: InquelloStateRecordResponse = decode(
        processor
            .state_record(
                DESKTOP,
                state_params("op-3", 2, &task_id, "run", "execution_finished", "system"),
            )
            .await,
    );
    assert!(replay.receipt.replayed);
}

#[tokio::test]
async fn state_refusals_carry_their_kinds() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    sign_in(&processor, OTHER, BOB);
    let task_id = new_task(&processor, DESKTOP, "op-t").await;
    let refused = |params| processor.state_record(DESKTOP, params);
    assert_eq!(
        kind(
            refused(state_params(
                "op",
                0,
                &task_id,
                "review",
                "requested",
                "system"
            ))
            .await
        ),
        "human_actor_required"
    );
    assert_eq!(
        kind(
            refused(state_params(
                "op",
                0,
                &task_id,
                "approval_marker",
                "noted_locally",
                "runtime"
            ))
            .await
        ),
        "human_actor_required"
    );
    assert_eq!(
        kind(
            refused(state_params(
                "op",
                0,
                &task_id,
                "review",
                "requested",
                "human"
            ))
            .await
        ),
        "dimension_not_enabled"
    );
    assert_eq!(
        kind(
            refused(state_params(
                "op",
                0,
                &task_id,
                "delivery_marker",
                "attempted",
                "system"
            ))
            .await
        ),
        "dimension_not_enabled"
    );
    assert_eq!(
        kind(refused(state_params("op", 0, &task_id, "run", "done", "system")).await),
        "invalid_value"
    );
    let mut forged = state_params("op", 0, &task_id, "task", "planned", "human");
    forged.actor_ref = Some(BOB.to_string());
    assert_eq!(kind(refused(forged).await), "invalid");
    let mut nameless = state_params("op", 0, &task_id, "task", "planned", "system");
    nameless.actor_ref = None;
    assert_eq!(kind(refused(nameless).await), "invalid");
    assert_eq!(
        kind(refused(state_params("op", 0, &task_id, "task", "planned", "model")).await),
        "invalid"
    );

    let _: InquelloStateRecordResponse = decode(
        refused(state_params(
            "op-1", 0, &task_id, "task", "planned", "system",
        ))
        .await,
    );
    let stale = refused(state_params(
        "op-2", 0, &task_id, "task", "running", "system",
    ))
    .await;
    let data = stale
        .as_ref()
        .err()
        .and_then(|error| error.data.clone())
        .unwrap_or_default();
    assert_eq!(data["inquello"]["kind"], "revision_conflict");
    assert_eq!(data["inquello"]["actual"], 1);
    assert_eq!(
        kind(
            refused(state_params(
                "op-1", 0, &task_id, "task", "blocked", "system"
            ))
            .await
        ),
        "operation_conflict"
    );

    // Another principal: refused like an unknown Task, for reads and writes.
    let unknown = uuid::Uuid::new_v4().to_string();
    for id in [&task_id, &unknown] {
        assert_eq!(
            kind(
                processor
                    .state_list(
                        OTHER,
                        InquelloStateListParams {
                            task_id: id.clone()
                        }
                    )
                    .await
            ),
            "not_found"
        );
        assert_eq!(
            kind(
                processor
                    .state_record(
                        OTHER,
                        state_params("op-b", 1, id, "task", "running", "system")
                    )
                    .await
            ),
            "not_found"
        );
    }
}
