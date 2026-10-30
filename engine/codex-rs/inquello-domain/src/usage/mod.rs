//! Creator-private consumption records. Only native dispatch code may submit events;
//! this port is deliberately not a renderer recording API. Unknown is not zero.
use crate::organise::{Actor, PrincipalId, TaskId};
use crate::{DomainError, OperationId};
use serde::{Deserialize, Serialize};
use std::future::Future;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Choices { pub reasoning: String, pub speed: String }
impl Default for Choices {
    fn default() -> Self { Self { reasoning: "default".into(), speed: "default".into() } }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskUsageSettings { pub revision: u64, pub route_revision: u64, pub choices: Choices }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OperationKind { HumanRequestedModel, AutomatedPermissionReview, LocalTool }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttemptSnapshot {
    pub attempt_id: String, pub task_id: String, pub principal_id: String,
    pub run_id: String, pub runtime_id: String, pub operation_kind: OperationKind,
    pub route_id: Option<String>, pub model: Option<String>, pub api_version: Option<String>,
    pub configuration_revision: u64, pub route_revision: u64,
    pub settings_revision: u64, pub requested: Choices, pub effective: Choices,
    pub started_at_ms: i64,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AttemptStatus { Running, Completed, Failed, Cancelled, Uncertain, Refused }
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Consumption {
    pub input_tokens: Option<u64>, pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>, pub cache_write_tokens: Option<u64>,
    /// Decimal monetary value from the provider, never an estimated price.
    pub cost: Option<String>, pub currency: Option<String>, pub provenance: Option<String>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UsageEventKind { Cumulative, Delta }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct UsageEvent { pub event_id: String, pub sequence: u64, pub kind: UsageEventKind, pub usage: Consumption }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttemptRecord {
    pub snapshot: AttemptSnapshot, pub status: AttemptStatus, pub ended_at_ms: Option<i64>,
    pub elapsed_ms: Option<u64>, pub output_ref: Option<String>, pub usage: Consumption,
    pub events: Vec<UsageEvent>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskUsage { pub settings: Option<TaskUsageSettings>, pub attempts: Vec<AttemptRecord> }
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SetUsageSettings {
    pub operation_id: String, pub task_id: String, pub expected_revision: u64,
    pub route_revision: u64, pub choices: Choices,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FinishAttempt {
    pub status: AttemptStatus, pub ended_at_ms: i64, pub elapsed_ms: u64, pub output_ref: Option<String>,
}
/// Every implementation rechecks the Task creator inside its transaction, before
/// receipt lookup. Read history is bounded to the most recent 100 attempts.
pub trait UsageStore: Send + Sync {
    fn read_usage(&self, principal: PrincipalId, task: TaskId) -> impl Future<Output=Result<TaskUsage, DomainError>> + Send;
    fn save_usage_settings(&self, principal: PrincipalId, command: SetUsageSettings) -> impl Future<Output=Result<TaskUsageSettings, DomainError>> + Send;
    fn begin_usage_attempt(&self, snapshot: AttemptSnapshot) -> impl Future<Output=Result<AttemptRecord, DomainError>> + Send;
    fn record_usage_event(&self, principal: PrincipalId, task: TaskId, attempt: &str, event: UsageEvent) -> impl Future<Output=Result<(), DomainError>> + Send;
    fn finish_usage_attempt(&self, principal: PrincipalId, task: TaskId, attempt: &str, finish: FinishAttempt) -> impl Future<Output=Result<(), DomainError>> + Send;
    /// Call only after proving this runtime incarnation has ended, not on every
    /// connection/open (another process may still own running attempts).
    fn recover_usage_runtime(&self, runtime_id: &str) -> impl Future<Output=Result<u64, DomainError>> + Send;
}
pub async fn task_usage<S: UsageStore>(store: &S, actor: Actor, task: &str) -> Result<TaskUsage, DomainError> {
    store.read_usage(actor.principal_id, TaskId::parse(task)?).await
}
/// Capabilities must come from the native selected-model catalog, never renderer
/// input. Messages supplies only `default`; explicit unsupported values fail.
pub async fn set_task_usage_settings<S: UsageStore>(store: &S, actor: Actor, command: SetUsageSettings,
    reasoning: &[String], speeds: &[String]) -> Result<TaskUsageSettings, DomainError> {
    TaskId::parse(&command.task_id)?; OperationId::parse(&command.operation_id)?;
    if !reasoning.contains(&command.choices.reasoning) || !speeds.contains(&command.choices.speed) {
        return Err(DomainError::InvalidCommand("selected model does not support these reasoning/speed choices".into()));
    }
    store.save_usage_settings(actor.principal_id, command).await
}
/// Recompute in sequence order so out-of-order delivery cannot change totals.
/// A cumulative snapshot replaces preceding totals; subsequent deltas add once.
pub fn consumption(events: &[UsageEvent]) -> Result<Consumption, DomainError> {
    let mut ordered: Vec<_> = events.iter().collect(); ordered.sort_by_key(|e| e.sequence);
    let mut result = Consumption::default();
    for event in ordered {
        if event.usage.cost.is_some() && (event.usage.currency.is_none() || event.usage.provenance.is_none()) {
            return Err(DomainError::InvalidCommand("reported cost requires currency and provenance".into()));
        }
        if let Some(cost) = &event.usage.cost {
            let mut dots = 0;
            if cost.is_empty() || cost.len() > 64 || !cost.bytes().all(|c| {
                if c == b'.' { dots += 1; dots <= 1 } else { c.is_ascii_digit() }
            }) || cost.starts_with('.') || cost.ends_with('.') || event.usage.currency.as_ref().is_some_and(|c| c.len() != 3 || !c.bytes().all(|b| b.is_ascii_uppercase()))
                || event.usage.provenance.as_ref().is_some_and(|p| p.is_empty() || p.len() > 128) {
                return Err(DomainError::InvalidCommand("invalid reported monetary amount".into()));
            }
        }
        match event.kind {
            UsageEventKind::Cumulative => result = event.usage.clone(),
            UsageEventKind::Delta => {
                fn add(a: Option<u64>, b: Option<u64>) -> Result<Option<u64>, DomainError> {
                    match (a,b) { (Some(a),Some(b)) => a.checked_add(b).map(Some).ok_or(DomainError::InvalidValue), _ => Ok(None) }
                }
                // First delta establishes known categories; absent categories stay unknown.
                if event.sequence == events.iter().map(|e| e.sequence).min().unwrap_or(0) {
                    result = event.usage.clone();
                } else {
                    result.input_tokens = add(result.input_tokens, event.usage.input_tokens)?;
                    result.output_tokens = add(result.output_tokens, event.usage.output_tokens)?;
                    result.cache_read_tokens = add(result.cache_read_tokens, event.usage.cache_read_tokens)?;
                    result.cache_write_tokens = add(result.cache_write_tokens, event.usage.cache_write_tokens)?;
                    // Do not add decimal amounts without a provider-defined scale.
                    result.cost = None; result.currency = None; result.provenance = None;
                }
            }
        }
    }
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn event(id:&str, seq:u64, kind:UsageEventKind, n:Option<u64>) -> UsageEvent { UsageEvent {event_id:id.into(),sequence:seq,kind,usage:Consumption {input_tokens:n,..Default::default()}} }
    #[test] fn cumulative_is_not_added_and_late_events_are_ordered() {
        let a=event("a",1,UsageEventKind::Cumulative,Some(10)); let b=event("b",2,UsageEventKind::Cumulative,Some(20));
        assert_eq!(consumption(&[b,a]).unwrap().input_tokens,Some(20));
    }
    #[test] fn unknown_is_not_zero() {
        assert_eq!(consumption(&[]).unwrap().input_tokens,None);
        assert_eq!(consumption(&[event("a",1,UsageEventKind::Delta,Some(3)),event("b",2,UsageEventKind::Delta,None)]).unwrap().input_tokens,None);
    }
}

#[cfg(test)]
mod decimal_tests {
 use super::*;
 #[test] fn monetary_grammar_matches_bounded_desktop_projection() {
  for (amount,valid) in [("0",true),("0.5",true),("1.000001",true),(".5",false),("1.",false),(".",false),("-1",false),("1e3",false),("",false)] {
   let event=UsageEvent {event_id:"cost".into(),sequence:0,kind:UsageEventKind::Cumulative,usage:Consumption {cost:Some(amount.into()),currency:Some("USD".into()),provenance:Some("provider".into()),..Default::default()}};
   assert_eq!(consumption(&[event]).is_ok(),valid,"{amount}");
  }
 }
}
