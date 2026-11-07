---
title: 'Story 1.23: Show local execution separately from inference'
type: 'feature'
created: '2026-10-30'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
source_commit: '79de4157ec210a96e46618e91383e4426e7aa3ca'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A local window does not prove local inference. Tasks lack clear environment facts and unavailable-environment refusals.

**Approach:** Separate authoritative location facts; enforce availability at existing tool execution, without model-start functionality.

## Boundaries & Constraints

**Owner decision (2026-10-30):** Fixed local environment; no selector or selection persistence.

**Always:**
- Show execution as “This device (local host)”, separately from runtime readiness, sandbox checking and inference. Readiness includes verified runtime-owned configuration, not sandbox or inference eligibility.
- Inference uses the Task's explicit route: provider, deployment, endpoint, model/API and known region or “Unknown”. A successful empty selection means “No processing route selected”; failed/stale reads mean unavailable/stale, never “no route” or local inference.
- Remote/cloud execution is not enabled. Show Story 8.1's gate: proven service, identity, context transfer, mutation ownership, policy eligibility and recovery. Collaboration hosting is not execution. Hosted browser/sandbox is separately “V2 revisit (OQ-13)”. Never upgrade eligibility.
- Inspection creates no folders, probes, grants or selections. Discard stale Task/principal/runtime responses; sanitize errors and allow accessible refresh.
- Starting existing tools rechecks current environment, authority and sandbox, including after permission waits. Runtime loss/replacement fails closed with the local environment named. Never restart, relocate, change provider or reuse stale authorization silently. Existing explicitly permitted Full access semantics remain unchanged.
- Preserve drafts, identities and states; reuse tokens, keyboard behavior and minimum-width layout.

**Never:** New remote backend, inferred host region, credentials in UI, real credentials/paid calls, automatic uploads, new dependencies, Task/thread-start UI (1.25), or manually edited generated files.

## I/O & Edge-Case Matrix

| State | Result |
|---|---|
| Local runtime ready, selected cloud inference | Distinct local execution and configured cloud inference facts; eligibility remains separate |
| No explicit route / read fails | “No processing route selected” / “Inference information unavailable”, respectively |
| Runtime starting, stopped, failed or replaced | Named local-environment unavailability; no tool dispatch or relocation |
| Permission wait then runtime/policy changes | Refuse before execution; preserve pending work and route |
| Unknown sandbox status | “Not checked”; viewing runs no probe |
| Other principal, unknown Task, late response | No private metadata disclosure; stale result discarded |
| Remote/cloud options | Not enabled, with gate; no dispatch/selection/transfer |
| Keyboard/narrow layout | Reachable controls, wrapping, preserved draft |

</frozen-after-approval>

## Code Map

`desktop/src/main/policy/service.ts`: `taskContext(taskId,false)` reads without folders. `main.ts`: readiness includes `runtimeConfigurationVerified`. Runtime dispatch already refuses after exit.

Reuse `desktop/src/main/routes/{service,types}.ts` (`forTask`, `TaskRouteView`); retain existing inference-selection UI.

Native `execution_policy/effective.rs` fixes `LocalDevice`; retain it.

## Tasks & Acceptance

- [x] `desktop/src/main/environments/{types,service}.ts` — combine private policy, readiness and route facts; validated, lifecycle-safe, no probes.
- [x] `desktop/src/main/{main.ts,security/operations.ts}`, `src/preload/preload.ts` — bounded read/notification; retain sender validation and invalidation.
- [x] `desktop/src/main/policy/service.ts` — reuse local preflight in actual `runTool`; preserve policy/sandbox and post-wait checks.
- [x] `desktop/src/renderer/Shell/{TaskEnvironment.tsx,TaskView.tsx,shell.css}` — distinct labelled facts, disabled gates and refresh; no inference-start control.
- [ ] `engine/codex-rs/inquello-domain/register/{capabilities,inventory-map}.json`, `tests/capability_register.rs` — record disabled remote/cloud gates; no eligibility change.
- [x] `desktop/test/{environments-units.test.ts,environments-shell.test.tsx,policy-units.test.ts,security.test.ts}` — test the matrix, actual preflight callers, no read probes, late responses and zero dispatch after runtime replacement.
- [ ] `desktop/src/main/smoke-probe.ts`, `FORK-CUT.md`, story/tracker — environment smoke and truthful validation record.

