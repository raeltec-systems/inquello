//! Model-authored presentation, never authority or independent check evidence.
//! Retained in the existing native function-call/output history, not a new store.
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

pub const VERSION: u32 = 1;
pub const MAX_TEXT: usize = 16_384;
pub const MAX_PUBLICATION: usize = 65_536;
/// Final native wire projection ceiling, including JSON escapes and metadata.
/// Leaves headroom below the desktop 768 KiB refusal boundary.
pub const MAX_PROJECTION_BYTES: usize = 655_360;

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Publication {
    pub version: u32,
    pub plan: Vec<PlanStep>,
    pub results: Vec<ResultClaim>,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanStep {
    pub id: String,
    pub revision: u32,
    pub text: String,
    pub status: PlanClaim,
    pub evidence_ids: Vec<String>,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PlanClaim { Pending, Running, Completed }
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ResultClaim {
    pub id: String,
    pub kind: ResultKind,
    pub text: String,
    pub evidence_ids: Vec<String>,
    /// An exact retained human instruction ID, not an author/model supplied name.
    /// An unresolved reference never becomes an authoritative decision cue.
    pub basis_id: Option<String>,
    #[serde(default = "initial_revision")]
    pub revision: u32,
    #[serde(default)]
    pub state: ResultState,
    #[serde(default)]
    pub change_reason: Option<String>,
}
fn initial_revision() -> u32 { 1 }
#[derive(Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResultState { #[default] Current, Withdrawn }
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResultKind { Calculation, Observation, Suggestion, Decision, Gap }

fn id(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128 && value.bytes().all(|b| b.is_ascii_alphanumeric() || b"-_.:".contains(&b))
}
fn text(value: &str) -> bool { !value.trim().is_empty() && value.len() <= MAX_TEXT && !value.contains('\0') }
fn reason(value:&str)->bool {text(value) && !value.chars().any(|c|c.is_control() && !matches!(c,'\n'|'\r'|'\t'))}
fn references(values: &[String]) -> bool { values.len() <= 16 && values.iter().all(|v| id(v)) }
impl Publication {
    pub fn parse(raw: &str) -> Result<Self, &'static str> {
        if raw.len() > MAX_PUBLICATION { return Err("Publication exceeds bounds"); }
        let publication: Self = serde_json::from_str(raw).map_err(|_| "Structured labels unavailable")?;
        if publication.version != VERSION || publication.plan.len() > 64 || publication.results.len() > 64 {
            return Err("Unsupported publication version or item count");
        }
        let mut ids = HashSet::new();
        for step in &publication.plan {
            if !id(&step.id) || !ids.insert(&step.id) || step.revision == 0 || !text(&step.text) || !references(&step.evidence_ids) {
                return Err("Invalid plan identity, revision or evidence references");
            }
        }
        ids.clear();
        for result in &publication.results {
            if !id(&result.id) || !ids.insert(&result.id) || !text(&result.text) || !references(&result.evidence_ids)
                || result.basis_id.as_ref().is_some_and(|v| !id(v)) || result.revision == 0
                || result.change_reason.as_ref().is_some_and(|v| !reason(v))
                || ((result.revision > 1 || result.state == ResultState::Withdrawn) && result.change_reason.is_none()) {
                return Err("Invalid result identity or evidence references");
            }
        }
        Ok(publication)
    }
}
impl std::fmt::Debug for Publication {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Publication").field("version", &self.version).field("plan_count", &self.plan.len()).field("result_count", &self.results.len()).finish_non_exhaustive()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn revisions_and_withdrawals_need_explicit_reason_and_cannot_claim_review() {
        let mut v=serde_json::json!({"version":1,"plan":[],"results":[{"id":"duplicate","kind":"observation","text":"Cancelled duplicate withdrawn","evidenceIds":[],"revision":2,"state":"withdrawn","changeReason":"Exclude cancelled invoices"}]});
        assert!(Publication::parse(&v.to_string()).is_ok());
        v["results"][0].as_object_mut().unwrap().remove("changeReason");
        assert!(Publication::parse(&v.to_string()).is_err());
        v["results"][0]["changeReason"]=serde_json::json!("Exclude cancelled invoices");
        v["results"][0]["checks"]=serde_json::json!("checked");
        assert!(Publication::parse(&v.to_string()).is_err());
    }
    #[test]
    fn revision_reasons_preserve_supported_text_and_reject_unsupported_controls() {
        for reason in ["Correction\nwith lines\tand tabs\r", "Ordinary correction"] {
            let raw=serde_json::json!({"version":1,"plan":[],"results":[{"id":"finding","kind":"observation","text":"Finding","revision":2,"changeReason":reason,"evidenceIds":[]}]}).to_string();
            assert_eq!(Publication::parse(&raw).unwrap().results[0].change_reason.as_deref(),Some(reason));
        }
        for control in ['\0','\u{1b}','\u{7}','\u{7f}','\u{85}'] {
            let raw=serde_json::json!({"version":1,"plan":[],"results":[{"id":"finding","kind":"observation","text":"Finding","revision":2,"changeReason":format!("Correction{control}hidden"),"evidenceIds":[]}]}).to_string();
            assert!(Publication::parse(&raw).is_err());
        }
    }
    #[test]
    fn model_cannot_supply_trusted_checks_or_authority() {
        for field in ["checks", "checked", "authority", "principalId", "runtimeId"] {
            let mut v = serde_json::json!({"version":1,"plan":[],"results":[]});
            v[field] = serde_json::json!(true);
            assert!(Publication::parse(&v.to_string()).is_err());
        }
    }
    #[test]
    fn stable_ids_revisions_and_bounds_are_required() {
        let valid = r#"{"version":1,"plan":[{"id":"compare","revision":1,"text":"Compare fictional R01/R03","status":"completed","evidenceIds":["cmd-1"]}],"results":[]}"#;
        assert!(Publication::parse(valid).is_ok());
        assert!(Publication::parse(&valid.replace("\"revision\":1", "\"revision\":0")).is_err());
        assert!(Publication::parse(&valid.replace("\"version\":1", "\"version\":2")).is_err());
        assert!(Publication::parse(&"x".repeat(MAX_PUBLICATION + 1)).is_err());
        assert!(!format!("{:?}", Publication::parse(valid).unwrap()).contains("R01"));
    }
}
