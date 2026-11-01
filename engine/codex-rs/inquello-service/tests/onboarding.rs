//! Deterministic Story 1.31 contracts; fictional identities, disposable databases.
#![cfg(feature = "test-issuer")]
#![allow(clippy::expect_used, reason = "test assertions")]
mod support;
use chrono::TimeDelta;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::{
    command::CommandResponse, login::SessionCredentials, onboarding::InvitationsView,
};
use serde_json::{Value, json};
use support::Harness;
use uuid::Uuid;

async fn verified(h: &Harness, subject: &str) -> SessionCredentials {
    h.sign_in_with(subject, |mut f| {
        f.email_verified = true;
        f
    })
    .await
}
async fn envelope(h: &Harness, operation: &str, expected: &str, payload: Value) -> Value {
    json!({"command_epoch":h.command_epoch().await,"operation_id":operation,
        "expected_revision":expected,"schema_version":1,"payload":payload})
}
async fn create(h: &Harness, who: &SessionCredentials, op: &str) -> CommandResponse {
    let body = envelope(
        h,
        op,
        "0",
        json!({"command":"create_workspace","name":"Alder & Finch"}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(who.access_credential.expose()),
    )
    .await
    .ok()
}
async fn workspace_command(
    h: &Harness,
    who: &SessionCredentials,
    workspace: Uuid,
    expected: &str,
    payload: Value,
) -> support::Response {
    let body = json!({"command_epoch":h.command_epoch().await,"operation_id":Uuid::new_v4().to_string(),
        "workspace_id":workspace,"expected_revision":expected,"schema_version":1,"payload":payload});
    h.post(
        &format!("/v1/workspaces/{workspace}/commands"),
        &body,
        Some(who.access_credential.expose()),
    )
    .await
}

#[tokio::test]
async fn creation_requires_signed_fresh_proof_and_atomic_receipt() {
    let h = Harness::start().await;
    let unverified = h.sign_in("Maya").await;
    let body = envelope(
        &h,
        "unverified",
        "0",
        json!({"command":"create_workspace","name":"Alder"}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(unverified.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    assert_eq!(h.count("SELECT count(*) FROM workspaces").await, 0);
    let owner = verified(&h, "Maya").await;
    let body = envelope(
        &h,
        "create-once",
        "0",
        json!({"command":"create_workspace","name":"Alder & Finch"}),
    )
    .await;
    let (a, b) = tokio::join!(
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(owner.access_credential.expose())
        ),
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(owner.access_credential.expose())
        )
    );
    let a: CommandResponse = a.ok();
    let b: CommandResponse = b.ok();
    assert_eq!(a.receipt_id, b.receipt_id);
    assert_eq!(h.count("SELECT count(*) FROM workspaces").await, 1);
    assert_eq!(h.count("SELECT count(*) FROM memberships").await, 1);
    let mut changed = body.clone();
    changed["payload"]["name"] = json!("Other");
    h.post(
        "/v1/onboarding/commands",
        &changed,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    h.clock.advance(TimeDelta::minutes(6));
    let fresh_operation = envelope(
        &h,
        "expired-proof",
        "0",
        json!({"command":"create_workspace","name":"Other"}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &fresh_operation,
        Some(owner.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    let refreshed: SessionCredentials = h.refresh(owner.refresh_credential.expose()).await.ok();
    h.post(
        "/v1/onboarding/commands",
        &fresh_operation,
        Some(refreshed.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    // Reconciliation remains readable after issuer proof expiry, with current membership.
    let receipt: Option<CommandResponse> = h
        .get(
            "/v1/onboarding/receipts/create-once",
            Some(refreshed.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(receipt.expect("receipt").receipt_id, a.receipt_id);
    h.finish().await;
}

#[tokio::test]
async fn verified_recipient_accepts_exact_roles_and_other_identity_is_unavailable() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let recipient = verified(&h, "Theo").await;
    let wrong = verified(&h, "Nora").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let issued: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@SYNTHETIC.INVALID","roles":["member"]}),
    )
    .await
    .ok();
    let saved: Option<CommandResponse> = h
        .get(
            &format!(
                "/v1/workspaces/{workspace}/receipts/{}",
                issued.operation_id
            ),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(
        saved.expect("workspace receipt").receipt_id,
        issued.receipt_id
    );
    let absent: Option<CommandResponse> = h
        .get(
            &format!("/v1/workspaces/{workspace}/receipts/not-issued"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert!(absent.is_none());
    let listed: InvitationsView = h
        .get(
            "/v1/invitations",
            Some(recipient.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(listed.invitations.len(), 1);
    assert_eq!(listed.invitations[0].roles, vec!["member"]);
    let hidden: InvitationsView = h
        .get("/v1/invitations", Some(wrong.access_credential.expose()))
        .await
        .ok();
    assert!(hidden.invitations.is_empty());
    let body = envelope(
        &h,
        "accept",
        "1",
        json!({"command":"accept_invitation","invite_id":issued.resource_id}),
    )
    .await;
    let denied = h
        .post(
            "/v1/onboarding/commands",
            &body,
            Some(wrong.access_credential.expose()),
        )
        .await;
    denied.assert_error(ErrorKind::Denied);
    let missing = envelope(
        &h,
        "missing",
        "1",
        json!({"command":"accept_invitation","invite_id":Uuid::new_v4()}),
    )
    .await;
    let absent = h
        .post(
            "/v1/onboarding/commands",
            &missing,
            Some(wrong.access_credential.expose()),
        )
        .await;
    assert_eq!(denied.body, absent.body);
    let accepted: CommandResponse = h
        .post(
            "/v1/onboarding/commands",
            &body,
            Some(recipient.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(accepted.resource_id, workspace);
    let replay: CommandResponse = h
        .post(
            "/v1/onboarding/commands",
            &body,
            Some(recipient.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(accepted.receipt_id, replay.receipt_id);
    // Last owner and escalation refused without changing original authority.
    let members: inquello_protocol::onboarding::MembersView = h
        .get(
            &format!("/v1/workspaces/{workspace}/members"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    let owner_id = members
        .members
        .iter()
        .find(|m| m.roles == vec!["owner"])
        .expect("owner")
        .principal_id;
    workspace_command(
        &h,
        &owner,
        workspace,
        "1",
        json!({"command":"remove_member","principal_id":owner_id}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    assert_eq!(
        workspace_command(
            &h,
            &recipient,
            workspace,
            "1",
            json!({"command":"change_roles","principal_id":owner_id,"roles":["owner"]})
        )
        .await
        .body["error"]["kind"],
        json!("denied")
    );
    let recipient_id = members
        .members
        .iter()
        .find(|m| m.roles == vec!["member"])
        .expect("member")
        .principal_id;
    workspace_command(
        &h,
        &owner,
        workspace,
        "1",
        json!({"command":"remove_member","principal_id":recipient_id}),
    )
    .await
    .ok::<CommandResponse>();
    assert_eq!(
        h.get(
            "/v1/onboarding/receipts/accept",
            Some(recipient.access_credential.expose())
        )
        .await
        .body["error"]["kind"],
        json!("denied")
    );
    h.finish().await;
}

#[tokio::test]
async fn expired_revoked_and_stale_invites_never_grant_membership() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let recipient = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let issued: CommandResponse = workspace_command(&h,&owner,workspace,"0",json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["reviewer"]})).await.ok();
    let stale = envelope(
        &h,
        "stale",
        "2",
        json!({"command":"accept_invitation","invite_id":issued.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &stale,
        Some(recipient.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    workspace_command(
        &h,
        &owner,
        workspace,
        "1",
        json!({"command":"revoke_invite","invite_id":issued.resource_id}),
    )
    .await
    .ok::<CommandResponse>();
    let body = envelope(
        &h,
        "revoked",
        "1",
        json!({"command":"accept_invitation","invite_id":issued.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(recipient.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    assert_eq!(h.count("SELECT count(*) FROM memberships").await, 1);
    h.finish().await;
}

#[tokio::test]
async fn default_private_derive_is_not_peer_task_share_export_or_tool_authority() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let member = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    let accept = envelope(
        &h,
        "accept",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    let joined: CommandResponse = h
        .post(
            "/v1/onboarding/commands",
            &accept,
            Some(member.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(joined.authorization_epoch.expect("epoch").get(), 2);
    let members: inquello_protocol::onboarding::MembersView = h
        .get(
            &format!("/v1/workspaces/{workspace}/members"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    let owner_id = members
        .members
        .iter()
        .find(|m| m.roles == vec!["owner"])
        .expect("owner")
        .principal_id;
    let member_id = members
        .members
        .iter()
        .find(|m| m.roles == vec!["member"])
        .expect("member")
        .principal_id;
    let task = Uuid::new_v4();
    // Only content-registration test metadata; neither membership nor authorization is injected.
    sqlx::query("INSERT INTO resource_registrations (workspace_id,resource_id,kind,creator_principal_id) VALUES ($1,$2,'private_task',$3)")
        .bind(workspace).bind(task).bind(member_id).execute(&h.pool).await.expect("private fixture");
    let path = format!("/v1/workspaces/{workspace}/access-checks");
    h.post(
        &path,
        &json!({"action":"derive","resource":{"kind":"private_task","resource_id":task}}),
        Some(member.access_credential.expose()),
    )
    .await
    .ok::<inquello_protocol::workspace::AccessCheckResponse>();
    let denied = h
        .post(
            &path,
            &json!({"action":"read","resource":{"kind":"private_task","resource_id":task}}),
            Some(owner.access_credential.expose()),
        )
        .await;
    let absent = h.post(&path,&json!({"action":"read","resource":{"kind":"private_task","resource_id":Uuid::new_v4()}}),Some(owner.access_credential.expose())).await;
    assert_eq!(denied.body, absent.body);
    for action in ["share", "export"] {
        assert_eq!(
            h.post(
                &path,
                &json!({"action":action,"resource":{"kind":"private_task","resource_id":task}}),
                Some(member.access_credential.expose())
            )
            .await
            .body["error"]["kind"],
            "denied"
        );
    }
    let policy: inquello_protocol::workspace::ExecutionPolicyView = h
        .get(
            &format!("/v1/workspaces/{workspace}/execution-policy"),
            Some(member.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(
        policy.execution.expect("execution").mcp_tools,
        Some(inquello_protocol::workspace::Access::Denied)
    );
    // Fresh proof required for customer-workspace role grants; refresh cannot extend it.
    h.clock.advance(TimeDelta::minutes(6));
    workspace_command(
        &h,
        &owner,
        workspace,
        "1",
        json!({"command":"change_roles","principal_id":member_id,"roles":["owner"]}),
    )
    .await
    .assert_error(ErrorKind::Denied);
    let _ = owner_id;
    h.finish().await;
}

#[tokio::test]
async fn recipient_discovery_hides_withdrawn_grantor_and_expired_invites() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let member = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    // Force expiry in disposable DB to test invite expiry independently of proof expiry.
    sqlx::query("UPDATE invites SET expires_at=$2 WHERE invite_id=$1")
        .bind(invite.resource_id)
        .bind(h.now())
        .execute(&h.pool)
        .await
        .expect("expire fixture");
    let empty: InvitationsView = h
        .get("/v1/invitations", Some(member.access_credential.expose()))
        .await
        .ok();
    assert!(empty.invitations.is_empty());
    let body = envelope(
        &h,
        "expired",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(member.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    let current: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    // Principal disablement has no public fixture API; isolate this authorization fact.
    sqlx::query("UPDATE principals SET status='disabled' WHERE principal_id=(SELECT issued_by FROM invites WHERE invite_id=$1)")
        .bind(current.resource_id).execute(&h.pool).await.expect("disable grantor fixture");
    let empty: InvitationsView = h
        .get("/v1/invitations", Some(member.access_credential.expose()))
        .await
        .ok();
    assert!(empty.invitations.is_empty());
    let body = envelope(
        &h,
        "withdrawn",
        "1",
        json!({"command":"accept_invitation","invite_id":current.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(member.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    h.finish().await;
}

#[tokio::test]
async fn same_verified_email_from_another_issuer_never_matches_or_links() {
    use inquello_protocol::login::LoginTransaction;
    use inquello_service::test_issuer::{TestIssuer, TokenFixture};
    let foreign = TestIssuer::with_issuer("https://other-issuer.invalid/");
    let h = Harness::start_with(
        |config| {
            config
                .issuers
                .push(foreign.issuer_config(support::CLIENT_ID, &[support::REDIRECT_URI]))
        },
        reqwest::Client::new(),
    )
    .await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    let transaction: LoginTransaction = h.post("/v1/login/transactions",&json!({
        "issuer":foreign.issuer(),"client_id":support::CLIENT_ID,"redirect_uri":support::REDIRECT_URI,"device_id":Uuid::new_v4()
    }),None).await.ok();
    let mut claims = TokenFixture::valid(
        &foreign,
        support::CLIENT_ID,
        "Theo",
        &transaction.nonce,
        h.now(),
    );
    claims.email_verified = true;
    let token = foreign.sign(&claims);
    h.remember(&token);
    let foreign_session: SessionCredentials = h.bootstrap(&transaction, &token).await.ok();
    let empty: InvitationsView = h
        .get(
            "/v1/invitations",
            Some(foreign_session.access_credential.expose()),
        )
        .await
        .ok();
    assert!(empty.invitations.is_empty());
    let body = envelope(
        &h,
        "foreign",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(foreign_session.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    let local = verified(&h, "Theo").await;
    let local_view: inquello_protocol::session::SessionView = h
        .get("/v1/session", Some(local.access_credential.expose()))
        .await
        .ok();
    let foreign_view: inquello_protocol::session::SessionView = h
        .get(
            "/v1/session",
            Some(foreign_session.access_credential.expose()),
        )
        .await
        .ok();
    assert_ne!(
        local_view.principal.principal_id,
        foreign_view.principal.principal_id
    );
    h.finish().await;
}

#[tokio::test]
async fn missing_false_and_stale_verified_email_cannot_create_or_accept() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    for missing in [true, false] {
        let transaction = h.create_transaction(Uuid::new_v4()).await;
        let mut claims = h.valid_fixture("Theo", &transaction).claims();
        if missing {
            claims
                .as_object_mut()
                .expect("claims")
                .remove("email_verified");
        }
        let token = h.issuer.sign_claims(&claims);
        h.remember(&token);
        let session: SessionCredentials = h.bootstrap(&transaction, &token).await.ok();
        let body = envelope(
            &h,
            &Uuid::new_v4().to_string(),
            "0",
            json!({"command":"create_workspace","name":"No grant"}),
        )
        .await;
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(session.access_credential.expose()),
        )
        .await
        .assert_error(ErrorKind::Denied);
        let body = envelope(
            &h,
            &Uuid::new_v4().to_string(),
            "1",
            json!({"command":"accept_invitation","invite_id":invite.resource_id}),
        )
        .await;
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(session.access_credential.expose()),
        )
        .await
        .assert_error(ErrorKind::Denied);
    }
    let stale = verified(&h, "Theo").await;
    h.clock.advance(TimeDelta::minutes(6));
    let refreshed: SessionCredentials = h.refresh(stale.refresh_credential.expose()).await.ok();
    let body = envelope(
        &h,
        "stale-proof",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &body,
        Some(refreshed.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::Denied);
    assert_eq!(h.count("SELECT count(*) FROM workspaces").await, 1);
    assert_eq!(h.count("SELECT count(*) FROM memberships").await, 1);
    h.finish().await;
}

#[tokio::test]
async fn proof_expiring_while_waiting_for_grantor_lock_rolls_back_grant_and_receipt() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let member = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok();
    let body = envelope(
        &h,
        "wait-expiry",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    let mut blocker = h.pool.begin().await.expect("blocker");
    sqlx::query("SELECT 1 FROM memberships WHERE workspace_id=$1 FOR UPDATE")
        .bind(workspace)
        .execute(&mut *blocker)
        .await
        .expect("hold grantor membership");
    let (response, ()) = tokio::join!(
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(member.access_credential.expose())
        ),
        async {
            tokio::time::timeout(std::time::Duration::from_secs(5),async {
                loop {
                    let waiting: bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%memberships%')")
                        .fetch_one(&h.pool).await.expect("observe lock wait");
                    if waiting { break; }
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                }
            }).await.expect("accept waits on grantor row");
            h.clock.advance(TimeDelta::minutes(6));
            blocker.rollback().await.expect("release blocker");
        }
    );
    response.assert_error(ErrorKind::Denied);
    assert_eq!(h.count("SELECT count(*) FROM memberships").await, 1);
    assert_eq!(
        h.count("SELECT count(*) FROM operation_receipts WHERE command='accept_invitation'")
            .await,
        0
    );
    h.finish().await;
}

#[tokio::test]
async fn disabled_principal_cannot_be_the_remaining_administrator() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let other = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invite: CommandResponse = workspace_command(
        &h,
        &owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["owner"]}),
    )
    .await
    .ok();
    let accept = envelope(
        &h,
        "accept",
        "1",
        json!({"command":"accept_invitation","invite_id":invite.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &accept,
        Some(other.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    let members: inquello_protocol::onboarding::MembersView = h
        .get(
            &format!("/v1/workspaces/{workspace}/members"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    let owner_id: Uuid =
        sqlx::query_scalar("SELECT principal_id FROM principals WHERE subject='Maya'")
            .fetch_one(&h.pool)
            .await
            .expect("owner");
    let other_id = members
        .members
        .iter()
        .find(|m| m.principal_id != owner_id)
        .expect("second owner")
        .principal_id;
    sqlx::query("UPDATE principals SET status='disabled' WHERE principal_id=$1")
        .bind(other_id)
        .execute(&h.pool)
        .await
        .expect("disable fixture");
    for payload in [
        json!({"command":"remove_member","principal_id":owner_id}),
        json!({"command":"change_roles","principal_id":owner_id,"roles":["member"]}),
    ] {
        workspace_command(&h, &owner, workspace, "1", payload)
            .await
            .assert_error(ErrorKind::VersionConflict);
    }
    assert_eq!(
        h.count("SELECT count(*) FROM memberships WHERE status='active'")
            .await,
        2
    );
    h.finish().await;
}

#[derive(Default)]
struct FakeDelivery {
    account: String,
    calls: std::sync::Mutex<Vec<(String, inquello_service::delivery::EmailPayload)>>,
    outcomes:
        std::sync::Mutex<std::collections::VecDeque<inquello_service::delivery::DeliveryOutcome>>,
}
impl inquello_service::delivery::DeliveryTransport for FakeDelivery {
    fn configuration_id(&self) -> String {
        format!("fictional-local-fake-account:{}", self.account)
    }
    fn send<'a>(
        &'a self,
        key: &'a str,
        payload: &'a inquello_service::delivery::EmailPayload,
    ) -> inquello_service::delivery::DeliveryFuture<'a> {
        Box::pin(async move {
            self.calls
                .lock()
                .expect("calls")
                .push((key.into(), payload.clone()));
            self.outcomes
                .lock()
                .expect("outcomes")
                .pop_front()
                .unwrap_or(inquello_service::delivery::DeliveryOutcome::Uncertain)
        })
    }
}
async fn invite_for_delivery(
    h: &Harness,
    owner: &SessionCredentials,
    workspace: Uuid,
) -> CommandResponse {
    workspace_command(
        h,
        owner,
        workspace,
        "0",
        json!({"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}),
    )
    .await
    .ok()
}
async fn delivery_state(h: &Harness, id: Uuid) -> String {
    sqlx::query_scalar("SELECT state FROM invitation_deliveries WHERE invite_id=$1")
        .bind(id)
        .fetch_one(&h.pool)
        .await
        .expect("state")
}
#[tokio::test]
async fn outbox_is_atomic_private_and_retries_identical_payload_after_uncertainty() {
    use inquello_service::delivery::{DeliveryConfig, DeliveryOutcome, dispatch_one};
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let stranger = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let body = json!({"command_epoch":h.command_epoch().await,"operation_id":"invite-once","workspace_id":workspace,"expected_revision":"0","schema_version":1,
        "payload":{"command":"issue_email_invite","email":"Theo@synthetic.invalid","roles":["member"]}});
    let path = format!("/v1/workspaces/{workspace}/commands");
    let first: CommandResponse = h
        .post(&path, &body, Some(owner.access_credential.expose()))
        .await
        .ok();
    let retry: CommandResponse = h
        .post(&path, &body, Some(owner.access_credential.expose()))
        .await
        .ok();
    assert_eq!(first.receipt_id, retry.receipt_id);
    assert_eq!(
        h.count("SELECT count(*) FROM invitation_deliveries").await,
        1
    );
    assert_eq!(
        delivery_state(&h, first.resource_id).await,
        "not_configured"
    );
    let path = format!("/v1/workspaces/{workspace}/invitation-deliveries");
    let denied = h
        .get(&path, Some(stranger.access_credential.expose()))
        .await;
    let absent = h
        .get(
            &format!("/v1/workspaces/{}/invitation-deliveries", Uuid::new_v4()),
            Some(stranger.access_credential.expose()),
        )
        .await;
    assert_eq!(denied.status.as_u16(), 403);
    assert_eq!(denied.body["error"]["kind"], "denied");
    assert_eq!(denied.body, absent.body);

    let status = h
        .get(&path, Some(owner.access_credential.expose()))
        .await
        .body;
    assert!(!status.to_string().contains("Theo@"));
    assert!(!status.to_string().contains("idempotency"));
    let fake = std::sync::Arc::new(FakeDelivery::default());
    fake.outcomes.lock().expect("outcomes").extend([
        DeliveryOutcome::Uncertain,
        DeliveryOutcome::ProviderAccepted(Uuid::new_v4().to_string()),
    ]);
    let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
        .expect("config");
    assert!(
        dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("dispatch")
    );
    assert_eq!(delivery_state(&h, first.resource_id).await, "retry_pending");
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("backoff")
    );
    h.clock.advance(TimeDelta::minutes(1));
    // Renaming the workspace cannot change the persisted retry body.
    sqlx::query("UPDATE workspaces SET name='Renamed Alder' WHERE workspace_id=$1")
        .bind(workspace)
        .execute(&h.pool)
        .await
        .expect("rename fixture");
    let changed = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
        .expect("config");
    assert!(
        dispatch_one(&h.pool, h.clock.as_ref(), &changed)
            .await
            .expect("retry")
    );
    assert_eq!(
        delivery_state(&h, first.resource_id).await,
        "provider_accepted"
    );
    {
        let calls = fake.calls.lock().expect("calls");
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0].0, calls[1].0);
        assert!(calls[0].1 == calls[1].1);
        assert!(!calls[0].1.text.contains(&first.resource_id.to_string()));
    }
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &changed)
            .await
            .expect("settled")
    );
    h.finish().await;
}
#[tokio::test]
async fn outbox_reclaims_crash_lease_stops_before_dedup_expiry_and_skips_revocation() {
    use inquello_service::delivery::{DeliveryConfig, dispatch_one};
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let a = invite_for_delivery(&h, &owner, workspace).await;
    let b = invite_for_delivery(&h, &owner, workspace).await;
    workspace_command(
        &h,
        &owner,
        workspace,
        "1",
        json!({"command":"revoke_invite","invite_id":b.resource_id}),
    )
    .await
    .ok::<CommandResponse>();
    let fake = std::sync::Arc::new(FakeDelivery::default());
    let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
        .expect("config");
    dispatch_one(&h.pool, h.clock.as_ref(), &config)
        .await
        .expect("first");
    dispatch_one(&h.pool, h.clock.as_ref(), &config)
        .await
        .expect("second");
    assert_eq!(delivery_state(&h, b.resource_id).await, "cancelled");
    // Simulate process loss after pre-send commit; no send while lease is live.
    sqlx::query("UPDATE invitation_deliveries SET state='sending',lease_until=$2,next_attempt_at=NULL WHERE invite_id=$1")
        .bind(a.resource_id).bind(h.now()+TimeDelta::minutes(1)).execute(&h.pool).await.expect("crash fixture");
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("live lease")
    );
    h.clock.advance(TimeDelta::minutes(1));
    assert!(
        dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("reclaim")
    );
    h.clock.advance(TimeDelta::hours(23));
    assert!(
        dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("expired horizon")
    );
    assert_eq!(
        delivery_state(&h, a.resource_id).await,
        "manual_reconciliation_required"
    );
    assert_eq!(fake.calls.lock().expect("calls").len(), 2);
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("no automatic replay")
    );
    h.finish().await;
}

#[tokio::test]
async fn outbox_config_change_after_lost_response_requires_manual_reconciliation() {
    use inquello_service::delivery::{DeliveryConfig, dispatch_one};
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invitation = invite_for_delivery(&h, &owner, workspace).await;
    let fake = std::sync::Arc::new(FakeDelivery::default());
    let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
        .expect("config");
    dispatch_one(&h.pool, h.clock.as_ref(), &config)
        .await
        .expect("uncertain");
    h.clock.advance(TimeDelta::minutes(1));
    let changed = DeliveryConfig::new("changed@synthetic.invalid".into(), fake.clone())
        .expect("changed config");
    dispatch_one(&h.pool, h.clock.as_ref(), &changed)
        .await
        .expect("fence");
    assert_eq!(
        delivery_state(&h, invitation.resource_id).await,
        "manual_reconciliation_required"
    );
    assert_eq!(fake.calls.lock().expect("calls").len(), 1);
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("no silent reset")
    );
    h.finish().await;
}

#[tokio::test]
async fn outbox_concurrent_workers_claim_once_and_backward_clock_cannot_replay() {
    use inquello_service::delivery::{DeliveryConfig, dispatch_one};
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let invitation = invite_for_delivery(&h, &owner, workspace).await;
    let fake = std::sync::Arc::new(FakeDelivery::default());
    let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
        .expect("config");
    let (a, b) = tokio::join!(
        dispatch_one(&h.pool, h.clock.as_ref(), &config),
        dispatch_one(&h.pool, h.clock.as_ref(), &config)
    );
    assert_eq!(
        u8::from(a.expect("worker a")) + u8::from(b.expect("worker b")),
        1
    );
    assert_eq!(fake.calls.lock().expect("calls").len(), 1);
    h.clock.advance(TimeDelta::hours(-1));
    assert!(
        !dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("backward clock")
    );
    assert_eq!(fake.calls.lock().expect("calls").len(), 1);
    h.clock.advance(TimeDelta::hours(1) + TimeDelta::minutes(1));
    let changed = std::sync::Arc::new(FakeDelivery {
        account: "different-provider-account".into(),
        ..FakeDelivery::default()
    });
    let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), changed.clone())
        .expect("changed account");
    dispatch_one(&h.pool, h.clock.as_ref(), &config)
        .await
        .expect("account fence");
    assert_eq!(
        delivery_state(&h, invitation.resource_id).await,
        "manual_reconciliation_required"
    );
    assert!(changed.calls.lock().expect("calls").is_empty());
    h.finish().await;
}

#[tokio::test]
async fn queued_delivery_rechecks_current_grantor_and_policy_without_sending() {
    use inquello_service::delivery::{DeliveryConfig, dispatch_one};
    for change in ["disabled", "removed", "role_changed", "policy_changed"] {
        let h = Harness::start().await;
        let owner = verified(&h, "Maya").await;
        let workspace = create(&h, &owner, "create").await.resource_id;
        let invitation = invite_for_delivery(&h, &owner, workspace).await;
        // Deterministic authority facts in a disposable DB, not UI acceptance proof.
        match change {
            "disabled" => {
                sqlx::query("UPDATE principals SET status='disabled' WHERE principal_id=(SELECT issued_by FROM invites WHERE invite_id=$1)").bind(invitation.resource_id).execute(&h.pool).await.expect("disable");
            }
            "removed" => {
                sqlx::query("UPDATE memberships SET status='removed',roles=ARRAY[]::text[] WHERE workspace_id=$1").bind(workspace).execute(&h.pool).await.expect("remove");
            }
            "role_changed" => {
                sqlx::query("UPDATE memberships SET roles=ARRAY['member'] WHERE workspace_id=$1")
                    .bind(workspace)
                    .execute(&h.pool)
                    .await
                    .expect("role change");
            }
            _ => {
                sqlx::query("UPDATE workspace_policies SET document=jsonb_set(document,'{roles}',(SELECT jsonb_agg(CASE WHEN role->>'id'='owner' THEN jsonb_set(role,'{actions}','[\"read\"]'::jsonb) ELSE role END) FROM jsonb_array_elements(document->'roles') AS role)) WHERE workspace_id=$1").bind(workspace).execute(&h.pool).await.expect("policy change");
            }
        }
        let fake = std::sync::Arc::new(FakeDelivery::default());
        let config = DeliveryConfig::new("notifications@synthetic.invalid".into(), fake.clone())
            .expect("config");
        dispatch_one(&h.pool, h.clock.as_ref(), &config)
            .await
            .expect("eligible check");
        assert_eq!(
            delivery_state(&h, invitation.resource_id).await,
            "cancelled",
            "{change}"
        );
        assert!(fake.calls.lock().expect("calls").is_empty());
        h.finish().await;
    }
}

#[tokio::test]
async fn managed_invitation_metadata_restarts_relists_and_revokes_observed_revisions() {
    use inquello_protocol::onboarding::{ManagedInvitationState, ManagedInvitationsView};
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let recipient = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let accepted = invite_for_delivery(&h, &owner, workspace).await;
    let pending = invite_for_delivery(&h, &owner, workspace).await;
    let expired = invite_for_delivery(&h, &owner, workspace).await;
    let accept = envelope(
        &h,
        "accept",
        "1",
        json!({"command":"accept_invitation","invite_id":accepted.resource_id}),
    )
    .await;
    h.post(
        "/v1/onboarding/commands",
        &accept,
        Some(recipient.access_credential.expose()),
    )
    .await
    .ok::<CommandResponse>();
    sqlx::query("UPDATE invites SET expires_at=$2 WHERE invite_id=$1")
        .bind(expired.resource_id)
        .bind(h.now())
        .execute(&h.pool)
        .await
        .expect("expire fixture");
    // Fresh service state/connection pool reads durable metadata; no remembered
    // invitation receipt, UI state or helper membership grant is supplied.
    let fresh = inquello_service::start(
        support::synthetic_config(&h.issuer, h.db.options()),
        h.clock.clone(),
    )
    .await
    .expect("fresh service instance");
    let path = format!("/v1/workspaces/{workspace}/invitations");
    let response = h
        .client
        .get(format!("{}{path}", fresh.base_url()))
        .bearer_auth(owner.access_credential.expose())
        .send()
        .await
        .expect("metadata");
    assert_eq!(
        response.headers().get("cache-control").expect("no-store"),
        "no-store"
    );
    let page: ManagedInvitationsView = response.json().await.expect("typed metadata");
    fresh.shutdown().await;
    assert_eq!(page.invitations.len(), 3);
    assert!(page.next_cursor.is_none());
    let observed = page
        .invitations
        .iter()
        .find(|i| i.invite_id == pending.resource_id)
        .expect("observed");
    assert_eq!(observed.revision.get(), 1);
    assert_eq!(observed.state, ManagedInvitationState::Pending);
    assert_eq!(observed.recipient_email, "Theo@synthetic.invalid");
    assert_eq!(observed.roles, vec!["member"]);
    assert_eq!(
        page.invitations
            .iter()
            .find(|i| i.invite_id == accepted.resource_id)
            .expect("accepted")
            .state,
        ManagedInvitationState::Accepted
    );
    let expired_observed = page
        .invitations
        .iter()
        .find(|i| i.invite_id == expired.resource_id)
        .expect("expired");
    assert_eq!(expired_observed.state, ManagedInvitationState::Expired);
    assert_eq!(expired_observed.revision.get(), 1);
    workspace_command(
        &h,
        &owner,
        workspace,
        &observed.revision.get().to_string(),
        json!({"command":"revoke_invite","invite_id":observed.invite_id}),
    )
    .await
    .ok::<CommandResponse>();
    workspace_command(
        &h,
        &owner,
        workspace,
        &observed.revision.get().to_string(),
        json!({"command":"revoke_invite","invite_id":observed.invite_id}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    // Expired is a truthful read projection, not a hidden mutation. Explicit
    // revocation still uses the actual stored revision.
    workspace_command(
        &h,
        &owner,
        workspace,
        &expired_observed.revision.get().to_string(),
        json!({"command":"revoke_invite","invite_id":expired_observed.invite_id}),
    )
    .await
    .ok::<CommandResponse>();
    let reauthenticated = verified(&h, "Maya").await;
    let relisted: ManagedInvitationsView = h
        .get(&path, Some(reauthenticated.access_credential.expose()))
        .await
        .ok();
    for id in [pending.resource_id, expired.resource_id] {
        let current = relisted
            .invitations
            .iter()
            .find(|i| i.invite_id == id)
            .expect("relisted");
        assert_eq!(current.state, ManagedInvitationState::Revoked);
        assert_eq!(current.revision.get(), 2);
    }
    h.finish().await;
}

#[tokio::test]
async fn managed_invitation_pages_are_bounded_scoped_and_uniformly_private() {
    use inquello_protocol::onboarding::ManagedInvitationsView;
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let stranger = verified(&h, "Theo").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    let other = create(&h, &owner, "other").await.resource_id;
    let one = invite_for_delivery(&h, &owner, workspace).await;
    let two = invite_for_delivery(&h, &owner, workspace).await;
    let foreign = invite_for_delivery(&h, &owner, other).await;
    let path = format!("/v1/workspaces/{workspace}/invitations");
    let first: ManagedInvitationsView = h
        .get(
            &format!("{path}?limit=1"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(first.invitations.len(), 1);
    let next = first.next_cursor.expect("bounded next");
    assert_eq!(next, first.invitations[0].invite_id);
    let second: ManagedInvitationsView = h
        .get(
            &format!("{path}?limit=1&after={next}"),
            Some(owner.access_credential.expose()),
        )
        .await
        .ok();
    assert_eq!(second.invitations.len(), 1);
    assert!(second.next_cursor.is_none());
    let mut ids = vec![
        first.invitations[0].invite_id,
        second.invitations[0].invite_id,
    ];
    ids.sort();
    let mut expected = vec![one.resource_id, two.resource_id];
    expected.sort();
    assert_eq!(ids, expected);
    let absent_cursor = h
        .get(
            &format!("{path}?after={}", Uuid::new_v4()),
            Some(owner.access_credential.expose()),
        )
        .await;
    let foreign_cursor = h
        .get(
            &format!("{path}?after={}", foreign.resource_id),
            Some(owner.access_credential.expose()),
        )
        .await;
    assert_eq!(absent_cursor.body, foreign_cursor.body);
    absent_cursor.assert_error(ErrorKind::Denied);
    for query in [
        "limit=0",
        "limit=101",
        "limit=1&limit=2",
        "after=not-an-id",
        "limit=-1",
        "recipient_email=Theo%40synthetic.invalid",
    ] {
        h.get(
            &format!("{path}?{query}"),
            Some(owner.access_credential.expose()),
        )
        .await
        .assert_error(ErrorKind::UnsupportedContract);
    }
    let denied = h
        .get(&path, Some(stranger.access_credential.expose()))
        .await;
    let absent = h
        .get(
            &format!("/v1/workspaces/{}/invitations", Uuid::new_v4()),
            Some(stranger.access_credential.expose()),
        )
        .await;
    let cross_workspace = h
        .get(
            &format!("/v1/workspaces/{other}/invitations"),
            Some(stranger.access_credential.expose()),
        )
        .await;
    assert_eq!(denied.status.as_u16(), 403);
    assert_eq!(denied.body, absent.body);
    assert_eq!(denied.body, cross_workspace.body);
    assert!(!denied.body.to_string().contains("Theo@"));
    let body = h
        .get(&path, Some(owner.access_credential.expose()))
        .await
        .body;
    let keys: std::collections::BTreeSet<_> = body["invitations"][0]
        .as_object()
        .expect("projection")
        .keys()
        .map(String::as_str)
        .collect();
    assert_eq!(
        keys,
        std::collections::BTreeSet::from([
            "invite_id",
            "revision",
            "state",
            "expires_at",
            "roles",
            "recipient_email"
        ])
    );
    h.finish().await;
}

#[tokio::test]
async fn managed_invitation_read_waits_and_rechecks_withdrawn_authority() {
    let h = Harness::start().await;
    let owner = verified(&h, "Maya").await;
    let workspace = create(&h, &owner, "create").await.resource_id;
    invite_for_delivery(&h, &owner, workspace).await;
    let path = format!("/v1/workspaces/{workspace}/invitations");
    let mut blocker = h.pool.begin().await.expect("blocker");
    sqlx::query("SELECT 1 FROM workspaces WHERE workspace_id=$1 FOR UPDATE")
        .bind(workspace)
        .execute(&mut *blocker)
        .await
        .expect("authority lock");
    sqlx::query("UPDATE memberships SET roles=ARRAY['member'] WHERE workspace_id=$1")
        .bind(workspace)
        .execute(&mut *blocker)
        .await
        .expect("withdraw fixture authority");
    let (response, ()) = tokio::join!(
        h.get(&path, Some(owner.access_credential.expose())),
        async {
            tokio::time::timeout(std::time::Duration::from_secs(5),async {
                loop {
                    let waiting:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%workspaces%')")
                        .fetch_one(&h.pool).await.expect("observe authority wait");
                    if waiting {break;}
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                }
            }).await.expect("metadata waits on current authority");
            blocker.commit().await.expect("commit authority loss");
        }
    );
    assert_eq!(response.status.as_u16(), 403);
    assert_eq!(response.body["error"]["kind"], "denied");
    assert!(!response.body.to_string().contains("Theo@"));
    h.finish().await;
}

#[tokio::test]
async fn nonboolean_signed_email_verified_preserves_login_but_never_grants_proof() {
    let h = Harness::start().await;
    for value in [
        json!("true"),
        json!("false"),
        json!(1),
        json!(0),
        json!({}),
        json!({"verified":true}),
        json!([]),
        json!([true]),
        Value::Null,
        json!(false),
    ] {
        let transaction = h.create_transaction(Uuid::new_v4()).await;
        let mut claims = h.valid_fixture("Maya", &transaction).claims();
        claims["email_verified"] = value;
        let token = h.issuer.sign_claims(&claims);
        h.remember(&token);
        let session: SessionCredentials = h.bootstrap(&transaction, &token).await.ok();
        let body = envelope(
            &h,
            &Uuid::new_v4().to_string(),
            "0",
            json!({"command":"create_workspace","name":"Not verified"}),
        )
        .await;
        h.post(
            "/v1/onboarding/commands",
            &body,
            Some(session.access_credential.expose()),
        )
        .await
        .assert_error(ErrorKind::Denied);
        h.get("/v1/invitations", Some(session.access_credential.expose()))
            .await
            .assert_error(ErrorKind::Denied);
    }
    assert_eq!(h.count("SELECT count(*) FROM workspaces").await, 0);
    assert_eq!(
        h.count("SELECT count(*) FROM sessions WHERE verified_email IS NOT NULL")
            .await,
        0
    );
    // Exact JSON boolean true remains the sole qualifying proof.
    let owner = verified(&h, "Maya").await;
    create(&h, &owner, "actual-boolean-true").await;
    assert_eq!(h.count("SELECT count(*) FROM workspaces").await, 1);
    assert_eq!(
        h.count("SELECT count(*) FROM sessions WHERE verified_email IS NOT NULL")
            .await,
        1
    );
    h.finish().await;
}
