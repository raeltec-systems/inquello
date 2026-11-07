//! Regression for exact output-directory exclusions, not broad component names.
#[path = "../build.rs"]
#[allow(dead_code)]
mod fingerprint;
#[test]
fn nested_source_directories_named_like_outputs_are_measured() {
    let root = tempfile::tempdir().unwrap();
    for name in [
        "desktop/dist/generated.js",
        "desktop/src/dist/enforcement.ts",
        "desktop/src/node_modules/policy.ts",
        "engine/codex-rs/target/output",
        "engine/codex-rs/core/src/target/authority.rs",
        "engine/codex-rs/core/src/dist/runtime.rs",
    ] {
        let path = root.path().join(name);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, b"behavior").unwrap();
    }
    let mut files = Vec::new();
    fingerprint::collect(root.path(), root.path(), &mut files);
    let names = files
        .iter()
        .map(|file| {
            file.strip_prefix(root.path())
                .unwrap()
                .to_string_lossy()
                .replace('\\', "/")
        })
        .collect::<Vec<_>>();
    assert!(!names.contains(&"desktop/dist/generated.js".into()));
    assert!(!names.contains(&"engine/codex-rs/target/output".into()));
    for expected in [
        "desktop/src/dist/enforcement.ts",
        "desktop/src/node_modules/policy.ts",
        "engine/codex-rs/core/src/target/authority.rs",
        "engine/codex-rs/core/src/dist/runtime.rs",
    ] {
        assert!(
            names.contains(&expected.into()),
            "behavior-bearing nested source must not be excluded: {expected}"
        );
    }
}

#[test]
fn normalization_excludes_only_report_metadata_not_enforcement_or_capability_enablement() {
    use sha2::{Digest, Sha256};
    let digest = |path: &str, bytes: &[u8]| {
        let mut hash = Sha256::new();
        hash.update(fingerprint::BEHAVIOR_FINGERPRINT_DOMAIN);
        fingerprint::hash_input(&mut hash, path, bytes);
        format!("{:x}", hash.finalize())
    };
    let source = "desktop/src/main/data/authority.ts";
    assert_ne!(
        digest(source, b"deny_unknown()"),
        digest(source, b"allow_unknown()")
    );
    let path = "engine/codex-rs/inquello-domain/register/capabilities.json";
    let original: serde_json::Value = serde_json::from_str(include_str!(
        "../../inquello-domain/register/capabilities.json"
    ))
    .unwrap();
    let bytes = |value: &serde_json::Value| serde_json::to_vec(value).unwrap();
    let baseline = digest(path, &bytes(&original));
    let mut metadata = original.clone();
    for entry in metadata["entries"].as_array_mut().unwrap() {
        entry["evidence"] = serde_json::json!([{"reference":"new-report","status":"pending"}]);
        entry["negative_authorization"] = serde_json::json!({"report_digest":"metadata-only"});
    }
    assert_eq!(baseline, digest(path, &bytes(&metadata)));
    let mut eligibility = original.clone();
    eligibility["entries"][0]["eligibility"] = serde_json::json!("real-data");
    assert_ne!(baseline, digest(path, &bytes(&eligibility)));
    let mut limits = original.clone();
    limits["entries"][0]["limits"] = serde_json::json!([]);
    assert_ne!(baseline, digest(path, &bytes(&limits)));
    // A similarly named source file is not a metadata-exclusion escape hatch.
    assert_ne!(
        digest("desktop/src/capabilities.json", &bytes(&original)),
        digest("desktop/src/capabilities.json", &bytes(&metadata))
    );
}

fn measured_inputs(inputs: &[(&str, Vec<u8>)]) -> String {
    use sha2::{Digest, Sha256};
    let mut hash = Sha256::new();
    hash.update(fingerprint::BEHAVIOR_FINGERPRINT_DOMAIN);
    for (path, bytes) in inputs {
        fingerprint::hash_input(&mut hash, path, bytes);
    }
    format!("{:x}", hash.finalize())
}

fn schema_stamp() -> serde_json::Value {
    serde_json::from_str(include_str!(
        "../../../../desktop/src/protocol/schema-stamp.json"
    ))
    .unwrap_or_else(|error| panic!("checked-in schema fixture JSON: {error}"))
}

