//! Durable human consent describes material processing, not software identity.
//! Exact model/build proof, local data policy, credentials and workspace policy
//! are independent mandatory checks. Nothing here grants software eligibility.
use crate::capability::CapabilityEntry;
use serde::Serialize;
use sha2::{Digest, Sha256};

pub const OPENAI_PROCESSING_CONTRACT: &str = "openai-api-standard-v1";
pub const OPENAI_PROVIDER: &str = "openai-api";
/// Documentation provenance only; URL relocation is not a processing change.
pub const OPENAI_PROCESSING_TERMS_SOURCE: &str =
    "https://developers.openai.com/api/docs/guides/your-data";

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ProcessingContract {
    pub schema_version: u32,
    pub id: String,
    pub provider: String,
    pub endpoint_trust_boundary: String,
    pub data_categories: String,
    pub purpose: String,
    pub data_use: String,
    pub retention: String,
    pub region: String,
    pub provider_terms_revision: String,
}

impl ProcessingContract {
    pub fn digest(&self) -> String {
        // This serializable fixed structure contains only strings and integers.
        let bytes = serde_json::to_vec(&("inquello-processing-consent-v1", self))
            .unwrap_or_else(|_| panic!("processing contract serialization failed"));
        format!("{:x}", Sha256::digest(bytes))
    }

    /// Plain owner-facing text. It makes no unverified account-specific promise.
    pub fn consent_text(&self) -> String {
        format!(
            "Allow OpenAI to process {} to {}. Data use: {}. Retention: {}. Region: {}. This permission stays until an owner revokes it or the processing terms materially change.",
            self.data_categories, self.purpose, self.data_use, self.retention, self.region,
        )
    }
}

pub fn openai_processing_contract() -> ProcessingContract {
    ProcessingContract {
        schema_version: 1,
        id: OPENAI_PROCESSING_CONTRACT.into(),
        provider: OPENAI_PROVIDER.into(),
        endpoint_trust_boundary: "https://api.openai.com/v1/responses; redirects forbidden".into(),
        data_categories: "permitted workspace prompts, conversation context, tool inputs and results".into(),
        purpose: "respond to user-directed workspace conversation and tool operations".into(),
        data_use: "OpenAI API standard terms; training use only if account opts in; account settings not verified by Inquello".into(),
        retention: "Inquello does not ask OpenAI to save responses for later retrieval; OpenAI may keep abuse-monitoring records for up to 30 days, or longer for legal or safety reasons; your OpenAI account settings and other service records may also apply; no promise that all data is immediately deleted".into(),
        region: "processing and storage are not restricted to a verified region".into(),
        // Official provider documentation reviewed 2026-11-03. A review date is
        // provenance only; this semantic revision changes only with material terms.
        provider_terms_revision: "openai-api-standard-data-controls-v1".into(),
    }
}

/// An explicit reviewed entry mapping is required. An endpoint alone never
/// enrolls an unknown model/provider into a workspace's existing consent.
pub fn processing_contract_for_entry(entry: &CapabilityEntry) -> Option<ProcessingContract> {
    let value = |key: &str| entry.versions.get(key).map(String::as_str);
    if value("processing-contract") != Some(OPENAI_PROCESSING_CONTRACT)
        || value("deployment") != Some(OPENAI_PROVIDER)
        || value("endpoint") != Some("https://api.openai.com/v1/responses")
        || value("api") != Some("responses-v1")
    {
        return None;
    }
    Some(openai_processing_contract())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capability::CapabilityRegister;
    use crate::routes::RouteId;

    #[test]
    fn documentation_provenance_is_not_material_consent_identity() {
        let contract = openai_processing_contract();
        let before = contract.digest();
        let mut review = serde_json::json!({"contract": &contract, "source": OPENAI_PROCESSING_TERMS_SOURCE, "reviewed":"2026-11-03"});
        review["source"] =
            serde_json::json!("https://developers.openai.com/relocated-documentation");
        review["reviewed"] = serde_json::json!("2026-12-03");
        assert_eq!(review["contract"], serde_json::to_value(&contract).unwrap());
        assert!(review["contract"].get("provider_terms_source").is_none());
        assert_eq!(contract.digest(), before);
    }

    #[test]
    fn material_fields_change_consent_identity() {
        let original = openai_processing_contract();
        let digest = original.digest();
        let mutations: [fn(&mut ProcessingContract); 9] = [
            |c| c.provider.push_str("-different"),
            |c| c.endpoint_trust_boundary.push_str("/different"),
            |c| c.data_categories.push_str("; expanded"),
            |c| c.purpose.push_str("; other use"),
            |c| c.data_use.push_str("; changed"),
            |c| c.retention.push_str("; changed"),
            |c| c.region.push_str("; changed"),
            |c| c.provider_terms_revision.push_str("-changed"),
            |c| c.schema_version += 1,
        ];
        for mutate in mutations {
            let mut changed = original.clone();
            mutate(&mut changed);
            assert_ne!(changed.digest(), digest);
        }
    }

    #[test]
    fn displayed_material_terms_are_bound_to_consent_identity() {
        let original = openai_processing_contract();
        for mutate in [
            (|c: &mut ProcessingContract| c.data_categories.push_str("; more data"))
                as fn(&mut ProcessingContract),
            |c| c.purpose.push_str("; another purpose"),
            |c| c.data_use.push_str("; different training use"),
            |c| c.retention.push_str("; longer storage"),
            |c| c.region.push_str("; different region"),
        ] {
            let mut changed = original.clone();
            mutate(&mut changed);
            assert_ne!(changed.digest(), original.digest());
            assert_ne!(changed.consent_text(), original.consent_text());
        }
        assert!(!original.consent_text().contains("endpoint"));
        assert!(!original.consent_text().contains("application state"));
    }

    #[test]
    fn compatible_explicit_model_mapping_is_not_software_qualification() {
        let register = CapabilityRegister::load_embedded().unwrap();
        let mut entry = register
            .entry(RouteId::CodexResponses.capability_id())
            .unwrap()
            .clone();
        let original = processing_contract_for_entry(&entry).unwrap().digest();
        entry.versions.insert(
            "model".into(),
            "future-independently-qualified-model".into(),
        );
        entry.processing_scope = "different internal exact evidence prose".into();
        entry.negative_authorization = None;
        assert_eq!(
            processing_contract_for_entry(&entry).unwrap().digest(),
            original
        );
        assert!(
            !entry.enablement().allows_real_data(),
            "mapping cannot replace exact proof"
        );
        entry.versions.remove("processing-contract");
        assert!(processing_contract_for_entry(&entry).is_none());
        entry.versions.insert(
            "processing-contract".into(),
            OPENAI_PROCESSING_CONTRACT.into(),
        );
        entry.versions.insert(
            "endpoint".into(),
            "https://other.invalid/v1/responses".into(),
        );
        assert!(processing_contract_for_entry(&entry).is_none());
    }
}
