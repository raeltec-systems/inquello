# Story 1.28 — current-route authorization source and acceptance gates

Status: **in-progress**. Source implementation and isolated test source are authored. Native compilation/execution, complete route evidence, matching protocol generation, target Windows and separately authorized provider acceptance are not established. No production approval, deployment, paid inference or eligibility promotion occurred.

## Implemented boundary

- Exact versioned route/configuration/build/platform/data-policy evidence is a compiled maximum, independent of current revisioned operator approval. Missing/failed/skipped/unknown/mismatched evidence denies Real use. Responses and Messages do not inherit proof from one another.
- Service principal → session → Workspace locking, fresh decisions and approval revocation govern use; expiry is checked after lock waits. Historical receipts are never leases. Synthetic service-coupled fixtures call actual authenticated decision handlers with fixed unit-test proof, never the shipping compiled register or a real-data fixture session.
- Native creator-private Task/thread/raw API checks, current dispatch/disclosure/persistence guards, cancellation, terminal-safe retained reads and recipient-specific output checks are authored. Non-serialized fences survive native output queues to final stdio write admission. Observed invalidation suppresses queued protected payloads and completion receipts; RPC responses settle with a content-free unavailable error, while notifications remain suppressed. Already admitted OS/sink bytes cannot be recalled. Unsupported remote private replay is refused, not enabled or certified.
- Native `create_task` atomically records `draft_metadata` creator/Workspace provenance independently of inference tier. Thread/start/history/source/artifact/derived attachment invalidates that draft-only scope. Draft metadata remains current-owner/current-Workspace controlled; it is not classified synthetic or approved for model processing. Mixed trees keep authorized work and only expose safe unavailable IDs already proven creator-owned and currently Workspace-visible.
- Main strictly carries native classification and current service session; old async session/listing/provenance responses cannot revive newer fences. A failed data check permanently invalidates that inspection object. Renderer clears withheld progress/announcements/caches while preserving same-owner drafts.
- Quiescent native inspection binds SQLite schema/ownership/journals, actual bytes and Task folders/rollouts. Unknown/legacy/mixed/opaque data is unavailable, not a silent successful empty export. Opaque logs are excluded. Native draft-only metadata may export under current Export and local-data policy without inventing inference-route eligibility.
- Authenticated-service immutable manifest hash receipts preserve the approved same-device export/delete-all/reimport flow after the local journal is deleted. Restore independently verifies native bytes/ownership and current access/route policy before/after work. Receipts store no source bytes, file paths or credentials and grant no rights. They authenticate an earlier authorized request/hash, **not remote attestation**: forgery of labels in attacker-supplied already-possessed content remains an integrity residual. Current Workspace refusal and foreign-principal receipt lookup still deny access.
- Recovery remains staged/atomic for DB families; failed current validation quarantines newly restored files. Interrupted-recovery markers survive ordinary category deletion and block restart until successful validation or verified protected-category deletion. No hidden receipt retention. Surviving export paths are displayed only for the same current recorded owner after awaits; unknown/foreign paths receive a generic surviving-copy notice. Deletion remains available and never removes external copies.

## Source coverage, not execution evidence

`engine/codex-rs/app-server/tests/INQUELLO-AUTHORIZATION-FIXTURES.md` records exact isolated setup and owner/Electron controls. `tests/fixtures/inquello-authorization-evidence-not-run.json` maps 34 required route/scenario rows to executable source or explicit owner plans; all remain **not-run**, eligible false, no measured artifact/proof hash.

- Ten retained-child selectors: each enabled adapter has allowed/reopen/peer/company, denied-before-dispatch, model-wait, permission-pending and running-tool withdrawal cases. Loopback pinned HTTPS, one-use transport bindings/tombstones and no paid fallback.
- Ten service-coupled selectors: existing isolated PostgreSQL Harness and private `cfg(test)` proof seam gate the retained **synthetic** path. Actual native Task IDs are used once available; preparatory checks precede Task creation. These do not prove positive production real-data eligibility.
- Domain/service/adapters/native queue tests cover strict proof edges, approval lifecycle/order/idempotency, additive migration, receipt owner/tamper/current revocation, actual native draft creation/invalidation, safe mixed trees and final writer fencing.
- Desktop executed tests use explicitly labeled fake native/service seams where stated. They are not substitutes for native inspection, service PostgreSQL execution or actual model usefulness.
- Live Electron export/recovery and actual-provider procurement usefulness remain precise owner-run controls in the fixture guide, not silently counted as automated native passes.

