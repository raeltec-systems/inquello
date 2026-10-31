//! Unit-test-only proof substitution. Never compiled into service binaries and
//! never evidence of actual model behavior or a reviewed production route.
use super::*;
use crate::route_test_support::Harness;
use inquello_domain::routes::{NegativeAuthorizationEvidence,ScenarioStatus,AUTHORIZATION_SUITE,REQUIRED_AUTHORIZATION_SCENARIOS,ProtectedRouteUse};
use inquello_protocol::workspace::AcceptInviteResponse;
use serde_json::json;
use std::{sync::Arc,time::Duration};
fn identity() -> RouteEvidenceIdentity {
    RouteEvidenceIdentity {route_id:"codex-responses".into(),deployment:"openai-api".into(),endpoint:"https://api.openai.com/v1/responses".into(),
        model:"fixture-only".into(),api_version:"responses-v1".into(),configuration_digest:"a".repeat(64),implementation_digest:"b".repeat(64),
        runtime_version:"unit-fixture".into(),contract_version:"1".into(),platform:"unit-fixture".into()}
}
fn proof(identity_arg:&RouteEvidenceIdentity,digest:&str)->Option<NegativeAuthorizationEvidence> {
    if identity_arg != &identity() || digest != "c".repeat(64) {return None;}
    Some(NegativeAuthorizationEvidence {suite:AUTHORIZATION_SUITE.into(),identity:identity(),tested_artifact_digest:"d".repeat(64),
        processing_scope:"fixture-only".into(),data_policy_digest:"e".repeat(64),
        scenarios:REQUIRED_AUTHORIZATION_SCENARIOS.iter().map(|s|(s.to_string(),ScenarioStatus::Passed)).collect(),
        passed:REQUIRED_AUTHORIZATION_SCENARIOS.len() as u32,failed:0,skipped:0,command:"unit fixture, not executed route evidence".into(),
        environment:"isolated PostgreSQL test".into(),report_digest:digest.into(),limitations:vec!["Artificial evidence only inside cfg(test)".into()]})
}
fn state(h:&Harness)->Arc<AppState> {
    let hour=chrono::TimeDelta::hours(1);
    Arc::new(AppState {pool:h.pool.clone(),clock:h.clock.clone(),issuers:vec![],lifetimes:crate::server::EffectiveLifetimes {
        login_transaction:hour,access:hour,refresh:hour,session:hour,id_token_clock_skew:Duration::ZERO,invite:hour,
    }})
}
#[tokio::test]
async fn passing_fixture_approval_is_current_scoped_and_revocable() {
    let h=Harness::start().await;
    let ws=crate::admin::create_workspace(&h.pool,crate::admin::CreateWorkspace {
        name:"Fixture positive".into(),kind:"internal_company".into(),policy:include_str!("../../inquello-protocol/fixtures/workspace/policy.json").into(),
        first_admin_issuer:h.issuer.issuer().into(),first_admin_subject:"alice-positive".into(),invite_lifetime:Duration::from_secs(3600),operator:"fixture-only".into(),
    },h.now()).await.unwrap();
    let alice=h.sign_in("alice-positive").await;
    h.post(&format!("/v1/invites/{}/accept",ws.first_admin_invite_id),&json!({}),Some(alice.access_credential.expose())).await.ok::<AcceptInviteResponse>();
    let approval=OrganizationRouteApproval {workspace_id:ws.workspace_id.to_string(),route_id:"codex-responses".into(),evidence_digest:"c".repeat(64),
        processing_scope:"fixture-only".into(),data_policy_digest:"e".repeat(64),issuer:"fixture-issuer".into(),operator_reference:"fixture-ref".into(),
        valid_from:h.now().timestamp()-1,expires_at:h.now().timestamp()+3600,review_at:h.now().timestamp()+1800,revision:1,policy_revision:1,revoked:false};
    let command=RouteApprovalCommand {workspace_id:ws.workspace_id,operation_id:Uuid::new_v4(),command_epoch:h.command_epoch().await.parse().unwrap(),
        expected_revision:0,operator:"fixture-only".into(),payload:RouteApprovalChange::Approve {identity:identity(),approval}};
    assert!(apply(&h.pool,command.clone(),h.now()).await.is_err(),"shipping compiled path cannot accept artificial proof");
    let outcome=apply_with_evidence(&h.pool,command.clone(),h.now(),proof).await.unwrap();
    assert_eq!(apply_with_evidence(&h.pool,command,h.now(),proof).await.unwrap().receipt_id,outcome.receipt_id);
    let state=state(&h);
    let principal_revision:i64=sqlx::query_scalar("SELECT revision FROM principals WHERE principal_id=$1").bind(alice.principal_id).fetch_one(&h.pool).await.unwrap();
    let session_revision:i64=sqlx::query_scalar("SELECT revision FROM sessions WHERE session_id=$1").bind(alice.session_id).fetch_one(&h.pool).await.unwrap();
    let request=wire::RouteEligibilityCheckRequest {identity:identity(),report_digest:"c".repeat(64),binding:ProtectedRouteUse {
        action:ProtectedRouteAction::Derive,principal_id:alice.principal_id.to_string(),session_id:alice.session_id.to_string(),task_id:Uuid::new_v4().to_string(),
        workspace_id:ws.workspace_id.to_string(),operation_id:Uuid::new_v4().to_string(),generation:1,principal_revision:principal_revision as u64,
        session_revision:session_revision as u64,authorization_epoch:outcome.authorization_epoch.parse().unwrap(),policy_revision:1,approval_revision:1,
        processing_scope:"fixture-only".into(),data_policy_digest:"e".repeat(64),
    }};
    assert!(check(&state,alice.access_credential.expose(),ws.workspace_id,request.clone()).await.is_err());
    let allowed=check_with_evidence(&state,alice.access_credential.expose(),ws.workspace_id,request.clone(),proof).await.unwrap();
    assert_eq!(allowed.authority.binding,request.binding);
    let mut wrong=request.clone();wrong.binding.processing_scope="broader".into();
    assert!(check_with_evidence(&state,alice.access_credential.expose(),ws.workspace_id,wrong,proof).await.is_err());
    // A committed withdrawal is the ordering boundary. The old service answer
    // remains historical; neither its nonce nor its timestamp restores authority.
    let revoke=RouteApprovalCommand {workspace_id:ws.workspace_id,operation_id:Uuid::new_v4(),command_epoch:h.command_epoch().await.parse().unwrap(),
        expected_revision:1,operator:"fixture-only".into(),payload:RouteApprovalChange::Revoke {route_id:"codex-responses".into()}};
    let mut blocker=h.pool.begin().await.unwrap();
    sqlx::query("SELECT workspace_id FROM workspaces WHERE workspace_id=$1 FOR UPDATE").bind(ws.workspace_id).execute(&mut *blocker).await.unwrap();
    let pool=h.pool.clone();let now=h.now();
    let revoke_task=tokio::spawn(async move {apply_with_evidence(&pool,revoke,now,proof).await});
    wait_workspace_waiters(&h.pool,1).await;
    let check_state=state.clone();let access=alice.access_credential.expose().to_string();let workspace=ws.workspace_id;let request_for_wait=request.clone();
    let waiting_check=tokio::spawn(async move {check_with_evidence(&check_state,&access,workspace,request_for_wait,proof).await});
    wait_workspace_waiters(&h.pool,2).await;
    blocker.commit().await.unwrap();
    revoke_task.await.unwrap().unwrap();
    assert!(waiting_check.await.unwrap().is_err(),"queued check observes earlier withdrawal, never stale approval");
    assert!(check_with_evidence(&state,alice.access_credential.expose(),ws.workspace_id,request,proof).await.is_err());
    h.finish().await;
}