#[test]
fn evidence_only_commit_and_genuine_provenance_regeneration_preserve_behavior() {
    let register_path = "engine/codex-rs/inquello-domain/register/capabilities.json";
    let stamp_path = "desktop/src/protocol/schema-stamp.json";
    let mut register: serde_json::Value = serde_json::from_str(include_str!(
        "../../inquello-domain/register/capabilities.json"
    ))
    .unwrap();
    let mut stamp = schema_stamp();
    let digest = |register: &serde_json::Value, stamp: &serde_json::Value| {
        measured_inputs(&[
            (register_path, serde_json::to_vec(register).unwrap()),
            (stamp_path, serde_json::to_vec(stamp).unwrap()),
            (
                "desktop/src/protocol/generated/InitializeResponse.ts",
                b"export type Response = {};".to_vec(),
            ),
        ])
    };
    let baseline = digest(&register, &stamp);
    for entry in register["entries"].as_array_mut().unwrap() {
        entry["evidence"] =
            serde_json::json!([{"status":"passed","reference":"reviewed-final-report"}]);
        entry["negative_authorization"] = serde_json::json!({"report_digest":"metadata-only"});
    }
    stamp["forkTreeHash"] = serde_json::json!("a".repeat(40));
    assert_eq!(baseline, digest(&register, &stamp));
    let compact = measured_inputs(&[(stamp_path, serde_json::to_vec(&stamp).unwrap())]);
    let formatted = serde_json::to_string_pretty(&stamp)
        .unwrap()
        .replace('\n', "\r\n");
    assert_eq!(
        compact,
        measured_inputs(&[(stamp_path, formatted.into_bytes())])
    );
    assert_eq!(
        fingerprint::BEHAVIOR_FINGERPRINT_DOMAIN,
        b"inquello-behavior-fingerprint-v2\0"
    );
}

#[test]
fn all_nonprovenance_stamp_fields_generated_protocol_and_source_stay_measured() {
    let path = "desktop/src/protocol/schema-stamp.json";
    let stamp = schema_stamp();
    let digest =
        |value: &serde_json::Value| measured_inputs(&[(path, serde_json::to_vec(value).unwrap())]);
    let baseline = digest(&stamp);
    for (field, value) in [
        ("runtimeVersion", serde_json::json!("9.9.9")),
        ("generator", serde_json::json!("different generator")),
        ("experimentalApi", serde_json::json!(true)),
        ("fileCount", serde_json::json!(9999)),
        ("contentSha256", serde_json::json!("b".repeat(64))),
        (
            "futureAuthorityField",
            serde_json::json!("must remain measured"),
        ),
    ] {
        let mut changed = stamp.clone();
        changed[field] = value;
        assert_ne!(
            baseline,
            digest(&changed),
            "field must stay measured: {field}"
        );
    }
    for source in [
        "desktop/src/protocol/generated/InitializeResponse.ts",
        "desktop/src/main/tasks/service.ts",
        "engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs",
        "desktop/data-policy.json",
    ] {
        assert_ne!(
            measured_inputs(&[(source, b"original".to_vec())]),
            measured_inputs(&[(source, b"changed".to_vec())])
        );
    }
    let mut changed = stamp.clone();
    changed["forkTreeHash"] = serde_json::json!("c".repeat(40));
    for other_path in [
        "desktop/src/schema-stamp.json",
        "desktop/src/protocol/nested/schema-stamp.json",
        "engine/schema-stamp.json",
    ] {
        assert_ne!(
            measured_inputs(&[(other_path, serde_json::to_vec(&stamp).unwrap())]),
            measured_inputs(&[(other_path, serde_json::to_vec(&changed).unwrap())])
        );
    }
    let mut register: serde_json::Value = serde_json::from_str(include_str!(
        "../../inquello-domain/register/capabilities.json"
    ))
    .unwrap();
    let register_path = "engine/codex-rs/inquello-domain/register/capabilities.json";
    let original = measured_inputs(&[(register_path, serde_json::to_vec(&register).unwrap())]);
    register["entries"][0]["ceiling"] = serde_json::json!("changed-enforcement-ceiling");
    assert_ne!(
        original,
        measured_inputs(&[(register_path, serde_json::to_vec(&register).unwrap())])
    );
}

#[test]
fn malformed_schema_stamp_cannot_enter_provenance_normalization() {
    let path = "desktop/src/protocol/schema-stamp.json";
    let mut invalid = vec![
        b"not-json".to_vec(),
        b"[]".to_vec(),
        b"null".to_vec(),
        b"{}".to_vec(),
    ];
    for field in [
        "runtimeVersion",
        "generator",
        "experimentalApi",
        "fileCount",
        "contentSha256",
        "forkTreeHash",
    ] {
        let mut stamp = schema_stamp();
        stamp.as_object_mut().unwrap().remove(field);
        invalid.push(serde_json::to_vec(&stamp).unwrap());
        let mut stamp = schema_stamp();
        stamp[field] = serde_json::Value::Null;
        invalid.push(serde_json::to_vec(&stamp).unwrap());
    }
    for (field, value) in [
        ("forkTreeHash", serde_json::json!("A".repeat(40))),
        ("forkTreeHash", serde_json::json!("g".repeat(40))),
        ("forkTreeHash", serde_json::json!("a".repeat(39))),
        ("contentSha256", serde_json::json!("not-a-digest")),
        ("fileCount", serde_json::json!(-1)),
        ("experimentalApi", serde_json::json!("false")),
        ("runtimeVersion", serde_json::json!("")),
        ("generator", serde_json::json!("")),
    ] {
        let mut stamp = schema_stamp();
        stamp[field] = value;
        invalid.push(serde_json::to_vec(&stamp).unwrap());
    }
    for bytes in invalid {
        assert!(std::panic::catch_unwind(|| measured_inputs(&[(path, bytes)])).is_err());
    }
}
