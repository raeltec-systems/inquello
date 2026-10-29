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

// ---- Effective policy and broader modes (Story 1.18) ---------------------------------

const FULL_ACCESS_REACH: &str = "Full access: commands on this Task run without sandbox limits on this device, and you will not be asked before actions.";

fn workspace_policy(
    workspace: &str,
    revision: u64,
    execution: Option<serde_json::Value>,
) -> InquelloWorkspaceExecutionPolicy {
    InquelloWorkspaceExecutionPolicy {
        workspace_id: workspace.to_string(),
        policy_revision: revision,
        authorization_epoch: revision + 10,
        execution,
    }
}

fn permissive() -> serde_json::Value {
    json!({
        "sandbox": "full_access",
        "approvals": ["on_request", "untrusted", "never"],
        "network": "allowed",
        "allow_full_access": true,
        "allow_no_prompt": true,
    })
}

async fn effective(
    processor: &InquelloRequestProcessor,
    connection: ConnectionId,
    policy: InquelloWorkspaceExecutionPolicy,
    task_id: Option<&str>,
    device: DeviceRequirements,
    user: UserConfig,
) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
    processor
        .policy_effective(
            connection,
            InquelloPolicyEffectiveParams {
                workspace_policy: policy,
                task_id: task_id.map(str::to_string),
                task_folder: None,
            },
            device,
            user,
        )
        .await
}

fn setting<'a>(
    response: &'a InquelloPolicyEffectiveResponse,
    name: &str,
) -> &'a InquelloPolicySetting {
    response
        .settings
        .iter()
        .find(|setting| setting.name == name)
        .unwrap_or_else(|| panic!("no {name} setting"))
}

fn broad_params(
    op: &str,
    expected: u64,
    task_id: &str,
    mode: &str,
    confirmation: Option<&str>,
    policy: InquelloWorkspaceExecutionPolicy,
) -> InquelloBroadModeSetParams {
    InquelloBroadModeSetParams {
        operation_id: op.to_string(),
        expected_revision: expected,
        task_id: task_id.to_string(),
        mode: mode.to_string(),
        confirmation: confirmation.map(str::to_string),
        actor_kind: "human".to_string(),
        actor_ref: None,
        workspace_policy: policy,
    }
}

