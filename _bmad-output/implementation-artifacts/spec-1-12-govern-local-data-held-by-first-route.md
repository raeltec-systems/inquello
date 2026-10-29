---
title: 'Story 1.12: Govern the local data actually held by the first private route'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'b4e9f3b660ce663528a1580ca5be2c75ee0fece7'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-9-register-capability-limits-before-enablement.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-10b-desktop-sign-in-and-https-topology.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The desktop already holds local data without any governing rule. That data is runtime history, state and logs; the app-server stderr log; the identity session file and device ID; and Chromium profile data. Outside the smoke test the runtime even shares the user's default `~/.codex`. Nothing names an owner, a rule, an export or a deletion for any of it (FR-37, NFR-9, NFR-10, OQ-2).

**Approach:** Give Inquello its own runtime home. Add a reviewed, compiled-in local data-policy register that lists every category the desktop can hold. Add main-process inspect, export, reimport and delete operations whose reports name what is included, omitted, removed and retained.

**Owner decisions (2026-10-28):**
- **Ownership:** the signed-in creator owns their private local data on their device; the organisation data-policy owner (OQ-2) sets the rules.
- **Retention:** enabled categories are kept until the owner deletes them, with no automatic expiry. This is the explicit rule, not an invented duration, and organisations may set durations later.
- **Runtime home:** the runtime uses `CODEX_HOME = <userData>/runtime-home`.

## Boundaries & Constraints

**Always:**
- **Register entries:** `desktop/data-policy.json` is validated at build and test time. Each entry records:
  - `id`, `location` (glob under userData, the runtime home or the logs directory), `enabled`, `owner`, `rule_owner` and `retention`;
  - `access` (main process only, or runtime);
  - `export` (`included`, or `excluded` with a reason), `deletion` (what removes it) and `recovery`.
- **Enabled categories:**
  - task history (runtime `sessions/` and `archived_sessions/`);
  - runtime state and indexes (`*.sqlite` in the runtime home, rebuildable or omitted);
  - runtime logs;
  - the desktop stderr log;
  - the identity session (never exported);
  - device ID;
  - Chromium profile;
  - an export journal (see Export).
- **Disabled categories:** source extracts, artifacts, shared caches and unattended work stay listed, disabled and never written.
- **Fail closed:**
  - Unknown retention, owner or export rule on an enabled category is a real-data blocker. `realDataBlockers()` returns it.
  - A Rust test fails if any capability-register entry is `RealDataEligible` while blockers exist.
  - A file in a governed root that matches no category is reported as `unclassified` and blocks.
