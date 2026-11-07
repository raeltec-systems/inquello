---
title: 'Story 1.25: Start a real plain-text private Task on a configured route'
type: 'feature'
created: '2026-10-30'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 4
baseline_commit: 'NO_VCS'
source_commit: 'ec39248123172de735f80515d12e58a123a23a02'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** New thread creates an empty Task; Composer cannot submit. There is no production binding from an Inquello request/creator to an actual retained runtime turn.

**Approach:** Build the real Start-to-Active product experience that an auditor will validate with realistic fictional audit data: explicitly choose a configured, synthetic-approved route and supported settings; submit a plain request through trusted native orchestration; create and bind private work and execute the actual retained runtime. Refusal preserves the draft, never substitutes a route.

## Boundaries & Constraints

**Always:**
- New thread opens a non-persisted Start surface with request focus and “What should we work on?”. Empty/whitespace Send explains why disabled. Preserve IME, Shift+Enter, Escape, navigation drafts and keyboard accessibility. Existing Tasks remain unchanged until a deliberate submission. Files/Methods stay absent or truthfully unavailable until Epic 2.
- The selected candidate route/configuration revision and supported reasoning/speed choices are visible and submitted explicitly with Send, including provider defaults; Send is the normal acceptance action, not a separate test acknowledgment. Never choose the first route or silently fill settings in the service. Read-only candidate preflight creates no Task, thread, provider request or tool effect. Route changes require explicit compatible reconfirmation. Show local execution separately from inference.
- Main supplies current identity/service authority; runtime revalidates actor, Workspace membership/policy, route evidence/configuration, credential generation, settings, classification and required quota after waits and before effects. Unknown refuses. Credential presence is not eligibility. Optional remote capability absence is not a blanket local-dispatch veto.
- One creator-scoped operation binds the exact canonical request, selected configuration and choices to a durable private Task/run/runtime-thread association. Operation reuse with different content conflicts. Preflight refusal creates no Task. After irreversible creation/dispatch, retain recoverable/uncertain state rather than invent rollback or silently repeat. Clear draft only after durable accepted binding is confirmed; lost acknowledgments reconcile the same operation without another turn.
- Use a real retained thread and idle-only first turn; no renderer-supplied thread ownership, fabricated response, unintended steering, preflight model warmup or provider fallback. Trusted context must reach the turn before sampling can start. Every sampling attempt/tool-result continuation rechecks binding, policy, cancellation and limits and records Story 1.24 attribution. No automatic retry of uncertain work. Disable unsupported pre-turn/previous-model/background compaction, memory summarization and warmup for these Tasks unless they use the same authorized exact-route accounting; disclose the limit rather than execute outside binding.
- Bind model-originated permission requests to the real Task/thread and reuse existing bounded rules, sandbox and PermissionMediator. Unknown threads decline; denial runs nothing. Tool content remains untrusted. No decision mutates analytical review/Professional Approval. Preserve provider-secret isolation and private data governance.
- Protect current Task↔thread ownership on retained read/resume/turn/steer/interrupt access; connection subscription alone is not ownership. Store submitted content only within governed private Task/runtime history; operation receipts bind it without leaking it into usage, diagnostics or logs. Logout/runtime loss/revocation suppress stale results and subsequent effects.
- Owner decision (2026-10-30): use realistic fictional audit records and natural audit questions, with the normal product experience. No synthetic/test banners, content-classification checkboxes or extra test acknowledgments. Control the authorized test identity/Workspace/runtime/data environment behind the scenes through trusted main/native bootstrap, never prompt content or renderer assertions. Reuse the default-off debug fixture build and native connection identity to install an opaque session binding scoped to runtime/principal/Workspace/isolated roots; revoke it on session changes. This is an internal test configuration, not a different mocked product flow. This boundary does not automatically classify arbitrary text or enable real-data use. Outside the configured authorized setup, unknown classification still refuses. No confidential client data or live external-source/connector access is introduced.
- Active shows the accepted request and truthful initial execution/error/uncertain state, not fabricated progress or completed analysis. Prior 1.21–1.24 native/protocol gates remain open. Real-data use stays disabled pending its own evidence/organisational approval.

**Never:** Files, Methods, artifact delivery, sharing, rich progress/result taxonomy (1.26), new steer/resume UI (1.29), silent location/provider fallback, new dependencies or manual generated bindings. No real credentials or paid calls during implementation tests. Actual provider-connected acceptance requires separate explicit authorization and cannot be replaced by fixture success.

## I/O & Edge-Case Matrix

| Scenario | Input / state | Expected behavior | Failure handling |
|---|---|---|---|
| Start | New thread; empty request | Focus prompt; explained disabled Send | Keep memory-only draft |
| Submit | Explicit current route/settings and permitted synthetic request | Private Task, real bound thread/turn, Active | Clear only after durable confirmation |
| Refusal | Missing identity/route/proof/policy/quota | Name dependency; no unapproved work/fallback | Preserve draft and mark stale choices |
| Duplicate | Same operation; changed command | Reconcile same accepted work; reject mismatch | No second Task/turn/provider retry |
| Race | Logout, credential/route/policy change during wait | Refuse/cancel before next protected effect | Suppress stale disclosure; retain uncertainty |
| Tools | Model action needs permission or is forbidden | Same bounded permission/sandbox path | Denial performs nothing |
| Optional remote | Remote integration unavailable; local selected dependencies valid | Local execution remains possible | Name only applicable blocker |

</frozen-after-approval>

## Code Map

