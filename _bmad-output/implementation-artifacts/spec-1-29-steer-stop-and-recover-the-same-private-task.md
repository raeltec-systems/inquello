---
title: 'Steer, stop and recover the same private Task'
type: 'feature'
created: '2026-10-31'
status: 'in-progress'
baseline_commit: 'NO_VCS'
remote_baseline_commit: 'bc25c9eb33c077eed706bb038067411b0aa9fc13'
route: 'dispatch'
review_loop_iteration: 2
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An auditor can start and inspect a private Task, but cannot yet reliably redirect it, interrupt it or resume the same retained work. Navigating away must not make progress or requests for input disappear.

**Approach:** Reuse Codex conversational steering, interruption and retained-thread continuation behind authorized Task commands. A natural-language correction makes the agent revise its plan, perform the necessary analysis, update or withdraw affected findings, preserve unaffected work and explain what changed. Audit provenance and access checks strengthen this baseline; warning labels do not replace the agent doing the work.

## Boundaries & Constraints

**Always:** Follow AC1.29.1–5 and the approved design system. Reuse Composer, IconButton, PlanStep and existing status tokens; Stop is the labelled 30px round control with a 9px square. Escape only dismisses eligible overlays. Preserve fictional-audit normal UX, source/evidence boundaries, confirmed effects, draft text, accessibility and focus. The auditor gives ordinary instructions, not mandatory scope classifications or manual affected-result selections. Ask a contextual question only for material ambiguity. Retain historical revisions and independently distinguish current results, superseded/withdrawn results and analytical review status. Lifecycle commands are main/domain owned and bound to current principal, Workspace, Task, runtime/thread, turn and operation identity. Freshly revalidate authority, retained-context access, route evidence/approval, credentials/settings and applicable limits at dispatch and disclosure boundaries. Concurrent or lost acknowledgements reconcile the same operation, never automatically dispatch twice. A withdrawn or unverifiable context stops resume without exposing protected history. Background work means work continuing while the application/runtime remains available; after loss/restart show interruption and require explicit Resume.

**Never:** Expose arbitrary renderer runtime requests; reopen generic private-thread bypasses; create a replacement thread when linkage fails; auto-resume after a crash; claim rollback or completion from Stop submission; label model speculation as confirmed effects; steal focus on background updates. No attachments, artifact continuity before Epic 3, cloud execution, scheduler/daemon-after-exit, new spending policy, real credentials or paid test calls. Existing native/protocol/provider/Windows acceptance gates remain separate. No eligibility promotion from authored tests or an operator toggle. Steering admission is not completed adaptation; model-reported revision is not independent review. No blanket result invalidation or automatic carry-forward of signoff to changed findings. Stop does not promise rollback or universal termination of remote/background effects; preserve stronger existing local oneshot cancellation and report genuine unresolved effects.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Steer | Running procurement audit; change period, exclude cancelled invoices or change duplicate key | Deliver natural-language guidance into active work; agent revises plan, reruns affected analysis, updates/withdraws findings and explains changes while preserving unaffected work | Admission is not completion; wrong/ended turn preserves draft without silent new turn. Material ambiguity prompts a contextual question |
| Stop | Three confirmed completed steps, two pending | After confirmed interruption: “Work interrupted. 3 steps completed; 2 remain.” Pending stays pending; confirmed applied effects remain listed | Show stopping until confirmation; unknown counts/effects remain explicit; natural completion race remains truthful. Interruption is not rollback or global process-death proof |
| Resume | Interrupted linked Task with retained history/metadata | Recheck access first, then explicitly continue the same retained thread; state missing context or changed access before execution | Unlinked history, revoked/unknown context or stale route refuses without replacement, replay or protected output |
| Background | Auditor opens another Task while work continues | Navigation shows running/interrupted/completed, completion conditions and waiting-for-input state; opening the Task reaches its question | No focus steal; stale notifications cannot revive old state or disclose another principal’s work |
| Crash/race | Process/session loss, repeated clicks, late completion or identity change | Retain last confirmed history/metadata and operation outcome; restart reports interruption/uncertainty | Reconcile before any new effect; old runtime callbacks cannot complete or authorize a new run |

