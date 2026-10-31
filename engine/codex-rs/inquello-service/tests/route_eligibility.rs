//! PostgreSQL 18 / test-issuer fixture tests, not model/runtime evidence.
//! Run: INQUELLO_TEST_DATABASE_URL=... cargo test -p inquello-service 
//! --features test-issuer --test route_eligibility. Missing DB is a failure, not a skip.
#![allow(clippy::expect_used, reason = "isolated test assertions")]
mod support;
use inquello_protocol::workspace::{AcceptInviteResponse, RouteApprovalView};
use inquello_service::admin::{self, CreateWorkspace, RouteApprovalCommand, RouteApprovalChange};
use inquello_domain::routes::OrganizationRouteApproval;
use serde_json::json;
use support::Harness;
use std::time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn absent_proof_never_becomes_member_or_operator_authority() {
    let h = Harness::start().await;
    let policy = include_str!("../../inquello-protocol/fixtures/workspace/policy.json");
    let created = admin::create_workspace(&h.pool, CreateWorkspace {
        name: "Fictional company A".into(), kind: "internal_company".into(), policy: policy.into(),
        first_admin_issuer: h.issuer.issuer().to_string(), first_admin_subject: "alice".into(),
        invite_lifetime: Duration::from_secs(3600), operator: "fixture-operator".into(),
    }, h.now()).await.expect("create fixture Workspace");
    let alice = h.sign_in("alice").await;
    h.post(&format!("/v1/invites/{}/accept", created.first_admin_invite_id), &json!({}), Some(alice.access_credential.expose()))
        .await.ok::<AcceptInviteResponse>();
    let outsider = h.sign_in("outsider").await;
    let path = format!("/v1/workspaces/{}/route-approvals/codex-responses", created.workspace_id);
    let view = h.get(&path, Some(alice.access_credential.expose())).await.ok::<RouteApprovalView>();
    assert!(view.approval.is_none());
    let foreign = h.get(&path, Some(outsider.access_credential.expose())).await;
    let absent = h.get(&format!("/v1/workspaces/{}/route-approvals/codex-responses", Uuid::new_v4()), Some(outsider.access_credential.expose())).await;
    assert_eq!(foreign.status, absent.status);
    assert_eq!(foreign.body, absent.body);
    assert!(!foreign.body.to_string().contains("Fictional company A"));
    assert!(!h.get(&path, None).await.status.is_success());
    // Malformed/self-asserted evidence cannot be accepted as a success claim.
    assert!(!h.post(&format!("/v1/workspaces/{}/route-eligibility-checks", created.workspace_id),
        &json!({"passed": true, "real_data_eligible": true}), Some(alice.access_credential.expose())).await.status.is_success());
    h.finish().await;
}

#[tokio::test]
async fn revoke_fixture_is_revisioned_idempotent_and_cannot_replay_changed_body() {
    let h = Harness::start().await;
    let _credentials = h.sign_in("fixture-bob").await;
    let created = admin::create_workspace(&h.pool, CreateWorkspace {
        name: "Fictional company B".into(), kind: "internal_company".into(),
        policy: include_str!("../../inquello-protocol/fixtures/workspace/policy.json").into(),
        first_admin_issuer: h.issuer.issuer().to_string(), first_admin_subject: "bob".into(),
        invite_lifetime: Duration::from_secs(3600), operator: "fixture-operator".into(),
    }, h.now()).await.expect("create fixture Workspace");
    // Explicit historical fixture insertion, NOT an approved compiled route.
    // It exercises withdrawal/receipt ordering only and cannot pass a fresh check.
    let identity = json!({"route_id":"codex-responses", "deployment":"openai-api", "endpoint":"https://api.openai.com/v1/responses",
        "model":"fixture", "api_version":"fixture", "configuration_digest":"a".repeat(64), "implementation_digest":"b".repeat(64),
        "runtime_version":"fixture", "contract_version":"1", "platform":"fixture"});
    let approval = OrganizationRouteApproval {
        workspace_id: created.workspace_id.to_string(), route_id: "codex-responses".into(), evidence_digest: "d".repeat(64),
        processing_scope: "fixture-only".into(), data_policy_digest: "e".repeat(64), issuer: "fixture-issuer".into(),
        operator_reference: "fixture-reference".into(), valid_from: h.now().timestamp()-1, expires_at: h.now().timestamp()+3600,
        review_at: h.now().timestamp()+1800, revision: 1, policy_revision: 1, revoked: false,
    };
    let attempted = RouteApprovalCommand {
        workspace_id: created.workspace_id, operation_id: Uuid::new_v4(),
        command_epoch: h.command_epoch().await.parse().expect("epoch"), expected_revision: 0,
        operator: "fixture-operator".into(), payload: RouteApprovalChange::Approve {
            identity: serde_json::from_value(identity.clone()).expect("identity fixture"), approval: approval.clone(),
        },
    };
    assert!(admin::route_approval(&h.pool, attempted, h.now()).await.is_err(),
        "operator cannot invent passing compiled evidence");
    sqlx::query("INSERT INTO route_approvals(workspace_id,route_id,revision,identity,approval,updated_at) VALUES($1,'codex-responses',1,$2,$3,$4)")
        .bind(created.workspace_id).bind(identity).bind(sqlx::types::Json(&approval)).bind(h.now()).execute(&h.pool).await.expect("seed historical fixture");
    let command = RouteApprovalCommand {
        workspace_id: created.workspace_id, operation_id: Uuid::new_v4(), command_epoch: h.command_epoch().await.parse().expect("epoch"),
        expected_revision: 1, operator: "fixture-operator".into(), payload: RouteApprovalChange::Revoke { route_id: "codex-responses".into() },
    };
    let result = admin::route_approval(&h.pool, command.clone(), h.now()).await.expect("revoke");
    let retry = admin::route_approval(&h.pool, command.clone(), h.now()).await.expect("exact retry");
    assert_eq!(result.receipt_id, retry.receipt_id);
    assert_eq!(result.revision, "2");
    let mut changed = command.clone(); changed.operator = "different-operator".into();
    assert!(admin::route_approval(&h.pool, changed, h.now()).await.is_err());
    let mut stale = command; stale.operation_id = Uuid::new_v4();
    assert!(admin::route_approval(&h.pool, stale, h.now()).await.is_err());
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM route_approval_receipts").fetch_one(&h.pool).await.expect("receipt count");
    assert_eq!(count, 1);
    let current: sqlx::types::Json<OrganizationRouteApproval> = sqlx::query_scalar("SELECT approval FROM route_approvals WHERE workspace_id=$1")
        .bind(created.workspace_id).fetch_one(&h.pool).await.expect("approval");
    assert!(current.0.revoked);
    h.finish().await;
}

