//! Story 1.31: fresh verified identities may own ONLY a newly created workspace.
//! No email account linking. Principal lock serializes operations and receipts.
use crate::sessions::{Authenticated, LockMode};
use crate::{
    commands::current_epoch, digest::request_digest, error::ApiError, server::AppState, sessions,
    workspaces,
};
use chrono::{DateTime, TimeDelta, Utc};
use inquello_domain::{
    OperationId,
    authorization::{Action, WorkspacePolicy},
};
use inquello_protocol::{
    SCHEMA_VERSION,
    command::{CommandResponse, CommandStatus},
    onboarding::*,
};
use sqlx::{PgConnection, Row, types::Json};
use uuid::Uuid;

/// A refresh cannot renew these immutable issuer proof times. No clock skew is
/// added to a grant: expired/future/stale proof always requires hosted sign-in.
pub(crate) async fn fresh_email(
    conn: &mut PgConnection,
    auth: &Authenticated,
    now: DateTime<Utc>,
) -> Result<(String, String), ApiError> {
    let row = sqlx::query("SELECT issuer, verified_email, email_proof_issued_at, email_proof_expires_at FROM sessions WHERE session_id = $1")
        .bind(auth.session_id).fetch_one(&mut *conn).await?;
    let email: Option<String> = row.try_get("verified_email")?;
    let issued: Option<DateTime<Utc>> = row.try_get("email_proof_issued_at")?;
    let expires: Option<DateTime<Utc>> = row.try_get("email_proof_expires_at")?;
    match (email, issued, expires) {
        (Some(email), Some(issued), Some(expires))
            if issued <= now && now < expires && now - issued < TimeDelta::minutes(10) =>
        {
            Ok((row.try_get("issuer")?, email))
        }
        _ => Err(ApiError::denied("fresh verified identity required")),
    }
}

fn initial_policy() -> Result<serde_json::Value, ApiError> {
    // Membership authority is not sharing, export, tool or real-data authority.
    let value = serde_json::json!({
        "policy_version": 1,
        "roles": [
            {"id":"owner","kind":"audit_team","label":"Owner","actions":["read","derive","comment","manage_membership"]},
            {"id":"member","kind":"audit_team","label":"Member","actions":["read","derive","comment"]},
            {"id":"reviewer","kind":"reviewer","label":"Reviewer","actions":["read","comment","submit_review","issue_notes"]}
        ],
        "execution": {
            "sandbox":"read_only","approvals":["untrusted"],"network":"denied",
            "mcp_tools":"denied","extensions":"denied","allow_full_access":false,
            "allow_no_prompt":false,"automatic_permission_review":false,"allow_local_mcp_servers":false
        }
    });
    WorkspacePolicy::parse(&value.to_string())
        .map(|p| p.to_value())
        .map_err(|_| ApiError::unsupported_contract("initial policy invalid"))
}

async fn recorded(
    conn: &mut PgConnection,
    auth: &Authenticated,
    operation: &str,
) -> Result<Option<(String, CommandResponse)>, ApiError> {
    let row = sqlx::query("SELECT request_digest, response FROM operation_receipts WHERE principal_id=$1 AND scope_kind='principal' AND scope_id=$1 AND operation_id=$2 AND command IN ('create_workspace','accept_invitation')")
        .bind(auth.principal_id).bind(operation).fetch_optional(&mut *conn).await?;
    match row {
        None => Ok(None),
        Some(row) => {
            let Json(response): Json<CommandResponse> = row.try_get("response")?;
            // Revoked members cannot recover workspace metadata through receipts.
            workspaces::resolve(conn, auth, response.resource_id, LockMode::Share)
                .await?
                .require_member()?;
            Ok(Some((row.try_get("request_digest")?, response)))
        }
    }
}

pub(crate) async fn receipt(
    state: &AppState,
    access: &str,
    operation: &str,
) -> Result<Option<CommandResponse>, ApiError> {
    OperationId::parse(operation)
        .map_err(|_| ApiError::unsupported_contract("invalid operation ID"))?;
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    let response = recorded(&mut tx, &auth, operation)
        .await?
        .map(|(_, response)| response);
    tx.commit().await?;
    Ok(response)
}