#[tokio::test]
async fn the_effective_policy_names_its_sources_and_the_capability_contract() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);

    // No policy, no device requirements: the Inquello defaults.
    let response: InquelloPolicyEffectiveResponse = decode(
        effective(
            &processor,
            DESKTOP,
            workspace_policy(WORKSPACE, 1, None),
            None,
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await,
    );
    assert_eq!(response.environment, "local_device");
    assert_eq!(response.authorization_epoch, 11);
    let names: Vec<&str> = response.settings.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "sandbox",
            "approval",
            "network",
            "mcp_tools",
            "extensions",
            "full_access",
            "no_prompt"
        ]
    );
    assert!(
        response
            .settings
            .iter()
            .all(|s| s.source.kind == "inquello_default")
    );
    assert_eq!(setting(&response, "sandbox").value, "workspace_write");
    assert_eq!(setting(&response, "approval").value, "on_request");
    assert_eq!(setting(&response, "full_access").value, "not_permitted");
    assert!(!response.device.configured);
    assert_eq!(response.device.sandbox_modes, None);
    assert!(response.task.is_none());
    let ids: Vec<&str> = response
        .capabilities
        .iter()
        .map(|c| c.id.as_str())
        .collect();
    assert_eq!(
        ids,
        [
            "prompt_inspection",
            "specialist_cyber_access",
            "execution_sandbox"
        ]
    );
    let sandbox = &response.capabilities[2];
    assert!(sandbox.enabled);
    assert_eq!(
        sandbox.limits.first().map(String::as_str),
        Some(
            "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)"
        )
    );
    assert!(response.capabilities[..2].iter().all(|c| {
        !c.enabled
            && c.limits
                .iter()
                .any(|l| l == "Eligibility verification required before enablement")
    }));

    // Workspace restricts; device and user layers stricter still.
    let response: InquelloPolicyEffectiveResponse = decode(
        effective(
            &processor,
            DESKTOP,
            workspace_policy(WORKSPACE, 4, Some(json!({ "sandbox": "read_only" }))),
            None,
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await,
    );
    let sandbox = setting(&response, "sandbox");
    assert_eq!(
        (sandbox.value.as_str(), sandbox.restricted),
        ("read_only", true)
    );
    assert_eq!(
        sandbox.source,
        InquelloPolicySource {
            kind: "workspace_policy".to_string(),
            revision: Some(4)
        }
    );

    let requirements: ConfigRequirementsReadResponse = serde_json::from_value(json!({
        "requirements": {
            "allowedSandboxModes": ["read-only", "workspace-write"],
            "allowedApprovalPolicies": ["on-request", "untrusted"],
        }
    }))
    .unwrap_or_else(|error| panic!("{error}"));
    let device = InquelloRequestProcessor::device_requirements(&requirements);
    let response: InquelloPolicyEffectiveResponse = decode(
        effective(
            &processor,
            DESKTOP,
            workspace_policy(WORKSPACE, 2, Some(permissive())),
            None,
            device,
            UserConfig::default(),
        )
        .await,
    );
    assert!(response.device.configured);
    assert_eq!(
        response.device.sandbox_modes,
        Some(vec!["read_only".to_string(), "workspace_write".to_string()])
    );
    assert_eq!(setting(&response, "sandbox").value, "workspace_write");
    assert_eq!(
        setting(&response, "sandbox").source.kind,
        "device_requirements"
    );
    assert_eq!(
        setting(&response, "full_access").source.kind,
        "device_requirements"
    );

    let user = InquelloRequestProcessor::user_config(
        &serde_json::from_value::<ConfigReadResponse>(json!({
            "config": {},
            "origins": {},
            "layers": [{
                "name": { "type": "user", "file": "/tmp/runtime-home/config.toml", "profile": null },
                "version": "1",
                "config": { "sandbox_mode": "read-only", "approval_policy": "untrusted" },
            }],
        }))
        .unwrap_or_else(|error| panic!("{error}")),
    );
    assert_eq!(user.sandbox, Some(SandboxLevel::ReadOnly));
    assert_eq!(user.approval, Some(ApprovalBehaviour::Untrusted));
    let response: InquelloPolicyEffectiveResponse = decode(
        effective(
            &processor,
            DESKTOP,
            workspace_policy(WORKSPACE, 2, Some(permissive())),
            None,
            DeviceRequirements::default(),
            user,
        )
        .await,
    );
    assert_eq!(setting(&response, "sandbox").value, "read_only");
    assert_eq!(setting(&response, "sandbox").source.kind, "user_config");
    assert_eq!(setting(&response, "approval").source.kind, "user_config");

    // A bad section is refused.
    assert_eq!(
        kind(
            effective(
                &processor,
                DESKTOP,
                workspace_policy(WORKSPACE, 2, Some(json!({ "hosted_sandbox": true }))),
                None,
                DeviceRequirements::default(),
                UserConfig::default(),
            )
            .await
        ),
        "invalid"
    );
}

