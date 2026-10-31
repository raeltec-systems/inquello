# Story 1.26 native progress gate

The new `real_private_task_retains_publication_question_and_truthful_progress`
case in `inquello_messages_runtime.rs` drives normal private `tasks/start` through
a separately built retained app-server child. Five pinned-loopback Messages
responses publish a plan, invoke the existing bounded command handler and one-use
permission route, ask an actual `request_user_input`, publish all five result
kinds, then finish with plain text. It checks governed retained projection,
pending-plan truthfulness, exact question answer flow, unchecked results,
unresolved decision authority, actual command status, and stale authority refusal.
A debug-feature-only barrier withholds the Start acknowledgement until the real
question is answered. The fixture asserts exact durable turn binding and working
input before that acknowledgement; no second submission or provider retry occurs.
It is a wiring fixture, not independent analytical verification or real-provider
useful-output acceptance.

## Native protocol

`inquello/tasks/progress` accepts only `taskId` and current `workspacePolicy`.
Principal, Workspace, runtime incarnation, run/thread/turn and session cancellation
are derived/rechecked natively before/after bounded history reads. It reads at most
256 canonical item records, preserves their item-specific outcomes, limits each
projected text to 16 KiB and aggregate text to 256 KiB, and marks clipping, gaps,
duplicates and incompatible revisions incomplete. It excludes reasoning, hooks,
opaque continuations and unknown extension blocks. No separate history database
or content cache is introduced.

`inquello_progress` is a non-effect, version-1 publication tool. Its ordinary
function call/output is retained in existing governed native history. Input is
bounded at 64 KiB, 64 steps and 64 results, with explicit stable IDs, revisions and
references. Model input cannot include check/approval/authority fields.

Canonical successful command or applied-edit evidence is scoped to the same turn.
A completed plan claim becomes done only when its text exactly matches the
referenced native action text. A natural-language semantic claim remains
unconfirmed even when it cites a successful action; the evidence IDs remain
visible. This conservative restriction avoids guessing that a command proved an
arbitrary analytical conclusion. There is no independent check engine, so all
result checks are unchecked. Decision bases resolve only exact retained human
instruction IDs whose actual bounded instruction text exactly matches the
published decision text; unrelated cited instructions, arbitrary names,
permission records, unavailable policy applicability and missing IDs yield no
basis cue. Execution completion never alters review, Professional Approval or
delivery. Artifact creation is not a capability of this route: the native status
is absent only when actual Task artifact_refs are empty; unresolved existing refs are unknown, never failure inferred from a command.

The existing exact question schema/handler retains IDs/options/secrecy and obtains
fresh private Task authority before delivery and after the RPC wait. The existing exact-turn `current_turn_extension_data` seam supplies authority; no
parallel authority map or additional content cache is introduced.
Questions do not enter process permission accounting. Current-turn checks and
session cancellation reject late replies; private reply errors do not log content.

## Verification status

Not executed in this partial checkout: `cargo`/`rustfmt` are absent and the full
pinned workspace is missing. `cargo fmt --check` and
`cargo test -p inquello-protocol progress` both returned `cargo: command not found`.
The projection/authorization-shape tests (including the 301-item paging seam), two publication contract tests,
exact advertised publisher/question schema validation tests, and new retained-child
fixture, native check/test/clippy, and supported protocol generation remain
owner-run gates; no generated bindings were hand edited. Run the existing
INQUELLO-MESSAGES-FIXTURES instructions on the complete pinned workspace, then run
protocol generation and its drift checks. Windows seeded Electron, authorized
real-provider useful output and conditional SQLite writer-contention evidence
remain separate open gates. No synthetic/real-data eligibility is promoted.

## Restored context identity

Before edits, these missing pinned callers/schemas were restored and their Git
blob SHA-1 identities checked against the actual Inquello baseline commit
`5ead6e8846a2999d2f7842588fede8430d534919` manifest (not assumed from upstream):