- **Export:** to a directory the user picks through a save dialog in main.
  - It writes a manifest with the included categories, a SHA-256 for every file, explicit omissions with reasons, and attribution (the principal's display name and issuer label if signed in, plus app and runtime versions).
  - It carries the fixed notice that an export transfers no permissions and is not an accepted audit record.
  - Credentials are never included.
  - Every export is recorded in the export journal, with its path, time and categories.
- **Reimport:** only into an empty runtime home, and only while no Task runs. It verifies the digests and reproduces the included categories. The report lists anything it could not restore.
- **Delete:** by category, while the runtime is stopped (stop, then restart).
  - The report names the removed and retained categories, and lists surviving exported copies from the journal, flagged as outside Inquello's control.
  - Deleting the identity session signs out through the 1.10 flow first.
  - No hold, legal-hold or native-record lifecycle is introduced.
- **Preload operations:** `data.getPolicy()`, `data.export()`, `data.import()` and `data.delete(categories)`. Main shows the folder dialogs, and the renderer never supplies a path. Payloads are validated through the Story 1.3 registry.
- **Display:** a Local data block on the specimen page lists the categories with their rule and owner and offers the actions, using the existing primitives.

**Never:**
- No invented durations.
- No export of credentials or provider secrets.
- No deletion of exported copies.
- No shared-service data (governed service-side later).
- No new dependencies; the export is a plain directory, not an archive.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Inspect | `data.getPolicy()` | Every category with owner, rule and enabled flag; blockers listed | N/A |
| Unknown rule | Enabled category with `retention: unknown` | Appears in `realDataBlockers()`; capability test fails if any entry is real-data eligible | N/A |
| Unclassified file | Unexpected file in the runtime home | Reported `unclassified`; blocks | N/A |
| Export | Runtime has sessions and logs | Directory with manifest, digests, omissions (identity, Chromium) and notice; journal entry added | Write failure: partial export removed, error shown |
| Round trip | Export, delete all, reimport | Included content byte-identical (digests match); omissions listed | Digest mismatch: import refused |
| Import into non-empty | Runtime home has data | Refused | Reason given |
| Delete | Delete task history and logs | Report: removed, retained, and surviving exports with paths | Runtime restarted afterwards |
| Delete identity | Delete the identity session | Signed out (server revoke attempted), file gone | Offline: local removal, report says server revocation was not confirmed |
| Isolation | Desktop run with a personal `~/.codex` present | Untouched; runtime uses `<userData>/runtime-home` | N/A |
| Renderer path | Renderer passes a path to `data.export` | Rejected as an invalid payload | N/A |

</frozen-after-approval>

## Code Map

- `desktop/src/main/main.ts` -- the runtime env and `CODEX_HOME`; the smoke uses a temp home. `desktop/src/main/runtime/env.ts` holds `runtimeChildEnv` with the `codexHome` option.
- `desktop/src/main/identity/` -- the vault (`session.bin`, `device-id` under `<userData>/identity`) and sign-out.
- `desktop/src/main/security/operations.ts` and `preload.ts` -- the operation registry pattern.
- `engine/codex-rs/state/src/sqlite.rs:43-48` -- runtime database file names. `engine/codex-rs/rollout` -- `sessions` and `archived_sessions`.
- `engine/codex-rs/inquello-domain/register/capabilities.json` and `tests/capability_register.rs` -- add the blocker cross-check (read `desktop/data-policy.json` by repo path).

## Tasks & Acceptance

**Execution:**
- [x] `desktop/data-policy.json` and `desktop/src/main/data/` (`policy.ts`, `inventory.ts`, `export.ts`, `import.ts`, `delete.ts`, `journal.ts`) -- the register, the classifier and the operations.
- [x] `desktop/src/main/main.ts` -- the own runtime home; stop and restart around delete and import.
- [x] `desktop/src/preload/preload.ts`, `security/operations.ts` and the `Specimen.tsx` Local data block.
- [x] `desktop/test/data-*.test.ts` -- every matrix row; the round trip against a real runtime home produced by the app-server, after handshake plus a synthetic session file.
- [x] `engine/codex-rs/inquello-domain/tests/capability_register.rs` -- the blocker cross-check.
- [x] `desktop/src/main/smoke-probe.ts` -- a `data` report: policy loaded, no unclassified files, runtime home under userData, and an export plus reimport round trip in temp dirs.
- [x] `sprint-status.yaml` (1-12).

**Acceptance Criteria:**
- Given the smoke, when it runs, then the runtime home is under userData, every held file is classified, and an export and reimport round trip reproduces the included categories with omissions declared. It exits 0.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [x] [Review][Patch] R01: Export follows allowed history symlinks into excluded or outside files [desktop/src/main/data/export.ts:93] — BMAD high; likelihood Low; impact High; change risk Moderate — recommendation: Fix now.
  - Fixed in remediation (2026-10-29): copyWithDigest opens a source only after lstat shows a regular file, with O_NOFOLLOW, and checks the descriptor is that file; export adds the root boundary (real path inside the root's real path, same inode, no second hard link). Links, hard links and special files are listed as omissions and never followed or copied. Tests `export sources (review R01)` in desktop/test/data-operations.test.ts: leaf links to excluded auth.json and to an outside marker, directory aliases (outside folder, identity folder), a hard link, normal files exported byte for byte, a file swapped for a link between check and open; no secret bytes in the destination.
- [x] [Review][Patch] R07: Short writes can silently truncate exports and restored files [desktop/src/main/data/export.ts:104] — BMAD high; likelihood Low; impact High; change risk Low — recommendation: Fix now.
  - Fixed in remediation (2026-10-29): the shared copy helper writes each chunk completely (loops on bytesWritten; a write without progress fails with EIO) before hashing/counting it, for export and import; an incomplete copy removes its target. Tests `short writes (review R07)` in desktop/test/data-operations.test.ts inject half writes and zero-progress writes for both export and import: complete output, or an explicit failure and no truncated restore.
- [x] [Review][Patch] R15: Containment check mistakes a ..backup child for an outside path [desktop/src/main/data/export.ts:165] — BMAD low; likelihood Low; impact Low; change risk Low — recommendation: Optional small cleanup.
  - Fixed in remediation (2026-10-29): isInside treats only `..` or `..`+separator as a parent segment (absolute relative paths stay outside), and export's destination check uses it. Tests `containment (review R15)` in desktop/test/data-operations.test.ts: root itself, ordinary child, `..backup` child, true sibling, another drive on Windows.

Cross-story consequences: R02/R04 in Story 1.10b affect truthful identity deletion/cancellation; R03 in Story 1.13 affects memory-only provider-key deletion. These are counted at their origin story.

#### Rejected

- #21 Restart failure discards data result detail — `low`; likelihood Low, impact Low. Detailed result is lost, but the existing explicit message says the local data action ran and asks to restart Inquello (service.ts:123). It does not say nothing changed. Rare restart failure plus extra public result/recovery branching is not worth changing now.
- #37 Runtime JSON differs from compiled-in policy wording — `low`; likelihood Low, impact Low. Mismatch is real, but strict validation/freeze remains and an actor modifying this unpackaged app can also modify its JS. No separate security boundary demonstrated. Reject a fix consisting of changing frozen intent; revisit embedding with already-deferred packaging.

## Implementation Notes

- **Cloud machine (Linux, root):**
  - **PostgreSQL 18:** start it with `pg_ctlcluster 18 main start`, and export `INQUELLO_TEST_DATABASE_URL=postgres://inquello_test:inquello_test@127.0.0.1:5433/inquello_test` for `pnpm test` so the identity integration tests run.
  - **Smoke:** build as root with `pnpm run build`, run `chmod -R o+rX dist`, then `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Never pass `--no-sandbox`. The identity smoke with keyring is optional for this story: `dbus-run-session` plus an unlocked gnome-keyring and the dev topology, as in the Story 1.10b notes.
  - **Engine:** the change is limited to the `inquello-domain` test, so it alters `HEAD:engine`. After committing, run `pnpm generate:protocol` in `desktop/` and amend; only the stamp should change.
  - **Baseline:** 506 desktop tests pass with the database URL set; the domain tests pass.
- **As built:**
  - **Register:** `desktop/data-policy.json` has 13 categories: the 8 enabled ones, plus 5 disabled (`provider-credentials` as well as the four the spec names, so a provider `auth.json` in the runtime home is classified and blocks instead of passing unnoticed). Locations are `{ root, globs }` with roots `user-data`, `runtime-home` and `logs`; the first matching category in register order wins (runtime logs `logs_*.sqlite*` before runtime state `*.sqlite`). Two fields beyond the spec's list: `label` and `credentials` (a credentials category must be `excluded`, or the register is refused).
  - **Shipping:** `tsconfig.build.json` has `rootDir: src`, so the JSON cannot be imported into the build. `policy.ts` reads it once from the app directory (`<desktop>/data-policy.json`, the same relative path from `src/main/data` and `dist/main/data`), validates it strictly and freezes it; nothing at runtime can change or enable a category. The build runs `scripts/check-data-policy.cjs` against the compiled loader and fails on an invalid register (unknown rules are printed as real-data blockers, not build errors).
  - **Export rules:** included are task history and the desktop stderr log. Runtime logs (a live SQLite database), runtime state (rebuildable), the identity session (credentials), the device ID, the Chromium profile and the export journal are excluded with reasons. The export goes to the new folder named in main's save dialog (it must not exist, or be empty, and must be outside the governed roots).
  - **"Empty runtime home" for reimport** means no file of a category the export restores there (task history) and no unclassified file; the rebuildable state and runtime logs that the runtime writes on every start do not count. Nothing is overwritten: a target that exists (in practice the desktop stderr log, which the restarted runtime has already reopened) is listed as not restored.
  - **Delete:** the Chromium profile is cleared through `session.clearStorageData()` and `clearCache()` rather than unlinked under the running engine; the files it holds open are reported as remaining. Deleting the identity session calls the 1.10 `signOut`; when the service cannot confirm it, the new `IdentitySession.forgetLocally()` drops it from memory and the vault and the report says revocation was not confirmed.
  - **Tasks:** no Task exists before Story 1.25, so main's `activeTasks()` is `0`; the service refuses import and delete when it is not.
  - **Preload:** the four `data.*` operations forward the renderer's arguments to main, so a renderer-supplied path reaches the registry and is rejected as an invalid payload; `data.delete` accepts only a dense list of distinct enabled category ids.
  - **Smoke:** the runtime home is now `<smoke userData>/runtime-home`, cleared at the start of each smoke run with the export journal (it replaces the per-run temp `CODEX_HOME`).
- **Results (2026-10-28):**
  - Desktop: both `tsc` checks are clean and 597 tests pass (506 earlier plus 91 new), including the real app-server round trip and isolation tests.
  - Engine: `cargo test -j 4 -p inquello-domain` passes (14 capability-register tests, 4 new); clippy `-D warnings` and fmt are clean. `FORK-CUT.md` records Patch 6.
  - Smoke as `smoke` under `xvfb-run`: exit 0; `data` is `ok: true` with 13 categories, the runtime home under userData and equal to the handshake's `codexHome`, 0 unclassified files, the renderer path rejected, and an export (task history and stderr log; 11 omissions including the identity session and the Chromium profile) reimported byte-identical into temp roots. The keyring identity smoke was not run (optional for this story).
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `desktop/` (with `INQUELLO_TEST_DATABASE_URL` exported): both `tsc` checks and `pnpm test` -- expected: all pass
- In `engine/codex-rs`: `cargo test -j 4 -p inquello-domain` -- expected: pass
- Smoke as `smoke` under `xvfb-run` -- expected: exit 0, with `data.ok: true`
