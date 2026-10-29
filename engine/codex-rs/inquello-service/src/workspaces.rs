//! Workspace authority: resolving the caller's membership, policy and Engagement
//! memberships under the Workspace authorization-epoch lock, and the read routes
//! (Workspaces list, roles, access checks) and invite acceptance built on it.
//!
//! Lock order is always principal → session → Workspace (its authorization
//! epoch) → resource. Every decision is made by
//! [`inquello_domain::authorization::decide`] over facts read inside the request
//! transaction while those locks are held, so a removal that commits first is
//! always seen, and one that commits later waits for this request to finish.
//! An unknown Workspace is refused exactly like one the caller is not a member
//! of.

use crate::error::ApiError;
use crate::server::AppState;
use crate::sessions;
use crate::sessions::Authenticated;
use crate::sessions::LockMode;
use inquello_domain::authorization;
use inquello_domain::authorization::AccessRequest;
use inquello_domain::authorization::Action;
use inquello_domain::authorization::AuthorityFacts;
use inquello_domain::authorization::DenyReason;
use inquello_domain::authorization::Grant;
use inquello_domain::authorization::GrantAudience;
use inquello_domain::authorization::MembershipFacts;
use inquello_domain::authorization::ResourceFacts;
use inquello_domain::authorization::ResourceKind;
use inquello_domain::authorization::ResourceRecord;
use inquello_domain::authorization::ResourceRef;
use inquello_domain::authorization::RoleKind;
use inquello_domain::authorization::WorkspaceKind;
use inquello_domain::authorization::WorkspacePolicy;
use inquello_domain::execution_policy::ApprovalBehaviour;
use inquello_domain::execution_policy::ExecutionPolicy;
use inquello_domain::execution_policy::RuleDecision;
use inquello_domain::execution_policy::SandboxLevel;
use inquello_protocol::Revision;
use inquello_protocol::workspace as wire;
use sqlx::PgConnection;
use sqlx::Row;
use std::collections::BTreeSet;
use uuid::Uuid;

pub(crate) fn revision(value: i64) -> Result<Revision, ApiError> {
    u64::try_from(value)
        .map(Revision::new)
        .map_err(|_| ApiError::dependency(&sqlx::Error::Decode("negative revision".into())))
}

pub(crate) fn wire_action(action: Action) -> wire::Action {
    match action {
        Action::Read => wire::Action::Read,
        Action::Derive => wire::Action::Derive,
        Action::Comment => wire::Action::Comment,
        Action::SubmitReview => wire::Action::SubmitReview,
        Action::IssueNotes => wire::Action::IssueNotes,
        Action::Share => wire::Action::Share,
        Action::Export => wire::Action::Export,
        Action::ManageMembership => wire::Action::ManageMembership,
    }
}

fn domain_action(action: wire::Action) -> Action {
    match action {
        wire::Action::Read => Action::Read,
        wire::Action::Derive => Action::Derive,
        wire::Action::Comment => Action::Comment,
        wire::Action::SubmitReview => Action::SubmitReview,
        wire::Action::IssueNotes => Action::IssueNotes,
        wire::Action::Share => Action::Share,
        wire::Action::Export => Action::Export,
        wire::Action::ManageMembership => Action::ManageMembership,
    }
}

/// A Workspace row read under its lock.
pub(crate) struct WorkspaceRow {
    pub(crate) workspace_id: Uuid,
    pub(crate) name: String,
    pub(crate) kind: Option<WorkspaceKind>,
    pub(crate) policy_revision: i64,
    pub(crate) authorization_epoch: i64,
    pub(crate) revision: i64,
}