</frozen-after-approval>

## Code Map

- `engine/codex-rs/inquello-domain/src/tasks/mod.rs`, `inquello-adapters/src/tasks.rs`: durable run/binding journal and recovery; add lifecycle semantics without moving infrastructure into domain.
- `engine/codex-rs/app-server/src/request_processors/inquello_tasks.rs`: private authorization and generic-thread guard; use bounded lifecycle entry points. `turn_processor.rs` and `thread_processor.rs` supply actual steering, interrupt acknowledgement and retained-thread resume behavior.
- `engine/codex-rs/app-server-protocol/src/protocol/v2/inquello.rs`, request dispatch and `inquello-domain/src/routes/authorization.rs`: explicit wire operations and resume evidence coverage; old command-only proof cannot cover the new operation.
- `desktop/src/main/tasks/{service,types,progress}.ts`, `main/security/operations.ts`, preload bridge: trusted orchestration, stale-response fencing and notification reconciliation.
- `desktop/src/renderer/Shell/{TaskView,TaskProgress,Sidebar}.tsx`, `tasks-bridge.ts`: normal controls, retained results, background navigation and accessible questions.
- `engine/codex-rs/core/src/tools/handlers/inquello_progress.rs`, progress contract/projection: existing stable IDs and step revisions support updates, but omissions currently retain old results and projection is turn-local; add explicit supersession/withdrawal and authorized cross-turn continuity.

## Tasks & Acceptance

**Execution — sequential:**
- [ ] Domain/adapters and additive migrations if required — durable idempotent steer/stop/resume outcomes and retained-thread linkage; preserve history and explicit uncertain states across restart.
- [ ] Native protocol/processor files above — implement real running-turn steering/interrupt and authorized retained resume, fresh context checks and cancellation fences. Reuse runtime semantics rather than simulate success. Never hand-edit generated artifacts.
- [ ] Progress publisher/contract/projection — enable agent-authored revisions, explicit withdrawal/supersession with reasons and evidence lineage; retain permitted prior-turn work while displaying current results separately. Do not confuse analytical claims with confirmed effects or independent review.
- [ ] Desktop main/security/preload and renderer files above — expose conversational steering and named lifecycle operations, preserve drafts/work and show status/conditions/input without focus changes. Reconcile acknowledgements internally; surface genuine uncertainty, not routine manual recovery chores. Bind callbacks to current operation and authority.
- [ ] `desktop/test/tasks-lifecycle*.test.*`, existing progress/security suites and native `app-server/tests/inquello_authorization_runtime.rs` — cover every matrix edge, actual steering/stop/resume integration and positive controls on both supported provider bindings, plus cross-company/peer-private, revocation-before/during-resume, Stop/finish, steer/finish and crash/lost-ack races.
- [ ] Story support, capability evidence references and cumulative Epic 1 acceptance ledger — record actual outcomes, open gates and likelihood/impact for residuals. Preserve earlier stories’ unfinished validations and no real-data eligibility promotion.

**Acceptance Criteria:**
- AC1.29.1: ordinary corrective instructions lead to a revised plan, actual reanalysis, updated/withdrawn affected findings and a concise change summary; unaffected work remains usable. Accurate admission alone does not pass this product criterion.
- AC1.29.2: an auditor can interrupt real work with accurate plan/effect accounting, pending work preserved and no rollback claim.
- AC1.29.3–5: an explicitly resumed Task uses its authorized retained thread/history, never substitutes work, and extends the actual-route negative gate with resume itself.
- AC1.29.4: navigation makes ongoing work and actionable questions discoverable without moving focus; restarting preserves confirmed state and reports interruption.

## Implementation Notes

### Corrected derivation for review loop 2

