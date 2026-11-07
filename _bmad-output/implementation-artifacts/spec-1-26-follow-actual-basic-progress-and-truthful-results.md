---
title: 'Story 1.26: Follow actual basic progress and truthful results'
type: 'feature'
created: '2026-10-31'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 2
baseline_commit: 'NO_VCS'
source_commit: '5ead6e8846a2999d2f7842588fede8430d534919'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A started private Task currently shows its accepted request but not live work or useful results. Auditors cannot follow the agent, answer its questions, or distinguish findings from proposed actions and unchecked claims.

**Approach:** Connect actual retained-runtime events to an authorized, accessible conversation using the existing design system. Add a bounded structured plan/result publication contract so labels have explicit provenance; preserve readable unstructured answers without inventing verification. This is one complete live-work experience, not a decorative transcript fixture.

## Boundaries & Constraints

**Always:**
- Show actual messages, command/tool activity and supported edit events with stable identity and textual status. A request is proposed, not executed; completed item status is interpreted by item kind, not assumed successful. Turn completion means execution ended, never review, acceptance or all plan steps finished. Suggested edits are not applied changes or delivered artifacts.
- Use existing PlanSteps, JudgmentTag, DiffLine, ApprovalCard, typography, tokens, icons, spacing and responsive shell. Running is blue; pending neutral. Preserve keyboard/IME, current focus, selection, scroll position and reduced motion; announce meaningful transitions once. Background work never takes over navigation.
- Plan steps gain done styling only with bound completion evidence: a completed action/result can establish that its stated work occurred, not that its conclusion is correct. Stable steps/revisions and evidence references must be explicit. An agent-only completion claim remains visibly unconfirmed; no guessed correlation or turn-wide auto-completion. Missing plan means “No plan provided,” not a fabricated checklist.
- Results support calculation, observation, suggestion, decision and gap text. A versioned, bounded native publication contract separates model-authored classification/content from trusted provenance. Resolve decision basis to an actual scoped human instruction/decision or applicable policy record; a model-written name is not authority. Permission to execute is not analytical review or Professional Approval. Missing/unverified basis is explained without an authoritative decision cue.
- Display “Unchecked,” “Checks incomplete,” or “Checked” with identified scope/evidence only when supported by actual check records. Agent prose claiming verification cannot set check state. Unknown/malformed structure remains readable as an unchecked agent response with structured labels unavailable; never heuristically classify prose or issue a second inference call just to repair metadata.
- Authenticate every progress/input disclosure against principal, current Workspace authority, runtime incarnation, Task/run/thread/turn and session generation. Recheck after waits; unknown refuses. Clear/suppress cached content and pending actions on membership/identity/runtime invalidation, including passive refresh failure. Do not forward raw native notifications or hidden reasoning/opaque provider blocks to renderer, diagnostics or usage.
- Questions are real scoped runtime requests with working answer paths; retain exact IDs/options, secrecy semantics and current authority. Stale/resolved/terminated requests cannot submit. Reuse existing permission mediation and its one-use bounds; questions grant no tool permission. Controls stay contextual without stealing focus.
- Bound queues/text/items and preserve deduplication/order/terminal evidence. Overflow or lost events disclose incomplete history and use authorized bounded hydration where available, never silent completeness or replay. Terminal turn summaries are not the entire transcript.
- Show a compact artifact status alongside work: “No artifact yet” when known absent; unavailable/unknown metadata is distinct; “Artifact failed” requires actual artifact creation/load failure. Do not open a wide empty preview, invent an artifact ID, or relabel a failed command as artifact failure. Existing preview layout remains for real artifacts.
- Use normal UX with realistic fictional audit records. Carry all prior native/protocol/Electron/provider-validation gates and the conditional SQLite writer-contention residual; no eligibility promotion.

