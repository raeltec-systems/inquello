---
title: 'Story 1.24: Choose reasoning and inspect attributable usage'
type: 'feature'
created: '2026-10-30'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
source_commit: '55db99c056f068702b8bcb49c04efcf69c944d30'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Task reasoning/speed choices are not persisted; current execution has no durable, creator-private consumption history. Failed/repeated work and inherited-limit stops are not attributable or explained.

**Approach:** Persist supported per-Task choices and immutable per-attempt snapshots, record actual tool/reviewer consumption at existing dispatch boundaries, and present inherited limits with truthful next actions. Supply a reusable foundation for 1.25, not its Task-start experience.

## Boundaries & Constraints

**Always:**
- Choices come from the selected route's authoritative model capabilities. Persist defaults explicitly; unsupported reasoning/speed alternatives are unavailable with reasons. The initial Messages adapter supports defaults only; do not invent effort mappings. Changing route/configuration invalidates incompatible choices and requires explicit correction, never silently substitutes settings. Effort/speed is not evidence quality or Professional Approval.
- Snapshot requested and effective/default-resolved settings without silently downgrading explicit choices. Snapshot Task, run/attempt, operation kind, route/model/API/configuration revision, chosen/effective settings and timestamps before dispatch. Link resulting output references where they exist; retain failed, cancelled, uncertain and repeated attempts. A settings change affects future work, not history. Automated permission review is labelled separately from human-requested work.
- Consume trusted native usage/events, not renderer claims. Preserve unknown tokens/cost as unknown, distinguish cumulative snapshots from deltas, deduplicate events and receipts, never double-count retries or fabricated tool token costs. Tool history records actual invocations/outcomes and elapsed time; monetary amounts appear only when reported with currency/provenance. No provider billing reconciliation claim.
- OQ-5 applies: use inherited Codex plan/Workspace/provider limits; invent no Inquello budgets, resets or numeric thresholds. Known exhaustion stops the affected dispatch or offers permitted human handling, naming source/reset/next action when known. No provider fallback, automatic reset-credit spend or upgrade. Missing/stale limit information is not “unlimited”; an authoritative required-check failure refuses model dispatch. Absence of a provider quota endpoint is honestly unsupported, not fabricated exhaustion. Local tools are not blocked by unrelated model quotas. For Codex-backed quota reads, require current account binding and explicit ordinary_usage_allowed; null stays unknown, false blocks. Sparse updates or elapsed reset times never prove recovery. Disable reserve fallback and reset-credit detail requests.
- Enforce limits at actual native reviewer/model boundaries and retain partial work/usage on provider refusal. Snapshot identity/route/runtime; recheck after waits. No automatic retry after uncertain dispatch. Concurrent, crash/restart and late-event paths must retain truthful uncertain records, not success or zero usage.
- Creator-private commands, version/operation receipts and atomic persistence; unknown and other-owner IDs disclose nothing. Read-only inspection starts no inference/tools and reveals no credentials/prompt content. New records obey existing Task data governance/export/deletion boundaries. Existing drafts, permission controls, state dimensions and disabled eligibility remain intact.

**Never:** Real credentials/paid calls, new dependencies, speculative prices/budgets, delegated accounting (Epic 10), artifact attribution (Epic 3), 1.25 thread-start UI, silent route changes, or hand-edited generated bindings/stamps. Prior 1.21–1.23 gates remain open independently.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Failure handling |
|---|---|---|---|
| Choice | Supported choice / stale revision | Persist / reject conflict; snapshot future attempts | Preserve draft; explicit refresh |
| Incompatible | Route/model changes | Old selection remains historical, new work refused until corrected | Never fallback |
| Usage | Success, partial failure, repeated attempt | Distinct attributable records; trustworthy totals | Unknown remains unknown |
| Delivery | Duplicate/out-of-order event, restart | Idempotent durable accounting; uncertain unfinished work | No replayed effects |
| Limit | Known exhausted / required source unavailable | No affected model request; source and next action | Preserve work; no credit spend |
| Privacy | Task/principal/runtime changes during wait | Discard stale display, forbid stale dispatch | No private leakage |

</frozen-after-approval>

## Code Map

- `inquello-domain/src/routes/`, `state/`, `organise/` (under `engine/codex-rs/`): reuse creator checks, immutable route revisions and separate state semantics; add `usage/` settings/attempt commands and ports.
- `inquello-adapters/src/` and `migrations/0008_task_usage.sql`: atomic settings/attempt storage, migration and replay; reuse current working database/data governance.
- `app-server/src/request_processors/inquello_reviewer.rs`: existing model dispatch, bound IDs and currently discarded UsageUpdate; `message_processor.rs::inquello_tools_exec`: real local tool dispatch. These are mandatory integration points, not fixture-only recording.
- `app-server/src/request_processors/account_processor.rs`, `app-server-protocol/src/protocol/v2/{account,model}.rs`, `protocol/src/openai_models.rs`: authoritative supported choices and Codex quota reads; `inquello-protocol/src/inference.rs`: normalized usage/errors. Preserve unknown categories.
- `desktop/src/main/routes/`, `organise/`, `security/operations.ts`, `preload/preload.ts`, `renderer/Shell/TaskView.tsx`: reuse scoped service/IPC/parsing and Task panel patterns; add bounded usage/settings surface.

