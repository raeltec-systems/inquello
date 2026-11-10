# Story 1.28 authorization fixtures — authored, unrun

No native command compiled or ran in this workspace: `cargo` is absent. No
production approval, credentials, provider inference or capability promotion was
performed. This document and the accompanying `not-run` report are NOT compiled
negative-authorization evidence.

## Retained runtime

`inquello_authorization_runtime.rs` starts a separately built **debug**
`inference-fixtures` app-server child. Both Responses and Messages use normal
Task bootstrap/start/reconcile, retained thread creation, native permission
request/decision/one-use consumption, actual sandbox command execution and
current host authority callbacks. The parent supplies only fictional provider
SSE and service observations, not tool execution or a replacement model client.

The Responses fixture is bound to the exact single attempt, including principal,
Task/run/turn, route/model/API and authority revisions. It uses a literal-loopback
HTTPS endpoint and per-fixture certificate through the pinned public
`HttpClient::new_without_request_logging` wrapper. The normal
`ResponsesHttpExecutor` request builder, API encoder/parser, output mapping and
cancellation path remain in use. Only provider/auth/transport setup is replaced:
no authentication provider, zero retries, no proxies or redirects. A consumed
attempt has a tombstone; missing/reused transports cannot fall through to a real
provider. No global trust store is changed. There is no fixture entry point in
ordinary or release app-server builds. The seam refuses real-data sessions and
coexistence with cached provider authentication. It is not production TLS,
provider authentication, Windows or actual model-usefulness evidence.

Four new runtime tests cover an allowed tool effect and reopen, same-Workspace
peer and different-Workspace retained-thread denial, no duplicate dispatch on
replay, and authority uncertainty during the next model response with late
output suppressed, independently for both adapters. Existing
`inquello_messages_runtime` tests retain actual running-tool cancellation and
permission/interrupt controls; their shared host helper was extracted without
copying their test registrations into the new suite. A prior applied local tool
effect is explicitly retained after withdrawal: no rollback claim.

## Service and recovery corroboration

Production operator/HTTP entry points always call `compiled_route_evidence`.
A private function-pointer seam exists only for `cfg(test)` callers of the same
transaction bodies; its artificial passing proof is never shipped or accepted
from a request/environment setting. PostgreSQL tests author a successful approval
and check, scope mismatch, idempotency, queued revoke-before-check ordering and
an upgrade from the exact 0001/0002 migration bytes without seeding authority.

`export_provenance_receipts` stores only an authenticated principal, immutable
manifest digest and Workspace IDs. It survives deletion of the explicitly
local export journal. Create requires current Export on every Workspace;
validate requires the same current principal and Read on every original
Workspace. Expiry is rechecked after lock waits. The endpoint returns no source
bytes and grants no processing/recovery permission. Native byte/ownership
inspection plus fresh route/policy checks remain independently mandatory before
and after export/recovery boundaries.

A receipt corroborates an earlier authorized request/hash; it is **not remote
attestation of native execution**. An authenticated caller who already possesses
bytes can submit their digest or forge attribution labels in those supplied
bytes. This does not reveal otherwise unavailable peer bytes or waive current
Workspace access, but authenticity of attacker-supplied labels is an explicit
integrity limitation. No device-signing/attestation platform or retention duration
has been invented.

## Commands (all unrun here)

```sh
cd engine/codex-rs
cargo check -p inquello-service -p codex-app-server
cargo test -p inquello-service --features test-issuer --test route_eligibility
cargo test -p inquello-service --features test-issuer --lib route_eligibility
# The service tests require isolated PostgreSQL 18 and INQUELLO_TEST_DATABASE_URL.
cargo build -p codex-app-server --features inference-fixtures
INQUELLO_FIXTURE_APP_SERVER_BIN="$PWD/target/debug/codex-app-server" \
 cargo test -p codex-app-server --features inference-fixtures --test inquello_authorization_runtime
INQUELLO_FIXTURE_APP_SERVER_BIN="$PWD/target/debug/codex-app-server" \
 cargo test -p codex-app-server --features inference-fixtures --test inquello_messages_runtime
cargo test -p codex-app-server --test inquello_behavior_fingerprint
cargo fmt --check
# Separately rebuild ordinary release/packaging binaries; never package fixtures.
```

Every actual command attempted in this workspace returned exit 127, `cargo:
command not found`. The new Rust sources have not been typechecked, formatted or
executed. Required complete-suite scenarios not represented by these fixtures
remain pending, including native real-data eligibility coupling,
all possible race placements, live Electron export/recovery topology, and actual
provider audit usefulness. The additional source controls below narrow these gaps. Missing/failed/skipped/unrun scenarios block proof.
Keep future measured reports outside the behavior input trees (`engine` and
`desktop`) to avoid changing the measured build when attaching test output.

## Additional authored controls (still NOT RUN)

`common/inquello_authorization_driver.rs` is the single retained-child driver.
Both adapters have source tests for no initial authority/no dispatch, allowed
execution/reopen, peer-private/foreign thread and permission consumption, same
principal switched to another Workspace, model-wait withdrawal, approved
permission pending consumption, and withdrawal after a real shell's started
marker. The shell wait is bounded; release follows withdrawal. Already-started
external effects are not claimed to be recalled. Provider observation continues
through child shutdown; late approval must not create the permitted file.