**Never:** Files/Methods ingestion, artifact creation/delivery, sharing, new steer/stop/resume/search/reopen UI (later stories), new audit-check engine, automatic Professional Approval, raw reasoning display, generic IPC, new dependencies, real credentials or paid calls, hand-edited generated bindings, merge/deploy.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Failure handling |
|---|---|---|---|
| Live work | Bound messages/actions/plan updates | Actual progress, stable rows, evidenced done only | Unknown status stays unknown |
| Result | Structured or ordinary answer | Five kinds where explicit; scoped basis/check words | Preserve malformed prose unchecked |
| Input | Current question/permission | Working scoped response; focus retained | Resolved/stale request refuses |
| Races | Pre-ack, duplicate, reordered or terminal events | Same bound work, no duplicate result or status regression | Incomplete + authorized hydration |
| Access | Membership/session/runtime changes during wait | Clear/suppress content and controls before disclosure | Unknown fails closed |
| Artifacts | Absent, unknown or actual failure | Three distinct textual states | No fabricated preview |

</frozen-after-approval>

## Code Map

- `desktop/src/main/runtime/rpc.ts`, `main.ts`, `tasks/{service,types,validators}.ts`, new `tasks/progress.ts`: main currently discards progress and drops server-request IDs. Add bounded typed projection and question correlation; reuse epoch/current-authority checks, not renderer thread identity.
- `desktop/src/main/security/operations.ts`, `preload/preload.ts`, `renderer/Shell/{tasks-bridge,TaskView,Shell,PermissionRequests}.tsx|ts`: named snapshot/subscription/answer operations; sanitized current-selection delivery and existing permission cards.
- `renderer/primitives/{PlanStep,JudgmentTag,DiffLine,ApprovalCard}.tsx`, new `Shell/TaskProgress.tsx`: compose semantic rows, not fictional Message/ToolCall primitives. JudgmentTag's basis shape check is not provenance validation. Preserve Story 1.15 independent state dimensions.
- `engine/codex-rs/app-server/src/request_processors/{inquello_tasks,thread_processor}.rs`, `message_processor.rs`, `outgoing_message.rs`, protocol `common.rs` and `v2/{inquello,item,turn,notification}.rs`: derive progress binding from durable TaskRunBinding and fresh disclosure guards. Native forThread omits Workspace/turn; introduce the narrow authorized read/projection seam. Canonical item status, not terminal summary, owns item outcome.
- `core/src/tools/{spec_plan,registry}.rs`, `core/src/inquello_inference.rs`, new `core/src/tools/handlers/inquello_progress.rs` and `inquello-protocol/src/progress.rs`: current private tool allowlist is actual one-shot exec_command only. Add only non-effect planning/result/question surfaces needed here, under current Task authority. Reuse exact native handlers/schema; do not resurrect legacy shell or widen process permissions.
- Native `bespoke_event_handling.rs`, `thread_state.rs`: upstream checklist updates lack stable IDs/evidence linkage; Plan text completion is not checklist completion. Preserve actual event semantics and retained provenance rather than trusting model completion flags.

## Tasks & Acceptance

**Execution:**
- [x] Native Task/protocol/progress publisher files above: versioned bound plan/result metadata, evidence resolution and authorized bounded progress read; retain publisher metadata in governed native history, without a separate lifecycle database.
- [x] Main RPC/tasks/security/preload: event projection, scoped question response, current-authority invalidation and queue limits; preserve native permission handling.
- [x] Renderer TaskProgress/TaskView/Shell: actual transcript, plans, typed results, contextual questions and compact artifact states using existing primitives.
- [ ] `desktop/test/tasks-progress.test.ts`, mounted progress/permission/shell tests; native retained fixture and protocol tests: every matrix row, real event schemas, publication provenance, malformed/forged metadata, stale controls, revocation, overflow and completion truthfulness.
- [x] `desktop/test/data-policy.test.ts`: include the disclosed six-line Story 1.25 deletion-disclosure regression omitted from its approved manifest; no associated product change. Keep its new coverage separate from published 1.25 results.
- [x] Capability/data-policy/FORK-CUT/support/spec/tracker: disclose newly held projected content, minimize memory caching, preserve open gates and update the cumulative auditor validation ledger.

