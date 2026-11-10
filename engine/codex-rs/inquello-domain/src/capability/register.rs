//! The capability register: reviewed entries compiled into the binary.
//!
//! The register is `register/capabilities.json`, embedded with `include_str!`. It is
//! changed only by a reviewed commit; nothing at runtime writes it, overrides it or
//! reads an environment toggle. [`CapabilityRegister::enablement`] is fail-closed: an
//! unknown id, a missing entry or missing evidence is [`Enablement::Disabled`].

use super::CapabilityError;
use serde::Deserialize;
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::sync::OnceLock;

/// The register schema version this domain reads.
pub const CAPABILITY_REGISTER_SCHEMA_VERSION: u32 = 2;

const EMBEDDED_REGISTER: &str = include_str!("../../register/capabilities.json");

/// How far a capability is enabled. Ordered from least to most permissive.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Enablement {
    /// Not enabled. The default for anything unknown or unproven.
    Disabled,
    /// Enabled for synthetic fixtures only; real data is not allowed.
    SyntheticOnly,
    /// Enabled for real data: passing synthetic and negative-authorization evidence.
    RealDataEligible,
}

impl Enablement {
    pub fn is_enabled(self) -> bool {
        self != Enablement::Disabled
    }

    pub fn allows_real_data(self) -> bool {
        self == Enablement::RealDataEligible
    }
}

/// What an evidence reference demonstrates.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceKind {
    /// A run against synthetic fixtures only. Supports [`Enablement::SyntheticOnly`].
    Synthetic,
    /// A passing negative-authorization suite: prohibited access and actions are
    /// proven blocked. Required, with synthetic evidence, for real-data eligibility.
    NegativeAuthorization,
    /// A reviewed configuration or support record. It documents limits but never
    /// supports any eligibility on its own.
    Record,
}

/// The state of an evidence reference.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceStatus {
    Passed,
    Failed,
    /// Not yet run or not yet recorded; counts as missing.
    Pending,
}

/// One piece of evidence behind an entry.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EvidenceRef {
    pub kind: EvidenceKind,
    pub status: EvidenceStatus,
    /// Repository-relative path, optionally followed by `#` and a locator.
    pub reference: String,
}

impl EvidenceRef {
    fn passes(&self, kind: EvidenceKind) -> bool {
        self.kind == kind && self.status == EvidenceStatus::Passed
    }
}

/// One reviewed register entry.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CapabilityEntry {
    pub id: String,
    pub owner: String,
    /// The actual implementation or service that supplies the capability.
    pub supply: String,
    pub versions: BTreeMap<String, String>,
    pub limits: Vec<String>,
    pub identity: String,
    pub formats: Vec<String>,
    pub processing_scope: String,
    /// Reviewed maximum for this compiled implementation. It grants nothing by
    /// itself: effective status is capped by passing, exact evidence below.
    pub ceiling: Enablement,
    pub evidence: Vec<EvidenceRef>,
    #[serde(default)]
    pub negative_authorization: Option<crate::routes::NegativeAuthorizationEvidence>,
}

impl CapabilityEntry {
    /// The most permissive eligibility this entry's evidence supports.
    pub fn supported_eligibility(&self) -> Enablement {
        if self
            .evidence
            .iter()
            .any(|evidence| evidence.status == EvidenceStatus::Failed)
        {
            return Enablement::Disabled;
        }
        let passes = |kind| self.evidence.iter().any(|evidence| evidence.passes(kind));
        if !passes(EvidenceKind::Synthetic) {
            Enablement::Disabled
        } else if passes(EvidenceKind::NegativeAuthorization)
            && self
                .negative_authorization
                .as_ref()
                .is_some_and(|proof| self.reviewed_authorization_matches(proof))
        {
            Enablement::RealDataEligible
        } else {
            Enablement::SyntheticOnly
        }
    }

    fn reviewed_authorization_matches(
        &self,
        proof: &crate::routes::NegativeAuthorizationEvidence,
    ) -> bool {
        proof.complete()
            && crate::routes::RouteId::parse(&proof.identity.route_id)
                .is_some_and(|route| route.capability_id() == self.id)
            && proof.processing_scope == self.processing_scope
            && [
                ("model", proof.identity.model.as_str()),
                ("api", proof.identity.api_version.as_str()),
                ("deployment", proof.identity.deployment.as_str()),
                ("endpoint", proof.identity.endpoint.as_str()),
            ]
            .into_iter()
            .all(|(key, value)| self.versions.get(key).map(String::as_str) == Some(value))
    }

    /// Effective enablement is always the lesser of the reviewed compiled
    /// ceiling and the evidence actually supported by this build. Pending proof
    /// never becomes real-data eligibility.
    pub fn enablement(&self) -> Enablement {
        self.ceiling.min(self.supported_eligibility())
    }

