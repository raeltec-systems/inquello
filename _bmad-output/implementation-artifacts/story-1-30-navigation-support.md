# Story 1.30 — saved-work navigation support

Status: **in-progress, reviewed candidate after Round 2 corrections**. No real-data eligibility or prior acceptance gate is promoted. The first candidate's verification is historical, not evidence for this replacement.

## Implemented journey

Owner-bound personal pin/archive preferences use migration 0014, Task revisions and durable operation receipts; legacy defaults remain visible/unpinned. Governed inspection, populated export/recovery and deletion fixtures cover the metadata. Opening is distinct from unarchiving, execution and authoritative deletion.

Search covers selected-Workspace accessible Engagement fields and creator-private Task titles/user-assistant conversations, including exact old turn/item activation. Files, artifacts, reasoning, tools, plans and system/developer instructions are excluded. Unsupported history is unavailable scope, not no matches. Exact untruncated inspection preserves original retained message text; Markdown normalization is used for matching only. Long messages receive explicitly truncated match-centered context. Native paginated and supported legacy formats share the searchable-text/matcher implementation.

Named validated IPC, bounded projections and inert text rendering remain. Genuine Inbox questions include archived Tasks; current question identity is rechecked without automatic execution. Provider-independent inspection/organization never prepares an inference route; explicit continuation retains applicable reconnect and never changes route silently.

## Loop 1 corrections and honest boundaries

- Native-to-main inventory callback takes `{workspaceId, expectedSnapshot}` and returns `{available, snapshot, serviceEngagementIds}`. Start/final observations compare scoped current service authority. It is not a renderer grant. No per-Task inventory network loop remains.
- A dedicated never-writing SQLite connection observes working-store `data_version` across all awaited contributors, including off-page matches. Final local writer coordination checks every contributor and file identity. Separate runtime per-thread lifecycle/writer leases protect history; one database's version is not claimed to protect another. Leases survive checked queue emission; existing session/route cancellation fences remain attached. Network calls occur before local writer leases. This is a last authoritative observation/queue boundary, not recall of already delivered bytes.
- A 30-second wrapper covers the complete saved admission, reads, final checks and queue path, with a separate two-second queue-wait cap. Dropped native-to-main requests are cleaned up. Legacy/compressed reads bound decoded bytes before parsing (16 MiB total, 1 MiB/record, 100,000 records); indexed limits are checked under writer coordination before actual fetch. Unsupported inherited `history_base` context is unavailable rather than another Task's history being searched.
- Exact retained runs load their own identified route/configuration revision. The narrow shared helper also protects earlier progress/lifecycle consumers. Missing historical authority fails closed; current Task route approval cannot substitute. No credential requirement was added to inspection.
- Search/Inbox compose existing primitives inside native `dialog.showModal()`, with IME-aware Escape/cancel, focus return and underlying shortcut suppression. Task mutation completions are fenced to their originating visit. Workspace, Task, Engagement and New thread share latest-selection invalidation. Repeated explicit Inbox selection focuses the same question again; background refresh does not. Invalid query controls explain the 256 UTF-8-byte/control-character constraints before dispatch.

Full implementation/compatibility notes: [native-loop1-notes.md](validation/story130/native-loop1-notes.md) and [desktop-loop1-notes.md](validation/story130/desktop-loop1-notes.md).

## Actual verification

All logs below are in `validation/story130/`, relative to this document.

| Check | Actual result |
| --- | --- |
| Both TypeScript no-emit checks | Passed (`loop1-tsc-main.log`, `loop1-tsc-renderer.log`) |
| Desktop build | Passed (`loop1-build.log`) |
| Selected desktop tests | 8 files / 285 tests passed (`loop1-focused.log`) |
| Prior progress/lifecycle/security/organise regressions | 6 files / 280 passed, plus 2 lifecycle contract files / 33 passed (`loop1-prior-regressions.log`, `loop1-lifecycle-contracts.log`); overlapping suites are not added into a unique total |
| Full `pnpm test` | 1,501 passed, 2 failed, 5 skipped; 62 files passed, 10 failed, 1 skipped. Nine missing-app-server initialization failures; two executed NO_VCS/48-of-816 generated-inventory failures (`loop1-full.log`) |
| Protocol generation | Blocked at `git rev-parse HEAD:engine`: no Git checkout (`loop1-protocol.log`); no generated edits |
| Native fmt/domain/adapters/authorization runtime/build | All five attempted; exit 127, `cargo: command not found` (`native-loop1-command-attempts.log`) |
| Native witness runner | `spawnSync cargo ENOENT`; ten maintained selectors checked, not executed (`loop1-native-selection.log`) |
| SQLite migration property smoke | Python SQLite 3.53.1 applied all 14 migrations with populated legacy defaults/receipts, new receipt acceptance, Boolean constraints and integrity. This is not compiled Rust recovery acceptance. |