Preserved round-2 positive candidate: `/workspace/shared/inquello-story129-round2-preserved/`; diff `/tmp/inquello-story129-review-round2.patch`. Product changes were reverted before this derivation. Restore KEEP functionality, then make only the coordinated corrections below. **Exactly one source writer at a time, not merely sequential integration; parallel read-only investigation is permitted.**

- Keep every loop-1 correction and test. Do not add persistent drafts or automatic restart dispatch; R2-B2's specific replay claim was refuted.
- Cancellation must not depend on provider discovery/credentials/capability readiness needed only for starting work. Retain trusted principal/Task/thread/turn ownership, current cancellation authority and output fences. Bound slow admission authority while holding SQLite writer ownership so a genuinely in-flight steer cannot indefinitely prevent Stop. Do not move authorization outside the final commit fence without an equally sound freshness proof. Exercise the actual stalled validation path, not a receipt edited after admission.
- Recheck lifecycle/run incarnation after every final awaited authority boundary before mutating activity/questions or publishing a snapshot. Late receipts from old turns cannot stop a newly resumed run's tracking.
- Unify terminal receipt presentation. Separate applying a notice/draft settlement once from acknowledgement retry; mark durable settlement successful only after success. Retry transient settlement safely without re-clearing newer draft edits or dispatching again.
- Reserve bounded observation capacity for selected/full subscribers and actionable invalidations. Reuse unchanged canonical history through a bounded revision-aware/incremental cache, but always revalidate current disclosure rights and invalidate on new output/lineage/session/policy changes. No stale protected payload on revocation.
- Expose bounded retrieval for current findings and historical revisions beyond display caps, with stable revision/snapshot binding, truthful completeness and accessible controls. Do not solve it by unbounded rendering or silently erasing unaffected work. Preserve exact revision and supersession reasons.
- Extend actual retained-child fixtures on both provider bindings: before/after Resume publications must assert unaffected first-turn findings, updated current version, historical predecessor/source-turn and both reasons through `inquello/tasks/progress`, not only pure projection. Also maintain real pending-steer/Stop, stale final-policy snapshot, late receipt, settlement rejection/retry, selected-priority and pagination regressions.
- Run affected tests and supported full verification. Keep native/provider/Windows execution unrun honestly and preserve nonzero platform fixture selection. Freeze the integrated candidate for the next three independent review layers.

### Corrected derivation for review loop 1

A preserved read-only round-1 candidate is at `/workspace/shared/inquello-story129-round1-preserved/`; its complete diff is `/tmp/inquello-story129-review-round1.patch`. Product changes were reverted for this derivation. Restore the verified positive pieces as KEEP, then rederive the coordinated areas below; do not blindly restore the known-bad states.

1. Model dispatch/admission/terminal outcomes precisely: definitive pre-effect refusal releases state; an undispatched newer instruction is refused, not uncertain; terminal Failed resolves Stop; uncertainty cannot permanently eliminate explicit verified recovery. Correlate steering admission to its operation in retained native history/journal, never deduplicate by text. A resolved old run must not create another effect.
2. Keep an independently fenced Stop available while steering is pending/uncertain. Retain operation/draft settlement across navigation and session transitions in trusted Task-scoped orchestration; preserve edits made after submission. Bootstrap current retained Workspace on recovery reads without starting work.
3. Resume the same thread under the fresh effective runtime configuration; a warm thread may not keep an obsolete sandbox/profile or stale thread-level guard. If safe reconfiguration requires shutdown/reopen, retain the same verified identity/history and prove the previous run is not live.
4. Retain canonical current findings/revision lineage independently of bounded recent activity. Use authorized bounded pagination or durable projection appropriate to existing storage, include new state in ownership/export/delete rules, preserve unaffected findings and accurate withdrawal history. Preserve each revision's own reason separately from the reason that superseded it. Do not fabricate complete history when genuinely unavailable.
5. Share/coalesce bounded activity observation. Navigation gets status/conditions/input cheaply; full history is for the selected Task. Preserve visible actual statuses and question reachability, authority invalidation and focus.
6. Add maintained regressions for every corrected trigger, populated lifecycle export/inspection with each nested identity corruption, real retained-child resume/stop on supported Windows and Linux, and explicit failure when a required fixture selection is empty. No pretend Windows proof from a Linux-gated zero-test run. Real model correctness remains owner-run.
7. Re-run the affected supported tests and full verification, document exact native/platform blocked commands, then repeat all three independent layers. All accepted medium/high defects are part of this story, not deferred environment gates.

