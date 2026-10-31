# Story 1.30 reviewed candidate: Windows application and verification

Status: **in-progress; not accepted**. This records application of the reviewed
candidate, not Epic 1 acceptance, a merge, or real-data eligibility.

## Provenance and preservation

- Applied to `feat/epic-1-secure-private-desktop` at exact baseline
  `c30b52af263fcf6e6394a4eba259aaba795a1af3` (tree
  `4e39b3611df9ff564ee5b94a7a8988a8b1db4f0c`). Upstream matched this baseline.
- Read the supplied README, story and review triage before applying.
- Archive SHA-256: `44576388b2af46fef8fa232499272ade7c4dd17bc7112d661986996ef931c4c4`.
- `candidate.patch` SHA-256: `5090496c58c08114f6f321e141c82f68b9698b79ec7dd5dc0f3bec4d28984546`.
- Verified every declared baseline Git blob and all 71 candidate SHA-256 hashes;
  `git apply --check` passed before `git apply`. All 71 applied Git blob hashes
  match the manifest after normalizing Windows checkout line endings.
- Local recovery ref: `codex/recovery-before-story130-20261031`. Earlier unfinished
  Windows/WSL changes remain on `codex/recovery-wsl-before-sync-20261031`; none were
  folded into this candidate. Untracked `AGENTS.md`, `fork/` and `node_modules/`
  were preserved and excluded from the commit. Existing WSL installation and
  host configuration were not changed.
- Review-history patches were not reapplied. The reviewed source was not repaired
  or reformatted to hide validation failures. `shell.css` was restored to the
  exact LF bytes in the bundle after a Windows newline assertion failed; its Git
  content remained identical to the manifest.
- The only additional build change is Cargo's offline lockfile reconciliation:
  missing dependency edges to already pinned packages/workspace crates, without
  package-version/checksum changes, new package entries, or downloads. Initial
  `--locked` checks had refused the inconsistent lockfile.

## Environment and commands

Windows, Rust `1.99.1-x86_64-pc-windows-msvc`, existing pnpm dependencies.
`TEMP`, `TMP`, `TMPDIR` point to `D:/Projects/inquello/.tmp`;
`CARGO_HOME=D:/Toolchains/cargo`, `RUSTUP_HOME=D:/Toolchains/rustup`;
`CARGO_INCREMENTAL=0`, `CARGO_BUILD_JOBS=4`, `CARGO_NET_OFFLINE=true`.
Rust commands use `--locked -j 4` after the offline reconciliation.
No installation, download, paid inference or live provider call was performed.

Raw logs and the extracted supplied bundle are retained locally under
`D:/Projects/inquello/.tmp/story130-checks/` and
`D:/Projects/inquello/.tmp/story130-reviewed-20261031/`.
These paths are local evidence, not files shipped in this commit.

Desktop commands: `pnpm exec tsc -p tsconfig.build.json --noEmit`,
`pnpm exec tsc -p tsconfig.renderer.json --noEmit`, `pnpm run build`,
`pnpm test`, `pnpm run generate:protocol`, and
`node scripts/run-navigation-native.cjs`.

Focused command: `pnpm exec vitest run --configLoader runner
test/saved-work.test.ts test/saved-work-shell.test.tsx
test/saved-work-native-selection.test.ts test/shell-layout.test.tsx
test/tasks-progress-shell.test.tsx test/tasks-progress.test.ts
test/tasks-lifecycle.test.ts test/tasks-lifecycle-progress.test.ts
test/tasks-lifecycle-shell.test.tsx test/organise-units.test.ts
test/security.test.ts test/tasks-route-authority.test.ts`.

The current candidate runtime could not be built. Desktop tests explicitly set
`INQUELLO_APP_SERVER` to the nonexistent
`D:/Projects/inquello/.tmp/story130-checks/unbuilt-candidate/codex-app-server.exe`
so native suites report an unmet prerequisite instead of testing an older
installed binary. This is not a native verification pass. The final full run
adds existing `C:/Program Files/Git/usr/bin` to PATH for OpenSSL fixture support.

## Results