## Verification

Historical round-0 results, 2026-10-31 (superseded by review-loop-1 results below; logs under `_bmad-output/implementation-artifacts/validation/`, outside measured engine/desktop behavior inputs):

- `cd desktop && pnpm exec tsc -p tsconfig.build.json --noEmit`: exit 0; repeated after moving the fixed inspector launcher into the runtime privilege boundary.
- `cd desktop && pnpm run build`: exit 0 (main + renderer typecheck, 19-category data-policy validation, Vite build). Existing pnpm-setting and Vite config-loader warnings only; restored fonts/design assets no longer fail.
- `pnpm exec vitest run test/data-authority-fences.test.ts test/authorization-negative-suite.test.ts test/data-operations.test.ts test/data-recovery.test.ts test/data-local-data.test.tsx test/organise-units.test.ts test/organise-shell.test.tsx test/tasks-service.test.ts test/tasks-bootstrap.test.ts test/tasks-progress.test.ts test/tasks-progress-shell.test.tsx test/routes-shell.test.tsx test/capabilities-units.test.ts test/capabilities-shell.test.tsx --configLoader runner`: **14 files / 328 tests passed**, exit 0.
- First `pnpm test`: 48 files passed / 14 failed / 1 skipped; 1,341 tests passed / 13 failed / 5 skipped. Eleven affected regressions were investigated and corrected, not relabeled environmental: launcher location, current-service state mocks, category/ownership and explanatory-text expectations.
- `pnpm exec vitest run test/security.test.ts test/states-units.test.ts test/data-policy.test.ts test/policy-shell.test.tsx test/data-authority-fences.test.ts --configLoader runner`: **5 files / 218 tests passed**, exit 0 after corrections.
- Final `pnpm test`: **52 files passed / 10 failed / 1 skipped; 1,352 tests passed / 2 failed / 5 skipped**, exit 1. Nine integration suites cannot resolve the absent matching native binary. The two remaining assertions require Git tree metadata and the complete generated protocol set (48 present versus the stamped expected set). This is **not a green full suite**. No schema stamp/generated bytes were fabricated to hide failures.
- Native attempts: `cargo fmt --check`; `cargo check -p inquello-service -p codex-app-server`; `cargo test -p inquello-domain`; `cargo test -p inquello-adapters`; `cargo test -p inquello-service --features test-issuer`; `cargo test -p inquello-service --features test-issuer,retained-fixtures --lib coupled_`; `cargo test -p codex-app-server --features inference-fixtures --test inquello_authorization_runtime`; `cargo test -p codex-app-server --test inquello_behavior_fingerprint`; `cargo test -p codex-app-server-transport`; focused terminal-accounting regression: **all exit 127, cargo unavailable**. No Rust/PostgreSQL/fixture execution claimed.

Parent source review identified an additional terminal-accounting race after later disclosure checks: all three event boundaries now share a denial helper that suppresses payload while recording content-free terminal outcome. Passing checks never mark terminal early. The boundary 1/2/3 regression is authored but unrun. Restored baseline transport tests were updated only for the new non-serialized fence field.

Protocol generation was not run: no matching native build exists. Generated files were not hand edited. Three independent BMAD review layers are pending at this handoff.

## Remaining gates and residuals

