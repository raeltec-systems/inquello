---
title: 'Widen the synthetic two-person onboarding journey'
type: 'feature'
created: '2026-11-10'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'b56bfc483a3c3942194238e2f18eccd3f85cb3e1'
context:
  - '{project-root}/docs/verification.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-31-customer-onboarding.md'
---

<frozen-after-approval reason="human-owned intent — approved by the owner 2026-11-10; do not modify unless human renegotiates">

## Intent

**Problem:** The Electron onboarding journey for Story 1.31 clicks DOM nodes at one window size. It gives no evidence for keyboard and focus behaviour, the minimum window size, or what a person sees after a request's reply is lost and the app is restarted, which is the single-pending behaviour kept for the pilot.

**Approach:** Extend the `--onboarding` smoke phase with a keyboard-only Workspace creation, a minimum-size layout check, and an interrupted invitation (reply lost, then the service unreachable) that the app recovers by itself after a full app relaunch. Report each as a named check with captures.

## Boundaries & Constraints

**Always:** Keep the journey synthetic, offline and owned: no seed or membership helper, no real Auth0, email or model call; only the two existing fictional people sign in. New steps act through visible controls or real input events and assert what is on screen. The existing eleven checks keep their meaning. A failed leg fails the report and names its stage.

**Owner decision (2026-11-10):** recovery is proved by a **full app relaunch** on the same profile, not a renderer reload. The fixture gate may therefore accept a non-empty profile in exactly one case: a single relaunch of the same run, where the profile carries that run's ownership sentinel written under the gate and the launcher has written a matching one-use resume marker after the first launch exited cleanly. Every other gate check stays as it is, and without the resume request a non-empty profile is still refused.

**Owner amendment (2026-11-10):** the app reconciles a pending request automatically on every state read, so a dropped reply alone leaves nothing to recover. The recovery leg therefore models a lost reply followed by an outage until relaunch, and proves automatic recovery after relaunch, not recovery by pressing "Reconcile request".

**Never:** Change onboarding product behaviour, copy, the pending store format or the service. Do not build the scoped journal. Do not add a renderer-reachable or packaged-build control. Private-Task isolation, conversation Stop/Resume and revocation are out of scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Keyboard creation | Signed-in owner, no Workspace; real key events only | Name typed, dialog opened and confirmed by keyboard; Workspace created, owner is Owner | Fails `keyboard-create-workspace` |
| Dialog focus | Confirmation dialog open | Focus starts inside, Tab stays inside, Escape closes and returns focus to the opener | Fails `dialog-focus-contained-and-restored` |
| Minimum window | Team view and an open dialog at minimum content size | No horizontal overflow; every visible button inside the viewport; size restored | Fails `minimum-window-layout`; size still restored |
| Lost reply, then outage | Owner confirms a second invitation; service applies it; reply dropped; every later onboarding request in this launch fails as unreachable | "Outcome is not confirmed" notice; "Finish an interrupted request" panel shown; other changes disabled with the resolve-first reason; pressing "Reconcile request" reports truthfully that it cannot confirm and the panel stays; first launch exits cleanly | Fails `interrupted-request-visible` |
| Relaunch recovery | Same profile relaunched once; service reachable | Owner still identified, with no other account selected; the stored request is reconciled automatically on the first state read; panel gone; exactly one such invitation; changes enabled | Fails `interrupted-request-recovered-after-relaunch` |
| Resume refused | Resume requested with wrong run, missing or reused marker, missing or foreign sentinel, or any non-empty profile without a resume request | App refuses to start with the fixture error; profile files untouched | Unit tests |
| Fault misuse | Fault armed twice; requests before arming; the relaunched process | Second arm throws; before arming every request passes through; the outage ends with the process and is never armed on the resume launch | Unit test |

</frozen-after-approval>

## Code Map

