//! Actual native SQLite/CLI composition with fixture proof, NOT executed route
//! authorization evidence, organization approval, or a runtime eligibility seam.
use super::*;
use inquello_adapters::data_provenance::{InspectRequest, InspectResponse};
use inquello_adapters::{SqliteWorkingStore, SystemClock};
use inquello_domain::Revision;
use inquello_domain::organise::{Actor, PrincipalId};
use inquello_domain::routes::*;
use inquello_domain::tasks::*;
use inquello_domain::usage::Choices;
use uuid::Uuid;

async fn store() -> (tempfile::TempDir, InspectRequest) {
    store_for(RouteId::ClaudeApiKey).await
}
async fn store_for(route: RouteId) -> (tempfile::TempDir, InspectRequest) {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("working.sqlite");
    let store = SqliteWorkingStore::open(&path, &[]).await.unwrap();
    let actor = Actor {
        principal_id: PrincipalId::from_uuid(Uuid::new_v4()),
    };
    configure_route(
        &store,
        &SystemClock,
        actor,
        ConfigureRoute {
            operation_id: Uuid::new_v4().to_string(),
            expected_revision: Revision::ZERO,
            configuration: RouteConfigurationInput {
                route_id: route.as_str().into(),
                deployment: if route == RouteId::CodexResponses {
                    "openai-api"
                } else {
                    "anthropic-direct"
                }
                .into(),
                model: if route == RouteId::CodexResponses {
                    "gpt-6.1-terra"
                } else {
                    CLAUDE_MODEL
                }
                .into(),
                api_version: if route == RouteId::CodexResponses {
                    "responses-v1"
                } else {
                    CLAUDE_API_VERSION
                }
                .into(),
                account_ref: Uuid::new_v4().to_string(),
                region: None,
            },
        },
    )
    .await
    .unwrap();
    store
        .reserve_task_run(
            actor.principal_id,
            StartTaskIntent {
                operation_id: Uuid::new_v4().to_string(),
                workspace_id: Uuid::new_v4().to_string(),
                engagement_id: None,
                folder_id: None,
                request: "Fictional retained content only".into(),
                route_id: route.as_str().into(),
                configuration_revision: 1,
                choices: Choices::default(),
            },
            "fixture-runtime",
            1,
            NativeTaskDataTier::Real,
        )
        .await
        .unwrap();
    store.close().await;
    let request = InspectRequest {
        version: 1,
        store_path: path,
        principal_id: actor.principal_id.to_string(),
        task_root: None,
        runtime_home: None,
    };
    (directory, request)
}
fn proof(identity: &RouteEvidenceIdentity) -> NegativeAuthorizationEvidence {
    NegativeAuthorizationEvidence {
        suite: AUTHORIZATION_SUITE.into(),
        tested_artifact_digest: "a".repeat(64),
        processing_scope: "fixture composition only".into(),
        data_policy_digest: env!("INQUELLO_DATA_POLICY_DIGEST").into(),
        identity: identity.clone(),
        scenarios: REQUIRED_AUTHORIZATION_SCENARIOS
            .iter()
            .map(|name| (name.to_string(), ScenarioStatus::Passed))
            .collect(),
        passed: REQUIRED_AUTHORIZATION_SCENARIOS.len() as u32,
        failed: 0,
        skipped: 0,
        command: "unit fixture, not an executed authorization suite".into(),
        environment: "isolated native SQLite".into(),
        report_digest: "b".repeat(64),
        limitations: vec![
            "Composition fixture only; not actual evidence or organization approval".into(),
        ],
    }
}
fn refused(response: InspectResponse) {
    assert!(!response.available);
    assert!(response.files.is_empty());
    assert!(response.workspaces.is_empty());
    let value = serde_json::to_value(response).unwrap();
    assert_eq!(value["files"], serde_json::json!([]));
    assert_eq!(value["workspaces"], serde_json::json!([]));
}
#[tokio::test]
async fn real_store_exact_fixture_proof_enriches_final_serialized_inspection() {
    let (_directory, request) = store().await;
    let response =
        inspect_native_data_with_evidence(request, |identity| Some(proof(identity))).await;
    assert!(response.available, "{:?}", response.reason);
    assert!(!response.files.is_empty());
    let value = serde_json::to_value(response).unwrap();
    let task = &value["workspaces"][0]["tasks"][0];
    assert_eq!(task["data_tier"], "real");
    assert_eq!(task["provenance_kind"], "task_content");
    let identity: RouteEvidenceIdentity =
        serde_json::from_value(task["route_identity"].clone()).unwrap();
    let configuration = RouteConfiguration::parse(
        serde_json::from_value(task["route_configuration"].clone()).unwrap(),
    )
    .unwrap();
    assert!(identity.matches_configuration(&configuration));
    assert_eq!(
        identity.implementation_digest,
        env!("INQUELLO_BEHAVIOR_DIGEST")
    );
    assert_eq!(identity.runtime_version, env!("CARGO_PKG_VERSION"));
    assert_eq!(identity.platform, env!("INQUELLO_BUILD_PLATFORM"));
    assert_eq!(
        identity.contract_version,
        format!(
            "inquello-v{}-authorization-v2",
            inquello_protocol::PROTOCOL_MAJOR
        )
    );
    assert_eq!(task["report_digest"], "b".repeat(64));
    assert_eq!(task["processing_scope"], "fixture composition only");
    assert_eq!(
        task["data_policy_digest"],
        env!("INQUELLO_DATA_POLICY_DIGEST")
    );
}
#[tokio::test]
async fn missing_mismatched_or_incomplete_fixture_proof_clears_final_inspection() {
    for mode in ["missing", "identity", "policy", "incomplete"] {
        let (_directory, request) = store().await;
        refused(
            inspect_native_data_with_evidence(request, |identity| {
                if mode == "missing" {
                    return None;
                }
                let mut evidence = proof(identity);
                match mode {
                    "identity" => evidence.identity.adapter_configuration_digest = "c".repeat(64),
                    "policy" => evidence.data_policy_digest = "c".repeat(64),
                    "incomplete" => {
                        evidence
                            .scenarios
                            .insert("authorized-export".into(), ScenarioStatus::NotRun);
                    }
                    _ => unreachable!(),
                }
                Some(evidence)
            })
            .await,
        );
    }
}
#[tokio::test]
#[expect(
    clippy::disallowed_methods,
    reason = "This owned temporary-database fault fixture deliberately corrupts persisted route data to verify inspection refuses it; production access retains the guarded store."
)]
async fn missing_or_invalid_persisted_route_configuration_clears_final_inspection() {
    for invalid in [false, true] {
        let (_directory, request) = store().await;
        let pool = sqlx::SqlitePool::connect(&format!("sqlite://{}", request.store_path.display()))
            .await
            .unwrap();
        if invalid {
            sqlx::query("UPDATE processing_route_candidates SET configuration='{}'")
                .execute(&pool)
                .await
                .unwrap();
        } else {
            sqlx::query("DELETE FROM task_processing_routes")
                .execute(&pool)
                .await
                .unwrap();
        }
        pool.close().await;
        refused(
            inspect_native_data_with_evidence(request, |_| {
                panic!("invalid configuration must not request proof")
            })
            .await,
        );
    }
}
#[tokio::test]
async fn production_compiled_inspection_requires_exact_current_qualification() {
    for route in [RouteId::ClaudeApiKey, RouteId::CodexResponses] {
        let (_directory, request) = store_for(route).await;
        // Derive expected identity from actual persisted configuration, independently
        // of the production inspection enrichment under test.
        let raw = inquello_adapters::data_provenance::inspect(InspectRequest {
            version: request.version,
            store_path: request.store_path.clone(),
            principal_id: request.principal_id.clone(),
            task_root: request.task_root.clone(),
            runtime_home: request.runtime_home.clone(),
        })
        .await;
        assert!(raw.available);
        let configuration = RouteConfiguration::parse(
            raw.workspaces[0].tasks[0]
                .route_configuration
                .clone()
                .unwrap(),
        )
        .unwrap();
        let identity = RouteEvidenceIdentity {
            schema_version: ROUTE_EVIDENCE_SCHEMA_VERSION,
            route_id: configuration.route_id().as_str().into(),
            deployment: configuration.deployment().into(),
            endpoint: configuration.endpoint().into(),
            model: configuration.model().into(),
            api_version: configuration.api_version().into(),
            adapter_configuration_digest: adapter_configuration_digest(&configuration),
            implementation_digest: env!("INQUELLO_BEHAVIOR_DIGEST").into(),
            runtime_version: env!("CARGO_PKG_VERSION").into(),
            contract_version: format!(
                "inquello-v{}-authorization-v2",
                inquello_protocol::PROTOCOL_MAJOR
            ),
            platform: env!("INQUELLO_BUILD_PLATFORM").into(),
        };
        let expected = compiled_evidence_for_identity(&identity)
            .filter(|proof| proof.data_policy_digest == env!("INQUELLO_DATA_POLICY_DIGEST"));
        if route == RouteId::ClaudeApiKey {
            assert!(expected.is_none(), "Claude remains separately unqualified");
        }
        let response = inspect_native_data(request).await;
        let Some(proof) = expected else {
            refused(response);
            continue;
        };
        assert!(proof.complete());
        assert_eq!(proof.identity, identity);
        assert!(identity.matches_configuration(&configuration));
        let register = inquello_domain::capability::CapabilityRegister::load_embedded().unwrap();
        assert_eq!(
            proof.processing_scope,
            register
                .entry(route.capability_id())
                .unwrap()
                .processing_scope
        );
        assert!(response.available, "{:?}", response.reason);
        assert!(!response.files.is_empty());
        let value = serde_json::to_value(response).unwrap();
        let task = &value["workspaces"][0]["tasks"][0];
        assert_eq!(task["data_tier"], "real");
        assert_eq!(task["provenance_kind"], "task_content");
        assert_eq!(
            task["route_identity"],
            serde_json::to_value(identity).unwrap()
        );
        assert_eq!(task["report_digest"], proof.report_digest);
        assert_eq!(task["processing_scope"], proof.processing_scope);
        assert_eq!(
            task["data_policy_digest"],
            env!("INQUELLO_DATA_POLICY_DIGEST")
        );
        // Inventory qualification is not a Workspace approval or an export receipt.
        assert!(task.get("route_authority").is_none());
        assert!(task.get("export_receipt").is_none());
    }
}

