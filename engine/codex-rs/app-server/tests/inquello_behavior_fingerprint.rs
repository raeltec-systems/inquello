//! Regression for exact output-directory exclusions, not broad component names.
#[path = "../build.rs"]
#[allow(dead_code)]
mod fingerprint;
#[test]
fn nested_source_directories_named_like_outputs_are_measured() {
    let root=tempfile::tempdir().unwrap();
    for name in ["desktop/dist/generated.js","desktop/src/dist/enforcement.ts","desktop/src/node_modules/policy.ts",
        "engine/codex-rs/target/output","engine/codex-rs/core/src/target/authority.rs","engine/codex-rs/core/src/dist/runtime.rs"] {
        let path=root.path().join(name);std::fs::create_dir_all(path.parent().unwrap()).unwrap();std::fs::write(path,b"behavior").unwrap();
    }
    let mut files=Vec::new();fingerprint::collect(root.path(),root.path(),&mut files);
    let names=files.iter().map(|file|file.strip_prefix(root.path()).unwrap().to_string_lossy().replace('\\',"/")).collect::<Vec<_>>();
    assert!(!names.contains(&"desktop/dist/generated.js".into()));
    assert!(!names.contains(&"engine/codex-rs/target/output".into()));
    for expected in ["desktop/src/dist/enforcement.ts","desktop/src/node_modules/policy.ts","engine/codex-rs/core/src/target/authority.rs","engine/codex-rs/core/src/dist/runtime.rs"] {
        assert!(names.contains(&expected.into()),"behavior-bearing nested source must not be excluded: {expected}");
    }
}

#[test]
fn normalization_excludes_only_report_metadata_not_enforcement_or_capability_enablement() {
    use sha2::{Digest,Sha256};
    let digest=|path:&str,bytes:&[u8]| {
        let mut hash=Sha256::new();
        hash.update(b"inquello-behavior-fingerprint-v1\0");
        fingerprint::hash_input(&mut hash,path,bytes);
        format!("{:x}",hash.finalize())
    };
    let source="desktop/src/main/data/authority.ts";
    assert_ne!(digest(source,b"deny_unknown()"),digest(source,b"allow_unknown()"));
    let path="engine/codex-rs/inquello-domain/register/capabilities.json";
    let original:serde_json::Value=serde_json::from_str(include_str!("../../inquello-domain/register/capabilities.json")).unwrap();
    let bytes=|value:&serde_json::Value|serde_json::to_vec(value).unwrap();
    let baseline=digest(path,&bytes(&original));
    let mut metadata=original.clone();
    for entry in metadata["entries"].as_array_mut().unwrap() {
        entry["evidence"]=serde_json::json!([{"reference":"new-report","status":"pending"}]);
        entry["negative_authorization"]=serde_json::json!({"report_digest":"metadata-only"});
    }
    assert_eq!(baseline,digest(path,&bytes(&metadata)));
    let mut eligibility=original.clone();eligibility["entries"][0]["eligibility"]=serde_json::json!("real-data");
    assert_ne!(baseline,digest(path,&bytes(&eligibility)));
    let mut limits=original.clone();limits["entries"][0]["limits"]=serde_json::json!([]);
    assert_ne!(baseline,digest(path,&bytes(&limits)));
    // A similarly named source file is not a metadata-exclusion escape hatch.
    assert_ne!(digest("desktop/src/capabilities.json",&bytes(&original)),digest("desktop/src/capabilities.json",&bytes(&metadata)));
}