- `desktop/src/main/onboarding-smoke.ts` -- `ownedOnboardingFixture`. Line with `fs.readdirSync(profile).length!==0` is the only gate check to extend. Marker keys are checked exactly; keep that. Already wraps the transport for sign-in (`opener`); add the lost-reply wrapper beside it.
- `desktop/src/main/onboarding-smoke-probe.ts` -- the journey: `run`, `capture`, `reauthenticate`, and the `checks`/`failures`/`captures` report written to `manifest.json`. Keep existing stages and order.
- `desktop/src/main/main.ts:160` gate call; `:257` sets `userData` to the fixture profile; `:435-438` probe call and `onboarding` event; `:680-685` builds `OnboardingClient` on `identity.transport`; `:455-462` resize/restore pattern (`setMinimumSize(0,0)`, `setContentSize`) with `SHELL_LAYOUT.windowMinWidth` and `WINDOW_MIN_HEIGHT`.
- `desktop/src/main/smoke-probe.ts:2332-2337` -- `pressKey` real-input pattern (`sendInputEvent`). Copy the pattern; do not import that module into the onboarding path.
- `desktop/src/main/onboarding/service.ts:89-119,134-152` and `client.ts` -- `send` persists `uncertain` before the `POST`; `getState` calls `reconcileHeld`, which reads `GET …/receipts/<operation_id>` and clears the pending record when a receipt exists; a failed read leaves it pending and still returns state. Read-only.
- `desktop/src/main/main.ts:652-662` -- in smoke mode every start deletes the identity directory (stored session and onboarding pending store), runtime home, journal, working store, provider data and Task folders. The accepted resume launch, and only it, must skip this.
- `desktop/src/renderer/Onboarding.tsx:89-122` -- `finish` refreshes state after every change request, including a failed one; notice, "Finish an interrupted request" panel, "Reconcile request", and the reason "Resolve the pending request before another change." Read-only.
- `desktop/scripts/run-seeded-smoke.cjs:14-24,105-142` -- `--onboarding` phase: one topology, one Electron launch, one `onboarding` event. Must launch twice inside the same topology.
- `desktop/test/onboarding-smoke.test.ts` -- gate tests, including "rejects a nonempty profile…", which must keep passing unchanged.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/src/main/onboarding-smoke.ts` -- write the run's ownership sentinel into the empty profile once the gate passes; accept a non-empty profile only for the resume case in the owner decision, consuming the resume marker; add the transport wrapper with one-shot `loseReplyThenOutage()`: forward the next `POST`, await the reply, throw a transport error, then fail every later request through the wrapper as unreachable until the process exits -- relaunch gate and deterministic interruption.
- [x] `desktop/src/main/main.ts` -- build `OnboardingClient` on the wrapped transport when the fixture is present; pass `resize`/`restore` and the fixture's phase to the probe; emit `onboarding-resume` for the second launch; skip the smoke start-up cleanup on the accepted resume launch only -- wiring only.
- [x] `desktop/src/main/onboarding-smoke-probe.ts` -- first launch: perform the existing create-Workspace stage by real key events (it then records both its existing check and `keyboard-create-workspace`), with the dialog-focus leg before the confirming key; minimum-window leg; then as owner invite a second fictional address with the fault armed, assert the interrupted state, press "Reconcile request" once, and stop. Second launch: assert automatic recovery. Captures `08`–`12`; record focus evidence in the manifest -- the new coverage.
- [x] `desktop/scripts/run-seeded-smoke.cjs` -- for `--onboarding`, after a clean first exit write the resume marker, relaunch once on the same profile and topology, and require both events -- two launches, one run.
- [x] `desktop/test/onboarding-smoke.test.ts` -- unit-test the "Resume refused" and "Fault misuse" rows and one accepted resume; extend the probe source check for the new check names.

**Acceptance Criteria:**
- Given default binaries, when `node scripts/run-seeded-smoke.cjs --onboarding` runs, then both events are `ok: true`, the original eleven checks and the five new ones are present, and cleanup reports no errors.
- Given the new captures, when inspected, then focus is visibly indicated, nothing is clipped at minimum size, and the pending panel tells the person what to do next; any defect is recorded, not fixed here.
- Given a packaged build or no fixture, when the app starts, then no fault can be armed and no resume is possible.

## Implementation Notes

- **Gate.** After every existing check passes, a first launch writes `profile/.inquello-onboarding-owner` (`runId`, random `nonce`, `resumed:false`) with exclusive create. A resume is requested only by `INQUELLO_ONBOARDING_RESUME=<runId>`. It needs that run's sentinel with `resumed:false` and the launcher's `.inquello-onboarding-resume` (`runId`, `sentinelNonce`) beside the fixture marker, both with exact keys. Only once every check has passed does it set `resumed:true` and delete the marker. Without the variable, the old empty-profile rule applies unchanged. Outside `--smoke-onboarding`, the variable is refused like the other fixture variables. On the resume launch, `select`, the sign-in opener and fault arming all refuse.
- **Fault.** `onboardingTransport()` wraps only the `OnboardingClient` transport. The one-shot `loseReplyThenOutage()` forwards the next `POST`, waits for its reply and throws `ServiceError('transport', delivered=true)`, which the product reads as uncertain. Every later request through the wrapper throws `ServiceError('transport', false)` until the process exits. Identity and sign-in traffic is not wrapped.
- **Main.** The resume launch skips the smoke start-up cleanup. The probe gets `minimum` (544 × 400), `resize` and `restore`. The second launch's event is `onboarding-resume`.
- **Probe.** Creation now goes by real `sendInputEvent` keys: Tab to the name field, type it, Tab, Return. Inside the dialog it then checks: focus starts on Cancel and is visibly indicated, four Tabs stay inside, and Escape returns focus to "Review Workspace creation". Return reopens the dialog, then Tab and Return confirm. The manifest records the focus evidence and the minimum-window measurements. The first launch writes `manifest.json` with `ownerDigest` (SHA-256 of the owner principal). The relaunch reads it to prove the same owner and writes `manifest-resume.json`. The second invitee is `tamara.phiri@mupeta.invalid`.
- **Launcher.** It relaunches only after a first exit with code 0, a clean runtime exit, a passed handshake and `onboarding ok`. It writes the marker from the sentinel and relaunches on the same topology and profile; logs go to `smoke-resume.*.log`. It requires both `onboarding` and `onboarding-resume`.
- **Changed test assertion.** The probe source check no longer looks for the literal `confirm('Create Workspace')`, because creation is now confirmed by keyboard as this spec directs. It now requires `'Create Workspace'`, `sendInputEvent`, the five new check names, `loseReplyThenOutage()` and the Reconcile click. The forbidden-shortcut list is unchanged.
- **Defects seen in captures 08–12; recorded, not fixed.**
  1. The pending panel shows the internal operation kind: "Pending action: invite".
  2. During the outage, "The service could not be reached. Your draft is preserved." appears as both the discovery notice and the team notice, and again as the main notice after Reconcile. The panel itself does not say the service is unreachable or that the person should retry later; the outage is explained only by those separate notices.
  3. "Invitations for you" shows no inline status when discovery fails.
  4. The confirmation dialog title renders at body-text weight and size.
  5. "Review same-request retry" stays enabled during the outage. That is correct, because a retry rechecks the receipt first.
  - Focus is clearly indicated (2 px blue ring plus halo), and nothing is clipped at 544 × 400.
- **Evidence (2026-11-10, Windows host, default binaries, offline).**
  - Both type checks passed, exit 0.
  - Focused Vitest: 48 passed, 1 skipped (the symlink case on Windows).
  - `pnpm run build`: exit 0.
  - `run-seeded-smoke.cjs --onboarding`: `ok:true` twice. The final run took 53 s with two launches, events `onboarding` and `onboarding-resume`, 15 + 1 checks, 12 captures and no cleanup errors. Afterwards the marker had been consumed and the sentinel read `resumed:true`.
  - Full `run-seeded-smoke.cjs`: `ok:true`, 19 of 19 required reports, no cleanup errors (log `.tmp/story131-journey-full-smoke-2.log`). The quota and visual phases need `INQUELLO_FIXTURE_APP_SERVER_BIN`, which `story121-env.ps1` does not set. A first run without it failed only those two phases at native bootstrap (log `.tmp/story131-journey-full-smoke.log`); that was a harness omission, not a code failure. The passing rerun used the 2026-11-09 offline pass's fixtures binary, `.tmp/epic1-offline-pass-20261109/fixture/codex-app-server.exe` (SHA-256 `67130893…dc7e6`). Nothing was rebuilt.
- **Not covered:** owner inspection of the captures; refused resumes and fault misuse are proved by unit tests, not inside Electron. A refused gate still leaves Electron open until the launcher's ten-minute deadline (the known harness wart).
- **Independent verification by the coordinating session (2026-11-10, at `96822e94a4`).** Read the full diff against this spec; the gate accepts a non-empty profile only for the one resume case and leaves the non-resume check unchanged. Re-ran: both type checks exit 0; focused Vitest 48 passed, 1 skipped; `pnpm run build` exit 0; `run-seeded-smoke.cjs --onboarding` `ok:true` in 56 s with two launches, 15 + 1 checks and 12 captures, sentinel `resumed:true` and marker consumed, same owner digest in both manifests. Opened captures 08, 10, 11 and 12: focus ring on Cancel, nothing clipped at 544 × 400, interrupted panel and held controls shown, exactly one second invitation after relaunch. Full `run-seeded-smoke.cjs`: the first of two runs **stalled** in the unrelated `permissions` report until the ten-minute deadline (quota, visual and tools passed); the second passed 19 of 19. The stall is logged in `deferred-work.md` as intermittent with cause not established. The panel wording defects above are also logged there as a pre-pilot follow-up.

## Spec Change Log

- 2026-11-10 — Implementation stopped before any code change: with only the reply dropped, `finish` refreshes and `getState` reconciles at once, so the approved "Lost reply" and "Relaunch recovery" rows could not occur, and product behaviour may not be changed. The owner amended the frozen matrix to a lost reply followed by an outage until relaunch, with automatic recovery afterwards. This avoids a journey that can never pass, or a contrived fault that blocks reads after relaunch. KEEP: the sentinel-plus-one-use-marker relaunch gate, the five check names, captures `08`–`12`, and the unit tests for refused resumes.

## Design Notes

The interrupted request is a second invitation at the end of the first launch. The existing seven stages keep their order and checks; only the create-Workspace stage changes how it acts, from DOM clicks to real keys, because only one first Workspace can be created. Trust for the relaunch comes from two independent facts: the sentinel proves this run created the profile under the gate, and the launcher-written marker proves the first launch ended cleanly and permits one relaunch. The lost-reply wrapper is test code in the owned-fixture module, reachable only from the main-process probe; killing Electron mid-request was rejected as not repeatable.

## Verification

**Environment:** installed tools only, offline; no installs or downloads. In PowerShell, dot-source `.tmp/story121-env.ps1` from the repository root (test database URL and toolchain paths), set `COREPACK_ENABLE_NETWORK=0` and `ELECTRON_SKIP_BINARY_DOWNLOAD=1`, and remove from the process environment any variable whose name ends in `_TOKEN`, `_API_KEY` or `_SECRET` and names CLAUDE, ANTHROPIC, OPENAI, CODEX or CHATGPT before running the smoke commands; the onboarding gate refuses to start otherwise and the launcher then waits out a ten-minute deadline. Do not edit anything under `engine/`. Default native binaries are already built; do not rebuild them.

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm exec vitest run --configLoader runner test/onboarding-smoke.test.ts test/onboarding-main.test.ts` -- expected: all pass
- `pnpm run build` -- expected: success
- `node scripts/run-seeded-smoke.cjs --onboarding`, with no provider-credential-shaped variable in the environment -- expected: both events `ok: true`, sixteen checks
- `node scripts/run-seeded-smoke.cjs` -- expected: the other 19 reports still pass

**Manual checks:**
- Open captures `08`–`12` and the manifest; confirm focus indication, no clipping at minimum size and readable pending-panel wording. List defects in Implementation Notes.
