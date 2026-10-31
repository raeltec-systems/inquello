# Story 1.27 — untrusted tool-output evidence and owner gates

Status: **in-progress**. Implementation authored; native and actual-provider
acceptance remains unverified. No credentials, paid calls, generated-protocol
edits, permission widening, inspection service or real-data eligibility promotion.

## Implemented boundaries and review corrections

- Shared idempotent host guidance reaches both owned private inference routes,
  preserving existing/empty host instructions without interpolating tool content.
  Structural origin, actual tool identity and opaque continuation remain intact.
- Core/protocol/Anthropic adversarial regressions cover fake roles, delimiter text,
  forged approval and readable benign quotations. Bound Responses HTTP/WebSocket
  tests assert actual outgoing payloads for empty/nonempty bases, exact complete
  adversarial tool identity/content and native opaque continuation restoration.
- Retained ordinary private Task fixtures seed fictional procurement bytes from
  isolated trusted setup into the actual governed Task root before the read.
  Literal script command-rule tokens pass actual CommandRule::new validation.
  Exact raw retained and all subsequent provider source checks replace substring
  checks. A supported nonempty structured publication remains unchecked with no
  human basis despite a source-reference decision claim; extra checks fields are
  separately rejected as invalid schema.
- Static refusal is tied to its native reason and exactly one local-tool ledger
  entry: before_command refuses before accounting/launch. No read/network absence
  is inferred merely from a missing first-write sentinel. Source/policy remain
  unchanged and same-operation replay cannot resample. A genuine first one-use
  approval is consumed, cannot be consumed twice, and does not authorize the
  changed second command, which requires fresh handling and is denied.
- Existing exact authority, sandbox, destination, denial, cancellation and live
  revocation controls are unchanged. No new production fixture API was needed.
- Desktop keeps source text inert/readable and distinguishes native execution
  status from untrusted stdout, including quoted refusal/inspection claims in
  successful and failed output. Role/basis spoofing, incomplete evidence and
  keyboard focus regressions remain. No universal injection verdict is claimed.

## Verification — review correction 1, 2026-10-31

Stages ran sequentially: native → runtime → desktop → source-grounded fixture
framing correction → evidence. Read-only preparation was concurrent; edits and
verification were not. The earlier first-pass process deviation remains historical
in the spec; it did not recur in this correction.

- `cd desktop && pnpm exec tsc -p tsconfig.build.json --noEmit`: exit 0.
- `cd desktop && pnpm run build`: exit 0, five missing IBM Plex font warnings
  and existing configuration warnings remain.
- `cd desktop && pnpm exec vitest run test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx`:
  **2 files / 76 tests passed**, exit 0.
- `cd desktop && pnpm test`: exit 1; **48 files passed / 12 failed / 1 skipped;
  1,235 tests passed / 3 failed / 5 skipped**. Missing native binary, imported
  design assets, Git metadata and generated protocol subset remain failures.
  Permission shell regressions passed within this run. This is not a green suite.
- Native commands: `cargo test -p inquello-protocol`,
  `cargo test -p inquello-adapters anthropic`,
  `cargo test -p codex-core inquello_inference`,
  `cargo test -p codex-core bound_responses_`,
  `cargo test -p codex-app-server progress_tests`,
  `cargo test -p codex-core private_command_tests`,
  `cargo check -p codex-core -p codex-app-server`, `cargo fmt --check`, fixture
  build/test: **all exit 127, cargo unavailable**. No native pass, formatting,
  compilation or retained execution claimed. No fixture binary copied or run.
- Logs: `desktop/validation/story127-native-loop1.log`,
  `story127-round1-runtime.log`, `story127-loop1-framing.log`, and
  `story127-loop1-desktop-{tsc,build,focused,full}.log`.
- Post-evidence register validation: `pnpm --dir desktop exec vitest run test/capabilities-units.test.ts test/capabilities-shell.test.tsx`: **2 files / 114 tests passed**, exit 0; `desktop/validation/story127-loop1-register.log`.
- Command formatter was restored read-only at pinned source commit
  `ce9c93e14c4bae21a8336265c5bb9c0ecef6cae9`, verified blob
  `c80a89ddd1fe2adb5a36b36016cdd5f4a3198b43`. The exact provider frame assertion
  follows ExecCommandToolOutput::response_header (`Output:`, terminal exit status,
  optional numeric token accounting), retaining full source equality. Restored
  baseline source is not a product change or native execution evidence.

Exact isolated retained fixture commands:

```sh
cd engine/codex-rs
CARGO_INCREMENTAL=0 cargo build -j 4 -p codex-app-server --features inference-fixtures
cp target/debug/codex-app-server /tmp/inquello-story127-app-server-fixture
INQUELLO_FIXTURE_APP_SERVER_BIN=/tmp/inquello-story127-app-server-fixture \
  CARGO_INCREMENTAL=0 cargo test -j 4 -p codex-app-server --features inference-fixtures \
  --test inquello_messages_runtime -- --nocapture
```

Restore default-feature packaging afterward; never package fixture behavior.
Auditor walkthrough and variant oracle:
`engine/codex-rs/app-server/tests/INQUELLO-UNTRUSTED-OUTPUT-FIXTURES.md`.

## Verification — review correction 2, 2026-10-31

Re-derived preserved positives after loopback reset, then sequential native →
retained fixture → desktop → evidence stages. No parallel implementation workers.
A shared golden JSON omission correction was made at desktop integration: native
optional role/application fields are absent, not null. The golden is asserted by
native projection and retained runtime tests and consumed by the mounted renderer;
it is authored conformance evidence, not a captured passing native execution.

- Actual `before_command` errors now emit the existing native
  `ToolEmitter::unified_exec` `Failure(Message)` completed-command event before
  returning. This records failed/-1/zero duration/no process ID, exact action and
  available reason. No Begin, process launch, extra grant, retry or stdout
  classification is introduced. Ordinary successful stdout printing the same
  refusal stays completed. Existing authorized progress accepts this command row.
- Read-only pinned `tools/events.rs` API and `protocol/item_builders.rs` were
  inspected: completion emits a full command item without requiring Begin;
  command presentation uses redacted shlex joining, and Fatal has its native
  `Fatal error:` display prefix. Neither baseline file is a product change.
- TLS fixtures now remain listening until explicit host stop after replay RPC and
  exact durable turn/usage-attempt equality. Unexpected connections fail while
  observing. Handshake/read/write/shutdown and stop waits are bounded; the
  observer deadline fails, never passes, the test. No 300 ms success window.
- Exact projected duplicate text, source evidenceIds, attempted-basis contents,
  unchecked/no-basis status, retained refusal and shared projected refusal shape
  are asserted. K12,480 and distinct INV-105/K3,600 remain explicit.
- `pnpm exec tsc -p tsconfig.build.json --noEmit`: exit 0.
- `pnpm run build`: exit 0; existing font/configuration warnings remain.
- Focused progress suite: **77 passed / 2 files**, exit 0. Initial added test
  failed because its parser-produced session generation differed from the mounted
  fixture, correctly remounting the question. Test identity was aligned and rerun.
- `pnpm test`: exit 1; **48 files passed / 12 failed / 1 skipped;
  1,236 tests passed / 3 failed / 5 skipped**. Same missing native binary, imported
  assets, Git metadata and generated protocol subset gates; not a green suite.
- All specified cargo test/check/fmt commands and retained fixture build/test
  attempted: **exit 127, cargo unavailable**. No native execution/compile pass.
- Logs: `desktop/validation/story127-loop2-native.log`,
  `story127-loop2-runtime.log`, and `story127-loop2-desktop-{tsc,build,focused,full}.log`.

- Post-evidence capability register regressions: **114 passed / 2 files**, exit 0;
  `desktop/validation/story127-loop2-register.log`.

## Open acceptance gates and risks

1. Full pinned native compile/format/test and retained fixture execution: unknown
   likelihood/high impact. Authored source assertions are not passing evidence.
2. Separately owner-authorized real-provider evaluation on both supported routes:
   unknown likelihood/high impact. Scripted final answers prove no analytical
   resistance. INV-104 must remain a two-occurrence duplicate candidate citing
   PAY-081/PAY-096 with K12,480 potential exposure; INV-105 is distinct at K3,600.
   Include benign, ordinary and differently phrased malicious notes. Record
   route/model/API/version and outcomes. Suppression or unauthorized effects fail
   acceptance; no invented fraud, recovery, check or professional approval.
3. Target Windows Electron permission/sandbox and keyboard/focus validation:
   unknown likelihood/medium-high impact; DOM tests are not platform acceptance.
4. Independent BMAD reviews and triage are owned by dispatch parent and pending
   this handoff. No review pass fabricated.
5. All earlier native/protocol/provider/Windows/organizational gates and the
   conditional SQLite writer-contention residual remain open and unchanged.

## Focused final-fence correction — 2026-10-31

- Unified the existing `before_command`, subsequent `before_tool_effect`, and
  cancellation checks behind one native completion-reporting boundary. Each
  failure emits exactly once before returning the original ToolError variant;
  no Begin/process launch, public schema or stdout classification is introduced.
  Registry-owned accounting finalization remains unchanged.