- `desktop/src/renderer/Shell/{Shell,Composer,TaskView,drafts}.tsx|ts`, new `StartView.tsx` and start bridge -- replace empty-Task New thread, preserve draft semantics and truthful Active binding. Reuse route/settings controls, not renderer RPC choreography.
- `desktop/src/main/{organise,routes,usage,policy}/`, `main.ts`, `security/operations.ts`, `preload/preload.ts`, new `main/tasks/` -- scoped preflight/start/reconciliation commands and real thread escalation mapping; no generic host bridge.
- `engine/codex-rs/inquello-domain/src/{organise,routes,usage}/`, `inquello-adapters/src/` and next additive migration -- creator-scoped intent receipts and immutable runtime associations. Existing `attach_thread` printable-string validation is insufficient ownership proof.
- `app-server/src/request_processors/{inquello_processor,thread_processor,turn_processor,inquello_usage}.rs`, protocol common/v2 and new Task coordinator -- reuse real thread creation; suppress startup prewarming/fallback; avoid `start_or_steer_turn` for initial submission.
- `core/src/tools/registry.rs::dispatch_any_with_state` -- authorize final rewritten tool arguments before `handle_any_tool`; retain sandbox/orchestrator checks on retries. Unknown non-command tools stay unavailable, not implicitly allowed.
- `core/src/{codex_thread,inquello_inference,client}.rs`, `core/src/session/turn.rs` -- `start_turn_if_idle` plus trusted `WithTurnExtensionData`; derive actual turn/attempt context before each stream, not after submission returns. Inquello-owned Responses must not bypass binding.
- Existing capability register, `data-policy.json`, `FORK-CUT.md`, tests/smoke -- preserve enablement/data ownership; record source compatibility and unmet acceptance gates.

## Tasks & Acceptance

**Execution:**
- [ ] `engine/codex-rs/inquello-domain/src/tasks/mod.rs`, `inquello-adapters/src/tasks.rs`, `migrations/0009_task_runs.sql` and crate roots -- atomic request identity, Task/thread binding and duplicate/crash reconciliation tests.
- [ ] `app-server/src/request_processors/inquello_tasks.rs`, retained thread/turn processors, core turn/client hooks and app-server protocol common/v2 -- preflight, accepted real turn, bounded continuation/tool mediation, quota/usage and ownership guards.
- [ ] `desktop/src/main/tasks/`, `security/operations.ts`, `preload/preload.ts`, `Shell/{StartView,Shell,Composer,TaskView}.tsx` -- explicit route/settings flow, safe draft lifecycle and named operations.
- [ ] `inquello-adapters/tests/task_runs.rs`, app-server/core Task tests, `desktop/test/tasks-*.test.*`, existing Composer/Shell tests and `smoke-probe.ts` -- matrix rows, actual child-thread binding and production permission paths; distinguish fixtures from actual provider acceptance.
- [ ] `desktop/data-policy.json`, capability evidence, `FORK-CUT.md`, implementation spec and `sprint-status.yaml` -- preserve open gates and source-owned eligibility.

**Acceptance Criteria:**
- Given New thread, when Start renders, then request focus/prompt/disabled-empty explanation and unavailable later inputs satisfy AC 1.25.1.
- Given authorized synthetic input and a current synthetic-approved route, when submitted, then real private Task/thread/request/actor binding opens Active without fallback (AC 1.25.2).
- Given optional remote absence, when selected local/inference dependencies remain available, then no unrelated capability blocks execution; no offline inference promise (AC 1.25.3).

## Design Notes

Single user goal, with coordinated persistence/native/UI boundaries; splitting them leaves unsafe or nonfunctional submission. Additive storage and possible model/tool side effects make this dispatch work, not a mechanical patch. Architecture investigations restored and hash-verified missing native sources at the pinned commit. The owner chose an authentic normal experience over realistic fictional audit data; classification authorization stays an internal test-environment control, not product branding or an automatic content-detection claim.

## Realistic acceptance scenario

The plain-text request contains a procurement register with row IDs, vendor IDs, invoice references, dates, PO references, amounts and approval references. Ask the agent to reconcile duplicates and approval-policy exceptions and cite the affected rows. Example fixtures: R01/R03 repeat the same vendor/invoice/date/12,500 amount; R02 is 22,500 with a missing required approval; R04/R05 are same-vendor/same-day purchases of 9,000 each under an explicitly stated aggregate 15,000 approval threshold. Expected review checks are the duplicate pair, missing approval, and 18,000 aggregate exception—with evidence and appropriate uncertainty, not unsupported fraud conclusions. Inputs remain plain text: no early attachments or Method feature. Deterministic fixtures verify wiring; the local end-to-end product-validation session must also run actual inference and assess useful, accurate audit outputs against these expected findings. Fictional records make that validation safe; they do not make it less real or reduce it to technical smoke tests.

## Epic 1 product-validation continuity

At the end of Epic 1, run one auditor-oriented end-to-end session on the owner's local machine using representative fictional procurement, inventory and vendor-management cases. Judge the approved Epic 1 experience and acceptance criteria: start useful work, see accurate evidence-linked findings, control permissions, understand failures, steer/stop/recover and reopen permitted private work. Record expected outcomes, observed behavior, evidence and pass/fail for each capability, including privacy/denial cases. Carry a cumulative ledger of authored features, executed automated checks and owner-run gates across 1.25–1.30. An unrun gate is pending, not failed product validation or a pass. Broader production rollout/compliance is separate from this genuine product-validation goal.

## Implementation Notes

Implemented the in-memory Start UI, explicit route/revision/settings submission, trusted main/native authority bridge, atomic creator-private request/Task/run binding, reserved retained-thread idle-only turn, and same-operation uncertain reconciliation. Native per-attempt/per-tool checks revalidate service and native policy, current identity, configuration, credentials and quota. Owned-thread history is guarded; background inference, retries/fallback, unbound warmup and unsupported tool forms fail closed. Private Tasks explicitly use the local environment, Task-root-only workspace roots and isolated extension scope, never an inherited remote default.

Added domain/adapter/coordinator/core test source, renderer/main tests, seeded Electron Start probe, and the actual retained-child fixture `real_private_task_retained_thread_denial_and_lost_ack_reconcile_without_second_turn`. The debug-only private-stdio fixture transport is session-bound, loopback TLS pinned, synthetic-key-only, refuses existing credentials, and cannot fall through to production. It uses normal preflight/start, real retained thread/turn, native model-originated permission denial, duplicate/conflict/lost-ack reconciliation and usage attribution. Authored is not executed.

Prerequisite metadata repair: declared the already-existing workspace `serde` dependency directly in `inquello-adapters`, whose existing usage source imports it. No new library, version or lockfile was invented. Missing directly affected native sources were restored only from the pinned source commit and verified against manifest Git blob hashes. Generated protocol files remain untouched; matching native regeneration is still required.

