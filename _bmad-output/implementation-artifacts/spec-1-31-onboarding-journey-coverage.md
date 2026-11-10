---
title: 'Widen the synthetic two-person onboarding journey'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/verification.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-31-customer-onboarding.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Electron onboarding journey for Story 1.31 proves the two-person flow only by clicking DOM nodes at one window size. It gives no evidence for keyboard and focus behaviour, the minimum window size, or what a person sees when a request's reply is lost, which is the single-pending behaviour the owner chose to keep for the pilot.

**Approach:** Extend the existing `--onboarding` smoke phase with three legs driven through the visible UI: a keyboard-only Workspace creation, a minimum-size layout check, and an interrupted invitation recovered through the "Finish an interrupted request" panel. Report each as a named check with captures.

## Boundaries & Constraints

**Always:** Keep the journey synthetic, offline and owned: same fixture gate, same two fictional people, no seed or membership helper, no real Auth0, email or model call. Every new step acts through visible controls or real input events and asserts what is on screen. Existing eleven checks and seven captures keep passing unchanged in meaning. A failed leg fails the report and names its stage.

**Never:** Change onboarding product behaviour, copy, the pending store format or the service. Do not loosen any existing fixture-gate check. Do not build the scoped journal. Do not add a renderer-reachable or packaged-build control. Private-Task isolation, conversation Stop/Resume and revocation are out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keyboard creation | Signed-in owner, no Workspace; only real key events | Name typed, review dialog opened and confirmed by keyboard; Workspace created with owner as Owner | Focus not where expected fails `keyboard-create-workspace` |
| Dialog focus | Confirmation dialog open | Focus starts inside, Tab stays inside, Escape closes and returns focus to the control that opened it | Fails `dialog-focus-contained-and-restored` |
| Minimum window | Team view and an open dialog at the minimum content size | No horizontal overflow; every visible button inside the viewport; size restored afterwards | Fails `minimum-window-layout`; size still restored |
| Lost reply | Invitation confirmed; service applies it; reply dropped once | Notice says the outcome is not confirmed; pending panel appears; other changes are disabled with the resolve-first reason | Fails `interrupted-request-visible` |
| Recovery | Pending panel present after the renderer is reloaded | "Reconcile request" reports the original was applied; exactly one invitation exists; panel gone; changes enabled | Duplicate or missing invitation fails `interrupted-request-recovered-once` |
| Fault misuse | Fixture not owned, or fault armed twice | No fault exists outside the owned fixture; a second arm before the first fires throws | Unit test |

</frozen-after-approval>

## Open Questions

- What "restart" means for the recovery leg — options: **Renderer reload** (recommended; the page is reloaded and must rebuild the pending panel from the encrypted store; a full app relaunch stays covered only by the existing unit test) / **Full app relaunch** (closes and reopens Electron on the same profile; requires teaching the fixture gate to accept its own non-empty profile, which loosens the "empty profile only" rule this spec otherwise forbids touching).

## Code Map

- `desktop/src/main/onboarding-smoke-probe.ts` -- the journey; `run`, `capture`, `reauthenticate` helpers and the `checks`/`failures`/`captures` report. Extend here; keep existing stages in order.
- `desktop/src/main/onboarding-smoke.ts` -- `ownedOnboardingFixture`; already wraps the transport for sign-in (`opener`). Add the one-shot lost-reply wrapper here, available only on the returned fixture object. Do not alter the gate checks above it.
- `desktop/src/main/main.ts:435-438` -- probe call site; `:680-685` builds `OnboardingClient` with `identity.transport`; `:455-462` shows the resize/restore callback pattern (`setMinimumSize(0,0)` then `setContentSize`) to reuse with `SHELL_LAYOUT.windowMinWidth` and `WINDOW_MIN_HEIGHT`.
- `desktop/src/main/smoke-probe.ts:2332-2337` -- `pressKey` real-input helper (`sendInputEvent`); reuse its pattern, do not import the large module into the onboarding path if that widens the fixture's surface.
- `desktop/src/main/onboarding/service.ts:134-152` -- `send` persists `uncertain` before the POST; a thrown transport error after the service applied the request yields the uncertain state. Read-only.
- `desktop/src/main/onboarding/client.ts` -- mutation is `POST`; reconciliation is `GET …/receipts/<operation_id>`. The fault must drop only a `POST` reply.
- `desktop/src/renderer/Onboarding.tsx:94-122` -- notice text, `data.pending` panel "Finish an interrupted request", "Reconcile request", and the disabled reason "Resolve the pending request before another change." Read-only.
- `desktop/scripts/run-seeded-smoke.cjs:14-24,120-142` -- `--onboarding` phase; expects one `onboarding` event with `ok: true`. No change expected.
- `desktop/test/onboarding-smoke.test.ts` -- fixture-gate tests and the source check that the probe uses no service shortcuts.

## Tasks & Acceptance

**Execution:**
- [ ] `desktop/src/main/onboarding-smoke.ts` -- add a transport wrapper and a one-shot `loseNextMutationReply()` on the fixture: forward the next `POST`, await the real reply, then throw a transport error; pass every other request through -- deterministic lost reply without a service helper.
- [ ] `desktop/src/main/main.ts` -- when the fixture is present, build `OnboardingClient` on the wrapped transport; pass `resize`/`restore` and a renderer `reload` into `probeOnboarding` -- wiring only.
- [ ] `desktop/src/main/onboarding-smoke-probe.ts` -- perform Workspace creation by keyboard; add the dialog-focus, minimum-window and interrupted-request legs with the checks named in the matrix and captures `08`–`11`; record `document.activeElement` evidence in the manifest -- the new coverage.
- [ ] `desktop/test/onboarding-smoke.test.ts` -- unit-test the wrapper: only a `POST` reply is dropped, once; the request still reaches the transport; double-arm throws; extend the source check for the new check names -- matrix row "Fault misuse".

**Acceptance Criteria:**
- Given the current tree and default binaries, when `node scripts/run-seeded-smoke.cjs --onboarding` runs, then the report is `ok: true` with the original eleven checks plus the five new ones and no cleanup errors.
- Given the new captures, when inspected, then the focused control is visibly indicated, nothing is clipped at the minimum size, and the pending panel's wording tells the person what to do next; any wording or layout defect is recorded, not fixed here.
- Given a packaged build or a missing fixture, when the app starts, then no lost-reply fault can be armed.

## Implementation Notes

## Design Notes

The lost-reply wrapper is test code inside the existing owned-fixture module, reachable only after every gate check passes and only from the main-process probe. It is preferred over killing Electron mid-request, which is not deterministic, and over a service-side fault option, which would add a helper to the service.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/onboarding-smoke.test.ts test/onboarding-main.test.ts` -- expected: all pass, none skipped beyond the existing Windows symlink skip
- `pnpm run build` -- expected: success
- `node scripts/run-seeded-smoke.cjs --onboarding` with no provider-credential-shaped variable in the environment -- expected: `ok: true`, sixteen checks
- `node scripts/run-seeded-smoke.cjs` -- expected: the 19 other reports still pass

**Manual checks:**
- Open captures `08`–`11` and the manifest; confirm focus indication, no clipping at minimum size, and readable pending-panel wording. List any defects in Implementation Notes.