/// Locks the Workspace row (its authorization epoch). `None` when it does not
/// exist.
pub(crate) async fn lock_workspace(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    mode: LockMode,
) -> Result<Option<WorkspaceRow>, ApiError> {
    let sql = match mode {
        LockMode::Share => {
            "SELECT name, kind, policy_revision, authorization_epoch, revision \
             FROM workspaces WHERE workspace_id = $1 FOR SHARE"
        }
        LockMode::Update => {
            "SELECT name, kind, policy_revision, authorization_epoch, revision \
             FROM workspaces WHERE workspace_id = $1 FOR UPDATE"
        }
    };
    let Some(row) = sqlx::query(sql)
        .bind(workspace_id)
        .fetch_optional(&mut *conn)
        .await?
    else {
        return Ok(None);
    };
    let kind: String = row.try_get("kind")?;
    Ok(Some(WorkspaceRow {
        workspace_id,
        name: row.try_get("name")?,
        kind: WorkspaceKind::parse(&kind),
        policy_revision: row.try_get("policy_revision")?,
        authorization_epoch: row.try_get("authorization_epoch")?,
        revision: row.try_get("revision")?,
    }))
}

/// Loads a stored policy revision. A stored document that no longer validates
/// is treated as an unavailable authority, never as permissive.
pub(crate) async fn load_policy(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    policy_revision: i64,
) -> Result<WorkspacePolicy, ApiError> {
    let document: Option<serde_json::Value> = sqlx::query_scalar(
        "SELECT document FROM workspace_policies WHERE workspace_id = $1 AND policy_revision = $2",
    )
    .bind(workspace_id)
    .bind(policy_revision)
    .fetch_optional(&mut *conn)
    .await?;
    let document = document.ok_or_else(|| {
        ApiError::dependency(&sqlx::Error::Decode("workspace policy missing".into()))
    })?;
    WorkspacePolicy::from_value(&document).map_err(|_| {
        ApiError::dependency(&sqlx::Error::Decode(
            "stored workspace policy invalid".into(),
        ))
    })
}

pub(crate) struct MembershipRow {
    pub(crate) active: bool,
    pub(crate) roles: Vec<String>,
    pub(crate) policy_revision: i64,
    pub(crate) revision: i64,
}

/// Reads (optionally locking) one membership row.
pub(crate) async fn membership(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    principal_id: Uuid,
    lock: Option<LockMode>,
) -> Result<Option<MembershipRow>, ApiError> {
    let sql = match lock {
        None => {
            "SELECT status, roles, policy_revision, revision FROM memberships \
             WHERE workspace_id = $1 AND principal_id = $2"
        }
        Some(LockMode::Share) => {
            "SELECT status, roles, policy_revision, revision FROM memberships \
             WHERE workspace_id = $1 AND principal_id = $2 FOR SHARE"
        }
        Some(LockMode::Update) => {
            "SELECT status, roles, policy_revision, revision FROM memberships \
             WHERE workspace_id = $1 AND principal_id = $2 FOR UPDATE"
        }
    };
    let Some(row) = sqlx::query(sql)
        .bind(workspace_id)
        .bind(principal_id)
        .fetch_optional(&mut *conn)
        .await?
    else {
        return Ok(None);
    };
    let status: String = row.try_get("status")?;
    Ok(Some(MembershipRow {
        active: status == "active",
        roles: row.try_get("roles")?,
        policy_revision: row.try_get("policy_revision")?,
        revision: row.try_get("revision")?,
    }))
}

/// The caller's resolved authority in one Workspace, valid while the enclosing
/// transaction holds the Workspace lock.
pub(crate) struct WorkspaceAuthority {
    pub(crate) principal_id: Uuid,
    pub(crate) workspace: WorkspaceRow,
    pub(crate) policy: WorkspacePolicy,
    pub(crate) membership: Option<MembershipRow>,
    pub(crate) engagements: BTreeSet<Uuid>,
}

