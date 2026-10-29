---
title: 'Story 1.4: Keep local working metadata behind domain-owned commands'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '559c7bccbc0b59b671fea105a212b6a37113ef8d'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/FORK-CUT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Inquello has no working store of its own. AD-4/AD-7 require one: a separate local SQLite store, written only through domain commands that check an operation ID and an expected revision, with the domain kept free of Electron and of concrete adapters.

**Approach:** Add two Rust crates inside the engine workspace, as the spine seed lays out. `inquello-domain` holds the rules, commands and ports. `inquello-adapters` holds a sqlx SQLite repository that implements those ports. The first and only working metadata is one `store_info` record plus durable operation receipts.

**Owner decisions (2026-10-28):** crates and tests only, with no app-server or desktop wiring (the first caller arrives with Story 1.14). The first record is store info plus receipts. Code lives in `engine/codex-rs/`.

## Boundaries & Constraints

**Always:** The domain crate depends on no sqlx, tokio runtime, `codex-*` crate or `inquello-adapters`. Ports are traits owned by the domain, and the adapter implements them. Every mutation carries an operation ID and an expected revision. The receipt and the state change commit in one SQLite transaction. The adapter refuses SQLite older than 3.51.3 at open. Migrations live in the adapter. The store file is created with owner-only permissions on Unix. Opening a path inside any agent-writable root is refused. Use workspace dependencies only.

**Never:** No Workspace, Engagement, Task or other future tables. No wiring into app-server, CLI or desktop. No new crates.io dependencies beyond the workspace's existing pins. No changes to existing engine crates' code. No raw sqlx connect outside the adapter's single shim.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initialize | Empty store, `InitializeStore{op, expected_revision: 0}` | `store_info` created at revision 1; receipt `applied` | N/A |
| Replay | Same op ID and same command again | The stored receipt returned; nothing re-applied | N/A |
| Op ID reuse | Same op ID, different command or revision | Rejected | `OperationConflict` |
| Stale revision | `expected_revision` ≠ current | Nothing written | `RevisionConflict{expected, actual}` |
| Invalid op ID | Empty, over 128 bytes or non-printable | Rejected before the port is called | `InvalidCommand` |
| Old SQLite | Linked `sqlite_version()` < 3.51.3 | Open fails | `UnsupportedSqlite{found}` |
| Agent-writable path | Store path inside a supplied writable root | Open refused | `StoreLocationNotProtected` |
| Interrupted write | Failure between state and receipt write | Transaction rolled back; neither persisted | Error surfaced |
| Reopen | Store reopened after restart | Same `store_id`, revision and receipts | N/A |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/Cargo.toml` -- `[workspace] members` (around line 2) and `[workspace.dependencies]` (`codex-state = { path = "state" }` near line 289). Add both crates and reuse the pinned `sqlx` (with `sqlite-bundled`), `uuid`, `serde`, `thiserror`, `tokio` and `pretty_assertions`.
- `engine/codex-rs/Cargo.lock` -- regenerates with the new members. This also commits the 0.165.0 workspace versions, which resolves the deferred "Cargo.lock 0.0.0" item; `cargo build --locked` must then pass.
- `engine/codex-rs/clippy.toml` -- forbids `sqlx` connect/`create_database` outside a shim. Mirror `state/src/sqlite.rs:1-9`, which allows those calls in one module via `#![expect(clippy::disallowed_methods, reason = ...)]`.
- `engine/codex-rs/state/src/sqlite.rs` -- reference only, for the WAL setup, busy timeout and embedded `Migrator`. Do not change it.
- `engine/codex-rs/state/Cargo.toml` -- template for a crate manifest (`version.workspace`, `[lints] workspace = true`).
- `engine/codex-rs/*/BUILD.bazel` -- upstream Bazel files. Bazel is not used here, so the new crates get none.

## Tasks & Acceptance

