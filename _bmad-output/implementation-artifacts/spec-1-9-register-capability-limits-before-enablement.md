---
title: 'Story 1.9: Register capability limits before enablement'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '8c2f487befc47112a23a280f4a1985011c31384f'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-4-keep-local-working-metadata-behind-domain-commands.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing yet stops an unverified capability from appearing ready. The 99 inventory items (C01–C78, C54A and E01–E20) are not traceably accounted for as enabled, planned or deferred (AD-14, FR-44, NFR-9).

**Approach:** Add a protected capability register to `inquello-domain`. It is a reviewed, committed JSON file compiled into the binary and validated by Rust types. A fail-closed query decides enablement. A committed, range-aware inventory map accounts for every C/E item, and a test proves the map against `epics.md` and `docs/PRODUCT_BRIEF_TRACEABILITY.md`.

**Owner decisions (2026-10-28):**
- **Storage:** the register is a reviewed file compiled in; no runtime path can enable a capability.
- **Mapping:** the map is range-aware. "E06 to E09" covers E06, E07, E08 and E09. Story text is read as well as the shortened `Requirements/inventory` lines, whose ranges list only the endpoints. The meanings were checked: Story 12.7 realises E06–E09 (E07 delegation from a mention, E08 ticket assignment), and Story 5.10 realises E10–E13 (E11 saved scans and findings, E12 focused analysis passes).
- **Gaps:** genuinely unmapped items are recorded as explicit unmet deferrals and stay disabled. They are never approved scope reductions.
- **Checks:** fail on unaccounted items, invalid mappings or unsupported enablement. Recorded planned work and deferrals are allowed.

## Boundaries & Constraints

**Always:**
- **Entry fields:** `id`, `owner`, `supply` (the actual implementation or service), `versions`, `limits`, `identity`, `formats`, `processing_scope`, `eligibility` and `evidence` references, each with `kind`, `status` and `reference`. Unknown fields reject.
- **`enablement(id)` is fail-closed:**
  - An unknown id, a missing entry or missing evidence means `Disabled`.
  - `SyntheticOnly` requires passing synthetic evidence.
  - `RealDataEligible` additionally requires a passing `negative-authorization` evidence reference.
  - Synthetic evidence alone never yields real-data eligibility.
  - A declared eligibility unsupported by its evidence fails validation.
- **Inventory map:** one row per C/E item: `status` (`enabled`, `planned` or `deferred-unmet`), its stories with epic and increment, register entry ids if enabled, and a reason if deferred. Story references must exist in `epics.md`.
- **Parsing:** only story sections are read: headings, user-story text and `Requirements/inventory`. Fixture data such as W3's employee IDs E01–E05 and E99 is ignored. `C1`–`C4` are counterbalance metrics (SM-C1–SM-C4), not C01–C04.
- **Seed register:** a single seed entry, the desktop stdio runtime transport. It is `SyntheticOnly`, citing `desktop/transport-evidence.json` and the smoke handshake. Nothing is real-data eligible.

**Never:**
- No runtime writes, admin overrides or environment toggles that enable a capability.
- No storage in SQLite.
- No change to planning documents to make the check pass.
- No UI (later stories show capability state).
- No new crates.io dependencies beyond workspace pins.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unknown id | `enablement("x.unknown")` | `Disabled` | N/A |
| Synthetic only | Entry with passing synthetic evidence | `SyntheticOnly`; real data not allowed | N/A |
| Failed evidence | Entry claims `SyntheticOnly`, evidence `failed` | Validation error naming the entry | Register load fails; test fails |
| Real-data claim | `RealDataEligible` without a passing negative-authorization reference | Validation error | Test fails |
| Range expansion | "E06 to E09" in Story 12.7 text | E06, E07, E08, E09 mapped to 12.7 | N/A |
| Metric aliases | `C3` in an inventory line | Not mapped to C03 | N/A |
| Unaccounted item | A C/E ID missing from the committed map | Map test fails, naming the ID | N/A |
| Invalid mapping | Map cites a story absent from `epics.md` | Map test fails | N/A |
| Unmapped item | No story realises it | Row `deferred-unmet`, disabled, with reason | Allowed; listed in the report |
| Unsupported enable | Row `enabled` without a register entry that is enabled | Test fails | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/` (Story 1.4) -- add a `capability` module; keep the crate free of sqlx, tokio and `codex-*` (the `dependency_direction` test). Use `serde` and `serde_json` from workspace pins and embed files with `include_str!`.
- `_bmad-output/planning-artifacts/epics.md` -- story headings `### Story N.M:`, `Increment …` lines, user-story text with "Cxx to Cyy" ranges, and `Requirements/inventory:` lines. Fixture text at around line 277 must not be read.
- `docs/PRODUCT_BRIEF_TRACEABILITY.md` -- the canonical 79 C rows (C01–C78 plus C54A) and 20 E rows with their titles.
- `desktop/transport-evidence.json` -- evidence for the seed entry.