## Spec Change Log

- Review loop 2: keep all loop-1 corrections; close late-incarnation/settlement races, provider-independent bounded cancellation, selected-work priority and bounded accessible result continuity. Add actual endpoint and truly in-flight regression witnesses. Refute unsupported automatic restart duplication; do not introduce disk-persisted drafts. Frozen intent unchanged.

- Review loop 1: correct operation outcome/recovery coordination, live cancellation reachability, warm-runtime reconfiguration, durable analytical projection, background subscription cost and Windows verification. Frozen owner intent unchanged. KEEP natural-language agent-owned adaptation, same-thread ownership, strict authorization, confirmed-effect semantics, durable journal, additive migrations, published-source boundaries and all passing desktop behavior. Preserve every individually logged finding above; no unrelated earlier-story rewrite.

- 2026-10-31 planning revision: owner aligned with the Codex-baseline experience (“yes thats better”). Replaced the unapproved blanket-marking/manual-selection proposal with natural-language, agent-owned adaptation and explicit revision lineage. Preserve authorization, evidence integrity and useful same-Task continuity. No earlier story implementation changed.

## Review Triage Log

| Finding | Verdict | Likelihood / impact | Route | Evidence |
|---|---|---|---|---|
| B1 | high | high/high | bad_spec | Proven pre-effect refusal is caught as uncertain and reconciliation targets an absent receipt; release definitive non-dispatch operations. |
| B2 | high | medium/high | bad_spec | Uncertain resume remains lifecycleOpen; prior-operation guard blocks another explicitly verified recovery even though native supports it. |
| B3 | high | medium/high | bad_spec | Uncertain steer has no reconciliation mapping; native pending-operation rule and desktop block further lifecycle actions. Require operation-correlated admission evidence and truthful terminal unresolved outcomes. |
| B4 | high | high/high | bad_spec | Main progress/lifecycle omits bootstrap while native task_session is required; Start alone establishes it. Restart must initialize authorized retained session without dispatch. |
| B5 | high | medium/high | bad_spec | Warm resume returns loaded thread before applying fresh profile; new turn guard does not establish replacement of existing runtime sandbox/thread configuration. |
| B6 | high | medium/high | bad_spec | TaskLifecycle disables Stop for any pending instruction, service serializes behind it and native pending journal blocks it; safe cancellation must remain reachable. |
| B7 | false | n/a | reject | Shell.tsx424–431 clears the tree/open Task on session change and reloads; sidebar rows are unmounted/recreated. The cited standalone-hook behavior does not establish indefinite retained sidebar status in its actual caller. |
| B8 | medium | high/medium | patch | Admission copy asserts revising before observing any revised work; change it to guidance received, without claiming analysis occurred. |
| B9 | high | medium/high | bad_spec | Cross-turn projection uses bounded recent activity as canonical result state; unaffected findings and withdrawal predecessors disappear once outside that window. Preserve authorized current/history continuity independently of the activity display window. |
| B10 | medium | high/medium | bad_spec | Each sidebar row polls full cross-turn progress at1.5s plus open panels; repeated lineage authorization scales with Tasks and turns. Use shared bounded lightweight activity/status observation, not N full-history reads. |
| B11 | medium | medium/medium | bad_spec | Historical prior changeReason is overwritten by later revision reason; preserve revision-creation and supersession reasons separately. |
| E1 | high | high/high | bad_spec | Same verified pre-effect-refusal root cause as B1; no receipt exists to reconcile. |
| E2 | high | medium/high | bad_spec | Prior-operation branch returns uncertain for a newly rejected undispatched operation, leaving renderer waiting for nonexistent operation ID. |
| E3 | high | medium/high | bad_spec | Stop recognizes Cancelled/Completed but not Failed terminal observation, leaving uncertain receipt and blocking explicit recovery. |
| E4 | high | high/high | bad_spec | Pending identity lives in unmounted component ref. Main retains receipt but remount cannot settle matching request; admitted draft may be sent again with a fresh ID. |
| V1 | medium | medium/high | patch | Preverified regression gap: inspector nested lifecycle/history ownership predicates lack populated positive and corrupted-field negative fixtures. |
| V2 | high | high/high | bad_spec | Preverified broken verification: documented Windows command targets Linux-gated crate and can pass with zero lifecycle tests. Provide target-compatible retained-child path and nonzero selection check; keep execution unrun here. |

