//! Story 1.11 conformance: every I/O matrix row of "Enforce internal-company
//! memberships without disclosing private Tasks", against PostgreSQL 18 and the
//! in-process test issuer. Each test uses its own database and ends with
//! `Harness::finish` (no credential in any receipt, error body, log line or
//! row); the tests that touch resources also assert that no error body names a
//! resource, Workspace, Engagement or invite.
//!
//! Grants and resource registrations are seeded as fixtures: there is no
//! grant-issuing API until Epic 4.
//!
//! Run with `INQUELLO_TEST_DATABASE_URL` set and `--features test-issuer`.

#![allow(
    clippy::expect_used,
    reason = "test helpers fail the test on any unexpected error"
)]

mod support;

use chrono::TimeDelta;
use inquello_protocol::command::CommandResponse;
use inquello_protocol::error::ErrorBody;
use inquello_protocol::error::ErrorKind;
use inquello_protocol::login::SessionCredentials;
use inquello_protocol::session::MembershipsView;
use inquello_protocol::workspace::AcceptInviteResponse;
use inquello_protocol::workspace::AccessCheckResponse;
use inquello_protocol::workspace::DenyReason;
use inquello_protocol::workspace::ExecutionPolicyView;
use inquello_protocol::workspace::RoleKind;
use inquello_protocol::workspace::RolesView;
use inquello_protocol::workspace::SandboxCeiling;
use inquello_protocol::workspace::WorkspacesView;
use inquello_service::admin;
use inquello_service::admin::AdminError;
use inquello_service::admin::CreateWorkspace;
use inquello_service::admin::CreateWorkspaceOutcome;
use pretty_assertions::assert_eq;
use reqwest::StatusCode;
use serde_json::Value;
use serde_json::json;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
use support::Harness;
use support::Response;
use uuid::Uuid;

// ---- helpers ---------------------------------------------------------------

fn policy_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../inquello-protocol/fixtures/workspace/policy.json")
}

fn policy_text() -> String {
    std::fs::read_to_string(policy_path()).expect("policy fixture")
}

fn policy_with(mutate: impl FnOnce(&mut Value)) -> String {
    let mut value: Value = serde_json::from_str(&policy_text()).expect("policy json");
    mutate(&mut value);
    value.to_string()
}

fn create_request(h: &Harness, name: &str, admin_subject: &str) -> CreateWorkspace {
    CreateWorkspace {
        name: name.to_string(),
        kind: "internal_company".to_string(),
        policy: policy_text(),
        first_admin_issuer: h.issuer.issuer().to_string(),
        first_admin_subject: admin_subject.to_string(),
        invite_lifetime: Duration::from_secs(60 * 60),
        operator: "test-operator".to_string(),
    }
}

async fn create_workspace(h: &Harness, name: &str, admin_subject: &str) -> CreateWorkspaceOutcome {
    admin::create_workspace(&h.pool, create_request(h, name, admin_subject), h.now())
        .await
        .expect("operator creates the workspace")
}

async fn accept(h: &Harness, invite_id: Uuid, who: &SessionCredentials) -> Response {
    h.post(
        &format!("/v1/invites/{invite_id}/accept"),
        &json!({}),
        Some(who.access_credential.expose()),
    )
    .await
}

struct Ws {
    id: Uuid,
    name: String,
    admin: SessionCredentials,
}

/// Operator bootstrap, then the first administrator signs in and accepts.
async fn workspace_with_admin(h: &Harness, name: &str, admin_subject: &str) -> Ws {
    let outcome = create_workspace(h, name, admin_subject).await;
    let admin = h.sign_in(admin_subject).await;
    accept(h, outcome.first_admin_invite_id, &admin)
        .await
        .ok::<AcceptInviteResponse>();
    Ws {
        id: outcome.workspace_id,
        name: name.to_string(),
        admin,
    }
}

async fn envelope(h: &Harness, ws: Uuid, op: &str, expected: u64, payload: Value) -> Value {
    json!({
        "command_epoch": h.command_epoch().await,
        "operation_id": op,
        "workspace_id": ws,
        "expected_revision": expected.to_string(),
        "schema_version": 1,
        "payload": payload,
    })
}

async fn command(
    h: &Harness,
    ws: Uuid,
    who: &SessionCredentials,
    op: &str,
    expected: u64,
    payload: Value,
) -> Response {
    let body = envelope(h, ws, op, expected, payload).await;
    h.post(
        &format!("/v1/workspaces/{ws}/commands"),
        &body,
        Some(who.access_credential.expose()),
    )
    .await
}

async fn issue_invite(h: &Harness, ws: &Ws, subject: &str, roles: &[&str]) -> Uuid {
    let response: CommandResponse = command(
        h,
        ws.id,
        &ws.admin,
        &format!("op-invite-{subject}-{}", Uuid::new_v4()),
        0,
        json!({"command": "issue_invite", "issuer": h.issuer.issuer(), "subject": subject, "roles": roles}),
    )
    .await
    .ok();
    response.resource_id
}

/// Invites `subject`, who signs in and accepts.
async fn join(h: &Harness, ws: &Ws, subject: &str, roles: &[&str]) -> SessionCredentials {
    let invite_id = issue_invite(h, ws, subject, roles).await;
    let member = h.sign_in(subject).await;
    accept(h, invite_id, &member)
        .await
        .ok::<AcceptInviteResponse>();
    member
}

async fn membership_revision(h: &Harness, ws: Uuid, principal: Uuid) -> u64 {
    let revision: i64 = sqlx::query_scalar(
        "SELECT revision FROM memberships WHERE workspace_id = $1 AND principal_id = $2",
    )
    .bind(ws)
    .bind(principal)
    .fetch_one(&h.pool)
    .await
    .expect("membership revision");
    u64::try_from(revision).expect("positive")
}

async fn roles_of(h: &Harness, ws: Uuid, principal: Uuid) -> (String, Vec<String>) {
    sqlx::query_as(
        "SELECT status, roles FROM memberships WHERE workspace_id = $1 AND principal_id = $2",
    )
    .bind(ws)
    .bind(principal)
    .fetch_one(&h.pool)
    .await
    .expect("membership row")
}

async fn epoch_of(h: &Harness, ws: Uuid) -> i64 {
    sqlx::query_scalar("SELECT authorization_epoch FROM workspaces WHERE workspace_id = $1")
        .bind(ws)
        .fetch_one(&h.pool)
        .await
        .expect("epoch")
}

async fn access_check(
    h: &Harness,
    ws: Uuid,
    who: Option<&SessionCredentials>,
    body: Value,
) -> Response {
    h.post(
        &format!("/v1/workspaces/{ws}/access-checks"),
        &body,
        who.map(|c| c.access_credential.expose()),
    )
    .await
}

fn read_of(kind: &str, id: Uuid) -> Value {
    json!({"action": "read", "resource": {"kind": kind, "resource_id": id}})
}

/// Asserts a Workspace refusal: the fixed body for `reason` and nothing else.
fn assert_refused(response: &Response, reason: DenyReason) {
    let expected = ErrorBody::refused(reason);
    assert_eq!(
        response.status.as_u16(),
        expected.error.kind.http_status(),
        "body: {}",
        response.body
    );
    let body: ErrorBody = serde_json::from_value(response.body.clone()).expect("error body");
    assert_eq!(body, expected);
}

