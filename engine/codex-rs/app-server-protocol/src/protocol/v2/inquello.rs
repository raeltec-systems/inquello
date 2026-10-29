//! Inquello private Workspace organisation (Story 1.14), Task states
//! (Story 1.15) and the effective managed policy with a Task's broader
//! execution mode (Story 1.18): `inquello/*` methods.
//!
//! These methods reach the Inquello working store (`inquello-domain` commands
//! over the `inquello-adapters` SQLite store). Only the desktop main process
//! calls them. The acting principal is bound per connection with
//! `inquello/session/setPrincipal` and is never read from another payload.
//! Every mutation carries an `operationId` and an `expectedRevision` (0 for a
//! creation); a replay of the same operation answers from its receipt.
//!
//! Refusals are JSON-RPC errors whose `data` is
//! `{ "inquello": { "kind": ..., "expected"?, "actual"? } }`, with `kind` one of
//! `unauthenticated`, `store_not_configured`, `store_unavailable`, `invalid`,
//! `not_found`, `workspace_mismatch`, `revision_conflict`,
//! `operation_conflict`, `human_actor_required`, `dimension_not_enabled`,
//! `invalid_value`, `broad_mode_not_permitted` (with `rule`, the governing
//! source, and `revision` for a Workspace rule) or `store_failure`.