Governance/support: canonical request stays in creator-private history; run receipts reference it without copying text. The internal fictional-session marker is governed with excluded, nonportable installation metadata. Updated FORK-CUT, capability limitations and `story-1-25-start-support.md`. No eligibility promotion, provider call, real-data use or completed acceptance is claimed.

Owner approved the full specification at 18:56 UTC and reconfirmed at 18:59 UTC on 2026-10-30. Implementation must preserve the planned design system and judge success by usable auditor outcomes, robust backend wiring and the normal user experience, not tests alone. Native compilation and actual provider acceptance remain separately recorded gates when unavailable.

## Spec Change Log

### Round 4 actual pinned command-handler correction

R4-N1 is verified against pinned `ec392481`: `core/src/tools/spec_plan.rs:1242–1273` registers `ExecCommandHandler::one_shot` when UnifiedExec is false; `handlers/unified_exec/exec_command.rs:112–115` calls it `exec_command`; `handlers/shell_spec.rs` requires string `cmd`. The legacy array-form `shell` is absent, and registry filtering excludes the actual handler. This is a known product blocker, not an unrun-test disclaimer. The earlier non-frozen shell-only/array mapping assumptions are superseded by this source-verified correction; frozen intent is unchanged.

KEEP all round-4 working product and localized patches in `/workspace/shared/inquello-story125-round4-preserve`. Restore ONLY product files under desktop/engine, never older specs/workflow/triage. Product edits have been reverted to verified baseline for sequential re-derivation. Retain stdio bootstrap restrictions, hook sentinel regression, deletion disclosure, cancellation cleanup, fresh post-wait guards, queued accounting and draft preservation.

Integrate the actual one-shot `exec_command` handler and schema. Do not merely rename the allowlist or split shell text heuristically. Authorize the exact final native-resolved argv and working directory used by the handler, after its native shell/argument resolution and before any process or alternate interception effect. Trace existing native command parsing, rewrite/interception, approval, process lifetime and cleanup first. Preserve current bounded command rules, per-command PermissionMediator/consumption, current owner/policy/route/quota rechecks, Task-root local sandbox and no implicit elevation/remote/TTY/persistent session. Unknown or unsupported argument forms must refuse, not escape the bound route. One deliberate consumed permission must correspond to one authorized command attempt; avoid duplicate independent prompts, but never skip existing sandbox/elevation restrictions or reuse a grant for changed argv/cwd/retry. Carry current authority cancellation into the actual one-shot handler/process and await cleanup. No new dependency or external credentials.

Update the retained runtime fixture to emit the actual tool name and its actual schema, using realistic bounded allowed/denied actions; assert one permission consumption, one actual Task-root effect, denied action absent, revoked running process cannot produce delayed effects, configured hooks remain suppressed, no unauthorized second attempt, and exact usage attribution. Native sources are not proof of execution; keep Cargo/protocol/Electron/real-provider gates explicitly open. Read directly affected pinned callers and test constructors before authoring tests; read-only hash-verified restoration is permitted when files are absent. Known missing-tool wiring must be fixed before presentation; do not expand unrelated story scope or add later progress/recovery UI.

### Round 3 bounded re-derivation

R3-B5/B6/E1 expose one actual native effect-boundary omission: authorization revocation must propagate into an already-running handler's cancellation token, and fresh authority must be checked after internal approvals/network waits immediately before each process launch/sandbox attempt. Amend only that native integration plan. KEEP all working round-3 features and corrections; positive source is `/workspace/shared/inquello-story125-round3-preserve`. Product edits were reverted to hash-verified baseline. Reuse product files only; NEVER restore the current spec, workflow records or triage from old snapshots. Execute sequentially.

Link Task authorization cancellation and existing invocation cancellation into the handler token; await real handler cleanup rather than merely dropping its future. Dispose any watcher cleanly. Add the fresh current-authority check at ToolOrchestrator::run_attempt after approval/network waits and before tool.run, including retries. Reuse trusted turn authorization; do not grant unsandboxed execution or additional tools. Bound model tools remain shell-only. Author focused real handler cancellation and delayed-approval authority regressions without live credentials/provider calls.

Also carry R3-B7: drain/preserve already received attributable usage/terminal events when cancellation races with accounting; never invent zero final consumption. R3-E2: clear only the actually submitted unchanged draft, preserving newer text edited through shared no-Task navigation; add a mounted regression. R3-V1: add a bound Responses transport fallback case next to the actual existing WebSocket fallback tests, asserting refusal and zero HTTP POSTs; pinned read-only source restoration is permitted, not manual generated edits. Keep native execution gates explicit.

### Round 2 bounded re-derivation

Known-bad states: R2-B2/B9 collapse proven non-dispatch setup failures into uncertainty; R2-B7 reserves after a stale authority observation; R2-B8 refuses later authoritative terminal evidence. Correct only these existing execution-contract boundaries. The positive round-2 snapshot is `/workspace/shared/inquello-story125-round2-preserve`; product changes were reverted to verified pinned sources. KEEP all valid implementation and tests, including the new actual retained terminal observer and allowed permission consumption.

Native reservation must validate current authority after acquiring any SQLite write wait and immediately before commit; rollback on proven pre-effect refusal, and mark only explicit pre-insert/rollback rejections as preEffect. Do not relabel ambiguous storage/commit failure as definitely no work. Keep the domain/adapter boundary decoupled using a bounded validation callback/fence rather than copying main authority into renderer input.

Distinguish persisted setup failure before first-turn submission from ambiguous submission/acknowledgment. Retain its private Task and sanitized bounded failure category (no prompt/tool/error content), preserve the draft, and release the pending-operation lock only on proof no turn was accepted/dispatched. No automatic retry. Permit an actual retained terminal observation for the same immutable bound turn to resolve Uncertain, through an explicit observed-terminal operation rather than relaxing general status mutation or allowing redispatch.

Carry localized patches: R2-B5/E1 close tool accounting on every intervening cancellation/notification exit before handler entry; R2-B6 constrain shell arguments to exactly supported execution fields and the actual Task-root working directory (reject unknown/elevation/redirection fields, no guessed shell semantics); R2-E2 annotate proven pre-effect reservation refusal; R2-E3 restore the original Workspace before displaying accepted Task; R2-V1 author actual retained-child failure-before-sampling and interrupt-between-attempts tests asserting durable status and real turn identity. Add focused regressions. Preserve native/runtime validation gates honestly.