    fn validate(&self) -> Result<(), CapabilityError> {
        let invalid = |reason: String| CapabilityError::InvalidEntry {
            id: self.id.clone(),
            reason,
        };
        if !is_valid_id(&self.id) {
            return Err(invalid(
                "id must be 1 to 128 characters of a-z, 0-9, '.', '-' or '_', starting with a letter or digit"
                    .to_string(),
            ));
        }
        for (field, value) in [
            ("owner", &self.owner),
            ("supply", &self.supply),
            ("identity", &self.identity),
            ("processing_scope", &self.processing_scope),
        ] {
            if value.trim().is_empty() {
                return Err(invalid(format!("{field} must not be empty")));
            }
        }
        if self.versions.is_empty() {
            return Err(invalid(
                "versions must name at least one version".to_string(),
            ));
        }
        if self.limits.is_empty() {
            return Err(invalid("limits must state at least one limit".to_string()));
        }
        if self.formats.is_empty() {
            return Err(invalid("formats must name at least one format".to_string()));
        }
        for (name, version) in &self.versions {
            if name.trim().is_empty() || version.trim().is_empty() {
                return Err(invalid(
                    "versions must not contain empty names or values".to_string(),
                ));
            }
        }
        if self
            .limits
            .iter()
            .chain(&self.formats)
            .any(|value| value.trim().is_empty())
        {
            return Err(invalid(
                "limits and formats must not contain empty values".to_string(),
            ));
        }
        if self
            .evidence
            .iter()
            .any(|evidence| evidence.reference.trim().is_empty())
        {
            return Err(invalid(
                "every evidence reference must name its source".to_string(),
            ));
        }
        if self.ceiling.is_enabled()
            && let Some(failed) = self
                .evidence
                .iter()
                .find(|evidence| evidence.status == EvidenceStatus::Failed)
        {
            return Err(invalid(format!(
                "reviewed ceiling {:?} has failed evidence {}",
                self.ceiling, failed.reference
            )));
        }
        if let Some(proof) = &self.negative_authorization
            && proof.complete()
            && !self.reviewed_authorization_matches(proof)
        {
            return Err(invalid("complete exact-build proof does not match this capability's route, transport or scope".into()));
        }
        Ok(())
    }
}

fn is_valid_id(id: &str) -> bool {
    let mut chars = id.chars();
    let starts_well = chars
        .next()
        .is_some_and(|c| c.is_ascii_lowercase() || c.is_ascii_digit());
    starts_well
        && id.len() <= 128
        && chars
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '.' | '-' | '_'))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RegisterFile {
    schema_version: u32,
    entries: Vec<CapabilityEntry>,
}

/// The validated capability register.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CapabilityRegister {
    entries: BTreeMap<String, CapabilityEntry>,
}

impl CapabilityRegister {
    /// Loads and validates the register compiled into this binary.
    pub fn load_embedded() -> Result<Self, CapabilityError> {
        Self::from_json(EMBEDDED_REGISTER)
    }

    /// Parses and validates version 2. Unknown fields, duplicate ids, failed
    /// references and complete proofs for a different route/scope are rejected.
    /// Missing or incomplete proof is permitted but cannot grant real-data use.
    pub fn from_json(json: &str) -> Result<Self, CapabilityError> {
        let file: RegisterFile = serde_json::from_str(json)
            .map_err(|error| CapabilityError::Parse(error.to_string()))?;
        if file.schema_version != CAPABILITY_REGISTER_SCHEMA_VERSION {
            return Err(CapabilityError::UnsupportedSchemaVersion {
                found: file.schema_version,
                expected: CAPABILITY_REGISTER_SCHEMA_VERSION,
            });
        }
        let mut entries = BTreeMap::new();
        for entry in file.entries {
            entry.validate()?;
            if entries.contains_key(&entry.id) {
                return Err(CapabilityError::DuplicateEntry { id: entry.id });
            }
            entries.insert(entry.id.clone(), entry);
        }
        Ok(Self { entries })
    }

    pub fn entry(&self, id: &str) -> Option<&CapabilityEntry> {
        self.entries.get(id)
    }

    pub fn entries(&self) -> impl Iterator<Item = &CapabilityEntry> {
        self.entries.values()
    }

    pub fn ids(&self) -> BTreeSet<&str> {
        self.entries.keys().map(String::as_str).collect()
    }

    /// Fail-closed enablement: an unknown id is [`Enablement::Disabled`].
    pub fn enablement(&self, id: &str) -> Enablement {
        self.entry(id)
            .map_or(Enablement::Disabled, CapabilityEntry::enablement)
    }
}

/// Fail-closed enablement against the embedded register. If the embedded register
/// does not validate, every capability is [`Enablement::Disabled`].
pub fn enablement(id: &str) -> Enablement {
    static REGISTER: OnceLock<Option<CapabilityRegister>> = OnceLock::new();
    REGISTER
        .get_or_init(|| CapabilityRegister::load_embedded().ok())
        .as_ref()
        .map_or(Enablement::Disabled, |register| register.enablement(id))
}