**Acceptance Criteria:**
- Given real retained Task events, when work proceeds, then messages/actions/edits and evidence-linked PlanSteps show actual state and contextual input works without focus theft (AC1.26.1).
- Given structured results or unstructured fallback, when displayed, then judgment kind, decision basis and checked/unchecked/incomplete wording are truthful; execution never changes review/approval/delivery (AC1.26.2).
- Given absent/unknown/failed artifact evidence, when status renders, then the user can distinguish each without an invented preview (AC1.26.3).

## Implementation Notes

### Pass 2 re-derivation requirements (outside frozen intent)

Positive reference `/workspace/shared/inquello-story126-round2-preserve`; product code again restored to baseline. Preserve all pass1 fixes/tests and sequential editing. This is the same approved live-work experience, not new lifecycle controls.

- Current operation discovery: while Start is pending, use only authenticated read-only reconciliation of that exact operation to expose its already retained Task/question, including before Start ack. Never submit a second start/turn or accept a different operation/request. A background Start must not take over navigation; preserve newer drafts and current identity/Workspace/runtime fences. Prevent a late Start result from duplicating acceptance or reviving stale work. Add mounted Shell held-ack/early-question scenario with actual mediation-shaped input, answering exactly once before resolving Start, plus navigation/revocation races.
- Separate actual citation IDs (including failed/cancelled command and retained message evidence) from successful exact-work map used to prove done. Keep references actually present in the bounded projection and never turn citation existence into check/completion proof.
- Retain recent/current plan steps when cumulative IDs exceed64, preserving full canonical revision comparisons for bounded retained input. Any omitted IDs disclose incomplete; cumulative omission is not withdrawal/reset.
- Project command and bounded diagnostic/output tail rather than losing the final outcome behind a long prefix. Avoid unnecessary full sanitized duplicates using bounded display sanitation; do not falsely claim native store itself is bounded beyond its existing contract.
- Enforce a shared final serialized-byte ceiling natively below main768KiB refusal, after strings/refs/basis metadata are included. Truthfully trim or drop older display rows/evidence and set incomplete; never leave authoritative basis/confirmed step without visible referenced evidence. Add max escaping/reference test.
- Align control-character validation in native question fields and editable answer UI with main accepted contract, without widening required-choice schema. Invalid pasted answer remains editable with specific feedback and cannot be consumed.
- Fence pending progress reads across answer completion; scoped consumed questions must not resurrect from delayed snapshots. Bound notification-driven hydration cadence/coalescing while actual pending question/terminal refresh remains responsive. Announce new terminal items and transitions once by stable identity.
- Terminal run status must not leave pulsing running plan steps; unresolved running becomes unconfirmed, never auto-done. Add positive exact human decision basis parser-to-mounted coverage with identity/scope and unchecked unchanged.

KEEP: canonical priority, ANSI sanitation, explicit roles, scoped failure suppression, UTF8 limits, inherited-ID safety, artifact refs, pagination proof, all passed tests, prior native/provider/Electron gates and conditional writer residual. Fix precise demonstrated paths, not broad unrelated refactors.

### Pass 1 re-derivation requirements (outside frozen intent)

First-pass positive source reference: `/workspace/shared/inquello-story126-round1-preserve`. All changed product sources have been restored to baseline for re-derivation. Execute editing sequentially, not concurrent editing agents.

Keep the authorized native/main/renderer architecture, exact runtime correlation, no raw notification disclosure, truthful unchecked labels, cancellation fences, existing primitives and all passing tests. Re-derive the implementation from baseline using the preserved first-pass source as positive reference, not as authority to retain defects.

