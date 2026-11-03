//! The capability register's fail-closed rules, one test per matrix row, plus the
//! committed seed register, and the Story 1.12 cross-check against the desktop's
//! local data-policy register (`desktop/data-policy.json`, read by repo path).

use inquello_domain::capability::CapabilityError;
use inquello_domain::capability::CapabilityRegister;
use inquello_domain::capability::Enablement;
use inquello_domain::capability::EvidenceKind;
use inquello_domain::capability::enablement;
use pretty_assertions::assert_eq;
use serde_json::Value;
use std::path::Path;
use std::path::PathBuf;

const SEED_ID: &str = "desktop.runtime-transport.stdio";

/// A register document with one entry whose eligibility and evidence vary.
fn register_json(eligibility: &str, evidence: &[(&str, &str)]) -> String {
    let evidence: Vec<String> = evidence
        .iter()
        .map(|(kind, status)| {
            format!(
                r#"{{"kind": "{kind}", "status": "{status}", "reference": "test/{kind}.json"}}"#
            )
        })
        .collect();
    let json = format!(
        r#"{{
  "schema_version": 2,
  "entries": [{{
    "id": "test.capability",
    "owner": "test owner",
    "supply": "test supply",
    "versions": {{"test": "1.0.0"}},
    "limits": ["synthetic fixtures only"],
    "identity": "none",
    "formats": ["text"],
    "processing_scope": "local",
    "ceiling": "{eligibility}",
    "evidence": [{}]
  }}]
}}"#,
        evidence.join(", ")
    );
    let mut value: Value =
        serde_json::from_str(&json).unwrap_or_else(|error| panic!("fixture register: {error}"));
    if eligibility == "real-data-eligible" {
        // Strict domain fixture only: never shipped evidence or executed suite evidence.
        value["entries"][0]["id"] = Value::from("processing.codex-responses");
        value["entries"][0]["versions"] = serde_json::json!({"model":"fixture-model", "api":"fixture-api", "deployment":"openai-api", "endpoint":"https://api.openai.com/v1/responses"});
        value["entries"][0]["negative_authorization"] = serde_json::json!({
            "suite": inquello_domain::routes::AUTHORIZATION_SUITE,
            "tested_artifact_digest": "c".repeat(64),
            "processing_scope": "local", "data_policy_digest": "e".repeat(64),
            "identity": {
                "route_id": "codex-responses", "deployment": "openai-api",
                "endpoint": "https://api.openai.com/v1/responses", "model": "fixture-model",
                "schema_version":2, "api_version": "fixture-api", "adapter_configuration_digest": "a".repeat(64),
                "implementation_digest": "b".repeat(64), "runtime_version": "fixture-runtime",
                "contract_version": "fixture-contract", "platform": "fixture-platform"
            },
            "scenarios": inquello_domain::routes::REQUIRED_AUTHORIZATION_SCENARIOS.iter()
                .map(|name| (name.to_string(), "passed")).collect::<std::collections::BTreeMap<_, _>>(),
            "passed": inquello_domain::routes::REQUIRED_AUTHORIZATION_SCENARIOS.len(),
            "failed": 0, "skipped": 0, "command": "domain fixture only",
            "environment": "unit fixture", "report_digest": "d".repeat(64),
            "limitations": ["Not execution evidence; unit fixture only"]
        });
    }
    if eligibility == "real-data-eligible" {
        value.to_string()
    } else {
        json
    }
}

fn load(
    eligibility: &str,
    evidence: &[(&str, &str)],
) -> Result<CapabilityRegister, CapabilityError> {
    CapabilityRegister::from_json(&register_json(eligibility, evidence))
}

fn assert_invalid_entry(result: Result<CapabilityRegister, CapabilityError>, needle: &str) {
    match result {
        Err(CapabilityError::InvalidEntry { id, reason }) => {
            assert!(
                [
                    "test.capability",
                    "processing.codex-responses",
                    "processing.claude-api-key"
                ]
                .contains(&id.as_str())
            );
            assert!(
                reason.contains(needle),
                "reason {reason:?} should mention {needle:?}"
            );
        }
        other => panic!("expected an invalid entry, got {other:?}"),
    }
}