pub(crate) async fn command(
    state: &AppState,
    access: &str,
    envelope: OnboardingCommandEnvelope,
) -> Result<CommandResponse, ApiError> {
    let operation = OperationId::parse(&envelope.operation_id)
        .map_err(|_| ApiError::unsupported_contract("invalid operation ID"))?;
    let digest = request_digest(
        &serde_json::to_value(&envelope)
            .map_err(|_| ApiError::unsupported_contract("invalid envelope"))?,
    );
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Update,
        LockMode::Share,
    )
    .await?;
    if envelope.command_epoch != current_epoch(&mut tx, true).await?
        || envelope.schema_version != SCHEMA_VERSION
    {
        return Err(ApiError::unsupported_contract(
            "unsupported command contract",
        ));
    }
    if let Some((saved_digest, response)) = recorded(&mut tx, &auth, operation.as_str()).await? {
        if digest != saved_digest {
            return Err(ApiError::version_conflict("operation ID reused"));
        }
        tx.commit().await?;
        return Ok(response);
    }
    // Do not collide with principal-scoped session command operations.
    let used: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM operation_receipts WHERE principal_id=$1 AND scope_kind='principal' AND scope_id=$1 AND operation_id=$2)")
        .bind(auth.principal_id).bind(operation.as_str()).fetch_one(&mut *tx).await?;
    if used {
        return Err(ApiError::version_conflict("operation ID reused"));
    }
    let now = state.clock.now();
    let (issuer, email) = fresh_email(&mut tx, &auth, now).await?;
    let (workspace_id, revision, epoch) = match &envelope.payload {
        OnboardingCommand::CreateWorkspace { name } => {
            if envelope.expected_revision.get() != 0
                || name.trim().is_empty()
                || name.chars().count() > 200
                || name.chars().any(char::is_control)
            {
                return Err(ApiError::unsupported_contract("invalid workspace creation"));
            }
            let id = Uuid::new_v4();
            sqlx::query("INSERT INTO workspaces (workspace_id,name,kind,policy_revision,authorization_epoch,revision,created_at,updated_at,onboarding_created) VALUES ($1,$2,'internal_company',1,1,1,$3,$3,true)")
                .bind(id).bind(name.trim()).bind(now).execute(&mut *tx).await?;
            sqlx::query("INSERT INTO workspace_policies (workspace_id,policy_revision,document,created_at) VALUES ($1,1,$2,$3)")
                .bind(id).bind(initial_policy()?).bind(now).execute(&mut *tx).await?;
            sqlx::query("INSERT INTO memberships (workspace_id,principal_id,status,roles,policy_revision,revision,created_at,updated_at) VALUES ($1,$2,'active',ARRAY['owner'],1,1,$3,$3)")
                .bind(id).bind(auth.principal_id).bind(now).execute(&mut *tx).await?;
            (id, 1, 1)
        }
        OnboardingCommand::AcceptInvitation { invite_id } => {
            // Locate only by opaque ID, then lock workspace before invite. All
            // wrong-account, expired, revoked and missing cases are identical.
            let unavailable = || ApiError::denied("invitation unavailable");
            let workspace_id: Uuid =
                sqlx::query_scalar("SELECT workspace_id FROM invites WHERE invite_id=$1")
                    .bind(invite_id)
                    .fetch_optional(&mut *tx)
                    .await?
                    .ok_or_else(unavailable)?;
            let workspace = workspaces::lock_workspace(&mut tx, workspace_id, LockMode::Update)
                .await?
                .ok_or_else(unavailable)?;
            if !workspace
                .kind
                .is_some_and(inquello_domain::authorization::WorkspaceKind::is_enabled)
            {
                return Err(unavailable());
            }
            let invite = sqlx::query("SELECT issuer,recipient_email,roles,state,revision,expires_at,issued_by,policy_revision FROM invites WHERE invite_id=$1 FOR UPDATE")
                .bind(invite_id).fetch_one(&mut *tx).await?;
            let locked_now = state.clock.now();
            // Recheck proof after any lock wait, not just at request entry.
            fresh_email(&mut tx, &auth, locked_now).await?;
            if invite.try_get::<String, _>("issuer")? != issuer
                || invite
                    .try_get::<Option<String>, _>("recipient_email")?
                    .as_deref()
                    != Some(email.as_str())
                || invite.try_get::<String, _>("state")? != "pending"
                || invite.try_get::<DateTime<Utc>, _>("expires_at")? <= locked_now
            {
                return Err(unavailable());
            }
            if workspaces::revision(invite.try_get("revision")?)? != envelope.expected_revision {
                return Err(ApiError::version_conflict("invitation revision changed"));
            }
            let policy =
                workspaces::load_policy(&mut tx, workspace_id, workspace.policy_revision).await?;
            if invite.try_get::<i64, _>("policy_revision")? != workspace.policy_revision {
                return Err(unavailable());
            }
            let grantor: Uuid = invite
                .try_get::<Option<Uuid>, _>("issued_by")?
                .ok_or_else(unavailable)?;
            if !workspaces::membership(&mut tx, workspace_id, grantor, Some(LockMode::Share))
                .await?
                .is_some_and(|m| m.active && policy.permits(&m.roles, Action::ManageMembership))
            {
                return Err(unavailable());
            }
            let grantor_active: bool =
                sqlx::query_scalar("SELECT status='active' FROM principals WHERE principal_id=$1")
                    .bind(grantor)
                    .fetch_one(&mut *tx)
                    .await?;
            if !grantor_active {
                return Err(unavailable());
            }
            let roles: Vec<String> = invite.try_get("roles")?;
            if roles.is_empty() || roles.iter().any(|role| policy.role(role).is_none()) {
                return Err(unavailable());
            }
            if workspaces::membership(
                &mut tx,
                workspace_id,
                auth.principal_id,
                Some(LockMode::Update),
            )
            .await?
            .is_some_and(|m| m.active)
            {
                return Err(ApiError::version_conflict("already a member"));
            }
            let rev: i64 = sqlx::query_scalar("INSERT INTO memberships (workspace_id,principal_id,status,roles,policy_revision,revision,created_at,updated_at) VALUES ($1,$2,'active',$3,$4,1,$5,$5) ON CONFLICT(workspace_id,principal_id) DO UPDATE SET status='active',roles=EXCLUDED.roles,policy_revision=EXCLUDED.policy_revision,revision=memberships.revision+1,updated_at=EXCLUDED.updated_at RETURNING revision")
                .bind(workspace_id).bind(auth.principal_id).bind(roles).bind(workspace.policy_revision).bind(locked_now).fetch_one(&mut *tx).await?;
            sqlx::query("UPDATE invites SET state='accepted',accepted_by=$2,closed_at=$3,revision=revision+1 WHERE invite_id=$1")
                .bind(invite_id).bind(auth.principal_id).bind(locked_now).execute(&mut *tx).await?;
            let epoch = crate::workspace_commands::increment_epoch(
                &mut tx,
                workspace_id,
                "member_joined",
                Some(auth.principal_id),
                locked_now,
            )
            .await?;
            (workspace_id, rev, epoch)
        }
    };
    let response = CommandResponse {
        operation_id: operation.as_str().to_owned(),
        resource_id: workspace_id,
        revision: workspaces::revision(revision)?,
        authorization_epoch: Some(workspaces::revision(epoch)?),
        status: CommandStatus::Applied,
        receipt_id: Uuid::new_v4(),
    };
    let epoch = i64::try_from(envelope.command_epoch.get())
        .map_err(|_| ApiError::unsupported_contract("epoch out of range"))?;
    sqlx::query("INSERT INTO operation_receipts (receipt_id,principal_id,scope_kind,scope_id,operation_id,command_epoch,command,request_digest,response,recorded_at) VALUES ($1,$2,'principal',$2,$3,$4,$5,$6,$7,$8)")
        .bind(response.receipt_id).bind(auth.principal_id).bind(operation.as_str()).bind(epoch)
        .bind(envelope.payload.name()).bind(digest).bind(Json(&response)).bind(state.clock.now()).execute(&mut *tx).await?;
    // Every potentially blocking grant/write lock is now held. Expiry during
    // a wait rolls back the mutation and receipt together.
    let final_auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Update,
        LockMode::Share,
    )
    .await?;
    fresh_email(&mut tx, &final_auth, state.clock.now()).await?;
    tx.commit().await.map_err(|e| ApiError::uncertain(&e))?;
    Ok(response)
}