/// No error body answered so far names any of `secrets`.
fn assert_no_disclosure(h: &Harness, secrets: &[String]) {
    let bodies = h.error_bodies();
    assert!(!bodies.is_empty(), "the test should have seen refusals");
    for body in &bodies {
        for secret in secrets {
            assert!(
                !body.contains(secret.as_str()),
                "an error body discloses {secret}: {body}"
            );
        }
    }
}

async fn seed_resource(
    h: &Harness,
    ws: Uuid,
    id: Uuid,
    kind: &str,
    creator: Uuid,
    engagement: Option<Uuid>,
) {
    sqlx::query(
        "INSERT INTO resource_registrations (workspace_id, resource_id, kind, creator_principal_id, \
         engagement_id) VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(ws)
    .bind(id)
    .bind(kind)
    .bind(creator)
    .bind(engagement)
    .execute(&h.pool)
    .await
    .expect("seed resource");
}

/// Seeds a grant; `audience` `None` is the Workspace audit team.
async fn seed_grant(
    h: &Harness,
    ws: Uuid,
    resource: Uuid,
    audience: Option<Uuid>,
    actions: &[&str],
) {
    let actions: Vec<String> = actions.iter().map(ToString::to_string).collect();
    sqlx::query(
        "INSERT INTO grants (grant_id, workspace_id, resource_id, audience_kind, \
         audience_principal_id, actions, state, revision) VALUES ($1, $2, $3, $4, $5, $6, 'active', 1)",
    )
    .bind(Uuid::new_v4())
    .bind(ws)
    .bind(resource)
    .bind(if audience.is_some() {
        "principal"
    } else {
        "workspace_audit_team"
    })
    .bind(audience)
    .bind(&actions)
    .execute(&h.pool)
    .await
    .expect("seed grant");
}

async fn create_engagement(h: &Harness, ws: &Ws, name: &str) -> Uuid {
    let response: CommandResponse = command(
        h,
        ws.id,
        &ws.admin,
        &format!("op-engagement-{}", Uuid::new_v4()),
        0,
        json!({"command": "create_engagement", "name": name}),
    )
    .await
    .ok();
    assert_eq!(response.revision.get(), 1);
    response.resource_id
}

async fn engagement_revision(h: &Harness, engagement: Uuid) -> u64 {
    let revision: i64 =
        sqlx::query_scalar("SELECT revision FROM engagements WHERE engagement_id = $1")
            .bind(engagement)
            .fetch_one(&h.pool)
            .await
            .expect("engagement revision");
    u64::try_from(revision).expect("positive")
}

fn cli(h: &Harness, args: &[&str]) -> std::process::Output {
    let url = h.db.url();
    Command::new(env!("CARGO_BIN_EXE_inquello-service"))
        .arg("admin")
        .args(args)
        .args(["--database-url", url.as_str()])
        .env_remove("INQUELLO_DATABASE_URL")
        .output()
        .expect("run the operator CLI")
}

async fn count(h: &Harness, sql: &'static str) -> i64 {
    h.count(sql).await
}

// ---- Bootstrap, guest role, external audit at the CLI ------------------------

// Matrix: Bootstrap; Guest role; External audit (CLI side).
#[tokio::test(flavor = "multi_thread")]
async fn the_operator_cli_bootstraps_a_workspace_and_refuses_guest_roles_and_external_audit() {
    let h = Harness::start().await;
    let policy = policy_path();
    let policy = policy.to_str().expect("utf-8 path");
    // A long lifetime: the CLI uses the wall clock, the service the test clock.
    let output = cli(
        &h,
        &[
            "create-workspace",
            "--name",
            "Synthetic Audit Co",
            "--policy",
            policy,
            "--first-admin-issuer",
            h.issuer.issuer(),
            "--first-admin-subject",
            "olga",
            "--invite-lifetime-seconds",
            "315360000",
            "--operator",
            "ops-test",
        ],
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let outcome: Value = serde_json::from_slice(&output.stdout).expect("one JSON line");
    let workspace_id: Uuid = serde_json::from_value(outcome["workspace_id"].clone()).expect("id");
    let invite_id: Uuid =
        serde_json::from_value(outcome["first_admin_invite_id"].clone()).expect("invite id");
    assert_eq!(outcome["policy_revision"], json!("1"));
    assert_eq!(outcome["first_admin_roles"], json!(["audit_lead"]));
    let stdout = String::from_utf8_lossy(&output.stdout);
    assert!(
        !stdout.contains("inquello_test:"),
        "the CLI printed the database URL"
    );

    // The operator receipt records exactly the printed outcome.
    let (operator, command_name, response): (String, String, Value) = sqlx::query_as(
        "SELECT operator, command, response FROM operator_receipts WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&h.pool)
    .await
    .expect("operator receipt");
    assert_eq!(operator, "ops-test");
    assert_eq!(command_name, "create_workspace");
    assert_eq!(response, outcome);
    let (kind, epoch): (String, i64) =
        sqlx::query_as("SELECT kind, authorization_epoch FROM workspaces WHERE workspace_id = $1")
            .bind(workspace_id)
            .fetch_one(&h.pool)
            .await
            .expect("workspace row");
    assert_eq!((kind.as_str(), epoch), ("internal_company", 1));
    // Nobody is a member until the first administrator accepts.
    assert_eq!(count(&h, "SELECT count(*) FROM memberships").await, 0);

    let olga = h.sign_in("olga").await;
    let accepted: AcceptInviteResponse = accept(&h, invite_id, &olga).await.ok();
    assert_eq!(accepted.roles, ["audit_lead"]);
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(olga.access_credential.expose()))
        .await
        .ok();
    assert_eq!(view.workspaces.len(), 1);
    assert_eq!(view.workspaces[0].name, "Synthetic Audit Co");
    assert_eq!(view.workspaces[0].membership.roles, ["audit_lead"]);

    // update-policy sets a new revision and increments the epoch.
    let output = cli(
        &h,
        &[
            "update-policy",
            "--workspace",
            &workspace_id.to_string(),
            "--policy",
            policy,
            "--operator",
            "ops-test",
        ],
    );
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let updated: Value = serde_json::from_slice(&output.stdout).expect("json");
    assert_eq!(updated["policy_revision"], json!("2"));
    assert_eq!(updated["authorization_epoch"], json!("2"));

    // Guest role: rejected, naming the kind; nothing created.
    let dir = tempfile::tempdir().expect("tempdir");
    let guest = dir.path().join("guest.json");
    std::fs::write(
        &guest,
        policy_with(|v| v["roles"][2]["kind"] = json!("guest")),
    )
    .expect("write");
    let before = count(&h, "SELECT count(*) FROM workspaces").await;
    let output = cli(
        &h,
        &[
            "create-workspace",
            "--name",
            "Guest Co",
            "--policy",
            guest.to_str().expect("path"),
            "--first-admin-issuer",
            h.issuer.issuer(),
            "--first-admin-subject",
            "gus",
            "--invite-lifetime-seconds",
            "3600",
        ],
    );
    assert!(!output.status.success());
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(stderr.contains("`guest`"), "{stderr}");
    let output = cli(
        &h,
        &[
            "update-policy",
            "--workspace",
            &workspace_id.to_string(),
            "--policy",
            guest.to_str().expect("path"),
        ],
    );
    assert!(!output.status.success());
    assert!(String::from_utf8_lossy(&output.stderr).contains("`guest`"));

    // External audit: the kind, client/independence flags and policy attributes.
    for args in [
        vec!["--kind", "external_audit"],
        vec!["--client-name", "Acme"],
        vec!["--independence-policy", "x"],
    ] {
        let mut all = vec![
            "create-workspace",
            "--name",
            "External Co",
            "--policy",
            policy,
            "--first-admin-issuer",
            h.issuer.issuer(),
            "--first-admin-subject",
            "ext",
            "--invite-lifetime-seconds",
            "3600",
        ];
        all.extend(args);
        let output = cli(&h, &all);
        assert!(!output.status.success());
        let stderr = String::from_utf8_lossy(&output.stderr);
        assert!(stderr.contains("route_not_available"), "{stderr}");
    }
    let client = dir.path().join("client.json");
    std::fs::write(&client, policy_with(|v| v["client"] = json!("Acme"))).expect("write");
    let output = cli(
        &h,
        &[
            "create-workspace",
            "--name",
            "Client Co",
            "--policy",
            client.to_str().expect("path"),
            "--first-admin-issuer",
            h.issuer.issuer(),
            "--first-admin-subject",
            "ext",
            "--invite-lifetime-seconds",
            "3600",
        ],
    );
    assert!(String::from_utf8_lossy(&output.stderr).contains("route_not_available"));
    assert_eq!(count(&h, "SELECT count(*) FROM workspaces").await, before);

    // The library refuses the same way.
    let mut request = create_request(&h, "Guest Co", "gus");
    request.policy = policy_with(|v| v["roles"][0]["kind"] = json!("guest"));
    assert!(matches!(
        admin::create_workspace(&h.pool, request, h.now()).await,
        Err(AdminError::Policy(_))
    ));
    let mut request = create_request(&h, "External Co", "ext");
    request.kind = "external_audit".to_string();
    assert!(matches!(
        admin::create_workspace(&h.pool, request, h.now()).await,
        Err(AdminError::RouteNotAvailable(_))
    ));

    // No HTTP path creates a Workspace or reaches the operator commands.
    for path in [
        "/v1/workspaces",
        "/v1/admin/workspaces",
        "/v1/workspaces/create",
    ] {
        let response = h
            .post(
                path,
                &json!({"name": "x"}),
                Some(olga.access_credential.expose()),
            )
            .await;
        assert!(
            response.status == StatusCode::METHOD_NOT_ALLOWED
                || response.status == StatusCode::NOT_FOUND,
            "{path}: {}",
            response.status
        );
    }
    assert_eq!(count(&h, "SELECT count(*) FROM workspaces").await, before);
    h.finish().await;
}

// ---- Invites -------------------------------------------------------------------

// Matrix: Accept invite.
#[tokio::test(flavor = "multi_thread")]
async fn the_matching_principal_accepts_and_becomes_an_active_member_with_the_invited_roles() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Acceptance Co", "ada").await;
    let invite_id = issue_invite(&h, &ws, "ben", &["auditor", "reviewer"]).await;
    let ben = h.sign_in("ben").await;
    let accepted: AcceptInviteResponse = accept(&h, invite_id, &ben).await.ok();
    assert_eq!(accepted.workspace_id, ws.id);
    assert_eq!(accepted.principal_id, ben.principal_id);
    assert_eq!(accepted.roles, ["auditor", "reviewer"]);
    assert_eq!(accepted.membership_revision.get(), 1);
    assert_eq!(
        roles_of(&h, ws.id, ben.principal_id).await,
        (
            "active".to_string(),
            vec!["auditor".to_string(), "reviewer".to_string()]
        )
    );

    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(ben.access_credential.expose()))
        .await
        .ok();
    assert_eq!(view.workspaces.len(), 1);
    assert_eq!(view.workspaces[0].membership.roles, ["auditor", "reviewer"]);
    assert_eq!(view.workspaces[0].kind, "internal_company");
    let memberships: MembershipsView = h
        .get("/v1/memberships", Some(ben.access_credential.expose()))
        .await
        .ok();
    let roles: Vec<&str> = memberships
        .memberships
        .iter()
        .map(|m| m.role.as_str())
        .collect();
    assert_eq!(roles, ["auditor", "reviewer"]);

    // An invite naming a role the policy lacks (a guest, say) is refused.
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-guest-invite",
        0,
        json!({"command": "issue_invite", "issuer": h.issuer.issuer(), "subject": "gil", "roles": ["guest"]}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    h.finish().await;
}

// Matrix: Wrong principal.
#[tokio::test(flavor = "multi_thread")]
async fn a_different_subject_with_the_same_email_is_refused_like_an_unknown_invite() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Email Co", "ada").await;
    let invite_id = issue_invite(&h, &ws, "carol", &["auditor"]).await;
    let mallory = h
        .sign_in_with("mallory", |fixture| {
            fixture.with_email(Some("carol@synthetic.invalid"))
        })
        .await;

    let wrong = accept(&h, invite_id, &mallory).await;
    let unknown = accept(&h, Uuid::new_v4(), &mallory).await;
    wrong.assert_error(ErrorKind::Denied);
    assert_eq!(wrong.status, unknown.status);
    assert_eq!(wrong.body, unknown.body);
    assert_eq!(
        count(
            &h,
            "SELECT count(*) FROM memberships WHERE status = 'active'"
        )
        .await,
        1
    );

    // The attempt did not consume the invite: carol still accepts it.
    let carol = h.sign_in("carol").await;
    accept(&h, invite_id, &carol)
        .await
        .ok::<AcceptInviteResponse>();
    assert_no_disclosure(
        &h,
        &[invite_id.to_string(), ws.id.to_string(), ws.name.clone()],
    );
    h.finish().await;
}