- Canonical projection state must be assembled before display clipping. Keep full bounded canonical step text for revision comparisons; allocate final bounded display from recent/terminal work and current structured results before older fallback content. Do not duplicate whole ordinary agent messages in both activity and results; represent fallback once, with explicit unchecked/structure-unavailable presentation. Every dropped row/text/result must set incomplete. Keep stable order and IDs; latest structured findings must not starve behind earlier ordinary messages. Maintain conservative evidenced completion and basis, without adding check engine.
- Sanitize ANSI/control sequences in display-only output before main validation, preserving original retained source; flag transformations/omissions as incomplete where information is lost. Include real colored-output regression.
- Preserve explicit user/agent role through native/main/renderer, without relabeling human instruction as an agent response.
- Scope hydration failures to the affected Task. Verified/unknown Workspace authority failure suppresses that Workspace; principal/runtime/session invalidation suppresses the whole scope. Do not cancel unrelated current Task questions merely because another Task is missing or malformed. Post-wait identity/current-authority checks remain mandatory.
- Use one agreed UTF-8 byte limit for answers before request consumption, with UI feedback that preserves valid correction ability; test multibyte boundaries. Harden drafts against inherited-property IDs and make distinct transition announcements distinguishable by item ID.
- Establish artifact absence from actual empty Task artifact_refs; unresolved existing refs yield unknown, not invented failure or preview. No artifact creation/load implementation added.
- Add maintained >256-item endpoint/pagination coverage asserting cursor advancement, newest256 exact chronological identities, terminal evidence and incomplete flag. Native unexecuted tests remain open owner gate, never passing evidence. Keep supported desktop equivalent regression tests where useful.
- Existing request_user_input schema requires choices and supports freeform Other. Do not widen it to unsupported optionless model questions. Clarify cumulative plan updates; omission is not withdrawal, and no new reset/delete protocol is introduced in this correction.

KEEP: all scoped authority, permission independence, current real question handler, native fixture, reduced-motion/focus-safe primitive composition, exact baseline restore proof, prior gates and six-line deletion regression. Known-bad state avoided: poisoned whole-view output, lost multibyte answer, old-content starvation, cross-Task cancellation, speaker ambiguity and unsupported artifact absence.

- Native named bounded hydration, retained v1 publisher and exact-turn scoped questions are authored. Main/preload projects an allowlist and current-authority guards; renderer displays actual rows, evidence-linked steps, unchecked results, contextual input and compact artifact status. No generated bindings were hand edited.
- Conservative scope: native action text must exactly match a referenced successful command/applied edit to confirm done. A decision cue requires exact retained human instruction ID and text. Natural-language conclusions remain unconfirmed; unsupported policy basis is unverified; no independent check records exist on this route.
- The omitted six-line Story 1.25 deletion-disclosure regression is included as new Story 1.26 evidence only, without a deletion product change. Support/verification and cumulative open gates: `story-1-26-progress-support.md`.
- Story and tracker remain in-progress pending native/protocol/Windows/provider acceptance. The conditional SQLite writer-contention residual is unchanged.

## Spec Change Log

- Pass 2: sharpened non-frozen implementation guidance for pre-ack mounted question reachability, citation-vs-success evidence, canonical plan selection, diagnostic tails and serialized caps; frozen intent unchanged. KEEP instructions in pass2 notes.

- Pass 1: changed non-frozen implementation guidance to make bounded projection priority, canonical comparison, scoped invalidation, speaker provenance, answer bytes and artifact metadata concrete; frozen user intent unchanged. KEEP instructions below.

## Review Triage Log

### Review pass 3 — individual verdicts and bounded final corrections