use crate::JsonSchema;
use crate::TS;
use serde::Deserialize;
use serde::Serialize;
use serde_json::Value as JsonValue;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloSetPrincipalParams {
    /// The signed-in shared-service principal, or null when signed out.
    #[ts(optional = nullable)]
    pub principal_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloSetPrincipalResponse {
    /// The principal now bound to this connection, if any.
    pub principal_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceListParams {}

/// A Workspace this device knows for the bound principal.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloKnownWorkspace {
    pub workspace_id: String,
    /// The last name the principal saw for it; null when only a Task names it.
    pub name: Option<String>,
    /// The label's revision; 0 when no label is stored.
    #[ts(type = "number")]
    pub label_revision: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceListResponse {
    pub workspaces: Vec<InquelloKnownWorkspace>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceRememberParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceRememberResponse {
    pub workspace: InquelloKnownWorkspace,
    pub receipt: InquelloReceipt,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceTreeParams {
    pub workspace_id: String,
}

/// A Workspace's Engagements and folders, and only the bound principal's Tasks.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceTreeResponse {
    pub workspace_id: String,
    pub engagements: Vec<InquelloEngagement>,
    pub folders: Vec<InquelloFolder>,
    pub tasks: Vec<InquelloTask>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloEngagement {
    pub engagement_id: String,
    pub workspace_id: String,
    pub service_engagement_id: String,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    pub client_entity: Option<String>,
    /// `YYYY-MM-DD`.
    pub period_start: Option<String>,
    /// `YYYY-MM-DD`.
    pub period_end: Option<String>,
    #[ts(type = "number")]
    pub revision: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloFolder {
    pub folder_id: String,
    pub engagement_id: String,
    pub workspace_id: String,
    pub name: String,
    #[ts(type = "number")]
    pub revision: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub enum InquelloTaskVisibility {
    Private,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTask {
    pub task_id: String,
    pub workspace_id: String,
    pub creator_principal_id: String,
    pub engagement_id: Option<String>,
    pub folder_id: Option<String>,
    pub title: String,
    pub runtime_thread_id: Option<String>,
    pub source_refs: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub visibility: InquelloTaskVisibility,
    #[ts(type = "number")]
    pub revision: u64,
}

/// What a mutation's receipt recorded.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloReceipt {
    pub operation_id: String,
    pub command: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    #[ts(type = "number")]
    pub resulting_revision: u64,
    /// True when this answer came from an earlier application of the operation.
    pub replayed: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloEngagementCreateParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    /// The shared-service Engagement main created first (Story 1.11).
    pub service_engagement_id: String,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    #[ts(optional = nullable)]
    pub client_entity: Option<String>,
    #[ts(optional = nullable)]
    pub period_start: Option<String>,
    #[ts(optional = nullable)]
    pub period_end: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloEngagementUpdateParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub engagement_id: String,
    pub name: String,
    pub objectives: String,
    pub scope: String,
    #[ts(optional = nullable)]
    pub client_entity: Option<String>,
    #[ts(optional = nullable)]
    pub period_start: Option<String>,
    #[ts(optional = nullable)]
    pub period_end: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloEngagementResponse {
    pub engagement: InquelloEngagement,
    pub receipt: InquelloReceipt,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloFolderCreateParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub engagement_id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloFolderResponse {
    pub folder: InquelloFolder,
    pub receipt: InquelloReceipt,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskCreateParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    #[ts(optional = nullable)]
    pub engagement_id: Option<String>,
    #[ts(optional = nullable)]
    pub folder_id: Option<String>,
    pub title: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskRenameParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub task_id: String,
    pub title: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskMoveParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub task_id: String,
    /// The target Engagement, or null for an ad hoc Task.
    #[ts(optional = nullable)]
    pub engagement_id: Option<String>,
    /// A folder of the target Engagement, or null.
    #[ts(optional = nullable)]
    pub folder_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskAttachThreadParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub workspace_id: String,
    pub task_id: String,
    pub runtime_thread_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskResponse {
    pub task: InquelloTask,
    pub receipt: InquelloReceipt,
}

/// Every recorded state of one Task (Story 1.15). Only the Task's creator may
/// read them; anyone else gets `not_found`, as for an unknown Task.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateListParams {
    pub task_id: String,
}

/// One immutable state record.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateRecord {
    /// `task`, `run`, `output`, `checks`, `review`, `approval_marker` or
    /// `delivery_marker`.
    pub dimension: String,
    /// `task`, `run` or `output`.
    pub scope_kind: String,
    /// The Task ID, a run reference or an output/version reference.
    pub scope_id: String,
    /// A value of the dimension's own vocabulary.
    pub value: String,
    /// 1 for the first record of this dimension and scope, then one more per record.
    #[ts(type = "number")]
    pub version: u64,
    /// `human`, `runtime` or `system`.
    pub actor_kind: String,
    /// The principal ID for a human; the runtime or host name otherwise.
    pub actor_ref: String,
    /// Milliseconds since the Unix epoch.
    #[ts(type = "number")]
    pub recorded_at: i64,
    /// The Task-state revision this record created.
    #[ts(type = "number")]
    pub revision: u64,
}

/// One dimension and its records, latest first; empty when not recorded.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateDimension {
    pub dimension: String,
    pub records: Vec<InquelloStateRecord>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateListResponse {
    pub task_id: String,
    /// The Task's state revision: 0 before the first record.
    #[ts(type = "number")]
    pub revision: u64,
    /// All seven dimensions, in a fixed order.
    pub dimensions: Vec<InquelloStateDimension>,
}

/// Records one state of a Task. Only `task` and `run` have writers yet; the
/// other dimensions answer `dimension_not_enabled`, and `review` or
/// `approval_marker` from a runtime or system actor answer
/// `human_actor_required`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateRecordParams {
    pub operation_id: String,
    /// The Task's state revision as last read (0 before the first record).
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub task_id: String,
    pub dimension: String,
    pub scope_kind: String,
    pub scope_id: String,
    pub value: String,
    /// Supplied by the desktop main process, never by the renderer:
    /// `human` (the bound principal), `runtime` or `system`.
    pub actor_kind: String,
    /// The runtime or host name for a `runtime` or `system` actor; must be
    /// absent for `human`, whose reference is the bound principal.
    #[ts(optional = nullable)]
    pub actor_ref: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloStateRecordResponse {
    pub task_id: String,
    pub record: InquelloStateRecord,
    pub receipt: InquelloReceipt,
}

// ---- Effective managed policy and broader modes (Story 1.18) -----------------------

/// The Workspace execution policy as the desktop main process fetched it from
/// the shared service (`GET /v1/workspaces/{id}/execution-policy`).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloWorkspaceExecutionPolicy {
    pub workspace_id: String,
    #[ts(type = "number")]
    pub policy_revision: u64,
    #[ts(type = "number")]
    pub authorization_epoch: u64,
    /// The policy's `execution` section in its canonical snake_case form, or
    /// null when the policy has none (the conservative Inquello default
    /// applies). Validated again here; an invalid section is `invalid`.
    pub execution: Option<JsonValue>,
}

/// Computes the effective policy over the Workspace layer (from the params),
/// this runtime's managed requirements (`configRequirements/read`) and the
/// user's own configuration. With a `taskId`, also the Task's broader mode,
/// its status under this policy and the thread settings it would get; only the
/// Task's creator may name it, and the Task must belong to the Workspace.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPolicyEffectiveParams {
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
    #[ts(optional = nullable)]
    pub task_id: Option<String>,
    /// Story 1.19: the Task's private working folder (absolute, named after
    /// the Task). With a `taskId`, the response also carries the Task's tool
    /// profile in the runtime's own form.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[ts(optional = nullable)]
    pub task_folder: Option<String>,
}

/// The rule that governs a setting.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPolicySource {
    /// `workspace_policy`, `device_requirements`, `user_config` or
    /// `inquello_default`.
    pub kind: String,
    /// The Workspace policy revision, for `workspace_policy`.
    #[ts(type = "number | null")]
    pub revision: Option<u64>,
}

/// One effective setting.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPolicySetting {
    /// `sandbox`, `approval`, `network`, `mcp_tools`, `extensions`,
    /// `full_access` or `no_prompt`.
    pub name: String,
    /// `read_only`/`workspace_write`/`full_access` for `sandbox` (the ceiling);
    /// `on_request`/`untrusted` for `approval`; `allowed`/`denied` for
    /// `network`, `mcp_tools` and `extensions`; `permitted`/`not_permitted`
    /// for the broad modes.
    pub value: String,
    pub source: InquelloPolicySource,
    /// Whether a rule narrows the setting below its most permissive value.
    pub restricted: bool,
}

/// The device layer as `configRequirements/read` reports it.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloDeviceRequirements {
    /// False when no requirement this policy reads is configured.
    pub configured: bool,
    /// Allowed sandbox levels, or null when not configured.
    pub sandbox_modes: Option<Vec<String>>,
    /// Allowed approval behaviours, or null when not configured.
    pub approvals: Option<Vec<String>>,
}

/// A Capability Contract entry from the compiled capability register.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloCapabilityContractEntry {
    pub id: String,
    pub enabled: bool,
    pub limits: Vec<String>,
}

/// A Task's broader execution mode under the current policy.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskBroadMode {
    pub task_id: String,
    /// The Task's broad-mode revision: 0 before the first record.
    #[ts(type = "number")]
    pub revision: u64,
    /// The recorded mode: `standard`, `no_prompt` or `full_access`.
    pub recorded: String,
    /// `standard`, `active` or `suspended` (recorded but no longer permitted).
    pub status: String,
    /// The mode the Task runs in: `standard` when suspended.
    pub effective_mode: String,
    /// The rule that suspends the recorded mode, when suspended.
    pub governing: Option<InquelloPolicySource>,
    /// Always "Broader execution mode".
    pub label: String,
    /// The reach statement of the recorded mode.
    pub reach: String,
}