// Matrix: Replay / expired (plus revoked and a withdrawn grantor).
#[tokio::test(flavor = "multi_thread")]
async fn replayed_expired_revoked_and_withdrawn_invites_get_the_same_safe_error() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Replay Co", "ada").await;
    let unknown = accept(&h, Uuid::new_v4(), &ws.admin).await;
    unknown.assert_error(ErrorKind::Denied);

    // Replay: a second accept of a used invite.
    let dave_invite = issue_invite(&h, &ws, "dave", &["auditor"]).await;
    let dave = h.sign_in("dave").await;
    accept(&h, dave_invite, &dave)
        .await
        .ok::<AcceptInviteResponse>();
    let replay = accept(&h, dave_invite, &dave).await;
    assert_eq!(
        (replay.status, &replay.body),
        (unknown.status, &unknown.body)
    );

    // Revoked.
    let eve_invite = issue_invite(&h, &ws, "eve", &["reviewer"]).await;
    let revoked: CommandResponse = command(
        &h,
        ws.id,
        &ws.admin,
        "op-revoke-eve",
        1,
        json!({"command": "revoke_invite", "invite_id": eve_invite}),
    )
    .await
    .ok();
    assert_eq!(revoked.revision.get(), 2);
    let eve = h.sign_in("eve").await;
    let response = accept(&h, eve_invite, &eve).await;
    assert_eq!(
        (response.status, &response.body),
        (unknown.status, &unknown.body)
    );

    // A grantor who no longer holds manage_membership.
    let second_admin = join(&h, &ws, "gwen", &["audit_lead"]).await;
    let gwen_ws = Ws {
        id: ws.id,
        name: ws.name.clone(),
        admin: second_admin.clone(),
    };
    let fay_invite = issue_invite(&h, &gwen_ws, "fay", &["auditor"]).await;
    let gwen_revision = membership_revision(&h, ws.id, second_admin.principal_id).await;
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-demote-gwen",
        gwen_revision,
        json!({"command": "change_roles", "principal_id": second_admin.principal_id, "roles": ["auditor"]}),
    )
    .await
    .ok::<CommandResponse>();
    let fay = h.sign_in("fay").await;
    let response = accept(&h, fay_invite, &fay).await;
    assert_eq!(
        (response.status, &response.body),
        (unknown.status, &unknown.body)
    );

    // Expired: issued now, accepted after the 7-day invite lifetime.
    let hal_invite = issue_invite(&h, &ws, "hal", &["auditor"]).await;
    for who in [&eve, &fay] {
        let view: WorkspacesView = h
            .get("/v1/workspaces", Some(who.access_credential.expose()))
            .await
            .ok();
        assert!(view.workspaces.is_empty());
    }
    h.clock.advance(TimeDelta::days(8));
    let hal = h.sign_in("hal").await;
    let response = accept(&h, hal_invite, &hal).await;
    assert_eq!(
        (response.status, &response.body),
        (unknown.status, &unknown.body)
    );
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(hal.access_credential.expose()))
        .await
        .ok();
    assert!(view.workspaces.is_empty());
    assert_no_disclosure(
        &h,
        &[
            dave_invite.to_string(),
            eve_invite.to_string(),
            fay_invite.to_string(),
            hal_invite.to_string(),
            ws.id.to_string(),
            ws.name.clone(),
        ],
    );
    h.finish().await;
}

