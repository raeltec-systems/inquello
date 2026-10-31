# Synthetic in-app-server Messages fixture (corrected loop 1)

This is authored native coverage, **unrun here (cargo/runtime unavailable)**.
It replaces the rejected split-boundary fixture; no parent test process performs inference.

The parent test starts a loopback TLS server and an actual app-server child binary.
A debug-only, default-off `inference-fixtures` method invokes retained
`ModelClientSession` inside that child. Complete emitted tools pass through the same
`MessageProcessor::inquello_tools_exec`, permission request/decision and sandbox
executor as normal named operations. The child checks initial prompt refusal,
denial, single-use allow, outside-folder denial and untrusted tool-result continuation.
The parent checks both TLS requests, exact model/version, credential isolation from
body, no automatic retry, actual file effects and no analytical/approval state changes.

No fixture endpoint method exists in default builds or release builds. It is raw,
private stdio-only and not in generated production protocol. Native adapter validation
restricts it to loopback HTTPS and a pinned fixture CA; the fixed synthetic credential
is compiled into the debug fixture, never loaded from user credentials or environment.
There is no production Task-start API, evidence upgrade or paid inference.

Run in the complete checkout, with pinned toolchain and existing sandbox prerequisites:

```sh
cd engine/codex-rs
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-app-server --features inference-fixtures
cp target/debug/codex-app-server /tmp/inquello-app-server-fixture
INQUELLO_FIXTURE_APP_SERVER_BIN=/tmp/inquello-app-server-fixture \
  CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server --features inference-fixtures \
  --test inquello_messages_runtime -- --nocapture
# Separately rebuild default-feature packaging outputs; never package fixture binary.
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-cli
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-app-server
CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server --lib inquello
```

A default test run omitting the feature is not fixture success. Native compilation,
actual child/sandbox execution, keyring smoke and generated schemas remain required
unmet gates until these commands pass; authored source is not acceptance evidence.

## Story 1.24 combined native limit / mounted panel fixture

The same private-stdio, debug-only `inquello/fixture/messagesTurn` dispatcher accepts
`scenario: "usage-limit"` with phases `prepare`, `refuse`, and `clear`. No production
protocol/preload method was added. It is scoped to one creator-private Task already
explicitly configured for the synthetic Codex model. Preparation refuses any cached
Codex authentication or existing bound Codex credential. Only synthetic capability
and quota observations are installed; no provider key is installed.

The refusal phase calls the existing native `permissions_review` boundary. Its
required quota check receives fixed `ordinary_usage_allowed: false`; a separate
fixture transport trap counts and refuses any attempted provider dispatch if that
guard regresses. The fixture fails unless there are zero provider calls, one new
refused attempt, and byte-equivalent prior attempt records. Clear removes the scoped
fixture metadata. Default and release binaries contain neither the scenario nor
its override/trap state.

`usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work` in
`inquello_messages_runtime.rs` runs this scenario in an actual child, executes a
harmless local command while the model quota is exhausted, and verifies its retained
completed history beside the refused review.

The seeded desktop `probeEnvironments` now uses this same scenario, saves defaults
through the actual mounted usage controls, invokes the native refusal, calls the
normal settled-work notification function, and asserts the mounted exhausted-limit
explanation/refused attempt plus all retained local-tool history. It always clears
the fixture in `finally`. The full Story 1.24 seeded smoke therefore requires the
separately built **debug inference-fixtures binary**, selected via existing
`INQUELLO_APP_SERVER`; a default binary rejects the scenario, not silently skips it.
Use the existing isolated seeded identity topology and temporary smoke data roots.
Never package the fixture binary. No real credentials or paid provider calls are
required or allowed. This combined source is authored but unrun in the partial
workspace without native binaries/toolchain/seeded topology.

## Story 1.25 actual retained private Task child (authored, unrun)

`real_private_task_retained_thread_denial_and_lost_ack_reconcile_without_second_turn`
now exercises **normal** `inquello/tasks/bootstrap`, read-only `preflight`, `start`,
`reconcile`, ownership lookup, retained `thread/read`, permission request/decision
and usage reads in the actual app-server child. It does not call the earlier
`inquello/fixture/messagesTurn` shortcut and never creates a Task with legacy
`inquello/task/create` or renderer-provided thread ownership.

The sole extra seam, `inquello/fixture/taskTransport`, is raw private stdio,
default-off `inference-fixtures` plus debug assertions. It requires the opaque
bootstrapped isolated session and an explicitly configured current Claude route,
refuses existing provider credentials/generations and cached Codex authentication,
and installs only the compiled fictional key and validated pinned loopback TLS
endpoint. Its scoped fixture eligibility does not edit the capability register or
promote real/provider acceptance. Every actual Task attempt receives a one-use
loopback transport; consumption cannot fall through to the production endpoint.
Normal durable reservation, retained thread creation, idle-only turn submission,
authority callbacks, tool restrictions, permission mediation and accounting remain
in the execution path.

The test host supplies fresh fictional Workspace service observations and denies
one model-originated exact-argv shell request through the ordinary native
permission request/decision operations before answering the runtime escalation.
Assertions cover no Task/provider call from preflight, exactly one Task and native
thread, canonical submitted procurement records in retained history and the first
TLS request, one denied action with no filesystem effect, real retained tool-result
continuation, same Task/run/thread after deliberately ignored acknowledgment and
same-operation replay, changed-content conflict, two attributable model attempts,
no request content in usage, and no duplicate turn/provider retry. This proves
wiring only **when executed**, not useful real-provider audit analysis.

Run the existing command above with an additional filter:

```sh
INQUELLO_FIXTURE_APP_SERVER_BIN=/tmp/inquello-app-server-fixture \
  cargo test -p codex-app-server --features inference-fixtures \
  --test inquello_messages_runtime \
  real_private_task_retained_thread_denial_and_lost_ack_reconcile_without_second_turn -- --nocapture
```

No native toolchain/binary was available in the implementation workspace. This
new fixture has **not compiled or run**. The full retained startup/model catalog,
shell selection, sandbox prerequisites, callback protocol and test harness API
compatibility remain explicit native gates; failures must be fixed in the pinned
complete checkout, never replaced by direct-client fixture success. Separately
authorized actual provider inference and auditor validation remain pending.

Round 4 additionally authors
`real_private_task_interrupt_cancels_running_shell_before_later_file_effect`:
normal consumed one-use permission starts a bounded shell inside the private Task
root; actual retained interrupt must cancel it before its delayed second write.
Registry coverage separately revokes only the Task authority token (leaving the
ordinary invocation token live), waits for real child reaping, and asserts exactly
one accounting finalization. Orchestrator coverage refuses stale authority after
an approval wait at both initial and retry attempt entry. Cancellation/queued
usage and bound Responses WebSocket 426/no-HTTP-POST cases are also authored.
These native checks remain **unexecuted** without the matching Rust build; they
are not actual provider-connected acceptance or evidence of real-data eligibility.