/// The thread settings a run of the Task gets, derived only from the effective
/// policy and the Task's broad mode. Values use the runtime's own names.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloThreadSettings {
    /// `read-only`, `workspace-write` or `danger-full-access`.
    pub sandbox: String,
    /// `untrusted`, `on-request` or `never`.
    pub approval_policy: String,
    pub network_access: bool,
    pub mode: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskPolicy {
    pub broad_mode: InquelloTaskBroadMode,
    pub thread_settings: InquelloThreadSettings,
    /// Story 1.19: what the Task's tools can reach, without device paths.
    pub reach: InquelloToolReach,
    /// Story 1.19: the tool profile in the runtime's own form; present when
    /// the params name the Task folder.
    pub runtime_profile: Option<InquelloRuntimeProfile>,
}

/// One permitted location of a bounded tool profile (Story 1.19).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloToolBoundary {
    /// `working_folder`, `output_folder` or `system`.
    pub kind: String,
    /// `read` or `write`.
    pub access: String,
    /// The boundary's name in a denial, for example "working folder
    /// (read/write)", "output folder" or "system (read-only)".
    pub label: String,
}

/// What a Task's tools can reach (Story 1.19), with no device path.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloToolReach {
    /// False only for a permitted Full access broad mode: no filesystem or
    /// network limits.
    pub bounded: bool,
    /// The permitted locations of a bounded profile; empty when unbounded.
    pub boundaries: Vec<InquelloToolBoundary>,
    /// `listed` (only `domains`; none when empty) or `unrestricted`.
    pub network: String,
    pub domains: Vec<String>,
    /// The rule that governs the network reach.
    pub network_source: InquelloPolicySource,
}

