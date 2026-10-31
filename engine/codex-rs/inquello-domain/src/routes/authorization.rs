//! Story 1.28: evidence is compiled capability, never an operator assertion.
//! Current authority is a single-operation observation, not an offline lease.
use super::{RouteConfiguration, RouteEligibility, RouteVerification};
use crate::capability::{CapabilityRegister, Enablement};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use sha2::{Digest, Sha256};

pub const AUTHORIZATION_SUITE: &str = "inquello-current-route-negative-authorization-v1";
pub const REQUIRED_AUTHORIZATION_SCENARIOS: &[&str] = &[
    "cross-workspace", "peer-private", "foreign-thread", "foreign-tool",
    "revoked-before-dispatch", "revoked-during-model", "revoked-during-tool",
    "revoked-during-permission", "late-output", "authority-unavailable",
    "retained-output", "reopen", "export", "recovery", "authorized-procurement",
    "authorized-export", "authorized-recovery",
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteEvidenceIdentity {
    pub route_id: String,
    pub deployment: String,
    pub endpoint: String,
    pub model: String,
    pub api_version: String,
    pub configuration_digest: String,
    pub implementation_digest: String,
    pub runtime_version: String,
    pub contract_version: String,
    pub platform: String,
}
impl RouteEvidenceIdentity {
    pub fn matches_configuration(&self, configuration: &RouteConfiguration) -> bool {
        self.route_id == configuration.route_id().as_str()
            && self.deployment == configuration.deployment()
            && self.endpoint == configuration.endpoint()
            && self.model == configuration.model()
            && self.api_version == configuration.api_version()
            && self.configuration_digest == configuration_digest(configuration)
    }
    pub fn valid(&self) -> bool {
        super::RouteId::parse(&self.route_id).is_some()
            && [&self.deployment, &self.endpoint, &self.model, &self.api_version,
                &self.runtime_version, &self.contract_version, &self.platform]
                .into_iter().all(|s| !s.trim().is_empty() && s.len() <= 512)
            && [&self.configuration_digest, &self.implementation_digest]
                .into_iter().all(|s| sha256_digest(s))
    }
}
/// Versioned canonical input includes account binding and explicit unknown region.
pub fn configuration_digest(configuration: &RouteConfiguration) -> String {
    let fields = ("inquello-route-configuration-v1", configuration.route_id().as_str(),
        configuration.deployment(), configuration.endpoint(), configuration.model(),
        configuration.api_version(), configuration.account_ref(), configuration.region());
    let bytes = serde_json::to_vec(&fields).unwrap_or_default();
    format!("{:x}", Sha256::digest(bytes))
}
pub fn sha256_digest(value: &str) -> bool {
    value.len() == 64 && value.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ScenarioStatus { Passed, Failed, Skipped, NotRun }

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NegativeAuthorizationEvidence {
    pub suite: String,
    /// Actual tested executable bytes, separate from the normalized live build identity.
    pub tested_artifact_digest: String,
    pub processing_scope: String,
    pub data_policy_digest: String,
    pub identity: RouteEvidenceIdentity,
    pub scenarios: BTreeMap<String, ScenarioStatus>,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
    pub command: String,
    pub environment: String,
    pub report_digest: String,
    pub limitations: Vec<String>,
}
impl NegativeAuthorizationEvidence {
    pub fn complete(&self) -> bool {
        self.suite == AUTHORIZATION_SUITE && self.identity.valid()
            && sha256_digest(&self.tested_artifact_digest) && sha256_digest(&self.data_policy_digest)
            && !self.processing_scope.trim().is_empty()
            && sha256_digest(&self.report_digest)
            && !self.command.trim().is_empty() && !self.environment.trim().is_empty()
            && !self.limitations.is_empty() && self.limitations.iter().all(|s| !s.trim().is_empty())
            && self.failed == 0 && self.skipped == 0
            && self.passed as usize == self.scenarios.len()
            && self.scenarios.values().all(|s| *s == ScenarioStatus::Passed)
            && REQUIRED_AUTHORIZATION_SCENARIOS.iter().all(|name|
                self.scenarios.get(*name) == Some(&ScenarioStatus::Passed))
    }
}

/// No arbitrary register parameter: operator/runtime input cannot raise the compiled maximum.
pub fn compiled_evidence_for_identity(identity: &RouteEvidenceIdentity) -> Option<NegativeAuthorizationEvidence> {
    let register = CapabilityRegister::load_embedded().ok()?;
    let route = super::RouteId::parse(&identity.route_id)?;
    let proof = register.entry(route.capability_id())?.negative_authorization.as_ref()?;
    reviewed_evidence(&register, identity, &proof.report_digest).cloned()
}
pub fn compiled_route_evidence(identity: &RouteEvidenceIdentity, report_digest: &str) -> Option<NegativeAuthorizationEvidence> {
    let register = CapabilityRegister::load_embedded().ok()?;
    reviewed_evidence(&register, identity, report_digest).cloned()
}
fn reviewed_evidence<'a>(register: &'a CapabilityRegister, identity: &RouteEvidenceIdentity, report_digest: &str) -> Option<&'a NegativeAuthorizationEvidence> {
    let route = super::RouteId::parse(&identity.route_id)?;
    let entry = register.entry(route.capability_id())?;
    if entry.enablement() != Enablement::RealDataEligible { return None; }
    entry.negative_authorization.as_ref().filter(|proof|
        proof.complete() && proof.processing_scope == entry.processing_scope && &proof.identity == identity && proof.report_digest == report_digest)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OrganizationRouteApproval {
    pub workspace_id: String,
    pub route_id: String,
    pub evidence_digest: String,
    pub processing_scope: String,
    pub data_policy_digest: String,
    pub issuer: String,
    pub operator_reference: String,
    pub valid_from: i64,
    pub expires_at: i64,
    pub review_at: i64,
    #[serde(with = "revision_wire")]
    pub revision: u64,
    #[serde(with = "revision_wire")]
    pub policy_revision: u64,
    pub revoked: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProtectedRouteAction { Read, Derive, Export }

/// Constructed by the trusted host from native Task provenance, never input text.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ProtectedRouteUse {
    pub action: ProtectedRouteAction,
    pub principal_id: String,
    pub session_id: String,
    pub task_id: String,
    pub workspace_id: String,
    pub operation_id: String,
    pub generation: u64,
    #[serde(with = "revision_wire")]
    pub principal_revision: u64,
    #[serde(with = "revision_wire")]
    pub session_revision: u64,
    #[serde(with = "revision_wire")]
    pub authorization_epoch: u64,
    #[serde(with = "revision_wire")]
    pub policy_revision: u64,
    #[serde(with = "revision_wire")]
    pub approval_revision: u64,
    pub processing_scope: String,
    pub data_policy_digest: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CurrentRouteAuthority {
    pub binding: ProtectedRouteUse,
    pub approval: OrganizationRouteApproval,
    /// Service transaction time, not a client TTL. Reusing this object is forbidden.
    pub checked_at: i64,
}

pub fn protected_route_eligibility(configuration: &RouteConfiguration, credential_present: bool, adapter_supported: bool, identity: &RouteEvidenceIdentity, expected: &ProtectedRouteUse, authority: Option<&CurrentRouteAuthority>) -> RouteEligibility {
    let register = CapabilityRegister::load_embedded().ok();
    protected_eligibility(configuration, credential_present, adapter_supported, identity, expected, authority, register.as_ref())
}
fn protected_eligibility(configuration: &RouteConfiguration, credentials: bool, adapter: bool, identity: &RouteEvidenceIdentity, expected: &ProtectedRouteUse, authority: Option<&CurrentRouteAuthority>, register: Option<&CapabilityRegister>) -> RouteEligibility {
    let mut result = RouteEligibility { verification: RouteVerification::NotVerified, enabled: false, gate: Some("Complete reviewed exact-build negative-authorization evidence and current organization approval are required"), evidence: vec![] };
    let Some(authority) = authority else { return result; };
    let Some(proof) = register.and_then(|r| reviewed_evidence(r, identity, &authority.approval.evidence_digest)) else { return result; };
    if !identity.matches_configuration(configuration) || proof.processing_scope != expected.processing_scope
        || proof.data_policy_digest != expected.data_policy_digest { return result; }
    result.verification = RouteVerification::VerifiedForRealData;
    result.evidence.push(proof.report_digest.clone());
    let approval = &authority.approval;
    let valid_ids = [&expected.principal_id, &expected.session_id, &expected.task_id, &expected.workspace_id, &expected.operation_id].into_iter().all(|id| uuid::Uuid::parse_str(id).is_ok());
    if !valid_ids || &authority.binding != expected || approval.revoked
        || approval.workspace_id != expected.workspace_id || approval.route_id != identity.route_id
        || approval.processing_scope != expected.processing_scope || expected.processing_scope.trim().is_empty()
        || approval.data_policy_digest != expected.data_policy_digest || !sha256_digest(&expected.data_policy_digest)
        || approval.policy_revision != expected.policy_revision || approval.revision != expected.approval_revision
        || approval.revision == 0 || approval.policy_revision == 0 || expected.authorization_epoch == 0
        || expected.principal_revision == 0 || expected.session_revision == 0 || expected.generation == 0
        || approval.issuer.trim().is_empty() || approval.operator_reference.trim().is_empty()
        || authority.checked_at < approval.valid_from || authority.checked_at >= approval.expires_at
        || authority.checked_at >= approval.review_at || approval.valid_from >= approval.review_at
        || approval.review_at > approval.expires_at {
        result.gate = Some("Current organization approval is missing, stale, revoked or outside its scope");
    } else if !adapter || !credentials {
        result.gate = Some("Selected route credential or supported adapter is unavailable");
    } else { result.enabled = true; result.gate = None; }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> (RouteConfiguration, NegativeAuthorizationEvidence, ProtectedRouteUse, CurrentRouteAuthority) {
        let config = RouteConfiguration::parse(super::super::RouteConfigurationInput {
            route_id: "codex-responses".into(), deployment: "openai-api".into(),
            model: "fixture-model".into(), api_version: "fixture-api".into(),
            account_ref: "11111111-1111-4111-8111-111111111111".into(), region: None,
        }).unwrap();
        let proof = NegativeAuthorizationEvidence {
            suite: AUTHORIZATION_SUITE.into(), tested_artifact_digest: "c".repeat(64),
            processing_scope: "fixture-scope".into(), data_policy_digest: "e".repeat(64), identity: RouteEvidenceIdentity {
                route_id: "codex-responses".into(), deployment: config.deployment().into(),
                endpoint: config.endpoint().into(), model: config.model().into(), api_version: config.api_version().into(),
                configuration_digest: configuration_digest(&config), implementation_digest: "b".repeat(64),
                runtime_version: "fixture-runtime".into(), contract_version: "fixture-contract".into(),
                platform: "fixture-platform".into(),
            }, scenarios: REQUIRED_AUTHORIZATION_SCENARIOS.iter().map(|name| (name.to_string(), ScenarioStatus::Passed)).collect(),
            passed: REQUIRED_AUTHORIZATION_SCENARIOS.len() as u32, failed: 0, skipped: 0,
            command: "fixture only".into(), environment: "unit fixture".into(), report_digest: "d".repeat(64),
            limitations: vec!["Unit fixture, not actual negative authorization execution".into()],
        };
        let binding = ProtectedRouteUse {
            action: ProtectedRouteAction::Derive,
            principal_id: uuid::Uuid::new_v4().to_string(), session_id: uuid::Uuid::new_v4().to_string(),
            task_id: uuid::Uuid::new_v4().to_string(), workspace_id: uuid::Uuid::new_v4().to_string(),
            operation_id: uuid::Uuid::new_v4().to_string(), generation: 1, principal_revision: 1, session_revision: 1, authorization_epoch: 1,
            policy_revision: 1, approval_revision: 1, processing_scope: "fixture-scope".into(), data_policy_digest: "e".repeat(64),
        };
        let authority = CurrentRouteAuthority { binding: binding.clone(), checked_at: 100,
            approval: OrganizationRouteApproval {
                workspace_id: binding.workspace_id.clone(), route_id: proof.identity.route_id.clone(),
                evidence_digest: proof.report_digest.clone(), processing_scope: binding.processing_scope.clone(),
                data_policy_digest: binding.data_policy_digest.clone(), issuer: "fixture-issuer".into(),
                operator_reference: "fixture-reference".into(), valid_from: 90, review_at: 110, expires_at: 120,
                revision: 1, policy_revision: 1, revoked: false,
            }};
        (config, proof, binding, authority)
    }
    fn register(proof: &NegativeAuthorizationEvidence) -> CapabilityRegister {
        CapabilityRegister::from_json(&serde_json::json!({"schema_version":1,"entries":[{
            "id":"processing.codex-responses","owner":"fixture","supply":"fixture",
            "versions":{"fixture":"1"},"limits":["fixture only"],"identity":"fixture",
            "formats":["text"],"processing_scope":"fixture-scope","eligibility":"real-data-eligible",
            "evidence":[{"kind":"synthetic","status":"passed","reference":"fixture"},
                {"kind":"negative-authorization","status":"passed","reference":"fixture"}],
            "negative_authorization":proof
        }]}).to_string()).unwrap()
    }
    #[test]
    fn final_read_requires_fresh_same_task_authority_after_approval_boundary() {
        let (config,proof,mut binding,mut authority)=fixture();let register=register(&proof);
        binding.action=ProtectedRouteAction::Read;authority.binding=binding.clone();
        let check=|current:&CurrentRouteAuthority|protected_eligibility(&config,true,true,&proof.identity,&binding,Some(current),Some(&register)).enabled;
        assert!(check(&authority),"authorized metadata read control");
        let mut after_wait=authority.clone();after_wait.checked_at=authority.approval.review_at;
        assert!(!check(&after_wait),"unchanged membership does not extend approval past its review boundary");
        after_wait=authority.clone();after_wait.checked_at=authority.approval.expires_at;
        assert!(!check(&after_wait),"expiry after a metadata wait denies final read");
        after_wait=authority.clone();after_wait.approval.revoked=true;
        assert!(!check(&after_wait),"withdrawal denies final read");
        after_wait=authority;after_wait.binding.task_id=uuid::Uuid::new_v4().to_string();
        assert!(!check(&after_wait),"Workspace-only authority cannot replace exact Task identity");
    }
    #[test]
    fn every_required_scenario_and_count_must_actually_pass() {
        let (_, proof, _, _) = fixture();
        assert!(proof.complete());
        for scenario in REQUIRED_AUTHORIZATION_SCENARIOS {
            for status in [ScenarioStatus::Failed, ScenarioStatus::Skipped, ScenarioStatus::NotRun] {
                let mut changed = proof.clone(); changed.scenarios.insert(scenario.to_string(), status);
                assert!(!changed.complete(), "{scenario}: {status:?}");
            }
            let mut changed = proof.clone(); changed.scenarios.remove(*scenario); assert!(!changed.complete());
        }
        let mut changed = proof.clone(); changed.passed += 1; assert!(!changed.complete());
        let mut changed = proof.clone(); changed.failed = 1; assert!(!changed.complete());
        let mut changed = proof.clone(); changed.skipped = 1; assert!(!changed.complete());
        let mut changed = proof; changed.report_digest = "unknown".into(); assert!(!changed.complete());
    }
    #[test]
    fn exact_identity_conjunction_and_current_operation_binding() {
        let (config, proof, binding, authority) = fixture(); let register = register(&proof);
        let check = |identity: &RouteEvidenceIdentity, current: Option<&CurrentRouteAuthority>| protected_eligibility(&config, true, true, identity, &binding, current, Some(&register)).enabled;
        assert!(check(&proof.identity, Some(&authority)));
        assert!(!check(&proof.identity, None));
        for mut input in [config.input(),config.input()] {
            input.account_ref=uuid::Uuid::new_v4().to_string();
            let changed=RouteConfiguration::parse(input.clone()).unwrap();
            assert!(!protected_eligibility(&changed,true,true,&proof.identity,&binding,Some(&authority),Some(&register)).enabled);
            input=config.input();input.region=Some("fixture-other-region".into());
            let changed=RouteConfiguration::parse(input).unwrap();
            assert!(!protected_eligibility(&changed,true,true,&proof.identity,&binding,Some(&authority),Some(&register)).enabled);
        }
        assert!(!protected_route_eligibility(&config, true, true, &proof.identity, &binding, Some(&authority)).enabled, "unit fixtures never promote shipped routes");
        let serialized = serde_json::to_value(&proof.identity).unwrap();
        for key in serialized.as_object().unwrap().keys() {
            let mut altered = serialized.clone(); altered[key] = serde_json::json!("different");
            let identity = serde_json::from_value(altered).unwrap();
            assert!(!check(&identity, Some(&authority)), "identity field {key}");
        }
        let serialized = serde_json::to_value(&binding).unwrap();
        for key in serialized.as_object().unwrap().keys() {
            let mut altered = serialized.clone();
            altered[key] = if key == "action" { serde_json::json!("read") }
                else if altered[key].is_number() { serde_json::json!(2) }
                else if key.ends_with("revision") || key == "authorization_epoch" { serde_json::json!("2") }
                else { serde_json::json!(uuid::Uuid::new_v4().to_string()) };
            let mut stale = authority.clone(); stale.binding = serde_json::from_value(altered).unwrap();
            assert!(!check(&proof.identity, Some(&stale)), "binding field {key}");
        }
        for timestamp in [89,110,120] { let mut changed = authority.clone(); changed.checked_at = timestamp; assert!(!check(&proof.identity, Some(&changed))); }
        let mut revoked = authority.clone(); revoked.approval.revoked = true; assert!(!check(&proof.identity, Some(&revoked)));
        assert!(!protected_eligibility(&config, false, true, &proof.identity, &binding, Some(&authority), Some(&register)).enabled);
        assert!(!protected_eligibility(&config, true, false, &proof.identity, &binding, Some(&authority), Some(&register)).enabled);
    }
}

mod revision_wire {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(value: &u64, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&value.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(deserializer: D) -> Result<u64, D::Error> {
        let value = String::deserialize(deserializer)?;
        if value.is_empty() || (value.len() > 1 && value.starts_with('0')) || !value.bytes().all(|b| b.is_ascii_digit()) {
            return Err(serde::de::Error::custom("canonical decimal revision required"));
        }
        value.parse().map_err(serde::de::Error::custom)
    }
}
