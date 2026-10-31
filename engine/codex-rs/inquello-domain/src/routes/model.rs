use crate::capability::{CapabilityRegister, Enablement};
use crate::organise::{PrincipalId, TaskId, WorkspaceId};
use crate::{DomainError, OperationId, ReceiptStatus, Revision, Timestamp};
use serde::{Deserialize, Serialize};

pub const SET_TASK_ROUTE_COMMAND: &str = "set_task_route";
pub const CLAUDE_MODEL: &str = "claude-sonnet-5-5";
pub const CLAUDE_API_VERSION: &str = "2026-10-21";
pub const CLAUDE_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RouteId {
    CodexResponses,
    ClaudeApiKey,
}

impl RouteId {
    pub const ALL: [Self; 2] = [Self::CodexResponses, Self::ClaudeApiKey];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::CodexResponses => "codex-responses",
            Self::ClaudeApiKey => "claude-api-key",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|id| id.as_str() == value)
    }

    pub const fn capability_id(self) -> &'static str {
        match self {
            Self::CodexResponses => "processing.codex-responses",
            Self::ClaudeApiKey => "processing.claude-api-key",
        }
    }

    pub const fn provider(self) -> &'static str {
        match self {
            Self::CodexResponses => "OpenAI",
            Self::ClaudeApiKey => "Anthropic",
        }
    }
}

/// Input has no credentials, evidence, eligibility or arbitrary endpoint fields.
/// Account references are locally allocated UUIDs, never account email/token.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteConfigurationInput {
    pub route_id: String,
    pub deployment: String,
    pub model: String,
    pub api_version: String,
    pub account_ref: String,
    pub region: Option<String>,
}

/// Validated immutable metadata. Private fields prevent constructing unchecked
/// endpoint/model/account combinations in callers or deserializing around checks.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RouteConfiguration {
    route_id: RouteId,
    deployment: String,
    endpoint: String,
    model: String,
    api_version: String,
    account_ref: String,
    region: Option<String>,
}

impl RouteConfiguration {
    pub fn parse(input: RouteConfigurationInput) -> Result<Self, DomainError> {
        let invalid = || DomainError::InvalidCommand("unsupported processing-route configuration".into());
        let route_id = RouteId::parse(&input.route_id).ok_or_else(invalid)?;
        let endpoint = match (route_id, input.deployment.as_str()) {
            (RouteId::ClaudeApiKey, "anthropic-direct")
                if input.model == CLAUDE_MODEL && input.api_version == CLAUDE_API_VERSION => CLAUDE_ENDPOINT,
            (RouteId::CodexResponses, "openai-api") => "https://api.openai.com/v1/responses",
            (RouteId::CodexResponses, "chatgpt-codex") => "https://chatgpt.com/backend-api/codex/responses",
            _ => return Err(invalid()),
        };
        // Exact model and API identifiers must be supplied; never infer a model
        // from provider login or accept a floating/default alias.
        if !identifier(&input.model) || !identifier(&input.api_version)
            || ["default", "latest", "auto"].contains(&input.model.as_str())
            || ["default", "latest", "auto"].contains(&input.api_version.as_str())
        {
            return Err(invalid());
        }
        let account_ref = uuid::Uuid::parse_str(&input.account_ref)
            .map_err(|_| invalid())?.to_string();
        if input.region.as_ref().is_some_and(|region| !identifier(region)
            || ["unknown", "auto", "default"].contains(&region.as_str()))
        {
            return Err(invalid());
        }
        Ok(Self {
            route_id,
            deployment: input.deployment,
            endpoint: endpoint.to_string(),
            model: input.model,
            api_version: input.api_version,
            account_ref,
            region: input.region,
        })
    }

    pub const fn route_id(&self) -> RouteId { self.route_id }
    pub fn deployment(&self) -> &str { &self.deployment }
    pub fn endpoint(&self) -> &str { &self.endpoint }
    pub fn model(&self) -> &str { &self.model }
    pub fn api_version(&self) -> &str { &self.api_version }
    pub fn account_ref(&self) -> &str { &self.account_ref }
    pub fn region(&self) -> Option<&str> { self.region.as_deref() }

    pub fn input(&self) -> RouteConfigurationInput {
        RouteConfigurationInput {
            route_id: self.route_id.as_str().to_string(),
            deployment: self.deployment.clone(),
            model: self.model.clone(),
            api_version: self.api_version.clone(),
            account_ref: self.account_ref.clone(),
            region: self.region.clone(),
        }
    }
}

fn identifier(value: &str) -> bool {
    !value.is_empty() && value.len() <= 128
        && value.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'.' | b'-' | b'_'))
        && !value.starts_with("sk-")
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DataTier { Synthetic, Real }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RouteVerification { NotVerified, VerifiedForSynthetic, VerifiedForRealData }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteEligibility {
    pub verification: RouteVerification,
    pub enabled: bool,
    pub gate: Option<&'static str>,
    pub evidence: Vec<String>,
}