- core handlers/mod.rs: eb71db6b3e376c220ef191aa2b4573e2a936e60c
- core handlers/plan.rs: 34956562230fb906b153362d48bc9622d9f2af5c
- core handlers/plan_spec.rs: d8ce95767b0e99657b72915d07677d6322313601
- core handlers/request_user_input.rs: d55eca02970f649c9dbedb655fa85b3bed35a2d1
- core handlers/request_user_input_spec.rs: ede0d85bea5c2829939ca1575a25053425dcb59f
- protocol v2/item.rs: bde4c2aa87c2d71f9dddbd0e36caa0c3ab638b94
- protocol v2/turn.rs: 38b00228a6d4c0693c13daa03734bb8f121007dc
- protocol v2/notification.rs: ca0e7753f3cb3c007e544b3507881b6cffeecacd
- protocol v2/thread.rs: 79422eba095eb7d0407adba1ee925f471e0f761b
- app-server bespoke_event_handling.rs: d0d363e401408f2d533cba0ce4c42653928f2fb7
- app-server thread_state.rs: 6dfe969ab3adfc5d703184ee2ee61a1b6335f282

## Pass 1 correction coverage (authored, native execution still required)

The endpoint uses the `read_progress_pages` seam. Story 1.29 corrects its
canonical input independently of the recent activity display: its 301-item fixture
now asserts cursors None → 100 → 200 → 300, 100-item page limits, and canonical
identities cmd-0 through cmd-300 before the separate 256-item display bound.
A 353-item regression retains an old unaffected finding and the predecessor of a
later withdrawal; a repeated cursor refuses rather than disclosing partial
canonical findings. Every page performs fresh disclosure authorization. The
existing retained thread store remains canonical and follows its existing export
and deletion rules; no additional history cache is introduced. Reads exceeding
1,000 pages or 64 MiB refuse explicitly, never substitute a recent tail.
Revision creation reasons and later supersession reasons are separate fields.
Navigation activity-only requests skip history and authorize current status.
Additional native tests cover colored CSI/OSC output, canonical revisions after
large history, latest structured results after 100 ordinary messages, 70-result
overflow, cumulative omitted plan IDs and authoritative artifact refs. These are
**unexecuted owner gates**, not passing test evidence.

Canonical plan text remains intact until all publications resolve. Display-only
control sanitation preserves retained originals and marks information loss.
Bounded allocation prioritizes current structured findings, reserves plan/activity
space, then clips recent activity before older content. Ordinary agent answers
appear once, unchecked, and actual user/agent roles remain explicit. JSON transport
has 768 KiB bounded headroom for escaping/metadata around 256 KiB display text.
Questions keep the existing required choice schema and freeform Other path; no
optionless model question surface is introduced. Answers are limited to 4096 UTF-8
bytes before consuming the desktop request, with correctable UI feedback.


## Story 1.29 review loop 2: authored native corrections (unrun)

- Lifecycle reservation and claim retain final authority validation inside the
  SQLite writer transaction, with one two-second total validation deadline per
  transaction. Timeout rolls back before dispatch; pending host authority RPCs
  are cleaned up on future cancellation. Stop owns an independent claim and
  does not require new-inference candidate discovery, credentials, quota or
  capability readiness. Output disclosure remains separately authorized.
- `stalled_inflight_steer_authority_releases_writer_for_stop` holds the actual
  validation future at the first and final validation boundaries of both reserve
  and claim, concurrently requesting Stop. This is not a receipt edited after
  admission. Expected: no admission effect, writer released within two seconds,
  Stop reserves/claims inside four seconds, no silent replay.