pub(crate) async fn invitations(
    state: &AppState,
    access: &str,
) -> Result<InvitationsView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    let (issuer, email) = fresh_email(&mut tx, &auth, state.clock.now()).await?;
    let rows = sqlx::query("SELECT i.invite_id,i.workspace_id,w.name,i.roles,i.revision,i.expires_at FROM invites i JOIN workspaces w USING(workspace_id) WHERE i.issuer=$1 AND i.recipient_email=$2 AND i.state='pending' AND i.expires_at>$3 AND w.kind='internal_company' ORDER BY i.created_at,i.invite_id LIMIT 100")
        .bind(issuer).bind(email).bind(state.clock.now()).fetch_all(&mut *tx).await?;
    let mut invitations = Vec::new();
    for row in rows {
        let workspace_id: Uuid = row.try_get("workspace_id")?;
        let Some(workspace) =
            workspaces::lock_workspace(&mut tx, workspace_id, LockMode::Share).await?
        else {
            continue;
        };
        let invite_id: Uuid = row.try_get("invite_id")?;
        let Some(current) = sqlx::query("SELECT issued_by,roles,policy_revision FROM invites WHERE invite_id=$1 AND state='pending' AND expires_at>$2 FOR SHARE")
            .bind(invite_id).bind(state.clock.now()).fetch_optional(&mut *tx).await? else { continue; };
        let policy =
            workspaces::load_policy(&mut tx, workspace_id, workspace.policy_revision).await?;
        let Some(grantor) = current.try_get::<Option<Uuid>, _>("issued_by")? else {
            continue;
        };
        if !workspaces::membership(&mut tx, workspace_id, grantor, Some(LockMode::Share))
            .await?
            .is_some_and(|m| m.active && policy.permits(&m.roles, Action::ManageMembership))
        {
            continue;
        }
        let active: bool =
            sqlx::query_scalar("SELECT status='active' FROM principals WHERE principal_id=$1")
                .bind(grantor)
                .fetch_one(&mut *tx)
                .await?;
        if !active {
            continue;
        }
        if current.try_get::<i64, _>("policy_revision")? != workspace.policy_revision {
            continue;
        }
        let roles: Vec<String> = current.try_get("roles")?;
        if roles.is_empty() || roles.iter().any(|role| policy.role(role).is_none()) {
            continue;
        }
        fresh_email(&mut tx, &auth, state.clock.now()).await?;
        invitations.push(InvitationView {
            invite_id: row.try_get("invite_id")?,
            workspace_id: row.try_get("workspace_id")?,
            workspace_name: row.try_get("name")?,
            roles: row.try_get("roles")?,
            revision: workspaces::revision(row.try_get("revision")?)?,
            expires_at: row.try_get::<DateTime<Utc>, _>("expires_at")?.to_rfc3339(),
        });
    }
    tx.commit().await?;
    Ok(InvitationsView { invitations })
}

