//! Native-only private start journal. Authority and candidate preflight must finish
//! before reservation. A receipt is not a dispatch permit: claiming is single-use.
use crate::organise::{PrincipalId, WorkspaceId};
use crate::usage::Choices;
use crate::{DomainError, OperationId};
use serde::{Deserialize, Serialize};
use std::future::Future;

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartTaskIntent {
    pub operation_id: String,
    pub workspace_id: String,
    pub engagement_id: Option<String>,
    pub folder_id: Option<String>,
    /// Exact text submitted; whitespace is not silently rewritten.
    pub request: String,
    pub route_id: String,
    pub configuration_revision: u64,
    pub choices: Choices,
}
impl std::fmt::Debug for StartTaskIntent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StartTaskIntent").field("operation_id", &self.operation_id).finish_non_exhaustive()
    }
}
impl StartTaskIntent {
    pub fn validate(&self) -> Result<(), DomainError> {
        OperationId::parse(&self.operation_id)?;
        WorkspaceId::parse(&self.workspace_id)?;
        if let Some(id)=&self.engagement_id { crate::organise::EngagementId::parse(id)?; }
        if let Some(id)=&self.folder_id { crate::organise::FolderId::parse(id)?; }
        if self.folder_id.is_some() && self.engagement_id.is_none() { return Err(DomainError::InvalidCommand("folder requires Engagement".into())); }
        if self.request.trim().is_empty() || self.request.len() > 128 * 1024 || self.request.chars().any(|c| c.is_control() && !matches!(c, '\n'|'\r'|'\t')) {
            return Err(DomainError::InvalidCommand("request must be nonempty plain text of at most 128 KiB".into()));
        }
        if !matches!(self.route_id.as_str(), "codex-responses"|"claude-api-key") || self.configuration_revision == 0 || self.configuration_revision > i64::MAX as u64 || self.choices.reasoning.is_empty() || self.choices.speed.is_empty() || self.choices.reasoning.len()>64 || self.choices.speed.len()>64 {
            return Err(DomainError::InvalidCommand("explicit current route and supported settings required".into()));
        }
        Ok(())
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="kebab-case")]
pub enum TaskRunStatus { Reserved, Bound, Dispatching, Running, Completed, Failed, Cancelled, Uncertain, SetupFailed }
/// Bounded, content-free evidence that first-turn submission never occurred.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="kebab-case")]
pub enum TaskSetupFailure { AuthorityUnavailable, ThreadSetupFailed, TurnNotIdle }
#[derive(Debug)]
pub enum TaskReservationError { PreEffect(DomainError), Ambiguous(DomainError) }
impl From<DomainError> for TaskReservationError {fn from(error:DomainError)->Self {Self::Ambiguous(error)}}
impl TaskReservationError {pub fn into_domain(self)->DomainError {match self {Self::PreEffect(e)|Self::Ambiguous(e)=>e}}}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskRunBinding {
    pub operation_id: String, pub task_id: String, pub run_id: String,
    pub principal_id: String, pub workspace_id: String, pub runtime_id: String,
    pub thread_id: Option<String>, pub turn_id: Option<String>, pub status: TaskRunStatus,
    pub route_id: String, pub configuration_revision: u64, pub choices: Choices,
    #[serde(default)] pub setup_failure: Option<TaskSetupFailure>,
}
/// No public request field in receipts/diagnostic bindings. Request lives only in
/// governed private Task history, readable through creator-scoped reconciliation.
/// Supplied only by the native coordinator, never deserialized from user input.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NativeTaskDataTier { Real, Synthetic }
impl NativeTaskDataTier {
    pub fn as_str(self) -> &'static str { match self { Self::Real => "real", Self::Synthetic => "synthetic" } }
}
pub trait TaskRunStore: Send + Sync {
    fn reserve_task_run(&self, principal: PrincipalId, intent: StartTaskIntent, runtime_id: &str, now_ms: i64, tier: NativeTaskDataTier) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    /// Called after the SQLite write wait and again immediately before commit.
    fn reserve_task_run_fenced<F, Fut>(&self, principal: PrincipalId, intent: StartTaskIntent, runtime_id: &str, now_ms: i64, tier: NativeTaskDataTier, validate: F) -> impl Future<Output=Result<TaskRunBinding,TaskReservationError>> + Send
        where F: Fn(String) -> Fut + Send + Sync, Fut: Future<Output=Result<(),DomainError>> + Send;
    fn fail_task_setup(&self, principal: PrincipalId, operation: &str, failure: TaskSetupFailure) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    /// Trusted retained-lifecycle observation only; not a dispatch or generic status mutation.
    fn observe_task_terminal(&self, principal: PrincipalId, operation: &str, runtime: &str, thread: &str, turn: &str, status: TaskRunStatus) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    fn find_task_run(&self, principal: PrincipalId, operation: &str) -> impl Future<Output=Result<Option<TaskRunBinding>,DomainError>> + Send;
    fn task_run_request(&self, principal: PrincipalId, operation: &str) -> impl Future<Output=Result<String,DomainError>> + Send;
    fn find_thread_run(&self, principal: PrincipalId, runtime_id: &str, thread_id: &str) -> impl Future<Output=Result<Option<TaskRunBinding>,DomainError>> + Send;
    fn bind_task_thread(&self, principal: PrincipalId, operation: &str, runtime_id: &str, thread_id: &str) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    fn claim_task_dispatch(&self, principal: PrincipalId, operation: &str, runtime_id: &str) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    fn mark_task_run(&self, principal: PrincipalId, operation: &str, status: TaskRunStatus, turn_id: Option<&str>) -> impl Future<Output=Result<TaskRunBinding,DomainError>> + Send;
    /// Only after proving this runtime incarnation ended. Never redispatch.
    fn recover_task_runtime(&self, runtime_id: &str) -> impl Future<Output=Result<u64,DomainError>> + Send;
}