// ---- Commands ----------------------------------------------------------------

// Matrix: Self-elevation.
#[tokio::test(flavor = "multi_thread")]
async fn a_member_without_manage_membership_cannot_change_their_own_roles() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Elevation Co", "ada").await;
    let bob = join(&h, &ws, "bob", &["auditor"]).await;
    let revision = membership_revision(&h, ws.id, bob.principal_id).await;
    let epoch = epoch_of(&h, ws.id).await;

    let response = command(
        &h,
        ws.id,
        &bob,
        "op-elevate",
        revision,
        json!({"command": "change_roles", "principal_id": bob.principal_id, "roles": ["audit_lead"]}),
    )
    .await;
    assert_refused(&response, DenyReason::RoleLacksAction);
    // Nor any other management command.
    let response = command(
        &h,
        ws.id,
        &bob,
        "op-self-invite",
        0,
        json!({"command": "issue_invite", "issuer": h.issuer.issuer(), "subject": "bob2", "roles": ["audit_lead"]}),
    )
    .await;
    assert_refused(&response, DenyReason::RoleLacksAction);
    assert_eq!(
        roles_of(&h, ws.id, bob.principal_id).await,
        ("active".to_string(), vec!["auditor".to_string()])
    );
    assert_eq!(epoch_of(&h, ws.id).await, epoch);
    assert_eq!(
        count(&h, "SELECT count(*) FROM operation_receipts WHERE scope_kind = 'workspace' AND command = 'change_roles'").await,
        0
    );
    let check = access_check(
        &h,
        ws.id,
        Some(&bob),
        json!({"action": "manage_membership"}),
    )
    .await;
    assert_refused(&check, DenyReason::RoleLacksAction);
    h.finish().await;
}

