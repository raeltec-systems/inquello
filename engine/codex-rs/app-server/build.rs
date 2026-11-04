//! Versioned behavior fingerprint. Report metadata and the exact schema stamp's
//! validated generation-tree provenance are normalized; all behavior stays measured.
//! Full source-tree and artifact provenance is checked independently by the launcher.
use sha2::{Digest, Sha256};
use std::{
    env, fs,
    path::{Path, PathBuf},
};
pub(crate) const BEHAVIOR_FINGERPRINT_DOMAIN: &[u8] = b"inquello-behavior-fingerprint-v2\0";

fn lowercase_hex(value: Option<&str>, length: usize) -> bool {
    value.is_some_and(|value| {
        value.len() == length
            && value
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    })
}

pub(crate) fn collect(root: &Path, path: &Path, files: &mut Vec<PathBuf>) {
    if path.is_dir() {
        println!("cargo:rerun-if-changed={}", path.display());
        for entry in fs::read_dir(path)
            .unwrap_or_else(|error| panic!("fingerprint input directory: {error}"))
        {
            let entry = entry.unwrap_or_else(|error| panic!("fingerprint input: {error}"));
            let relative = entry
                .path()
                .strip_prefix(root)
                .unwrap_or_else(|error| panic!("input below root: {error}"))
                .to_string_lossy()
                .replace('\\', "/");
            if [
                "engine/codex-rs/target",
                "desktop/node_modules",
                "desktop/dist",
                "desktop/coverage",
                "engine/.git",
            ]
            .contains(&relative.as_str())
            {
                continue;
            }
            let metadata = fs::symlink_metadata(entry.path())
                .unwrap_or_else(|error| panic!("fingerprint metadata: {error}"));
            // Linked dependencies do not silently escape the measured tree. A
            // link that stays inside it is measured by its link text (see
            // `input_bytes`), never by what it points at.
            if metadata.file_type().is_symlink() {
                let target = fs::canonicalize(entry.path())
                    .unwrap_or_else(|error| panic!("linked fingerprint input: {error}"));
                if !target.starts_with(root) {
                    panic!("linked fingerprint input: {}", entry.path().display());
                }
                files.push(entry.path());
                continue;
            }
            collect(root, &entry.path(), files);
        }
    } else if path.is_file() {
        files.push(path.to_owned());
    }
}

/// The existing source normalization and length-delimited hash input. Kept pure
/// so evidence-only exclusions cannot silently grow into enforcement exclusions.
pub(crate) fn hash_input(hash: &mut Sha256, relative: &str, bytes: &[u8]) {
    let mut bytes = bytes.to_vec();
    if relative == "engine/codex-rs/inquello-domain/register/capabilities.json" {
        let mut register: serde_json::Value = serde_json::from_slice(&bytes)
            .unwrap_or_else(|error| panic!("capability register JSON: {error}"));
        for entry in register["entries"]
            .as_array_mut()
            .unwrap_or_else(|| panic!("capability register entries must be an array"))
        {
            let entry = entry
                .as_object_mut()
                .unwrap_or_else(|| panic!("capability register entry must be an object"));
            entry.remove("evidence");
            entry.remove("negative_authorization");
        }
        bytes = serde_json::to_vec(&register)
            .unwrap_or_else(|error| panic!("normalized capability register: {error}"));
    }
    if relative == "desktop/src/protocol/schema-stamp.json" {
        let mut stamp: serde_json::Value = serde_json::from_slice(&bytes)
            .unwrap_or_else(|error| panic!("protocol schema stamp JSON: {error}"));
        let fields = stamp
            .as_object_mut()
            .unwrap_or_else(|| panic!("protocol schema stamp must be an object"));
        assert!(
            ["runtimeVersion", "generator"].iter().all(|key| fields
                .get(*key)
                .and_then(serde_json::Value::as_str)
                .is_some_and(|value| !value.is_empty()))
                && fields
                    .get("experimentalApi")
                    .and_then(serde_json::Value::as_bool)
                    .is_some()
                && fields
                    .get("fileCount")
                    .and_then(serde_json::Value::as_u64)
                    .is_some()
                && lowercase_hex(
                    fields
                        .get("contentSha256")
                        .and_then(serde_json::Value::as_str),
                    64
                )
                && lowercase_hex(
                    fields
                        .get("forkTreeHash")
                        .and_then(serde_json::Value::as_str),
                    40
                ),
            "protocol schema stamp fields are malformed"
        );
        // A genuine regeneration after an evidence-only commit changes this Git
        // tree, not protocol behavior. The generator/launcher still require the
        // actual clean HEAD tree. Keep every other field, including unknown ones,
        // and all generated protocol files in the behavioral measurement.
        fields.remove("forkTreeHash");
        bytes = serde_json::to_vec(&stamp)
            .unwrap_or_else(|error| panic!("normalized protocol schema stamp: {error}"));
    }
    hash.update((relative.len() as u64).to_be_bytes());
    hash.update(relative.as_bytes());
    hash.update((bytes.len() as u64).to_be_bytes());
    hash.update(bytes);
}