## Tasks & Acceptance

**Execution:**
- [x] `engine/codex-rs/inquello-domain/src/capability/` -- the entry types (`deny_unknown_fields`), `Eligibility`, `EvidenceRef`, validation, `CapabilityRegister::load_embedded()` and `enablement(id)`.
- [x] `engine/codex-rs/inquello-domain/register/capabilities.json` and `inventory-map.json` -- the seed entry, and the generated map of 99 rows.
- [x] `engine/codex-rs/inquello-domain/tests/capability_register.rs` -- every matrix row for the register.
- [x] `engine/codex-rs/inquello-domain/tests/inventory_map.rs` -- rebuilds the map from the two documents, range-aware and limited to story sections, and compares it with the committed file. It writes the file when `INQUELLO_WRITE_INVENTORY=1` is set. It checks coverage, story existence and enablement consistency, and prints the deferred-unmet list.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- one entry listing any `deferred-unmet` items as unmet scope (not reductions).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-9.

**Acceptance Criteria:**
- Given the committed register and map, when `cargo test -p inquello-domain` runs, then every C/E item is accounted for, only the seed entry is non-disabled (and only `SyntheticOnly`), and the deferred-unmet list is printed.

## Implementation Notes

- **Cloud machine (Linux, root):** the engine is built under `engine/codex-rs/target`, so use `-j 4`. `Cargo.lock` is committed: `cargo build --locked` must leave it unchanged.
  - **Engine stamp:** any `engine/` change alters `HEAD:engine`. After committing, rerun `pnpm generate:protocol` in `desktop/` so the stamp follows it; only `schema-stamp.json` should change. Then `pnpm test` must pass. The stamp test compares against `HEAD:engine`, so it needs the engine change committed first.
- **Baseline:** the Story 1.4 crates' 33 tests pass and the desktop's 382 tests pass.
- **Evidence kinds:** `synthetic`, `negative-authorization` and `record`. A `record` (such as `desktop/transport-evidence.json`) documents limits but never supports eligibility; any `failed` reference on a non-disabled entry rejects the register; `pending` counts as missing. References are repository paths with an optional `#locator`, and a test checks each path exists.
- **Embedded query:** `capability::enablement(id)` reads the embedded register once; if it ever failed validation, every id is `Disabled`.
- **Ranges** expand in the traceability document's canonical order, so "C53 to C57" includes C54A (Story 1.13 also lists C54A directly).
- **Curated fields:** only `status: enabled` and its `register_entries` are hand-edited in the map; regeneration keeps them and the register check proves them. No row is `enabled` yet: the seed entry covers only the stdio transport, not all of C41, so C41 stays `planned`.
- **Printing:** the deferred-unmet list is written directly to stderr, so it shows in a normal `cargo test` run.
- **Results (2026-10-28):** 54 Rust tests pass in the two crates (21 new); 99 items are accounted for: 99 `planned`, 0 `enabled`, 0 `deferred-unmet`. Clippy and fmt are clean; `cargo build --locked` leaves the tree clean after the lock commit (two new lock lines: `serde`, `serde_json` under `inquello-domain`). `FORK-CUT.md` records Patch 2. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `engine/codex-rs`):**
- `cargo test -p inquello-domain -p inquello-adapters` -- expected: all pass
- `cargo clippy -p inquello-domain --all-targets -- -D warnings` and `cargo fmt -p inquello-domain -- --check` -- expected: clean
- `cargo build --locked -j 4 -p inquello-domain`, then `git status --porcelain` -- expected: no changes
- In `desktop/`: `pnpm generate:protocol` (engine tree changed) and `pnpm test` -- expected: only the stamp hash changes; all pass
