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
    format!(
        r#"{{
  "schema_version": 1,
  "entries": [{{
    "id": "test.capability",
    "owner": "test owner",
    "supply": "test supply",
    "versions": {{"test": "1.0.0"}},
    "limits": ["synthetic fixtures only"],
    "identity": "none",
    "formats": ["text"],
    "processing_scope": "local",
    "eligibility": "{eligibility}",
    "evidence": [{}]
  }}]
}}"#,
        evidence.join(", ")
    )
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
            assert_eq!(id, "test.capability");
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
    assert_invalid_entry(load("synthetic-only", &[]), "synthetic evidence");
    assert_invalid_entry(
        load("synthetic-only", &[("synthetic", "pending")]),
        "synthetic evidence",
    );
    // A record documents limits; it never supports eligibility on its own.
    assert_invalid_entry(
        load("synthetic-only", &[("record", "passed")]),
        "synthetic evidence",
    );
    // A declared-disabled entry without evidence is valid and disabled.
    let register = load("disabled", &[]).unwrap();
    assert_eq!(register.enablement("test.capability"), Enablement::Disabled);
}

#[test]
fn real_data_claim_needs_passing_negative_authorization() {
    assert_invalid_entry(
        load("real-data-eligible", &[("synthetic", "passed")]),
        "negative-authorization",
    );
    assert_invalid_entry(
        load(
            "real-data-eligible",
            &[
                ("synthetic", "passed"),
                ("negative-authorization", "pending"),
            ],
        ),
        "negative-authorization",
    );
    // Negative authorization alone, without synthetic evidence, is not enough either.
    assert_invalid_entry(
        load(
            "real-data-eligible",
            &[("negative-authorization", "passed")],
        ),
        "synthetic evidence",
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
        register.enablement("test.capability"),
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
        r#""schema_version": 1,"#,
        r#""schema_version": 1, "enable_all": true,"#,
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

#[test]
fn seed_register_has_only_the_synthetic_transport_entry() {
    let register = CapabilityRegister::load_embedded().unwrap();
    let enabled: Vec<(&str, Enablement)> = register
        .entries()
        .map(|entry| (entry.id.as_str(), entry.enablement()))
        .filter(|(_, state)| state.is_enabled())
        .collect();
    assert_eq!(enabled, vec![(SEED_ID, Enablement::SyntheticOnly)]);
    assert_eq!(enablement(SEED_ID), Enablement::SyntheticOnly);
    assert!(
        register
            .entries()
            .all(|entry| !entry.enablement().allows_real_data())
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
    assert!(problem.contains("test.capability"), "{problem}");

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
        data_policy_blockers(&serde_json::json!({ "schema_version": 1 })),
        vec!["the data-policy register has no category list".to_string()]
    );
}