**Execution:**
- [x] `engine/codex-rs/inquello-domain/` -- `StoreInfo{store_id, schema_version, revision, created_at}`, `OperationId`, `Receipt`, `InitializeStore` and a `get_store_info` query. Port traits `WorkingStore` (load, atomic commit of state plus receipt, find receipt) and `Clock`. The command handler validates input, handles replay, conflicts and expected revision, then commits through the port. Unit tests use an in-memory fake port.
- [x] `engine/codex-rs/inquello-adapters/` -- `SqliteWorkingStore::open(path, agent_writable_roots)`: version gate, location check, owner-only file mode, WAL, busy timeout, embedded migration `0001_store_info_and_receipts.sql`. It implements `WorkingStore` with one transaction per commit (unique op ID, revision compare-and-set). A `SystemClock` too.
- [x] `engine/codex-rs/inquello-adapters/tests/` -- every matrix row against a temp-dir store, plus a rollback test using an injected failure.
- [x] `engine/codex-rs/inquello-domain/tests/dependency_direction.rs` -- reads `cargo metadata` and fails if the domain crate reaches any forbidden crate, directly or transitively.
- [x] `engine/codex-rs/Cargo.toml`, `Cargo.lock` -- add members and workspace entries; commit the regenerated lock.
- [x] `FORK-CUT.md`, `_bmad-output/implementation-artifacts/deferred-work.md` -- record the first deliberate engine patch (new crates, workspace manifest, lock) and close the Cargo.lock item.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-4.

**Acceptance Criteria:**
- Given the engine workspace, when `cargo build --locked -p inquello-adapters` runs, then it succeeds with no lockfile rewrite.
- Given the adapter, when it reports `sqlite_version()`, then the value is 3.51.3 or later, and a test asserts it.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [ ] [Review][Patch] R10: Concurrent identical local commands return a false revision conflict [engine/codex-rs/inquello-adapters/src/store.rs:127] — BMAD medium; likelihood Low; impact Medium; change risk Moderate — recommendation: Schedule before the first concurrent command consumer.

#### Rejected

- #5 Database symlink to directory can change permissions — `low`; likelihood Low, impact Low. Canonicalization accepts the directory target; on Unix ensure_owner_only_file can tighten it from 0755 to 0700 before open fails. Requires an invalid configured database path, has no present production caller, and the owner keeps access. Additional special-file guard complexity is not justified for this low present risk.

## Implementation Notes

- **Cloud machine (Linux, root):** the engine is already built under `engine/codex-rs/target`, and desktop dependencies are installed. Use `-j 4` for cargo. Before this story, every cargo command rewrote `Cargo.lock` to 0.165.0 versions. That rewrite is now meant to be committed, together with the new members. `cargo metadata` works offline from the local registry cache. Never pass `--no-sandbox` to Electron. Desktop tests run with `pnpm test` in `desktop/`.
- **Dependency check uses `cargo tree --offline`.** `cargo metadata` resolves every platform and needs crates not cached here, such as `alsa` and `js-sys`. So the dependency test reads the host platform's tree, and a forbidden crate added only on another platform would not be caught. Logged in `deferred-work.md`.
- **Rollback test uses a natural failure.** It commits a change whose receipt reuses an existing operation ID: the state write succeeds, the receipt insert fails, and both roll back. Production code has no fault-injection hook.
- **Old-SQLite row** is tested on `check_sqlite_version` with older version strings, because the bundled library is 3.51.3. A separate test asserts the linked version meets the floor.
- **Extra error:** `InitializeStore` sent to an already-initialized store at its current revision returns `AlreadyInitialized`.
- **Line endings:** `inquello-adapters/.gitattributes` pins `migrations/*.sql` to LF. The migration checksum covers line endings, so under `core.autocrlf=true` a store made by one checkout could fail to open in another.
- **Schema stamp:** the desktop stamp's `forkTreeHash` follows `HEAD:engine`, so this engine patch required `pnpm generate:protocol`. Only the hash changed. Every later engine patch must restamp the same way.
- **Results (2026-10-28):** 33 Rust tests pass; clippy and fmt are clean; `cargo build --locked` leaves the tree clean; 153 desktop tests pass; the smoke exits 0. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `engine/codex-rs`):**
- `cargo test -p inquello-domain -p inquello-adapters` -- expected: all pass
- `cargo clippy -p inquello-domain -p inquello-adapters --all-targets -- -D warnings` -- expected: no warnings
- `cargo fmt -p inquello-domain -p inquello-adapters -- --check` -- expected: clean
- `cargo build --locked -j 4 -p codex-cli -p codex-app-server -p inquello-adapters`, then `git status --porcelain` -- expected: success, no changes
- In `desktop/`: `pnpm test` -- expected: unchanged suites pass