// Engagements, membership changes and the epoch.
#[tokio::test(flavor = "multi_thread")]
async fn engagements_and_membership_changes_follow_revisions_and_increment_the_epoch() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Engagement Co", "ada").await;
    let bob = join(&h, &ws, "bob", &["auditor"]).await;
    let zed = h.sign_in("zed").await;
    let engagement = create_engagement(&h, &ws, "FY26 synthetic").await;
    let epoch = epoch_of(&h, ws.id).await;

    // Engagement membership needs an active Workspace membership.
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-add-zed",
        1,
        json!({"command": "add_engagement_member", "engagement_id": engagement, "principal_id": zed.principal_id}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    let added: CommandResponse = command(
        &h,
        ws.id,
        &ws.admin,
        "op-add-bob",
        1,
        json!({"command": "add_engagement_member", "engagement_id": engagement, "principal_id": bob.principal_id}),
    )
    .await
    .ok();
    assert_eq!(added.revision.get(), 2);
    assert_eq!(
        added
            .authorization_epoch
            .map(inquello_protocol::Revision::get),
        Some(1)
    );
    // A stale expected revision conflicts.
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-add-bob-stale",
        1,
        json!({"command": "remove_engagement_member", "engagement_id": engagement, "principal_id": bob.principal_id}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(bob.access_credential.expose()))
        .await
        .ok();
    assert_eq!(view.workspaces[0].engagements.len(), 1);

    let removed: CommandResponse = command(
        &h,
        ws.id,
        &ws.admin,
        "op-remove-bob-engagement",
        2,
        json!({"command": "remove_engagement_member", "engagement_id": engagement, "principal_id": bob.principal_id}),
    )
    .await
    .ok();
    assert_eq!(removed.revision.get(), 3);
    assert_eq!(epoch_of(&h, ws.id).await, epoch + 1);
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(bob.access_credential.expose()))
        .await
        .ok();
    assert!(view.workspaces[0].engagements.is_empty());
    // The administrator sees every Engagement.
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(ws.admin.access_credential.expose()))
        .await
        .ok();
    assert_eq!(view.workspaces[0].engagements.len(), 1);

    // Role change: epoch increments, the member's revision advances.
    let revision = membership_revision(&h, ws.id, bob.principal_id).await;
    let changed: CommandResponse = command(
        &h,
        ws.id,
        &ws.admin,
        "op-bob-reviewer",
        revision,
        json!({"command": "change_roles", "principal_id": bob.principal_id, "roles": ["reviewer"]}),
    )
    .await
    .ok();
    assert_eq!(changed.revision.get(), revision + 1);
    assert_eq!(epoch_of(&h, ws.id).await, epoch + 2);

    // Removing a member ends their Engagement memberships too.
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-add-bob-again",
        3,
        json!({"command": "add_engagement_member", "engagement_id": engagement, "principal_id": bob.principal_id}),
    )
    .await
    .ok::<CommandResponse>();
    let revision = membership_revision(&h, ws.id, bob.principal_id).await;
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-remove-bob",
        revision,
        json!({"command": "remove_member", "principal_id": bob.principal_id}),
    )
    .await
    .ok::<CommandResponse>();
    assert_eq!(epoch_of(&h, ws.id).await, epoch + 3);
    assert_eq!(
        roles_of(&h, ws.id, bob.principal_id).await,
        ("removed".to_string(), vec![])
    );
    assert_eq!(
        count(
            &h,
            "SELECT count(*) FROM engagement_memberships WHERE status = 'active'"
        )
        .await,
        0
    );
    assert_eq!(count(&h, "SELECT count(*) FROM workspace_events").await, 3);
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(bob.access_credential.expose()))
        .await
        .ok();
    assert!(view.workspaces.is_empty());

    // The last administrator cannot remove or demote themselves.
    let revision = membership_revision(&h, ws.id, ws.admin.principal_id).await;
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-remove-self",
        revision,
        json!({"command": "remove_member", "principal_id": ws.admin.principal_id}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-demote-self",
        revision,
        json!({"command": "change_roles", "principal_id": ws.admin.principal_id, "roles": ["auditor"]}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    h.finish().await;
}

// Matrix: Stale authority.
#[tokio::test(flavor = "multi_thread")]
async fn a_command_under_authority_removed_before_it_commits_is_rejected() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Stale Co", "ada").await;
    let gwen = join(&h, &ws, "gwen", &["audit_lead"]).await;
    let bob = join(&h, &ws, "bob", &["auditor"]).await;
    let ivy = join(&h, &ws, "ivy", &["audit_lead"]).await;

    // Sequential: gwen is removed; her command prepared earlier then fails.
    let prepared = envelope(
        &h,
        ws.id,
        "op-gwen-late",
        0,
        json!({"command": "create_engagement", "name": "Gwen's"}),
    )
    .await;
    let revision = membership_revision(&h, ws.id, gwen.principal_id).await;
    let removal: CommandResponse = command(
        &h,
        ws.id,
        &ws.admin,
        "op-remove-gwen",
        revision,
        json!({"command": "remove_member", "principal_id": gwen.principal_id}),
    )
    .await
    .ok();
    assert_eq!(
        removal
            .authorization_epoch
            .map(inquello_protocol::Revision::get),
        Some(2)
    );
    let response = h
        .post(
            &format!("/v1/workspaces/{}/commands", ws.id),
            &prepared,
            Some(gwen.access_credential.expose()),
        )
        .await;
    assert_refused(&response, DenyReason::NotAMember);

    // A command made with the target's old revision conflicts.
    let old = membership_revision(&h, ws.id, bob.principal_id).await;
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-bob-reviewer",
        old,
        json!({"command": "change_roles", "principal_id": bob.principal_id, "roles": ["reviewer"]}),
    )
    .await
    .ok::<CommandResponse>();
    command(
        &h,
        ws.id,
        &ivy,
        "op-bob-lead",
        old,
        json!({"command": "change_roles", "principal_id": bob.principal_id, "roles": ["audit_lead"]}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);

    // In flight: ivy's command waits on the Workspace authorization-epoch lock
    // while her removal is committing; once it commits she is refused.
    let mut removal = h.pool.begin().await.expect("begin");
    sqlx::query("SELECT 1 FROM workspaces WHERE workspace_id = $1 FOR UPDATE")
        .bind(ws.id)
        .execute(&mut *removal)
        .await
        .expect("lock the epoch");
    let in_flight = envelope(
        &h,
        ws.id,
        "op-ivy-in-flight",
        0,
        json!({"command": "create_engagement", "name": "Ivy's"}),
    )
    .await;
    let client = h.client.clone();
    let url = format!("{}/v1/workspaces/{}/commands", h.base, ws.id);
    let bearer = ivy.access_credential.expose().to_string();
    let task = tokio::spawn(async move {
        let response = client
            .post(url)
            .bearer_auth(bearer)
            .json(&in_flight)
            .send()
            .await
            .expect("request");
        let status = response.status();
        let body: Value = response.json().await.expect("json");
        (status, body)
    });
    tokio::time::sleep(Duration::from_millis(500)).await;
    assert!(
        !task.is_finished(),
        "the command must wait for the epoch lock"
    );
    sqlx::query(
        "UPDATE memberships SET status = 'removed', roles = '{}', revision = revision + 1 \
         WHERE workspace_id = $1 AND principal_id = $2",
    )
    .bind(ws.id)
    .bind(ivy.principal_id)
    .execute(&mut *removal)
    .await
    .expect("remove ivy");
    sqlx::query(
        "UPDATE workspaces SET authorization_epoch = authorization_epoch + 1 WHERE workspace_id = $1",
    )
    .bind(ws.id)
    .execute(&mut *removal)
    .await
    .expect("epoch");
    removal.commit().await.expect("commit the removal");
    let (status, body) = task.await.expect("task");
    let expected = ErrorBody::refused(DenyReason::NotAMember);
    assert_eq!(status.as_u16(), expected.error.kind.http_status());
    assert_eq!(
        serde_json::from_value::<ErrorBody>(body).expect("error body"),
        expected
    );
    assert_eq!(count(&h, "SELECT count(*) FROM engagements").await, 0);
    assert_eq!(
        count(&h, "SELECT count(*) FROM operation_receipts WHERE operation_id IN ('op-gwen-late', 'op-ivy-in-flight')").await,
        0
    );
    h.finish().await;
}

// Matrix: Receipt retry.
#[tokio::test(flavor = "multi_thread")]
async fn an_exact_retry_returns_the_recorded_outcome_after_an_access_recheck() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Receipt Co", "ada").await;
    let gwen = join(&h, &ws, "gwen", &["audit_lead"]).await;
    let payload = json!({"command": "create_engagement", "name": "Retry engagement"});
    let first: CommandResponse = command(&h, ws.id, &ws.admin, "op-retry", 0, payload.clone())
        .await
        .ok();
    assert_eq!(
        first
            .authorization_epoch
            .map(inquello_protocol::Revision::get),
        Some(1)
    );
    let again: CommandResponse = command(&h, ws.id, &ws.admin, "op-retry", 0, payload.clone())
        .await
        .ok();
    assert_eq!(again, first);
    assert_eq!(count(&h, "SELECT count(*) FROM engagements").await, 1);
    let (scope_kind, scope_id): (String, Uuid) = sqlx::query_as(
        "SELECT scope_kind, scope_id FROM operation_receipts WHERE operation_id = 'op-retry'",
    )
    .fetch_one(&h.pool)
    .await
    .expect("receipt");
    assert_eq!((scope_kind.as_str(), scope_id), ("workspace", ws.id));

    // Same key, different payload: conflict, nothing applied.
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-retry",
        0,
        json!({"command": "create_engagement", "name": "Something else"}),
    )
    .await
    .assert_error(ErrorKind::VersionConflict);
    assert_eq!(count(&h, "SELECT count(*) FROM engagements").await, 1);

    // The same operation ID is a separate key for another principal.
    let theirs: CommandResponse = command(&h, ws.id, &gwen, "op-retry", 0, payload.clone())
        .await
        .ok();
    assert_ne!(theirs.resource_id, first.resource_id);

    // After losing manage_membership, the retry is refused, not replayed.
    let revision = membership_revision(&h, ws.id, ws.admin.principal_id).await;
    command(
        &h,
        ws.id,
        &gwen,
        "op-demote-ada",
        revision,
        json!({"command": "change_roles", "principal_id": ws.admin.principal_id, "roles": ["auditor"]}),
    )
    .await
    .ok::<CommandResponse>();
    let response = command(&h, ws.id, &ws.admin, "op-retry", 0, payload).await;
    assert_refused(&response, DenyReason::RoleLacksAction);

    // An old command epoch is never treated as a fresh operation.
    let mut stale = envelope(
        &h,
        ws.id,
        "op-stale-epoch",
        0,
        json!({"command": "create_engagement", "name": "x"}),
    )
    .await;
    stale["command_epoch"] = json!("2");
    h.post(
        &format!("/v1/workspaces/{}/commands", ws.id),
        &stale,
        Some(gwen.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::UnsupportedContract);
    // The envelope's Workspace must be the path's.
    let other = envelope(
        &h,
        Uuid::new_v4(),
        "op-mismatch",
        0,
        json!({"command": "create_engagement", "name": "x"}),
    )
    .await;
    h.post(
        &format!("/v1/workspaces/{}/commands", ws.id),
        &other,
        Some(gwen.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::UnsupportedContract);
    h.finish().await;
}

// ---- Resources -------------------------------------------------------------

// Matrix: Private Task; Creator; Unknown resource.
#[tokio::test(flavor = "multi_thread")]
async fn another_creators_private_task_is_refused_to_admins_and_engagement_members() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Private Co", "ada").await;
    let alice = join(&h, &ws, "alice", &["auditor"]).await;
    let bob = join(&h, &ws, "bob", &["auditor", "reviewer"]).await;
    let engagement = create_engagement(&h, &ws, "Shared engagement").await;
    for (op, member, expected) in [
        ("op-add-ada", &ws.admin, 1),
        ("op-add-alice", &alice, 2),
        ("op-add-bob", &bob, 3),
    ] {
        command(
            &h,
            ws.id,
            &ws.admin,
            op,
            expected,
            json!({"command": "add_engagement_member", "engagement_id": engagement, "principal_id": member.principal_id}),
        )
        .await
        .ok::<CommandResponse>();
    }
    assert_eq!(engagement_revision(&h, engagement).await, 4);
    let task = Uuid::new_v4();
    seed_resource(
        &h,
        ws.id,
        task,
        "private_task",
        alice.principal_id,
        Some(engagement),
    )
    .await;
    // Even a grant naming someone else does not reach a private Task.
    seed_grant(&h, ws.id, task, Some(bob.principal_id), &["read", "export"]).await;
    seed_grant(&h, ws.id, task, None, &["read"]).await;

    // Creator: allowed.
    let allowed: AccessCheckResponse =
        access_check(&h, ws.id, Some(&alice), read_of("private_task", task))
            .await
            .ok();
    assert_eq!(allowed.authorization_epoch.get(), 1);

    // The administrator (manage_membership, Engagement member) and an
    // Engagement member with a grant: not_the_creator, nothing else.
    let mut forbidden = Vec::new();
    for who in [&ws.admin, &bob] {
        for action in ["read", "export", "manage_membership", "share"] {
            let response = access_check(
                &h,
                ws.id,
                Some(who),
                json!({"action": action, "resource": {"kind": "private_task", "resource_id": task}}),
            )
            .await;
            assert_refused(&response, DenyReason::NotTheCreator);
            forbidden.push(response.body);
        }
    }
    // Unknown resource: the same answer as the forbidden one.
    let unknown = access_check(
        &h,
        ws.id,
        Some(&bob),
        read_of("private_task", Uuid::new_v4()),
    )
    .await;
    assert_refused(&unknown, DenyReason::NotTheCreator);
    assert_eq!(unknown.body, forbidden[4]);
    // A shared resource ID asked about as a private Task is unknown too.
    let shared = Uuid::new_v4();
    seed_resource(&h, ws.id, shared, "shared_resource", bob.principal_id, None).await;
    let response = access_check(&h, ws.id, Some(&bob), read_of("private_task", shared)).await;
    assert_eq!(response.body, unknown.body);

    assert_no_disclosure(
        &h,
        &[
            task.to_string(),
            shared.to_string(),
            engagement.to_string(),
            "Shared engagement".to_string(),
            alice.principal_id.to_string(),
        ],
    );
    h.finish().await;
}

