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
//! source, and `revision` for a Workspace rule), `task_folder_missing`, and
//! (Story 1.20) `user_rule_cannot_allow`, `command_forbidden` and
//! `permission_required` (both with `evaluation`, the command's decision
//! record), `request_not_pending` and `reviewer_not_available`, or
//! `store_failure`.

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
    /// Story 1.20: the allowed permission request that covers exactly this
    /// command, used once. A command whose rules ask is refused with
    /// `permission_required` without one.
    #[ts(optional = nullable)]
    pub permission_request_id: Option<String>,
    /// Story 1.20: the local sandbox check. When set, `command` must be empty
    /// and the runtime runs its own fixed probe that this path is not
    /// visible inside the Task's profile; command rules do not apply to it.
    #[ts(optional = nullable)]
    pub sandbox_probe_target: Option<String>,
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
    /// Story 1.20: the Workspace command rules, each with its source.
    pub command_rules: Vec<InquelloCommandRuleView>,
    /// Story 1.20: the automatic permission reviewer's state.
    pub reviewer: InquelloPermissionReviewer,
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

// ---- Story 1.20: command rules and permission to act ------------------------------

/// One command rule: a literal command prefix and its decision.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloCommandRule {
    /// The literal command words, in order.
    pub prefix: Vec<String>,
    /// `allow`, `prompt` or `forbid` (a person's own rules: `prompt` or `forbid`).
    pub decision: String,
    pub note: Option<String>,
}

/// Where a command decision comes from.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRuleSource {
    /// `workspace_policy`, `user_rule` or `approval_behaviour`.
    pub kind: String,
    /// The policy revision (Workspace) or rules version (user rule).
    #[ts(type = "number | null")]
    pub revision: Option<u64>,
    /// The asking behaviour, for `approval_behaviour`.
    pub behaviour: Option<String>,
    /// The source in words, for example "Workspace policy, revision 4" or "your rule".
    pub label: String,
}

/// A rule with its source.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloCommandRuleView {
    pub rule: InquelloCommandRule,
    pub source: InquelloRuleSource,
}

/// The automatic permission reviewer: a Workspace switch, off by default,
/// usable only once a processing route exists.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionReviewer {
    /// The Workspace switch.
    pub enabled: bool,
    /// `off`, `not_available` or `active`.
    pub state: String,
    pub label: String,
    /// The runtime's inherited reviewer setting this maps to: `user` unless active.
    pub runtime_setting: String,
}

/// The decision record of one command.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloCommandEvaluation {
    /// `allow`, `prompt` or `forbid`.
    pub decision: String,
    /// The rule that controls the decision; null when the asking behaviour decides.
    pub controlling_rule: Option<InquelloCommandRule>,
    pub source: InquelloRuleSource,
    /// A prompt refused because the Task's mode never asks.
    pub cannot_ask: bool,
    /// The exact command.
    pub command: Vec<String>,
    /// The exact command as people read it.
    pub command_text: String,
    /// The action and its destination in plain words.
    pub analysis: String,
    /// Where it takes effect, with no device path.
    pub destination: String,
    /// What changes and whether it can be undone.
    pub consequence: String,
    /// The controlling rule and its source in words.
    pub rule_text: String,
}

/// A recorded permission decision.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionDecision {
    /// `allowed`, `denied` or `expired`.
    pub outcome: String,
    /// `human`, `automated_reviewer` or `system`.
    pub actor_kind: String,
    pub actor_ref: String,
    #[ts(type = "number")]
    pub decided_at: i64,
    /// "Automated permission review — not analytical review or Professional
    /// Approval" for the reviewer; null otherwise.
    pub label: Option<String>,
}

/// One request for permission to act.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionRequest {
    pub request_id: String,
    pub task_id: String,
    pub workspace_id: String,
    /// `tools_exec` or `runtime`.
    pub origin: String,
    /// Always "Permission to act".
    pub label: String,
    pub evaluation: InquelloCommandEvaluation,
    #[ts(type = "number")]
    pub created_at: i64,
    #[ts(type = "number")]
    pub expires_at: i64,
    /// `pending`, `allowed`, `denied` or `expired`.
    pub status: String,
    /// 1 while undecided, 2 once decided.
    #[ts(type = "number")]
    pub revision: u64,
    pub decision: Option<InquelloPermissionDecision>,
    pub used: bool,
}

