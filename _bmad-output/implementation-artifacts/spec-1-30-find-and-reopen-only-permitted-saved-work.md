---
title: 'Find and reopen only permitted saved work'
type: 'feature'
created: '2026-10-31'
status: 'in-progress'
baseline_commit: 'NO_VCS'
route: 'dispatch'
review_loop_iteration: 1
remote_baseline_commit: 'c30b52af263fcf6e6394a4eba259aaba795a1af3'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An auditor cannot efficiently find, prioritise and reopen permitted saved work. Retained work must remain inspectable when inference credentials expire.

**Approach:** Complete S05 with searchable Task/Engagement navigation, durable pin/archive preferences and an Inbox of real requests for input. Reuse the existing authorised Task inspection and explicit continuation paths, with normal compact workbench interactions.

## Boundaries & Constraints

**Always:** Search the selected Workspace's own private Task titles and retained user/assistant conversation text, plus accessible Engagement name, objectives, scope, entity and period. Reuse the native conversation-search baseline; exclude hidden reasoning, tool output, plans and system/developer instructions. Show bounded matched snippets with exact turn/item links; activation must reach the selected saved text, not just the latest Task view. Clearly describe unavailable or unsearched content. Include archived Tasks through an explicit filter. Recheck current identity, Workspace/context access and applicable evidence before results, snippets, counts and reopen disclosure; cached matches grant nothing. Show unavailable scope rather than claiming it was searched. Pin/archive affect personal navigation only; archive explains that no authoritative record is deleted and does not stop running work. Archived work remains findable and recoverable; opening and unarchiving are distinct. Inbox includes genuine current input requests, including archived Tasks, and opens the identified Task/question without automatic execution. Inspection requires Inquello authority, not provider sign-in; inference still requires its configured authorised route. Preserve drafts, history, lineage and prior acceptance gates. Use existing design primitives, named count badges, keyboard/focus behavior and truthful outcomes.

**Never:** No file/artifact search before their later epics, cross-company or peer-private retrieval, automatic Resume/provider fallback, fake review/Delivery items, permission expansion, authoritative deletion, paid calls or credentials in tests. Review/Delivery category semantics use read-model tests only. No eligibility promotion from authored/unrun fixtures. Search and reopening must be useful product behavior, not warning labels replacing the workflow.

## I/O & Edge-Case Matrix