| Finding | Verdict | Evidence and disposition | Likelihood / impact |
|---|---|---|---|
| Blind3-1 revision history beyond newest256 | low | Bounded hydration explicitly marks historyIncomplete; within retained window revisions are canonical and stale ones rejected. A previously omitted revision may be unknown, but no analytical authority or unevidenced completion follows. Reject complex persistent revision authority for unlikely conflicting publication beyond256; retain as bounded-view limitation. | Unlikely contradictory long history / low with incomplete disclosure. |
| Blind3-2 unresolved citation omission | medium | Initial citation filters remove missing IDs without setting incomplete. Direct patch flag dropped references; unsuccessful refs remain insufficient for done. | Plausible missing model ID / medium provenance clarity. |
| Blind3-3 referenced activity budget priority | low | Current result survives while old cited text may clip and reference is then removed with incomplete set. No false evidence or complete-history claim; evidence-priority redesign adds complexity for extreme text budgets. Reject low/conditional improvement; preserve disclosed bounded-view limitation. | Unlikely >activity budget / low, explicit omission. |
| Blind3-4 ANSI tail boundary | low | Cut may display suffix of terminal escape payload as inert React text; does not execute or reveal hidden provider blocks. Complex full-prefix state parser for unusual >12KiB OSC crossing rejected as low/unlikely; incomplete is already set for tail loss. | Unlikely adversarial long escape / low display artifact. |
| Blind3-5 stale failed read after answer | medium | load success checks readEpoch but catch does not, so older rejection clears fresh answer state. Direct patch same epoch guard on failure, regression. | Plausible latency / medium. |
| Blind3-6 draft clear on unconfirmed answer | false | Rejection means current authority/consumption is unknown; frozen intent explicitly requires clearing protected content and pending answers on unknown authority. Known correctable controls/bytes never submit and retain draft. No evidence establishes safe confirmed-current transient failure discriminator; retaining secret drafts after unknown auth would violate intent. | Unknown-authority clearing is deliberate. |
| Blind3-7 terminal activity still labelled running | medium | Native item status can remain running while run ended; renderer currently presents ongoing work. Direct display correction to ended/unconfirmed without falsifying canonical status; test. | Plausible interruption / medium. |
| Blind3-8 citation navigation links | false | IDs and corresponding activity IDs/text are both displayed; no claimed link/navigation feature is broken. This is an enhancement, not demonstrated missing evidence or false provenance. No new navigation control in this correction. | Existing visible evidence inspectable. |
| Blind3-9 global overflow flag | low | Aggregate queue overflow marks later bounded views incomplete until invalidate; conservative overstatement of loss, not data loss or authority promotion. Scoping unidentified rejected request adds state for rare16-request overflow; reject low/unlikely complexity and disclose residual. | Unlikely concurrent queue saturation / low conservative warning. |
| Blind3-10 stale permission card after decision | medium | Pending read is not fenced by decision; can restore consumed card. Direct patch consumed IDs/read epoch and regression; backend still prevents duplicate effects. | Plausible latency / medium UI reliability. |
| Edge3-1 slow permission read starvation | high | Every interval increments sequence, so reads consistently slower than interval never win and cards never display. Direct patch single in-flight read with generation checks preserved, regression. | Plausible slow authority / high blocked task. |
| Verification3-1 failed citation desktop test | medium | Filed regression gap accepted: current desktop failures only test plan downgrade; add parser-to-mounted failed/cancelled citation with unchecked result and unconfirmed plan. | Plausible future regression / medium. |

Only trivial demonstrated corrections remain; no bad_spec/intent_gap loop required. All three independent layers completed. Low-risk rejected enhancements remain visible above rather than silently promoted to completion claims.

### Review pass 2 — individually triaged