### Round 1 bounded re-derivation

Trigger B8: provider attempt termination is not the retained turn lifecycle. Amend the native coordinator/core plan to bind durable run termination to actual turn completion, cancellation and failure independently of sampling receivers. Cover failure before the first attempt and between attempts; never overwrite a terminal record or infer success from missing events. Keep usage terminal accounting separate from durable Task run completion.

KEEP: preserve the working Start surface and design tokens, explicit route/settings acceptance, exact request/private atomic journal, no duplicate dispatch, native ownership/per-effect authorization, no fallback/unguarded tools, and all existing verification. The positive source snapshot is `/workspace/shared/inquello-story125-round1-preserve`; product edits were reverted to the pinned baseline before this re-derivation. Reuse the correct portions, but do not restore the known-bad lifecycle/accounting paths unchanged.

Also carry the verified local corrections B6/B7/B9/B10/E1/E2/V1: finalize every persisted but undispatched attempt on setup/authorization failure; reauthorize disclosure after the private request read; register reconciled accepted bindings identically to normal acknowledgement; validate text bounds/controls before retaining an operation and safely handle explicit pre-effect refusals despite route-generation changes; add real PolicyService permission-consumption tests plus allowed one-use native fixture evidence. No new product scope or changes to frozen intent.

## Review Triage Log

### Round 3

| ID | Verdict | Evidence | Route |
|---|---|---|---|
| R3-B1 | false | Carried B2/R2-B1: no automatic replay; restart discovery is later recovery scope. | reject |
| R3-B2 | false | Old-runtime rows are explicitly projected uncertain and cannot redispatch; integrating restart recovery is the later recovery scope, not claimed complete here. No false-running UI was shown. | reject; retain 1.29 dependency |
| R3-B3 | false | Carried B4/R2-B3: the wording is initial acceptance, not live progress. | reject |
| R3-B4 | false | Carried B3/R2-B4: no loaded historical request claim; later authorized reopen remains separate. | reject |
| R3-B5 | high | Registry checks Task revocation before entry but passes the original invocation token to the handler; Task revocation cannot cancel a running command. | bad_spec |
| R3-B6 | high | ToolOrchestrator::run_attempt awaits approvals/network setup after the registry guard and calls tool.run without a fresh Task authority check. Same required per-effect boundary is missing immediately before process launch/retry. | bad_spec; group B5 |
| R3-B7 | medium | record_attempt biased cancellation can discard already queued usage and terminal evidence. Preserve received accounting rather than treating cancellation as zero or overriding known completion. | patch |
| R3-B8 | false | Current desktop onNotification does not forward private turn output to the renderer; sign-out suppresses the private snapshot, and native stream cancellation stops subsequent sampling. No stale private UI disclosure is demonstrated at this slice. Future Story 1.26 forwarding must add an owner/session gate. | reject; explicit 1.26 dependency |
| R3-B9 | low | Process-lifetime 10,000 ID fence can exhaust after extreme use, but safely refuses rather than losing ownership. Safe lifecycle reclamation would add complexity; ordinary per-process usage is unlikely to hit it. | reject low-frequency complexity |
| R3-B10 | medium | Carried B11: native/protocol/runtime gates are real and unrun; explicitly owner-accepted as later validation, not hidden. | defer |
| R3-V1 | medium | Pre-verified gap: unbound Responses fallback tests and Messages-only private fixtures cannot test bound WebSocket fallback refusal. | patch |
| R3-E1 | high | Same verified authority-token/handler cancellation separation as R3-B5. | bad_spec; group B5 |
| R3-E2 | medium | Start and no-Task Composer share a memory draft; delayed acceptance unconditionally clears it even after another Composer edited it. Preserve newer unsent content. | patch |

### Round 2

| ID | Verdict | Evidence | Route |
|---|---|---|---|
| R2-B1 | false | Carried B2: no automatic re-submission; new operation requires deliberate Send, and cross-restart discovery remains later recovery scope. | reject |
| R2-B2 | medium | All post-reservation failures become Uncertain, including demonstrably failed setup before first-turn dispatch; no accepted binding can release the draft. Preserve proven non-dispatch failure separately from ambiguous submission. | bad_spec |
| R2-B3 | false | Carried B4: initial execution accepted is not a live progress claim; live progress belongs to 1.26. | reject |
| R2-B4 | false | Carried B3: retained history reopening is explicitly later scope; clearing private content on invalidation is required. | reject |
| R2-B5 | medium | The notify_tool_start cancellation await lies after persisted before_tool accounting but before after_tool; an early return skips finalization. | patch |
| R2-B6 | medium | Only command argv is authorized, but shell handler receives additional execution fields and requested workdir; approval can name a different cwd than the handler. Bind/constrain actual supported execution fields to the Task root. | patch |
| R2-B7 | medium | The reserve transaction can wait for SQLite write access after the final authority read, then creates private metadata before authority is rechecked. The plan omitted a validation fence at the transaction commit boundary. No provider/tool bypass was shown because later checks refuse, but unauthorized reservation violates the no-work refusal contract. | bad_spec |
| R2-B8 | medium | Uncertain status refuses authoritative retained terminal events after an acknowledgement error. This prevents observed cancellation/completion resolving prior uncertainty; observation must not be confused with redispatch or inferred success. | bad_spec |
| R2-B9 | medium | All post-reservation errors are discarded and replaced by generic uncertainty, hiding known setup/authority/idle failures. Persist bounded sanitized failure categories, not error payloads. | bad_spec; group with R2-B2 |
| R2-B10 | medium | Carried B11 environment gate; the newly authored allowed-action fixture is present but unexecuted. Actual failure/cancellation integration coverage is separately V2. | defer |
| R2-E1 | medium | Same verified cancellation-between-authorization-and-handler exit as R2-B5. | patch; group B5 |
| R2-E2 | medium | Missing placement/revision rejection before insertion is returned without preEffect evidence, locking a draft whose operation does not exist. Ambiguous transaction/commit failures must remain uncertain. | patch |
| R2-E3 | medium | onAccepted selects a Task and loads the original tree but leaves a newly selected Workspace unchanged, mixing navigation context. | patch |
| R2-V1 | medium | Pre-verified gap: helper/store tests bypass production terminal callback and real-child cases only complete successfully; add actual retained pre-sampling failure and interruption assertions. | patch |

