//! Durable Owner consent; renderer-supplied contract values are CAS only.
use crate::{CommandEpoch, Revision};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderConsentState {
    NotAllowed,
    Allowed,
    Revoked,
    Changed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderConsentView {
    pub workspace_id: Uuid,
    pub workspace_name: String,
    pub provider: String,
    pub contract_id: String,
    pub contract_version: u32,
    pub contract_digest: String,
    pub consent_text: String,
    pub revision: Revision,
    pub state: ProviderConsentState,
    pub can_manage: bool,
    pub authorization_epoch: Revision,
    pub policy_revision: Revision,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderConsentAction {
    Allow,
    Revoke,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderConsentCommand {
    pub schema_version: u32,
    pub command_epoch: CommandEpoch,
    pub workspace_id: Uuid,
    pub operation_id: Uuid,
    pub expected_revision: Revision,
    pub expected_contract_version: u32,
    pub expected_contract_digest: String,
    pub action: ProviderConsentAction,
}

/// Consent-only terminal reconciliation. Applied JSON stays wire-compatible;
/// a no-effect receipt is not an organization decision or processing authority.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ProviderConsentReceipt {
    Applied(crate::command::CommandResponse),
    NotApplied(ProviderConsentNotApplied),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderConsentNotAppliedStatus {
    NotApplied,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderConsentRejectionReason {
    CommandContractChanged,
    ProcessingTermsChanged,
    RevisionChanged,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProviderConsentNotApplied {
    pub status: ProviderConsentNotAppliedStatus,
    pub principal_id: Uuid,
    pub provider: String,
    pub command: ProviderConsentCommand,
    pub reason: ProviderConsentRejectionReason,
    pub receipt_id: Uuid,
}