| Finding | Verdict | Evidence and disposition | Likelihood / impact |
|---|---|---|---|
| Blind2-1 cumulative plan capacity | medium | First64 distinct IDs occupy slots permanently; later current steps are dropped although incomplete is set. bad_spec: bounded recent/current canonical selection with revision safety. | Plausible long audit / medium. |
| Blind2-2 result citations | medium | Result refs filter through successful-action map, dropping actual failed commands/messages. That map is right for done proof, not all citation provenance. bad_spec: distinct actual citation identity set vs successful completion map. | Likely diagnostic finding / medium. |
| Blind2-3 output diagnostic tail | medium | Per-item prefix clipping can omit final failed-command diagnostic. bad_spec: bounded command plus output tail, explicit omitted content. | Plausible long output / medium. |
| Blind2-4 intermediate allocations | maybe-false | New projector copies complete retained output before clipping; actual upstream retained output maximum/runtime memory harm not established from this partial tree. Defer unverified medium resource risk; a bounded sanitizer can reduce avoidable copy without claiming thread-store allocation is solved. | Unverified / medium. |
| Blind2-5 question controls | medium | Native question fields accept controls rejected by main parseQuestion; handler then receives empty answer. Direct patch align accepted fields with main validation and test. | Conditional model text / medium. |
| Blind2-6 pasted answer controls | medium | UI bytes-only validation permits controls rejected in parseAnswers, after which answer handler clears view/draft. Direct patch local validation and specific correction notice before send. | Plausible pasted text / medium. |
| Blind2-7 answered-question resurrection | medium | Poll read captured before answer can settle after local removal and restore question; next poll clears but stale form is visible. Direct patch fence reads across answer and preserve scoped consumed-ID suppression. | Plausible latency / medium. |
| Blind2-8 fast terminal announcements | low | New row terminal has no previous row so transition branch never announces. Direct patch announce new terminal IDs once. | Plausible assistive use / low. |
| Blind2-9 hydration rate | medium | Every output hint can refill queued while read is in flight; policy/native reads run continuously during stream. Direct patch bounded coalescing cadence, question/terminal refresh responsive. | Likely streaming / medium local load. |
| Blind2-10 pre-ack desktop question | high | StartView mounts no TaskProgress and waits api.start before onAccepted; only manual reconcile after uncertainty. Native fixture held ack awaits question, but mounted client cannot answer it. bad_spec: current operation read-only reconciliation/discovery before ack; no replay/no focus steal, held-ack Shell regression. | Plausible delayed ack / high blocked workflow. |
| Edge2-1 serialized budget | medium | Text256KiB can escape2x plus 128 rows x16 refs x128 bytes (~256KiB) and metadata exceed main768KiB cap. bad_spec: native serialized-byte final cap with truthful trimming and reference/basis consistency, adversarial test. | Conditional maximal publication / medium. |
| Edge2-2 terminal running plan | medium | Native run status terminal leaves plan running untouched, renderer pulses forever. Direct patch terminal unresolved running becomes unconfirmed (not done), tested across terminal states. | Likely interrupted plan / medium. |
| Verification2-1 positive human basis | medium | Filed tests only reject nonhuman/null desktop basis; unconditional null would pass. Add parser→mounted positive exact human instruction basis retaining unchecked wording. Direct test patch. | Plausible regression / medium. |

Pass1 corrections verified in changed code and regression outputs; no carried identical unfixed row is patched twice. Pass1 cumulative omission claim remains deferred/unverified; do not introduce plan deletion semantics.

### Review pass 1 — independently verified, 2026-10-31

| Finding | Verdict | Evidence and disposition | Likelihood / impact |
|---|---|---|---|
| Blind 1: control-bearing command output | high | Native progress_text preserves ESC, while main progressText rejects it and progress catches by invalidating all input. Real colored command output is sufficient. bad_spec: sanitize display safely, preserve truthful omission status. | Likely / high: ordinary tool output breaks the whole live view. |
| Blind 2: Unicode answer bound | medium | JS length counts UTF-16 units; native String.len counts bytes. 3000 é passes desktop then fails after request consumption. patch retained in loopback. | Plausible / medium: lost answer and misleading sent notice. |
| Blind 3: absent-option question | false | Existing request_user_input_spec normalization already requires nonempty choices and its advertised schema requires options; normalization enables Other. Native optionless model questions are not a reachable supported shape. Mounted defensive free-text coverage is not native evidence. No schema expansion. | Not reachable on advertised tool / none. |
| Blind 4: budget exhausts latest evidence | high | project_progress spends shared budget oldest-first and duplicates message text before publications. Recent result can be empty after previous output. bad_spec: recent/terminal priority, per-projection final allocation, explicit truncation. | Plausible on long audits / high: current result disappears. |
| Blind 5: result-slot starvation | medium | First 64 ordinary messages fill results before publications; subsequent messages omit without incomplete flag. bad_spec: recent structured findings take priority, every loss disclosed. | Plausible long task / medium. |
| Blind 6: canonical revision comparison | medium | Same revision compared with already clipped plan[index].text; clipping creates false rewrite rejection. bad_spec: compare untruncated canonical state before display budgets. | Conditional on clipping / medium. |
| Blind 7: global cancellation on local read error | medium | Any current-scope progress exception invokes invalidate(false), clearing every Task's question and trusted thread. bad_spec: Task-local failure suppression; Workspace/session invalidation only at actual scope. | Plausible concurrent tasks / medium. |
| Blind 8: missing speaker | medium | UserMessage and AgentMessage both project kind message and same renderer label. Auditor cannot distinguish instruction from agent answer. bad_spec: allowlisted role, truthful speaker UI. | Likely normal use / medium. |
| Blind 9: repeated announcement string | low | Two different items completing create identical live-region text; second may not be announced. direct patch: include stable item identity. | Plausible assistive use / low. |
| Blind 10: plan removal semantics | maybe-false | Publication describes stable steps/revisions but neither removal nor full replacement is promised. Cumulative updates retain omitted IDs; cannot infer withdrawal from omission. Defer unverified medium usability claim pending actual model-use evidence; document cumulative update semantics, no new deletion surface. | Unverified / medium if model expects replacement. |
| Blind 11: unconditional artifact absence | medium | tasks_progress already loads Task with artifact_refs, yet projector always emits absent. Referenced artifacts need unknown metadata rather than false absence. bad_spec: authoritative empty refs establish absent; nonempty/unresolved refs unknown. | Conditional existing references / medium. |
| Edge 1: control-bearing output | high | Same verified native/main mismatch as Blind 1. Group with Blind 1. | Likely / high. |
| Edge 2: Unicode answer | medium | Same verified length mismatch as Blind 2. Group with Blind 2. | Plausible / medium. |
| Edge 3: inherited question ID | high | draft starts {} and native IDs allow constructor; draft[q.id]?.trim() calls trim on inherited function. Direct patch: own-property/string-safe draft access. | Conditional model ID / high: view crash. |
| Verification 1: pagination regression gap | medium | Existing tests project prebuilt short vectors; none exercise page cursor advancement, newest256 selection and completeness. Filed verification evidence accepted. bad_spec: maintained endpoint/paging seam test with >256 canonical items, exact order and terminal evidence. | Plausible future regression / medium. |
| Verification Other 1: Unicode answer | medium | Confirmed native len vs JS length; same root as Blind2/Edge2. | Plausible / medium. |