## Tasks & Acceptance

**Execution:**
- [ ] `inquello-domain/src/usage/`, `inquello-adapters/src/usage.rs`, `migrations/0008_task_usage.sql` and crate roots -- private settings, immutable attempt snapshots, idempotent usage and recovery tests.
- [ ] `app-server-protocol/src/protocol/`, `request_processors/inquello_processor.rs`, new `inquello_usage.rs`, `inquello_reviewer.rs`, `message_processor.rs` -- bounded read/set wire, native trusted recording and inherited capability/limit checks; retain original API compatibility and cancellation.
- [ ] `desktop/src/main/usage/`, `security/operations.ts`, `preload/preload.ts`, `main.ts`, `renderer/Shell/TaskUsage.tsx`, `TaskView.tsx`, `shell.css` -- accessible choices/history/limits; explicit stale/unknown states and private invalidation.
- [ ] Native unit/integration tests and `desktop/test/usage-*.test.*`, `security.test.ts`, `smoke-probe.ts` -- matrix, actual dispatch spies, failed/repeated attribution, race/recovery and mounted notification paths using isolated fixtures.
- [ ] Capability/source documentation, `FORK-CUT.md`, spec and tracker -- honest support and owner-run native/generation gates; no completion claim without evidence.

**Acceptance Criteria:**
- Given two attempts with different supported choices, when inspected, then each retains its settings/output linkage and no evidence-quality claim (1.24.1).
- Given an inherited limit is reached, when affected work is requested, then it stops or escalates with an explanation while retained work remains intact (1.24.2).
- Given completed, failed and repeated plain-Task work, when inspected, then actual tool/model consumption is attributable without delegated/artifact claims (1.24.3).

## Design Notes

One cohesive goal: controllable, attributable Task consumption. Additive private-store migration and new bounded settings/read APIs are the footprint; no external mutation occurs during tests. Existing execution, not a new task-loop endpoint, feeds accounting. Source-backed capability and quota definitions were retrieved at the pinned commit and Git-blob verified. Native compilation remains an owner-run gate.

## Implementation Notes

Implemented source: domain/adapter usage ledger and migration 0008; native read/set
wire, authoritative model choices and inherited quota checks; actual reviewer/tool
accounting; private scoped desktop settings/history/limit panel and notifications.
Detailed contracts, recovery behavior, matrix tests and remaining gates are in
[story-1-24-usage-support.md](story-1-24-usage-support.md).

No frozen intent was changed. Native source tests remain uncompiled. The combined
seeded native quota-refusal-to-mounted-panel smoke is authored through the existing
default-off debug fixture mechanism, with zero-provider-dispatch and retained-work
assertions. Its matching native child integration test and seeded Electron execution
remain unrun. Therefore execution boxes and story status are not marked complete.

## Spec Change Log

## Review Triage Log

All three independent review passes completed against the frozen source diff. Each finding was graded before grouping. Likelihood and impact are qualitative: high means ordinary-path/repeated or major incorrect behavior, medium means a reachable race/error or material but recoverable harm, low means unusual/limited harm. Native findings are source-verified, not executed Rust failures.

