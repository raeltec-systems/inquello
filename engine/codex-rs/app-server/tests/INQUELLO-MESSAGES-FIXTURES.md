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