/// Credentials/adapter facts may reduce availability; only compiled, exact
/// route/model/API/deployment-matched evidence can establish verification.
/// Without current per-operation organization authority this entry point cannot enable real data.
pub fn route_eligibility(
    configuration: Option<&RouteConfiguration>,
    credential_present: bool,
    adapter_supported: bool,
    tier: DataTier,
) -> RouteEligibility {
    let register = CapabilityRegister::load_embedded().ok();
    eligibility(configuration, credential_present, adapter_supported, tier, register.as_ref())
}

fn eligibility(
    configuration: Option<&RouteConfiguration>,
    credential_present: bool,
    adapter_supported: bool,
    tier: DataTier,
    register: Option<&CapabilityRegister>,
) -> RouteEligibility {
    let mut result = RouteEligibility {
        verification: RouteVerification::NotVerified,
        enabled: false,
        gate: None,
        evidence: Vec::new(),
    };
    let Some(configuration) = configuration else {
        result.gate = Some("No processing route explicitly configured for this Task");
        return result;
    };
    let entry = register.and_then(|r| r.entry(configuration.route_id.capability_id()));
    let entry = entry.filter(|entry| {
        [("model", configuration.model()), ("api", configuration.api_version()),
         ("deployment", configuration.deployment()), ("endpoint", configuration.endpoint())]
            .into_iter().all(|(key, value)| entry.versions.get(key).map(String::as_str) == Some(value))
    });
    if let Some(entry) = entry {
        result.evidence = entry.evidence.iter().map(|e| e.reference.clone()).collect();
        result.verification = match entry.enablement() {
            Enablement::Disabled => RouteVerification::NotVerified,
            Enablement::SyntheticOnly => RouteVerification::VerifiedForSynthetic,
            Enablement::RealDataEligible => RouteVerification::VerifiedForRealData,
        };
    }
    result.gate = if !adapter_supported {
        Some("Selected route adapter or requested capability is unavailable")
    } else if !credential_present {
        Some("Selected route credential is unavailable")
    } else if result.verification == RouteVerification::NotVerified {
        Some("Selected route has no passing evidence for this exact deployment, model and API version")
    } else if tier == DataTier::Real {
        Some("Real-data use requires complete exact-build evidence and fresh organization approval")
    } else {
        result.enabled = true;
        None
    };
    result
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteCandidate {
    pub id: &'static str,
    pub provider: &'static str,
    pub configurable: bool,
    pub limit: &'static str,
}

pub fn route_catalog() -> Vec<RouteCandidate> {
    vec![
        RouteCandidate { id: "codex-responses", provider: "OpenAI", configurable: true,
            limit: "Inherited Responses route; exact configuration and route-specific evidence required" },
        RouteCandidate { id: "claude-api-key", provider: "Anthropic", configurable: true,
            limit: "Native Messages text and runtime-owned tools only; no images, hosted tools or optional extensions" },
        RouteCandidate { id: "claude-subscription", provider: "Anthropic", configurable: false,
            limit: "Later supply/eligibility gate; custom Claude.ai token collection is not permitted" },
        RouteCandidate { id: "claude-code", provider: "Anthropic", configurable: false,
            limit: "Later architecture and eligibility gate; retained runtime is not replaced" },
        RouteCandidate { id: "claude-plan-api-credits", provider: "Anthropic", configurable: false,
            limit: "Billing eligibility unverified; not another authentication route" },
    ]
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct RouteTask { pub creator: PrincipalId, pub workspace_id: WorkspaceId }

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskRouteRecord {
    pub task_id: TaskId,
    /// Exact principal candidate revision selected by the user.
    pub configuration_revision: Revision,
    pub configuration: RouteConfiguration,
    pub principal_id: PrincipalId,
    pub recorded_at: Timestamp,
    pub revision: Revision,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TaskRoute {
    pub task_id: TaskId,
    /// A candidate edit never silently upgrades an existing Task selection.
    pub stale_configuration: bool,
    pub workspace_id: WorkspaceId,
    pub revision: Revision,
    /// None is unconfigured, never an implicit default route.
    pub current: Option<TaskRouteRecord>,
}

impl TaskRoute {
    /// Use this Task-bound gate rather than checking its historical snapshot alone.
    pub fn eligibility(&self, credential_present: bool, adapter_supported: bool, tier: DataTier) -> RouteEligibility {
        let mut result = route_eligibility(self.current.as_ref().map(|record| &record.configuration), credential_present, adapter_supported, tier);
        if self.stale_configuration {
            result.enabled = false;
            result.gate = Some("Route configuration changed; explicitly select the current candidate again");
        }
        result
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    pub task_id: TaskId,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteOutcome {
    pub receipt: RouteReceipt,
    pub record: TaskRouteRecord,
    pub replayed: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteChange {
    pub expected_revision: Revision,
    pub record: TaskRouteRecord,
    pub receipt: RouteReceipt,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn input() -> RouteConfigurationInput {
        RouteConfigurationInput {
            route_id: "claude-api-key".into(), deployment: "anthropic-direct".into(),
            model: CLAUDE_MODEL.into(), api_version: CLAUDE_API_VERSION.into(),
            account_ref: "11111111-1111-4111-8111-111111111111".into(), region: None,
        }
    }

    #[test]
    fn configuration_is_not_readiness_and_unknown_region_stays_unknown() {
        let route = RouteConfiguration::parse(input()).unwrap_or_else(|error| panic!("{error}"));
        assert_eq!(route.region(), None);
        assert_eq!(route.endpoint(), CLAUDE_ENDPOINT);
        let status = route_eligibility(Some(&route), true, true, DataTier::Synthetic);
        assert!(!status.enabled);
        assert_eq!(status.verification, RouteVerification::NotVerified);
        assert!(!route_eligibility(Some(&route), true, true, DataTier::Real).enabled);
        assert!(!route_eligibility(None, true, true, DataTier::Synthetic).enabled);
    }

    #[test]
    fn synthetic_proof_is_exact_and_never_real_data_or_credential_authority() {
        let route = RouteConfiguration::parse(input()).unwrap_or_else(|error| panic!("{error}"));
        // This register exists only within this unit test, never in the shipped
        // register or runtime input path. It tests the gate, not adapter evidence.
        let value = serde_json::json!({
            "schema_version": 1, "entries": [{
                "id": "processing.claude-api-key", "owner": "fixture", "supply": "fixture",
                "versions": { "model": CLAUDE_MODEL, "api": CLAUDE_API_VERSION,
                    "deployment": "anthropic-direct", "endpoint": CLAUDE_ENDPOINT },
                "limits": ["synthetic only"], "identity": "fixture", "formats": ["text"],
                "processing_scope": "isolated unit test", "eligibility": "synthetic-only",
                "evidence": [{ "kind": "synthetic", "status": "passed", "reference": "fixture-only" }]
            }]
        });
        let register = CapabilityRegister::from_json(&value.to_string()).unwrap_or_else(|error| panic!("{error}"));
        let verified = eligibility(Some(&route), true, true, DataTier::Synthetic, Some(&register));
        assert!(verified.enabled);
        assert_eq!(verified.verification, RouteVerification::VerifiedForSynthetic);
        assert!(!eligibility(Some(&route), true, true, DataTier::Real, Some(&register)).enabled);
        assert!(!eligibility(Some(&route), false, true, DataTier::Synthetic, Some(&register)).enabled);
        assert!(!eligibility(Some(&route), true, false, DataTier::Synthetic, Some(&register)).enabled);
        let mut mismatch = value;
        mismatch["entries"][0]["versions"]["api"] = serde_json::json!("different-version");
        let register = CapabilityRegister::from_json(&mismatch.to_string()).unwrap_or_else(|error| panic!("{error}"));
        assert_eq!(eligibility(Some(&route), true, true, DataTier::Synthetic, Some(&register)).verification, RouteVerification::NotVerified);
    }

    #[test]
    fn rejects_unsupported_models_versions_secrets_and_endpoints() {
        let mut bad = input(); bad.model = "claude-unknown".into();
        assert!(RouteConfiguration::parse(bad).is_err());
        let mut bad = input(); bad.api_version = "2023-06-01".into();
        assert!(RouteConfiguration::parse(bad).is_err());
        let mut bad = input(); bad.account_ref = "sk-ant-SENTINEL".into();
        assert!(RouteConfiguration::parse(bad).is_err());
        let mut bad = input(); bad.deployment = "https://evil.invalid".into();
        assert!(RouteConfiguration::parse(bad).is_err());
        let mut bad = input(); bad.route_id = "claude-subscription".into();
        assert!(RouteConfiguration::parse(bad).is_err());
    }
}

pub const CONFIGURE_ROUTE_COMMAND: &str = "configure_route";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateRouteRecord {
    pub principal_id: PrincipalId,
    pub configuration: RouteConfiguration,
    pub revision: Revision,
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateRouteReceipt {
    pub operation_id: OperationId,
    pub principal_id: PrincipalId,
    pub route_id: RouteId,
    pub expected_revision: Revision,
    pub resulting_revision: Revision,
    pub request: String,
    pub status: ReceiptStatus,
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateRouteChange {
    pub expected_revision: Revision,
    pub record: CandidateRouteRecord,
    pub receipt: CandidateRouteReceipt,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CandidateRouteOutcome {
    pub receipt: CandidateRouteReceipt,
    pub record: CandidateRouteRecord,
    pub replayed: bool,
}