### Round 1

Likelihood/impact use 1 low, 2 medium, 3 high, grounded in the stated trigger.

| ID | Verdict | Evidence | Route | L/I |
|---|---|---|---|---|
| B1 | false | No receipt is not proof that an in-flight start cannot still commit; retaining uncertainty is correct. Locally proven pre-dispatch refusals are addressed by E1/E2, not by blindly releasing any not-found response. | reject | 2/2 |
| B2 | false | Reload does not automatically resubmit; a newly entered request requires a new deliberate Send. Cross-restart recovery/discovery belongs to the explicitly excluded later recovery/reopen UI. No same-operation duplicate dispatch was demonstrated. | reject | 2/2 |
| B3 | false | The frozen intent promises initial accepted request/state only and explicitly excludes later reopen/history UI. Existing Tasks truthfully show details are not loaded; no loaded-history claim is made. | reject; track later 1.30 | 2/2 |
| B4 | false | The UI says Initial execution accepted, not a live running/progress assertion. Rich progress/results are explicitly Story 1.26, so no current automatic output claim is violated. | reject; track 1.26 | 2/2 |
| B5 | false | Current-runtime exact ownership is deliberate for the initial execution slice. Reopening earlier-runtime history is excluded until the later authorized recovery/read design; relaxing it now would weaken the ownership boundary. | reject; track 1.30 | 2/2 |
| B6 | medium | begin_usage_attempt precedes final recheck/fixture binding; an error returns without a recorder or finalization, leaving an undispatched attempt open. | patch / preserve in loopback | 2/2 |
| B7 | medium | Local-tool accounting is inserted before final recheck; rejection exits the registry before after_tool, leaving the attempt unfinished. | patch / preserve in loopback | 2/2 |
| B8 | high | Run status is updated only by provider-event receiver or initial start result. A failure before installing the next receiver or cancellation between attempts has no retained-turn terminal observer and can leave Running forever. The non-frozen orchestration plan omitted a terminal lifecycle binding independent of samples. | bad_spec | 2/3 |
| B9 | high | run_response authorizes then awaits private request loading; only actor equality is checked afterward, not current session/disclosure authority. A revocation during that wait can disclose content. | patch / preserve in loopback | 2/3 |
| B10 | medium | reconcile returns an accepted binding without trustedThreads registration or onAccepted callback; applicableDataTier then differs from normal acknowledgement. | patch / preserve in loopback | 3/2 |
| B11 | medium | Native compile, protocol generation and real-child execution are genuinely unrun, already disclosed and explicitly accepted as owner-run gates. They cannot be claimed as passed desktop evidence. | defer: environment gate | 3/3 |
| E1 | medium | Start sets an operation before IPC validation; oversized/control-character text rejects locally without a durable receipt, yet catch marks uncertainty and locks the draft. | patch / preserve in loopback | 2/2 |
| E2 | medium | Generation mismatch is checked before handling an explicit preEffect refusal, converting proof of no creation into permanent uncertainty. | patch / preserve in loopback | 2/2 |
| E3 | medium | Same verified failure as B6: post-persist authorization/setup failure lacks terminal usage finalization. | patch / grouped with B6 | 2/2 |
| E4 | medium | Same verified failure as B7: post-persist tool authorization failure lacks terminal usage finalization. | patch / grouped with B7 | 2/2 |
| V1 | medium | Verification-gap evidence: existing tests replace askRuntimePermission with a stub and the native fixture only denies. Successful one-use consumption and rejection/expiry/policy-race paths are not exercised. | patch / preserve in loopback | 2/3 |

## Verification

Run supported TypeScript checks, build, focused matrix tests and full desktop suite. Author/run native domain/adapter/coordinator/core tests, real-child isolated fixture and exact request/thread attribution checks; test duplicates, lost acknowledgments, identity/policy races, quota refusal, no prewarm/fallback, model-originated permission and governed retention. Regenerate protocol only with matching native binaries and committed engine tree. Native compilation, seeded Electron and separately authorized real-provider synthetic acceptance remain explicit gates if unavailable. No test result promotes eligibility automatically; do not mark done while acceptance evidence is missing.

### Executed verification — 2026-10-30 implementation handback

- `pnpm exec tsc -p tsconfig.json --noEmit`: passed (including tests).
- `pnpm run build`: passed, including build and renderer TypeScript, data-policy validation and Vite. Five existing unresolved font assets remain runtime warnings.
- Focused Task/security/permission/Composer/Shell/organise matrix: **9 files, 257 tests passed** (`story125-focused-final.log`). Closing Task/data-policy matrix after final governance changes: **4 files, 48 tests passed** (`story125-closing-tests.log`); counts overlap, not additive.
- Final `pnpm test`: **45 files passed, 12 failed, 1 skipped; 1,133 tests passed, 3 failed, 5 skipped** (58 files / 1,141 tests, 71.94s; `story125-full-final.log`). Ten suite-collection failures require missing native app-server/design-import inputs. The three assertions fail on a missing imported Avatar SVG and two protocol stamp checks (snapshot has no Git engine tree and incomplete generated baseline). These are not reported as a green full suite.
- Isolated SQLite migration 1–9 and request immutability checks passed with SQLite 3.53.1. This does not verify Rust transactions or native concurrency.
- Native checks could not execute: `cargo`, `rustc` and `rustfmt` are absent. Native coordinator/core tests and the actual retained-child fixture are **authored, unexecuted**, not acceptance evidence.
- `pnpm generate:protocol` attempted and refused this non-Git snapshot before generation. Requires complete pinned checkout plus matching native generator; generated source was not hand-edited.
- Seeded sandbox-enabled Electron Start probe is authored but unrun (native binary unavailable). Actual provider inference requires separate explicit authorization and owner-local product acceptance. No paid/provider calls were made.

Remaining gates: compile/fmt/check/clippy and native tests with and without fixtures; regenerate and verify protocol with the matching native build; run the real-child race/privacy/permission matrix and seeded Electron UX; separately authorize real-provider fictional auditor acceptance. The story remains **in-progress**, not accepted/done. See `story-1-25-start-support.md` for the cumulative owner-run ledger.