impl WorkspaceAuthority {
    pub(crate) fn facts(&self) -> AuthorityFacts<'_> {
        AuthorityFacts {
            principal_id: self.principal_id,
            // The caller passed `sessions::authenticate` in this transaction.
            session_active: true,
            workspace_kind: self.workspace.kind,
            membership: self.membership.as_ref().map(|m| MembershipFacts {
                active: m.active,
                roles: &m.roles,
            }),
            policy: &self.policy,
            engagements: &self.engagements,
        }
    }

    /// Requires an active membership in an enabled Workspace.
    pub(crate) fn require_member(&self) -> Result<(), ApiError> {
        authorization::check_membership(&self.facts()).map_err(ApiError::refused)
    }

    /// Requires a role permitting a Workspace-level `action`.
    pub(crate) fn require(&self, action: Action) -> Result<(), ApiError> {
        authorization::decide(
            &self.facts(),
            AccessRequest {
                action,
                resource: None,
            },
            None,
        )
        .into_result()
        .map_err(ApiError::refused)
    }

    pub(crate) fn epoch(&self) -> Result<Revision, ApiError> {
        revision(self.workspace.authorization_epoch)
    }
}

/// Resolves the caller's authority in `workspace_id`, locking the Workspace row
/// with `mode` (after the principal and session locks `authenticate` took). An
/// unknown Workspace is refused as `not_a_member`, like one without membership.
pub(crate) async fn resolve(
    conn: &mut PgConnection,
    auth: &Authenticated,
    workspace_id: Uuid,
    mode: LockMode,
) -> Result<WorkspaceAuthority, ApiError> {
    let workspace = lock_workspace(conn, workspace_id, mode)
        .await?
        .ok_or_else(|| ApiError::refused(DenyReason::NotAMember))?;
    if !workspace.kind.is_some_and(WorkspaceKind::is_enabled) {
        // Refused before reading anything else about the Workspace (OQ-15).
        return Err(ApiError::refused(DenyReason::RouteNotAvailable));
    }
    let policy = load_policy(conn, workspace_id, workspace.policy_revision).await?;
    let membership = membership(conn, workspace_id, auth.principal_id, None).await?;
    let engagements: Vec<Uuid> = sqlx::query_scalar(
        "SELECT em.engagement_id FROM engagement_memberships em \
         JOIN memberships m ON m.workspace_id = em.workspace_id AND m.principal_id = em.principal_id \
         WHERE em.workspace_id = $1 AND em.principal_id = $2 \
         AND em.status = 'active' AND m.status = 'active'",
    )
    .bind(workspace_id)
    .bind(auth.principal_id)
    .fetch_all(&mut *conn)
    .await?;
    Ok(WorkspaceAuthority {
        principal_id: auth.principal_id,
        workspace,
        policy,
        membership,
        engagements: engagements.into_iter().collect(),
    })
}

/// Parses a path UUID with the fixed contract error, never echoing the input.
pub(crate) fn path_id(value: &str) -> Result<Uuid, ApiError> {
    Uuid::parse_str(value).map_err(|_| ApiError::unsupported_contract("malformed path ID"))
}

// ---- GET /v1/workspaces -----------------------------------------------------

