//! Story 1.31. Server-owned grants, explicit operations and recipient-only discovery.
use crate::{CommandEpoch, Revision};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OnboardingCommandEnvelope {
    pub command_epoch: CommandEpoch,
    pub operation_id: String,
    pub expected_revision: Revision,
    pub schema_version: u32,
    pub payload: OnboardingCommand,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
pub enum OnboardingCommand {
    CreateWorkspace { name: String },
    AcceptInvitation { invite_id: Uuid },
}
impl OnboardingCommand {
    pub const fn name(&self) -> &'static str {
        match self {
            Self::CreateWorkspace { .. } => "create_workspace",
            Self::AcceptInvitation { .. } => "accept_invitation",
        }
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvitationView {
    pub invite_id: Uuid,
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub roles: Vec<String>,
    pub revision: Revision,
    pub expires_at: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvitationsView {
    pub invitations: Vec<InvitationView>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MemberView {
    pub principal_id: Uuid,
    pub display_name: Option<String>,
    pub roles: Vec<String>,
    pub revision: Revision,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MembersView {
    pub workspace_id: Uuid,
    pub members: Vec<MemberView>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvitationDeliveryView {
    pub invite_id: Uuid,
    /// provider_accepted means accepted by the provider, never inbox delivery.
    pub state: InvitationDeliveryState,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvitationDeliveryState {
    NotConfigured,
    Pending,
    Sending,
    ProviderAccepted,
    RetryPending,
    ManualReconciliationRequired,
    Cancelled,
    Failed,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InvitationDeliveriesView {
    pub workspace_id: Uuid,
    pub deliveries: Vec<InvitationDeliveryView>,
}

/// Manager-only metadata for email invitations. Recipient discovery remains a
/// separate fresh-proof route; no issuer/subject or bearer secret is exposed.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ManagedInvitationView {
    pub invite_id: Uuid,
    pub revision: Revision,
    pub state: ManagedInvitationState,
    pub expires_at: String,
    pub roles: Vec<String>,
    pub recipient_email: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ManagedInvitationState {
    Pending,
    Accepted,
    Revoked,
    /// A still-pending stored invitation whose expiry has passed; read-only.
    Expired,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ManagedInvitationsView {
    pub workspace_id: Uuid,
    pub invitations: Vec<ManagedInvitationView>,
    pub next_cursor: Option<Uuid>,
}
