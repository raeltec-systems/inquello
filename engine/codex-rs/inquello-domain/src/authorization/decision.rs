//! The pure authorization decision.
//!
//! The caller (the service) gathers the facts inside the transaction that holds
//! the principal, session and Workspace authorization-epoch locks, then asks
//! [`decide`]. The checks run in a fixed order, and every check before the
//! resource step depends only on the caller, never on the resource, so the reason
//! cannot reveal whether a resource exists:
//!
//! 1. an active session, else `not_signed_in`;
//! 2. an enabled (`internal_company`) Workspace kind, else `route_not_available`;
//! 3. an active Workspace membership, else `not_a_member`;
//! 4. for a `private_task`: the caller is its creator, else `not_the_creator`
//!    (an unknown Task gives the same reason);
//! 5. a bound policy role permitting the action, else `role_lacks_action`;
//! 6. for a `shared_resource`: a content action and an active grant for that
//!    exact resource and action whose audience includes the caller, plus active
//!    Engagement membership when the resource belongs to an Engagement, else
//!    `no_grant` (an unknown resource gives the same reason).

use crate::authorization::policy::Action;
use crate::authorization::policy::RoleKind;
use crate::authorization::policy::WorkspaceKind;
use crate::authorization::policy::WorkspacePolicy;
use std::collections::BTreeSet;
use uuid::Uuid;

/// The fixed set of deny reasons. Each names the caller's missing authority and
/// never a resource.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum DenyReason {
    NotSignedIn,
    NotAMember,
    RoleLacksAction,
    NoGrant,
    NotTheCreator,
    RouteNotAvailable,
}

impl DenyReason {
    pub const ALL: [DenyReason; 6] = [
        DenyReason::NotSignedIn,
        DenyReason::NotAMember,
        DenyReason::RoleLacksAction,
        DenyReason::NoGrant,
        DenyReason::NotTheCreator,
        DenyReason::RouteNotAvailable,
    ];

    pub const fn as_str(self) -> &'static str {
        match self {
            DenyReason::NotSignedIn => "not_signed_in",
            DenyReason::NotAMember => "not_a_member",
            DenyReason::RoleLacksAction => "role_lacks_action",
            DenyReason::NoGrant => "no_grant",
            DenyReason::NotTheCreator => "not_the_creator",
            DenyReason::RouteNotAvailable => "route_not_available",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Deny(DenyReason),
}

impl Decision {
    pub fn into_result(self) -> Result<(), DenyReason> {
        match self {
            Decision::Allow => Ok(()),
            Decision::Deny(reason) => Err(reason),
        }
    }
}

/// The caller's Workspace membership as currently stored.
#[derive(Clone, Copy, Debug)]
pub struct MembershipFacts<'a> {
    pub active: bool,
    /// Role bindings: role IDs of the Workspace policy.
    pub roles: &'a [String],
}

/// Everything about the caller that a decision needs.
#[derive(Clone, Copy, Debug)]
pub struct AuthorityFacts<'a> {
    pub principal_id: Uuid,
    pub session_active: bool,
    /// `None` when the stored kind is not one this domain knows (fail closed).
    pub workspace_kind: Option<WorkspaceKind>,
    /// `None` when the caller has no membership row at all.
    pub membership: Option<MembershipFacts<'a>>,
    pub policy: &'a WorkspacePolicy,
    /// The Engagements of this Workspace the caller is an active member of.
    pub engagements: &'a BTreeSet<Uuid>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ResourceKind {
    PrivateTask,
    SharedResource,
}

impl ResourceKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            ResourceKind::PrivateTask => "private_task",
            ResourceKind::SharedResource => "shared_resource",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "private_task" => Some(ResourceKind::PrivateTask),
            "shared_resource" => Some(ResourceKind::SharedResource),
            _ => None,
        }
    }
}

/// A reference to a resource, as a request names it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct ResourceRef {
    pub kind: ResourceKind,
    pub id: Uuid,
}

/// What the authority holds about a referenced resource.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResourceRecord {
    PrivateTask {
        creator: Uuid,
    },
    SharedResource {
        /// The Engagement the resource belongs to, if any.
        engagement_id: Option<Uuid>,
    },
}

