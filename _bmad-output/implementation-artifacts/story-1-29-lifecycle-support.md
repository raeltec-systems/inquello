# Story 1.29 — steer, stop and recover retained private work

Status: **in-progress; implementation candidate, not product acceptance** (2026-10-31).
The approved frozen spec is unchanged. Desktop tests are executed evidence of their
bounded seams, not evidence of actual model reanalysis. Native compilation,
Windows/Electron, matching generated protocol and both provider usefulness gates
remain open. No credentials, paid calls, production approval or eligibility
promotion occurred. Independent review belongs to the parent workflow.

## Implemented source

- Domain-owned operation receipts bind principal, Workspace, Task, original
  operation, run, runtime, thread and turn. Transactional fenced reservation and
  one-use claim reconcile duplicates/lost acknowledgements without redispatch.
  Additive migrations 0012/0013 retain prior runs and local runtime-lease lineage;
  provenance checks and Task deletion cover the added Task records.
- Named native `inquello/tasks/steer`, `stop`, `resume`, and
  `lifecycleReconcile` reuse actual core steering/interruption and retained-thread
  loading. Generic private-thread bypasses remain unavailable. Resume checks
  retained turn IDs against durable same-Task/thread lineage, refuses unknown or
  missing context and unsupported source/artifact references, and refreshes
  route/authority/credentials/settings/limits before execution/disclosure.
  Callback writes bind the exact run/runtime; old callbacks cannot complete a
  newer run. The authorization proof suite is v2 and includes resume/lifecycle
  scenarios; old command-only/v1 evidence cannot authorize it.
- Native `std::fs::File::try_lock` holds an exclusive OS lock for the processor
  lifetime, before private dispatch. A non-exported device-local nonce plus
  immutable runtime coverage distinguishes a known predecessor from legacy or
  imported uncertainty. Runtime-ID mismatch and PID checks are not death proof.
  Explicit Resume after proven loss uses the same retained thread, never a new
  replacement. Missing lease coverage refuses unfinished recovery.
- The publisher tells the agent to revise its plan, perform affected reanalysis,
  update/withdraw affected stable finding IDs, preserve unaffected work and
  explain changes; material ambiguity calls for a contextual question. Current
  findings and superseded/withdrawn history have revision/reason/evidence/source
  turn lineage. All analytical claims remain independently unchecked. Admission
  is not adaptation completion; historical checks/signoff are not carried forward.
- Trusted desktop named operations own binding, single-flight and receipt
  reconciliation. The existing Composer offers ordinary corrective text and the
  existing labelled 30px round/9px-square Stop control; Resume is explicit.
  Pending steps remain pending and confirmed effects remain visible. Stop
  submission says stopping, not rollback or completion. Background navigation
  exposes execution/input conditions without focus calls. Drafts use existing
  same-owner Shell memory; no new persistence or attachment route was introduced.

## Localized round-3 review corrections (latest candidate)

The requested patches are integrated without a new public API, persistent drafts,
or broad plan-history pagination. Native and desktop source writers worked
sequentially. Full verification is parent-owned and was not rerun for this patch.

- Publication admission rejects unsupported control characters in `changeReason`;
  focused parser/projection cases preserve supported whitespace and reject controls.
- Selected observation supersedes a stalled background generation using reserved
  capacity while keeping the real outstanding request counted. Old completions
  cannot clear newer tracking. Failed full reads clear protected payload immediately,
  before an authorized lightweight fallback is awaited.
- Result pages fit both evidence-count and payload bounds before optional activity;
  displayed findings retain their cited evidence identities. Oversized evidence is
  explicitly excerpted rather than silently losing citations. Selected current and
  historical pages expose their returned evidence under the same snapshot/run binding.
- The canonical cache still refreshes on retained-output revision, but opaque result
  snapshot identity depends on findings/history and cited evidence, not unrelated
  streaming activity. First-seen revision greater than one marks missing predecessor
  history explicitly without inventing earlier versions.