`inquello-service/src/route_eligibility_fixture_tests.rs` adds ten coupled controls
under **cfg(test), retained-fixtures, debug_assertions, Linux**. They reuse the
isolated PostgreSQL Harness, operator transaction and authenticated checker.
Every ordinary native authority callback is answered only after the service
accepts the hardcoded unit-test proof AND current approval. Shipping operator
and checker reject that proof. Route/model/deployment/API/account match the
actual child configuration; callbacks use the actual Task ID once start returns
and a fresh nonce. Preparatory callbacks lack an actual retained Task ID.
Native creator/run ownership is independently checked by the child. This is
**service-decision → retained synthetic boundary coupling**, not native real-data
compiled-proof eligibility or real-session binding. No production registry,
native real-data path, public injection route or service binary gains test proof.

```sh
cd engine/codex-rs
# PostgreSQL 18 URL in INQUELLO_TEST_DATABASE_URL; role needs CREATEDB.
cargo build -p codex-app-server --features inference-fixtures
INQUELLO_FIXTURE_APP_SERVER_BIN="$PWD/target/debug/codex-app-server" \
 cargo test -p inquello-service --features test-issuer,retained-fixtures --lib coupled_
INQUELLO_FIXTURE_APP_SERVER_BIN="$PWD/target/debug/codex-app-server" \
 cargo test -p codex-app-server --features inference-fixtures --test inquello_authorization_runtime
```

### Owner-run Electron export/recovery placement (plan, not executable E2E)

Component source: `desktop/test/data-operations.test.ts`, `data-recovery.test.ts`,
`data-import-boundaries.test.ts`, `data-integration.test.ts`; service receipt
controls: `inquello-service/tests/route_eligibility.rs`. Run the components first:
`cd desktop && pnpm test -- test/data-operations.test.ts test/data-recovery.test.ts test/data-import-boundaries.test.ts test/data-integration.test.ts`.
These do not replace Electron/native/service end-to-end evidence.

1. Use a disposable profile, fictional data and isolated PostgreSQL. Build the
   ordinary native artifact and desktop. Start existing topology:
   `cargo run -p inquello-service --features test-issuer --bin inquello-dev-topology -- --config-out /tmp/inquello-authority.json --seed-workspace Fixture --seed-out /tmp/inquello-workspace.json`.
   Set `INQUELLO_SERVICE_CONFIG` to that file, launch desktop with documented
   runtime configuration, sign in and accept the invite. Never use a personal
   production profile or real source data.
2. First observe expected denial: the compiled registry has **no passing report**.
   Real-data creation/export/import cannot become eligible through this topology.
   Record the block, not a pass/skip; do not manufacture passing proof.
3. Only after independently reviewed exact-build evidence and scoped operator
   approval exist, create fictional procurement Task output on each actual route.
   Export via Local Data; capture manifest digest/receipt ID, not credentials or
   source text in public logs. Delete all local categories including export
   journal; reimport the archive as the same principal with current access.
   Verify native ownership and byte hashes, not merely success UI. Do not edit
   SQLite to manufacture provenance.
4. Repeat under peer/other-company principal, withdrawn membership, wrong digest,
   missing receipt and authority outage. Require denial before publication and
   no partial imported family. Receipt possession cannot grant current access.
5. Place withdrawal after receipt validation and before final copy/publication
   using deterministic DataOperations test barriers. There is no live Electron
   barrier/control API currently: an Electron automation binding remains to be
   authored. Manual timing does not establish this race. Preserve competing
   destination and cleanup assertions.
6. Restart/recovery must recheck authority; historical progress, imported labels
   and previous approval responses must not restore retained data access.

Actual provider usefulness requires explicit owner-approved account, cost
permission and credentials entered through normal credential flow. Fixture SSE
and seeded arithmetic do not prove provider reasoning, availability, production
HTTPS behavior or audit quality. No paid calls, deployment or real approval
occurred. Keep reports outside measured engine/desktop trees.

## Review-loop-2 cancellation and native inventory controls (authored, not run)

The running-tool withdrawal selector writes its actual shell PID before its
started marker. Before withdrawing authority it verifies the host-visible Linux
process command and starttime. After a denied current decision it continues
servicing ordinary callbacks until that original process has exited (or is a
zombie), then and only then releases the late-effect gate. The late marker must
remain absent through runtime shutdown. A token cancellation or withheld output
alone is not passing evidence. Unknown `/proc` failures or a PID namespace that
prevents identifying the shell fail the fixture; they are not reported as a
successful stop. The allowed local-effect control is unchanged.

`inquello-adapters/tests/task_runs.rs::native_inventory_binds_rollouts_and_task_files_to_actual_store`
uses actual temporary SQLite stores, native reservation/thread binding, runtime
home and Task-root files. It checks exact owned hashes/categories, excludes an
unbound Task folder and refuses foreign peer/unbound/malformed rollout headers
without any returned file list. Unix symlink refusals cover both roots. This
source remains uncompiled/unrun while Cargo is absent and does not certify
Windows or positive real-route organizational eligibility.
