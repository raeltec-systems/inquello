//! Actual owned PostgreSQL/HTTP authority tests; no live organization or model use.
#![cfg(feature = "test-issuer")]
#![allow(clippy::expect_used, reason = "isolated test assertions")]
mod support;
use inquello_protocol::workspace::DenyReason;
use inquello_protocol::{
    command::CommandResponse,
    error::ErrorKind,
    login::SessionCredentials,
    provider_consent::{ProviderConsentState, ProviderConsentView},
    workspace::RouteApprovalView,
};
use serde_json::{Value, json};
use support::Harness;
use uuid::Uuid;

async fn owner_workspace(h: &Harness) -> (SessionCredentials, Uuid) {
    let owner = h
        .sign_in_with("Maya", |mut f| {
            f.email_verified = true;
            f
        })
        .await;
    let body = json!({"schema_version":1,"command_epoch":h.command_epoch().await,
        "operation_id":"consent-create","expected_revision":"0",
        "payload":{"command":"create_workspace","name":"Fictional consent workspace"}});
    let response: CommandResponse = h
        .post(
            "/v1/onboarding/commands",
            &body,
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    (owner, response.resource_id)
}
fn path(workspace: Uuid) -> String {
    format!("/v1/workspaces/{workspace}/provider-consents/openai-api")
}
async fn view(h: &Harness, owner: &SessionCredentials, workspace: Uuid) -> ProviderConsentView {
    h.get(&path(workspace), Some(owner.access_credential.expose()))
        .await
        .ok()
}
async fn command(h: &Harness, view: &ProviderConsentView, action: &str) -> Value {
    json!({"schema_version":1,"command_epoch":h.command_epoch().await,
        "workspace_id":view.workspace_id,"operation_id":Uuid::new_v4(),
        "expected_revision":view.revision,"expected_contract_version":view.contract_version,
        "expected_contract_digest":view.contract_digest,"action":action})
}

#[tokio::test]
async fn durable_consent_is_explicit_owner_cas_and_replay_not_credential_or_model_dispatch() {
    let h = Harness::start().await;
    let (owner, workspace) = owner_workspace(&h).await;
    let initial = view(&h, &owner, workspace).await;
    assert!(initial.can_manage);
    assert_eq!(initial.state, ProviderConsentState::NotAllowed);
    assert_eq!(initial.revision.get(), 0);
    assert!(initial.consent_text.contains("30 days"));
    assert_eq!(h.count("SELECT count(*) FROM provider_consents").await, 0);
    let stranger = h.sign_in("Other").await;
    let allow = command(&h, &initial, "allow").await;
    h.post(
        &path(workspace),
        &allow,
        Some(stranger.access_credential.expose()),
    )
    .await
    .assert_refused(DenyReason::NotAMember);
    let mut stale_contract = allow.clone();
    stale_contract["expected_contract_digest"] = json!("0".repeat(64));
    h.post(
        &path(workspace),
        &stale_contract,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_receipts")
            .await,
        0
    );
    assert_eq!(h.count("SELECT count(*) FROM provider_consents").await, 0);
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_history")
            .await,
        0
    );
    assert_eq!(
        view(&h, &owner, workspace).await,
        initial,
        "denials preserve revision, epoch, and decision"
    );
    let applied: CommandResponse = h
        .post(
            &path(workspace),
            &allow,
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    let replay: CommandResponse = h
        .post(
            &path(workspace),
            &allow,
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(applied, replay);
    let allowed = view(&h, &owner, workspace).await;
    assert_eq!(allowed.state, ProviderConsentState::Allowed);
    assert!(allowed.authorization_epoch.get() > initial.authorization_epoch.get());
    let mut collision = allow.clone();
    collision["action"] = json!("revoke");
    h.post(
        &path(workspace),
        &collision,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    let stale = command(&h, &initial, "revoke").await;
    h.post(
        &path(workspace),
        &stale,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_history")
            .await,
        1
    );
    let revoke = command(&h, &allowed, "revoke").await;
    h.post(
        &path(workspace),
        &revoke,
        Some(owner.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    h.post(
        &path(workspace),
        &allow,
        Some(owner.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    assert_eq!(
        view(&h, &owner, workspace).await.state,
        ProviderConsentState::Revoked,
        "replaying a receipt never re-applies an old grant"
    );
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_history")
            .await,
        2
    );
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_receipts")
            .await,
        2
    );
    h.finish().await;
}

#[tokio::test]
async fn projection_is_session_stable_and_revoked_or_changed_consent_suppresses_legacy() {
    let h = Harness::start().await;
    let (owner, workspace) = owner_workspace(&h).await;
    let initial = view(&h, &owner, workspace).await;
    // Historical operator metadata is visible before any durable decision, but
    // is never a substitute for independently compiled software qualification.
    let legacy_identity = json!({"route_id":"codex-responses","deployment":"openai-api",
        "endpoint":"https://api.openai.com/v1/responses","model":"historical-fixture",
        "schema_version":2,"api_version":"fixture","adapter_configuration_digest":"a".repeat(64),
        "implementation_digest":"b".repeat(64),"runtime_version":"fixture",
        "contract_version":"1","platform":"fixture"});
    let legacy = inquello_domain::routes::OrganizationRouteApproval {
        workspace_id: workspace.to_string(),
        route_id: "codex-responses".into(),
        evidence_digest: "d".repeat(64),
        processing_scope: "historical-fixture-only".into(),
        data_policy_digest: "e".repeat(64),
        issuer: "fixture-operator".into(),
        operator_reference: "historical-fixture".into(),
        valid_from: h.now().timestamp() - 1,
        expires_at: h.now().timestamp() + 3600,
        review_at: h.now().timestamp() + 1800,
        revision: 1,
        policy_revision: 1,
        revoked: false,
    };
    sqlx::query("INSERT INTO route_approvals(workspace_id,route_id,revision,identity,approval,updated_at) VALUES($1,'codex-responses',1,$2,$3,$4)")
        .bind(workspace).bind(&legacy_identity).bind(sqlx::types::Json(&legacy)).bind(h.now())
        .execute(&h.pool).await.expect("historical metadata fixture, not qualification");
    let before: RouteApprovalView = h
        .get(
            &format!("/v1/workspaces/{workspace}/route-approvals/codex-responses"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(before.approval, Some(legacy.clone()));
    let allow = command(&h, &initial, "allow").await;
    h.post(
        &path(workspace),
        &allow,
        Some(owner.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    let approval_path = format!("/v1/workspaces/{workspace}/route-approvals/codex-responses");
    let first: RouteApprovalView = h
        .get(&approval_path, Some(owner.access_credential.expose()))
        .await
        .ok();
    h.clock.advance(chrono::TimeDelta::seconds(1));
    let second: RouteApprovalView = h
        .get(&approval_path, Some(owner.access_credential.expose()))
        .await
        .ok();
    assert_eq!(first, second, "discovery projection is not now-relative");
    // Test the actual compiled proof state, without substituting eligibility.
    let register =
        inquello_domain::capability::CapabilityRegister::load_embedded().expect("register");
    let entry = register
        .entry(inquello_domain::routes::RouteId::CodexResponses.capability_id())
        .expect("Terra");
    if entry.enablement().allows_real_data() {
        let proof = entry
            .negative_authorization
            .as_ref()
            .expect("complete proof");
        let approval = first
            .approval
            .as_ref()
            .expect("compiled qualification projection");
        assert_eq!(approval.evidence_digest, proof.report_digest);
        assert_eq!(approval.processing_scope, proof.processing_scope);
        assert_eq!(approval.data_policy_digest, proof.data_policy_digest);
        assert_eq!(
            approval.revision.to_string(),
            first.authorization_epoch.to_string()
        );
    } else {
        assert!(
            first.approval.is_none(),
            "consent cannot invent qualification"
        );
    }
    let principal_revision: i64 =
        sqlx::query_scalar("SELECT revision FROM principals WHERE principal_id=$1")
            .bind(owner.principal_id)
            .fetch_one(&h.pool)
            .await
            .expect("principal revision");
    let session_revision: i64 =
        sqlx::query_scalar("SELECT revision FROM sessions WHERE session_id=$1")
            .bind(owner.session_id)
            .fetch_one(&h.pool)
            .await
            .expect("session revision");
    let proof = entry.negative_authorization.as_ref();
    let approval = first.approval.as_ref().unwrap_or(&legacy);
    let mut operation = json!({"identity":proof.map(|p|serde_json::to_value(&p.identity).expect("identity")).unwrap_or(legacy_identity),
        "report_digest":proof.map(|p|p.report_digest.as_str()).unwrap_or(&legacy.evidence_digest),
        "binding":{"action":"read","principal_id":owner.principal_id,"session_id":owner.session_id,
        "task_id":Uuid::new_v4(),"workspace_id":workspace,"operation_id":Uuid::new_v4(),"generation":1,
        "principal_revision":principal_revision.to_string(),"session_revision":session_revision.to_string(),
        "authorization_epoch":first.authorization_epoch,"policy_revision":first.policy_revision,
        "approval_revision":approval.revision.to_string(),"processing_scope":approval.processing_scope,
        "data_policy_digest":approval.data_policy_digest}});
    let check_path = format!("/v1/workspaces/{workspace}/route-eligibility-checks");
    let checked = h
        .post(
            &check_path,
            &operation,
            Some(owner.access_credential.expose()),
        )
        .await;
    if entry.enablement().allows_real_data() {
        let exact: inquello_protocol::workspace::RouteEligibilityCheckResponse = checked.ok();
        assert_eq!(
            serde_json::to_value(exact.authority.binding).expect("binding"),
            operation["binding"]
        );
        assert_eq!(exact.authority.approval, *approval);
        eprintln!("COMPILED_CONSENT_HTTP_POSITIVE_EXECUTED");
    } else {
        checked.assert_refused(DenyReason::RouteNotAvailable);
        eprintln!(
            "COMPILED_CONSENT_HTTP_POSITIVE_PENDING_REVIEWED_PROOF; missing-proof refusal executed"
        );
    }
    let mut wrong = operation.clone();
    wrong["identity"]["implementation_digest"] = json!("0".repeat(64));
    h.post(&check_path, &wrong, Some(owner.access_credential.expose()))
        .await
        .assert_refused(DenyReason::RouteNotAvailable);
    let mut stale = operation.clone();
    stale["binding"]["authorization_epoch"] = json!(initial.authorization_epoch);
    h.post(&check_path, &stale, Some(owner.access_credential.expose()))
        .await
        .assert_refused(DenyReason::RouteNotAvailable);
    sqlx::query("UPDATE provider_consents SET contract_digest=$2 WHERE workspace_id=$1")
        .bind(workspace)
        .bind("0".repeat(64))
        .execute(&h.pool)
        .await
        .expect("material old-contract fixture");
    assert_eq!(
        view(&h, &owner, workspace).await.state,
        ProviderConsentState::Changed
    );
    let changed: RouteApprovalView = h
        .get(&approval_path, Some(owner.access_credential.expose()))
        .await
        .ok();
    assert!(
        changed.approval.is_none(),
        "material mismatch suppresses old operator approval"
    );
    h.post(
        &check_path,
        &operation,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_refused(DenyReason::RouteNotAvailable);
    let current = view(&h, &owner, workspace).await;
    let revoke = command(&h, &current, "revoke").await;
    h.post(
        &path(workspace),
        &revoke,
        Some(owner.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    let revoked: RouteApprovalView = h
        .get(&approval_path, Some(owner.access_credential.expose()))
        .await
        .ok();
    assert!(
        revoked.approval.is_none(),
        "tombstone suppresses old operator approval"
    );
    operation["binding"]["authorization_epoch"] = json!(revoked.authorization_epoch);
    operation["binding"]["approval_revision"] = json!(revoked.authorization_epoch);
    h.post(
        &check_path,
        &operation,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_refused(DenyReason::RouteNotAvailable);
    h.finish().await;
}

#[tokio::test]
async fn concurrent_consent_cas_has_one_winner_and_current_owner_required_for_replay() {
    let h = Harness::start().await;
    let (owner, workspace) = owner_workspace(&h).await;
    let initial = view(&h, &owner, workspace).await;
    let allow = command(&h, &initial, "allow").await;
    let revoke = command(&h, &initial, "revoke").await;
    let url = path(workspace);
    let (a, b) = tokio::join!(
        h.post(&url, &allow, Some(owner.access_credential.expose())),
        h.post(&url, &revoke, Some(owner.access_credential.expose())),
    );
    assert_ne!(a.status.is_success(), b.status.is_success());
    let winning = if a.status.is_success() {
        a.ok::<CommandResponse>();
        b.assert_error(ErrorKind::VersionConflict);
        &allow
    } else {
        b.ok::<CommandResponse>();
        a.assert_error(ErrorKind::VersionConflict);
        &revoke
    };
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_history")
            .await,
        1
    );
    // Fixture-only authority loss: this is not a valid ownership transfer.
    // Current role loss prevents mutation/replay without erasing the decision.
    sqlx::query("UPDATE memberships SET roles=ARRAY['member'] WHERE workspace_id=$1")
        .bind(workspace)
        .execute(&h.pool)
        .await
        .expect("fixture authority loss");
    let current = view(&h, &owner, workspace).await;
    assert!(!current.can_manage);
    h.post(&url, winning, Some(owner.access_credential.expose()))
        .await
        .assert_refused(DenyReason::RoleLacksAction);
    let attempted = command(&h, &current, "allow").await;
    h.post(&url, &attempted, Some(owner.access_credential.expose()))
        .await
        .assert_refused(DenyReason::RoleLacksAction);
    assert_eq!(
        view(&h, &owner, workspace).await,
        current,
        "role-loss refusals cannot mutate epoch or consent"
    );
    assert_eq!(h.count("SELECT count(*) FROM provider_consents").await, 1);
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_receipts")
            .await,
        1
    );
    assert_eq!(
        h.count("SELECT count(*) FROM provider_consent_history")
            .await,
        1
    );
    h.finish().await;
}
