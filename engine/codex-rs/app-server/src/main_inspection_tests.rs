//! Actual native SQLite/CLI composition with fixture proof, NOT executed route
//! authorization evidence, organization approval, or a runtime eligibility seam.
use super::*;
use inquello_adapters::{SqliteWorkingStore, SystemClock};
use inquello_adapters::data_provenance::{InspectRequest, InspectResponse};
use inquello_domain::organise::{Actor, PrincipalId};
use inquello_domain::routes::*;
use inquello_domain::tasks::*;
use inquello_domain::usage::Choices;
use inquello_domain::Revision;
use uuid::Uuid;

async fn store() -> (tempfile::TempDir, InspectRequest) {
    let directory=tempfile::tempdir().unwrap();
    let path=directory.path().join("working.sqlite");
    let store=SqliteWorkingStore::open(&path,&[]).await.unwrap();
    let actor=Actor{principal_id:PrincipalId::from_uuid(Uuid::new_v4())};
    configure_route(&store,&SystemClock,actor,ConfigureRoute {
        operation_id:Uuid::new_v4().to_string(),expected_revision:Revision::ZERO,
        configuration:RouteConfigurationInput {route_id:"claude-api-key".into(),deployment:"anthropic-direct".into(),
            model:CLAUDE_MODEL.into(),api_version:CLAUDE_API_VERSION.into(),account_ref:Uuid::new_v4().to_string(),region:None},
    }).await.unwrap();
    store.reserve_task_run(actor.principal_id,StartTaskIntent {
        operation_id:Uuid::new_v4().to_string(),workspace_id:Uuid::new_v4().to_string(),engagement_id:None,folder_id:None,
        request:"Fictional retained content only".into(),route_id:"claude-api-key".into(),configuration_revision:1,choices:Choices::default(),
    },"fixture-runtime",1,NativeTaskDataTier::Real).await.unwrap();
    store.close().await;
    let request=InspectRequest{version:1,store_path:path,principal_id:actor.principal_id.to_string(),task_root:None,runtime_home:None};
    (directory,request)
}
fn proof(identity:&RouteEvidenceIdentity)->NegativeAuthorizationEvidence {
    NegativeAuthorizationEvidence {
        suite:AUTHORIZATION_SUITE.into(),tested_artifact_digest:"a".repeat(64),processing_scope:"fixture composition only".into(),
        data_policy_digest:env!("INQUELLO_DATA_POLICY_DIGEST").into(),identity:identity.clone(),
        scenarios:REQUIRED_AUTHORIZATION_SCENARIOS.iter().map(|name|(name.to_string(),ScenarioStatus::Passed)).collect(),
        passed:REQUIRED_AUTHORIZATION_SCENARIOS.len() as u32,failed:0,skipped:0,
        command:"unit fixture, not an executed authorization suite".into(),environment:"isolated native SQLite".into(),
        report_digest:"b".repeat(64),limitations:vec!["Composition fixture only; not actual evidence or organization approval".into()],
    }
}
fn refused(response:InspectResponse){
    assert!(!response.available);assert!(response.files.is_empty());assert!(response.workspaces.is_empty());
    let value=serde_json::to_value(response).unwrap();assert_eq!(value["files"],serde_json::json!([]));assert_eq!(value["workspaces"],serde_json::json!([]));
}
#[tokio::test]
async fn real_store_exact_fixture_proof_enriches_final_serialized_inspection() {
    let (_directory,request)=store().await;
    let response=inspect_native_data_with_evidence(request,|identity|Some(proof(identity))).await;
    assert!(response.available,"{:?}",response.reason);assert!(!response.files.is_empty());
    let value=serde_json::to_value(response).unwrap();let task=&value["workspaces"][0]["tasks"][0];
    assert_eq!(task["data_tier"],"real");assert_eq!(task["provenance_kind"],"task_content");
    let identity:RouteEvidenceIdentity=serde_json::from_value(task["route_identity"].clone()).unwrap();
    let configuration=RouteConfiguration::parse(serde_json::from_value(task["route_configuration"].clone()).unwrap()).unwrap();
    assert!(identity.matches_configuration(&configuration));
    assert_eq!(identity.implementation_digest,env!("INQUELLO_BEHAVIOR_DIGEST"));
    assert_eq!(identity.runtime_version,env!("CARGO_PKG_VERSION"));assert_eq!(identity.platform,env!("INQUELLO_BUILD_PLATFORM"));
    assert_eq!(identity.contract_version,format!("inquello-v{}-authorization-v1",inquello_protocol::PROTOCOL_MAJOR));
    assert_eq!(task["report_digest"],"b".repeat(64));assert_eq!(task["processing_scope"],"fixture composition only");
    assert_eq!(task["data_policy_digest"],env!("INQUELLO_DATA_POLICY_DIGEST"));
}
#[tokio::test]
async fn missing_mismatched_or_incomplete_fixture_proof_clears_final_inspection() {
    for mode in ["missing","identity","policy","incomplete"] {
        let (_directory,request)=store().await;
        refused(inspect_native_data_with_evidence(request,|identity| {
            if mode=="missing" {return None;}
            let mut evidence=proof(identity);
            match mode {
                "identity"=>evidence.identity.configuration_digest="c".repeat(64),
                "policy"=>evidence.data_policy_digest="c".repeat(64),
                "incomplete"=>{evidence.scenarios.insert("authorized-export".into(),ScenarioStatus::NotRun);},
                _=>unreachable!(),
            }
            Some(evidence)
        }).await);
    }
}
#[tokio::test]
async fn missing_or_invalid_persisted_route_configuration_clears_final_inspection() {
    for invalid in [false,true] {
        let (_directory,request)=store().await;
        let pool=sqlx::SqlitePool::connect(&format!("sqlite://{}",request.store_path.display())).await.unwrap();
        if invalid {
            sqlx::query("UPDATE processing_route_candidates SET configuration='{}'").execute(&pool).await.unwrap();
        } else {
            sqlx::query("DELETE FROM task_processing_routes").execute(&pool).await.unwrap();
        }
        pool.close().await;
        refused(inspect_native_data_with_evidence(request,|_|panic!("invalid configuration must not request proof")).await);
    }
}
#[tokio::test]
async fn production_compiled_register_still_refuses_real_store() {
    let (_directory,request)=store().await;
    refused(inspect_native_data(request).await);
}