/// A Task's tool profile in the runtime's own form (Story 1.19).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRuntimeProfile {
    /// `permission-profile` (bounded: the named permissions profile below) or
    /// `danger-full-access` (a permitted Full access mode).
    pub sandbox: String,
    /// The permissions profile id `inquello/tools/exec` applies, when bounded.
    pub permission_profile_id: Option<String>,
    /// The `[permissions.<id>]` table, when bounded.
    pub permission_profile: Option<JsonValue>,
    /// Absolute folders the profile reads (beyond the runtime's minimal
    /// system set); empty when unbounded.
    pub readable_roots: Vec<String>,
    /// Absolute folders the profile writes; empty when unbounded.
    pub writable_roots: Vec<String>,
    /// The network allowlist through the runtime's proxy; null when
    /// unrestricted.
    pub network_allowlist: Option<Vec<String>>,
}

/// Runs one command for a Task inside the Task's tool profile (Story 1.19),
/// through the runtime's own command execution. The profile is derived here
/// from the same inputs as `inquello/policy/effective`; the Task must be the
/// caller's and belong to the Workspace. The response is the runtime's own
/// `command/exec` result.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloToolsExecParams {
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
    pub task_id: String,
    pub task_folder: String,
    /// Command argv vector. Empty arrays are rejected.
    pub command: Vec<String>,
    /// Optional timeout in milliseconds.
    #[ts(type = "number | null")]
    #[ts(optional = nullable)]
    pub timeout_ms: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPolicyEffectiveResponse {
    /// Always `local_device` in V1.
    pub environment: String,
    pub workspace_id: String,
    #[ts(type = "number")]
    pub policy_revision: u64,
    #[ts(type = "number")]
    pub authorization_epoch: u64,
    /// Every setting, in a fixed order.
    pub settings: Vec<InquelloPolicySetting>,
    pub device: InquelloDeviceRequirements,
    /// Capability Contract entries.
    pub capabilities: Vec<InquelloCapabilityContractEntry>,
    /// Story 1.19: what a standard Task's tools in this Workspace can reach.
    pub reach: InquelloToolReach,
    /// Present when the params name a Task.
    pub task: Option<InquelloTaskPolicy>,
}

/// Reads a Task's recorded broader mode (creator only) and its Workspace.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloBroadModeReadParams {
    pub task_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloBroadModeReadResponse {
    pub task_id: String,
    pub workspace_id: String,
    #[ts(type = "number")]
    pub revision: u64,
    /// `standard` when nothing was ever recorded.
    pub mode: String,
}

/// Sets a Task's broader mode. A non-standard mode needs a `human` actor, the
/// confirmation that names its reach exactly, and an effective policy that
/// permits it; otherwise `broad_mode_not_permitted` names the governing rule.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloBroadModeSetParams {
    pub operation_id: String,
    /// The Task's broad-mode revision as last read (0 before the first record).
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub task_id: String,
    /// `standard`, `no_prompt` or `full_access`.
    pub mode: String,
    /// The reach statement the person confirmed; null for `standard`.
    #[ts(optional = nullable)]
    pub confirmation: Option<String>,
    /// Supplied by the desktop main process: `human` (the bound principal),
    /// `runtime` or `system`.
    pub actor_kind: String,
    #[ts(optional = nullable)]
    pub actor_ref: Option<String>,
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloBroadModeSetResponse {
    pub task: InquelloTaskPolicy,
    pub receipt: InquelloReceipt,
}