pub(crate) async fn list_workspaces(
    state: &AppState,
    access: &str,
) -> Result<wire::WorkspacesView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await
    .map_err(ApiError::on_workspace_route)?;
    let ids: Vec<Uuid> = sqlx::query_scalar(
        "SELECT workspace_id FROM memberships \
         WHERE principal_id = $1 AND status = 'active' ORDER BY workspace_id",
    )
    .bind(auth.principal_id)
    .fetch_all(&mut *tx)
    .await?;
    let mut workspaces = Vec::new();
    for workspace_id in ids {
        // Only enabled Workspaces where the caller is still an active member,
        // re-read under the Workspace lock. Others are simply not listed.
        let authority = match resolve(&mut tx, &auth, workspace_id, LockMode::Share).await {
            Ok(authority) => authority,
            Err(error) if error.deny.is_some() => continue,
            Err(error) => return Err(error),
        };
        if authority.require_member().is_err() {
            continue;
        }
        let Some(membership) = authority.membership.as_ref() else {
            continue;
        };
        let sees_all = authority.require(Action::ManageMembership).is_ok();
        let rows = sqlx::query(
            "SELECT e.engagement_id, e.name, e.revision FROM engagements e \
             WHERE e.workspace_id = $1 AND ($2 OR e.engagement_id = ANY($3)) \
             ORDER BY e.engagement_id",
        )
        .bind(workspace_id)
        .bind(sees_all)
        .bind(authority.engagements.iter().copied().collect::<Vec<_>>())
        .fetch_all(&mut *tx)
        .await?;
        let engagements = rows
            .iter()
            .map(|row| {
                Ok(wire::EngagementView {
                    engagement_id: row.try_get("engagement_id")?,
                    name: row.try_get("name")?,
                    revision: revision(row.try_get("revision")?)?,
                })
            })
            .collect::<Result<Vec<_>, ApiError>>()?;
        workspaces.push(wire::WorkspaceView {
            workspace_id,
            name: authority.workspace.name.clone(),
            kind: WorkspaceKind::InternalCompany.as_str().to_string(),
            revision: revision(authority.workspace.revision)?,
            authorization_epoch: authority.epoch()?,
            policy_revision: revision(authority.workspace.policy_revision)?,
            membership: wire::MembershipBindingView {
                status: wire::MembershipStatus::Active,
                roles: membership.roles.clone(),
                policy_revision: revision(membership.policy_revision)?,
                revision: revision(membership.revision)?,
            },
            engagements,
        });
    }
    tx.commit().await?;
    Ok(wire::WorkspacesView {
        principal_id: auth.principal_id,
        workspaces,
    })
}

// ---- GET /v1/workspaces/{id}/roles -------------------------------------------

pub(crate) async fn roles(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
) -> Result<wire::RolesView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await
    .map_err(ApiError::on_workspace_route)?;
    let authority = resolve(&mut tx, &auth, workspace_id, LockMode::Share).await?;
    authority.require_member()?;
    let roles = authority
        .policy
        .roles()
        .iter()
        // Validation admits no other kind; this match keeps the listing closed
        // even so.
        .map(|role| wire::RoleView {
            role_id: role.id.as_str().to_string(),
            kind: match role.kind {
                RoleKind::AuditTeam => wire::RoleKind::AuditTeam,
                RoleKind::Reviewer => wire::RoleKind::Reviewer,
            },
            label: role.label.clone(),
            actions: role.actions.iter().copied().map(wire_action).collect(),
        })
        .collect();
    let view = wire::RolesView {
        workspace_id,
        policy_revision: revision(authority.workspace.policy_revision)?,
        roles,
    };
    tx.commit().await?;
    Ok(view)
}

// ---- GET /v1/workspaces/{id}/execution-policy (Story 1.18) -------------------

/// The Workspace execution policy for a member's desktop: the policy revision,
/// the authorization epoch and the validated `execution` section (`None` when
/// the policy has none, so the conservative Inquello default applies).
pub(crate) async fn execution_policy(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
) -> Result<wire::ExecutionPolicyView, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await
    .map_err(ApiError::on_workspace_route)?;
    let authority = resolve(&mut tx, &auth, workspace_id, LockMode::Share).await?;
    authority.require_member()?;
    let view = wire::ExecutionPolicyView {
        workspace_id,
        policy_revision: revision(authority.workspace.policy_revision)?,
        authorization_epoch: authority.epoch()?,
        execution: authority.policy.execution().map(execution_view),
    };
    tx.commit().await?;
    Ok(view)
}