1. Cargo/rustc/rustfmt are absent. All authored Rust, PostgreSQL, migration, retained-child and transport-write tests remain uncompiled/unrun; source compatibility cannot be certified by a static scan.
2. Complete reviewed passing exact-route proof and actual organization approval are absent. Capabilities remain synthetic-only/disabled exactly as before. Pending support reference is non-authorizing.
3. Matching native protocol generation and Windows Electron/sandbox/provider controls carry forward from Stories 1.21–1.27. No fixture binary may be packaged.
4. Principal-level observed invalidation conservatively suppresses other queued work for that principal; fresh revalidation is needed. No wall-clock atomicity or rollback of already-dispatched external effects is claimed.
5. Recovery accepts only native-provable categories/stores. Legacy Tasks without native provenance and mixed/opaque content require explicit revalidation/migration, not imported claims. Cross-host ownership transfer remains gated.
6. Remote private replay is fail-closed unsupported. Current desktop stdio is the required transport; this story does not add a remote product.


## Review loop 1 — corrected derivation (2026-10-31)

The frozen intent is unchanged. Positive domain/protocol/service/receipt/native/UI controls were reused from the preserved reviewed source; the known-bad coordination paths were rederived, not accepted unchanged. No route was promoted and all native evidence report rows remain not-run.

- Recovery now pins a recursively frozen snapshot of the inspected, service-receipted manifest. Low-level import executes that plan, refuses changed source metadata and checks every copied byte against its original hashes. Cleanup follows the attempted plan. The same service receipt and fresh authority are checked again after publication before clearing the recovery marker. Deterministic fixtures cover mutable archive metadata/bytes during receipt waits, post-publication withdrawal, failed quarantine moves/no restart, and successful same-device delete-all recovery.
- Native Task reservation, request/run/settings/route records and trusted tier provenance commit in one SQLite transaction. Failed provenance insertion rolls back the whole reservation; replay cannot reclassify the original tier. The classification enum is native-only, not a renderer input.
- Successful Workspace listings, including empty removals, publish through ordered observation tickets. Older allowed completions cannot republish removed metadata; older failures cannot invalidate newer admitted authority.
- Native bootstrap checks a connection publication generation and rejects admission during identity transitions or after close. A scoped transition count handles concurrent resets and dropped futures without reopening admission. Tests cover reverse completions, bootstrap admitted during a same-principal reset wait, already-waiting bootstrap, overlapping transitions and closed connections.
- Completion-before-start-ack cannot resurrect activity. Unknown/revoked work stays uncertain until the trusted native stop lifecycle proves quiescence; Local Data can attempt that lifecycle without requiring application restart. Stop failure retains bookkeeping and prevents data effects. A disconnected/not-ready flag alone is not quiescence.
- Invalidated RPC responses settle with the original request ID and only error code `-32001` / `Private work unavailable`, never protected fields or a fabricated pre-effect claim. Notifications stay suppressed and the original delivery receipt is not acknowledged. Desktop tests use the actual RpcConnection pending request and assert uncertainty/no replay.
- Native private scope retains Task identity through final authorization. A final-scope regression exercises fresh Workspace RPC and real SQLite ownership/provenance: native draft control succeeds, but membership alone cannot disclose an owned Task with unprovable runtime provenance. A cfg(test)-only local configuration fixture does not replace evidence or approval. Domain expiry/withdrawal controls remain separate from the pending actual approved-route integration gate.
- Production DataAuthority real `task_content` tests now assert exact approval/check invocation, export versus recovery-read bindings, rejection, mismatch, stale observations and allowed controls. Fake native inspectors/service seams are labeled. The actual-native roundtrip caller supplies explicit fixture authority and excludes logs; it remains an unexecuted filesystem/lifecycle control, not eligibility evidence.

### Current local verification

Logs are retained in `validation/story128-loop1/`. Native command attempts are recorded verbatim in `native.log`; all exit 127 because Cargo is absent. No Rust, PostgreSQL, retained runtime, migration or formatting pass is inferred. Matching protocol generation was not attempted without a matching binary; no generated output was hand edited.

Final desktop command results are recorded below after the post-publication receipt regression. The full suite remains non-green due to absent-native suite loads and the existing Git/generated-set assertions. Three independent BMAD review layers remain the parent review workflow, not an implementation-agent pass claim.