| R2-B1 | medium | medium/high | bad_spec | BEGIN IMMEDIATE awaits multiple15s authority checks; independent Stop needs writer lock and can time out at5s. Bound admission-held authority/writer waits and test a truly stalled request, without weakening fresh commit authorization. |
| R2-B2 | false | n/a | reject | The alleged automatic restart duplication depends on a restored draft relationship, but drafts.ts explicitly retains unsent text only for the renderer window lifetime. Restart neither restores that draft nor automatically dispatches it; native retained conversation and operation journal remain. A consciously retyped new request is not the claimed programmatic replay. No persistent draft system added. |
| R2-B3 | medium | medium/medium | bad_spec | Canonical reconstruction fixes activity-tail loss, but64 current/128 historical display caps still leave older records without retrieval. Add bounded current/history pagination with truthful completeness and revision continuity, rather than unbounded payloads. |
| R2-B4 | high | medium/high | bad_spec | Late terminal receipt calls completed(thread) without checking active incarnation; old Stop reconciliation can clear tracking after Resume. |
| R2-B5 | medium | medium/medium | bad_spec | Renderer marks settled before settlement RPC acknowledgment and ignores rejection; transient failure prevents safe retry and can exhaust256 outstanding entries. |
| R2-B6 | medium | medium/medium | bad_spec | Shared round-robin4-per-tick observation does not reserve capacity for selected Task; many sidebar rows delay selected questions/controls. |
| R2-B7 | medium | medium/medium | bad_spec | Selected polling repeats full retained scan up to1000pages/64MiB with per-page lineage authorization even when unchanged; add bounded revision-aware/incremental reuse with current disclosure authorization. |
| R2-B8 | high | medium/high | bad_spec | Stop calls prepareRoutes and native candidate/credential readiness despite no new inference; provider discovery failure can block authorized local interruption. Separate cancellation checks from new-execution prerequisites. |
| R2-B9 | medium | high/medium | patch | Existing pending-steer fixture awaits admission then changes receipt; it does not exercise actual in-flight authorization/write-lock delay. Add a held request with concurrent Stop. |
| R2-B10 | medium | medium/medium | patch | Observation marks settled before settle() notice path, so non-admitted terminal receipts retain stale stopping/reconciliation text. |
| R2-E1 | high | medium/high | patch | readProgress checks lifecycleAtRead before final awaited policy but not after; stale terminal snapshot can clear new-run tracking/questions at that boundary. |
| R2-E2 | medium | medium/medium | patch | Same verified notice-order root cause as R2-B10; every terminal receipt must traverse shared outcome presentation. |
| R2-V1 | medium | medium/high | patch | Preverified regression gap: pure projection tests pass supplied cross-turn rows; actual retained child endpoint lacks post-Resume unaffected/current/history assertions for both bindings. |