| ID | Verdict | Likelihood / impact | Evidence and disposition |
|---|---|---|---|
| B1 | medium | Medium / medium | Reviewer registers pending before capability/settings/attempt awaits; early `?` and persistence failures do not remove it. Subsequent same-request reviews and capacity remain blocked. Patch internal cleanup on every unsuccessful exit. |
| B2 | medium | Medium / medium | `collect_verdict` marks Completed before parsing the verdict; malformed output is shown as a completed review although human handling is required. Patch terminal classification and existing malformed test. |
| B3 | low | Low / medium | Save validates choices against a route read before locking without binding that read to the supplied revision. The SQL guard checks the supplied revision, not the capability read. A caller supplying the next revision during a route race can pair old capabilities with a new route. Direct revision guard and regression test; no new public API. |
| B4 | medium | Medium / medium | Ordinary notification can reload a committed revision while retaining the previous operation UUID; the next save changes the receipt command and conflicts. Patch operation lifetime/command binding and regression test. |
| B5 | medium | High / medium | Sandbox-probe completion calls environmentChanged, which always broadcasts privateScope=true; the mounted usage panel clears the unsaved choices. Separate ordinary environment refresh from private invalidation, preserving drafts and focus. |
| B6 | false | — | Settled notifications and explicit Refresh expose durable history; the approved intent does not require live token streaming or push notifications for every intermediate event. An unfinished attempt is labelled pending, not claimed live. No new native notification surface is warranted. |
| B7 | medium | High / medium | Local-tool records carry contextual Task choices but UI labels them effective reasoning/speed. The command runner applies no model settings. Patch local-tool presentation to clearly label context and applied model settings as not applicable. |
| B8 | low | Low / low | Native decimal validation accepts `.5`/`1.` while desktop rejects them. Current conversion emits six decimal digits, so ordinary provider paths do not trigger it; direct native grammar correction and contract cases are worthwhile. |
| B9 | low | Low / low | History decodes up to 100×4096 events before projection, but current adapters emit only a small number of usage snapshots per reviewer and no tool-token events. Reject a new query/API refactor for this unlikely worst case; bounded history remains in place. |
| B10 | false | — | The claim that no authored test exercises actual CommandExec accounting is disproved by native child `usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work` and mounted smoke repeated exit-0/exit-7 commands through PolicyService. These are unrun, not absent. Error-path coverage is added with E2's correction rather than claiming those existing tests executed. |
| E1 | medium | Medium / medium | finish_usage_attempt failure returns before pending cleanup. Same root cause as B1; patch together without dropping this row. |
| E2 | medium | Medium / medium | Tool preparation/recheck errors drop an observer whose completion is spawned asynchronously; the error response can cause refresh before its uncertain terminal record commits. Patch awaited error completion before returning, retaining Drop only as last-resort cancellation protection. |
| E3 | medium | High / medium | Responses conversion copies input/output only despite TokenUsage carrying cached_input_tokens and cache_write_input_tokens. Patch the source-owned conversion and assert retained cache attribution. |
| V1 | medium | Medium / medium | Verification reviewer established that fixture history assertions never observe serialized outgoing reasoning/service tier. Patch tests linking resolved/default and explicit settings to actual Responses body and the immutable snapshot. |
| O1 | medium | Medium / medium | Inherited Responses accepts OS-keyring API-key authentication, but new quota code unconditionally demands ChatGPT account rate limits and stream requires an account ID. This blocks the existing openai-api route where no quota endpoint exists. Patch the internal auth-mode distinction: retain strict account-bound checks for Codex-backed auth; report unsupported quota for inherited API-key auth, preserve auth-mode/generation checks, and never treat unknown auth as permission. No new auth route or secret extraction. |

Patch group B1/E1 shares pending-lifecycle cleanup; all other accepted rows remain distinct corrections. No frozen intent change or new provider/notification/public API is requested. Native verification remains an owner-run gate.


### Correction outcome

All accepted patch rows were corrected without changing frozen intent. Reviewer cleanup covers early errors and preserves successful ready handles; tool setup errors await terminal accounting. Saved settings are tested against the actual serialized Responses body. Ordinary probe/history notifications preserve the mounted control, focus and drafts; receipt IDs are bound to the complete command. Local-tool settings are labelled contextual/not applicable. Positive reported cache counters are retained; ambiguous upstream default zeros remain unknown. Inherited API-key authentication uses an explicitly unsupported quota view, while Codex-backed auth requires account-bound ordinary usage and exact credential-generation rechecks.

The follow-up independent native regression check found no concrete introduced type/logic issue against pinned source declarations. This is source analysis, not a compiler pass. No work was deferred and no frozen intent was changed. Core inference and normalized protocol files were restored byte-for-byte; the cache helper stays reviewer-private.

The presentation step normally marks done, but the owner's explicit validation-gate instruction takes precedence: Story 1.24 and tracker remain **in-progress**. No local VCS commit or publication has been made.

## Verification

Desktop build, both TypeScript checks, focused usage/security/regression tests and full suite; native domain/adapter/app-server/protocol tests, migration/recovery tests, fmt and genuine protocol generation. Seeded isolated smoke must inspect actual rendered choices/history and a fixture-driven limit refusal without paid calls. Record executed versus blocked checks precisely; native/toolchain/complete-checkout limitations already accepted by the owner do not turn unrun checks into passes. Keep in progress while acceptance gates remain unmet.


### Executed verification (2026-10-30)

- Desktop build and build/renderer/full TypeScript checks passed.
- Focused usage/security/route/environment tests: 254 passed across 7 files (final rerun passed); data-policy tests: 27 passed.
- Full desktop suite: 1112 passed, 3 failed, 5 skipped; 42 files passed, 12 failed, 1 skipped.
  Missing native binaries, imported design assets, Git metadata and complete generated
  bindings explain the recorded failures; this is not a passing full suite.
- Python SQLite 3.53.1: all 8 migrations apply; terminal update, snapshot immutability
  rejection and Task cascades passed. Native sqlx tests are separate, unrun gates.
- Cargo/rustfmt unavailable (exit 127). Genuine protocol generation attempted, failed
  at required Git-tree check before writes. All 48 available generated files and stamp
  hash-match the pinned baseline; none were manually edited.
- Seeded Electron/native smoke unrun. Native compiler/tests/fmt and complete-checkout
  generation/acceptance remain owner-run gates. Story remains **in-progress**.