#[tokio::test]
async fn terra_native_inventory_preserves_exact_proof_and_refuses_unknown_evidence() {
    for mode in ["allowed", "missing", "wrong-model", "old-schema"] {
        let (_directory, request) = store_for(RouteId::CodexResponses).await;
        let response = inspect_native_data_with_evidence(request, |identity| {
            assert_eq!(identity.route_id, "codex-responses");
            assert_eq!(identity.model, "gpt-6.1-terra");
            assert_eq!(identity.api_version, "responses-v1");
            if mode == "missing" {
                return None;
            }
            let mut evidence = proof(identity);
            if mode == "wrong-model" {
                evidence.identity.model = "gpt-6.1-sol".into();
            }
            if mode == "old-schema" {
                evidence.identity.schema_version = 1;
            }
            Some(evidence)
        })
        .await;
        if mode != "allowed" {
            refused(response);
            continue;
        }
        assert!(response.available);
        assert!(!response.files.is_empty());
        let serialized = serde_json::to_value(response).unwrap();
        let task = &serialized["workspaces"][0]["tasks"][0];
        let identity: RouteEvidenceIdentity =
            serde_json::from_value(task["route_identity"].clone()).unwrap();
        let configuration = RouteConfiguration::parse(
            serde_json::from_value(task["route_configuration"].clone()).unwrap(),
        )
        .unwrap();
        assert!(identity.matches_configuration(&configuration));
        assert_eq!(
            identity.implementation_digest,
            env!("INQUELLO_BEHAVIOR_DIGEST")
        );
        assert_eq!(identity.platform, env!("INQUELLO_BUILD_PLATFORM"));
        assert_eq!(task["data_tier"], "real");
        assert_eq!(task["report_digest"], "b".repeat(64));
    }
}