#[test]
fn unknown_id_is_disabled() {
    let register = load("synthetic-only", &[("synthetic", "passed")]).unwrap();
    assert_eq!(register.enablement("x.unknown"), Enablement::Disabled);
    assert_eq!(enablement("x.unknown"), Enablement::Disabled);
}

#[test]
fn passing_synthetic_evidence_is_synthetic_only() {
    let register = load("synthetic-only", &[("synthetic", "passed")]).unwrap();
    let state = register.enablement("test.capability");
    assert_eq!(state, Enablement::SyntheticOnly);
    assert!(state.is_enabled());
    assert!(!state.allows_real_data());
}

#[test]
fn failed_evidence_rejects_the_register_naming_the_entry() {
    assert_invalid_entry(load("synthetic-only", &[("synthetic", "failed")]), "failed");
    // A failed record also blocks an otherwise supported declaration.
    assert_invalid_entry(
        load(
            "synthetic-only",
            &[("synthetic", "passed"), ("record", "failed")],
        ),
        "failed",
    );
}

#[test]
fn missing_or_pending_evidence_cannot_support_enablement() {
    for evidence in [
        vec![],
        vec![("synthetic", "pending")],
        vec![("record", "passed")],
    ] {
        assert_eq!(
            load("synthetic-only", &evidence)
                .unwrap()
                .enablement("test.capability"),
            Enablement::Disabled
        );
    }
    // A declared-disabled entry without evidence is valid and disabled.
    let register = load("disabled", &[]).unwrap();
    assert_eq!(register.enablement("test.capability"), Enablement::Disabled);
}

#[test]
fn real_data_claim_needs_passing_negative_authorization() {
    for evidence in [
        vec![("synthetic", "passed")],
        vec![
            ("synthetic", "passed"),
            ("negative-authorization", "pending"),
        ],
    ] {
        assert_eq!(
            load("real-data-eligible", &evidence)
                .unwrap()
                .enablement("processing.codex-responses"),
            Enablement::SyntheticOnly
        );
    }
    assert_eq!(
        load(
            "real-data-eligible",
            &[("negative-authorization", "passed")]
        )
        .unwrap()
        .enablement("processing.codex-responses"),
        Enablement::Disabled
    );
    let register = load(
        "real-data-eligible",
        &[
            ("synthetic", "passed"),
            ("negative-authorization", "passed"),
        ],
    )
    .unwrap();
    assert_eq!(
        register.enablement("processing.codex-responses"),
        Enablement::RealDataEligible
    );
}

#[test]
fn synthetic_evidence_alone_never_yields_real_data() {
    let register = load(
        "synthetic-only",
        &[("synthetic", "passed"), ("synthetic", "passed")],
    )
    .unwrap();
    let entry = register.entry("test.capability").unwrap();
    assert_eq!(entry.supported_eligibility(), Enablement::SyntheticOnly);
    assert!(!register.enablement("test.capability").allows_real_data());
}

