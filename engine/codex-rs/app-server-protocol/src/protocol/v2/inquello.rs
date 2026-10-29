//! Inquello private Workspace organisation (Story 1.14) and Task states
//! (Story 1.15): `inquello/*` methods.
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
//! `invalid_value` or `store_failure`.

use crate::JsonSchema;
use crate::TS;
use serde::Deserialize;
use serde::Serialize;

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