async fn wait_workspace_waiters(pool:&PgPool,minimum:i64) {
    tokio::time::timeout(Duration::from_secs(10),async {
        loop {
            let count:i64=sqlx::query_scalar("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%FROM workspaces WHERE workspace_id = $1 FOR %'")
                .fetch_one(pool).await.unwrap();
            if count>=minimum {break;}
            tokio::task::yield_now().await;
        }
    }).await.expect("actual PostgreSQL Workspace lock wait observed, not a timing assumption");
}

#[tokio::test]
async fn additive_migrations_upgrade_existing_identity_store_without_seeding_authority() {
    use crate::route_test_support::TestDatabase;
    let database=TestDatabase::create().await;
    let pool=crate::postgres::connect(&crate::DatabaseConfig {connect:database.options(),max_connections:2,acquire_timeout:Duration::from_secs(5)}).await.unwrap();
    let old=tempfile::tempdir().unwrap();
    for (name,bytes) in [
        ("0001_identity_sessions_receipts.sql",include_str!("../migrations/0001_identity_sessions_receipts.sql")),
        ("0002_workspaces_memberships.sql",include_str!("../migrations/0002_workspaces_memberships.sql")),
    ] {std::fs::write(old.path().join(name),bytes).unwrap();}
    sqlx::migrate::Migrator::new(old.path()).await.unwrap().run(&pool).await.unwrap();
    let id=Uuid::new_v4();
    sqlx::query("INSERT INTO workspaces(workspace_id,name,kind,policy_revision,authorization_epoch,revision,created_at,updated_at) VALUES($1,'pre-upgrade fixture','internal_company',1,7,3,now(),now())")
        .bind(id).execute(&pool).await.unwrap();
    crate::postgres::migrate(&pool).await.unwrap();
    let row=sqlx::query("SELECT authorization_epoch,revision FROM workspaces WHERE workspace_id=$1").bind(id).fetch_one(&pool).await.unwrap();
    assert_eq!(row.get::<i64,_>("authorization_epoch"),7);assert_eq!(row.get::<i64,_>("revision"),3);
    for sql in ["SELECT count(*) FROM route_approvals","SELECT count(*) FROM route_approval_history","SELECT count(*) FROM export_provenance_receipts"] {
        assert_eq!(sqlx::query_scalar::<_,i64>(sql).fetch_one(&pool).await.unwrap(),0);
    }
    pool.close().await;
}

