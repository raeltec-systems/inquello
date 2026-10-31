# Story 1.25 implementation and acceptance ledger

Status: **in progress**, not accepted for real-data use. No paid/provider calls were
made. The approved spec remains the sole source of product intent.

## Authored implementation

- Non-persisted focused Start; exact text and explicit route revision/defaults.
- Named main/native commands, creator-private atomic Task/run/request journal,
  reserved real retained thread, idle-only first turn, durable association.
- Same-operation reconciliation after uncertainty; no silent retry/route fallback.
- Main identity/Workspace policy, native debug-session classification binding,
  credential/configuration checks and applicable quota; no remote-capability veto.
- Per-sample trusted turn authorization, final tool authorization and native usage.
- Retained thread ownership and stale-session disclosure suppression.
- Bound Task background compaction, memory summaries and warmup unavailable.
- Existing bounded rules/sandbox/PermissionMediator; unknown tool forms unavailable.
- Explicit local-only environment, Task-root workspace and isolated extension scope.
- Authored actual retained-child loopback TLS test:
  `real_private_task_retained_thread_denial_and_lost_ack_reconcile_without_second_turn`
  in `app-server/tests/inquello_messages_runtime.rs`; not executed here.
- Existing workspace serde metadata repaired in adapters; no new library/version.

The only internally authorized input environment is the owner-configured fictional
profile. Main (unpackaged only) reads `INQUELLO_FICTIONAL_AUDIT_SESSION` JSON:
`{"principalId":"<uuid>","workspaceId":"<uuid>","isolatedRoot":"<isolated desktop userData>"}`.
The profile must contain a regular non-symlink `.inquello-fictional-audit-session`
marker. The matching native binary requires the default-off debug
`inference-fixtures` build. Do not point this at a real user profile. This controls
authority behind the scenes, not through text/classification checkboxes.

## Automated verification

Final TypeScript and build passed. Focused matrix: 257/257; closing Task/data-policy matrix: 48/48 (overlapping). Full suite: 1,133 passed, 3 failed, 5 skipped; 45 files passed, 12 failed, 1 skipped. Missing native/design inputs and non-Git/incomplete protocol baseline block the failures. Exact commands/counts are recorded in the implementation spec. Logs are under
`desktop/validation/story125-*.log`. SQLite migration/immutability verification is
not Rust transaction, concurrent coordinator, permission, or actual inference
acceptance. Source-authored native tests are not claimed as executed.

## Required owner-run gates (pending, not failed or passed)

1. Complete pinned checkout and approved Rust toolchain: cargo fmt/check/test/clippy;
   compile core/app-server with and without debug fixtures. Regenerate protocol
   using the matching built native generator and committed engine tree; do not
   hand-edit generated files or bless a mismatched stamp.
2. Real retained-child isolated fixture: exact canonical request/task/run/turn
   association, no prewarm/provider fallback, duplicate conflict, crash/lost-ack
   reconciliation, credential/route/policy/logout races, quota denial and actual
   model-originated permission denial with no tool effect. Verify content absent
   from logs/usage/receipts and retained only in governed private history.
3. Seeded sandbox-enabled Electron: normal Start-to-Active, IME/Shift+Enter/Escape,
   navigation drafts, configuration reconfirmation, private scope invalidation,
   local execution separately from inference and truthful initial/uncertain state.
4. **Separate explicit provider authorization required:** actual inference over the
   fictional procurement fixture. Expected R01/R03 duplicate; R02 missing approval;
   R04/R05 aggregate 18,000 above 15,000 threshold. Assess evidence-linked outputs
   and appropriate uncertainty, never unsupported fraud claims. Fixture success
   cannot replace this acceptance.
5. End-of-Epic-1 auditor session on the owner's machine carries this ledger through
   1.26–1.30, adding inventory/vendor-management cases, permissions, failure,
   steer/stop/recovery and permitted reopen/search. Unrun remains pending.

Real-data enablement and organisational approval are separate gates. Files,
Methods, artifacts, sharing and new steer/resume UI remain out of scope.

