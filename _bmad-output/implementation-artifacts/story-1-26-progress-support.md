# Story 1.26 progress and cumulative auditor validation ledger

Status: **in progress**. Implementation is authored; end-to-end native and auditor
acceptance is not established. No real credentials, paid calls or provider calls
were used. No eligibility, analytical review, Professional Approval or delivery
state is promoted.

## Implemented scope

- Named authorized native progress read derives principal, Workspace, runtime,
  Task/run/thread/turn and session authority; refreshes after history waits.
- Canonical retained items, not turn summaries, own message/action/edit outcomes.
  Bounded hydration reads at most 256 items, 16 KiB per text and 256 KiB aggregate;
  incomplete history is visible. Hidden reasoning/opaque blocks never project.
- Version-1 non-effect `inquello_progress` retains structured publication in the
  existing governed history. Stable step IDs/revisions and explicit evidence are
  required. Native exact-action scope can establish done, not analytical truth.
  Natural-language completion claims without matching action scope are visibly
  unconfirmed. No plan is fabricated from turn completion or prose.
- Decision cue requires the exact retained human instruction ID **and text**.
  Unrelated instructions, policy applicability not represented on this route,
  agent-written names and permission records cannot establish decision authority.
  There are no independent check records on this route: all results are unchecked.
  Unknown/malformed publication remains readable without structured labels.
- Main/preload exposes named snapshot, content-free invalidation subscription and
  one-use scoped answer operation. Current authority is checked before/after reads;
  Task-local hydration failures suppress only that Task; unknown Workspace authority suppresses its Workspace; principal/runtime/session failure invalidates the whole scope. At most 16 pending requests / 128 KiB;
  overflow discloses incomplete history. Answers preserve IDs/options/secrecy and
  respect the native 4096 UTF-8 byte limit before request consumption. Questions never grant tool permission.
- UI composes existing PlanSteps, JudgmentTag, DiffLine and permission ApprovalCard
  surfaces, stable rows/forms, no auto-scroll/focus/navigation takeover. Compact
  absent/unknown/failed artifact text does not invent a preview or artifact ID.
- Shell/permission passive refresh failures clear protected cached content and
  controls. Memory-only projections have no additional persistent cache/database.
  Data-policy and capability-register disclosures reflect these held contents.

The six-line Story 1.25 Task-history deletion disclosure regression omitted from
its published manifest is now included in `desktop/test/data-policy.test.ts`.
It is new Story 1.26 execution evidence, **not** retroactively included in any
published Story 1.25 result. No associated deletion product behavior changed.

## Automated verification

Historical first-pass commands (2026-10-31; exact logs under `desktop/validation/story126-*`; superseded for current sources by the correction run below):

- `pnpm exec tsc -p tsconfig.build.json --noEmit`: exit 0.
- `pnpm run build`: exit 0; renderer tsc included; five existing unresolved font warnings.
- `pnpm exec vitest run test/tasks-*.test.* test/permissions-units.test.ts test/permissions-shell.test.tsx test/shell-layout.test.tsx test/organise-shell.test.tsx test/primitives-progress.test.tsx test/data-policy.test.ts test/security.test.ts test/rpc.test.ts`: **14 files / 358 tests passed**, none failed/skipped (12.00 seconds).
- Broader focused invocation with `test/permissions-*.test.*`: **14 files passed / 1 failed collection; 358 tests passed**. The extra permissions-integration collection requires the absent native app-server; not a green command.
- `pnpm test`: exit 1; **48 files passed / 12 failed / 1 skipped; 1,189 tests passed / 3 failed / 5 skipped** (61 files / 1,197 tests; 43.80 seconds). Nine collection failures require the missing native binary, one collection requires missing imported design icons; assertions fail for missing Avatar import and two Git/generated stamp checks. This is not a green full suite.
- `pnpm run generate:protocol`: exit 1 before generation because this snapshot has no Git repository. Native generator/runtime are also unavailable. Generated files remain unchanged.
- `cargo fmt --check`, core/app-server `cargo check`, protocol/core/app-server targeted `cargo test`, and `cargo clippy`: each unavailable (`cargo: command not found`, exit 127). No native passing result is asserted.

The initial tsc invocation from repository root rather than `desktop/` failed with no package found; the correctly scoped command above passed. No test exclusion is treated as native acceptance.
Baseline before desktop edits: `pnpm test` returned 1; **46 files passed / 12 failed /
1 skipped; 1,148 tests passed / 3 failed / 5 skipped**. Existing failures concern
missing native app-server, missing imported icons/Avatar, non-Git stamp lookup and
incomplete generated snapshot (48 files versus the recorded 816).