fn execution_view(policy: &ExecutionPolicy) -> wire::ExecutionSection {
    let access = |value: Option<bool>| {
        value.map(|allowed| {
            if allowed {
                wire::Access::Allowed
            } else {
                wire::Access::Denied
            }
        })
    };
    wire::ExecutionSection {
        sandbox: policy.sandbox.map(|level| match level {
            SandboxLevel::ReadOnly => wire::SandboxCeiling::ReadOnly,
            SandboxLevel::WorkspaceWrite => wire::SandboxCeiling::WorkspaceWrite,
            SandboxLevel::FullAccess => wire::SandboxCeiling::FullAccess,
        }),
        approvals: policy.approvals.as_ref().map(|approvals| {
            approvals
                .iter()
                .map(|behaviour| match behaviour {
                    ApprovalBehaviour::Untrusted => wire::ApprovalBehaviour::Untrusted,
                    ApprovalBehaviour::OnRequest => wire::ApprovalBehaviour::OnRequest,
                    ApprovalBehaviour::Never => wire::ApprovalBehaviour::Never,
                })
                .collect()
        }),
        network: access(policy.network),
        mcp_tools: access(policy.mcp_tools),
        extensions: access(policy.extensions),
        allow_full_access: policy.allow_full_access,
        allow_no_prompt: policy.allow_no_prompt,
        allowed_domains: policy.allowed_domains.clone(),
        command_rules: policy.command_rules.as_ref().map(|rules| {
            rules
                .iter()
                .map(|rule| wire::CommandRuleView {
                    prefix: rule.prefix.clone(),
                    decision: match rule.decision {
                        RuleDecision::Allow => wire::RuleDecision::Allow,
                        RuleDecision::Prompt => wire::RuleDecision::Prompt,
                        RuleDecision::Forbid => wire::RuleDecision::Forbid,
                    },
                    note: rule.note.clone(),
                })
                .collect()
        }),
        automatic_permission_review: policy.automatic_permission_review,
    }
}

// ---- POST /v1/workspaces/{id}/access-checks ------------------------------------

/// Reads what the authority holds about one resource (fixture-only until Epic 4)
/// and its grants, under a share lock on the registration.
async fn resource_facts(
    conn: &mut PgConnection,
    workspace_id: Uuid,
    reference: ResourceRef,
) -> Result<(Option<ResourceRecord>, Vec<Grant>), ApiError> {
    let row = sqlx::query(
        "SELECT kind, creator_principal_id, engagement_id FROM resource_registrations \
         WHERE workspace_id = $1 AND resource_id = $2 FOR SHARE",
    )
    .bind(workspace_id)
    .bind(reference.id)
    .fetch_optional(&mut *conn)
    .await?;
    let record = match row {
        None => None,
        Some(row) => {
            let kind: String = row.try_get("kind")?;
            match ResourceKind::parse(&kind) {
                Some(ResourceKind::PrivateTask) => Some(ResourceRecord::PrivateTask {
                    creator: row.try_get("creator_principal_id")?,
                }),
                Some(ResourceKind::SharedResource) => Some(ResourceRecord::SharedResource {
                    engagement_id: row.try_get("engagement_id")?,
                }),
                None => None,
            }
        }
    };
    let rows = sqlx::query(
        "SELECT audience_kind, audience_principal_id, actions, state FROM grants \
         WHERE workspace_id = $1 AND resource_id = $2",
    )
    .bind(workspace_id)
    .bind(reference.id)
    .fetch_all(&mut *conn)
    .await?;
    let mut grants = Vec::with_capacity(rows.len());
    for row in rows {
        let audience_kind: String = row.try_get("audience_kind")?;
        let audience = match audience_kind.as_str() {
            "principal" => {
                let Some(principal) = row.try_get::<Option<Uuid>, _>("audience_principal_id")?
                else {
                    continue;
                };
                GrantAudience::Principal(principal)
            }
            "workspace_audit_team" => GrantAudience::WorkspaceAuditTeam,
            // An audience this domain does not know grants nothing.
            _ => continue,
        };
        let raw: Vec<String> = row.try_get("actions")?;
        let state: String = row.try_get("state")?;
        grants.push(Grant {
            resource_id: reference.id,
            audience,
            // Unknown or administrative actions never become content grants.
            actions: raw
                .iter()
                .filter_map(|action| Action::parse(action))
                .filter(|action| !action.is_administrative())
                .collect(),
            active: state == "active",
        });
    }
    Ok((record, grants))
}