- The continuity fixture now checks its scenario-specific four-request count.
  New both-binding `progress_cache` cases assert initial same-turn publication,
  original older cited command ID running-to-completed mutation after a newer
  publication, a later same-turn revised publication and stale relevant snapshot
  refusal; unrelated assistant output preserves the analytical snapshot. New
  `stop_inflight_steer` cases withhold a real authority RPC during SQLite writer-held
  validation and issue concurrent Stop, rather than changing an admitted receipt.
  The nonzero platform selector and not-run evidence now require **36** cases.

### Exact targeted verification

From `desktop`:

```sh
pnpm exec vitest run --configLoader runner test/tasks-lifecycle-shell.test.tsx test/tasks-progress-shell.test.tsx test/tasks-lifecycle-native-selection.test.ts
```

**3 files / 64 tests passed**. Log:
`validation/story129-round3-patch/desktop-focused.log`. This covers the edited
observer/page rendering and selection script; it is not native execution.
The selector-only run also passed 2 tests, and static selection matched all 36
required native lifecycle names. From `engine/codex-rs`, the following focused
commands were attempted and each exited **127 (Cargo absent)**:

```sh
cargo test -p inquello-protocol progress
cargo test -p codex-app-server --lib progress_tests
cargo test -p codex-app-server --test inquello_authorization_runtime lifecycle
```

Log: `validation/story129-round3-patch/native-focused.log`. All 36 native cases
remain authored/unrun; Rust compilation, target Windows/Electron, matching protocol
generation and actual provider usefulness remain open. The prior full-suite results
below are historical, not re-executed proof of this patch. No generated file was
hand-edited and no eligibility was promoted.

### Retained review residuals

- **R3-B4, pre-existing plan window:** the Story 1.26 64-step presentation bound
  remains (low likelihood / medium impact). It sets `historyIncomplete`; interruption
  counts are explicitly unknown rather than falsely complete. Broad plan-history
  pagination is intentionally not part of this localized result-lineage patch.
- **R3-B10, unverified IPC reproduction:** an outright bridge rejection before main
  operation registration while controls stay mounted may leave local pending state
  (low likelihood, unverified / medium impact). Ordinary main failures return typed
  results and identity changes unmount controls. A real Electron reproduction is
  still needed; no speculative replay/recovery API or persistent drafts were added.

## Corrected review-loop-2 implementation and verification

This is the latest candidate; historical verification below remains historical.
Frozen intent and all loop-1 corrections are retained. Source writing was strictly
sequential: coordinator KEEP restoration, native changes, desktop changes, native
failed-readiness witness, then coordinator evidence/freeze. Read-only investigation
ran in parallel; no two source writers overlapped in this iteration.

- R2-B1/B8/B9: reserve/claim have a total two-second writer-held authority
  deadline while final authorization stays within the transaction. Dropping a
  timed-out authority RPC removes its pending request. Maintained adapter tests
  hold the actual first/final validation callback while concurrently requesting
  Stop; they do not edit an already admitted receipt. Stop retains current
  principal/Task/run/turn/cancellation authority but bypasses provider discovery,
  candidate capabilities, credentials and inference quota needed for new work.
  Both retained-child bindings include failed preflight while a real shell remains
  live, successful Stop with readiness still unavailable, exact-process termination
  and explicit retained Resume after readiness returns. The denial-only test fault
  is isolated behind inference-fixtures/debug and the authenticated fixture binding.
- R2-B4/E1: main rechecks run incarnation and lifecycle operation after the final
  awaited policy boundary, including failure cleanup; stale snapshots cannot clear
  newer questions. Late Stop/Resume receipts cannot retire or re-register another
  run. Observation coalescing includes run identity. Regression tests hold the real
  final policy promise across Resume rather than modifying already returned data.
- R2-B5/B10/E2: every terminal outcome uses one presentation path. Applying the
  notice/draft settlement once is separate from acknowledging settlement. Only a
  successful acknowledgement marks it settled; subsequent authorized observations
  retry transient failure without dispatching or clearing later edits. In-memory
  operation-ID markers survive component remount, clear on identity change, and
  store no draft text or disk persistence.