All 48 present generated protocol files plus the schema stamp match their Git
blob hashes at source commit `5ead6e8846a2999d2f7842588fede8430d534919`.
No generated bindings were hand edited. Restored native source hashes, conservative
publication limits and fixture instructions are recorded in
`engine/codex-rs/app-server/tests/INQUELLO-PROGRESS-FIXTURES.md`.

## Cumulative owner-run gates — not acceptance passes

1. Complete pinned workspace and approved Rust toolchain: fmt/check/test/clippy;
   core/app-server builds with and without `inference-fixtures`; supported matching
   protocol generation and drift verification. Cargo/rustfmt are absent here.
2. Execute new retained-child publication/command/question/results fixture,
   including deterministic question-before-Start-ack flow, current authority,
   one-use answers, failed command versus artifact status and interrupted plans.
   Execute the authored projection/provenance/schema tests. Source is not evidence
   of a successful native run. Carry **all** Story 1.25 retained-child gates.
3. Target Windows sandbox-enabled seeded Electron: actual live progress and
   streaming; keyboard/IME/focus/selection/scroll; reduced motion; background Task
   navigation; permission and secret questions; loss of membership/session/runtime;
   truthful labels and absent artifact. Mounted DOM tests do not replace this gate.
4. With **separate explicit provider authorization**, run useful-output acceptance
   over fictional procurement: R01/R03 duplicate candidates, R02 approval gap,
   R04/R05 aggregate 18,000 versus 15,000 threshold. Assess actual evidence and
   uncertainty; fixture success is not independent checking or provider acceptance.
5. Carry forward Stories 1.21–1.25 native/protocol/Electron/provider and
   organisational real-data gates. End-of-Epic-1 auditor validation adds vendor/
   inventory cases and Stories 1.27–1.30 steer/stop/recovery/reopen/search behavior.
   These later surfaces are not implemented by this story.

Conditional SQLite writer-contention residual is unchanged: the 5-second busy
timeout can be exceeded by a writer reservation spanning two authority fences,
each up to 15 seconds plus quota/native reads. Under a slow/stalled authority
service, unrelated writes may be delayed/refused (medium impact). No authority
bypass or eligibility promotion is claimed.

## Pass 1 re-derivation and correction — 2026-10-31

The restored baseline and preserved first-pass sources were used to re-derive the
same authorized architecture sequentially. No concurrent editing agents, new
runtime dependencies, database, artifact creation, generated binding edits or
eligibility promotion were introduced. Frozen intent is unchanged.

- Canonical plan revisions/evidence resolve before display budgets; latest
  structured results survive ordinary history and 64-result overflow. Ordinary
  answers appear only once in activity, explicitly unchecked/structure-unavailable.
  Display loss, including ANSI/control stripping, marks history incomplete while
  retained source remains unchanged. Actual user/agent speaker roles survive all
  projection layers. JSON encoding has bounded 768 KiB headroom for escapes and
  row metadata around the existing 256 KiB display text limit.
- Task-local read errors no longer cancel another Task's question; even failed
  hydration waits recheck Workspace authority before preserving unrelated input.
  Principal synchronization failure clears the whole scope. Workspace
  authority and principal/runtime/session invalidation retain fail-closed scopes.
- Answers enforce 4096 UTF-8 bytes before consumption; oversized multibyte drafts
  remain correctable. Inherited-property question IDs are safe. Transition
  announcements identify distinct items/questions.
- Empty actual Task artifact_refs establish absence; unresolved refs yield unknown.
  Failed commands do not become artifact failures. No artifact loader was added.
- The native endpoint shares a bounded paging seam with a maintained 301-item test:
  cursor advancement, newest256 exact chronological identities, terminal evidence
  and incomplete status. Native projection tests add colored output, recent result
  priority, canonical revisions, overflow, cumulative omission and artifact refs.
  **All native tests remain authored/unexecuted, not acceptance passes.**
- Existing question choices/freeform Other schema is unchanged. Plan publications
  are cumulative; omission does not withdraw a step. No reset/delete was added.

Current verification (`desktop/validation/story126-loop1-*`):

- Main `tsc --noEmit` and production build (including renderer tsc): exit 0; five
  existing missing-font warnings remain.