#[test]
fn unknown_fields_are_rejected() {
    let json = register_json("disabled", &[]).replace(
        r#""owner": "test owner","#,
        r#""owner": "test owner", "override": true,"#,
    );
    assert!(matches!(
        CapabilityRegister::from_json(&json),
        Err(CapabilityError::Parse(_))
    ));
    let json = register_json("disabled", &[]).replace(
        r#""schema_version": 2,"#,
        r#""schema_version": 2, "enable_all": true,"#,
    );
    assert!(matches!(
        CapabilityRegister::from_json(&json),
        Err(CapabilityError::Parse(_))
    ));
    let json = register_json("synthetic-only", &[("synthetic", "passed")])
        .replace(r#""reference": "#, r#""note": "x", "reference": "#);
    assert!(matches!(
        CapabilityRegister::from_json(&json),
        Err(CapabilityError::Parse(_))
    ));
}

#[test]
fn duplicate_ids_and_empty_fields_are_rejected() {
    let json = register_json("disabled", &[]);
    let entry_start = json.find("{\n    \"id\"").unwrap();
    let entry_end = json.rfind("}]").unwrap();
    let entry = &json[entry_start..entry_end + 1];
    let doubled = json.replace(entry, &format!("{entry}, {entry}"));
    assert_eq!(
        CapabilityRegister::from_json(&doubled),
        Err(CapabilityError::DuplicateEntry {
            id: "test.capability".to_string()
        })
    );
    let json =
        register_json("disabled", &[]).replace(r#""owner": "test owner""#, r#""owner": " ""#);
    assert_invalid_entry(CapabilityRegister::from_json(&json), "owner");
}

/// Qualification may transition only with a complete, exact, digest-bound reviewed
/// report. This independently checks committed evidence, not enablement() itself.
fn expected_embedded_terra_enablement(register: &CapabilityRegister) -> Enablement {
    use inquello_domain::capability::EvidenceStatus;
    use inquello_domain::routes::{RouteConfiguration, RouteConfigurationInput};
    use sha2::{Digest, Sha256};
    let entry = register
        .entry("processing.codex-responses")
        .unwrap_or_else(|| panic!("reviewed Terra capability is missing"));
    assert_eq!(entry.ceiling, Enablement::RealDataEligible);
    let Some(proof) = entry.negative_authorization.as_ref() else {
        return Enablement::SyntheticOnly;
    };
    assert!(
        proof.complete(),
        "committed authorization evidence must be complete"
    );
    let configuration = RouteConfiguration::parse(RouteConfigurationInput {
        route_id: "codex-responses".into(),
        deployment: "openai-api".into(),
        model: "gpt-6.1-terra".into(),
        api_version: "responses-v1".into(),
        account_ref: "00000000-0000-4000-8000-000000000001".into(),
        region: None,
    })
    .unwrap_or_else(|error| panic!("supported Terra configuration is invalid: {error}"));
    assert!(proof.identity.matches_configuration(&configuration));
    assert_eq!(proof.processing_scope, entry.processing_scope);
    let policy = std::fs::read(repo_root().join("desktop/data-policy.json"))
        .unwrap_or_else(|error| panic!("current data policy could not be read: {error}"));
    assert_eq!(
        proof.data_policy_digest,
        format!("{:x}", Sha256::digest(policy))
    );
    assert!(
        entry.evidence.iter().any(|reference| {
            reference.kind == EvidenceKind::NegativeAuthorization
                && reference.status == EvidenceStatus::Passed
                && std::fs::read(
                    repo_root().join(
                        reference
                            .reference
                            .split('#')
                            .next()
                            .unwrap_or_else(|| panic!("authorization evidence reference is empty")),
                    ),
                )
                .is_ok_and(|bytes| format!("{:x}", Sha256::digest(bytes)) == proof.report_digest)
        }),
        "passing negative-authorization reference must name the exact report bytes"
    );
    Enablement::RealDataEligible
}

#[test]
fn embedded_register_allows_only_the_reviewed_terra_qualification_transition() {
    let register = CapabilityRegister::load_embedded().unwrap();
    let enabled: Vec<(&str, Enablement)> = register
        .entries()
        .map(|entry| (entry.id.as_str(), entry.enablement()))
        .filter(|(_, state)| state.is_enabled())
        .collect();
    assert_eq!(
        enabled,
        vec![
            (SEED_ID, Enablement::SyntheticOnly),
            ("execution_sandbox", Enablement::SyntheticOnly),
            (
                "processing.codex-responses",
                expected_embedded_terra_enablement(&register)
            ),
        ]
    );
    assert_eq!(enablement(SEED_ID), Enablement::SyntheticOnly);
    assert!(
        register
            .entries()
            .all(|entry| entry.id == "processing.codex-responses"
                || !entry.enablement().allows_real_data())
    );

    let seed = register.entry(SEED_ID).unwrap();
    assert!(
        seed.evidence
            .iter()
            .any(|evidence| evidence.kind == EvidenceKind::Record
                && evidence.reference == "desktop/transport-evidence.json")
    );
    assert!(
        seed.evidence
            .iter()
            .any(|evidence| evidence.kind == EvidenceKind::Synthetic
                && evidence.reference.contains("--smoke"))
    );
}

#[test]
fn seed_evidence_references_exist_in_the_repository() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .unwrap();
    let register = CapabilityRegister::load_embedded().unwrap();
    for entry in register.entries() {
        for evidence in &entry.evidence {
            let path = evidence
                .reference
                .split('#')
                .next()
                .unwrap_or(&evidence.reference);
            assert!(
                root.join(path).is_file(),
                "{}: evidence {path} does not exist",
                entry.id
            );
        }
    }
}

// ---- Story 1.12: local data-policy blockers ------------------------------------

/// The repository root (`engine/codex-rs/inquello-domain` is three levels down).
fn repo_root() -> PathBuf {
    match Path::new(env!("CARGO_MANIFEST_DIR")).ancestors().nth(3) {
        Some(root) => root.to_path_buf(),
        None => panic!("the crate is not inside the repository"),
    }
}

fn read_data_policy() -> Value {
    let path = repo_root().join("desktop/data-policy.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("{} could not be read: {error}", path.display()));
    match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(error) => panic!("desktop/data-policy.json is not JSON: {error}"),
    }
}

/// The data-policy register's real-data blockers, by the same rule as the desktop's
/// `realDataBlockers()`: an enabled category whose owner, rule owner, retention or
/// export rule is unknown. A register that cannot be read as categories blocks too.
fn data_policy_blockers(policy: &Value) -> Vec<String> {
    let Some(categories) = policy.get("categories").and_then(Value::as_array) else {
        return vec!["the data-policy register has no category list".to_string()];
    };
    let mut blockers = Vec::new();
    for (index, category) in categories.iter().enumerate() {
        let id = category
            .get("id")
            .and_then(Value::as_str)
            .map_or_else(|| format!("categories[{index}]"), str::to_string);
        let Some(enabled) = category.get("enabled").and_then(Value::as_bool) else {
            blockers.push(format!("{id}: enabled flag missing"));
            continue;
        };
        if !enabled {
            continue;
        }
        let unknown = |value: Option<&Value>| {
            value.and_then(Value::as_str).is_none_or(|text| {
                text.trim().is_empty() || text.trim().eq_ignore_ascii_case("unknown")
            })
        };
        for (field, value) in [
            ("owner", category.get("owner")),
            ("rule owner", category.get("rule_owner")),
            ("retention", category.get("retention")),
            (
                "export rule",
                category.get("export").and_then(|rule| rule.get("mode")),
            ),
        ] {
            if unknown(value) {
                blockers.push(format!("{id}: unknown {field}"));
            }
        }
    }
    blockers
}

/// Fails when any capability is real-data eligible while the data policy has blockers.
fn cross_check(policy: &Value, register: &CapabilityRegister) -> Result<(), String> {
    let blockers = data_policy_blockers(policy);
    if blockers.is_empty() {
        return Ok(());
    }
    let eligible: Vec<&str> = register
        .entries()
        .filter(|entry| entry.enablement() == Enablement::RealDataEligible)
        .map(|entry| entry.id.as_str())
        .collect();
    if eligible.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "real-data-eligible capabilities {eligible:?} while the local data policy has blockers {blockers:?}"
        ))
    }
}