- R2-B6/B7: the shared four-read observer reserves selected/full capacity by
  limiting background reads to three and prioritizes invalidations. Native canonical
  state is reused through a maximum four-entry/64 MiB cache keyed by current
  principal/session, run/lineage, policy and retained-output revision. Authorization
  is never cached. Output revision uses the actual UpdatedAtOrdinal store API,
  verified against the exact fork baseline types blob
  `4a55334b105c776ee590c134809c6ecd6534e552`; session/policy/lineage/output changes
  prevent reuse. Cold reconstruction remains bounded at 1,000 pages/64 MiB.
- R2-B3: named progress accepts bounded snapshot-bound current/history offsets
  (maximum 10,000,000); an opaque UUID binds pages to an exact canonical revision.
  Maximum 64 current/128 historical records and serialized byte limits apply per
  page. Exact creation and supersession reasons remain separate. Stale snapshots
  refuse rather than mix versions; accessible first/previous/next controls replace
  bounded slices rather than append indefinitely. Disclosure failure clears page
  content. Counts/next offsets state what remains retrievable independently of
  activity-history completeness.
- R2-V1: both real retained-child progress-continuity fixtures publish before and
  after Resume and assert unaffected first-turn findings, updated current version,
  historical predecessor/source turn and both distinct revision reasons through
  `inquello/tasks/progress`. All 32 lifecycle native selectors are required by the
  nonzero-selection runner on Linux and Windows; authored is not executed.
- R2-B2 remains refuted: no persistent drafts or automatic restart dispatch added.

### Historical loop-2 executed checks

Logs are under `validation/story129-loop2/`. Both TypeScript no-emit checks,
`pnpm run build` and the seven-file focused lifecycle/progress/security run passed
(290 tests). Exact focused command:

```sh
pnpm exec vitest run test/tasks-lifecycle.test.ts test/tasks-lifecycle-shell.test.tsx test/tasks-lifecycle-progress.test.ts test/tasks-lifecycle-native-selection.test.ts test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx test/security.test.ts --configLoader runner
```

`pnpm test` exited 1: 59 files passed, 10 failed, 1 skipped; 1,462 tests
passed, 2 failed, 5 skipped. Nine failed files cannot collect without the matching
native executable. The two assertion failures remain the known transported-checkout
Git/version and generated-file count (48 versus stamped 816) failures in
`transport-and-schema.test.ts`. No new executed assertion failure remains.
`pnpm run generate:protocol` exited 1 at its initial Git status check because this
transported directory has no VCS; no generated output changed.

Required `cargo fmt --all -- --check`, domain/adapters/protocol/core/app-server
commands and fixture build were attempted from `engine/codex-rs`; all exit 127:
Cargo is absent. `node scripts/run-lifecycle-native.cjs` exits 1 with
`spawnSync cargo ENOENT`, not a passing zero-selection run. The 32 native lifecycle
cases, stalled-authority tests, cache/pagination tests and Windows/provider gates
remain unrun. No generated artifact was edited manually. Owner analytical expected
answers and Windows/Electron commands below are unchanged and still required.

Residual risks are qualitative: uncompiled native integration and actual model
correctness remain unknown likelihood/high impact; Windows lock/cancellation behavior
is unknown/high; aggregate native cache/memory/authority latency is possible/medium
until measured on the full supported build. The previous unbounded writer-held
admission and repeated unchanged full scans are corrected in source, not accepted
as deferred defects; execution proof remains open. Already applied/external effects
may outlive interruption (possible/high), so no rollback/global termination claim
is made. All earlier story gates and real-data eligibility restrictions remain.

## Corrected review-loop-1 implementation and verification

The corrected specification remains the source of truth; frozen intent is unchanged.
The preserved candidate was used only as an intermediate starting point, not accepted
unchanged. Corrected areas:

- B1/E1: definitive no-dispatch refusals release trusted pending state, including
  generic native retained-history errors with a parseable pre-effect marker.
- B2/B3/E2/E3: terminal `unresolved` distinguishes unproved historical admission
  from an ongoing operation; exact native user-item `client_id` correlates steering
  to its operation, never its text. Failed runs settle Stop. New instructions not
  dispatched are refused. Explicit verified recovery closes old uncertainty without
  replaying the old operation.