Groups: display projection integrity (Blind1/4/5/6/8, Edge1), scoped failure (Blind7), artifact metadata (Blind11), pagination verification (Verification1) route bad_spec; direct corrections (Blind2/9, Edge2/3, Verification Other1) retained in loopback; Blind3 rejected; Blind10 deferred unverified, not a new approved reset feature.

## Design Notes

One cohesive auditor goal spans native evidence, trusted main projection and usable conversation. A cosmetic-only renderer cannot satisfy the ACs. No migration is planned; retain versioned metadata in governed existing native history and use bounded private memory views. Model-authored result structure is useful presentation, not proof of correctness or authority.

Representative acceptance: stream the fictional procurement review, show a pending analysis step, actual bounded command, and row-linked R01/R03 duplicate candidate/R02 approval gap. Pending steps remain pending after interrupted/failed execution. Label arithmetic/findings/proposals and evidence scope honestly; do not call a scripted fixture result independently verified. Complete useful-output validation with authorized real inference at end of Epic 1.

## Verification

- `pnpm exec tsc -p tsconfig.build.json --noEmit`; `pnpm run build`; focused progress/tasks/permissions/shell/primitives tests; `pnpm test`: record exact passing/failing/skipped counts and causes, not blanket success.
- Matching native protocol/core/app-server tests and retained-child fixture with plan/result/question events; `cargo fmt/check/test/clippy`; supported protocol generation. Restore/hash-check missing pinned callers before edits. No manual generated artifacts.
- Target Windows seeded Electron: live progress, reduced motion/keyboard/focus, background navigation, authentic result labeling, questions/permissions, absent artifact and revocation. Native/Windows/provider checks unavailable here remain explicit owner-run gates, never acceptance passes.

### Historical first-pass verification — 2026-10-31

