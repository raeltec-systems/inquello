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

**Problem:** The Electron onboarding journey for Story 1.31 clicks DOM nodes at one window size. It gives no evidence for keyboard and focus behaviour, the minimum window size, or what a person sees after a request's reply is lost and the app is restarted, which is the single-pending behaviour kept for the pilot.

**Approach:** Extend the `--onboarding` smoke phase with a keyboard-only Workspace creation, a minimum-size layout check, and an interrupted invitation that is recovered after a full app relaunch through the "Finish an interrupted request" panel. Report each as a named check with captures.

## Boundaries & Constraints

**Always:** Keep the journey synthetic, offline and owned: no seed or membership helper, no real Auth0, email or model call; only the two existing fictional people sign in. New steps act through visible controls or real input events and assert what is on screen. The existing eleven checks keep their meaning. A failed leg fails the report and names its stage.

**Owner decision (2026-11-10):** recovery is proved by a **full app relaunch** on the same profile, not a renderer reload. The fixture gate may therefore accept a non-empty profile in exactly one case: a single relaunch of the same run, where the profile carries that run's ownership sentinel written under the gate and the launcher has written a matching one-use resume marker after the first launch exited cleanly. Every other gate check stays as it is, and without the resume request a non-empty profile is still refused.

**Never:** Change onboarding product behaviour, copy, the pending store format or the service. Do not build the scoped journal. Do not add a renderer-reachable or packaged-build control. Private-Task isolation, conversation Stop/Resume and revocation are out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keyboard creation | Signed-in owner, no Workspace; real key events only | Name typed, dialog opened and confirmed by keyboard; Workspace created, owner is Owner | Fails `keyboard-create-workspace` |
| Dialog focus | Confirmation dialog open | Focus starts inside, Tab stays inside, Escape closes and returns focus to the opener | Fails `dialog-focus-contained-and-restored` |
| Minimum window | Team view and an open dialog at minimum content size | No horizontal overflow; every visible button inside the viewport; size restored | Fails `minimum-window-layout`; size still restored |
| Lost reply | Owner confirms a second invitation; service applies it; reply dropped once | "Outcome is not confirmed" notice; pending panel shown; other changes disabled with the resolve-first reason; first launch exits cleanly | Fails `interrupted-request-visible` |
| Relaunch recovery | Same profile relaunched once | Owner still identified; pending panel rebuilt from the store; "Reconcile request" reports the original applied; exactly one such invitation; changes enabled | Fails `interrupted-request-recovered-after-relaunch` |
| Resume refused | Resume requested with wrong run, missing or reused marker, missing or foreign sentinel, or any non-empty profile without a resume request | App refuses to start with the fixture error; profile files untouched | Unit tests |
| Fault misuse | Fault armed twice, or request is not a `POST` | Second arm throws; non-`POST` requests pass through | Unit test |

</frozen-after-approval>

## Code Map

- `desktop/src/main/onboarding-smoke.ts` -- `ownedOnboardingFixture`. Line with `fs.readdirSync(profile).length!==0` is the only gate check to extend. Marker keys are checked exactly; keep that. Already wraps the transport for sign-in (`opener`); add the lost-reply wrapper beside it.
- `desktop/src/main/onboarding-smoke-probe.ts` -- the journey: `run`, `capture`, `reauthenticate`, and the `checks`/`failures`/`captures` report written to `manifest.json`. Keep existing stages and order.
- `desktop/src/main/main.ts:160` gate call; `:257` sets `userData` to the fixture profile; `:435-438` probe call and `onboarding` event; `:680-685` builds `OnboardingClient` on `identity.transport`; `:455-462` resize/restore pattern (`setMinimumSize(0,0)`, `setContentSize`) with `SHELL_LAYOUT.windowMinWidth` and `WINDOW_MIN_HEIGHT`.
- `desktop/src/main/smoke-probe.ts:2332-2337` -- `pressKey` real-input pattern (`sendInputEvent`). Copy the pattern; do not import that module into the onboarding path.
- `desktop/src/main/onboarding/service.ts:134-152` and `client.ts` -- `send` persists `uncertain` before the `POST`; reconciliation is `GET …/receipts/<operation_id>`. Read-only.
- `desktop/src/renderer/Onboarding.tsx:94-122` -- notice, "Finish an interrupted request" panel, "Reconcile request", and the reason "Resolve the pending request before another change." Read-only.
- `desktop/scripts/run-seeded-smoke.cjs:14-24,105-142` -- `--onboarding` phase: one topology, one Electron launch, one `onboarding` event. Must launch twice inside the same topology.
- `desktop/test/onboarding-smoke.test.ts` -- gate tests, including "rejects a nonempty profile…", which must keep passing unchanged.

## Tasks & Acceptance

**Execution:**
- [ ] `desktop/src/main/onboarding-smoke.ts` -- write the run's ownership sentinel into the empty profile once the gate passes; accept a non-empty profile only for the resume case in the owner decision, consuming the resume marker; add the transport wrapper with one-shot `loseNextMutationReply()` (forward the `POST`, await the reply, then throw) -- relaunch gate and deterministic lost reply.
- [ ] `desktop/src/main/main.ts` -- build `OnboardingClient` on the wrapped transport when the fixture is present; pass `resize`/`restore` and the fixture's phase to the probe; emit `onboarding-resume` for the second launch -- wiring only.
- [ ] `desktop/src/main/onboarding-smoke-probe.ts` -- first launch: keyboard creation, dialog focus and minimum-window legs, then as owner invite a second fictional address with the reply lost and stop. Second launch: recover through the panel. Captures `08`–`12`; record focus evidence in the manifest -- the new coverage.
- [ ] `desktop/scripts/run-seeded-smoke.cjs` -- for `--onboarding`, after a clean first exit write the resume marker, relaunch once on the same profile and topology, and require both events -- two launches, one run.
- [ ] `desktop/test/onboarding-smoke.test.ts` -- unit-test the "Resume refused" and "Fault misuse" rows and one accepted resume; extend the probe source check for the new check names.

**Acceptance Criteria:**
- Given default binaries, when `node scripts/run-seeded-smoke.cjs --onboarding` runs, then both events are `ok: true`, the original eleven checks and the five new ones are present, and cleanup reports no errors.
- Given the new captures, when inspected, then focus is visibly indicated, nothing is clipped at minimum size, and the pending panel tells the person what to do next; any defect is recorded, not fixed here.
- Given a packaged build or no fixture, when the app starts, then no fault can be armed and no resume is possible.

## Implementation Notes

## Design Notes

The interrupted request is a second invitation at the end of the first launch, so the existing seven stages run untouched. Trust for the relaunch comes from two independent facts: the sentinel proves this run created the profile under the gate, and the launcher-written marker proves the first launch ended cleanly and permits one relaunch. The lost-reply wrapper is test code in the owned-fixture module, reachable only from the main-process probe; killing Electron mid-request was rejected as not repeatable.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/onboarding-smoke.test.ts test/onboarding-main.test.ts` -- expected: all pass
- `pnpm run build` -- expected: success
- `node scripts/run-seeded-smoke.cjs --onboarding`, with no provider-credential-shaped variable in the environment -- expected: both events `ok: true`, sixteen checks
- `node scripts/run-seeded-smoke.cjs` -- expected: the other 19 reports still pass

**Manual checks:**
- Open captures `08`–`12` and the manifest; confirm focus indication, no clipping at minimum size and readable pending-panel wording. List defects in Implementation Notes.