// Matrix: Grant needed; Unknown resource.
#[tokio::test(flavor = "multi_thread")]
async fn a_shared_resource_needs_an_exact_grant_and_unknown_looks_forbidden() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Grant Co", "ada").await;
    let bob = join(&h, &ws, "bob", &["auditor"]).await;
    let rita = join(&h, &ws, "rita", &["reviewer"]).await;
    let resource = Uuid::new_v4();
    seed_resource(
        &h,
        ws.id,
        resource,
        "shared_resource",
        ws.admin.principal_id,
        None,
    )
    .await;

    let no_grant = access_check(&h, ws.id, Some(&bob), read_of("shared_resource", resource)).await;
    assert_refused(&no_grant, DenyReason::NoGrant);
    let unknown = access_check(
        &h,
        ws.id,
        Some(&bob),
        read_of("shared_resource", Uuid::new_v4()),
    )
    .await;
    assert_eq!(
        (unknown.status, &unknown.body),
        (no_grant.status, &no_grant.body)
    );
    // The creator has no implicit grant either.
    let response = access_check(
        &h,
        ws.id,
        Some(&ws.admin),
        read_of("shared_resource", resource),
    )
    .await;
    assert_refused(&response, DenyReason::NoGrant);

    seed_grant(&h, ws.id, resource, Some(bob.principal_id), &["read"]).await;
    access_check(&h, ws.id, Some(&bob), read_of("shared_resource", resource))
        .await
        .ok::<AccessCheckResponse>();
    // Exactly that action.
    let derive = access_check(
        &h,
        ws.id,
        Some(&bob),
        json!({"action": "derive", "resource": {"kind": "shared_resource", "resource_id": resource}}),
    )
    .await;
    assert_refused(&derive, DenyReason::NoGrant);
    // A role that lacks the action is refused before any resource lookup.
    let share = access_check(
        &h,
        ws.id,
        Some(&rita),
        json!({"action": "share", "resource": {"kind": "shared_resource", "resource_id": resource}}),
    )
    .await;
    assert_refused(&share, DenyReason::RoleLacksAction);

    // A team grant reaches audit_team roles, not reviewers.
    let team = Uuid::new_v4();
    seed_resource(
        &h,
        ws.id,
        team,
        "shared_resource",
        ws.admin.principal_id,
        None,
    )
    .await;
    seed_grant(&h, ws.id, team, None, &["read"]).await;
    access_check(&h, ws.id, Some(&bob), read_of("shared_resource", team))
        .await
        .ok::<AccessCheckResponse>();
    let response = access_check(&h, ws.id, Some(&rita), read_of("shared_resource", team)).await;
    assert_refused(&response, DenyReason::NoGrant);

    // Removal takes effect at once: bob's grant no longer reaches him.
    let revision = membership_revision(&h, ws.id, bob.principal_id).await;
    command(
        &h,
        ws.id,
        &ws.admin,
        "op-remove-bob",
        revision,
        json!({"command": "remove_member", "principal_id": bob.principal_id}),
    )
    .await
    .ok::<CommandResponse>();
    let response = access_check(&h, ws.id, Some(&bob), read_of("shared_resource", resource)).await;
    assert_refused(&response, DenyReason::NotAMember);

    assert_no_disclosure(
        &h,
        &[resource.to_string(), team.to_string(), ws.name.clone()],
    );
    h.finish().await;
}