| Scenario | Input / state | Expected behavior | Failure handling |
|---|---|---|---|
| Find | Search visible control or Ctrl/Cmd+K; procurement term | Bounded matching Tasks/Engagements, context and explicit archive filter | Distinct no Workspaces/no matches/unavailable; retain term; Escape closes and returns focus |
| Organise | Pin/unpin, archive/unarchive a saved Task | Durable personal navigation; saved work and running execution unchanged | Confirm only after success; retain operation identity through retry/conflict |
| Reopen | Selected current or archived result | Freshly authorised saved progress/metadata; no implicit Resume | Revoked/missing context reveals no cached snippet/history; preserve unrelated drafts |
| Attention | Actual pending question, then answer/termination | Named count and Inbox item; selection reaches the current question | Stale items disappear; unavailable observation is not zero attention; no focus stealing |
| Provider loss | No provider sign-in or expired selected credentials | Inspection/organisation work; continuation offers applicable reconnect | Keep Inquello identity/work; no silent route change |
| Race | Query/session/Workspace changes during response or reopen | Only current authorised results rendered | Clear protected stale content; discard late responses |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/thread-store/src/local/thread_history/search.rs::search_thread_occurrences` and `local/search_threads.rs`, plus `rollout/src/search.rs::conversation_text_from_item`: native content matching/snippets and turn/item references. Per-thread occurrences require paginated history (`thread_history/read.rs::validate_thread_for_paginated_reads`); supported legacy history needs an exact-authorised-thread fallback using the retained rollout matcher. Never reopen generic thread search or silently omit legacy coverage. `thread_processor.rs::thread_search_occurrences_response_inner` illustrates paging/conversion, not Inquello authority.
- `engine/codex-rs/inquello-domain/src/organise/{model,commands,ports}.rs`: creator/Workspace filtering, records, expected revisions and operation receipts; extend navigation preferences without changing ownership.
- `engine/codex-rs/inquello-adapters/src/{organise,sqlite,data_provenance}.rs`: SQLite writes and separate governed inventory; additive migration after 0013 must participate in inspection/export/recovery/deletion.
- `engine/codex-rs/app-server/src/request_processors/{inquello_processor,inquello_tasks}.rs`: reuse `current_workspace_metadata`, `authorize_task_metadata` and retained read fences. Protocol `common.rs`/`v2/inquello.rs` and `message_processor.rs` own named dispatch. No renderer tree or index becomes authority.
- `desktop/src/main/organise/{service,payloads,views}.ts`: `getTree`/fresh `prepare` and bounded projections. `tasks/service.ts::readProgress` does not call `prepareRoutes`; live `questions` are run/turn/runtime-bound. Preserve this distinction from inference preparation.
- `desktop/src/renderer/Shell/{Shell,Sidebar,TaskLifecycle,TaskProgress,task-observation,organise-bridge}.tsx/ts`: existing navigation, question reachability and bounded selected-priority observation. Reuse Menu, TextField, NavRow, Badge and Header; `Providers.tsx`/`ProcessingRoutes.tsx` supply applicable connection destinations.

## Tasks & Acceptance

**Execution:**
- [ ] `engine/codex-rs/inquello-domain/src/organise/`, `engine/codex-rs/inquello-adapters/src/organise.rs`, `engine/codex-rs/inquello-adapters/migrations/0014_task_navigation.sql` — persist owner-bound pin/archive preferences with receipts/revisions and safe legacy defaults; no execution/deletion effects.
- [ ] `engine/codex-rs/inquello-adapters/src/data_provenance.rs`, `engine/codex-rs/inquello-adapters/tests/` — govern added metadata across inspection, populated export/recovery and deletion; preserve principal binding.
- [ ] `engine/codex-rs/app-server/src/request_processors/inquello_processor.rs`, protocol/dispatch files above — implement bounded metadata plus retained-conversation search and fresh exact-hit reopen. Authorise each Task before searching its history and again before disclosure; preserve turn/item identity, stable bounded pagination and deterministic ordering. Reuse the native per-thread search/retained read APIs without a new duplicate content index; never globally search private threads then merely filter the renderer. Validate cached hits and exact-hit context again on activation, including old turns outside the ordinary recent progress window. Cover paginated and supported legacy records without searching another Task; genuinely corrupt/unsupported history reports unavailable coverage, not no matches. Render snippets as inert text, never instructions or HTML.
- [ ] `desktop/src/main/organise/`, `tasks/service.ts`, `security/operations.ts`, `preload/preload.ts` — named validated bridges, current-scope fences, actual attention projection and provider-independent reads; retain explicit inference reconnect.
- [ ] `desktop/src/renderer/Shell/` — add `Search.tsx`/`Inbox.tsx` compositions, accessible visible/keyboard entry, pin/archive menus and filters, real counts and selected-question navigation; preserve drafts and focus.
- [ ] `desktop/test/`, `engine/codex-rs/app-server/tests/inquello_authorization_runtime.rs`, `engine/codex-rs/inquello-domain/register/capabilities.json` — matrix tests, paginated/legacy exact-hit fixtures and actual native search/reopen denial fixtures; record pending evidence, not fabricated execution. Update `FORK-CUT.md`, support notes and cumulative Epic 1 acceptance ledger.

**Acceptance Criteria:**
1. Given a permitted Workspace, when searched by declared fields, then only its accessible Engagements and creator-private Tasks appear, including a phrase found only inside an older retained conversation; opening the hit reaches that exact message with truthful bounded context; empty/error states and focus behavior match the matrix (AC1.30.1).
2. Given saved work, when pinned, archived, reopened or unarchived, then navigation persists across restart without deleting records, changing sharing or restarting execution (AC1.30.2).
3. Given real pending requests, when Inbox opens, then its category count and items agree and selection reaches the question; later-category fixture counts imply no approval or enabled workflow (AC1.30.3).
4. Given a cached match then revoked membership/context, when searching or activating it, then labels, snippets, counts and reopened history disclose nothing forbidden, including late-response races (AC1.30.4/7).
5. Given valid Inquello authority but no provider credentials, when organising/searching/opening, then permitted work is inspectable and S07 truthfully identifies missing inference configuration (AC1.30.5).
6. Given expired/revoked provider credentials, when continuing, then retained work/identity remain and the applicable reconnect is available without silent fallback (AC1.30.6).
7. Given new search/reopen paths, when capability eligibility is evaluated, then exact-build negative evidence is required before real-data enablement; existing unrun gates remain open (AC1.30.7).

## Implementation Notes

### Review loop 1 implementation constraints (non-frozen derivation)

The first candidate was saved as a read-only preservation reference under `/workspace/shared/inquello-story130-review-20261031/round1-source/`, with original diff/manifest next to it, then product changes reverted to the pinned baseline. Re-derive the approved story sequentially; this reference is not authority to copy the defects. Do not spawn concurrent writers. No remote mutation, generated-file edits, credentials or paid calls.

KEEP: migration 0014 legacy defaults and durable owner-bound preferences/receipts; governed data inventory; strict named IPC and renderer projections; native-only response sidecar excluded from wire/schema; private exact-thread search, legacy and paginated coverage; genuine-question Inbox; normal design-system UI, provider-independent inspection/reconnect; late-query/session invalidation and retained retry IDs; all already-passing regression coverage. Restore those proven behaviors deliberately, not a different architecture or weaker eligibility gate.

Correct these derived-plan defects within the approved intent:
1. Use bounded request-scoped authoritative Workspace/Engagement inventory observations instead of fetching the entire inventory for every Task, with a coherent generation/snapshot comparison before final disclosure. Authorize before history reads, and ensure the entire set of contributors (including off-page results) remains valid across awaited checks. A per-item loop ending in actor-only check is insufficient. Reuse existing native session/route output fences and storage coordination rather than inventing a renderer grant. A claimed epoch must actually be invalidated or compared on all relevant mutation paths; never introduce a cosmetic counter. Define the last authoritative observation/queue boundary honestly, not omniscient revocation of already delivered bytes. Keep scoped trust in main's service authority, no client-supplied privilege.
2. Bound search, legacy loading and exact activation before costly allocation and across awaited work. Use native bounded streaming/retained-reader primitives where available, including compressed history; do not load unlimited history and then serialize it to measure it. Preserve supported legacy positive functionality, not blanket disablement. Ensure cancellation cleans up outstanding native-to-main requests and useful failure is not an indefinite spinner. Avoid holding a global database writer lock across network latency.
3. For a retained real-data run, load/verify that run's own identified route and configuration revision using retained candidate records; current Task route approval is not a substitute. Preserve provider-independent reads and fail closed only where the exact historical authority is genuinely unavailable. Keep any shared-helper correction narrow and covered; document impact on earlier consumers.
4. Reuse the same native searchable-text normalization for legacy and paginated user/assistant content (including Markdown-visible phrases), without copying a diverging matcher or searching hidden/tool/plan content. Keep exact hit identity and old-turn availability.
5. Fence navigation mutation completion by its originating Task. Route all newer destinations (Task, Engagement, Workspace, New thread) through one latest-selection invalidation. Repeated selection of the same current Inbox question must focus it again without background focus stealing. Query validation should explain the 256 UTF-8-byte limit and control-character invalidity before making a request.
6. Compose the existing primitives inside a genuine modal/focus boundary (native dialog is acceptable if styled with existing tokens), with inert background, Escape dismissal, focus return, IME behavior and no underlying global navigation while modal. Do not add a branded component API or alter the design system.
7. Add maintained native actual-RPC fixtures for final-await contributor/lineage/history revocation (including an off-page contributor), at least 51 results/real next cursor and its scope/snapshot rejection, both history formats' Markdown matches, and retained-route mismatch. Use isolated deterministic test seams only; no production grants. Add desktop next-page, modal, late Task mutation, New thread/Engagement race and repeated-question focus regressions. Make selection nonzero. Authored native fixtures remain unrun until Cargo/build exists; they cannot promote evidence.
8. Measure callback count under a populated fictional Workspace with a deterministic service stub, proving inventory network work is bounded per request rather than linear per Task. Treat real native latency and Windows/Electron behavior as owner-run gates, not inferred successes.

Verification is unchanged: run all supported typechecks/build/focused tests and full suite, preserve exact environmental failures separately, then freeze for three independent reviews. Keep the story in progress while native/protocol/Windows/auditor acceptance is open. The environment's permitted unrun gates do not excuse known broken positive functionality.

Review-loop 1 execution slices were re-derived with sequential writer handoffs (persistence → native search/protocol → desktop/integration → narrow final source corrections). The frozen intent is unchanged. Navigation uses migration 0014 and existing Task receipts/revisions. Search/reopen wrap native paginated occurrence and exact-thread retained legacy APIs, with request-scoped service inventory, working-store commit observations, coordinated history reads and a native-only nonserialized final-disclosure sidecar. Desktop composes existing primitives for Search/Inbox, exact messages, preferences and applicable provider reconnect. V3 authorization evidence is required before real-data enablement.

See `story-1-30-navigation-support.md` and `validation/story130/` for actual commands, source witnesses, residual risks and pending native/protocol/Windows/owner gates. Status intentionally remains **in-progress**, not accepted. No generated binding was hand-edited, no paid provider call occurred, and no evidence/eligibility was promoted.

## Spec Change Log

- Loop 1: G1/G2/G5/G7/G9 above showed that sequential per-item checks, repeated inventory requests, post-allocation limits, current-route substitution and partial modal/legacy derivation do not satisfy the approved journey. The non-frozen implementation constraints now require coherent request-wide disclosure, bounded native reads/callback work, exact retained-route authority, consistent matching and actual modal ownership, with the KEEP instructions and witnesses listed above. Frozen intent is unchanged.

## Review Triage Log

### Round 1 — 2026-10-31

All three independent layers completed before classification. Likelihood/impact are low, medium, high relative to ordinary supported audit use; confidence is source-established unless explicitly stated. Missing native execution remains a separate validation gate. Every filed finding is recorded before grouping.

| ID | Verdict | Likelihood / impact | Evidence and route |
|---|---|---|---|
| B1 | high | Medium / high | `guard_saved_disclosure` awaits each contributor sequentially, then checks only actor. Earlier metadata/lineage or context can change while a later contributor is checked. Request-wide consistency is not established by these individual checks. bad_spec; group G1. |
| B2 | medium | Low / high | `inquello_legacy_conversation` calls unbounded `read_thread(include_history:true)` before its item/serialized-byte bound. A large retained history is allocated before rejection, newly reachable through each search. bad_spec; G2. |
| B3 | medium | Medium / medium | Exact reopen scans up to 100 occurrence pages, with repeated awaited authority reads and no total deadline. A finite page bound is not a usable cancellation/time bound. bad_spec; G2. |
| B4 | medium | High / medium | `workspace_tree` invokes context checks twice per Task/Engagement and main performs two complete service inventory requests per callback; search adds more nested checks. Ordinary populated navigation has O(N) service round trips. bad_spec; G1. |
| B5 | medium | Medium / medium | `TaskView.navigate` writes notice/retry state after an await without originating Task identity, while task-switch effect resets the same component. A late conflict can install the previous Task's retry on the new Task. patch; G3. |
| B6 | medium | Medium / medium | Engagement activation does not increment `navigationRead`; a previous sidebar response can call `acceptSaved` afterward and override the newer destination. patch; G4. |
| B7 | medium | Medium / medium | Dialog uses aria-modal and edge-only Tab handling but no inert background or platform modal focus ownership; programmatic/global navigation can escape and act on the underlying surface. Use a real focus boundary, not a new branded primitive. bad_spec; G5. |
| B8 | medium | High / medium | `focusedQuestion` never resets when selection clears; reopening the same current Inbox question does not move focus back to it. patch; G6. |
| B9 | medium | Medium / medium | Legacy matcher receives raw assistant Markdown while paginated `searchable_text` normalizes it; visible phrases crossing emphasis are missed only in supported legacy history. bad_spec; G7. |
| B10 | low | Medium / low | Search form accepts >256 UTF-8 bytes and reports the validated rejection as generic service unavailability. Direct bounded-input feedback is warranted. patch; G8. |
| E1 | medium | Medium / medium | Confirmed same asynchronous Task mutation identity defect as B5; a conflict installs a wrong-Task retry. patch; G3. |
| E2 | medium | Medium / medium | `createTask` does not invalidate the pending navigation token; a late reopen can hide the newer New thread composer. patch; G4. |
| E3 | high | Medium / high | Confirmed same cross-contributor awaited final-validation race as B1, including Engagement metadata. bad_spec; G1. |
| E4 | high | Low / high | `authorize_run_route_disclosure` reads `routes::task_route` current configuration without comparing/loading the supplied run's route/configuration revision. Historical candidate records exist in RouteStore, so current approval can substitute for a different retained route. Pre-existing helper, newly relied on for arbitrary search history; correct the narrow shared dependency. bad_spec; G9. |
| V1 | high | Medium / high | Pre-verified regression gap: helper hash tests do not exercise the message processor's final guard. Removing its call is not detected by the existing success/pre-request denial fixtures. Add an actual-RPC final-await barrier/mutation assertion, including off-page contributions. patch verification; G1. |
| V2 | medium | Medium / medium | Pre-verified gap: cursor test only serializes/deserializes; every RPC/renderer fixture uses cursor:null. Add >50 matches, actual next-page activation and query/archive/Workspace/snapshot mismatch assertions. patch verification; G10. |

Groups combine only identical root causes above. Because G1/G2/G5/G7/G9 require coherent non-frozen derivation changes, BMAD bad_spec loopback takes precedence; the direct corrections and regression witnesses are preserved as requirements for re-derivation, not silently deferred. No user intent change or new product choice is needed.

### Round 2 — 2026-10-31

All three independent layers completed before this classification. Each finding is recorded individually; narrow corrections below preserve the approved derivation and public protocol. Likelihood/impact refer to supported audit use, not an assumed hostile operating-system administrator. Native execution remains a gate, not a passing claim.

| ID | Verdict | Likelihood / impact | Evidence and route |
|---|---|---|---|
| R2-B1 | medium | Medium / medium | `workspace_search` retains history fences only for nonempty matches and only places matching Tasks in the final sidecar. A zero-match thread can gain a match during another await without invalidation. Patch: include all successfully searched threads in the existing contributor fence/digest; no new authority surface. |
| R2-B2 | low | Low / low | Working-store `data_version` intentionally rejects any concurrent commit, including unrelated metadata/run writes. Runtime token/history writes are in a separate store, so continuous generation does not itself prove continuous working-store invalidation. Rare unrelated metadata writes can require a retry. Reject complex scoped-version redesign for this low-impact fail-closed residual; document and measure native populated latency locally. |
| R2-B3 | medium | Low / high | Non-Unix creation-time equality is not unique identity if an external actor replaces the database while preserving timestamps. Patch the existing Windows observer to hold a non-delete-sharing file handle for its lifetime and verify handle/path identity where supported; unsupported-platform identity must fail closed. Actual Windows replacement tests remain unrun, not claimed solved by Linux tests. |
| R2-B4 | medium | Low / medium | Bounds inspect `thread_items` only, while the revision streams all `thread_turns`; many empty turns bypass the record bound. Patch the existing aggregate bounds to cover turn records/bytes before streaming. |
| R2-B5 | medium | Low / medium | `reopenView` casts partially checked fields into `taskView`, which stringifies missing nullable IDs and arbitrary references. Negative safe-integer revisions pass. Patch direct validation of each projected field and list bound, with malformed-response cases. |
| R2-B6 | medium | Medium / medium | Inbox serially awaits multiple native reads and policy calls without a total observation bound; the UI busy flag suppresses refresh until completion. Patch a private request deadline/generation cancellation fence and ensure expired observations stop subsequent work and cannot publish. Do not claim a Promise timeout kills a running native operation; its own native deadline still applies. |
| R2-B7 | medium | Medium / medium | Selection checks full question identity, but a later reopen passes only itemId into TaskProgress; a resolved/replaced question can silently disappear or focus a reused item. Patch carry the existing full request/turn/item identity internally, validate against fresh destination progress, and announce disappearance without starting work. |
| R2-B8 | low | Medium / low | Page-two failure clears both results and cursor; retry restarts page one. Patch retain only the pending cursor/query scope for same-page retry, never redisplay stale snippets. |
| R2-B9 | low | Medium / low | Successful count is not announced; removing focused Next button can leave focus on the modal body. Patch result status and deliberate page-result focus after explicit pagination. Browser behavior remains separately unrun. |
| R2-B10 | high | Unknown / high if broken | Native code/generation and actual browser acceptance are unexecuted. This is an explicitly accepted environment validation gate, not evidence of a source defect or a passed journey. Carry the exact commands and in-progress status; no eligibility promotion. No code patch can substitute for missing execution. |
| R2-E1 | high | Low / high | Native searchable SQL depends on `thread_turns.final_agent_item_id` and `thread_items.item_type`; neither is in the new revision digest. Patch add these existing visibility fields to the digest and regression mutations. |
| R2-E2 | high | Low / high | Inbox reopens contributors sequentially, then awaits final policy; Task deletion/access change during that await can leave collected text. Patch use the existing contributor-wide native saved-tree fence after policy awaits, then synchronously filter current request identities before return; no trailing authority await. Test a Task disappearing during final policy. |
| R2-E3 | medium | Low / medium | Bounded readers call blocking `File::open` before regular-file validation. A local FIFO can strand a worker before cancellation checks. Patch a private bounded-reader opener using nonblocking Unix flags plus opened-handle regular-file validation, preserving ordinary/compressed positive reads and not changing unrelated readers. |
| R2-E4 | medium | High / medium | Smoke probe sends Ctrl+K then Cmd+K while Search remains modal; modal propagation suppression prevents the second global recorder event. Patch close between independent shortcuts and assert each opens the dialog. |
| R2-V1 | medium | Medium / medium | Pre-verified gap: no Sidebar consumer witness asserts archive filtering and pinned ordering in both expanded and rail paths. Patch mixed-tree rendering/count tests. |
| R2-V2 | medium | Medium / medium | Pre-verified gap: no actual RPC stalls pre-dispatch admission to detect removal of the outer deadline. Patch an isolated native host stall/late-callback witness; authored source remains unrun. |
| R2-V3 | medium | High / medium | Same actual smoke-probe modal conflict as R2-E4, independently reported. Patch same root cause. |

Only R2-E4/R2-V3 share a root cause. All other corrections are direct additions to already demonstrated state, existing private guards/projections and maintained tests, without a new public API or product decision; route `patch`. R2-B2 is the documented low-impact rejected redesign. R2-B10 remains the existing owner-run validation gate, not a deferred feature or fabricated pass. No frozen intent changes and no new derivation loop are needed.

## Design Notes

**Source baseline:** verified at published `c30b52af263fcf6e6394a4eba259aaba795a1af3`. Codex's TUI resume picker matches metadata, while native `thread/search` and `thread/searchOccurrences` additionally support retained conversation matching. The latter is the useful baseline here, wrapped in Inquello Task authority; existing generic-search denial stays intact. Source witnesses include `thread_search_returns_content_matches`, `thread_search_matches_json_escaped_content` and `search_matches_selected_rollout_across_path_spellings_and_compression`; inspected, not executed. [Official app documentation](https://learn.chatgpt.com/docs/app/commands#search-past-chats-and-find-in-a-chat) also describes conditional expanded chat-content matching, not universal availability. Navigation-only archive intentionally does not copy native thread archive/delete side effects.

One cohesive return-to-work journey: find “Procurement January–June”, pin it, archive it, find it under archived work, inspect its revised duplicate findings without provider sign-in, and reach a genuine vendor-evidence question from Inbox. Revoke access between result display and activation: no saved snippet/history may leak. Find the Task by an invoice identifier present only in an older saved message, not its title; open the exact matched message. Conversation search excludes reasoning/tool/plan records; file search remains deferred. The current Workspace bounds search; switching Workspace is deliberate and does not silently interrupt/rebind work merely to search elsewhere.

## Verification

- Desktop: `pnpm exec tsc -p tsconfig.build.json --noEmit`; `pnpm exec tsc -p tsconfig.renderer.json --noEmit`; `pnpm run build`; focused search/navigation/Inbox/organise/security tests; `pnpm test`. Report actual counts and failures.
- Native: `cargo fmt --all -- --check`; `cargo test -p inquello-domain`; `cargo test -p inquello-adapters`; `cargo test -p codex-app-server --test inquello_authorization_runtime`; `cargo build -p codex-cli -p codex-app-server`. Add nonzero selection checks for new native witnesses; fixture output is not actual provider usefulness.
- Complete checkout: `cd desktop && pnpm run generate:protocol && pnpm run build && pnpm test`; never hand-edit generated bindings. Record unavailable Cargo/protocol checks honestly.
- Windows/Electron: run the realistic journey above, keyboard/IME/Escape/focus, zoom/rail mode, restart persistence, provider removal, pending question reachability, query/revocation races and zero credential prompts during inspection. Test positive and negative paths using realistic fictional audit work; obtain separate approval for live provider calls. Three independent review layers and likelihood/impact triage remain required. Final Epic 1 owner walkthrough covers outcomes across all stories, not just this navigation increment.

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

## Scoped Windows validation continuation — 2026-11-01

The owner requested fixing only Story 1.30 validation blockers and committing and
pushing the existing epic branch. Native compilation, formatting, supported
protocol regeneration and desktop build/typechecks now pass. All fourteen native
navigation witnesses have passing execution evidence (ten from the initial run,
four corrected cases rerun successfully). The focused desktop/schema selection
passed 417 tests; after fixing Pin/Archive waiting for unrelated sandbox
inspection, all 74 tests in the affected shell suites passed. The scoped actual
Windows Electron navigation/layout run exited 0 with both required reports.

See [measured results and remaining gates](validation/story130-windows-scoped-20261101.md)
for exact commands, logs, hashes and the distinction between automated evidence
and manual acceptance. These results supersede the corresponding unavailable
checks in the candidate recovery record above. No full current-tree epic suite,
release certification, fresh guest certification, live provider usefulness or
cumulative owner acceptance is claimed. Story remains in progress for those
acceptance gates; Epic 1 is not accepted and no eligibility is promoted.