- Main TypeScript and production build (including renderer TypeScript): passed; five existing font warnings.
- Supported focused command: **14 files / 358 tests passed**, none failed/skipped. Broader focused permissions wildcard: same 358 passing tests plus one native-binary collection failure.
- Full `pnpm test`: **48 files passed / 12 failed / 1 skipped; 1,189 tests passed / 3 failed / 5 skipped**, 43.80s. Missing native/design inputs and Git/generated stamp baseline failures persist; this is not a green full suite.
- All 48 present generated files plus stamp match source baseline Git blobs. Supported generation refuses non-Git snapshot. Cargo fmt/check/test/clippy unavailable (127). Native fixture, target Windows Electron and separately authorized provider useful-output validation remain unrun owner gates.
- Exact commands, sources and cumulative residuals: `story-1-26-progress-support.md`; logs: `desktop/validation/story126-*.log`. Story/tracker remain in-progress.

### Pass 1 correction execution — 2026-10-31

Canonical-before-display projection, latest-result priority, single fallback,
ANSI/control sanitation, explicit speaker roles, scoped failure suppression,
4096-byte correctable answers, safe inherited IDs, identity-bearing announcements,
authoritative artifact-ref status and shared bounded pagination coverage are
implemented. Cumulative plan semantics and required choices/Other remain unchanged.
Native tests are authored only; no native acceptance claim is made.

Current desktop verification: main tsc and production build passed (five existing
font warnings); supported focused **14 files / 370 tests passed**; full suite
**48 files passed / 12 failed / 1 skipped, 1,201 tests passed / 3 failed / 5 skipped**
with the same native/design/Git/generated baseline failures. All 48 generated
files plus stamp remain baseline-identical. Cargo fmt/check/test/clippy and
supported generation remain blocked by absent toolchain/non-Git snapshot. Native
fixture, Windows and explicitly authorized provider gates remain open. Detailed
commands and residuals are in `story-1-26-progress-support.md` and
`desktop/validation/story126-loop1-*`. Story/tracker remain in-progress.

### Pass 2 correction execution — 2026-10-31

Implemented the pass-2 re-derivation requirements sequentially, preserving pass-1
coverage and frozen intent: exact-operation pre-ack discovery with mounted mediated
question/navigation/revocation coverage; actual citation identity distinct from
successful exact-work proof; recent64 canonical plans; bounded diagnostic tails;
640 KiB final serialized native ceiling and visible reference/basis consistency;
question/answer control parity; consumed-answer read fencing and 250 ms hydration
coalescing; newly terminal identity announcements; terminal unconfirmed plans; and
positive parser-to-mounted exact human basis remaining unchecked.

Main tsc and production build pass (five existing font warnings). Supported focused
**14 files / 382 tests pass**; final full suite **48 files pass / 12 fail / 1 skip,
1,213 tests pass / 3 fail / 5 skip**, with baseline native/design/Git/generated-input
failures. All 48 generated files plus stamp remain baseline-identical. Native
fmt/check/tests/clippy and retained fixture are blocked by missing cargo; supported
generation refuses this non-Git snapshot. Native, Windows and explicitly authorized
provider acceptance remain open; native new tests are not passing evidence. Exact
commands, intermediate results and cumulative residuals are retained in
`story-1-26-progress-support.md` and `desktop/validation/story126-loop2-*`.
Story/tracker remain in-progress; no eligibility promotion.

### Final verification and review closure — 2026-10-31

Three independent review layers completed in each of three passes. Final direct corrections cover unresolved-reference incompleteness, stale read rejection, ended activity presentation, single-flight permission polling and consumed-card suppression, plus parser-to-mounted failed/cancelled citations. All actual findings were individually triaged above with likelihood/impact; rejected low-risk enhancements and unverified residuals are not represented as fixed.

Owner verification rerun after all product edits: main TypeScript and production build exit0; focused **14 files /392 tests passed**, none skipped; full **48 files passed /12 failed /1 skipped;1,223 tests passed /3 failed /5 skipped**. Full command exit1 retains baseline missing native/design/Git/generated-source failures, not a full pass. Native regression attempt exits127 (cargo unavailable). Exact logs are `desktop/validation/story126-final-*`. The inherited matrix is covered by passing desktop tests for its supported projection/UI paths; actual native, protocol, Windows Electron and provider/auditor outcomes remain unrun, therefore the native verification task and story remain in progress. No automatic done/review promotion or local/remote commit was made.
