//! Fails if `inquello-domain` reaches a forbidden crate, directly or transitively,
//! through its normal or build dependencies.
//!
//! The domain owns rules, commands and ports. Storage engines, async runtimes,
//! upstream Codex crates and Inquello's own adapters must depend on it, never the
//! other way round.
//!
//! The graph comes from `cargo tree --offline` for the host platform. `cargo metadata`
//! would also work but needs the manifest of every crate in the workspace lock for
//! every platform, which the local registry cache does not hold offline.

use pretty_assertions::assert_eq;
use std::collections::BTreeSet;
use std::process::Command;

const DOMAIN: &str = "inquello-domain";

fn forbidden_reason(name: &str) -> Option<&'static str> {
    if name == "sqlx" || name.starts_with("sqlx-") || name == "libsqlite3-sys" {
        Some("storage engine")
    } else if name == "tokio" || name.starts_with("tokio-") {
        Some("async runtime")
    } else if name.starts_with("codex-") {
        Some("upstream Codex crate")
    } else if name == "inquello-adapters" {
        Some("concrete adapter")
    } else if name.contains("electron") {
        Some("Electron")
    } else {
        None
    }
}

/// One line per dependency edge: its depth in the tree and the crate name.
fn dependency_tree() -> Vec<(usize, String)> {
    let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
    let output = Command::new(cargo)
        .args(["tree", "--offline", "--package", DOMAIN])
        .args([
            "--edges",
            "normal,build",
            "--prefix",
            "depth",
            "--format",
            "{p}",
        ])
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .output()
        .unwrap_or_else(|error| panic!("failed to run cargo tree: {error}"));
    assert!(
        output.status.success(),
        "cargo tree failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(parse_line)
        .collect()
}

fn parse_line(line: &str) -> (usize, String) {
    let digits = line.chars().take_while(char::is_ascii_digit).count();
    let depth = line[..digits]
        .parse()
        .unwrap_or_else(|_| panic!("cargo tree line has no depth: {line:?}"));
    let name = line[digits..]
        .split_whitespace()
        .next()
        .unwrap_or_else(|| panic!("cargo tree line has no crate: {line:?}"));
    (depth, name.to_string())
}

/// Every forbidden crate in `tree`, with the path from the root that reaches it.
fn violations(tree: &[(usize, String)]) -> BTreeSet<String> {
    let mut path: Vec<&str> = Vec::new();
    let mut found = BTreeSet::new();
    for (depth, name) in tree {
        path.truncate(*depth);
        path.push(name);
        if let Some(reason) = forbidden_reason(name) {
            found.insert(format!("{} ({reason})", path.join(" -> ")));
        }
    }
    found
}

#[test]
fn domain_reaches_no_forbidden_crate() {
    let tree = dependency_tree();

    assert_eq!(
        tree.first().map(|(depth, name)| (*depth, name.as_str())),
        Some((0, DOMAIN))
    );
    // Guard against a vacuous pass: the walk must see the domain's own dependency.
    assert!(
        tree.iter()
            .any(|(depth, name)| *depth == 1 && name == "thiserror"),
        "cargo tree did not list thiserror; its output format may have changed"
    );
    let found = violations(&tree);
    assert!(
        found.is_empty(),
        "{DOMAIN} must not depend on these crates:\n{}",
        found.into_iter().collect::<Vec<_>>().join("\n")
    );
}

#[test]
fn violations_are_found_at_any_depth() {
    let tree = [
        (0, DOMAIN.to_string()),
        (1, "uuid".to_string()),
        (2, "sqlx-core".to_string()),
        (1, "thiserror".to_string()),
        (1, "inquello-adapters".to_string()),
        (2, "tokio".to_string()),
    ];
    let expected: BTreeSet<String> = [
        "inquello-domain -> uuid -> sqlx-core (storage engine)",
        "inquello-domain -> inquello-adapters (concrete adapter)",
        "inquello-domain -> inquello-adapters -> tokio (async runtime)",
    ]
    .into_iter()
    .map(str::to_string)
    .collect();
    assert_eq!(violations(&tree), expected);
}

#[test]
fn forbidden_list_covers_the_boundary() {
    for name in [
        "sqlx",
        "sqlx-core",
        "libsqlite3-sys",
        "tokio",
        "codex-core",
        "inquello-adapters",
    ] {
        assert!(forbidden_reason(name).is_some(), "{name} must be forbidden");
    }
    for name in ["thiserror", "uuid", "inquello-domain"] {
        assert!(forbidden_reason(name).is_none(), "{name} must be allowed");
    }
}