pub(crate) async fn access_check(
    state: &AppState,
    access: &str,
    workspace_id: Uuid,
    request: wire::AccessCheckRequest,
) -> Result<wire::AccessCheckResponse, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Share,
        LockMode::Share,
    )
    .await
    .map_err(ApiError::on_workspace_route)?;
    let authority = resolve(&mut tx, &auth, workspace_id, LockMode::Share).await?;
    let action = domain_action(request.action);
    let reference = request.resource.map(|resource| ResourceRef {
        kind: match resource.kind {
            wire::ResourceKind::PrivateTask => ResourceKind::PrivateTask,
            wire::ResourceKind::SharedResource => ResourceKind::SharedResource,
        },
        id: resource.resource_id,
    });
    // The Workspace-level checks run first so nothing about a resource is read
    // for a caller who is not an active member.
    authority.require_member()?;
    let decision = match reference {
        None => authorization::decide(
            &authority.facts(),
            AccessRequest {
                action,
                resource: None,
            },
            None,
        ),
        Some(reference) => {
            let (record, grants) = resource_facts(&mut tx, workspace_id, reference).await?;
            authorization::decide(
                &authority.facts(),
                AccessRequest {
                    action,
                    resource: Some(reference),
                },
                Some(&ResourceFacts {
                    record,
                    grants: &grants,
                }),
            )
        }
    };
    decision.into_result().map_err(ApiError::refused)?;
    let epoch = authority.epoch()?;
    tx.commit().await?;
    Ok(wire::AccessCheckResponse {
        decision: wire::AccessDecision::Allowed,
        authorization_epoch: epoch,
    })
}

// ---- POST /v1/invites/{id}/accept ----------------------------------------------

/// The one answer for every invite that cannot be accepted: unknown, expired,
/// replayed, revoked, another principal's, a withdrawn grantor or a disabled
/// Workspace kind all look the same.
fn invite_refused(reason: &'static str) -> ApiError {
    ApiError::denied(reason)
}