**Acceptance:** Given a Task, when its panel renders, execution/inference and remote gates are distinct (1.23.1). Given unavailable execution, when tool work starts, refusal names the environment without relocation (1.23.2). Story 1.25 reuses the boundary for model starts.

## Implementation Notes

- Added `EnvironmentService` and validated presentation types, private Task policy inspection without folders/probes, bounded IPC/preload read and invalidation notifications. Only explicit selected inference facts cross the environment boundary; no account references, credentials or eligibility upgrades are included.
- Added reusable `localPreflight`, actual `runTool` checks before context/probe/dispatch and after permission waits, plus stale output rejection. Main readiness continues to include `runtimeConfigurationVerified`.
- Added Task environment panel, accessible refresh, disabled remote/hosted gates, token-based wrapping, response-generation guards and draft preservation. Corrected existing processing-route inspection to distinguish failed/stale reads from empty selection and sanitize read errors.
- Added disabled `execution.remote-cloud` capability and native assertion, with no LocalDevice/eligibility changes. The generated inventory map is intentionally unchanged: planned rows prohibit register references/deferral reasons and must not be relabelled enabled to cite a disabled entry. Its native generator gate remains incomplete.
- Added environment smoke report to the existing smoke run. No model/provider calls or real credentials were used. No dependencies or generated schemas were authored.


## Spec Change Log

## Review Triage Log

### Round 1 — 2026-10-30

Each finding was judged individually before grouping. Likelihood/impact describe the observed trigger, not a claim of production frequency. All surviving fixes fit existing internal boundaries; no new public operation, storage model or product decision is needed.

| ID | Verdict / route | Likelihood / impact | Evidence |
|---|---|---|---|
| B1 | high / patch | Low / High | `runTool` checks after awaited dispatch can use the preflight “Nothing will run; refresh and try again” reason despite completed effects. Post-dispatch uncertainty must not invite blind mutation retry; cover successful and rejected dispatch losing runtime continuity. |
| B2 | false / reject | — | Known runtime readiness is required before private Task policy/route facts can be read. An unavailable runtime returns a sanitized failure; the panel still names the local host and says runtime information is unavailable. The unused richer unavailable fixture branch does not establish a false user claim or require disclosing cached private facts. |
| B3 | medium / patch | Medium / Low | A completed sandbox probe updates the runtime-scoped cache but sends no environment notification. A mounted snapshot can remain Not checked until manual refresh. Notify via existing main runtime-request wiring after probe settlement; no new public operation. |
| B4 | medium / patch | High / Medium | Every existing 30-second Task route refresh clears rows, unmounting a focused selection control. Keep rows stale/disabled during ordinary refresh; clear promptly on invalidation, failures and Task changes. |
| B5 | low / patch | Low / Low | Presentation parser accepts contradictory selected/none metadata. Add consistency checks to the existing parser and focused malformed-response tests; no contract expansion. |
| B6 | false / reject | — | Loading a coherent private snapshot waits for bounded policy/route reads and displays unavailable rather than claiming false readiness. A failed route read preserves independently obtained execution facts once settled. Independent progressive rendering/latency was not promised; splitting the existing read is not required to correct an established false fact. |
| B7 | medium / patch | Medium / Medium | Smoke reads IPC only, so it cannot detect missing Task component wiring. Extend the existing seeded smoke to open the actual Task and inspect rendered environment facts/gates. Execution remains an owner-run native/Electron gate. |
| B8 | medium / patch | Medium / Medium | New IPC rejection tests have no service spy or positive invocation. Assert valid dispatch and zero calls for invalid payload/untrusted sender through the real operation registry. |
| B9 | false / reject | — | Actual `PolicyService.inspectEnvironment` is exercised by a passing test asserting no Task directory and zero tool dispatch; source tracing confirms `taskContext(false)` and cached-only sandbox read, while route.forTask does not call credential bind. The proposed extra native dispatch counter is redundant instrumentation, not evidence of an uncovered reachable side effect. Native smoke limitations remain explicit. |
| E1 | high / patch | Low / High | Same verified post-dispatch uncertainty defect as B1; preserve its trigger and consequence in that correction group. |
| V1 | medium / patch | Medium / Medium | Filed regression evidence accepted: service projection assertions omit deployment/endpoint/model/API and known region. Assert the full actual projection, not only independent renderer fixtures. |
| V2 | medium / patch | Medium / Medium | Filed regression evidence accepted: fake callbacks bypass production main/preload notification. Extend seeded smoke with an actual route/runtime transition and rendered invalidation; do not count unrun smoke as passing. |