- `responses_lifecycle_progress_continuity` and
  `messages_lifecycle_progress_continuity` use four synthetic model responses
  (one tool per response, respecting Messages' nonparallel binding): publish
  first-turn findings, hold real shell, explicitly Stop/Resume, publish revision,
  then final text. Actual `inquello/tasks/progress` before/after Resume asserts
  unaffected finding/source turn, current revision, historical predecessor,
  original change reason and subsequent supersession reason. They do not prove
  actual model analytical correctness.
- Full progress uses a four-entry/64 MiB canonical cache keyed by principal,
  session, run/lineage, policy and persisted updated-item ordinal. Every read
  freshly authorizes disclosure; cached authorization is never accepted.
  The ordinal seam is verified against the selected Codex cut
  `360319d8dee62d87e2d59fc0c21805d79519cfed`, `thread-store/src/types.rs`, and
  exact fork blob `4a55334b105c776ee590c134809c6ecd6534e552` (read-only research
  copy `/workspace/shared/story129-research-fork/engine/codex-rs/thread-store/src/types.rs`).
  This is not a coarse timestamp or newest-created-item heuristic.
- Optional `resultPage` has UUID `snapshotId`, `currentOffset` and `historyOffset`
  (0..10000000). Responses give exact current/history totals and nullable next
  offsets, at most 64 current/128 historical rows under per-section byte bounds.
  Historical creation/supersession reasons are not display-budget clipped.
  Snapshot changes/eviction refuse `stale_snapshot`, never combine revisions.
  Canonical pagination, long-reason and cache-identity/session regressions are
  authored. Final run identity is checked after awaited disclosure boundaries.

Attempted here from `engine/codex-rs` (all exit 127, `cargo: command not found`):

```sh
cargo fmt --all -- --check
cargo test -p inquello-domain
cargo test -p inquello-adapters
cargo test -p codex-app-server --test inquello_authorization_runtime
```

Required native targeted commands (unrun here; no Cargo/rustc/rustfmt):

```sh
cargo test -p inquello-adapters --test task_runs stalled_inflight_steer_authority_releases_writer_for_stop
cargo test -p codex-app-server progress_tests
# From desktop, Linux or Windows; script must require both new selectors:
node scripts/run-lifecycle-native.cjs
```

No native/provider/Windows execution, generated protocol regeneration or real-data
eligibility is established by these authored fixtures. All four new selectors must
be included in the nonzero platform selection gate (32 lifecycle cases total).


### Provider-readiness outage cancellation witness (authored, unrun)

`responses_lifecycle_stop_provider_unavailable` and
`messages_lifecycle_stop_provider_unavailable` start an actual retained local
shell, then create a fixture-only readiness-failure marker under the isolated
session root. The check exists only with both `inference-fixtures` and
`debug_assertions` and an already authenticated pinned-loopback Task fixture.
It only refuses new inference; it cannot grant capability or route eligibility,
and introduces no production toggle or real credential.

The child must reject actual `inquello/tasks/preflight` at the candidate-readiness
boundary while the same PID/start identity and turn are still running. The marker
remains present while actual Stop returns `interrupted` and the original PID is
observably terminated; confirmed/pending effects are checked by the shared
retained-child fixture. Only then is the fault removed, followed by explicit
same-thread Resume. This is a synthetic readiness fault, not a claim of a tested
live provider outage. Native execution remains unrun without Cargo.

Static selection validation: `pnpm exec vitest run
 test/tasks-lifecycle-native-selection.test.ts` from `desktop`: 2 tests pass;
source selector inspection selects all 32 required both-binding lifecycle cases.


### Localized round-3 regression additions — authored, unrun

The required nonzero lifecycle selection is now **36 cases**; the earlier 32-case
records above describe the prior candidate. Added both-provider `progress_cache`
and `stop_inflight_steer` selectors. The former uses real publication and original
command-item completion updates in one turn, rejects stale analytical snapshots,
and keeps the snapshot stable across unrelated assistant activity. The latter
holds an actual steering authority RPC during writer-held validation while Stop
is issued concurrently, with no admitted-receipt editing. Continuity's final
provider request count is scenario-specific (four, not an unconditional two).

The current targeted desktop observer/evidence/selector run passes 64 tests across
3 files; native selector alone passes 2. Focused protocol/projection/lifecycle Cargo
commands each exit127 because Cargo is absent. No native/Windows/provider execution
or generated-protocol acceptance is inferred. Exact commands and logs are in
`story-1-29-lifecycle-support.md` and `validation/story129-round3-patch/`.