pub(crate) async fn accept_invite(
    state: &AppState,
    access: &str,
    invite_id: Uuid,
) -> Result<wire::AcceptInviteResponse, ApiError> {
    let mut tx = state.pool.begin().await?;
    let auth = sessions::authenticate(
        &mut tx,
        access,
        state.clock.as_ref(),
        LockMode::Update,
        LockMode::Share,
    )
    .await
    .map_err(ApiError::on_workspace_route)?;
    let principal = sqlx::query("SELECT issuer, subject FROM principals WHERE principal_id = $1")
        .bind(auth.principal_id)
        .fetch_one(&mut *tx)
        .await?;
    let issuer: String = principal.try_get("issuer")?;
    let subject: String = principal.try_get("subject")?;

    // Find the Workspace without a lock, then lock in order: Workspace, invite.
    let workspace_id: Option<Uuid> =
        sqlx::query_scalar("SELECT workspace_id FROM invites WHERE invite_id = $1")
            .bind(invite_id)
            .fetch_optional(&mut *tx)
            .await?;
    let workspace_id = workspace_id.ok_or_else(|| invite_refused("unknown invite"))?;
    let workspace = lock_workspace(&mut tx, workspace_id, LockMode::Share)
        .await?
        .ok_or_else(|| invite_refused("unknown invite"))?;
    if !workspace.kind.is_some_and(WorkspaceKind::is_enabled) {
        return Err(invite_refused("workspace kind not enabled"));
    }
    let invite = sqlx::query(
        "SELECT issuer, subject, roles, issued_by, state, expires_at, revision \
         FROM invites WHERE invite_id = $1 AND workspace_id = $2 FOR UPDATE",
    )
    .bind(invite_id)
    .bind(workspace_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(|| invite_refused("unknown invite"))?;
    // Sampled only now that the invite row is locked: an accept that waited on
    // the lock past the invite's expiry is refused, and the membership and
    // invite times recorded below agree with that check.
    let now = state.clock.now();
    let invite_state: String = invite.try_get("state")?;
    let expires_at: chrono::DateTime<chrono::Utc> = invite.try_get("expires_at")?;
    let bound_issuer: String = invite.try_get("issuer")?;
    let bound_subject: String = invite.try_get("subject")?;
    if invite_state != "pending" {
        return Err(invite_refused("invite already used or revoked"));
    }
    if now >= expires_at {
        return Err(invite_refused("invite expired"));
    }
    // Bound to (issuer, subject) exactly. Email is never consulted.
    if bound_issuer != issuer || bound_subject != subject {
        return Err(invite_refused("invite bound to another principal"));
    }

    let policy = load_policy(&mut tx, workspace_id, workspace.policy_revision).await?;
    // The grantor must still hold manage_membership (the operator's bootstrap
    // invite has no principal grantor).
    let issued_by: Option<Uuid> = invite.try_get("issued_by")?;
    if let Some(grantor) = issued_by {
        let grantor_ok = membership(&mut tx, workspace_id, grantor, Some(LockMode::Share))
            .await?
            .is_some_and(|m| m.active && policy.permits(&m.roles, Action::ManageMembership));
        if !grantor_ok {
            return Err(invite_refused("grantor no longer authorized"));
        }
    }
    let roles: Vec<String> = invite.try_get("roles")?;
    if roles.is_empty() || roles.iter().any(|role| policy.role(role).is_none()) {
        return Err(invite_refused("invited roles no longer in the policy"));
    }

    let existing = membership(
        &mut tx,
        workspace_id,
        auth.principal_id,
        Some(LockMode::Update),
    )
    .await?;
    let membership_revision: i64 = match existing {
        Some(current) if current.active => {
            return Err(ApiError::version_conflict("already an active member"));
        }
        Some(_) => {
            sqlx::query_scalar(
                "UPDATE memberships SET status = 'active', roles = $3, policy_revision = $4, \
                 revision = revision + 1, updated_at = $5 \
                 WHERE workspace_id = $1 AND principal_id = $2 RETURNING revision",
            )
            .bind(workspace_id)
            .bind(auth.principal_id)
            .bind(&roles)
            .bind(workspace.policy_revision)
            .bind(now)
            .fetch_one(&mut *tx)
            .await?
        }
        None => {
            sqlx::query_scalar(
                "INSERT INTO memberships (workspace_id, principal_id, status, roles, \
                 policy_revision, revision, created_at, updated_at) \
                 VALUES ($1, $2, 'active', $3, $4, 1, $5, $5) RETURNING revision",
            )
            .bind(workspace_id)
            .bind(auth.principal_id)
            .bind(&roles)
            .bind(workspace.policy_revision)
            .bind(now)
            .fetch_one(&mut *tx)
            .await?
        }
    };
    sqlx::query(
        "UPDATE invites SET state = 'accepted', accepted_by = $2, closed_at = $3, \
         revision = revision + 1 WHERE invite_id = $1",
    )
    .bind(invite_id)
    .bind(auth.principal_id)
    .bind(now)
    .execute(&mut *tx)
    .await?;
    let response = wire::AcceptInviteResponse {
        invite_id,
        workspace_id,
        principal_id: auth.principal_id,
        roles,
        membership_revision: revision(membership_revision)?,
        authorization_epoch: revision(workspace.authorization_epoch)?,
    };
    tx.commit()
        .await
        .map_err(|error| ApiError::uncertain(&error))?;
    tracing::info!(principal_id = %auth.principal_id, %workspace_id, "invite accepted");
    Ok(response)
}
