# Visual-conversation source investigation, 2026-11-05

Status: source investigation only. No build, test, Electron launch, application edit, install or download performed. Root cause is not established. Preserve the current probe assertions and time limits.

## Exact failure boundary
- desktop/src/main/smoke-probe.ts:4223 short-circuits two operations into "Held synthetic turn did not render before Stop": sendFollowup can fail before a dispatch, or waitAnswer can fail after clicking Send. The error alone does not establish a streaming defect.
- sendFollowup (:4200-4206) waits for completed controls, types the request, then waits for enabled Send. It returns true immediately after click, without establishing admission.
- waitAnswer (:4120-4123) requires exact answer text on a rendered agent row, within POLICY_SETTLE_MS=20000 (:2880). It does not require completed status for the held turn.
- The immediately preceding step switches the same Task to the exact Sol binding (:4213-4221). Earlier follow-up does not change model.
- run-seeded-smoke.cjs:56-63,80-85 sends one full message delta and deliberately withholds item/response completion for the third request; cancellation must close the connection before its 30-second safety timer. This is native synthetic transport evidence, not real-provider behavior.

## Concrete candidate race to falsify
RouteService emits taskChanged inside selectModelNow (desktop/src/main/routes/service.ts:153), before its surrounding modelMutation deletes the pending operation (:40-47). The event invokes model-picker load (:50-66 of renderer/Shell/ConversationModelPicker.tsx), which can retain a pending select and disable Send via TaskLifecycle.tsx:69,75. It does not poll for journal clearance. Normal picker-initiated selection runs a completion reload (:99); the smoke's direct-bridge selection does not.

A reader observing the journal between notification and settlement could remain pending after a successful bridge operation. This is a source-level interleaving hypothesis, NOT an observed Electron reproduction. Main-process microtask/IPC ordering might rule it out in the actual smoke, so do not patch based on this alone.

A detached composer-node hypothesis is weaker: sendFollowup captures its controls element once, but task-specific model invalidation does not normally remount it. Shell.tsx:698 keys it by runtimeEpoch and Task; runtimeEpoch changes on session loss (:464-470), not this task-specific route event.

## Streaming and grouping trace
- task-observation.ts:14 only fast-refreshes a selected snapshot already known to be nonterminal. Completed-to-running initially uses the 250ms dirty lane (:39), then live updates use 120ms scheduling (:41-45). Interval polling remains 1500ms.
- In-flight invalidations retain dirty=true and reschedule after completion (:18,28). No obvious lost-notification path explains 20 seconds of invisibility by itself.
- Full-read errors clear protected content, then obtain status-only fallback (:20-27). Inspect diagnostic stages rather than preserving stale payload or loosening fences.
- Native tasks_progress reconstructs from canonical live messages (:4014-4056 in request_processors/inquello_tasks.rs) and rejects snapshots if live/durable revision changes at intermediate/final fences (:4323-4339,4401-4429). A single held delta should eventually stabilize; repeated stale_snapshot failures require evidence.
- ConversationItems.tsx:90-106 leaves message-only turns as visible rows. The fixture emits no action items. Grouping cannot explain hidden held text unless the actual snapshot contains additional non-message items spanning that message. Finished activity-group heading is the approved layout and must remain.
- live-conversation.test.tsx uses already-running immediate mock snapshots; it does not cover completed -> exact model switch -> resume admission -> held native text.

## Reproduction and regression plan after coordinated baseline
1. Run unchanged full smoke first. Preserve fixture state and native/main diagnostics. On failure distinguish controls readiness, enabled Send, click, lifecycle receipt/admission, fixture calls=3, native live text, authorized progress text, and exact rendered visible text. Record IDs/status/lengths only where sufficient; no secrets or environment dumps.
2. If fixture calls remains 2, inspect model pending journal and lifecycle refusal before investigating streaming. Add deterministic journal/event-order regression with an existing mounted picker and externally initiated select. Assert settled selection leaves Send usable without repeated selection.
3. If calls=3, capture authorized progress and fallback/error stages while held. Assert the held text renders before completion, remains visible, and actual Stop yields cancelled + explicit Resume, retaining same Task/thread and new run identity.
4. Add deferred-read observer regression: invalidate during old completed read, start new run while read is pending, release old snapshot, then stream held text. Assert no stale run resurrection and eventual new text, same fences and time bounds.
5. Re-run affected tests, full suite, and full smoke before any push. Visual-only rerun is diagnostic, never replacement for failed full smoke. Real-model streaming, Windows read latency and accessibility remain separate acceptance boundaries.


## Current Windows baseline evidence, 15:32 UTC
The unchanged full seeded smoke finished exit1. Quota passed; normal exceeded its600s deadline during tool-bounds. Visual failed earlier than the Linux symptom with `Completed conversation follow-up did not render`. Its fixture state was calls2, bCalls1, totalCalls3, invalidCalls0, contextMatches[true,true]. Thus the second A-conversation request was actually admitted with the expected retained context; this observed failure is NOT the proposed later model-selection pending-journal race. No held third A turn or Stop/Resume was reached.

Evidence: full log `seeded-smoke-baseline-docker-electron-restored.log`; phase folder `D:\Inquello\tmp\inquello-seeded-smoke-9IekDn\visual`; stdout contains the exact failure and runtime stderr diagnostic tail, while synthetic-journey-state.json records fixture acceptance. A fresh Windows screenshot failure-synthetic.png shows first answer plus the second user request, sidebar Running and Stop, no second answer. Initial/model-B/reopened-A screenshots and composer geometry checks were recorded; initial completed screenshot inspected. Native progress reports include `saved-read seal: VersionChanged` and `progress-read gate: BeforeCache/snapshot`, which are clues, not a root cause.

Both Electron/runtime cleanup and topology cleanup completed. There is no active test/build. No application source/lockfile change occurred before this baseline. The driver helper `run-docker-verification.cjs` supports an isolated visual diagnostic via the private ownership receipt at `D:\Inquello\tmp\epic1-pg-20261105-d778fa3f\ownership.json` and a unique log tag. It validates the exact owned cached Docker fixture and does not print credentials. Do not read or print password files. Never run concurrent Vitest. This diagnostic does not replace the required full-suite/full-smoke acceptance.