- B4/B6/E4: retained reads bootstrap the current authorized Workspace without starting
  work, coalescing concurrent initialization rather than racing session generation.
  Stop remains independently available during pending steering and bypasses unrelated reconciliation waits; its binding read is lightweight, not dependent on full history. Main retains original
  operation/submitted-text settlement across navigation/session changes and filters by
  current principal; named settlement prevents a later draft being cleared repeatedly.
  Newer edits survive. No renderer runtime-binding surface was added.
- B5: warm Resume waits for shutdown of the exact old runtime, removes that instance,
  rechecks/reloads the same verified retained thread and instantiates fresh effective
  configuration/authorization, rather than inheriting a loaded sandbox.
- B8/B9/B10/B11: admission copy reports guidance received, not completed revision.
  Canonical analytical state is read from existing governed retained storage using
  freshly authorized 100-item pages, independently of bounded visible activity.
  Original revision and later supersession reasons are distinct. Shared observation
  bounds concurrent reads to four; navigation requests lightweight status, while
  selected controls/progress share full history. A full-history failure may fall back only to a freshly authorized lightweight status with incomplete-history disclosure, preserving Stop without stale content. Question reachability/focus remain.
- V1/V2: populated export/inspection positive control and 13 separately corrupted nested
  identities are authored. Windows-native retained-child fixture commands replace the
  Linux-only path. The runner rejects zero/missing/ignored/incomplete selections.

All 28 both-provider native lifecycle fixtures remain **authored, not run**. New cases
cover correlated lost acknowledgements, Stop while steering is uncertain, and warm
policy changes; the latter inspects the exact resumed turn's persisted runtime
TurnContext sandbox, not merely a guard denial. Native unit/adapter coverage also
includes failed Stop, terminal unresolved steering, explicit uncertainty recovery,
prior-operation replay fences, canonical findings beyond 350 activity items, malformed
history cursors and separate revision/supersession reasons.

Final logs: `validation/story129-loop1/` (final full-suite run: `full-final.log`). Commands below run from `desktop/`, except
Cargo commands from `engine/codex-rs/`.

| Command | Corrected-loop actual result |
| --- | --- |
| `pnpm exec tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `pnpm exec tsc -p tsconfig.renderer.json --noEmit` | exit 0 |
| `pnpm run build` | exit 0; both typechecks, data-policy check and Vite build |
| `pnpm exec vitest run --configLoader runner test/tasks-lifecycle.test.ts test/tasks-lifecycle-shell.test.tsx test/tasks-lifecycle-progress.test.ts test/tasks-lifecycle-native-selection.test.ts test/tasks-bootstrap.test.ts test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx test/security.test.ts` | 8 files, **280 tests passed**, no skips |
| `pnpm test` | exit 1: **59 files passed / 10 failed / 1 skipped; 1,447 tests passed / 2 failed / 5 skipped** |
| `cargo fmt --all -- --check` | exit 127: Cargo absent |
| `cargo test -p inquello-domain` | exit 127: Cargo absent |
| `cargo test -p inquello-adapters` | exit 127: Cargo absent |
| `cargo test -p codex-app-server --test inquello_authorization_runtime` | exit 127: Cargo absent |
| `cargo test -p inquello-adapters --test task_runs native_inventory_checks_every_retained_lifecycle_identity` | exit 127: Cargo absent |
| `node scripts/run-lifecycle-native.cjs` | exit 1: `spawnSync cargo ENOENT`; no tests represented as passed |
| `pnpm run generate:protocol` | exit 1: initial Git check fails because transported checkout has no VCS; generated artifacts untouched |

The final full-suite failures are exclusively nine missing-native-binary collection
failures and two transport/schema assertions (absent Git metadata; 48 available
bindings versus the stamped 816). These are not passing native/schema evidence.
Earlier implementation regressions found during development were corrected and rerun.
All earlier Epic 1 open validations remain in the cumulative ledger. Actual model
correctness, Windows/Electron and real-data eligibility are still unproven.

Execution-process deviation: scoped implementation authors initially overlapped,
contrary to the sequential requirement. On clarification all writers stopped; explicit
native-verification-only then final-integration-only handoffs were used, files were
reconciled, and the final checks above rerun. This is recorded, not relabelled as an
entirely sequential execution. The parent workflow owns the three independent review
layers after this implementation handoff.

## Original candidate verification (historical; corrected-loop results below)

Logs: `validation/story129/desktop-{build,focused,full}.log` and `native.log`.
All commands below are from `desktop/` except native commands.

| Command | Actual result |
| --- | --- |
| `pnpm exec tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `pnpm exec tsc -p tsconfig.renderer.json --noEmit` | exit 0 |
| `pnpm run build` | exit 0; typechecks, data-policy validation, Vite |
| `pnpm exec vitest run test/tasks-lifecycle.test.ts test/tasks-lifecycle-shell.test.tsx test/tasks-service.test.ts test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx test/security.test.ts test/data-policy.test.ts test/organise-shell.test.tsx test/shell-layout.test.tsx test/composer.test.tsx --configLoader runner` | 10 files / 368 tests passed |
| `pnpm exec vitest run test/tasks-progress.test.ts test/tasks-lifecycle-progress.test.ts --configLoader runner` | 2 files / 42 tests passed in progress phase |
| `pnpm test` | 58 files passed / 10 failed / 1 skipped; 1,431 tests passed / 2 failed / 5 skipped; exit 1 |
| Required Cargo fmt/domain/adapters/app-server tests and lifecycle commands in `native.log` | exit 127: Cargo absent; no compilation or execution |
| `pnpm run generate:protocol` | exit 1 at initial Git status: transported directory has no VCS; no generated output changed |