// Workspace-level refusals: not signed in, not a member, unknown Workspace.
#[tokio::test(flavor = "multi_thread")]
async fn non_members_and_unknown_workspaces_get_the_same_refusal() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Members Co", "ada").await;
    let other = workspace_with_admin(&h, "Other Co", "otto").await;
    let response = access_check(&h, ws.id, None, json!({"action": "read"})).await;
    assert_refused(&response, DenyReason::NotSignedIn);
    let response = h
        .get(
            &format!("/v1/workspaces/{}/roles", ws.id),
            Some("iqa_not-a-credential"),
        )
        .await;
    assert_refused(&response, DenyReason::NotSignedIn);

    let outsider = &other.admin;
    let not_member = access_check(&h, ws.id, Some(outsider), json!({"action": "read"})).await;
    assert_refused(&not_member, DenyReason::NotAMember);
    let unknown = access_check(
        &h,
        Uuid::new_v4(),
        Some(outsider),
        json!({"action": "read"}),
    )
    .await;
    assert_eq!(
        (unknown.status, &unknown.body),
        (not_member.status, &not_member.body)
    );
    let roles = h
        .get(
            &format!("/v1/workspaces/{}/roles", ws.id),
            Some(outsider.access_credential.expose()),
        )
        .await;
    assert_refused(&roles, DenyReason::NotAMember);
    let command_response = command(
        &h,
        ws.id,
        outsider,
        "op-outsider",
        0,
        json!({"command": "create_engagement", "name": "x"}),
    )
    .await;
    assert_refused(&command_response, DenyReason::NotAMember);
    // A resource check by a non-member reveals nothing about the resource.
    let task = Uuid::new_v4();
    seed_resource(&h, ws.id, task, "private_task", outsider.principal_id, None).await;
    let response = access_check(&h, ws.id, Some(outsider), read_of("private_task", task)).await;
    assert_eq!(response.body, not_member.body);
    // Malformed path IDs get the fixed contract error.
    h.get(
        "/v1/workspaces/not-a-uuid/roles",
        Some(outsider.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::UnsupportedContract);

    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(outsider.access_credential.expose()))
        .await
        .ok();
    let names: Vec<&str> = view.workspaces.iter().map(|w| w.name.as_str()).collect();
    assert_eq!(names, ["Other Co"]);
    assert_no_disclosure(&h, &[ws.id.to_string(), ws.name.clone(), task.to_string()]);
    h.finish().await;
}

// ---- External audit and roles ----------------------------------------------------

// Matrix: External audit.
#[tokio::test(flavor = "multi_thread")]
async fn an_external_audit_workspace_is_route_not_available() {
    let h = Harness::start().await;
    let erin = h.sign_in("erin").await;
    let workspace_id = Uuid::new_v4();
    // Only fixtures can make one: the operator CLI refuses the kind.
    sqlx::query(
        "INSERT INTO workspaces (workspace_id, name, kind, policy_revision, authorization_epoch, \
         revision, created_at, updated_at) VALUES ($1, 'Client Engagement Ltd', 'external_audit', 1, 1, 1, now(), now())",
    )
    .bind(workspace_id)
    .execute(&h.pool)
    .await
    .expect("seed workspace");
    sqlx::query(
        "INSERT INTO workspace_policies (workspace_id, policy_revision, document, created_at) \
         VALUES ($1, 1, $2, now())",
    )
    .bind(workspace_id)
    .bind(serde_json::from_str::<Value>(&policy_text()).expect("policy"))
    .execute(&h.pool)
    .await
    .expect("seed policy");
    sqlx::query(
        "INSERT INTO memberships (workspace_id, principal_id, status, roles, policy_revision, \
         revision, created_at, updated_at) VALUES ($1, $2, 'active', '{audit_lead}', 1, 1, now(), now())",
    )
    .bind(workspace_id)
    .bind(erin.principal_id)
    .execute(&h.pool)
    .await
    .expect("seed membership");
    let invite_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO invites (invite_id, workspace_id, issuer, subject, roles, policy_revision, \
         operator_receipt_id, state, revision, created_at, expires_at) \
         VALUES ($1, $2, $3, 'erin', '{auditor}', 1, $4, 'pending', 1, now(), $5)",
    )
    .bind(invite_id)
    .bind(workspace_id)
    .bind(h.issuer.issuer())
    .bind(Uuid::new_v4())
    .bind(h.now() + TimeDelta::days(1))
    .execute(&h.pool)
    .await
    .expect("seed invite");

    let response = h
        .get(
            &format!("/v1/workspaces/{workspace_id}/roles"),
            Some(erin.access_credential.expose()),
        )
        .await;
    assert_refused(&response, DenyReason::RouteNotAvailable);
    let response = access_check(&h, workspace_id, Some(&erin), json!({"action": "read"})).await;
    assert_refused(&response, DenyReason::RouteNotAvailable);
    let response = command(
        &h,
        workspace_id,
        &erin,
        "op-external",
        0,
        json!({"command": "create_engagement", "name": "x"}),
    )
    .await;
    assert_refused(&response, DenyReason::RouteNotAvailable);
    let view: WorkspacesView = h
        .get("/v1/workspaces", Some(erin.access_credential.expose()))
        .await
        .ok();
    assert!(view.workspaces.is_empty());
    let memberships: MembershipsView = h
        .get("/v1/memberships", Some(erin.access_credential.expose()))
        .await
        .ok();
    assert!(memberships.memberships.is_empty());
    // An invite into it is refused like an unknown invite.
    let unknown = accept(&h, Uuid::new_v4(), &erin).await;
    let response = accept(&h, invite_id, &erin).await;
    assert_eq!(
        (response.status, &response.body),
        (unknown.status, &unknown.body)
    );
    // update-policy refuses it too.
    assert!(matches!(
        admin::update_policy(
            &h.pool,
            admin::UpdatePolicy {
                workspace_id,
                policy: policy_text(),
                operator: "ops".to_string()
            },
            h.now()
        )
        .await,
        Err(AdminError::RouteNotAvailable(_))
    ));
    assert_no_disclosure(
        &h,
        &[
            "Client Engagement Ltd".to_string(),
            workspace_id.to_string(),
        ],
    );
    h.finish().await;
}

// Matrix: Roles list.
#[tokio::test(flavor = "multi_thread")]
async fn the_roles_list_has_only_audit_team_and_reviewer_roles() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Roles Co", "ada").await;
    let rita = join(&h, &ws, "rita", &["reviewer"]).await;
    for who in [&ws.admin, &rita] {
        let view: RolesView = h
            .get(
                &format!("/v1/workspaces/{}/roles", ws.id),
                Some(who.access_credential.expose()),
            )
            .await
            .ok();
        assert_eq!(view.workspace_id, ws.id);
        assert_eq!(view.policy_revision.get(), 1);
        let ids: Vec<&str> = view.roles.iter().map(|r| r.role_id.as_str()).collect();
        assert_eq!(ids, ["audit_lead", "auditor", "reviewer"]);
        assert!(
            view.roles
                .iter()
                .all(|r| matches!(r.kind, RoleKind::AuditTeam | RoleKind::Reviewer))
        );
        let raw = h
            .get(
                &format!("/v1/workspaces/{}/roles", ws.id),
                Some(who.access_credential.expose()),
            )
            .await;
        assert!(!raw.body.to_string().contains("guest"));
    }
    // No stored policy, however it got there, can serve a guest role: a stored
    // document that no longer validates fails closed.
    sqlx::query(
        "UPDATE workspace_policies SET document = jsonb_set(document, '{roles,2,kind}', '\"guest\"') \
         WHERE workspace_id = $1",
    )
    .bind(ws.id)
    .execute(&h.pool)
    .await
    .expect("corrupt the policy");
    h.get(
        &format!("/v1/workspaces/{}/roles", ws.id),
        Some(rita.access_credential.expose()),
    )
    .await
    .assert_error(ErrorKind::DependencyUnavailable);
    h.finish().await;
}

// ---- Story 1.18: the Workspace execution policy ------------------------------------

async fn execution_view(h: &Harness, ws: Uuid, who: &SessionCredentials) -> Response {
    h.get(
        &format!("/v1/workspaces/{ws}/execution-policy"),
        Some(who.access_credential.expose()),
    )
    .await
}

