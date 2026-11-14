# Inquello continuation handoff — 2026-11-05, updated 20:12 UTC

## Scope and rules
Continue Story 1.26 and the existing Epic 1 branch, not unrelated feature development. User authorized development after planning. Preserve all local planning/research/user changes. No new install/download outside approved specs, no paid inference or real audit data without specific approval, no Electron --no-sandbox, no test/assertion/deadline weakening. No review-layer subagents. Full suite and all 18 seeded-smoke reports before any push. One draft PR only when Epic 1 complete; true merge, never squash/rebase. No commit/push/PR has occurred in this continuation.

Read original handoff, CLAUDE.md, AGENTS.md, FORK-CUT.md, docs/verification.md and current Story 1.26 spec. Branch feat/epic-1-secure-private-desktop, HEAD c407483170e93ad9bea0f2d1c36e9d32693b0c44. Index verified empty at 19:47 UTC; recheck before any write.

## Current operation and remaining failures: updated 20:12 UTC
Complete affected integration run PID 19492 finished exit 1: 11 passed, 3 failed, 0 skipped, 653.29 seconds.
Log: verification-2026-11-05/desktop-full-docker-policy-fixture-complete-files.log.
Standard boundaries hit the unchanged 180-second limit; listed network hit the unchanged 120-second limit. A resolved-program variant returned ok:true rather than command-forbidden; the exact variant was not retained. Existing cleanup removed native temp profiles, so do not invent the specific awaited timeout step.
Desktop worker is preparing only those three diagnostic reproductions with safe per-step timing, program labels and retained sanitized evidence; assertions and deadlines remain unchanged. Check current process/output before any retry or concurrent work. Native resolver worker holds edits/builds/tests pending release.

## Verified Story 1.26 desktop candidate
Original 11 source/test files implement fixed, bounded execution-policy GET concurrency, exact stale-progress read retry, renderer hydration coalescing and observation-only usage reconstruction. Hard authority/identity/runtime fences and mutation serialization remain.
- Current-source focused verification: 282 passed, zero failed/skipped.
- Production desktop and Windows fixture builds passed.
- Two unchanged clean actual Electron synthetic journeys passed: 155.64s / 148.28s, 5 valid calls each, zero invalid, retained context/Stop/Resume/reader-jump/cleanup passed.
- Actual captures inspected and readable. These use a synthetic provider, not real-provider acceptance.
- Manifest/diff: progress-repair-final-candidate-manifest.json / progress-repair-final-candidate.diff.
- Investigation: progress-repair-investigation.md.
Story/tracker remain in-progress. Final comprehensive acceptance remains open.

## Updated guest runtime, verified
Source SHA256 9e8f47c61315ccf013a4fbb0616418de2d5c7de69c731ce1e855eff8ce4deeb3.
Offline locked helper and CLI builds passed. Bounded source-matched activation completed, hashes/ownership/modes/receipts independently verified. No effective permission change, download or shared restart.
23 synthetic checks passed: isolation7, executor3, runtime matrix13.
Evidence: guest-current-runtime.md.
Recoverable old-runtime backup: D:\Inquello\backups\runtime-before-9e8f47c6-20261105-1823.
Reusable owned guest target: /opt/inquello/build/offline-20261105-1752.
Do not overwrite this receipt or claim newer resolver source is qualified by it.

## Windows resolver candidate
Two native files only: app-server/src/request_processors/inquello_processor.rs and inquello_processor_tests.rs.
Windows resolves only existing ordinary drive-rooted .exe paths using existing checked canonicalization. No PATH/PATHEXT search, UNC/device/ADS/relative expansion or guest/Unix change. Original argv/rule semantics remain.
Three new Windows regressions pass, zero ignored; real unchanged Full access witness also passed on standard runtime.
Default Windows app-server SHA256 fbf2fcd3f5d6f185ad801b9bfde7855dfb34524d97539efa853c4ce5d73aef22.
Standard CLI/app-server and desktop builds passed.
Broader native run originally177pass/4fail; a later host adaptation gave178pass/3fail. Three bounded tests have now been restored to their original guest commands. These failures remain open, not skipped or accepted.