### Round 2 implementation and verification — 2026-10-30

Re-derived B8 at the retained lifecycle boundary: core `Session::send_event` invokes a trusted Task authorization terminal observer for actual `TurnComplete` (including its terminal error) and `TurnAborted` events. This covers failures before any sample and cancellation between continuations. Native provider receivers now finalize usage only; neither provider end-turn nor an empty receiver completes the durable Task run. Existing transactional terminal-state guards reject late Running/uncertain/other-terminal rewrites. Restored `core/src/session/mod.rs` from the pinned source and verified its baseline Git blob `aba497125ce18b608ad2ddeadcd4827ee0214cb5` before editing.

B6/B7 close persisted but undispatched model/tool attempts on final authorization or fixture-setup failure. B9 refreshes disclosure authority again after reading private request history. B10 uses one accepted-binding registration path for normal and reconciled acknowledgments. E1 validates UTF-8 bounds/control characters before allocating a pending renderer operation; E2 handles explicit pre-effect refusal before stale-generation acceptance checks. The positive Start UI, canonical journal, ownership and per-effect boundaries remain preserved.

V1 adds executed tests through real `PolicyService.askRuntimePermission` and `PermissionMediator` (not a stubbed permission method): allowed one-use consumption, deny, expiry, policy race, consume rejection and logout. The retained-child fixture now also authors an allowed action with native permission consumption, rejection of second consumption and bounded file-effect assertion. Native core terminal-event mapping, immutable persistence, and model/tool undispatched-accounting/provider-receiver separation tests were added; these remain unexecuted without Rust.

Executed checks (logs in `desktop/validation/story125-round2-*.log`):
- TypeScript `pnpm exec tsc -p tsconfig.json --noEmit`: passed.
- `pnpm run build`: passed; the same five unresolved imported font warnings remain.
- Focused matrix `vitest run test/tasks-*.test.* test/security.test.ts test/permissions-units.test.ts test/policy-units.test.ts test/composer.test.tsx test/shell-layout.test.tsx test/organise-shell.test.tsx`: **10 files / 295 tests passed**.
- Full `pnpm test`: **46 files passed, 12 failed, 1 skipped; 1,143 tests passed, 3 failed, 5 skipped** (59 files / 1,151 tests, 73.70s). Same missing native/design inputs and baseline protocol/Git stamp failures; not a green full suite.
- SQLite 3.53.1 migration 1–9 application passed; not native transaction/concurrency evidence.
- `pnpm generate:protocol`: attempted; refused non-Git snapshot before generation. Generated bindings remain untouched.
- `cargo`, `rustc`, `rustfmt` remain unavailable; native compilation/tests, retained-child deny/allow fixtures, sandbox-enabled Electron and separately authorized provider-connected fictional auditor acceptance remain pending.

Status remains **in-progress**. No provider call, paid call, eligibility promotion, real-data approval or owner acceptance is claimed.

### Round 3 bounded implementation and verification — 2026-10-30

R2-B2/B9: a durable `setup-failed` receipt records only a bounded enum (authority unavailable, thread setup failed, or idle refusal) when the coordinator proves first-turn submission never occurred. Private metadata and request history remain retained, while Start preserves an editable draft, releases the pending operation, and requires deliberate route/settings reconfirmation. Entering submission makes an error uncertain; no automatic repeat is introduced.

R2-B7/E2: reservation accepts a domain-decoupled async validation fence, called after acquiring SQLite write access and immediately before commit. Native refreshes current service/native authority, identity/session, credentials and quota. Explicit pre-insert rejection or successful rollback carries pre-effect evidence; storage/commit failures remain ambiguous. Adapter regressions cover a blocked writer with revoked authority, pre-commit rollback, immutable setup failure and exact terminal observation.

R2-B8: the actual retained lifecycle callback uses a separate observed-terminal store operation, matching runtime/thread/immutable turn. It can resolve uncertainty but cannot redispatch or overwrite a different terminal state. R2-B5/E1 finalize accounting on notification cancellation and the final pre-handler cancellation exit. R2-B6 permits only exact shell argv and optional matching Task-root `workdir`; unknown, elevation, environment, redirection and unsupported execution fields refuse. R2-E3 restores the originating Workspace before accepted Task selection; a mounted navigation-race regression verifies it.

R2-V1 adds actual retained-child pre-sampling failure and interruption at model-originated approval between attempts, asserting the durable Task journal's actual thread/turn and terminal status, bounded provider counts, no tool effect and no duplicate dispatch. The pre-sampling failure injection is confined to the already default-off debug native fixture transport. These native scenarios are authored, not executed.

Executed checks are recorded in `desktop/validation/story125-round3-*.log`: TypeScript and build passed (same five font warnings); focused matrix passed **10 files / 298 tests**. Full suite before the final additional navigation regression: **46 files passed, 12 failed, 1 skipped; 1,145 tests passed, 3 failed, 5 skipped** (59 files / 1,153 tests, 98.91s). Failures remain missing native/design inputs and baseline protocol/Git stamps; this is not a green full suite. The additional mounted navigation regression separately passed **1 file / 10 tests**. SQLite 3.53.1 applied migrations 1–9; that is not native transaction evidence. Protocol generation again refused the non-Git snapshot without editing generated source.

Rust tools remain absent: compile/fmt/check/clippy, native adapter/core/coordinator tests, actual retained-child fixtures and seeded Electron remain unexecuted. Separately authorized provider-connected fictional auditor acceptance is still pending. No provider/paid call, new dependency, eligibility promotion or real-data approval. Story remains **in-progress**.

### Round 4 bounded implementation and verification — 2026-10-30

R3-B5/B6/E1: restored only the preserved round-3 product files. A private handler
receives a child of the original invocation cancellation token. Authority
revocation cancels that child and awaits the same real handler future through
cleanup; no watcher survives it. `ToolOrchestrator::run_attempt` refreshes trusted
Task authority and required limits after approval/network waits and immediately
before `tool.run`, including retry attempts. Existing sandbox/network cleanup
remains in place; no additional tool or unsandboxed grant is introduced.