async fn update_policy(
    h: &Harness,
    ws: Uuid,
    policy: String,
) -> Result<admin::UpdatePolicyOutcome, AdminError> {
    admin::update_policy(
        &h.pool,
        admin::UpdatePolicy {
            workspace_id: ws,
            policy,
            operator: "test-operator".to_string(),
        },
        h.now(),
    )
    .await
}

// Matrix: No policy, Workspace restricts, Non-admin edit, Bad policy.
#[tokio::test(flavor = "multi_thread")]
async fn the_execution_policy_is_changed_by_the_operator_and_read_by_members() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Execution Co", "ada").await;
    let rita = join(&h, &ws, "rita", &["reviewer"]).await;

    // No `execution` section: members read `null`, so the default applies.
    let view: ExecutionPolicyView = execution_view(&h, ws.id, &rita).await.ok();
    assert_eq!(view.workspace_id, ws.id);
    assert_eq!(view.policy_revision.get(), 1);
    assert_eq!(view.execution, None);
    let epoch_before = epoch_of(&h, ws.id).await;
    assert_eq!(
        i64::try_from(view.authorization_epoch.get()).expect("epoch"),
        epoch_before
    );

    // The operator update stores a new revision and increments the epoch.
    let outcome = update_policy(
        &h,
        ws.id,
        policy_with(|policy| {
            policy["execution"] = json!({ "sandbox": "read_only", "allow_full_access": false });
        }),
    )
    .await
    .expect("operator updates the policy");
    assert_eq!(outcome.policy_revision, "2");
    let epoch_after = epoch_of(&h, ws.id).await;
    assert_eq!(epoch_after, epoch_before + 1);
    assert_eq!(outcome.authorization_epoch, epoch_after.to_string());
    for who in [&ws.admin, &rita] {
        let view: ExecutionPolicyView = execution_view(&h, ws.id, who).await.ok();
        assert_eq!(view.policy_revision.get(), 2);
        assert_eq!(
            i64::try_from(view.authorization_epoch.get()).expect("epoch"),
            epoch_after
        );
        let execution = view.execution.expect("an execution section");
        assert_eq!(execution.sandbox, Some(SandboxCeiling::ReadOnly));
        assert_eq!(execution.allow_full_access, Some(false));
        assert_eq!(execution.network, None);
    }

    // Bad policies are refused and change nothing.
    for (execution, expected) in [
        (
            json!({ "sandbox": "read_only", "hosted_sandbox": true }),
            "unknown",
        ),
        (json!({ "client_reviewer": true }), "route"),
        (
            json!({ "sandbox": "workspace_write", "allow_full_access": true }),
            "execution",
        ),
        (json!({ "approvals": ["never"] }), "execution"),
        (
            json!({ "command_rules": [{ "prefix": ["rm", "*"], "decision": "forbid" }] }),
            "execution",
        ),
    ] {
        let result = update_policy(
            &h,
            ws.id,
            policy_with(|policy| policy["execution"] = execution.clone()),
        )
        .await;
        match (expected, result) {
            ("unknown", Err(AdminError::Policy(error))) => {
                assert!(error.to_string().contains("hosted_sandbox"), "{error}");
            }
            ("route", Err(AdminError::RouteNotAvailable(_))) => {}
            ("execution", Err(AdminError::Policy(error))) => {
                assert!(error.to_string().contains("execution policy"), "{error}");
            }
            (expected, other) => panic!("{execution} expected {expected}, got {other:?}"),
        }
    }
    assert_eq!(epoch_of(&h, ws.id).await, epoch_after);
    let view: ExecutionPolicyView = execution_view(&h, ws.id, &rita).await.ok();
    assert_eq!(view.policy_revision.get(), 2);

    // No member, administrator or not, can change the policy over HTTP.
    for (who, op) in [(&rita, "op-policy-member"), (&ws.admin, "op-policy-admin")] {
        command(
            &h,
            ws.id,
            who,
            op,
            0,
            json!({ "command": "update_policy", "policy": { "execution": { "allow_full_access": true } } }),
        )
        .await
        .assert_error(ErrorKind::UnsupportedContract);
    }
    assert_eq!(epoch_of(&h, ws.id).await, epoch_after);

    // Non-members and bad credentials get the Story 1.11 refusals.
    let other = workspace_with_admin(&h, "Other Execution Co", "otto").await;
    assert_refused(
        &execution_view(&h, ws.id, &other.admin).await,
        DenyReason::NotAMember,
    );
    let response = h
        .get(
            &format!("/v1/workspaces/{}/execution-policy", ws.id),
            Some("iqa_not-a-credential"),
        )
        .await;
    assert_refused(&response, DenyReason::NotSignedIn);
    h.finish().await;
}

#[tokio::test]
async fn members_read_the_command_rules_and_the_reviewer_switch() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Rules Co", "ada").await;
    let rita = join(&h, &ws, "rita", &["reviewer"]).await;
    update_policy(
        &h,
        ws.id,
        policy_with(|policy| {
            policy["execution"] = json!({
                "network": "allowed",
                "allowed_domains": ["api.example.com"],
                "command_rules": [
                    { "prefix": ["git", "push"], "decision": "prompt", "note": "Leaves this device" },
                    { "prefix": ["rm"], "decision": "forbid" },
                ],
                "automatic_permission_review": true,
            });
        }),
    )
    .await
    .expect("operator updates the policy");
    let view: ExecutionPolicyView = execution_view(&h, ws.id, &rita).await.ok();
    let execution = view.execution.expect("an execution section");
    assert_eq!(
        execution.allowed_domains,
        Some(vec!["api.example.com".to_string()])
    );
    assert_eq!(execution.automatic_permission_review, Some(true));
    let rules = execution.command_rules.expect("command rules");
    assert_eq!(rules.len(), 2);
    assert_eq!(rules[0].prefix, vec!["git".to_string(), "push".to_string()]);
    assert_eq!(
        rules[0].decision,
        inquello_protocol::workspace::RuleDecision::Prompt
    );
    assert_eq!(rules[0].note.as_deref(), Some("Leaves this device"));
    assert_eq!(
        rules[1].decision,
        inquello_protocol::workspace::RuleDecision::Forbid
    );
}

#[tokio::test]
async fn members_read_whether_local_mcp_servers_are_allowed() {
    let h = Harness::start().await;
    let ws = workspace_with_admin(&h, "Local MCP Co", "ada").await;
    let rita = join(&h, &ws, "rita", &["reviewer"]).await;
    // Refused without MCP tools allowed: the policy is unchanged.
    let refused = update_policy(
        &h,
        ws.id,
        policy_with(|policy| {
            policy["execution"] = json!({ "allow_local_mcp_servers": true });
        }),
    )
    .await;
    assert!(
        refused.is_err(),
        "a local MCP flag without MCP tools must be refused"
    );
    let before: ExecutionPolicyView = execution_view(&h, ws.id, &rita).await.ok();
    assert_eq!(before.execution, None);
    update_policy(
        &h,
        ws.id,
        policy_with(|policy| {
            policy["execution"] = json!({ "mcp_tools": "allowed", "allow_local_mcp_servers": true });
        }),
    )
    .await
    .expect("operator updates the policy");
    let view: ExecutionPolicyView = execution_view(&h, ws.id, &rita).await.ok();
    let execution = view.execution.expect("an execution section");
    assert_eq!(execution.allow_local_mcp_servers, Some(true));
    assert_eq!(
        execution.mcp_tools,
        Some(inquello_protocol::workspace::Access::Allowed)
    );
}