/// A file's measured bytes. An in-tree link is measured by its link text, which
/// is exactly what a checkout without symlink support (Windows) writes as the
/// file's content, so every platform measures the same tree.
pub(crate) fn input_bytes(file: &Path) -> Vec<u8> {
    let metadata =
        fs::symlink_metadata(file).unwrap_or_else(|error| panic!("fingerprint metadata: {error}"));
    if metadata.file_type().is_symlink() {
        let target =
            fs::read_link(file).unwrap_or_else(|error| panic!("fingerprint link: {error}"));
        return target.to_string_lossy().replace('\\', "/").into_bytes();
    }
    fs::read(file).unwrap_or_else(|error| panic!("fingerprint input bytes: {error}"))
}

fn main() {
    let root = PathBuf::from(
        env::var("CARGO_MANIFEST_DIR")
            .unwrap_or_else(|error| panic!("fingerprint build setup: {error}")),
    )
    .join("../../..");
    let root = fs::canonicalize(root).unwrap_or_else(|error| panic!("repository root: {error}"));
    let mut files = Vec::new();
    collect(&root, &root.join("engine"), &mut files);
    collect(&root, &root.join("desktop"), &mut files);
    files.sort();
    let mut hash = Sha256::new();
    hash.update(BEHAVIOR_FINGERPRINT_DOMAIN);
    for file in files {
        let relative = file
            .strip_prefix(&root)
            .unwrap_or_else(|error| panic!("fingerprint build setup: {error}"))
            .to_string_lossy()
            .replace('\\', "/");
        println!("cargo:rerun-if-changed={}", file.display());
        hash_input(&mut hash, &relative, &input_bytes(&file));
    }
    for name in [
        "TARGET",
        "PROFILE",
        "OPT_LEVEL",
        "DEBUG",
        "CARGO_CFG_TARGET_FEATURE",
        "CARGO_ENCODED_RUSTFLAGS",
        "CARGO_FEATURE_INFERENCE_FIXTURES",
    ] {
        println!("cargo:rerun-if-env-changed={name}");
        hash.update(name);
        hash.update([0]);
        hash.update(env::var(name).unwrap_or_default());
        hash.update([0]);
    }
    let compiler = std::process::Command::new(env::var("RUSTC").unwrap_or_else(|_| "rustc".into()))
        .arg("--version")
        .output()
        .unwrap_or_else(|error| panic!("compiler identity: {error}"));
    assert!(compiler.status.success());
    hash.update(compiler.stdout);
    println!(
        "cargo:rustc-env=INQUELLO_BEHAVIOR_DIGEST={:x}",
        hash.finalize()
    );
    println!(
        "cargo:rustc-env=INQUELLO_BUILD_PLATFORM={}",
        env::var("TARGET").unwrap_or_else(|error| panic!("fingerprint build setup: {error}"))
    );
    let policy = fs::read(root.join("desktop/data-policy.json"))
        .unwrap_or_else(|error| panic!("data policy: {error}"));
    println!(
        "cargo:rustc-env=INQUELLO_DATA_POLICY_DIGEST={:x}",
        Sha256::digest(policy)
    );
}
