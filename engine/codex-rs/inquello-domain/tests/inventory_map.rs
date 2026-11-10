//! Proves `register/inventory-map.json` against the planning documents.
//!
//! The map is rebuilt from `docs/PRODUCT_BRIEF_TRACEABILITY.md` (the canonical 79 C
//! and 20 E items) and `_bmad-output/planning-artifacts/epics.md` (which stories
//! realise them) and compared with the committed file. Set
//! `INQUELLO_WRITE_INVENTORY=1` to write the rebuilt map instead.
//!
//! Only story sections of `epics.md` are read: the `### Story N.M:` heading, the
//! user-story lines (`As ...`, `I want ...`, `So that ...`) and the
//! `Requirements/inventory:` line. Ranges such as "E06 to E09" cover every item
//! between the endpoints in canonical order. Fixture text (for example W3's employee
//! IDs E01 to E05 and E99) lies outside story sections and is never read, and
//! single-digit `C1` to `C4` are the SM-C counter-metrics, not C01 to C04.
//!
//! `status: enabled` and its `register_entries` are the only hand-curated fields;
//! the rebuild keeps them from the committed file and the register check proves them.

use inquello_domain::capability::CapabilityRegister;
use inquello_domain::capability::InventoryMap;
use inquello_domain::capability::InventoryRow;
use inquello_domain::capability::InventoryStatus;
use inquello_domain::capability::StoryRef;
use pretty_assertions::assert_eq;
use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::io::Write;
use std::path::Path;
use std::path::PathBuf;

const EPICS: &str = "_bmad-output/planning-artifacts/epics.md";
const TRACEABILITY: &str = "docs/PRODUCT_BRIEF_TRACEABILITY.md";
const MAP_FILE: &str = "register/inventory-map.json";