Full-suite failures: nine suites cannot collect without the matching native
binary; two actual assertions in transport/schema fail for absent Git metadata
and 48 generated files versus the stamped 816. The baseline was 1,403 passing
with exactly those failures. A Sidebar accessible-name regression exposed by the
first new full run was fixed, not waived; stable link naming plus described
status preserves navigation. Existing pnpm-setting warnings are not failures.
Python SQLite 3.53.1 applied all 13 migrations; guarded rotation, immutable
history/lease rows and Task deletion cascades received auxiliary SQL smoke checks.
These do not substitute for Rust adapter tests or the pinned SQLite build.

## Authored native matrix — all unrun

`app-server/tests/inquello_authorization_runtime.rs` declares 36 lifecycle tests:
`responses_lifecycle_*` and `messages_lifecycle_*`, each with suffixes `steer`,
`stop_resume`, `restart`, `crash`, `revoke_before_resume`,
`revoke_during_resume`, `missing_linkage`, `peer_private`, `cross_company`,
`unknown_turn`, `source_reference`, `steer_lost_ack`, `stop_pending_steer`,
`warm_policy_change`, `progress_continuity`, `stop_provider_unavailable`,
`progress_cache`, `stop_inflight_steer`.
Unknown-turn/source-reference fault-injection cases require the specific retained-context
refusal, no model call, no lifecycle reservation or run rotation and one original Task.
Fault injection SQL was smoke-checked against all 13 migrations without disabling triggers.
They call the actual retained-child fixture driver with isolated synthetic
provider bindings. Common controls cover duplicate/lost acknowledgement
reconciliation, confirmed shell termination, Stop/finish and steer/finish races.
The crash helper kills and waits for the actual child; it is not an operator
eligibility toggle. Unit source additionally covers OS lease subprocess death
and reacquisition, old-guard cancellation, nonportable restore, stale callbacks
and terminal races. See `inquello-lifecycle-evidence-not-run.json` in native test
fixtures; every row is not-run, eligible false, artifact hashes absent.

Restore the complete pinned checkout/toolchain first (the transported test-support
Cargo manifest is absent). From `engine/codex-rs/` run:

```sh
cargo fmt --all -- --check
cargo test -p inquello-domain
cargo test -p inquello-adapters
cargo test -p inquello-protocol progress
cargo test -p codex-core retained_resume_fence_tests -- --nocapture
cargo test -p codex-app-server --lib lifecycle_wire_tests -- --nocapture
cargo test -p codex-app-server --test inquello_authorization_runtime
cargo build -p codex-app-server --features inference-fixtures
INQUELLO_FIXTURE_APP_SERVER_BIN="$PWD/target/debug/codex-app-server" cargo test -p codex-app-server --features inference-fixtures --test inquello_authorization_runtime lifecycle -- --nocapture
```

Expected: all selected tests pass, refusal paths dispatch/disclose nothing, same
operation never dispatches twice, and allowed Resume retains exact Task/thread
identity. Build ordinary CLI/app-server without fixture feature before packaging:
`cargo build -p codex-cli -p codex-app-server`; then in a clean full checkout run
`cd desktop && pnpm run generate:protocol && pnpm run build && pnpm test`.
No fixture executable may be packaged. Do not manually patch generated bindings.

### Windows/Electron gate

The pin documented in FORK-CUT is Rust 1.99.1, which includes the standard File
locking API. Its Windows lifetime semantics are an **unexecuted** assumption
covered by authored cross-platform subprocess tests, not proven by Linux SQL
smoke. On both supported Linux and Windows, from `desktop/` run:

```sh
node scripts/run-lifecycle-native.cjs
```

This builds the exact debug fixture child, rejects missing/empty selections,
requires all 36 named lifecycle tests, then requires every selected test to run
and pass with zero ignored. The native test crate now supports both targets;
Windows uses PowerShell and PID/creation-time observations, not `/bin/sh` or
`/proc`. A Linux-gated zero-test run cannot pass this runner. This command remains
unrun on Windows and blocked by absent Cargo here.

Then use a normal non-fixture binary and `cd desktop; pnpm run build; pnpm exec electron .`
with the approved isolated fictional profile. Check live Stop, crash/relaunch,
explicit same-thread Resume, keyboard/IME, Escape overlay-only behavior, focus
retention, zoom/reduced motion, navigation and input discovery. Expect no automatic
resume, replacement thread or focus steal. Record exact executable hashes,
Windows/Electron versions and observed outcomes; none was run here.

## Owner analytical acceptance — both providers, separately authorized

Paste this fictional register as plain conversation text (no attachments):

| Row | Date | Vendor | Invoice | Amount | Status | PO |
| --- | --- | --- | --- | ---: | --- | --- |
| R1 | 2026-01-10 | A | INV100 | 100 | active | present |
| R2 | 2026-02-10 | B | INV100 | 150 | active | present |
| R3 | 2026-03-10 | A | INV200 | 200 | active | present |
| R4 | 2026-03-12 | A | INV200 | 200 | active | present |
| R5 | 2026-04-15 | C | INV300 | 300 | active | present |
| R6 | 2026-05-20 | A | INV400 | 400 | cancelled | present |
| R7 | 2026-06-02 | A | INV400 | 400 | active | present |
| R8 | 2026-02-20 | D | INV500 | 500 | active | missing |

Start: “Audit January–March. Total the register, identify duplicate candidates by
invoice number alone and missing PO evidence.” Expected: 5 rows, total 1,150;
INV100 and INV200 candidates; R8 PO gap. While working, steer in normal language:

1. “Use January–June instead.” Expected: 8 rows, 2,250; adds INV400 candidate.
2. “Exclude cancelled invoices.” Expected: 7 rows, 1,850; withdraw INV400
   duplicate candidate, retaining R7 in totals.
3. “Use vendor plus invoice number for duplicates.” Expected: only A/INV200
   pair R3/R4; withdraw cross-vendor INV100 candidate. R8 gap remains unchanged.

The agent must actually recompute, revise its plan/results, preserve unaffected
work and explain each difference. Prior versions remain inspectable but not
current. No “guidance received” or blanket warning/invalidated-label substitute
passes AC1.29.1. Fixture scripted output is not this model-usefulness gate.
Repeat Stop with three native-confirmed completed steps/two pending; expect
“Work interrupted. 3 steps completed; 2 remain.” only after confirmation. Unknown
completion/effects must be explicit, not invented. Navigate to another Task,
return to answer a question, restart and explicitly Resume the same thread.
Repeat revoked context and missing linkage; expect refusal without protected
history or replacement work. Record per-provider model/version/settings,
expected versus actual findings, retained identity and focus observations.
No provider call has been authorized or made by this implementation run.