/// Reads the signed-in person's own command rules.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloUserRulesReadParams {}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloUserRulesReadResponse {
    /// 0 before the first version.
    #[ts(type = "number")]
    pub revision: u64,
    pub rules: Vec<InquelloCommandRule>,
}

/// Replaces the person's own rules: `prompt` or `forbid` only
/// (`user_rule_cannot_allow` otherwise).
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloUserRulesSetParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub rules: Vec<InquelloCommandRule>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloUserRulesSetResponse {
    #[ts(type = "number")]
    pub revision: u64,
    pub rules: Vec<InquelloCommandRule>,
    pub receipt: InquelloReceipt,
}

/// Records a pending request for permission to run one command for a Task.
/// The decision record is computed here from the Task's rules and policy. A
/// forbidden command is refused (`command_forbidden`) and no request exists.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsRequestParams {
    pub operation_id: String,
    pub request_id: String,
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
    pub task_id: String,
    pub command: Vec<String>,
    /// `tools_exec` or `runtime`.
    pub origin: String,
    /// How long the request waits for a decision.
    #[ts(type = "number")]
    pub ttl_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsRequestResponse {
    pub request: InquelloPermissionRequest,
    pub receipt: InquelloReceipt,
}

/// The person's pending requests, of one Task when named.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsPendingParams {
    #[ts(optional = nullable)]
    pub task_id: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsPendingResponse {
    pub requests: Vec<InquelloPermissionRequest>,
}

/// Decides one pending request. A person allows or denies; the host only
/// expires or denies; the automatic reviewer is refused
/// (`reviewer_not_available`) until a processing route exists. A decided or
/// expired request is `request_not_pending`.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsDecideParams {
    pub operation_id: String,
    pub request_id: String,
    /// 1: the request's revision while undecided.
    #[ts(type = "number")]
    pub expected_revision: u64,
    /// `allowed`, `denied` or `expired`.
    pub outcome: String,
    /// Supplied by the desktop main process: `human` (the bound principal),
    /// `system` or `automated_reviewer`.
    pub actor_kind: String,
    #[ts(optional = nullable)]
    pub actor_ref: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsDecideResponse {
    pub request: InquelloPermissionRequest,
    pub receipt: InquelloReceipt,
}