The deterministic service stub compares 1 versus 51 fictional Tasks: tree/search each use four inventory plus four policy service calls and six native callbacks; reopen uses four inventory plus three policy calls and five callbacks. These constant callback counts are **not native latency measurements**. Real-data Task-bound route proof checks are separate and are not cached across Tasks to manufacture a constant count.

Native actual-RPC source now covers 51 results/real page two and activation; query/archive/Workspace/snapshot cursor rejection; final-await off-page Task, lineage and history changes; both-format Markdown hits; exact retained-route mismatch. Ten selectors are maintained. Native fixtures and reader/storage/matcher unit tests remain **unrun**; the v3 negative-evidence contract is not satisfied by authored source.

After desktop verification, the final sequential source pass corrected an undefined metadata matcher identifier, moved destructive fixture setup after the forged-hit assertion, made unavailable non-Unix file identity fail closed, wrapped complete saved admission in the deadline, and separated original retained display text from normalized matching. An exact-Markdown-preservation unit witness was added. No desktop source changed after the passing commands; native changes remain uncompiled. See `loop1-final-source-pass.md`.

## Browser attempt and open acceptance

Exact command `node /tmp/inquello-story130-browser.cjs` executed against a local fictional Vite harness, but Chromium failed **before any page validation** with `socket() failed: Operation not permitted (1)` and crashpad errors. One local-only escalated attempt of the same command failed before execution because the container filesystem setup was read-only (exit 1). No retry, alternate route or screenshot occurred. The Vite server was stopped.

The test-only jsdom dialog shim verifies invocation/state/focus expectations, **not browser modal inertness**. Windows/Electron keyboard/IME/Escape/focus, responsive/zoom/rail behavior, persistence restart, provider removal, genuine question reachability and revocation races remain owner-run gates. Native compile/fmt/full actual-RPC execution, matching protocol, real native latency, three independent post-freeze reviews and cumulative Epic 1 auditor walkthrough remain open. No paid call, credentials, fabricated delivery/review item or eligibility promotion occurred.

## Final candidate verification (recovery completion, 2026-10-31)

This section supersedes the loop-1 verification above. The source was copied from `/workspace/shared/inquello-story130-20261031` into a writable isolated worktree; originals were not edited. Both Round 2 narrow patches were already applied (reverse-check exit 0). Only the final Inbox type reference and explicit undefined narrowing were corrected thereafter; no new public surface, frozen intent change, or derivation loop.

Both TypeScript checks and desktop build pass. The selected 12 suites pass **411 tests** (exact selection in `validation/story130-final/focused.command`; this differs from the earlier 407-test selection). Full suite terminal results:

```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
Test Files  10 failed | 62 passed | 1 skipped (73)
Tests  2 failed | 1529 passed | 5 skipped (1536)
```

The full-suite failures remain the two Git/generated-inventory assertions and nine missing native-runtime initialization failures. No full-suite pass is claimed. Protocol generation is blocked by the absent Git checkout. Five native fmt/test/build commands exit 127 because Cargo is absent; native selector runner exits 1 (`spawnSync cargo ENOENT`). Fourteen native selectors are maintained, all unexecuted. Exact commands, exit codes, terminal logs and correction diff are in `validation/story130-final/`.

The initial dependency copy accidentally flattened pnpm symlinks, causing unrelated module/type resolution failures; those attempts are retained in `validation/story130-final-initial-environment/`, not counted as product verification. Dependencies were then copied preserving their existing link structure, with no install/download, and all final checks rerun.

Round 2 triage and narrow patches address all routed corrections. R2-B2 remains the documented low-impact fail-closed unrelated-write retry residual; native latency requires measurement. R2-B10 remains an owner-run validation gate. The three independent layers completed for both recorded rounds. No additional review loop was needed for this type-only completion. Native compile/fmt/tests, matching generated protocol, actual browser/Windows modal and file-identity behavior, populated native latency, and cumulative Epic 1 auditor acceptance remain open. No eligibility promotion, provider call, credentials, push, merge or deployment occurred. Status remains **in-progress, reviewed candidate**, not accepted.