Groups: B1+E1 share post-dispatch outcome handling; B3, B4, B5, B7, B8, V1 and V2 retain their distinct causes. Patch only; no intent or architectural loopback is required. Native and actual Electron verification remain unmet under the owner's accepted environment limitation.


## Verification

In `desktop`: `pnpm run build`; `pnpm exec tsc -p tsconfig.json --noEmit`; `pnpm exec tsc -p tsconfig.renderer.json --noEmit`; focused tests above; `pnpm test`; seeded isolated `pnpm smoke`. In `engine/codex-rs`: `cargo test -j 4 -p inquello-domain --test capability_register` and `cargo fmt --all -- --check`.

Partial non-Git workspace; 1.21/1.22 native/generation gates remain separate. Record exact supported/blocked checks and owner follow-up; authored tests are not acceptance evidence.

### Execution record — 2026-10-30

- `pnpm run build`: passed (existing missing-font/Vite warnings).
- `pnpm exec tsc -p tsconfig.json --noEmit`: passed.
- `pnpm exec tsc -p tsconfig.renderer.json --noEmit`: passed.
- `pnpm exec vitest run --configLoader runner test/routes-shell.test.tsx test/environments-units.test.ts test/environments-shell.test.tsx test/policy-units.test.ts test/security.test.ts`: **230/230 passed, 5 files**.
- UI regression run `test/shell-layout.test.tsx test/organise-shell.test.tsx`: **36/36 passed**. These jsdom checks do not prove actual Electron minimum-window rendering.
- `ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm test` (source-frozen final run): **1084 passed, 3 failed, 5 skipped; 40 files passed, 12 failed, 1 skipped; exit 1**. The three failing assertions are missing imported logo source, missing Git HEAD:engine, and generated-file count 48 versus stamped 816. Nine suites cannot collect without codex-app-server; one cannot collect without imported design icons. These are observed failures in the partial workspace, not a full-suite pass or proof that a complete checkout will pass. No Story 1.23 focused failure remains. Full suite is not accepted.
- Isolated `TMPDIR`, `CODEX_HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` `pnpm smoke`: build passed, smoke **blocked** because the Electron binary is missing/failed installation. The launcher attempted its built-in download and failed; no installation was completed. Seeded topology/matching native binary are also absent, so this is **not seeded smoke acceptance**. Further checks use `ELECTRON_SKIP_BINARY_DOWNLOAD=1`; no dependency installation was performed.
- `cargo test -j 4 -p inquello-domain --test capability_register` and `cargo fmt --all -- --check`: both **blocked, exit 127 (`cargo: command not found`)**.

Owner follow-up: restore the matching complete native/toolchain/Git/schema and imported asset inputs, run the genuine inventory generator without eligibility changes, execute native capability/fmt gates, and run seeded isolated smoke plus actual Electron keyboard/minimum-width inspection. Keep this story in progress until those acceptance gates pass; authored tests and source inspection are not native acceptance evidence. Prior 1.21/1.22 gates remain independent.

### Final review correction and presentation record

All three independent review passes returned; twelve findings were individually triaged above. Surviving corrections are implemented: uncertain post-dispatch outcomes do not invite duplicate execution, sandbox-probe settlement invalidates displayed facts, ordinary route refresh preserves focus while Task invalidation clears private facts, inference parsing is status-consistent, IPC rejection/positive-dispatch assertions and full inference projection assertions are maintained. Six effectful tests confirm exactly one execution despite lost continuity, across initial dispatch and authorized retry. Existing Settings draft/revision tests remain unchanged.

The seeded smoke now mounts the actual Task panel and selects a synthetic disabled route through the production service to check main/preload invalidation. It is authored but unrun here, not production-notification acceptance evidence. No real credentials or paid inference were used. Final build, both TypeScript checks and focused tests passed; final full-suite exit is 1 as recorded above.

BMAD presentation is reached, but the owner's accepted deferred native/real-Electron gates override the normal done transition: spec and tracker remain in-progress. There is no local Git repository, no local commit and no publication in this candidate. Prior Story 1.21/1.22 gates remain independent.