impl ResourceRecord {
    pub const fn kind(self) -> ResourceKind {
        match self {
            ResourceRecord::PrivateTask { .. } => ResourceKind::PrivateTask,
            ResourceRecord::SharedResource { .. } => ResourceKind::SharedResource,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GrantAudience {
    Principal(Uuid),
    /// Every active member holding an `audit_team` role.
    WorkspaceAuditTeam,
}

/// An explicit grant on one resource.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Grant {
    pub resource_id: Uuid,
    pub audience: GrantAudience,
    pub actions: BTreeSet<Action>,
    pub active: bool,
}

/// The referenced resource as found (or not) and its grants.
#[derive(Clone, Copy, Debug)]
pub struct ResourceFacts<'a> {
    /// `None` when the resource does not exist.
    pub record: Option<ResourceRecord>,
    pub grants: &'a [Grant],
}

/// A request: an action on the Workspace itself, or on one resource.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AccessRequest {
    pub action: Action,
    pub resource: Option<ResourceRef>,
}

/// Steps 1 to 3: an active session, an enabled Workspace kind and an active
/// membership. Used on its own for reads every member may make (the roles list).
pub fn check_membership(facts: &AuthorityFacts<'_>) -> Result<(), DenyReason> {
    if !facts.session_active {
        return Err(DenyReason::NotSignedIn);
    }
    if !facts.workspace_kind.is_some_and(WorkspaceKind::is_enabled) {
        return Err(DenyReason::RouteNotAvailable);
    }
    match facts.membership {
        Some(membership) if membership.active => Ok(()),
        _ => Err(DenyReason::NotAMember),
    }
}

/// Decides `request` for the caller described by `facts`. `resource` must describe
/// `request.resource` when there is one; it is ignored otherwise.
pub fn decide(
    facts: &AuthorityFacts<'_>,
    request: AccessRequest,
    resource: Option<&ResourceFacts<'_>>,
) -> Decision {
    match decide_inner(facts, request, resource) {
        Ok(()) => Decision::Allow,
        Err(reason) => Decision::Deny(reason),
    }
}

fn decide_inner(
    facts: &AuthorityFacts<'_>,
    request: AccessRequest,
    resource: Option<&ResourceFacts<'_>>,
) -> Result<(), DenyReason> {
    check_membership(facts)?;
    let roles: &[String] = facts.membership.map_or(&[], |m| m.roles);

    let Some(reference) = request.resource else {
        return if facts.policy.permits(roles, request.action) {
            Ok(())
        } else {
            Err(DenyReason::RoleLacksAction)
        };
    };
    // Only a record of the referenced kind counts; anything else is unknown.
    let record = resource
        .and_then(|found| found.record)
        .filter(|record| record.kind() == reference.kind);

    match reference.kind {
        ResourceKind::PrivateTask => {
            // Before any role check: nothing but being the creator reaches it.
            match record {
                Some(ResourceRecord::PrivateTask { creator }) if creator == facts.principal_id => {}
                _ => return Err(DenyReason::NotTheCreator),
            }
            if request.action.is_administrative() || !facts.policy.permits(roles, request.action) {
                return Err(DenyReason::RoleLacksAction);
            }
            Ok(())
        }
        ResourceKind::SharedResource => {
            if !facts.policy.permits(roles, request.action) {
                return Err(DenyReason::RoleLacksAction);
            }
            if request.action.is_administrative() {
                return Err(DenyReason::NoGrant);
            }
            let Some(ResourceRecord::SharedResource { engagement_id }) = record else {
                return Err(DenyReason::NoGrant);
            };
            if let Some(engagement_id) = engagement_id
                && !facts.engagements.contains(&engagement_id)
            {
                return Err(DenyReason::NoGrant);
            }
            let in_audit_team = facts
                .policy
                .bound_roles(roles)
                .any(|role| role.kind == RoleKind::AuditTeam);
            let grants = resource.map_or(&[][..], |found| found.grants);
            let granted = grants.iter().any(|grant| {
                grant.active
                    && grant.resource_id == reference.id
                    && grant.actions.contains(&request.action)
                    && match grant.audience {
                        GrantAudience::Principal(principal) => principal == facts.principal_id,
                        GrantAudience::WorkspaceAuditTeam => in_audit_team,
                    }
            });
            if granted {
                Ok(())
            } else {
                Err(DenyReason::NoGrant)
            }
        }
    }
}
