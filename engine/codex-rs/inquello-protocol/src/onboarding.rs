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