- Supported focused command listed above: **14 files / 370 tests passed**, no
  failed or skipped tests (11.27 seconds).
- Full suite: **48 files passed / 12 failed / 1 skipped; 1,201 tests passed /
  3 failed / 5 skipped**. Same missing native/design/Git/generated-stamp baseline
  failures; this is not a green full suite.
- All 48 present generated files and the schema stamp match the source baseline
  Git blob identities. Supported generation still refuses this non-Git snapshot.
- Native fmt/check/targeted tests/clippy remain unavailable (cargo absent, exit
  127), including the new paging and colored-output cases. Correct native cwd
  attempts are recorded in `story126-loop1-native.log`.

The first short correction run exposed one stale announcement-text test expectation;
that assertion was updated to require stable item identity. Intermediate focused
runs passed 43 and 366 tests before the final JSON-escape regression was added.
The six-line deletion regression remains new 1.26 evidence only. All owner gates
above and the conditional SQLite writer-contention residual are unchanged.

Post-disclosure register checks: data-policy/capability unit/lifecycle/mounted tests **4 files / 150 tests passed**; shipped data policy validates 18 categories. This does not promote route eligibility.

## Pass 2 re-derivation and correction — 2026-10-31

The approved spec and its full context were loaded before implementation. Preserved
pass-1 sources were restored sequentially as positive reference, then corrected;
no concurrent editing agents or generated-binding edits were used.

- Pending Start now discovers only its exact retained operation through authenticated
  read-only reconciliation at a bounded 250 ms cadence. Acceptance checks exact
  operation/request plus the original generation; a late Start reply cannot accept
  twice. Existing Shell foreground/Workspace fences retain background navigation
  and newer drafts. A mounted Shell test answers a real TaskService-mediated,
  exact-ID/options question before the held Start acknowledgement resolves. Mounted
  delayed-discovery navigation and membership-revocation cases also pass.
- Native result citation identities include actual failed/cancelled commands and
  retained messages, separately from exact successful work used for plan completion.
  Canonical revision state spans the bounded input before choosing the recent 64
  plan IDs; cumulative omission never resets or withdraws old IDs.
- Command display reserves bounded command text and the diagnostic/output tail;
  sanitation no longer allocates a full sanitized copy before clipping. This is a
  projection bound, **not** a new bound on the upstream retained thread store.
  A shared native 640 KiB final serialized ceiling includes escapes, references and
  basis metadata, below main's 768 KiB refusal. Removed/empty evidence strips its
  citations/basis and downgrades unsupported done steps, with incomplete disclosed.
- Native question fields and editable answers reject the same unsupported controls;
  pasted invalid text stays editable with specific feedback. Existing required
  choice/Other schema and 4096 UTF-8-byte bounds are unchanged. Reads are fenced
  across answer consumption, with bounded scoped consumed-ID suppression. Output
  hints coalesce at 250 ms; question/terminal updates remain promptly refreshed.
  Newly observed terminal rows are announced by identity. Terminal run states
  never leave running plan animations; unresolved work remains unconfirmed.
- Positive parser-to-mounted exact-human-basis coverage asserts identity/scope and
  unchanged unchecked wording. Native tests additionally cover recent canonical
  plans, failed/cancelled/message citations, diagnostic tails, terminal plan states,
  control parity and adversarial escaping/reference/basis serialization. Native
  tests are **authored only**, not executed acceptance evidence.

Final verification (logs `desktop/validation/story126-loop2-*`):

- Main `tsc --noEmit` and production build including renderer tsc: exit 0;
  five existing missing-font warnings remain.
- Supported focused command: **14 files / 382 tests passed**, none failed/skipped
  (`story126-loop2-focused-final.log`, 15.95 seconds).
- Full `pnpm test`: **48 files passed / 12 failed / 1 skipped; 1,213 tests passed /
  3 failed / 5 skipped** (`story126-loop2-full-final.log`, 48.03 seconds).
  The same missing native/design/Git/generated-input baseline failures remain;
  this is not a green full suite.
- All 48 present generated files plus schema stamp match baseline Git blob hashes;
  three preserved pinned native caller originals also match the baseline.
- Supported generation refuses the non-Git snapshot. Native fmt/check/protocol,
  core/app-server tests, retained-child fixture and clippy all remain blocked by
  missing cargo (127). No dependencies/toolchains were installed.
