//! Workspaces, memberships, invites and access checks (Story 1.11, SC-1/2/3).
//!
//! - `GET /v1/workspaces`: the caller's active `internal_company` memberships.
//! - `GET /v1/workspaces/{workspace_id}/roles`: the policy's roles. Only the
//!   `audit_team` and `reviewer` kinds exist; there is never a guest role.
//! - `POST /v1/invites/{invite_id}/accept`: accepts an invite bound to the
//!   caller's `(issuer, subject)`. Email never matches.
//! - `POST /v1/workspaces/{workspace_id}/commands`: Workspace-scoped SC-2
//!   membership-management commands with durable receipts.
//! - `POST /v1/workspaces/{workspace_id}/access-checks`: the current allow-or-deny
//!   decision for one action, on the Workspace or on one resource.
//!
//! A refusal is a `denied` error body whose `reason` is one of [`DenyReason`]; it
//! never names or confirms an inaccessible resource.

use crate::CommandEpoch;
use crate::Revision;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

/// The fixed set of deny reasons carried by a `denied` error body.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
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
}

/// The only role kinds on the wire.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoleKind {
    AuditTeam,
    Reviewer,
}

/// The actions of SC-3 and the administrative `manage_membership`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Read,
    Derive,
    Comment,
    SubmitReview,
    IssueNotes,
    Share,
    Export,
    ManageMembership,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MembershipStatus {
    Active,
    Removed,
}

/// `GET /v1/workspaces`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkspacesView {
    pub principal_id: Uuid,
    pub workspaces: Vec<WorkspaceView>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceView {
    pub workspace_id: Uuid,
    pub name: String,
    /// Always `internal_company`: no other kind is served.
    pub kind: String,
    pub revision: Revision,
    pub authorization_epoch: Revision,
    pub policy_revision: Revision,
    pub membership: MembershipBindingView,
    /// The Engagements the caller is an active member of or, for a member who
    /// holds `manage_membership`, every Engagement of the Workspace.
    pub engagements: Vec<EngagementView>,
}

/// The caller's own membership: role bindings and revisions.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MembershipBindingView {
    pub status: MembershipStatus,
    pub roles: Vec<String>,
    /// The policy revision the roles were bound under.
    pub policy_revision: Revision,
    pub revision: Revision,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EngagementView {
    pub engagement_id: Uuid,
    pub name: String,
    pub revision: Revision,
}

/// `GET /v1/workspaces/{workspace_id}/roles`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RolesView {
    pub workspace_id: Uuid,
    pub policy_revision: Revision,
    pub roles: Vec<RoleView>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RoleView {
    pub role_id: String,
    pub kind: RoleKind,
    pub label: String,
    pub actions: Vec<Action>,
}

/// `GET /v1/workspaces/{workspace_id}/execution-policy` (Story 1.18): the
/// Workspace execution policy a member's desktop combines with its device
/// requirements and user configuration.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionPolicyView {
    pub workspace_id: Uuid,
    pub policy_revision: Revision,
    pub authorization_epoch: Revision,
    /// The validated `execution` section; `null` when the policy has none, so
    /// the conservative Inquello default applies.
    pub execution: Option<ExecutionSection>,
}

/// The `execution` section of a Workspace policy, in its canonical form: only
/// the fields the policy names.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecutionSection {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<SandboxCeiling>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approvals: Option<Vec<ApprovalBehaviour>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub network: Option<Access>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mcp_tools: Option<Access>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extensions: Option<Access>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_full_access: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub allow_no_prompt: Option<bool>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SandboxCeiling {
    ReadOnly,
    WorkspaceWrite,
    FullAccess,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApprovalBehaviour {
    Untrusted,
    OnRequest,
    Never,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Access {
    Allowed,
    Denied,
}

/// `POST /v1/invites/{invite_id}/accept` answer: the caller's new membership.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AcceptInviteResponse {
    pub invite_id: Uuid,
    pub workspace_id: Uuid,
    pub principal_id: Uuid,
    pub roles: Vec<String>,
    pub membership_revision: Revision,
    pub authorization_epoch: Revision,
}

/// Workspace-scoped membership-management commands. Each needs
/// `manage_membership`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
pub enum WorkspaceCommand {
    /// Invite `(issuer, subject)` with roles of the current policy. Creation:
    /// `expected_revision` is `0`; the resource is the new invite.
    IssueInvite {
        issuer: String,
        subject: String,
        roles: Vec<String>,
    },
    /// `expected_revision` is the invite's revision.
    RevokeInvite { invite_id: Uuid },
    /// Replace a member's role bindings. `expected_revision` is the membership's
    /// revision. Increments the Workspace authorization epoch.
    ChangeRoles {
        principal_id: Uuid,
        roles: Vec<String>,
    },
    /// `expected_revision` is the membership's revision. Increments the Workspace
    /// authorization epoch and ends the member's Engagement memberships.
    RemoveMember { principal_id: Uuid },
    /// Creation: `expected_revision` is `0`; the resource is the new Engagement.
    CreateEngagement { name: String },
    /// `expected_revision` is the Engagement's revision. The principal needs an
    /// active Workspace membership.
    AddEngagementMember {
        engagement_id: Uuid,
        principal_id: Uuid,
    },
    /// `expected_revision` is the Engagement's revision. Increments the Workspace
    /// authorization epoch.
    RemoveEngagementMember {
        engagement_id: Uuid,
        principal_id: Uuid,
    },
}

impl WorkspaceCommand {
    pub const fn name(&self) -> &'static str {
        match self {
            WorkspaceCommand::IssueInvite { .. } => "issue_invite",
            WorkspaceCommand::RevokeInvite { .. } => "revoke_invite",
            WorkspaceCommand::ChangeRoles { .. } => "change_roles",
            WorkspaceCommand::RemoveMember { .. } => "remove_member",
            WorkspaceCommand::CreateEngagement { .. } => "create_engagement",
            WorkspaceCommand::AddEngagementMember { .. } => "add_engagement_member",
            WorkspaceCommand::RemoveEngagementMember { .. } => "remove_engagement_member",
        }
    }
}

/// The SC-2 envelope for Workspace-scoped commands
/// (`POST /v1/workspaces/{workspace_id}/commands`). `workspace_id` must equal the
/// path's. The receipt key is `(principal_id, 'workspace', workspace_id,
/// operation_id)`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WorkspaceCommandEnvelope {
    pub command_epoch: CommandEpoch,
    pub operation_id: String,
    pub workspace_id: Uuid,
    pub expected_revision: Revision,
    pub schema_version: u32,
    pub payload: WorkspaceCommand,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    PrivateTask,
    SharedResource,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ResourceRef {
    pub kind: ResourceKind,
    pub resource_id: Uuid,
}

/// `POST /v1/workspaces/{workspace_id}/access-checks`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccessCheckRequest {
    pub action: Action,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource: Option<ResourceRef>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessDecision {
    Allowed,
}

/// An allowed check. A refusal is a `denied` error body with its reason.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AccessCheckResponse {
    pub decision: AccessDecision,
    /// The Workspace authorization epoch the decision was made at.
    pub authorization_epoch: Revision,
}