## Round 2 continuity ledger

Retained terminal events now own durable run completion; provider receivers own usage only. Pre-dispatch accounting failures close their persisted attempt; disclosure refreshes authority after private reads; reconciled acceptance registers the same trusted binding; invalid text remains editable and explicit pre-effect refusals release stale pending choices safely.

Executed: TypeScript and build passed; focused 10 files / 295 tests passed. Full suite: 46 files passed, 12 failed, 1 skipped; 1,143 tests passed, 3 failed, 5 skipped. Same snapshot/native/design/stamp blockers remain. Added real PolicyService + PermissionMediator tests covering allowed consumption and denial/expiry/policy-race/consumption-rejection/logout. Logs: `desktop/validation/story125-round2-*.log`.

Authored, not executed: core retained lifecycle observer tests; adapter immutable terminal tests; coordinator undispatched model/tool accounting and provider-completion separation tests; actual retained-child allowed one-use permission fixture with duplicate-consumption rejection and bounded file effect. Required owner-run gate 2 now includes both denied and allowed model-originated actions. All native/protocol/Electron/provider and auditor product-validation gates above remain pending; story remains in-progress.

## Round 3 correction ledger (2026-10-30)

- Added transaction commit-boundary authority fencing with proven-pre-effect versus ambiguous errors; durable sanitized non-dispatch setup failure; explicit retained-terminal resolution of uncertainty; cancellation accounting closure; exact shell-field/Task-root enforcement; originating Workspace navigation restoration.
- Added executed Start setup-failure/reconciliation tests and mounted Workspace navigation race. Added native blocked-writer/rollback/setup-receipt/terminal-observation tests and actual retained-child pre-sampling failure/inter-attempt interrupt scenarios; native sources are authored, not executed.
- TypeScript and build passed. Full suite: 46 files passed / 12 failed / 1 skipped; 1,145 passed / 3 failed / 5 skipped tests. Same missing native/design and protocol baseline inputs. Final extra navigation test separately passed (10 tests in its file); final focused matrix passed **10 files / 298 tests** (`desktop/validation/story125-round3-focused.log`).
- SQLite 3.53.1 migrations 1–9 applied. Matching native protocol generation remains blocked by the non-Git snapshot. Rust, actual native fixtures, seeded Electron and separately authorized provider-connected auditor validation remain pending. No paid or provider calls made; no gate promoted.

## Round 4 correction ledger (2026-10-30)

- Preserved round-3 product work without restoring old specs or workflow records.
  Linked Task authority revocation to the actual handler cancellation token while
  inheriting ordinary invocation cancellation, and await handler cleanup; there
  is no detached watcher. Every orchestrator attempt now refreshes trusted
  authority/required limits after approval/network waits before `tool.run`.
- Cancellation closes and drains the usage receiver, retaining queued cumulative
  usage and authoritative terminal evidence. Start clears only the unchanged
  submitted draft, comparing against the live memory store so newer no-Task
  navigation edits survive delayed acknowledgement and reconciliation.
- Authored native registry real-child cleanup, post-approval initial/retry refusal,
  actual retained-shell interruption before a delayed second write, queued
  usage/completion races, and bound Responses WebSocket 426 refusal with zero
  HTTP POSTs. All are **unexecuted**: cargo/rustc/rustfmt are absent. The
  post-approval unit regression models a delayed approval completion and tests
  the production `run_attempt` boundary; it is not a full native approval UI run.
- Final TypeScript and build passed; the same five missing font warnings remain.
  Final focused matrix passed **10 files / 299 tests**, including the mounted
  newer-shared-draft regression. Logs: `desktop/validation/story125-round4-*-final.log`.
- SQLite 3.53.1 applied migrations 1–9; this is not Rust transaction/concurrency
  evidence. Matching protocol generation was attempted and refused the non-Git
  snapshot; generated source remains byte-for-byte baseline. Native compilation,
  actual child fixtures, seeded Electron and separately authorized real-provider
  fictional auditor validation remain pending. No provider/paid calls, dependency
  additions, broader tool grants or eligibility/real-data promotion occurred.