#[tokio::test]
async fn a_broad_mode_is_explicit_permitted_per_task_and_suspended_by_policy() {
    let Fixture {
        dir: _dir,
        processor,
    } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let task_id = new_task(&processor, DESKTOP, "task-1").await;
    let open = || workspace_policy(WORKSPACE, 2, Some(permissive()));
    let closed = || workspace_policy(WORKSPACE, 3, Some(json!({ "allow_full_access": false })));

    // Refused without permission, naming the rule; nothing is recorded.
    let refused = processor
        .broad_mode_set(
            DESKTOP,
            broad_params(
                "op-1",
                0,
                &task_id,
                "full_access",
                Some(FULL_ACCESS_REACH),
                closed(),
            ),
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await;
    let error = refused
        .err()
        .unwrap_or_else(|| panic!("expected a refusal"));
    assert_eq!(
        error.data,
        Some(
            json!({ "inquello": { "kind": "broad_mode_not_permitted", "rule": "workspace_policy", "revision": 3 } })
        )
    );
    assert!(error.message.contains("Workspace policy, revision 3"));
    // Refused without the confirmation.
    assert_eq!(
        kind(
            processor
                .broad_mode_set(
                    DESKTOP,
                    broad_params("op-1", 0, &task_id, "full_access", None, open()),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "invalid"
    );
    // Refused for a runtime actor.
    let mut runtime = broad_params(
        "op-1",
        0,
        &task_id,
        "full_access",
        Some(FULL_ACCESS_REACH),
        open(),
    );
    runtime.actor_kind = "runtime".to_string();
    runtime.actor_ref = Some("codex".to_string());
    assert_eq!(
        kind(
            processor
                .broad_mode_set(
                    DESKTOP,
                    runtime,
                    DeviceRequirements::default(),
                    UserConfig::default()
                )
                .await
        ),
        "human_actor_required"
    );
    // Refused with another Workspace's policy.
    assert_eq!(
        kind(
            processor
                .broad_mode_set(
                    DESKTOP,
                    broad_params(
                        "op-1",
                        0,
                        &task_id,
                        "full_access",
                        Some(FULL_ACCESS_REACH),
                        workspace_policy(OTHER_WORKSPACE, 2, Some(permissive())),
                    ),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "workspace_mismatch"
    );
    let read: InquelloBroadModeReadResponse = decode(
        processor
            .broad_mode_read(
                DESKTOP,
                InquelloBroadModeReadParams {
                    task_id: task_id.clone(),
                },
            )
            .await,
    );
    assert_eq!(
        (
            read.revision,
            read.mode.as_str(),
            read.workspace_id.as_str()
        ),
        (0, "standard", WORKSPACE)
    );

    // Permitted and confirmed: recorded, labelled with its reach.
    let set: InquelloBroadModeSetResponse = decode(
        processor
            .broad_mode_set(
                DESKTOP,
                broad_params(
                    "op-1",
                    0,
                    &task_id,
                    "full_access",
                    Some(FULL_ACCESS_REACH),
                    open(),
                ),
                DeviceRequirements::default(),
                UserConfig::default(),
            )
            .await,
    );
    assert_eq!(set.receipt.command, "set_broad_mode");
    assert_eq!(set.task.broad_mode.status, "active");
    assert_eq!(set.task.broad_mode.label, "Broader execution mode");
    assert_eq!(set.task.broad_mode.reach, FULL_ACCESS_REACH);
    assert_eq!(
        set.task.thread_settings,
        InquelloThreadSettings {
            sandbox: "danger-full-access".to_string(),
            approval_policy: "never".to_string(),
            network_access: true,
            mode: "full_access".to_string(),
        }
    );

    // A tightened policy suspends it; the Task runs as standard.
    let response: InquelloPolicyEffectiveResponse = decode(
        effective(
            &processor,
            DESKTOP,
            closed(),
            Some(&task_id),
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await,
    );
    let task = response.task.unwrap_or_else(|| panic!("a task policy"));
    assert_eq!(task.broad_mode.recorded, "full_access");
    assert_eq!(task.broad_mode.status, "suspended");
    assert_eq!(task.broad_mode.effective_mode, "standard");
    assert_eq!(
        task.broad_mode.governing,
        Some(InquelloPolicySource {
            kind: "workspace_policy".to_string(),
            revision: Some(3)
        })
    );
    assert_eq!(task.thread_settings.sandbox, "workspace-write");
    assert_eq!(task.thread_settings.approval_policy, "on-request");

    // Another creator cannot read or set it; it looks like an unknown Task.
    sign_in(&processor, OTHER, BOB);
    assert_eq!(
        kind(
            processor
                .broad_mode_read(
                    OTHER,
                    InquelloBroadModeReadParams {
                        task_id: task_id.clone()
                    }
                )
                .await
        ),
        "not_found"
    );
    assert_eq!(
        kind(
            effective(
                &processor,
                OTHER,
                open(),
                Some(&task_id),
                DeviceRequirements::default(),
                UserConfig::default()
            )
            .await
        ),
        "not_found"
    );
    assert_eq!(
        kind(
            processor
                .broad_mode_set(
                    OTHER,
                    broad_params("op-2", 1, &task_id, "standard", None, open()),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "not_found"
    );
}

// ---- Story 1.19: the tool profile ------------------------------------------------

fn make_folder(dir: &TempDir, task_id: &str) -> String {
    let root = dir.path().join("tasks").join(task_id);
    std::fs::create_dir_all(root.join("output")).unwrap_or_else(|error| panic!("{error}"));
    root.to_string_lossy().into_owned()
}

async fn task_profile(
    processor: &InquelloRequestProcessor,
    policy: InquelloWorkspaceExecutionPolicy,
    task_id: &str,
    folder: Option<String>,
) -> Result<Option<ClientResponsePayload>, JSONRPCErrorError> {
    processor
        .policy_effective(
            DESKTOP,
            InquelloPolicyEffectiveParams {
                workspace_policy: policy,
                task_id: Some(task_id.to_string()),
                task_folder: folder,
            },
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await
}

fn exec_params(
    policy: InquelloWorkspaceExecutionPolicy,
    task_id: &str,
    folder: &str,
    command: &[&str],
) -> InquelloToolsExecParams {
    InquelloToolsExecParams {
        workspace_policy: policy,
        task_id: task_id.to_string(),
        task_folder: folder.to_string(),
        command: command.iter().map(|part| part.to_string()).collect(),
        timeout_ms: Some(5_000),
    }
}

#[tokio::test]
async fn a_standard_task_profile_names_its_boundaries_and_runtime_form() {
    let Fixture { dir, processor } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let task_id = new_task(&processor, DESKTOP, "task-1").await;
    let folder = make_folder(&dir, &task_id);
    let policy = || {
        workspace_policy(
            WORKSPACE,
            5,
            Some(
                json!({ "network": "allowed", "allowed_domains": ["example.org", "*.example.com"] }),
            ),
        )
    };

    // Without a folder: the reach only, and the Workspace's standard reach.
    let response: InquelloPolicyEffectiveResponse =
        decode(task_profile(&processor, policy(), &task_id, None).await);
    assert!(response.reach.bounded);
    let task = response.task.unwrap_or_else(|| panic!("no task"));
    assert_eq!(task.reach, response.reach);
    assert!(task.runtime_profile.is_none());
    assert_eq!(
        task.reach
            .boundaries
            .iter()
            .map(|b| (b.kind.as_str(), b.access.as_str(), b.label.as_str()))
            .collect::<Vec<_>>(),
        [
            ("working_folder", "write", "working folder (read/write)"),
            ("output_folder", "write", "output folder"),
            ("system", "read", "system (read-only)"),
        ]
    );
    assert_eq!(task.reach.network, "listed");
    assert_eq!(task.reach.domains, ["example.org", "*.example.com"]);
    assert_eq!(
        task.reach.network_source,
        InquelloPolicySource {
            kind: "workspace_policy".to_string(),
            revision: Some(5)
        }
    );

    // With the folder: the runtime's own permission-profile form.
    let response: InquelloPolicyEffectiveResponse =
        decode(task_profile(&processor, policy(), &task_id, Some(folder.clone())).await);
    let runtime = response
        .task
        .and_then(|task| task.runtime_profile)
        .unwrap_or_else(|| panic!("no runtime profile"));
    let output = format!("{folder}/output");
    assert_eq!(runtime.sandbox, "permission-profile");
    assert_eq!(
        runtime.permission_profile_id.as_deref(),
        Some(format!("inquello-task-{task_id}").as_str())
    );
    assert_eq!(runtime.readable_roots, [folder.clone(), output.clone()]);
    assert_eq!(runtime.writable_roots, [folder.clone(), output.clone()]);
    assert_eq!(
        runtime.network_allowlist,
        Some(vec!["example.org".to_string(), "*.example.com".to_string()])
    );
    let table = runtime
        .permission_profile
        .unwrap_or_else(|| panic!("no permissions table"));
    assert_eq!(table["filesystem"][":minimal"], "read");
    assert_eq!(table["filesystem"][folder.as_str()], "write");
    assert_eq!(table["filesystem"][output.as_str()], "write");
    let exe = std::env::current_exe().unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(table["filesystem"][exe.to_string_lossy().as_ref()], "read");
    assert_eq!(
        table["filesystem"].as_object().map(serde_json::Map::len),
        Some(4)
    );
    assert_eq!(
        table["network"],
        json!({ "enabled": true, "domains": { "example.org": "allow", "*.example.com": "allow" } })
    );
    // The table is a valid upstream permissions profile.
    let parsed: Result<codex_config::permissions_toml::PermissionProfileToml, _> =
        serde_json::from_value(table);
    assert!(parsed.is_ok(), "{parsed:?}");

    // A read-only ceiling: nothing writable, the folder read only.
    let response: InquelloPolicyEffectiveResponse = decode(
        task_profile(
            &processor,
            workspace_policy(WORKSPACE, 6, Some(json!({ "sandbox": "read_only" }))),
            &task_id,
            Some(folder.clone()),
        )
        .await,
    );
    let task = response.task.unwrap_or_else(|| panic!("no task"));
    assert_eq!(task.reach.boundaries[0].label, "working folder (read-only)");
    assert_eq!(task.reach.domains, Vec::<String>::new());
    let runtime = task.runtime_profile.unwrap_or_else(|| panic!("no profile"));
    assert_eq!(runtime.writable_roots, Vec::<String>::new());
    assert_eq!(runtime.network_allowlist, Some(Vec::new()));
    let table = runtime.permission_profile.unwrap_or_default();
    assert_eq!(table["filesystem"][folder.as_str()], "read");
    assert_eq!(table["network"], json!({ "enabled": true }));

    // A folder not named after the Task, or without a Task, is refused.
    assert_eq!(
        kind(
            task_profile(
                &processor,
                policy(),
                &task_id,
                Some(dir.path().join("x").to_string_lossy().into_owned())
            )
            .await
        ),
        "invalid"
    );
    assert_eq!(
        kind(
            processor
                .policy_effective(
                    DESKTOP,
                    InquelloPolicyEffectiveParams {
                        workspace_policy: policy(),
                        task_id: None,
                        task_folder: Some(folder),
                    },
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "invalid"
    );
}

#[tokio::test]
async fn a_permitted_full_access_profile_states_no_filesystem_limits() {
    let Fixture { dir, processor } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    let task_id = new_task(&processor, DESKTOP, "task-1").await;
    let folder = make_folder(&dir, &task_id);
    let open = || workspace_policy(WORKSPACE, 2, Some(permissive()));
    let _: InquelloBroadModeSetResponse = decode(
        processor
            .broad_mode_set(
                DESKTOP,
                broad_params(
                    "op-1",
                    0,
                    &task_id,
                    "full_access",
                    Some(FULL_ACCESS_REACH),
                    open(),
                ),
                DeviceRequirements::default(),
                UserConfig::default(),
            )
            .await,
    );
    let response: InquelloPolicyEffectiveResponse =
        decode(task_profile(&processor, open(), &task_id, Some(folder.clone())).await);
    let task = response.task.unwrap_or_else(|| panic!("no task"));
    assert!(!task.reach.bounded);
    assert!(task.reach.boundaries.is_empty());
    assert_eq!(task.reach.network, "unrestricted");
    let runtime = task.runtime_profile.unwrap_or_else(|| panic!("no profile"));
    assert_eq!(runtime.sandbox, "danger-full-access");
    assert_eq!(runtime.permission_profile, None);
    assert_eq!(runtime.network_allowlist, None);
    // The Workspace's standard reach stays bounded.
    assert!(response.reach.bounded);

    let plan = processor
        .tools_exec_plan(
            DESKTOP,
            exec_params(open(), &task_id, &folder, &["true"]),
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await
        .unwrap_or_else(|error| panic!("{error:?}"));
    assert!(plan.config_edits.is_empty());
    assert_eq!(
        plan.exec.sandbox_policy,
        Some(codex_app_server_protocol::SandboxPolicy::DangerFullAccess)
    );
    assert_eq!(plan.exec.permission_profile, None);
}

#[tokio::test]
async fn tools_exec_plans_the_bounded_profile_for_the_creator_only() {
    let Fixture { dir, processor } = fixture();
    sign_in(&processor, DESKTOP, ALICE);
    sign_in(&processor, OTHER, BOB);
    let task_id = new_task(&processor, DESKTOP, "task-1").await;
    let policy = || workspace_policy(WORKSPACE, 1, None);
    let folder = dir.path().join("tasks").join(&task_id);
    let folder_text = folder.to_string_lossy().into_owned();

    // The folder must exist first.
    let missing = processor
        .tools_exec_plan(
            DESKTOP,
            exec_params(policy(), &task_id, &folder_text, &["true"]),
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await;
    assert_eq!(
        missing
            .err()
            .and_then(|error| error.data)
            .map(|data| data["inquello"]["kind"].clone()),
        Some(json!("task_folder_missing"))
    );
    make_folder(&dir, &task_id);

    let plan = processor
        .tools_exec_plan(
            DESKTOP,
            exec_params(policy(), &task_id, &folder_text, &["sh", "-c", "true"]),
            DeviceRequirements::default(),
            UserConfig::default(),
        )
        .await
        .unwrap_or_else(|error| panic!("{error:?}"));
    assert_eq!(plan.config_edits.len(), 3);
    assert_eq!(
        plan.config_edits[0],
        ("features.network_proxy".to_string(), json!(true))
    );
    assert_eq!(
        plan.config_edits[1],
        ("default_permissions".to_string(), json!(":read-only"))
    );
    let (key_path, table) = &plan.config_edits[2];
    assert_eq!(key_path, &format!("permissions.inquello-task-{task_id}"));
    assert_eq!(table["network"], json!({ "enabled": true }));
    assert_eq!(
        plan.exec.permission_profile.as_deref(),
        Some(format!("inquello-task-{task_id}").as_str())
    );
    assert_eq!(plan.exec.sandbox_policy, None);
    assert_eq!(plan.exec.cwd, Some(folder));
    assert_eq!(plan.exec.command, ["sh", "-c", "true"]);
    assert_eq!(plan.exec.timeout_ms, Some(5_000));

    // Another principal, another Workspace or an empty command is refused.
    let refused = |result: Result<ToolsExecPlan, JSONRPCErrorError>| {
        result
            .err()
            .and_then(|error| error.data)
            .and_then(|data| data["inquello"]["kind"].as_str().map(str::to_string))
            .unwrap_or_default()
    };
    assert_eq!(
        refused(
            processor
                .tools_exec_plan(
                    OTHER,
                    exec_params(policy(), &task_id, &folder_text, &["true"]),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "not_found"
    );
    assert_eq!(
        refused(
            processor
                .tools_exec_plan(
                    DESKTOP,
                    exec_params(
                        workspace_policy(OTHER_WORKSPACE, 1, None),
                        &task_id,
                        &folder_text,
                        &["true"]
                    ),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "workspace_mismatch"
    );
    assert_eq!(
        refused(
            processor
                .tools_exec_plan(
                    DESKTOP,
                    exec_params(policy(), &task_id, &folder_text, &[]),
                    DeviceRequirements::default(),
                    UserConfig::default(),
                )
                .await
        ),
        "invalid"
    );
}
