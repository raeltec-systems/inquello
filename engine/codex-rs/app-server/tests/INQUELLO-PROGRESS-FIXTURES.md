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

The endpoint now uses the tested `read_progress_pages` seam. Its 301-item fixture
asserts cursors None → 100 → 200, limits 100/100/56, exact chronological identities
cmd-45 through cmd-300, terminal completion evidence and incomplete history.
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