| R3-B1 | medium | low/medium | patch | Publication accepts controls in new changeReason while desktop rejects them; reject unsupported controls at publication admission and cover parsing/projection. |
| R3-B2 | medium | medium/medium | patch | Selected subscription upgrade waits for an already-busy background read; supersede its read generation without exceeding bounded selected capacity. |
| R3-B3 | medium | low/high | patch | Observer catch awaits fallback before clearing retained payload; clear immediately on failed read, retain generation authorization fence. |
| R3-B4 | medium | low/medium | defer | Pre-existing64-step presentation bound from Story1.26 remains; it sets historyIncomplete and interruption counts become explicitly unknown rather than falsely complete. Broader plan-history pagination is not introduced by new result lineage. |
| R3-B5 | medium | medium/medium | patch | Page may reference more than256 distinct evidence items; selection removes valid references. Fit result pages to evidence/payload bounds without dropping their retained citation provenance and test pagination coverage. |
| R3-B6 | medium | high/medium | patch | Renderer substitutes page results but discards page.items; render selected-page evidence under the same snapshot binding. |
| R3-B7 | medium | medium/medium | patch | Result snapshot ID uses all-item ordinal, so unrelated streaming invalidates navigation; bind result pagination to relevant analytical/evidence projection changes while retaining full cache invalidation and fresh rights checks. |
| R3-B8 | medium | medium/medium | patch | Actual retained-child pending-steer fixture still mutates an admitted receipt; adapter stall test does not prove real authority RPC/Stop interaction. Add held real authority response witness. |
| R3-B9 | medium | low/medium | patch | First-seen revision>1 does not mark missing predecessor lineage; flag incomplete history, never fabricate an earlier finding. |
| R3-B10 | maybe-false | low/medium unverified | defer | Outright bridge rejection can leave component-local pending, but ordinary main runtime failures return typed results and identity/session invalidation unmounts controls. Need real Electron IPC rejection before operation registration with controls remaining mounted to establish the claimed persistent lockout; no blind replay or speculative new recovery API added. |
| R3-E1 | medium | low/medium | patch | Same verified reason-control mismatch as R3-B1. |
| R3-E2 | medium | high/medium | patch | Same verified discarded page evidence as R3-B6. |
| R3-E3 | high | high/high | patch | Continuity fixture expects four requests, then unconditionally asserts two; change final assertion to scenario-specific known expected count. |
| R3-V1 | medium | medium/high | patch | Preverified cache regression gap: actual endpoint not tested for same-turn new publication/older-item completion mutation and stale cursor; add both-binding native fixture coverage. |
| R3-V2 | high | high/high | patch | Same verified unconditional final request-count failure as R3-E3; do not label this an environment-only gate. |

## Design Notes

Source baseline: Inquello `bc25c9eb33c077eed706bb038067411b0aa9fc13`; selected Codex cut `360319d8`; current upstream inspected `67f0994b`. Reuse same-active-turn admission, native interruption and retained-history resume. Codex Queue-next-turn differs from core pending guidance; do not implement Queue by blindly calling generic `turn/start`, which may steer. Immediate preemption is feature-dependent and in-flight effects can outlive steering. Audit additions are Task-bound authorization, result revision lineage and accurate effects accounting—not a replacement agent workflow. Source/test research is recorded in `CODEX-BASELINE-AND-AUDITOR-STEERING.md` (Library companion); inspected tests are not executed evidence.

## Verification

**Commands:**
- From `desktop`: `pnpm exec tsc -p tsconfig.build.json --noEmit`, `pnpm exec tsc -p tsconfig.renderer.json --noEmit`, `pnpm run build`, focused lifecycle/progress tests and `pnpm test` — record exact pass/fail/skip and environmental collection failures separately.
- From `engine/codex-rs`: `cargo fmt --all -- --check`, `cargo test -p inquello-domain`, `cargo test -p inquello-adapters`, `cargo test -p codex-app-server --test inquello_authorization_runtime`; add exact targeted lifecycle fixture commands to support notes. Regenerate protocol through `desktop`'s `pnpm run generate:protocol` when native tooling is available; document blocked generation, never fabricate output.