## Cumulative Epic 1 ledger and residual risk

The companion `epic-1-acceptance-ledger.md` preserves all earlier open gates.
Risk assessments below are qualitative, not measured failure probabilities.

| Residual | Likelihood / impact | Gate or containment |
| --- | --- | --- |
| Uncompiled native source/API/fixture integration | unknown / high | Complete checkout, native fmt/build/tests before shipping |
| Actual corrective reanalysis usefulness | unknown / high | Both-provider owner fixture above; an analytical failure is a product failure |
| Windows lock/cancellation/Electron behavior | unknown / high | Cross-platform subprocess source and Windows owner execution; no Linux inference |
| Remote/in-flight effects outliving interrupt | possible / high | Retain confirmed effects and genuine uncertainty; Stop promises neither rollback nor universal death |
| Imported/legacy missing lease/context linkage | expected for such work / medium | Fail closed; no fabricated recovery or replacement thread |
| SQLite contention across authority waits | possible / medium | Two-second total lifecycle admission authority deadline within writer fence; actual native contention execution still unrun |
| Cross-Workspace background work | expected limitation / medium | Existing single-Workspace session cancels on bootstrap switch; same-Workspace navigation continues, old Workspace display clears |
| Many visible Tasks / large retained history | possible / medium | Shared four-in-flight observation reserves selected capacity; navigation skips history and unchanged canonical state is revision-cached with fresh disclosure checks. Canonical read refuses above 1,000 pages / 64 MiB rather than return a false tail. Aggregate native performance remains unmeasured |

Warning-heavy earlier UX was inspected end-to-end in source, not an Electron
session: TaskProgress still displays repeated unchecked/provenance explanations,
and the earlier settings/status panels remain prominent. Those warnings do not
perform audit work. This story adds actionable adaptation instructions and real
lifecycle controls but does not silently redesign earlier stories; owner testing
must flag any remaining substitution for actual agent analysis. Task draft
retention remains existing memory-only same-owner behavior, not a new promise of
crash-persistent unsent text. Application/runtime availability bounds background
work; there is no scheduler or daemon-after-exit.

## Final frozen-candidate verification — 2026-10-31

This section supersedes earlier historical counts, including the targeted-only
round-3 note. Both TypeScript checks and `pnpm run build` exited 0. The final
12-file command below passed **406 tests**, without failures or skips:

```sh
pnpm exec vitest run test/tasks-lifecycle.test.ts test/tasks-lifecycle-progress.test.ts test/tasks-lifecycle-shell.test.tsx test/tasks-lifecycle-native-selection.test.ts test/tasks-service.test.ts test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx test/security.test.ts test/data-policy.test.ts test/organise-shell.test.tsx test/shell-layout.test.tsx test/composer.test.tsx --configLoader runner
```

`pnpm test` exited 1: **59 test files passed, 10 failed, 1 skipped; 1,465 tests
passed, 2 failed, 5 skipped**. Nine failed files could not collect because
`codex-app-server` is absent. The two actual assertion failures are in
`transport-and-schema`: `git rev-parse HEAD:engine` fails in this NO_VCS snapshot,
and the transported generated subset has 48 files against the stamped 816.
These are observed failures, not a full-suite pass. Native generation/build and
full rerun on the complete checkout remain required. All 36 native lifecycle
fixture selections remain authored/unrun; deterministic fixtures do not establish
actual model reanalysis. No credentials or paid provider requests were used.

All three independent review layers ran in each of three rounds. Accepted patch
findings were corrected and affected checks rerun; the final localized patch did
not trigger a fourth broad review. The 64-step plan bound and unverified IPC
pre-registration rejection remain disclosed above. No known unresolved confirmed
high-impact functional finding remains; native integration uncertainty is still
high impact until compiled and exercised. Story and sprint remain in progress.