fn repo_root() -> PathBuf {
    // engine/codex-rs/inquello-domain -> repository root.
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .ancestors()
        .nth(3)
        .unwrap_or_else(|| panic!("no repository root above {}", env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn read(path: &Path) -> String {
    std::fs::read_to_string(path)
        .unwrap_or_else(|error| panic!("read {}: {error}", path.display()))
        .replace("\r\n", "\n")
}

// ---------------------------------------------------------------------------
// Canonical inventory from the traceability document.

/// The canonical C/E items, in document order, with their titles.
fn canonical_items(traceability: &str) -> Vec<(String, String)> {
    let mut items = Vec::new();
    let mut in_inventory = false;
    for line in traceability.lines() {
        if let Some(heading) = line.strip_prefix("## ") {
            in_inventory =
                heading == "Existing capability inventory" || heading == "Expanded behaviors";
            continue;
        }
        if !in_inventory || !line.starts_with('|') {
            continue;
        }
        let cells: Vec<&str> = line.split('|').map(str::trim).collect();
        let (Some(first), Some(title)) = (cells.get(1), cells.get(2)) else {
            continue;
        };
        // `[C01](link)` or `E01`.
        let id = first
            .strip_prefix('[')
            .and_then(|rest| rest.split(']').next())
            .unwrap_or(first);
        if is_inventory_id(id) {
            items.push((id.to_string(), (*title).to_string()));
        }
    }
    items
}

fn is_inventory_id(id: &str) -> bool {
    let bytes = id.as_bytes();
    match bytes {
        [b'C', a, b] | [b'E', a, b] => a.is_ascii_digit() && b.is_ascii_digit(),
        [b'C', a, b, b'A'] => a.is_ascii_digit() && b.is_ascii_digit(),
        _ => false,
    }
}

// ---------------------------------------------------------------------------
// Story sections from epics.md.

#[derive(Clone, Debug, PartialEq, Eq)]
struct Story {
    number: String,
    epic: u32,
    minor: u32,
    increment: String,
    /// The heading, user-story text and Requirements/inventory line.
    text: Vec<String>,
}

fn parse_stories(epics: &str) -> Vec<Story> {
    let mut stories: Vec<Story> = Vec::new();
    let mut current: Option<Story> = None;
    for line in epics.lines() {
        if line.starts_with("## ") || line.starts_with("### ") {
            stories.extend(current.take());
            if let Some(rest) = line.strip_prefix("### Story ") {
                let (number, title) = rest
                    .split_once(':')
                    .unwrap_or_else(|| panic!("story heading without a colon: {line:?}"));
                let (epic, minor) = number
                    .split_once('.')
                    .and_then(|(epic, minor)| Some((epic.parse().ok()?, minor.parse().ok()?)))
                    .unwrap_or_else(|| panic!("story number is not N.M: {line:?}"));
                current = Some(Story {
                    number: number.to_string(),
                    epic,
                    minor,
                    increment: String::new(),
                    text: vec![title.trim().to_string()],
                });
            }
            continue;
        }
        let Some(story) = current.as_mut() else {
            continue;
        };
        let trimmed = line.trim();
        if story.increment.is_empty()
            && (trimmed.starts_with("Increment ") || trimmed.starts_with("V2"))
        {
            story.increment = trimmed
                .split(". ")
                .next()
                .unwrap_or(trimmed)
                .trim_end_matches('.')
                .to_string();
            if let Some((_, requirements)) = trimmed.split_once("Requirements/inventory:") {
                story.text.push(requirements.to_string());
            }
        } else if trimmed.starts_with("As ")
            || trimmed.starts_with("I want ")
            || trimmed.starts_with("So that ")
        {
            story.text.push(trimmed.to_string());
        }
    }
    stories.extend(current);
    stories
}

/// Every inventory item `text` names, with ranges expanded in canonical order.
/// Returns an error for an ID or range endpoint that is not in the inventory.
fn referenced_items(text: &str, order: &[String]) -> Result<BTreeSet<String>, String> {
    let position = |id: &str| order.iter().position(|item| item == id);
    let tokens = id_tokens(text);
    let mut found = BTreeSet::new();
    let mut index = 0;
    while index < tokens.len() {
        let (_, end, id) = &tokens[index];
        let Some(from) = position(id) else {
            return Err(format!("{id} is not a C/E inventory item"));
        };
        if let Some((next_start, _, to_id)) = tokens.get(index + 1)
            && text[*end..*next_start].trim() == "to"
        {
            let Some(to) = position(to_id) else {
                return Err(format!("{to_id} is not a C/E inventory item"));
            };
            if to < from || id.as_bytes()[0] != to_id.as_bytes()[0] {
                return Err(format!("{id} to {to_id} is not a valid range"));
            }
            found.extend(order[from..=to].iter().cloned());
            index += 2;
            continue;
        }
        found.insert(id.clone());
        index += 1;
    }
    Ok(found)
}

/// `(start, end, id)` for each C/E-shaped token: `C` or `E`, two digits, and an
/// optional `A` after a C, standing alone. `SM-C3`, `C1` and `A1/E01`-style
/// fragments do not match because of the two-digit rule and the boundary rule.
fn id_tokens(text: &str) -> Vec<(usize, usize, String)> {
    let bytes = text.as_bytes();
    let boundary = |byte: Option<&u8>| {
        byte.is_none_or(|byte| {
            !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'/'))
        })
    };
    let mut tokens = Vec::new();
    let mut index = 0;
    while index < bytes.len() {
        let prefix = bytes[index];
        let starts = matches!(prefix, b'C' | b'E')
            && boundary(index.checked_sub(1).and_then(|before| bytes.get(before)))
            && bytes.get(index + 1).is_some_and(u8::is_ascii_digit)
            && bytes.get(index + 2).is_some_and(u8::is_ascii_digit);
        if starts {
            let mut end = index + 3;
            if prefix == b'C' && bytes.get(end) == Some(&b'A') {
                end += 1;
            }
            if boundary(bytes.get(end)) {
                tokens.push((index, end, text[index..end].to_string()));
                index = end;
                continue;
            }
        }
        index += 1;
    }
    tokens
}

// ---------------------------------------------------------------------------
// Building and checking the map.

fn deferral_reason(id: &str, title: &str) -> String {
    format!(
        "No story in epics.md realises {id} ({title}). Recorded as unmet scope, not an approved \
         reduction; it stays disabled until a story delivers it and a register entry enables it."
    )
}

fn build_map(
    canonical: &[(String, String)],
    stories: &[Story],
    committed: Option<&InventoryMap>,
) -> Result<InventoryMap, String> {
    let order: Vec<String> = canonical.iter().map(|(id, _)| id.clone()).collect();
    let mut realised: BTreeMap<String, Vec<&Story>> = BTreeMap::new();
    for story in stories {
        let items = referenced_items(&story.text.join("\n"), &order)
            .map_err(|error| format!("Story {}: {error}", story.number))?;
        for item in items {
            realised.entry(item).or_default().push(story);
        }
    }
    let mut items = Vec::new();
    for (id, title) in canonical {
        let mut realising = realised.remove(id).unwrap_or_default();
        realising.sort_by_key(|story| (story.epic, story.minor));
        realising.dedup_by_key(|story| story.number.clone());
        let story_refs: Vec<StoryRef> = realising
            .iter()
            .map(|story| StoryRef {
                story: story.number.clone(),
                epic: story.epic,
                increment: story.increment.clone(),
            })
            .collect();
        let curated = committed
            .and_then(|map| map.row(id))
            .filter(|row| row.status == InventoryStatus::Enabled);
        let row = if let Some(curated) = curated {
            InventoryRow {
                id: id.clone(),
                title: title.clone(),
                status: InventoryStatus::Enabled,
                stories: story_refs,
                register_entries: curated.register_entries.clone(),
                reason: None,
            }
        } else if story_refs.is_empty() {
            InventoryRow {
                id: id.clone(),
                title: title.clone(),
                status: InventoryStatus::DeferredUnmet,
                stories: Vec::new(),
                register_entries: Vec::new(),
                reason: Some(deferral_reason(id, title)),
            }
        } else {
            InventoryRow {
                id: id.clone(),
                title: title.clone(),
                status: InventoryStatus::Planned,
                stories: story_refs,
                register_entries: Vec::new(),
                reason: None,
            }
        };
        items.push(row);
    }
    Ok(InventoryMap {
        schema_version: 1,
        sources: vec![EPICS.to_string(), TRACEABILITY.to_string()],
        items,
    })
}

/// Problems with coverage: every canonical item exactly once, nothing else.
fn coverage_problems(map: &InventoryMap, canonical: &[(String, String)]) -> Vec<String> {
    let expected: BTreeSet<&str> = canonical.iter().map(|(id, _)| id.as_str()).collect();
    let mut seen = BTreeSet::new();
    let mut problems = Vec::new();
    for row in &map.items {
        if !expected.contains(row.id.as_str()) {
            problems.push(format!("{} is not a C/E inventory item", row.id));
        }
        if !seen.insert(row.id.as_str()) {
            problems.push(format!("{} appears more than once", row.id));
        }
    }
    for id in expected.difference(&seen) {
        problems.push(format!("{id} is not accounted for in the inventory map"));
    }
    problems
}

/// Problems with story references: each cited story must exist in epics.md with
/// the same epic and increment.
fn story_problems(map: &InventoryMap, stories: &[Story]) -> Vec<String> {
    let known: BTreeMap<&str, &Story> = stories
        .iter()
        .map(|story| (story.number.as_str(), story))
        .collect();
    let mut problems = Vec::new();
    for row in &map.items {
        for cited in &row.stories {
            match known.get(cited.story.as_str()) {
                None => problems.push(format!(
                    "{} cites Story {}, which is not in epics.md",
                    row.id, cited.story
                )),
                Some(story) if story.epic != cited.epic || story.increment != cited.increment => {
                    problems.push(format!(
                        "{} cites Story {} as epic {} / {:?}; epics.md says epic {} / {:?}",
                        row.id,
                        cited.story,
                        cited.epic,
                        cited.increment,
                        story.epic,
                        story.increment
                    ));
                }
                Some(_) => {}
            }
        }
    }
    problems
}

fn to_json(map: &InventoryMap) -> String {
    let mut json = serde_json::to_string_pretty(map)
        .unwrap_or_else(|error| panic!("serialise inventory map: {error}"));
    json.push('\n');
    json
}

// ---------------------------------------------------------------------------
// The real documents.

#[test]
fn committed_map_matches_the_planning_documents() {
    let root = repo_root();
    let canonical = canonical_items(&read(&root.join(TRACEABILITY)));
    let stories = parse_stories(&read(&root.join(EPICS)));
    let map_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(MAP_FILE);
    let committed_json = read(&map_path);
    let committed = InventoryMap::from_json(&committed_json).ok();

    let rebuilt = build_map(&canonical, &stories, committed.as_ref())
        .unwrap_or_else(|error| panic!("invalid mapping in {EPICS}: {error}"));
    let rebuilt_json = to_json(&rebuilt);

    if std::env::var("INQUELLO_WRITE_INVENTORY").as_deref() == Ok("1") {
        std::fs::write(&map_path, &rebuilt_json)
            .unwrap_or_else(|error| panic!("write {}: {error}", map_path.display()));
    } else {
        let committed = committed.unwrap_or_else(|| {
            panic!("{MAP_FILE} does not parse; rerun with INQUELLO_WRITE_INVENTORY=1")
        });
        let problems = coverage_problems(&committed, &canonical);
        assert!(
            problems.is_empty(),
            "inventory map coverage:\n{}",
            problems.join("\n")
        );
        let problems = story_problems(&committed, &stories);
        assert!(
            problems.is_empty(),
            "inventory map stories:\n{}",
            problems.join("\n")
        );
        assert_eq!(
            committed_json, rebuilt_json,
            "{MAP_FILE} is out of date with the planning documents; review the change and \
             rerun with INQUELLO_WRITE_INVENTORY=1"
        );
    }

    let register = CapabilityRegister::load_embedded()
        .unwrap_or_else(|error| panic!("embedded register: {error}"));
    rebuilt
        .validate(&register)
        .unwrap_or_else(|error| panic!("inventory map: {error}"));

    let deferred: Vec<&InventoryRow> = rebuilt.deferred_unmet().collect();
    // Written straight to stderr so the list shows in an ordinary `cargo test` run.
    let mut stderr = std::io::stderr();
    let _ = writeln!(
        stderr,
        "inventory map: {} items, {} deferred-unmet (unmet scope, disabled):",
        rebuilt.items.len(),
        deferred.len()
    );
    for row in &deferred {
        let _ = writeln!(stderr, "  {} {}", row.id, row.title);
    }
}

#[test]
fn canonical_inventory_has_79_c_and_20_e_items() {
    let canonical = canonical_items(&read(&repo_root().join(TRACEABILITY)));
    let c = canonical
        .iter()
        .filter(|(id, _)| id.starts_with('C'))
        .count();
    let e = canonical
        .iter()
        .filter(|(id, _)| id.starts_with('E'))
        .count();
    assert_eq!((c, e), (79, 20));
    assert!(canonical.iter().any(|(id, _)| id == "C54A"));
}

#[test]
fn documented_ranges_expand_to_every_item() {
    let root = repo_root();
    let canonical = canonical_items(&read(&root.join(TRACEABILITY)));
    let stories = parse_stories(&read(&root.join(EPICS)));
    let map = build_map(&canonical, &stories, None).unwrap_or_else(|error| panic!("{error}"));
    let cited = |id: &str| -> Vec<String> {
        map.row(id)
            .map(|row| {
                row.stories
                    .iter()
                    .map(|story| story.story.clone())
                    .collect()
            })
            .unwrap_or_default()
    };
    for id in ["E06", "E07", "E08", "E09"] {
        assert!(
            cited(id).contains(&"12.7".to_string()),
            "{id} must map to Story 12.7"
        );
    }
    for id in ["E10", "E11", "E12", "E13"] {
        assert!(
            cited(id).contains(&"5.10".to_string()),
            "{id} must map to Story 5.10"
        );
    }
}

// ---------------------------------------------------------------------------
// Matrix rows on synthetic inputs.

fn order() -> Vec<String> {
    let mut order: Vec<String> = (1..=78).map(|n| format!("C{n:02}")).collect();
    let after_c54 = order.iter().position(|id| id == "C54").map_or(0, |i| i + 1);
    order.insert(after_c54, "C54A".to_string());
    order.extend((1..=20).map(|n| format!("E{n:02}")));
    order
}

fn set(ids: &[&str]) -> BTreeSet<String> {
    ids.iter().map(|id| (*id).to_string()).collect()
}

#[test]
fn range_expansion_covers_every_item_between_endpoints() {
    assert_eq!(
        referenced_items("(C44, E06 to E09, FR-24)", &order()),
        Ok(set(&["C44", "E06", "E07", "E08", "E09"]))
    );
    // C54A sits between C54 and C55 in canonical order.
    assert_eq!(
        referenced_items("FR-29, C53 to C57, OQ-9", &order()),
        Ok(set(&["C53", "C54", "C54A", "C55", "C56", "C57"]))
    );
    assert!(referenced_items("E09 to E06", &order()).is_err());
    assert!(referenced_items("C78 to E01", &order()).is_err());
}

#[test]
fn metric_aliases_are_not_inventory_items() {
    assert_eq!(
        referenced_items("A01, A16, A18, C1, C4, FR-44, SM-C3, SM-C4", &order()),
        Ok(BTreeSet::new())
    );
    assert_eq!(
        referenced_items("A14, C3, C65, C70", &order()),
        Ok(set(&["C65", "C70"]))
    );
}

#[test]
fn unknown_ids_are_invalid_mappings() {
    assert!(referenced_items("C79", &order()).is_err());
    assert!(referenced_items("E21", &order()).is_err());
}

const SAMPLE_EPICS: &str = "\
# Epics

- **W3 Access review:** HR E01 to E05 (E02 terminated); A5/E99.

## Epic 12: Bounded work

Increment 2 / V1; 1 stories.

### Story 12.7: Start review from source platforms (C44)

As an Internal Audit Manager,
I want reviews started from E06 to E09 sources,
So that review starts where requested (C44, E06 to E09, FR-24).

Increment 2 (V1). Origin: old Story 10.5. Requirements/inventory: A16, AD-11, C44, E06, E09, FR-24.

**Acceptance Criteria:**

**Then** E01 is mentioned only in acceptance text (SM-C4).

## Epic 14: Other
";

#[test]
fn only_story_sections_are_read() {
    let stories = parse_stories(SAMPLE_EPICS);
    assert_eq!(stories.len(), 1);
    let story = &stories[0];
    assert_eq!(
        (story.number.as_str(), story.epic, story.minor),
        ("12.7", 12, 7)
    );
    assert_eq!(story.increment, "Increment 2 (V1)");
    assert_eq!(
        referenced_items(&story.text.join("\n"), &order()),
        Ok(set(&["C44", "E06", "E07", "E08", "E09"]))
    );
}

fn sample_canonical() -> Vec<(String, String)> {
    ["C44", "E01", "E06", "E07", "E08", "E09"]
        .iter()
        .map(|id| ((*id).to_string(), format!("Title of {id}")))
        .collect()
}

#[test]
fn unmapped_items_are_deferred_unmet_with_a_reason() {
    let map = build_map(&sample_canonical(), &parse_stories(SAMPLE_EPICS), None)
        .unwrap_or_else(|error| panic!("{error}"));
    let e01 = map.row("E01").unwrap_or_else(|| panic!("E01 row"));
    assert_eq!(e01.status, InventoryStatus::DeferredUnmet);
    assert!(e01.stories.is_empty());
    assert!(
        e01.reason
            .as_deref()
            .is_some_and(|reason| reason.contains("not an approved reduction"))
    );
    let e07 = map.row("E07").unwrap_or_else(|| panic!("E07 row"));
    assert_eq!(e07.status, InventoryStatus::Planned);
    let register = CapabilityRegister::load_embedded().unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(map.validate(&register), Ok(()));
}

#[test]
fn an_unaccounted_item_is_named() {
    let mut map = build_map(&sample_canonical(), &parse_stories(SAMPLE_EPICS), None)
        .unwrap_or_else(|error| panic!("{error}"));
    map.items.retain(|row| row.id != "E08");
    assert_eq!(
        coverage_problems(&map, &sample_canonical()),
        vec!["E08 is not accounted for in the inventory map".to_string()]
    );
}

#[test]
fn a_story_absent_from_epics_is_an_invalid_mapping() {
    let stories = parse_stories(SAMPLE_EPICS);
    let mut map =
        build_map(&sample_canonical(), &stories, None).unwrap_or_else(|error| panic!("{error}"));
    if let Some(row) = map.items.iter_mut().find(|row| row.id == "C44") {
        row.stories.push(StoryRef {
            story: "12.99".to_string(),
            epic: 12,
            increment: "Increment 2 (V1)".to_string(),
        });
    }
    assert_eq!(
        story_problems(&map, &stories),
        vec!["C44 cites Story 12.99, which is not in epics.md".to_string()]
    );
}

#[test]
fn an_enabled_row_needs_an_enabled_register_entry() {
    let register = CapabilityRegister::load_embedded().unwrap_or_else(|error| panic!("{error}"));
    let committed = |entries: &[&str]| InventoryMap {
        schema_version: 1,
        sources: Vec::new(),
        items: vec![InventoryRow {
            id: "C44".to_string(),
            title: "Title of C44".to_string(),
            status: InventoryStatus::Enabled,
            stories: Vec::new(),
            register_entries: entries.iter().map(|entry| (*entry).to_string()).collect(),
            reason: None,
        }],
    };
    for entries in [&[][..], &["x.unknown"][..]] {
        let map = build_map(&sample_canonical(), &[], Some(&committed(entries)))
            .unwrap_or_else(|error| panic!("{error}"));
        assert!(
            map.validate(&register).is_err(),
            "enabled with {entries:?} must fail validation"
        );
    }
    let map = build_map(
        &sample_canonical(),
        &[],
        Some(&committed(&["desktop.runtime-transport.stdio"])),
    )
    .unwrap_or_else(|error| panic!("{error}"));
    assert_eq!(map.validate(&register), Ok(()));
}
