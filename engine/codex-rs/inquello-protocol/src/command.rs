//! SC-2 commands: capability negotiation, the mutation envelope and the response.
//!
//! The actor is always resolved from the request's credentials; envelopes have no
//! actor field. The durable receipt key is `(principal_id, scope_kind, scope_id,
//! operation_id)` with a canonical digest of the request. An exact retry returns
//! the recorded response; the same key with a different request is a
//! `version_conflict`; a `command_epoch` that is not current is
//! `unsupported_contract` and is never treated as a fresh operation.

use crate::CommandEpoch;
use crate::Revision;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

/// `GET /v1/capabilities`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Capabilities {
    pub protocol_major: u32,
    pub schema_version: u32,
    /// The command epoch new mutations must carry.
    pub command_epoch: CommandEpoch,
}

/// The SC-2 mutation envelope. Principal-scoped session commands carry no
/// `workspace_id`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandEnvelope<P> {
    pub command_epoch: CommandEpoch,
    pub operation_id: String,
    pub expected_revision: Revision,
    pub schema_version: u32,
    pub payload: P,
}

/// Principal-scoped session-management commands (`POST /v1/session/commands`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "snake_case", deny_unknown_fields)]
pub enum SessionCommand {
    /// Revoke one of the caller principal's sessions (this device or another).
    /// `expected_revision` is that session's observed revision.
    Logout { session_id: Uuid },
}

impl SessionCommand {
    pub const fn name(&self) -> &'static str {
        match self {
            SessionCommand::Logout { .. } => "logout",
        }
    }
}

pub type SessionCommandEnvelope = CommandEnvelope<SessionCommand>;

/// The receipt scope of a command.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScopeKind {
    Principal,
    Workspace,
}

impl ScopeKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            ScopeKind::Principal => "principal",
            ScopeKind::Workspace => "workspace",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandStatus {
    Applied,
}

/// The service's answer to a command, recorded verbatim in its receipt. It never
/// carries a credential.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandResponse {
    pub operation_id: String,
    pub resource_id: Uuid,
    pub revision: Revision,
    /// The Workspace authorization epoch; `null` for principal-scoped commands,
    /// which have no Workspace.
    pub authorization_epoch: Option<Revision>,
    pub status: CommandStatus,
    pub receipt_id: Uuid,
}
