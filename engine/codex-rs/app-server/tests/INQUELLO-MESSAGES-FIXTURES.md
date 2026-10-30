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