// Story 1.22: configuration is not credential presence, support or evidence.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloRouteConfiguration {
    pub route_id: String,
    pub deployment: String,
    pub model: String,
    pub api_version: String,
    pub account_ref: String,
    pub region: Option<String>,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloRoutesListParams {}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRouteView {
    pub route_id: String,
    pub provider: String,
    pub configurable: bool,
    pub configuration: Option<InquelloRouteConfiguration>,
    pub endpoint: Option<String>,
    #[ts(type = "number")]
    pub revision: u64,
    pub credential_present: bool,
    pub adapter_supported: bool,
    pub verification: String,
    pub enabled: bool,
    pub gate: Option<String>,
    pub limits: Vec<String>,
    pub evidence: Vec<String>,
    pub execution_flow: String,
    pub inference_flow: String,
    pub connector_flow: String,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRoutesListResponse { pub routes: Vec<InquelloRouteView> }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloRouteConfigureParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub configuration: InquelloRouteConfiguration,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRouteConfigureResponse { pub route: InquelloRouteView, pub receipt: InquelloReceipt }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTaskRouteReadParams { pub task_id: String }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTaskRouteSetParams {
    pub operation_id: String,
    #[ts(type = "number")]
    pub expected_revision: u64,
    pub task_id: String,
    pub route_id: String,
    #[ts(type = "number")]
    pub configuration_revision: u64,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTaskRouteResponse {
    pub task_id: String,
    pub workspace_id: String,
    #[ts(type = "number")]
    pub revision: u64,
    #[ts(type = "number | null")]
    pub configuration_revision: Option<u64>,
    pub stale_configuration: bool,
    pub selected: Option<InquelloRouteView>,
    pub receipt: Option<InquelloReceipt>,
}
/// Private main-to-runtime only. Never accepted on a socket or exported to a renderer.
/// Deliberately redacts Debug; parse failures also use a fixed diagnostic.
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloRoutePrivateAuthParams {
    pub route_id: String,
    pub account_ref: String,
    #[ts(type = "number")]
    pub generation: u64,
    pub api_key: Option<String>,
}
impl std::fmt::Debug for InquelloRoutePrivateAuthParams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("InquelloRoutePrivateAuthParams([private])")
    }
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloRoutePrivateAuthResponse { pub accepted: bool }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloRoutesInvalidateParams {
    /// Null invalidates all route auth and pending reviews for the bound principal.
    pub route_id: Option<String>,
    #[ts(type = "number")]
    pub generation: u64,
    pub task_id: Option<String>,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsReviewParams {
    pub request_id: String,
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
    #[ts(type = "number")]
    pub authority_epoch: u64,
    /// Only "synthetic" is eligible in Story 1.22.
    pub data_tier: String,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloPermissionsReviewResponse {
    /// human_required, refused, or decided. No alternate provider is ever selected.
    pub status: String,
    pub label: String,
    pub reason: Option<String>,
    pub request: InquelloPermissionRequest,
    pub receipt: Option<InquelloReceipt>,
}

// Story 1.24: only read and settings commands cross RPC. Native consumption is
// never accepted from a renderer. The source-owned view is bounded and redacted.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloUsageReadParams { pub task_id: String }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloUsageSetParams {
    pub task_id: String, pub operation_id: String,
    #[ts(type = "number")] pub expected_revision: u64,
    #[ts(type = "number")] pub route_revision: u64,
    pub reasoning: String, pub speed: String,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloUsageResponse {
    pub task_id: String,
    /// Source-owned bounded usage view; contains no prompts, keys or tool output.
    pub usage: serde_json::Value,
    pub capabilities: serde_json::Value,
    pub limits: serde_json::Value,
}

// Story 1.25: native-coordinated private starts. No renderer-supplied thread or classification.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTasksPreflightParams {
    pub workspace_id: String,
    pub route_id: String,
    #[ts(type = "number")]
    pub configuration_revision: u64,
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTasksPreflightResponse {
    pub route_id: String,
    #[ts(type = "number")]
    pub configuration_revision: u64,
    pub reasoning: Vec<String>,
    pub speeds: Vec<String>,
    pub available: bool,
    pub reason: String,
    pub execution_flow: String,
    pub inference_flow: String,
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTasksStartParams {
    pub operation_id: String,
    pub workspace_id: String,
    pub engagement_id: Option<String>,
    pub folder_id: Option<String>,
    pub request: String,
    pub route_id: String,
    #[ts(type = "number")]
    pub configuration_revision: u64,
    pub reasoning: String,
    pub speed: String,
    pub workspace_policy: InquelloWorkspaceExecutionPolicy,
}
impl std::fmt::Debug for InquelloTasksStartParams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InquelloTasksStartParams").field("operation_id", &self.operation_id).finish_non_exhaustive()
    }
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTasksReconcileParams { pub operation_id: String }
#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTasksStartResponse {
    pub operation_id: String, pub task_id: String, pub run_id: String,
    pub thread_id: Option<String>, pub status: String, pub request: String,
    pub accepted: bool, pub reason: Option<String>,
}
impl std::fmt::Debug for InquelloTasksStartResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InquelloTasksStartResponse").field("operation_id", &self.operation_id).field("status", &self.status).finish_non_exhaustive()
    }
}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTasksForThreadParams { pub thread_id: String }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "v2/")]
pub struct InquelloTasksForThreadResponse { pub task_id: String, pub run_id: String, pub workspace_id:String, pub thread_id: String, pub turn_id:Option<String>, pub runtime_id:String, pub status: String }
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[ts(export_to = "v2/")]
pub struct InquelloTasksBootstrapParams { pub workspace_id: String, pub isolated_root: String }