- Final full suite: **46 files passed / 12 failed / 1 skipped; 1,147 tests
  passed / 3 failed / 5 skipped** (59 files / 1,155 tests, 85.82s).
  Ten collection failures still require missing native/design inputs; the three
  assertions still concern the missing imported Avatar SVG and two baseline
  protocol/Git stamps. This is not a green full suite. Story remains **in-progress**.

## Round 5 — actual native command path

The missing legacy-shell mapping is replaced by the actual pinned one-shot
`exec_command` handler and string `cmd` schema. Exact final native argv/cwd are
authorized before sandbox launch; private command interception, snapshots,
sidecars, elevation and retries remain unavailable. One permission maps to one
command attempt; final post-wait authority checks and awaited process cleanup
cover private startup-publication cancellation races. Authored retained fixtures
cover exact command effects, denial, hooks, attribution and running-process
identity revocation. They remain **unexecuted** without Rust/native binaries.

Executed round-5 TypeScript/build and focused matrix passed (10 files / 299 tests).
Full suite: 46 passed files, 12 failed, 1 skipped; 1,148 passed tests, 3 failed,
5 skipped. Existing missing native/design inputs and protocol/Git stamps remain.
SQLite migrations 1–9 passed; generated 48-file baseline hashes are unchanged.
Protocol generation refused this non-Git snapshot. Cargo/native, Electron and
separately authorized actual-provider auditor acceptance gates stay open. No
eligibility promotion or completed product validation is claimed.

## Round 5 localized review patches

- Cached accepted request text is now Workspace-scoped and rendered only under
  current authorized membership and matching navigation. Membership loss removes
  that cache and open selection; stale tree responses cannot restore it.
  Background acceptance retains its binding without taking over another view.
- Permission-consumption protocol Debug omits command/policy content while
  retaining the existing wire schema; a sentinel/round-trip regression is authored.
- A per-turn, `cfg(test)`-only native barrier pauses the actual spawned process
  immediately before one-shot handle publication. The authored regression cancels
  at that boundary, observes the startup-owning cancellation branch, releases the
  barrier, and asserts process termination/no resumable child/no delayed effect.
  No production execution path changed in this patch group.

Targeted mounted verification: `pnpm exec vitest run test/organise-shell.test.tsx
 test/shell-layout.test.tsx` — **2 files / 39 tests passed**. Native sentinel and
publication-race tests were attempted individually but `cargo` is absent (127).
No broader verification run was performed in this patch batch; the final verification pass performs it.

Rated residual retained for this candidate: SQLite has a **5-second busy timeout**, while
reservation holds its writer transaction over two authority fences, each of
which can wait up to **15 seconds** for the service (plus quota/native reads).
Likelihood is conditional on a slow/stalled authority service; impact is medium:
unrelated writes can be delayed or refused. Freshness remains enforced; no safety
bypass is claimed. The writer-fence implementation is unchanged in this batch.

## Final supported verification — 2026-10-30 21:13 UTC

Independently rerun on the final product sources: `pnpm exec tsc -p tsconfig.build.json --noEmit` passed; `pnpm run build` passed (five existing missing font warnings); focused command `pnpm exec vitest run test/tasks-*.test.* test/security.test.ts test/permissions-units.test.ts test/policy-units.test.ts test/composer.test.tsx test/shell-layout.test.tsx test/organise-shell.test.tsx` passed **10 files / 300 tests**. `pnpm test` returned exit 1: **46 files passed / 12 failed / 1 skipped; 1,149 tests passed / 3 failed / 5 skipped** (90.70 seconds). Failure output identifies nine missing native app-server suite inputs, missing design icons, missing imported Avatar SVG, non-Git engine-stamp lookup and incomplete generated baseline (48 versus 816). This is not a green full suite. Logs: `desktop/validation/story125-final-*.log`. Native patch regressions returned 127 because Cargo is absent; no native acceptance is asserted. Generated sources remain unchanged; no real credentials/provider calls or eligibility promotion.