pub(crate) async fn members(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
) -> Result<MembersView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share)
        .await?
        .require(Action::ManageMembership)?;
    let rows = sqlx::query("SELECT m.principal_id,p.display_name,m.roles,m.revision FROM memberships m JOIN principals p USING(principal_id) WHERE m.workspace_id=$1 AND m.status='active' ORDER BY m.created_at,m.principal_id")
        .bind(workspace_id).fetch_all(&mut *tx).await?;
    let mut members = Vec::new();
    for row in rows {
        members.push(MemberView {
            principal_id: row.try_get("principal_id")?,
            display_name: row.try_get("display_name")?,
            roles: row.try_get("roles")?,
            revision: workspaces::revision(row.try_get("revision")?)?,
        });
    }
    tx.commit().await?;
    Ok(MembersView {
        workspace_id,
        members,
    })
}

/// Reconciliation is a read, never a disguised command replay.
pub(crate) async fn workspace_receipt(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
    operation: &str,
) -> Result<Option<CommandResponse>, ApiError> {
    OperationId::parse(operation)
        .map_err(|_| ApiError::unsupported_contract("invalid operation ID"))?;
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share)
        .await?
        .require(Action::ManageMembership)?;
    let saved: Option<Json<CommandResponse>> = sqlx::query_scalar("SELECT response FROM operation_receipts WHERE principal_id=$1 AND scope_kind='workspace' AND scope_id=$2 AND operation_id=$3")
        .bind(auth.principal_id).bind(workspace_id).bind(operation).fetch_optional(&mut *tx).await?;
    tx.commit().await?;
    Ok(saved.map(|Json(response)| response))
}