R3-B7: cancellation closes and drains already accepted usage events before
finalization. Queued cumulative consumption and terminal evidence are retained,
not replaced by a cancelled/zero result. R3-E2: accepted Start clears only the
unchanged submitted memory draft, using a live-store comparison; newer shared
no-Task text survives navigation and delayed acceptance. The mounted regression
covers returning to New thread after that race.

R3-V1: the actual Responses WebSocket suite now authors a bound 426 refusal with
one WebSocket GET and zero HTTP POSTs. Native regressions also author real child
cleanup through registry dispatch with authority-only cancellation, a delayed
approval-completion gate before production initial/retry `run_attempt`, actual
retained-shell interruption before a delayed second file effect, and queued
usage/completion cancellation races. These are **authored, unexecuted**, not
native acceptance. The post-approval unit gate models the wait rather than
claiming a full approval UI/native integration run.

Final executed checks (`desktop/validation/story125-round4-*-final.log`):
TypeScript and build passed (same five font warnings); focused matrix **10 files /
299 tests passed**. Full suite **46 files passed, 12 failed, 1 skipped; 1,147 tests
passed, 3 failed, 5 skipped** (59 files / 1,155 tests, 85.82s). Ten collection
failures still require missing native/design inputs; assertions still fail on the
missing imported Avatar SVG and two baseline protocol/Git stamps. Not a green
full suite. SQLite 3.53.1 applied migrations 1–9; not Rust concurrency evidence.
Protocol generation again refused the non-Git snapshot; generated source remains
baseline, not hand-edited.

Pinned native regression scaffolding was restored and Git-blob verified as
recorded in FORK-CUT. `cargo`, `rustc` and `rustfmt` remain absent. Native build,
fmt/check/clippy/tests, actual retained-child fixtures, seeded sandbox-enabled
Electron and separately authorized provider-connected fictional auditor acceptance
remain pending. No new dependencies, provider/paid calls, tool grants, eligibility
promotion or real-data approval. The story and sprint entry remain **in-progress**.

### Round 4 final review triage

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| R4-B1 | false | Carried R2-B1/R3-B1: no automatic resend is implemented; restart discovery remains the later recovery slice. | reject |
| R4-B2 | false | Carried R3-B3: Active explicitly presents initial acceptance, not continuously updated execution progress; 1.26 owns that surface. | reject |
| R4-B3 | false | Carried R3-B4: authorized historical reopening is later scope; invalidation deliberately clears private renderer text. | reject |
| R4-B4 | false | Carried original retained-runtime read finding: current slice refuses old-runtime access rather than claiming recovery; no ownership relaxation is justified before the later recovery binding. | reject |
| R4-B5 | medium | Working-store recovery text discloses retained submitted requests, but the separate Task history deletion notice does not warn about the remaining copy. A direct wording correction is required. | patch |
| R4-B6 | low | Carried R3-B9: process-lifetime 10,000 ownership registration fence fails closed; safe reclamation adds lifecycle complexity for an unlikely per-process limit. | reject low-frequency complexity |
| R4-B8 | maybe-false | The new unit regression checks the production post-wait boundary but does not execute real approval/network waits. No bypass of the fresh guard is demonstrated; complete native integration execution must settle this. | defer; unverified medium |
| R4-B9 | false | The actual retained-child running-shell delayed-effect fixture is present at inquello_messages_runtime.rs, in addition to the registry real-child cleanup test. Its execution is explicitly pending, not claimed. | reject claimed missing source; retain execution gate |
| R4-B10 | medium | Carried native/protocol/runtime verification gate; owner explicitly accepts later local execution, not a completed integration claim. | defer |
| R4-E1 | high | tasks/bootstrap lacks the adjacent private stdio transport/origin guard and can install SessionBinding from another initialized connection in the debug setup. The existing known transport state supports a direct early restriction. | patch |
| R4-V1 | medium | Verified regression gap: configured hooks are absent from retained fixtures, so hook suppression mutations would escape tests. Add bounded sentinel hooks to the retained allowed-action fixture. | patch |


| R4-B7 | false | Retracted double-prompt hypothesis: actual native command tool is excluded before reaching that path. The distinct verified integration failure is R4-N1 below. | reject specific hypothesis |
| R4-N1 | high | Pinned spec_plan registers ExecCommandHandler::one_shot when UnifiedExec is disabled; it is named exec_command with string cmd. Private allowlist/guard admits only nonexistent legacy shell, so permitted real command execution cannot work. | bad_spec |

### Round 5 actual pinned command integration — 2026-10-30

Restored only preserved desktop/engine product files. R4-N1 now uses the actual
`ExecCommandHandler::private_one_shot`, `exec_command` name and string `cmd`
schema. The native handler constrains execution fields, forces non-login local
one-shot execution at the Task root, and disables alternate patch interception
and implicit skill effects. Final native-resolved/rewritten argv and cwd are
passed to trusted Task authorization in `UnifiedExecRuntime::run`, not guessed
or split by the coordinator. Snapshot helpers and plugin sidecars are suppressed
for these Tasks. The native forbidden-rule result and sandbox stay effective;
one bounded Task permission is consumed for the actual command without a second
independent native prompt/cache. Sandbox failure does not retry or elevate.

Authority/limits are rechecked after waits and again immediately before native
spawn. Authority cancellation reaches the actual one-shot process. Cancellation
before process-handle publication now awaits the private startup lifecycle, which
terminates the returned process and completes cleanup rather than abandoning the
spawn future. Unbound one-shot cancellation behavior is unchanged. Registry
accounting closes a started command attempt once; schema/permission refusal does
not fabricate a dispatched attempt.

Retained fixtures now emit the real tool/schema and assert advertised `cmd`,
exact final permission argv, one appended Task-root effect, deny/no effect,
consumed permission reuse rejection, no second inference attempt, hook sentinels,
and Task/run usage attribution. An additional actual retained-child fixture
revokes identity while the one-shot command is running and checks no delayed
file effect, no continuation and no stale private read. Native command-resolution
and unsupported-field regressions are authored. These native tests are
**unexecuted**, not provider or native acceptance evidence.

