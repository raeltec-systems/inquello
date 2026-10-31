//! Versioned behavior fingerprint. Evidence metadata is the sole source-content
//! exclusion; generated build/cache directories are outputs, not build inputs.
use sha2::{Digest, Sha256};
use std::{env, fs, path::{Path, PathBuf}};
pub(crate) fn collect(root: &Path, path: &Path, files: &mut Vec<PathBuf>) {
    if path.is_dir() {
        println!("cargo:rerun-if-changed={}",path.display());
        for entry in fs::read_dir(path).expect("fingerprint input directory") {
            let entry = entry.expect("fingerprint input");
            let relative = entry.path().strip_prefix(root).expect("input below root").to_string_lossy().replace('\\', "/");
            if ["engine/codex-rs/target", "desktop/node_modules", "desktop/dist", "desktop/coverage", "engine/.git"].contains(&relative.as_str()) { continue; }
            let metadata = fs::symlink_metadata(entry.path()).expect("fingerprint metadata");
            // Linked dependencies do not silently escape the measured tree.
            if metadata.file_type().is_symlink() { panic!("linked fingerprint input: {}", entry.path().display()); }
            collect(root, &entry.path(), files);
        }
    } else if path.is_file() { files.push(path.to_owned()); }
}

/// The existing source normalization and length-delimited hash input. Kept pure
/// so evidence-only exclusions cannot silently grow into enforcement exclusions.
pub(crate) fn hash_input(hash: &mut Sha256, relative: &str, bytes: &[u8]) {
    let mut bytes = bytes.to_vec();
    if relative == "engine/codex-rs/inquello-domain/register/capabilities.json" {
        let mut register: serde_json::Value = serde_json::from_slice(&bytes).expect("capability register JSON");
        for entry in register["entries"].as_array_mut().expect("register entries") {
            let entry = entry.as_object_mut().expect("register entry");
            entry.remove("evidence"); entry.remove("negative_authorization");
        }
        bytes = serde_json::to_vec(&register).expect("normalized capability register");
    }
    hash.update((relative.len() as u64).to_be_bytes()); hash.update(relative.as_bytes());
    hash.update((bytes.len() as u64).to_be_bytes()); hash.update(bytes);
}

fn main() {
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("../../..");
    let root = fs::canonicalize(root).expect("repository root");
    let mut files = Vec::new();
    collect(&root, &root.join("engine"), &mut files);
    collect(&root, &root.join("desktop"), &mut files);
    files.sort();
    let mut hash = Sha256::new(); hash.update(b"inquello-behavior-fingerprint-v1\0");
    for file in files {
        let relative = file.strip_prefix(&root).unwrap().to_string_lossy().replace('\\', "/");
        println!("cargo:rerun-if-changed={}", file.display());
        let bytes = fs::read(&file).expect("fingerprint input bytes");
        hash_input(&mut hash, &relative, &bytes);
    }
    for name in ["TARGET", "PROFILE", "OPT_LEVEL", "DEBUG", "CARGO_CFG_TARGET_FEATURE", "CARGO_ENCODED_RUSTFLAGS", "CARGO_FEATURE_INFERENCE_FIXTURES"] {
        println!("cargo:rerun-if-env-changed={name}");
        hash.update(name); hash.update([0]); hash.update(env::var(name).unwrap_or_default()); hash.update([0]);
    }
    let compiler = std::process::Command::new(env::var("RUSTC").unwrap_or_else(|_| "rustc".into())).arg("--version").output().expect("compiler identity");
    assert!(compiler.status.success()); hash.update(compiler.stdout);
    println!("cargo:rustc-env=INQUELLO_BEHAVIOR_DIGEST={:x}", hash.finalize());
    println!("cargo:rustc-env=INQUELLO_BUILD_PLATFORM={}", env::var("TARGET").unwrap());
    let policy = fs::read(root.join("desktop/data-policy.json")).expect("data policy");
    println!("cargo:rustc-env=INQUELLO_DATA_POLICY_DIGEST={:x}", Sha256::digest(policy));
}