#[tokio::test]
async fn export_receipt_survives_local_journal_loss_but_never_owner_change_or_revocation() {
    use inquello_protocol::workspace::ExportReceiptView;
    let h=Harness::start().await;
    let created=admin::create_workspace(&h.pool,CreateWorkspace {
        name:"Fictional receipt company".into(),kind:"internal_company".into(),
        policy:include_str!("../../inquello-protocol/fixtures/workspace/policy.json").into(),
        first_admin_issuer:h.issuer.issuer().to_string(),first_admin_subject:"receipt-owner".into(),
        invite_lifetime:Duration::from_secs(3600),operator:"fixture-operator".into(),
    },h.now()).await.expect("Workspace");
    let owner=h.sign_in("receipt-owner").await;
    h.post(&format!("/v1/invites/{}/accept",created.first_admin_invite_id),&json!({}),Some(owner.access_credential.expose())).await.ok::<AcceptInviteResponse>();
    let peer=h.sign_in("receipt-peer").await;
    let request=json!({"command_epoch":h.command_epoch().await,"operation_id":Uuid::new_v4(),
        "manifest_digest":"a".repeat(64),"workspace_ids":[created.workspace_id]});
    let receipt=h.post("/v1/local-data/export-receipts",&request,Some(owner.access_credential.expose())).await.ok::<ExportReceiptView>();
    let replay=h.post("/v1/local-data/export-receipts",&request,Some(owner.access_credential.expose())).await.ok::<ExportReceiptView>();
    assert_eq!(receipt,replay);
    let mut changed=request.clone();changed["manifest_digest"]=json!("b".repeat(64));
    assert!(!h.post("/v1/local-data/export-receipts",&changed,Some(owner.access_credential.expose())).await.status.is_success());
    let path=format!("/v1/local-data/export-receipts/{}/validate",receipt.receipt_id);
    let validate=json!({"manifest_digest":receipt.manifest_digest});
    // No desktop journal is consulted: the immutable service record is sufficient
    // corroboration, but native bytes/ownership + current route checks are additional.
    assert_eq!(h.post(&path,&validate,Some(owner.access_credential.expose())).await.ok::<ExportReceiptView>(),receipt);
    let foreign=h.post(&path,&validate,Some(peer.access_credential.expose())).await;
    let absent=h.post(&format!("/v1/local-data/export-receipts/{}/validate",Uuid::new_v4()),&validate,Some(peer.access_credential.expose())).await;
    assert_eq!(foreign.body,absent.body);assert_eq!(foreign.status,absent.status);
    assert!(!h.post(&path,&json!({"manifest_digest":"c".repeat(64)}),Some(owner.access_credential.expose())).await.status.is_success());
    // Fixture withdrawal follows the same Workspace lock/epoch ordering; no
    // service receipt can recreate the removed membership.
    let mut tx=h.pool.begin().await.expect("revocation transaction");
    sqlx::query("UPDATE workspaces SET authorization_epoch=authorization_epoch+1 WHERE workspace_id=$1")
        .bind(created.workspace_id).execute(&mut *tx).await.expect("lock epoch");
    sqlx::query("UPDATE memberships SET status='removed',roles=ARRAY[]::TEXT[],revision=revision+1 WHERE workspace_id=$1")
        .bind(created.workspace_id).execute(&mut *tx).await.expect("revoke member");
    tx.commit().await.expect("commit revocation");
    assert!(!h.post(&path,&validate,Some(owner.access_credential.expose())).await.status.is_success());
    assert!(!h.post("/v1/local-data/export-receipts",&request,Some(owner.access_credential.expose())).await.status.is_success());
    h.finish().await;
}