Executed verification (`desktop/validation/story125-round5-*.log`):
- TypeScript and build passed; the same five unresolved imported-font warnings.
- Focused matrix: **10 files / 299 tests passed**.
- Full suite: **46 files passed, 12 failed, 1 skipped; 1,148 tests passed,
  3 failed, 5 skipped** (59 files / 1,156 tests, 148.11 seconds). Ten collection
  failures remain missing native/design inputs; assertions remain the missing
  imported Avatar SVG and two baseline protocol/Git stamps. Not a green suite.
- SQLite 3.53.1 applied migrations 1–9. Not Rust concurrency evidence.
- Protocol generation again refused the non-Git snapshot. All 48 present
  generated files match their pinned baseline Git blobs; no manual generation.

Pinned directly affected handler/runtime/one-shot sources and test constructors
were read and Git-blob verified before restoration. `cargo`, `rustc`, `rustfmt`
remain absent. Native build/fmt/check/clippy/tests, actual retained-child fixtures,
sandbox-enabled Electron, matching native protocol regeneration and separately
authorized real-provider fictional auditor acceptance remain open. No dependency,
provider/paid call, real-data eligibility or acceptance promotion. Story and
sprint status remain **in-progress**.

### Round 5 review triage

| Finding | Verdict | Evidence | Route |
|---|---|---|---|
| R5-B1 | medium | Carried R4-B10: native compilation and retained fixtures remain unexecuted, explicitly owner-accepted local validation gates. | defer |
| R5-B2 | medium | Carried native protocol gate: generated source is unchanged, matching native generation is unrun and required before integrated acceptance. | defer |
| R5-B3 | false | Carried R4-B1: no automatic resend; restart discovery is later recovery scope. | reject |
| R5-B4 | false | Carried R4-B3: authorized retained request reopening is later scope; no completed reopen claim. | reject |
| R5-B5 | medium | Delayed acceptance unconditionally switches to its originating Workspace/Task even after deliberate navigation. Retain binding but preserve current navigation unless that Start is still active. | patch |
| R5-B6 | medium | ConsumePermissionParams derives Debug with command text, creating a diagnostic disclosure surface unlike redacted Start types. Replace only Debug and add sentinel regression. | patch |
| R5-B8 | false | Carried R3-B2: old-runtime work projects uncertain and cannot redispatch; later restart recovery integration is not claimed here. | reject |
| R5-B9 | low | Carried R4-B6: 10,000 per-process ownership fence safely refuses; lifecycle reclamation complexity is not warranted for unlikely ordinary use. | reject |
| R5-B10 | false | Generic formatting complaint names no divergent caller or broken invariant. Native formatting is a documented owner-run gate; no speculative refactor is justified. | reject |
| R5-E1 | high | Cached AcceptedRequest fallback is not conditioned on current Workspace membership, so membership removal can leave private text visible. Gate and clear cache/current selection on loss. | patch |
| R5-V1 | medium | Verified gap: running-child tests do not force cancellation between spawn and handle publication. Add a test-only barrier and deterministic native cleanup regression. | patch |

| R5-B7 | medium | Verified bounded writer contention: SQLite busy timeout is 5 seconds, while the two freshness fences can each await a 15-second main authority response plus quota/native-policy work. Under a slow service, unrelated writes can wait or refuse; no authorization bypass is shown. | accepted residual for this candidate per parent risk-prioritization direction; preserve freshness, follow-up budget/cleanup design |

Residual R5-B7: likelihood is conditional (low with responsive local main/service; materially higher during service stalls), impact medium (temporary delay/refusal of concurrent writes, not silent permission grant). A cleanup-aware shared writer-fence deadline or versioned authority design is a separate follow-up; dropping the callback future could leak pending outgoing requests, so no superficial timeout is added. Final integration acceptance must exercise a stalled authority request alongside another writer.

### Round 5 localized patch verification

Patched current-Workspace gating/cache removal for accepted private requests and
preserved user navigation on background acceptance. Added mounted regressions,
redacted permission-consumption Debug with wire-preserving sentinel regression,
and a test-only barrier/regression for cancellation after actual spawn but before
one-shot handle publication. Targeted Shell/organise tests passed **2 files /
39 tests**. The two targeted native tests could not execute (`cargo` absent,
exit 127). No broader suite was run in this localized batch. Source remains
in-progress with native/Electron/provider acceptance gates open. The separately
rated slow-authority SQLite writer-contention residual is unchanged; see support
ledger. These notes supplement, and do not replace, current review triage.

### Final patch disposition

R5-B5/E1 were corrected with Workspace-scoped cached bindings, fresh membership render guards, stale-tree rejection and foreground-only navigation; mounted membership-loss/background-acceptance regressions passed. R5-B6 now redacts permission-consumption Debug without changing serialization; the native sentinel test is authored and attempted, blocked by missing Cargo. R5-V1 adds a per-turn cfg(test)-only barrier between actual spawn and one-shot publication, cancellation-startup ownership assertion and delayed-effect/process cleanup checks; native execution is pending. The final patch diff was read against the preserved reviewed sources. No new production API, persistent grant or execution mode was added.

Workflow completion status is intentionally not promoted to done: owner-directed native/protocol/Electron/provider acceptance gates remain open, and the bounded contention residual is explicitly carried. No publication has occurred in this story.

## Final supported verification — 2026-10-30 21:13 UTC

Independently rerun on the final product sources: `pnpm exec tsc -p tsconfig.build.json --noEmit` passed; `pnpm run build` passed (five existing missing font warnings); focused command `pnpm exec vitest run test/tasks-*.test.* test/security.test.ts test/permissions-units.test.ts test/policy-units.test.ts test/composer.test.tsx test/shell-layout.test.tsx test/organise-shell.test.tsx` passed **10 files / 300 tests**. `pnpm test` returned exit 1: **46 files passed / 12 failed / 1 skipped; 1,149 tests passed / 3 failed / 5 skipped** (90.70 seconds). Failure output identifies nine missing native app-server suite inputs, missing design icons, missing imported Avatar SVG, non-Git engine-stamp lookup and incomplete generated baseline (48 versus 816). This is not a green full suite. Logs: `desktop/validation/story125-final-*.log`. Native patch regressions returned 127 because Cargo is absent; no native acceptance is asserted. Generated sources remain unchanged; no real credentials/provider calls or eligibility promotion.