Correction to diagnosis: only Full access uses host execution. Existing valid bounded Task folders select WSL automatically. Native test fixtures created host folders but omitted actual guest transfer/bindings. WslExecPlan correctly reports missing transferred files. Proposed repair uses existing WslTasks.transition and ownership-checked wslDataStorage.erase in a Windows-only test fixture, no fabricated binding/proof or production bypass. Missing-folder initial command selects Host and needs a valid native noop solely for that assertion. Do not substitute Windows executables for guest commands. See native worker's current resolver handoff/evidence before editing.

## Authenticated policy fixture correction
Two desktop integration tests originally overlaid policy only in PolicyService routes while IdentitySession used the raw shared-service client. The new fixed reader therefore saw the real default, not the intended fixture policy.
Correction is test-only: bind the named executionPolicy method on the same SharedServiceClient before constructing identity/policy, call actual authenticated HTTP method first, then overlay existing synthetic revision/execution. Production already uses one client. No production permission change.
- Pre-fix deterministic regressions: 2failed,12 name-filtered.
- After correction: 2passed,12 name-filtered; foreign workspace remains denied/not_a_member.
- Unchanged actual Full access witness:1passed,6 name-filtered,23.80s; actual Windows command executed and original reach/result assertions passed.
- Full two-file run remains active above.
Evidence: policy-fixture-binding.diff, policy-fixture-binding-followup.md and desktop-full-docker-policy-fixture-*.log.
Keep filters distinct from source skips and full-suite success.
The failing resolved-program desktop test also creates host symlink aliases despite Windows guest execution. Reproduce and identify the exact failing iteration before repairing fixture placement; never expose host paths to the guest or drop alias/unresolved/link-trick assertions.

## Isolated database and tools
Use only owned Docker PG fixture on D:, not native/shared databases.
Receipt: D:\Inquello\tmp\epic1-pg-20261105-d778fa3f\ownership.json.
Container inquello-epic1-verify-20261105-d778fa3f, loopback127.0.0.1:55318, cached PostgreSQL18.6 image, D-backed volume. Never print credentials.
Runner: verification-2026-11-05/run-docker-verification.cjs.
Targeted runner: run-docker-resolver-witness.cjs (direct installed Vitest via Node, original ownership checks).
Standard integration tests use default engine/codex-rs/target/debug app-server; smoke uses separate fixture cache D:\Inquello\cache\fixture-20261105. Verify exact binary, do not accidentally use a stale default.
Rust/Cargo1.99.1, D:\Toolchains, offline/locked -j4, debug/incremental0. Preserve unrelated user processes.

## Remaining native/protocol gates and sequencing
Exact retained-publication fixture is Linux-only, not a zero-test Windows pass:
cargo test -p codex-app-server --features inference-fixtures --test inquello_messages_runtime real_private_task_retains_publication_question_and_truthful_progress -- --nocapture
Focused expected1test; full target expected12. Requires matching Linux fixture app-server, temporary SQLite/home, loopback synthetic TLS, no PostgreSQL/real provider.
Offline dependency graph now passes after exclusive checksum-verified reuse of existing host console0.15.11 and insta1.46.3 archives; no downloads.
Cache manifest: .tmp/guest-cache-reuse-20261105-191044.json. New source freeze/release still needed before build/tests.
Also retain required protocol/core progress filters, app-server progress/read tests, fmt/check/clippy, full desktop suite/full smoke and conditional writer-contention/real-provider gates.

Supported protocol generator refuses dirty engine because it stamps HEAD:engine. Parent permits a local-only checkpoint of narrowly verified code/test files after focused/native verification, then supported generation/rebuild/comprehensive exact-tree checks before any push. Do not bypass generator guard, discard changes or include planning/research in checkpoint.
Three other engine files can appear dirty from line-ending/index status but have no substantive git diff: inquello_tasks.rs, thread_lifecycle.rs, thread_processor.rs. Verify before treating as code changes; do not blanket revert.
Desktop Commander reported80% monthly usage at20:05UTC. Access still works; minimize redundant reads/polls and preserve this handoff if interrupted.

## Later active continuation: merged-/usr identity
See ../verification-2026-11-05/merged-usr-continuation.md for the later candidate, frozen source identity, active build/test PIDs and unexecuted activation plan. This supersedes older active-process status above. No commit/push/PR. Inspect live state before resuming.