/// Native-to-main authority refresh, never a renderer-controlled verdict.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, JsonSchema, TS)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
#[ts(export_to="v2/")]
pub struct InquelloTaskAuthorityParams {pub workspace_id:String}
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
#[ts(export_to="v2/")]
pub struct InquelloTaskAuthorityResponse {pub workspace_policy:Option<InquelloWorkspaceExecutionPolicy>}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
#[ts(export_to="v2/")]
pub struct InquelloTasksConsumePermissionParams {pub task_id:String,pub request_id:String,pub command:Vec<String>,pub workspace_policy:InquelloWorkspaceExecutionPolicy}

impl std::fmt::Debug for InquelloTasksConsumePermissionParams {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("InquelloTasksConsumePermissionParams").finish_non_exhaustive()
    }
}
#[cfg(test)]
mod task_permission_debug_tests {
    use super::*;
    #[test]
    fn consume_permission_debug_omits_private_command_but_wire_preserves_it() {
        let sentinel="PRIVATE-COMMAND-SENTINEL";
        let value=InquelloTasksConsumePermissionParams {
            task_id:"task".into(), request_id:"request".into(), command:vec!["sh".into(),"-c".into(),sentinel.into()],
            workspace_policy:InquelloWorkspaceExecutionPolicy {workspace_id:"workspace".into(),policy_revision:1,authorization_epoch:1,execution:None},
        };
        assert!(!format!("{value:?}").contains(sentinel));
        let wire=serde_json::to_value(&value).unwrap();
        assert_eq!(wire["command"][2],sentinel);
        assert_eq!(serde_json::from_value::<InquelloTasksConsumePermissionParams>(wire).unwrap(),value);
    }
}

/// Named, bounded private progress read. IDs are derived from durable Task binding.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase", deny_unknown_fields)]
#[ts(export_to="v2/")]
pub struct InquelloTasksProgressParams {
    pub task_id:String,
    pub workspace_policy:InquelloWorkspaceExecutionPolicy,
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase")]
#[ts(export_to="v2/")]
pub struct InquelloTasksProgressResponse {
    pub version:u32, pub task_id:String, pub run_id:String, pub workspace_id:String,
    pub thread_id:String, pub turn_id:String, pub runtime_id:String, pub status:String,
    pub history_incomplete:bool, pub items:Vec<InquelloProgressItem>,
    pub plan:Vec<InquelloProgressStep>, pub results:Vec<InquelloProgressResult>, pub artifact:String,
}
impl std::fmt::Debug for InquelloTasksProgressResponse {
    fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result {
        f.debug_struct("InquelloTasksProgressResponse").field("task_id",&self.task_id).field("status",&self.status).field("history_incomplete",&self.history_incomplete).finish_non_exhaustive()
    }
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase")]
#[ts(export_to="v2/")]
pub struct InquelloProgressItem {
    pub id:String, pub kind:String, pub status:String, pub text:String,
    #[serde(skip_serializing_if="Option::is_none")]
    #[ts(optional)]
    pub application:Option<String>,
    #[serde(skip_serializing_if="Option::is_none")]
    #[ts(optional)]
    pub role:Option<String>,
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase")]
#[ts(export_to="v2/")]
pub struct InquelloProgressStep {
    pub id:String, pub revision:u32, pub text:String, pub status:String, pub evidence_ids:Vec<String>,
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase")]
#[ts(export_to="v2/")]
pub struct InquelloProgressBasis {
    pub kind:String, pub id:String, pub label:String, pub scope:String,
}
#[derive(Serialize, Deserialize, Clone, PartialEq, JsonSchema, TS)]
#[serde(rename_all="camelCase")]
#[ts(export_to="v2/")]
pub struct InquelloProgressResult {
    pub id:String, pub kind:Option<String>, pub text:String, pub checks:String,
    pub check_scope:Option<String>, pub evidence_ids:Vec<String>, pub basis:Option<InquelloProgressBasis>,
}