| Final command (from `desktop/` unless noted) | Actual result |
| --- | --- |
| `pnpm exec tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `pnpm exec tsc --noEmit` | exit 0; includes integration fixture/test typing |
| `pnpm run build` | exit 0; main/renderer typechecks, 19-category policy validation and Vite build |
| `pnpm exec vitest run test/authorization-negative-suite.test.ts test/data-authority-fences.test.ts test/data-recovery.test.ts test/data-operations.test.ts test/tasks-service.test.ts test/organise-units.test.ts test/rpc.test.ts test/tasks-progress.test.ts test/tasks-bootstrap.test.ts --configLoader runner` | exit 0; **9 files / 161 tests passed** |
| `pnpm test` | exit 1; **52 files passed / 10 failed / 1 skipped; 1,372 tests passed / 2 failed / 5 skipped**. Nine suites cannot load the absent matching native binary; the two assertions require Git metadata and the complete generated set (48 present versus 816 stamped). No failing assertion was relabeled a pass. |
| Cargo commands from `engine/codex-rs/`, listed verbatim in `validation/story128-loop1/native.log` | all exit 127, `cargo: command not found`; native tests/build/fmt/service/retained fixtures remain unrun |

The final verification includes the additional post-publication immutable-receipt denial regression and final native source corrections. The first retained desktop stage run had 1,371 passing tests; the final run above supersedes it. All source/owner/Windows/provider gates from prior stories remain separate. Actual eligible-route expiry during a metadata wait still requires the exact approved-route owner integration setup; no production approval or passing evidence was fabricated to make that control execute.

All 48 present generated protocol files were byte-compared with the pinned Story 1.27 checkout: no differences. This confirms no manual generated edits, not completeness or matching generation.

## Review loop 2 — publication ownership and inspector quiescence (2026-10-31)

All loop-1 controls and tests were retained from the preserved reviewed source.
The known-bad rollback and inspector process paths were rederived:

- Low-level import now records a private synchronous publication ledger before
  the next await. Identity is captured from staging before publication; ordinary
  files enter only after successful no-replace linking, and the entire SQLite
  directory enters as one family only after successful rename. Quarantine uses
  only this ledger, validates identities/member sets, and moves whole families.
  Skipped collisions never enter the ledger. Replaced/changed/ambiguous entries
  are not moved; the marker persists and reopening stays blocked.
- Failed inspection requests terminate the actual child, escalate from SIGTERM
  to SIGKILL after a bounded wait, and normally reject only after `close`.
  If close remains unconfirmed after the bounded escalation wait, a process
  gate stays closed; Local Data mutations/reopening are blocked until actual
  close. Signal delivery alone never proves quiescence. Real isolated Node-child
  tests cover delayed SIGTERM handling, ignored SIGTERM/escalation, success,
  nonzero exit, oversized output, serialization failure and failed spawn.
- Production TaskService tests exercise both routeDiscovery and routeCheck
  envelopes, exact callback inputs, rejection, incoming/outgoing binding
  mismatches, malformed inputs and identity/generation changes across awaits.
  Service responses remain explicitly fixtures; native binding validation is
  unchanged and no renderer authority was introduced.
- Actual SQLite native inspector test source now binds real native Task/thread
  records, runtime-home and Task-root files; it asserts exact owned file hashes,
  foreign peer/unbound/malformed rollout refusal with no files, and Unix symlink
  refusal. Authored only: Cargo is absent.
- Running-tool fixture source observes the shell PID/starttime/command before
  withdrawal, then actual termination after observed denial before releasing
  the late-effect gate. It asserts late-marker absence through shutdown. The
  allowed-effect control remains. PID mapping uncertainty fails, never proves
  cancellation. This fixture remains unrun.

Logs: `validation/story128-loop2/`. Build and both TypeScript checks exit 0.
The focused eight-suite command in `focused.log` passed **133 tests** before the
last two inspector error-path controls. Final full-suite results are recorded
below. Cargo fmt/check/domain/adapters/service/retained fixtures all failed to
start with exit 127 (`cargo: command not found`), recorded verbatim in
`native.log`; these are unrun gates, not test failures or passing evidence.
All 48 available generated protocol files remain byte-identical to the pinned
Story 1.27 set. Generation is still unavailable without a matching native build.

No organization approval, provider request, migration deployment, generated
schema fabrication or eligibility promotion occurred. Windows, actual provider
usefulness, actual eligible-route execution, PostgreSQL/native tests, full
protocol generation and independent parent BMAD review remain separate gates.
Receipt credential attestation, aggregate service performance, filesystem
power-loss durability and hostile-OS guarantees were not added or claimed.

### Final loop-2 local results

| Command (from `desktop/` unless noted) | Result |
| --- | --- |
| `pnpm exec tsc -p tsconfig.build.json --noEmit` | exit 0 |
| `pnpm exec tsc --noEmit` | exit 0, including all test source |
| `pnpm run build` | exit 0; typechecks, 19-category policy and Vite build |
| `pnpm exec vitest run test/authorization-negative-suite.test.ts test/data-import-boundaries.test.ts test/data-inspector-lifecycle.test.ts test/tasks-route-authority.test.ts test/data-authority-fences.test.ts test/data-operations.test.ts test/data-recovery.test.ts test/tasks-service.test.ts --configLoader runner` | exit 0; **8 files / 135 tests passed** |
| `pnpm test` | exit 1; **54 files passed / 10 failed / 1 skipped; 1,399 tests passed / 2 failed / 5 skipped** |
| Native commands in `validation/story128-loop2/native.log` | all exit 127, Cargo absent; compilation/formatting/execution unrun |

Full-suite failures are unchanged in kind: nine integration suites cannot load
an absent matching native binary; the two assertions in the tenth failed suite
need Git tree metadata and a complete generated set (48 present, 816 stamped).
The full suite is not green. No native/build/negative-suite success is inferred
from these desktop tests or authored Rust controls. Independent BMAD reviews
are not claimed by this implementation handoff.

## Final reviewed candidate — 2026-10-31

Final retained corrections include streaming UTF-8 inventory paths, actual no-close process gate/late-close DataService regression, ancestry recheck after final authorization wait, zero-recipient native callback settlement, and remote consumer private-payload suppression/receipt controls. Fingerprint normalization tests distinguish behavior/capability changes from excluded report metadata. Unix process/ancestry tests are explicitly not Windows evidence.

The actual CLI already enriched adapter inventory for real Tasks using current native measured identity and compiled evidence. The adapter's null intermediate fields were not a missing production implementation. Its final composition now has native tests with real temporary SQLite route/Task records and private fixture evidence, covering positive serialized fields, missing/mismatched/incomplete proof/configuration/policy and unchanged restrictive production-register refusal. Production lookup remains hardwired; no runtime proof toggle. These tests are authored but unrun.

Final commands/results are in `validation/story128-final/`: both TypeScript checks and desktop build pass; focused actual 11-file selection passes 167 tests; full suite reports 1,403 passed / 2 failed / 5 skipped, 55 files passed / 10 failed / 1 skipped. Nine suites fail collection for missing matching native executable. The two actual schema assertions fail for missing Git metadata and 48 generated files versus stamped 816; none is waived or counted passing. The earlier 10-file focused run used a nonexistent deadline filename filter; corrected final run includes actual data-inspector-gate.test.ts. No source/test expectation was weakened to make these failures disappear.

Native validation commands exit 127 because Cargo is absent. Also run `cargo test -p codex-app-server --bin codex-app-server inspection_composition_tests` after restoring a full checkout/toolchain. Run the standard default Cargo target directory (or output outside measured engine/desktop source); custom in-tree output directories are not supported by the fingerprint exclusions. All 48 present generated files remain baseline-identical, not a claim of complete/matching generation.

Three independent BMAD review layers completed in each of three rounds; retained confirmed findings were corrected and deferred hypotheses recorded individually. Story remains in-progress pending native, protocol, Windows/Electron/provider and user outcome gates. No real-data capability promotion or organization approval was issued.