- Both TypeScript checks: pass (`tsc-main.log`, `tsc-renderer.log`).
- Desktop build: pass (`build.log`); 20 data-policy categories validate.
- Focused desktop checks: **12 files / 411 tests pass** (`focused-lf.log`).
  First run: 410 passed, one CRLF/LF CSS assertion failed (`focused.log`).
- Final full desktop run: **1,365 passed, 16 failed, 12 skipped**;
  55 files passed, 17 failed, one skipped (`full-final.log`, exit 1).
  Nine native suites fail collection because the current runtime is unbuilt;
  design/primitives collection also fails. Executed failures are ten
  data-authority fence cases, five Windows POSIX-mode assertions, and the stale
  generated-protocol tree stamp. Initial full attempt before restoring CSS LF
  and exposing existing OpenSSL: 1,355 passed, 17 failed, 21 skipped, with 18
  failed files (`full.log`). Neither run is a full-suite pass.
- `cargo fmt --all -- --check`: fails with formatting differences
  (`native-fmt.log`); no wholesale formatting was applied.
- `cargo build -p codex-cli -p codex-app-server`: blocked at
  `app-server-protocol/src/protocol/common.rs:1531`: the new search, reopen and
  navigation request declarations omit the macro's required `serialization`
  field. Both offline and subsequent locked build attempts fail (exit 101).
- `cargo test -p inquello-domain`: **123 passed, 7 failed** (exit 101).
  The seven `execution_policy::profile_tests` failures reject the fixture's
  Task folder as nonabsolute on Windows (`native-domain-retry.log`).
- `cargo test -p inquello-adapters`: compile failure (exit 101), not a test pass.
  `tests/task_runs.rs:137,305` pass dynamic `&format!(...)` SQL to SQLx 0.9's
  `SqlSafeStr` interface (`native-adapters-retry.log`).
- `cargo test -p codex-app-server --test inquello_authorization_runtime`:
  blocked by the protocol macro error (`native-runtime-retry.log`).
- Navigation driver: exit 1 during its required `inference-fixtures` build,
  at the same macro error (`native-selection.log`). **None of the 14 actual
  navigation witnesses ran.** Passing selector unit tests do not substitute.
- `cargo test -p codex-thread-store saved_revision_visibility_tests`:
  blocked by the protocol macro error (`native-visibility.log`).
- `cargo test -p codex-rollout saved_bounds_tests`: **1 passed**, proving bounded
  plain/compressed reads (`native-bounds.log`).
- `cargo test -p inquello-adapters saved_windows_identity_tests`: initially
  blocked by the unrelated `task_runs` compilation. Isolating the library with
  `--lib saved_windows_identity_tests`: **1 passed**, exercising Windows
  replacement denial and file identity comparison
  (`native-windows-identity.log`, `native-windows-identity-lib.log`).
- `cargo test -p inquello-adapters --test organise_store`: **9 passed, 2 failed**
  (`native-organise-store.log`). Both `actual_draft_creation_is_owned_metadata_not_synthetic_or_inference_authority`
  and `populated_navigation_is_in_owned_snapshot_and_cannot_recover_as_another_principal`
  fail with native ownership/category provenance unavailable or incomplete.
- `cargo test -p codex-app-server dropped_saved_admission_cleanup`: blocked by
  the protocol macro error (`native-admission.log`). The two additional
  fixture selectors `search_zero_to_match_final_await` and
  `search_stalled_admission_timeout` belong to the blocked navigation driver;
  no execution is claimed for them.
- Supported protocol generation was attempted and refused the uncommitted
  engine tree (`protocol.log`). Even after committing, a matching freshly built
  CLI/runtime remains prerequisite. Existing generated bindings/stamp were not
  hand-edited or regenerated with stale binaries.

## Outstanding acceptance

Fix and rerun the native compilation, formatting and failing Windows checks;
generate bindings through the supported generator from the matching committed
engine; run the actual 14 navigation witnesses, complete native suites and full
desktop suite with the new binary. Windows/Electron fictional auditor journey,
modal keyboard/IME/focus and zoom/rail behavior, restart persistence, genuine
Inbox questions, provider-independent inspection, revocation races, populated
native latency and cumulative Epic 1 auditor acceptance remain unverified.
Prior-story gates and exact-build negative-authorization requirements remain
open. Story 1.30 and Epic 1 stay in progress; no acceptance/eligibility promotion.