#[test]
fn no_capability_is_real_data_eligible_while_the_data_policy_has_blockers() {
    let policy = read_data_policy();
    let register = CapabilityRegister::load_embedded().unwrap();
    if let Err(problem) = cross_check(&policy, &register) {
        panic!("{problem}");
    }
}

#[test]
fn committed_data_policy_names_every_enabled_rule() {
    assert_eq!(
        data_policy_blockers(&read_data_policy()),
        Vec::<String>::new()
    );
}

#[test]
fn cross_check_fails_on_an_unknown_rule_with_a_real_data_eligible_capability() {
    let mut policy = read_data_policy();
    let category = policy["categories"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|category| category["id"] == "task-history")
        .unwrap();
    category["retention"] = Value::from("unknown");
    category["export"] = serde_json::json!({ "mode": "unknown" });
    assert_eq!(
        data_policy_blockers(&policy),
        vec![
            "task-history: unknown retention".to_string(),
            "task-history: unknown export rule".to_string()
        ]
    );

    let eligible = load(
        "real-data-eligible",
        &[
            ("synthetic", "passed"),
            ("negative-authorization", "passed"),
        ],
    )
    .unwrap();
    let problem = cross_check(&policy, &eligible).unwrap_err();
    assert!(problem.contains("processing.codex-responses"), "{problem}");

    // Synthetic-only capabilities never trip it, and neither does a disabled category.
    let synthetic = load("synthetic-only", &[("synthetic", "passed")]).unwrap();
    assert_eq!(cross_check(&policy, &synthetic), Ok(()));
    let mut disabled_only = read_data_policy();
    let artifacts = disabled_only["categories"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .find(|category| category["id"] == "artifacts")
        .unwrap();
    assert_eq!(artifacts["enabled"], Value::from(false));
    artifacts["owner"] = Value::from("unknown");
    assert_eq!(cross_check(&disabled_only, &eligible), Ok(()));
}

#[test]
fn an_unreadable_data_policy_blocks() {
    assert_eq!(
        data_policy_blockers(&serde_json::json!({ "schema_version": 2 })),
        vec!["the data-policy register has no category list".to_string()]
    );
}

/// Story 1.18: the Capability Contract lists prompt inspection and specialist
/// cyber access as not enabled until their eligibility is verified.
#[test]
fn prompt_inspection_and_specialist_cyber_access_are_registered_not_enabled() {
    let register = CapabilityRegister::load_embedded().unwrap();
    for id in ["prompt_inspection", "specialist_cyber_access"] {
        let entry = register.entry(id).unwrap();
        assert_eq!(entry.ceiling, Enablement::Disabled);
        assert_eq!(entry.enablement(), Enablement::Disabled);
        assert_eq!(enablement(id), Enablement::Disabled);
        assert!(entry.evidence.is_empty());
        assert!(
            entry
                .limits
                .iter()
                .any(|limit| limit == "Eligibility verification required before enablement")
        );
    }
}

/// Story 1.19: the Capability Contract records the local execution sandbox
/// (OQ-13) as synthetic-only, with no hosted sandbox.
#[test]
fn the_execution_sandbox_is_local_only_and_synthetic() {
    let register = CapabilityRegister::load_embedded().unwrap();
    let entry = register.entry("execution_sandbox").unwrap();
    assert_eq!(entry.enablement(), Enablement::SyntheticOnly);
    assert!(!entry.enablement().allows_real_data());
    assert_eq!(
        entry.limits.first().map(String::as_str),
        Some(
            "Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)"
        )
    );
    assert!(
        entry
            .evidence
            .iter()
            .all(|evidence| evidence.kind == EvidenceKind::Synthetic)
    );
}

#[test]
fn remote_cloud_execution_remains_disabled() {
    let register = CapabilityRegister::load_embedded().unwrap();
    assert_eq!(
        register.enablement("execution.remote-cloud"),
        Enablement::Disabled
    );
    let entry = register
        .entries()
        .find(|entry| entry.id == "execution.remote-cloud")
        .unwrap();
    assert!(entry.limits.iter().any(|limit| limit.contains("Story 8.1")));
    assert!(entry.limits.iter().any(|limit| limit.contains("OQ-13")));
}

#[test]
fn unbound_negative_reference_no_longer_enables_real_data() {
    let mut value: Value = serde_json::from_str(&register_json(
        "real-data-eligible",
        &[
            ("synthetic", "passed"),
            ("negative-authorization", "passed"),
        ],
    ))
    .unwrap();
    value["entries"][0]
        .as_object_mut()
        .unwrap()
        .remove("negative_authorization");
    assert_eq!(
        CapabilityRegister::from_json(&value.to_string())
            .unwrap()
            .enablement("processing.codex-responses"),
        Enablement::SyntheticOnly
    );
}

#[test]
fn reviewed_ceiling_is_pending_until_complete_exact_evidence_and_never_overrides_it() {
    let full: Value = serde_json::from_str(&register_json(
        "real-data-eligible",
        &[
            ("synthetic", "passed"),
            ("negative-authorization", "passed"),
        ],
    ))
    .unwrap();
    let mut pending = full.clone();
    pending["entries"][0]
        .as_object_mut()
        .unwrap()
        .remove("negative_authorization");
    let register = CapabilityRegister::from_json(&pending.to_string()).unwrap();
    assert_eq!(
        register
            .entry("processing.codex-responses")
            .unwrap()
            .ceiling,
        Enablement::RealDataEligible
    );
    assert_eq!(
        register.enablement("processing.codex-responses"),
        Enablement::SyntheticOnly
    );
    assert_eq!(
        CapabilityRegister::from_json(&full.to_string())
            .unwrap()
            .enablement("processing.codex-responses"),
        Enablement::RealDataEligible
    );
    let mut incomplete = full.clone();
    incomplete["entries"][0]["negative_authorization"]["scenarios"]["real-session-production-admission"] =
        Value::from("not-run");
    assert_eq!(
        CapabilityRegister::from_json(&incomplete.to_string())
            .unwrap()
            .enablement("processing.codex-responses"),
        Enablement::SyntheticOnly
    );
    let mut capped = full.clone();
    capped["entries"][0]["ceiling"] = Value::from("synthetic-only");
    assert_eq!(
        CapabilityRegister::from_json(&capped.to_string())
            .unwrap()
            .enablement("processing.codex-responses"),
        Enablement::SyntheticOnly
    );
    for (field, value) in [
        ("model", Value::from("gpt-6.1-luna")),
        ("schema_version", Value::from(1)),
    ] {
        let mut mismatched = full.clone();
        mismatched["entries"][0]["negative_authorization"]["identity"][field] = value;
        let result = CapabilityRegister::from_json(&mismatched.to_string());
        if field == "model" {
            assert_invalid_entry(result, "complete exact-build proof does not match");
        } else {
            assert_eq!(
                result.unwrap().enablement("processing.codex-responses"),
                Enablement::SyntheticOnly
            );
        }
    }
    let mut old = full;
    old["schema_version"] = Value::from(1);
    assert!(matches!(
        CapabilityRegister::from_json(&old.to_string()),
        Err(CapabilityError::UnsupportedSchemaVersion {
            found: 1,
            expected: 2
        })
    ));
}

#[test]
fn reviewed_build_proof_cannot_promote_a_different_adapter_or_scope() {
    let original: Value = serde_json::from_str(&register_json(
        "real-data-eligible",
        &[
            ("synthetic", "passed"),
            ("negative-authorization", "passed"),
        ],
    ))
    .unwrap();
    let mut wrong_route = original.clone();
    wrong_route["entries"][0]["id"] = Value::from("processing.claude-api-key");
    assert_invalid_entry(
        CapabilityRegister::from_json(&wrong_route.to_string()),
        "exact-build",
    );
    for field in ["model", "api", "deployment", "endpoint"] {
        let mut changed = original.clone();
        changed["entries"][0]["versions"][field] = Value::from("different");
        assert_invalid_entry(
            CapabilityRegister::from_json(&changed.to_string()),
            "exact-build",
        );
    }
    let mut changed = original;
    changed["entries"][0]["processing_scope"] = Value::from("different");
    assert_invalid_entry(
        CapabilityRegister::from_json(&changed.to_string()),
        "exact-build",
    );
}

#[test]
fn terra_qualification_is_exact_and_never_replaces_current_authority() {
    use inquello_domain::routes::{
        DataTier, RouteConfiguration, RouteConfigurationInput, RouteVerification, route_eligibility,
    };
    let register = CapabilityRegister::load_embedded().unwrap();
    let entry = register.entry("processing.codex-responses").unwrap();
    let expected = expected_embedded_terra_enablement(&register);
    assert_eq!(entry.enablement(), expected);
    assert_eq!(
        register.enablement("processing.claude-api-key"),
        Enablement::Disabled
    );
    let input = RouteConfigurationInput {
        route_id: "codex-responses".into(),
        deployment: "openai-api".into(),
        model: "gpt-6.1-terra".into(),
        api_version: "responses-v1".into(),
        account_ref: "00000000-0000-4000-8000-000000000001".into(),
        region: None,
    };
    let configuration = RouteConfiguration::parse(input.clone()).unwrap();
    let allowed = route_eligibility(Some(&configuration), true, true, DataTier::Synthetic);
    assert!(allowed.enabled);
    assert_eq!(
        allowed.verification,
        if expected == Enablement::RealDataEligible {
            RouteVerification::VerifiedForRealData
        } else {
            RouteVerification::VerifiedForSynthetic
        }
    );
    for (credential, adapter, tier) in [
        (false, true, DataTier::Synthetic),
        (true, false, DataTier::Synthetic),
        (true, true, DataTier::Real),
    ] {
        assert!(!route_eligibility(Some(&configuration), credential, adapter, tier).enabled);
    }
    for (model, api, deployment) in [
        ("gpt-6.1-luna", "responses-v1", "openai-api"),
        ("gpt-6.1-terra", "responses-v2", "openai-api"),
        ("gpt-6.1-terra", "responses-v1", "chatgpt-codex"),
    ] {
        let mut other = input.clone();
        other.model = model.into();
        other.api_version = api.into();
        other.deployment = deployment.into();
        let other = RouteConfiguration::parse(other).unwrap();
        let denied = route_eligibility(Some(&other), true, true, DataTier::Synthetic);
        assert!(!denied.enabled);
        assert_eq!(denied.verification, RouteVerification::NotVerified);
    }
    assert!(!route_eligibility(None, true, true, DataTier::Synthetic).enabled);
}

#[test]
fn terra_evidence_records_executed_fixture_cases_not_live_provider_proof() {
    let path = repo_root().join(
        "_bmad-output/implementation-artifacts/validation/terra-responses-synthetic-20261101.json",
    );
    let evidence: Value = serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
    assert_eq!(evidence["tests"]["passed"], 31);
    assert_eq!(evidence["tests"]["failed"], 0);
    assert_eq!(evidence["tests"]["ignored"], 0);
    assert_eq!(evidence["tests"]["selectorPassed"], 2);
    let cases = evidence["tests"]["cases"].as_array().unwrap();
    assert_eq!(cases.len(), 31);
    let unique: std::collections::BTreeSet<_> = cases.iter().map(|v| v.as_str().unwrap()).collect();
    assert_eq!(unique.len(), 31);
    assert!(unique.iter().all(|name| name.starts_with("responses_")));
    assert!(unique.contains("responses_lifecycle_warm_policy_change"));
    assert!(unique.contains("responses_lifecycle_completed_followup"));
    assert_eq!(evidence["transport"]["liveProvider"], false);
    assert_eq!(evidence["transport"]["realCredentials"], false);
    assert_eq!(evidence["transport"]["pinnedLoopback"], true);
    assert_eq!(evidence["model"], "gpt-6.1-terra");
    assert_eq!(evidence["deployment"], "openai-api");
    assert_eq!(evidence["api"], "responses-v1");
}

#[test]
fn terra_route_does_not_accept_caller_supplied_endpoint_or_eligibility() {
    use inquello_domain::routes::RouteConfigurationInput;
    let value = serde_json::json!({
        "route_id": "codex-responses", "deployment": "openai-api",
        "model": "gpt-6.1-terra", "api_version": "responses-v1",
        "account_ref": "00000000-0000-4000-8000-000000000001", "region": null
    });
    for (field, injected) in [
        (
            "endpoint",
            Value::from("https://untrusted.invalid/v1/responses"),
        ),
        ("eligibility", Value::from("real-data-eligible")),
    ] {
        let mut other = value.clone();
        other[field] = injected;
        assert!(serde_json::from_value::<RouteConfigurationInput>(other).is_err());
    }
}