/// Strict bounded keyset paging. No free-form filters, SQL or cross-workspace
/// cursor lookup. Missing/foreign cursors receive the same safe refusal.
pub(crate) struct InvitationPage {
    limit: u32,
    after: Option<Uuid>,
}
impl InvitationPage {
    pub(crate) fn parse(query: Option<&str>) -> Result<Self, ApiError> {
        let invalid = || ApiError::unsupported_contract("invalid invitation page");
        let query = query.unwrap_or_default();
        if query.len() > 256 {
            return Err(invalid());
        }
        let mut limit = None;
        let mut after = None;
        for (name, value) in url::form_urlencoded::parse(query.as_bytes()) {
            match name.as_ref() {
                "limit" if limit.is_none() => {
                    if value.is_empty() || !value.bytes().all(|b| b.is_ascii_digit()) {
                        return Err(invalid());
                    }
                    let n = value.parse::<u32>().map_err(|_| invalid())?;
                    if !(1..=100).contains(&n) {
                        return Err(invalid());
                    }
                    limit = Some(n);
                }
                "after" if after.is_none() => {
                    after = Some(Uuid::parse_str(&value).map_err(|_| invalid())?);
                }
                _ => return Err(invalid()),
            }
        }
        Ok(Self {
            limit: limit.unwrap_or(25),
            after,
        })
    }
}

pub(crate) async fn managed_invitations(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
    page: InvitationPage,
) -> Result<ManagedInvitationsView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    // Keep principal/session/workspace authority locks until projection commits.
    // Removal/change_roles committing before this lock is observed; a later
    // change waits for the read. No network I/O occurs under these DB locks.
    workspaces::resolve(&mut tx, &auth, workspace_id, LockMode::Share)
        .await?
        .require(Action::ManageMembership)?;
    if let Some(after) = page.after {
        let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM invites WHERE workspace_id=$1 AND invite_id=$2 AND recipient_email IS NOT NULL)")
            .bind(workspace_id).bind(after).fetch_one(&mut *tx).await?;
        if !exists {
            return Err(ApiError::denied("invitation unavailable"));
        }
    }
    let rows=sqlx::query("SELECT invite_id,revision,state,expires_at,roles,recipient_email FROM invites WHERE workspace_id=$1 AND recipient_email IS NOT NULL AND ($2::uuid IS NULL OR invite_id>$2) ORDER BY invite_id LIMIT $3")
        .bind(workspace_id).bind(page.after).bind(i64::from(page.limit)+1).fetch_all(&mut *tx).await?;
    let has_more = rows.len() > page.limit as usize;
    let now = state.clock.now();
    let mut invitations = Vec::new();
    for row in rows.into_iter().take(page.limit as usize) {
        let expires: DateTime<Utc> = row.try_get("expires_at")?;
        let status = match row.try_get::<String, _>("state")?.as_str() {
            "pending" if expires <= now => ManagedInvitationState::Expired,
            "pending" => ManagedInvitationState::Pending,
            "accepted" => ManagedInvitationState::Accepted,
            "revoked" => ManagedInvitationState::Revoked,
            _ => {
                return Err(ApiError::unsupported_contract(
                    "unsupported invitation state",
                ));
            }
        };
        invitations.push(ManagedInvitationView {
            invite_id: row.try_get("invite_id")?,
            revision: workspaces::revision(row.try_get("revision")?)?,
            state: status,
            expires_at: expires.to_rfc3339(),
            roles: row.try_get("roles")?,
            recipient_email: row.try_get("recipient_email")?,
        });
    }
    // A lock wait cannot prolong an expired session or disclose stale authority.
    let current = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await?;
    workspaces::resolve(&mut tx, &current, workspace_id, LockMode::Share)
        .await?
        .require(Action::ManageMembership)?;
    let next_cursor = if has_more {
        invitations.last().map(|i| i.invite_id)
    } else {
        None
    };
    tx.commit().await?;
    Ok(ManagedInvitationsView {
        workspace_id,
        invitations,
        next_cursor,
    })
}