**Owner product validation:** Use a realistic fictional invoice register in normal conversation, with known expected answers: change January–March to January–June, then exclude cancelled invoices, then change duplicate matching from invoice number alone to vendor plus invoice number. Include same-number invoices from different vendors, a genuine repeated vendor/invoice pair, an April addition and a cancelled duplicate. The agent must revise calculations and findings, retain unaffected findings, explain each change and preserve inspectable prior versions without presenting them as current. Stop after three confirmed steps with two pending, navigate elsewhere, answer an input request, restart and explicitly resume the same Task; repeat with revoked context and missing linkage. Validate on both supported provider bindings where available. Fixture delivery/state assertions are distinct from actual model usefulness and correct expected findings; a failed analytical outcome is a product failure, not excused by passing mocks. Record exact Windows/Electron/native/provider commands and expected results for every unrun gate. Include an end-to-end review for earlier warning-heavy UX that substitutes for agent work; flag findings without silently rewriting earlier stories.

## Implementation candidate — 2026-10-31

Domain/native/progress/desktop source and lifecycle regressions are authored.
Detailed scope, exact verification, both-provider owner fixture, qualitative
residuals and cumulative unfinished gates are recorded in
`story-1-29-lifecycle-support.md` and `epic-1-acceptance-ledger.md`.
All frozen intent remains unchanged. Acceptance checkboxes and status remain
open: desktop checks do not establish actual agent reanalysis, native execution,
Windows/Electron, generated protocol or real-data eligibility. Twenty-eight native
retained-child lifecycle cases and OS-lease fixtures are authored but unrun;
Cargo is absent. Unknown-turn/source-reference fault-injection integration
fixtures are authored with no-dispatch/no-rotation assertions, but unrun. No generated artifact was hand edited and no
provider request, organization approval or eligibility promotion occurred.

### Review-loop-1 implementation handoff

Corrected operation settlement/recovery, independent Stop, warm-runtime configuration,
canonical paginated result lineage and shared lightweight background observation are
authored. Populated provenance and 28 both-binding native lifecycle fixtures are
authored, not executed. Desktop build/typechecks and 280 focused tests pass; final full
suite has 1,447 passes, 2 existing Git/generated assertions failing, 5 skips and nine
missing-native collection failures. Cargo/native/Windows/provider/protocol gates remain
open. Exact evidence and the sequential-execution deviation are recorded in
`story-1-29-lifecycle-support.md`; no product acceptance or eligibility promotion.

### Review-loop-2 implementation handoff

All loop-2 corrections are authored, retaining loop-1 functionality. Source writers
were strictly sequential. Provider-independent bounded cancellation, final-await
incarnation fences, retriable terminal settlement, selected observation capacity,
revision-aware canonical reuse and snapshot-bound accessible current/history pages
are integrated. Both-binding retained-child endpoint continuity and readiness-outage
Stop fixtures bring required native lifecycle selection to 32; all remain unrun.
Both desktop typechecks/build and 290 focused tests pass. Full suite: 1,462 pass,
2 existing Git/generated assertion failures, 5 skips, plus 9 missing-native
collection failures. Cargo commands and protocol generation remain blocked as
recorded in `validation/story129-loop2/` and `story-1-29-lifecycle-support.md`.
No frozen intent, product acceptance checkbox or real-data eligibility changed.
The integrated source candidate is frozen for the next independent review layers.

### Final localized-patch verification and presentation

All accepted round-3 patch findings are implemented; R3-B4 and R3-B10 remain
explicitly deferred as recorded above. Final independent execution after source
freeze: both desktop TypeScript checks and build passed; 12 focused files / 406
tests passed. Full suite exited 1: 59 files passed, 10 failed, 1 skipped; 1,465
tests passed, 2 failed, 5 skipped. Nine files could not collect without the native
binary; two schema assertions fail on absent Git metadata and the transported
generated-file subset (48 versus 816). These failures are not waived as passes.
Thirty-six native lifecycle cases are authored but unrun; native compilation,
protocol generation, Windows/Electron and actual provider/auditor acceptance remain
open. There are no known unresolved confirmed high-impact functional findings,
but uncompiled native source remains a high-impact verification uncertainty.

The BMAD presentation instruction to mark done is deliberately not applied: the
owner requires open acceptance gates and in-progress status to remain visible.
No local commit is possible in this NO_VCS snapshot; no push is authorized yet.