#[cfg(test)]
mod tests {
    use super::*;
    fn intent() -> StartTaskIntent {
        StartTaskIntent { operation_id: "send".into(), workspace_id: "5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e".into(), engagement_id: None, folder_id: None, request: "  R01\t12,500\nR03\t12,500\r\nReconcile these rows.  ".into(), route_id: "claude-api-key".into(), configuration_revision: 1, choices: Choices::default() }
    }
    #[test]
    fn text_is_not_normalized_or_disclosed_in_debug() {
        let c=intent();let original=c.request.clone();assert!(c.validate().is_ok());assert_eq!(c.request,original);
        assert!(!format!("{c:?}").contains("12,500"));
    }
    #[test]
    fn unknown_or_empty_choices_and_whitespace_requests_refuse() {
        let mut c=intent();c.request=" \n\t".into();assert!(c.validate().is_err());
        c=intent();c.choices.reasoning.clear();assert!(c.validate().is_err());
        c=intent();c.configuration_revision=0;assert!(c.validate().is_err());
        c=intent();c.route_id="fallback".into();assert!(c.validate().is_err());
        c=intent();c.folder_id=Some(c.workspace_id.clone());assert!(c.validate().is_err());
    }
}

/// Lifecycle receipts are observations, never reusable dispatch capabilities.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskLifecycleKind { Steer, Stop, Resume }
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskLifecycleStatus { Reserved, Dispatching, Admitted, Interrupted, Completed, Rejected, Uncertain, Unresolved }
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaskLifecycleIntent {
    pub operation_id: String,
    pub kind: TaskLifecycleKind,
    pub expected: TaskRunBinding,
    pub guidance: Option<String>,
    /// Execution incarnation, not an arbitrary renderer-selected runtime.
    pub runtime_id: String,
}
impl std::fmt::Debug for TaskLifecycleIntent {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TaskLifecycleIntent").field("operation_id", &self.operation_id).field("kind", &self.kind).finish_non_exhaustive()
    }
}
impl TaskLifecycleIntent {
    pub fn validate(&self) -> Result<(), DomainError> {
        OperationId::parse(&self.operation_id)?;
        OperationId::parse(&self.expected.operation_id)?;
        crate::organise::TaskId::parse(&self.expected.task_id)?;
        WorkspaceId::parse(&self.expected.workspace_id)?;
        PrincipalId::parse(&self.expected.principal_id)?;
        let reference = |s: &str| !s.is_empty() && s.len() <= 128 && !s.chars().any(|c| c.is_control() || c.is_whitespace());
        if !reference(&self.runtime_id) || !reference(&self.expected.runtime_id) || !reference(&self.expected.run_id)
            || !self.expected.thread_id.as_deref().is_some_and(reference)
            || self.expected.turn_id.as_deref().is_some_and(|s| !reference(s)) {
            return Err(DomainError::InvalidCommand("verified retained runtime linkage required".into()));
        }
        if self.guidance.as_ref().is_some_and(|s| s.trim().is_empty() || s.len() > 128 * 1024 || s.chars().any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t')))
            || (self.kind == TaskLifecycleKind::Steer && self.guidance.is_none())
            || (self.kind == TaskLifecycleKind::Stop && self.guidance.is_some()) {
            return Err(DomainError::InvalidCommand("invalid lifecycle guidance".into()));
        }
        Ok(())
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskLifecycleReceipt {
    pub operation_id: String,
    pub kind: TaskLifecycleKind,
    pub binding: TaskRunBinding,
    pub status: TaskLifecycleStatus,
}
/// Callers must validate current authority, retained-context access, route evidence,
/// credentials/settings and limits; a journal record alone grants none of these.
pub trait TaskLifecycleStore: Send + Sync {
    fn reserve_task_lifecycle_fenced<F, Fut>(&self, principal: PrincipalId, intent: TaskLifecycleIntent, validate: F) -> impl Future<Output = Result<TaskLifecycleReceipt, DomainError>> + Send
        where F: Fn(TaskRunBinding) -> Fut + Send + Sync, Fut: Future<Output = Result<(), DomainError>> + Send;
    fn claim_task_lifecycle_fenced<F, Fut>(&self, principal: PrincipalId, operation: &str, validate: F) -> impl Future<Output = Result<TaskLifecycleReceipt, DomainError>> + Send
        where F: Fn(TaskRunBinding) -> Fut + Send + Sync, Fut: Future<Output = Result<(), DomainError>> + Send;
    fn find_task_lifecycle(&self, principal: PrincipalId, operation: &str) -> impl Future<Output = Result<Option<TaskLifecycleReceipt>, DomainError>> + Send;
    fn finish_task_lifecycle(&self, principal: PrincipalId, operation: &str, runtime: &str, thread: &str, turn: Option<&str>, status: TaskLifecycleStatus) -> impl Future<Output = Result<TaskLifecycleReceipt, DomainError>> + Send;
}