- An intermediate full run had one additional newly added test assertion failure:
  it incorrectly classified the user's own preserved uncertain draft as retained
  Task disclosure. The assertion now distinguishes that draft from suppressed
  accepted-request/progress regions; the final full run above has baseline-only
  failures. Initial development runs also exposed timing expectations predating
  coalescing and a discovery-generation race; both were corrected and reverified.

Story/tracker remain **in-progress**. Windows seeded Electron, native/protocol and
separately authorized actual-provider useful-output acceptance, the cumulative
prior-story gates, and the conditional SQLite writer-contention residual are
unchanged. No eligibility promotion, merge or deployment is claimed.

Post-disclosure register verification: capability unit/lifecycle/mounted plus
policy tests **4 files / 150 tests passed** (`story126-loop2-registers-final.log`);
18 shipped data-policy categories validate. This does not promote eligibility.

## Final independent review and verification

All three configured independent layers completed across three passes. Demonstrated issues were corrected; individual triage and likelihood/impact are in the story specification. Final direct corrections prevent slow permission polling starvation and stale permission/progress reads after decisions, declare unresolved references incomplete, show ended activity as outcome-unconfirmed, and verify failed/cancelled citations through main parsing and mounted UI.

Final owner rerun after all product edits: main TypeScript/build passed; focused **14 files /392 tests passed** (16.81s); full **48 files passed /12 failed /1 skipped;1,223 tests passed /3 failed /5 skipped** (47.98s), exit1. The same nine missing-native collections, one missing-design collection, missing Avatar assertion and two Git/generated stamp assertions remain. The separate register run passed150 tests. Final targeted correction tests passed45 tests before the full owner rerun. Native regression remains unrun (cargo127). Logs: `desktop/validation/story126-final-*`, `story126-loop2-review-*`.

### Remaining risk judgments

- Native API/build/protocol compatibility: unknown likelihood, high impact if incompatible; mandatory owner-run gate, not accepted as working. Target Windows Electron/provider usefulness also remain required.
- Very long Tasks: newest256 canonical records /64 displayed plan/result items /256KiB display text and640KiB wire cap. Explicit incomplete history means prior revision authority and some older citations may be unavailable; low residual impact for the displayed view, not proof of complete history. No persistent revision ledger added.
- Raw output tail cut inside a very long ANSI escape may leave inert formatting text; unlikely/low display risk, no execution or authoritative result cue.
- Rare16-request queue overflow conservatively marks later views incomplete until scope invalidation; unlikely/low over-warning.
- Cumulative plan omission is not withdrawal; provider/auditor validation will test expectations. Unverified medium usability claim recorded for follow-up, not a new reset feature.
- Upstream retained-store memory consumption needs native stress measurement; unverified medium risk. Bounded projection does not claim to bound that store.
- Prior SQLite writer contention remains conditional/medium: 5s busy timeout versus authority waits may delay/refuse concurrent writes; freshness guards were preserved.

### Exact local validation commands (complete checkout, approved existing toolchain)

```sh
cd engine/codex-rs
cargo fmt --check
cargo check -p codex-core -p codex-app-server
cargo test -p inquello-protocol progress
cargo test -p codex-core private_progress_control_tests
cargo test -p codex-core exact_publisher_schema_and_arguments_fit_current_route
cargo test -p codex-core exact_existing_question_schema_fits_current_route
cargo test -p codex-app-server progress_tests
cargo clippy -p codex-core -p codex-app-server --all-targets
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-app-server --features inference-fixtures
cp target/debug/codex-app-server /tmp/inquello-app-server-fixture
INQUELLO_FIXTURE_APP_SERVER_BIN=/tmp/inquello-app-server-fixture cargo test -p codex-app-server --features inference-fixtures --test inquello_messages_runtime real_private_task_retains_publication_question_and_truthful_progress -- --nocapture
cargo build -p codex-cli
cargo build -p codex-app-server
cd ../../desktop
pnpm run generate:protocol
pnpm exec tsc -p tsconfig.build.json --noEmit
pnpm run build
pnpm test
```

These shell fixture commands target the supported Unix development environment; run target Windows Electron seeded acceptance separately with the matching platform binary and isolated profile. Do not package the debug fixture binary. Run the full retained fixture suite and prior-story gates as well. Provider credentials/calls require separate authorization. End-of-Epic1 auditor validation must establish the promised usable workflow with realistic fictional procurement/vendor/inventory records; no automated fixture alone establishes that outcome.