// This module is reachable only through cfg(test, feature="test-issuer").
// The driver starts a debug, default-off inference-fixtures child; it never
// classifies its fictional inputs as real or alters the compiled registry.
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[path="../../app-server/tests/common/inquello_authorization_driver.rs"]
mod retained_driver;

fn retained_proof(id:&RouteEvidenceIdentity,digest:&str)->Option<NegativeAuthorizationEvidence> {
    let (model,deployment,endpoint,api)=match id.route_id.as_str() {
        "codex-responses"=>("fixture-responses-20261031","openai-api","https://api.openai.com/v1/responses","responses-v1"),
        "claude-api-key"=>("claude-sonnet-5-5","anthropic-direct","https://api.anthropic.com/v1/messages","2026-10-21"),
        _=>return None,
    };
    if id.model!=model || id.deployment!=deployment || id.endpoint!=endpoint || id.api_version!=api
        || id.implementation_digest!="b".repeat(64) || id.runtime_version!="unit-fixture"
        || id.platform!="unit-fixture" || !sha256_digest(&id.configuration_digest) {return None;}
    let mut p=proof(&identity(),digest)?;p.identity=id.clone();Some(p)
}

#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
async fn coupled_retained(route:&'static str,scenario:&'static str) {
    use inquello_domain::routes::{RouteConfiguration,RouteConfigurationInput,configuration_digest};
    let h=Harness::start().await;
    let ws=crate::admin::create_workspace(&h.pool,crate::admin::CreateWorkspace {
        name:"Retained synthetic coupling".into(),kind:"internal_company".into(),policy:include_str!("../../inquello-protocol/fixtures/workspace/policy.json").into(),
        first_admin_issuer:h.issuer.issuer().into(),first_admin_subject:"retained-owner".into(),invite_lifetime:Duration::from_secs(3600),operator:"fixture-only".into(),
    },h.now()).await.unwrap();
    let alice=h.sign_in("retained-owner").await;
    h.post(&format!("/v1/invites/{}/accept",ws.first_admin_invite_id),&json!({}),Some(alice.access_credential.expose())).await.ok::<AcceptInviteResponse>();
    let responses=route=="codex-responses";
    let configuration=RouteConfiguration::parse(RouteConfigurationInput {route_id:route.into(),deployment:if responses{"openai-api"}else{"anthropic-direct"}.into(),
        model:if responses{"fixture-responses-20261031"}else{"claude-sonnet-5-5"}.into(),api_version:if responses{"responses-v1"}else{"2026-10-21"}.into(),account_ref:alice.principal_id.to_string(),region:None}).unwrap();
    let mut id=identity();id.route_id=route.into();id.model=configuration.model().into();id.endpoint=configuration.endpoint().into();id.deployment=configuration.deployment().into();id.api_version=configuration.api_version().into();id.configuration_digest=configuration_digest(&configuration);
    let proof=retained_proof(&id,&"c".repeat(64)).unwrap();
    let approval=OrganizationRouteApproval {workspace_id:ws.workspace_id.to_string(),route_id:route.into(),evidence_digest:proof.report_digest.clone(),processing_scope:proof.processing_scope.clone(),data_policy_digest:proof.data_policy_digest.clone(),issuer:"fixture-issuer".into(),operator_reference:"retained-fixture-only".into(),valid_from:h.now().timestamp()-1,expires_at:h.now().timestamp()+3600,review_at:h.now().timestamp()+1800,revision:1,policy_revision:1,revoked:false};
    let command=RouteApprovalCommand {workspace_id:ws.workspace_id,operation_id:Uuid::new_v4(),command_epoch:h.command_epoch().await.parse().unwrap(),expected_revision:0,operator:"fixture-only".into(),payload:RouteApprovalChange::Approve {identity:id.clone(),approval}};
    assert!(apply(&h.pool,command.clone(),h.now()).await.is_err(),"production operator cannot accept test proof for either adapter");
    let state=state(&h);
    let principal_revision:i64=sqlx::query_scalar("SELECT revision FROM principals WHERE principal_id=$1").bind(alice.principal_id).fetch_one(&h.pool).await.unwrap();
    let session_revision:i64=sqlx::query_scalar("SELECT revision FROM sessions WHERE session_id=$1").bind(alice.session_id).fetch_one(&h.pool).await.unwrap();
    let epoch:i64=sqlx::query_scalar("SELECT authorization_epoch FROM workspaces WHERE workspace_id=$1").bind(ws.workspace_id).fetch_one(&h.pool).await.unwrap();
    let mut request=wire::RouteEligibilityCheckRequest {identity:id,report_digest:proof.report_digest,binding:ProtectedRouteUse {action:ProtectedRouteAction::Derive,
        principal_id:alice.principal_id.to_string(),session_id:alice.session_id.to_string(),task_id:Uuid::new_v4().to_string(),workspace_id:ws.workspace_id.to_string(),operation_id:Uuid::new_v4().to_string(),generation:1,
        principal_revision:principal_revision as u64,session_revision:session_revision as u64,authorization_epoch:epoch as u64,policy_revision:1,approval_revision:1,processing_scope:proof.processing_scope,data_policy_digest:proof.data_policy_digest}};
    assert!(check_with_evidence(&state,alice.access_credential.expose(),ws.workspace_id,request.clone(),retained_proof).await.is_err(),"proof alone is not approval");
    if scenario!="deny-before-dispatch" {let outcome=apply_with_evidence(&h.pool,command,h.now(),retained_proof).await.unwrap();request.binding.authorization_epoch=outcome.authorization_epoch.parse().unwrap();}
    assert!(check(&state,alice.access_credential.expose(),ws.workspace_id,request.clone()).await.is_err(),"shipping checker never uses fixture proof");
    let policy=json!({"workspaceId":ws.workspace_id,"policyRevision":1,"authorizationEpoch":request.binding.authorization_epoch,"execution":{"command_rules":[{"prefix":["/bin/sh"],"decision":"prompt"}]}});
    let access=alice.access_credential.expose().to_string();let callback_policy=policy.clone();let workspace=ws.workspace_id;
    let observed=Arc::new(std::sync::atomic::AtomicUsize::new(0));let observations=observed.clone();
    let authority=Arc::new(move |params:serde_json::Value| -> std::pin::Pin<Box<dyn std::future::Future<Output=serde_json::Value>+Send>> {
        let state=state.clone();let access=access.clone();let policy=callback_policy.clone();let mut request=request.clone();let observations=observations.clone();
        Box::pin(async move {
            assert_eq!(params["workspaceId"],workspace.to_string());
            let context=&params["fixtureContext"];
            if let Some(c)=context["configuration"].as_object() {
                assert_eq!(c["routeId"],request.identity.route_id);assert_eq!(c["model"],request.identity.model);
                assert_eq!(c["deployment"],request.identity.deployment);assert_eq!(c["apiVersion"],request.identity.api_version);assert_eq!(c["accountRef"],request.binding.principal_id);assert!(c["region"].is_null());
            }
            if let Some(task)=context["taskId"].as_str(){request.binding.task_id=task.into();observations.fetch_add(1,std::sync::atomic::Ordering::SeqCst);}
            // A new check nonce every callback; preparatory checks lack Task ID.
            // Native independently owns the actual Task/run and synthetic tier.
            request.binding.operation_id=Uuid::new_v4().to_string();
            match check_with_evidence(&state,&access,workspace,request,retained_proof).await {
                Ok(_)=>json!({"workspacePolicy":policy}),Err(_)=>json!({"workspacePolicy":null}),
            }
        })
    });
    let pool=h.pool.clone();let now=h.now();let command_epoch=h.command_epoch().await.parse().unwrap();
    let revoke=Arc::new(move || -> std::pin::Pin<Box<dyn std::future::Future<Output=()>+Send>> {
        let pool=pool.clone();Box::pin(async move {
            apply_with_evidence(&pool,RouteApprovalCommand {workspace_id:workspace,operation_id:Uuid::new_v4(),command_epoch,expected_revision:1,operator:"fixture-only".into(),payload:RouteApprovalChange::Revoke {route_id:route.into()}},now,retained_proof).await.unwrap();
        })
    });
    retained_driver::run(route,scenario,Some(retained_driver::ServiceFixture {principal:alice.principal_id.to_string(),workspace:workspace.to_string(),policy,authority,revoke})).await;
    if scenario!="deny-before-dispatch" {assert!(observed.load(std::sync::atomic::Ordering::SeqCst)>0,"fresh service decisions used captured actual retained Task IDs");}
    h.finish().await;
}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_responses_allowed(){coupled_retained("codex-responses","allowed").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_responses_revoke_model(){coupled_retained("codex-responses","revoke-model").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_responses_revoke_pending_permission(){coupled_retained("codex-responses","revoke-pending-permission").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_responses_revoke_running_tool(){coupled_retained("codex-responses","revoke-running-tool").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_messages_allowed(){coupled_retained("claude-api-key","allowed").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_messages_revoke_model(){coupled_retained("claude-api-key","revoke-model").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_messages_revoke_pending_permission(){coupled_retained("claude-api-key","revoke-pending-permission").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_messages_revoke_running_tool(){coupled_retained("claude-api-key","revoke-running-tool").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_responses_deny_before_dispatch(){coupled_retained("codex-responses","deny-before-dispatch").await;}
#[cfg(all(feature="retained-fixtures",debug_assertions,target_os="linux"))]
#[tokio::test(flavor="multi_thread",worker_threads=4)] async fn coupled_messages_deny_before_dispatch(){coupled_retained("claude-api-key","deny-before-dispatch").await;}