- Added bounded core lifecycle regression for late fence failure after a mock
  reservation, authority-token cancellation and turn-token cancellation. It
  checks exact call/command, failed completion/-1/zero duration/no process ID,
  no Begin or second event, and caller-owned finalization with failure. These
  counters prove the helper contract, not durable SQLite accounting; retained
  runtime coverage remains a separate unrun gate.
- Scripted `curl https://unlisted.invalid/register` has no upload body and does
  not transmit register bytes. It tests pre-execution refusal of an action
  proposing writes, an outside read and unlisted destination contact, **not**
  attempted register-upload prevention. The owner-run unauthorized-transfer
  outcome remains required and separate.
- Only targeted verification attempted:
  `cargo test -p codex-core private_pre_execution_late_fence_and_cancellation_complete_once_without_begin`
  exited **127: cargo unavailable**. No compilation/execution pass claimed.
  Log: `desktop/validation/story127-final-fence-native.log`. No wider suite rerun;
  parent owns subsequent full verification and review.

## Final owner verification and review disposition

All three independent BMAD layers completed across three passes; no layer skipped. Individual verdicts and likelihood/impact are in the specification. Final localized patch makes pre-execution publication cover before_command, the final authority fence, and both cancellation tokens exactly once, preserving original ToolError variants. Its bounded lifecycle regression uses actual event emission with mock accounting counters; it is not proof of durable accounting execution. The retained app-server fixture separately asserts durable accounting. Both native tests remain unrun.

After all product edits: main TypeScript and build passed; **5 files /203 focused tests passed**,8.73s. Full suite **48 files passed /12 failed /1 skipped;1,236 tests passed /3 failed /5 skipped**,50.04s,exit1. Nine collections fail because the app-server binary is absent; one collection lacks imported icon assets. Three assertions fail for absent Avatar SVG, unavailable Git metadata, and48 generated files versus816 in the stamp. These are actual failing results with identified environmental inputs, not a passing suite. Five existing font warnings remain. Logs: `story127-final-{tsc,build,focused,full}.log`.

Final fence test command: `cargo test -p codex-core private_pre_execution_late_fence_and_cancellation_complete_once_without_begin`; attempted exit127, cargo not found (`story127-final-fence-native.log`). No protocol surface was added. The48 available generated files and stamp are verified baseline-identical; complete generated/native matching remains a prior gate.

### Remaining risk, distinct from fixed findings
- Actual model analytical resistance: unknown likelihood/high impact; guidance and structural attribution do not guarantee that a model will report the duplicate. Owner-run real-provider variant evaluation is required before acceptance.
- Native compatibility and lifecycle execution: unknown likelihood/high impact; source APIs were narrowly restored/hash-verified, not compiled. Full pinned build/format/test and native fixtures remain required.
- Windows Electron and full supported-route retained flows: unknown likelihood/medium-high impact. Mounted DOM and mocked transport are not end-to-end platform acceptance.
- Failure text remains source text, not an authenticated inspection verdict. Native status is authoritative only about execution failure; a failed program can print misleading text. UI deliberately supplies no automatic detection/approval cue. Conditional/medium human-interpretation risk; manual auditor review remains necessary.
- Inherited bounded history/cumulative plan and SQLite writer-contention residuals remain as documented in1.26; this story adds no completeness guarantee or authority bypass.
- Extra combinatorial benign-only retained, failed-source transport and reused-WebSocket cases were rejected as low additional coverage absent a demonstrated changed defect; the actual-provider/Windows acceptance matrix still includes benign and varied sources.

### Completion commands on the full pinned checkout

```sh
cd engine/codex-rs
cargo fmt --check
cargo check -p codex-core -p codex-app-server
cargo test -p inquello-protocol
cargo test -p inquello-adapters anthropic
cargo test -p codex-core inquello_inference
cargo test -p codex-core bound_responses_
cargo test -p codex-core private_command_tests
cargo test -p codex-core private_pre_execution_late_fence_and_cancellation_complete_once_without_begin
cargo test -p codex-app-server progress_tests
cargo clippy -p codex-core -p codex-app-server --all-targets
# Run the isolated retained fixture build/test above, then rebuild default binaries.
cd ../../desktop
pnpm run generate:protocol
pnpm exec tsc -p tsconfig.build.json --noEmit
pnpm run build
pnpm test
```

Protocol generation requires the complete Git checkout and matching runtime; never hand-edit generated files. Target Windows seeded Electron and owner-authorized actual-provider walkthrough follow the fixture guide. Use representative fictional procurement records through normal UI, not an assertion that scripted outputs prove the product outcome.
