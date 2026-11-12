---
title: 'Development mode: test every capability with real model providers on the owner''s machine'
type: 'feature'
created: '2026-11-12'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
baseline_commit: 'd764404611'
context:
  - '{project-root}/docs/lessons-epic-1.md'
  - '{project-root}/docs/verification.md'
---

<frozen-after-approval reason="human-owned intent — owner approved on 2026-11-12 (&quot;Yes, build it&quot;)">

## Intent

**Problem:** The owner cannot try a feature with a real model on their own machine. Signed-in Tasks are real-data Tasks, and the Story 1.28 real-data gate refuses a model call unless the exact build carries a reviewed qualification proof and an organisation route approval. Every story changes the build, so development builds are always refused. The only existing exception, the controlled fictional session, disables tools. The owner's verdict (2026-11-12): on a controlled local copy with data the owner controls, the risk is negligible; product controls must not block development testing.

**Approach:** An explicit development mode, available only in debug builds and only when the development launcher turns it on, in which the real-data qualification check and the organisation route approval are skipped for both providers (OpenAI and Claude, any model the adapter supports) and Tasks keep their normal tools. A one-command launcher starts the local development topology, signs in with the synthetic local identity without a browser, and opens the app visibly on a separate development profile. The app shows that qualification checks are off. Release builds, and debug builds started without the launcher, behave exactly as today.

## Boundaries & Constraints

**Always:** Development mode requires both a debug build (`cfg(debug_assertions)`) and an explicit switch set only by the launcher; either missing means today's behaviour. The renderer shows a persistent, plain notice while it is on: "Development build: qualification checks are off. Use only data you control." Provider keys are entered by the person in Settings, never through environment variables or files. The development profile and its data live under `D:\Inquello\dev\`, separate from smoke profiles, the retained Auth0 pilot and the default Electron profile.

**Never:** No change to release-build behaviour or to the gate's logic when development mode is off. No change to the sandbox, the private tool allowlist, or data governance. The existing negative-authorization and gate tests keep passing unchanged. The launcher never enters a provider credential and never sends a Task.

</frozen-after-approval>

## Implementation Notes

**How to start it.** From `desktop/`, in PowerShell: dot-source `..\.tmp\story121-env.ps1`, then run `pnpm run dev` (the same as `node scripts/run-dev.cjs`). It needs debug builds of `codex-app-server`, `codex-cli` and `inquello-dev-topology`, plus `pnpm run build`. Close the app window to stop. The launcher then stops the topology, and the topology drops its database.

**How it works.**
- *Engine (debug builds only).* `take_development_mode_env` runs beside the existing start-up environment capture in `inquello_processor.rs`. It reads `INQUELLO_DEVELOPMENT_MODE` once, before worker threads start, and removes it, so nothing the runtime spawns inherits it. The switch is on only when four things hold: the build is a debug build, the variable has its exact name, its value is `1`, and no controlled fictional session is requested. In a release build, `development_mode()` is a constant `false`. Every real-tier refusal (Task start, derive or dispatch, read and disclosure, and resume) already passes through `check_real_route`. That function now asks `development_mode()` once:
  - When it is off, the call goes to `check_real_route_with_evidence`, unchanged.
  - When it is on, `check_development_route` runs instead. It skips the exact-build negative-authorization evidence, the data-policy digest, the organisation route approval and the service route check. It still requires a real session, the selected provider's credential (and, for OpenAI, the inherited Responses authentication binding), the same actor, and a session that is still current and not cancelled.
  - The saved-model view (`binding_view_for_mode`) marks an active saved model whose provider is connected as available, with qualification `development`. Revalidating a saved model no longer needs register qualification, but it still needs credentials.
  - Both `codex-responses` (any model in the runtime's model list) and `claude-api-key` (the adapter's `CLAUDE_MODEL`) are allowed. The sandbox, the tool allowlist, credential handling, provenance and the controlled fictional session are unchanged. Tasks keep their normal tools and have no output cap.
- *Desktop.* `main/development-mode.ts` accepts `--development` only when all of these hold: the app is unpackaged; no controlled fictional session, smoke, seed or owned-profile flag or variable is present; and the launcher has set `INQUELLO_SERVICE_CONFIG` and an absolute `INQUELLO_DEV_SEED`. Any other combination with `--development` refuses to start. In development mode:
  - The profile is `D:\Inquello\dev\profile`.
  - `runtimeChildEnv` always drops an inherited `INQUELLO_DEVELOPMENT_MODE` and sets it to `1` only in this mode.
  - Sign-in uses the existing `headlessOpener` against the synthetic issuer. After the runtime starts, main signs in through the same transition path as the Sign in button (now the shared `signInWithTransitions`). It then accepts the seeded first-administrator invite if the person is not already a member, prints `{"event":"development-ready",…}` and reloads the window once, so that every view reads the signed-in state.
  - The window is visible, as in any non-smoke launch.
  - `runtime.getStatus` adds `developmentMode: true`.
- *Renderer.* `renderer/development.tsx` reads that status once. It then shows the persistent notice "Development build: qualification checks are off. Use only data you control." as a fixed, non-interactive strip at the top of every view. The text is duplicated from main, and a test pins the two copies to the same string. In development mode, `savedModelReason` no longer calls a connected but unqualified saved model "not qualified". This affects the conversation model picker, the Task route label and Settings → Models. Settings → Models shows the qualification `development` as "Development build: qualification checks are off."

**Decisions.**
- *A separate mode instead of extending `dev-profile.ts`.* The owned development profile is built for the retained Auth0 pilot. It requires an Auth0 issuer and a one-time marker and proof tied to one service-config hash, and it refuses seed flags and database variables. Development mode is the opposite case: a fresh synthetic topology on every launch. Bending one mode into the other would weaken the pilot's guarantees.
- *The persistent profile and a new topology on each launch.* At each launch, main deletes the profile's `identity/` folder before identity starts. That folder holds the previous service session, onboarding records and workspace consent records, all of which belong to a topology that no longer exists. Main keeps the provider keys (`providers/`, the runtime home), the working store and the Task folders. As a result, keys entered in Settings survive relaunches. Conversations from earlier launches are not visible, because each topology mints a new principal and workspace. They stay on disk under the profile.
- *The renderer learns the mode from `runtime.getStatus`, not from a new preload key.* The bridge shape is pinned by `security.test.ts`.
- *The launcher passes extra arguments to Electron.* For example, `--remote-debugging-port=9333` was used for verification. The app still refuses smoke and owned-profile flags.
- *No README line.* `desktop/` has no README, and `docs/verification.md` is the owner's untracked file, so I left both alone. I added `"dev": "node scripts/run-dev.cjs"` to `desktop/package.json` instead.

**Not changed (deliberately), and known limits.**
- The automatic permission reviewer still answers "human required" for real-tier Tasks. Tool approvals go to the person, as they do for any route without register evidence.
- Native data inspection for local-data export and recovery (`main.rs`, `inspect_native_data`) still requires compiled evidence. Data governance is out of scope. So once a development Task exists, Local data export and recovery in the development profile reports its data as quarantined.
- Route views (`routes/list`, a Task's selected route) still report honest `not_verified` or `enabled:false`. The desktop parser requires evidence for `enabled`, and development mode does not claim qualification.
- OpenAI workspace consent: the seeded user is not the workspace owner, so Settings shows "Ask your workspace owner to allow OpenAI". The person can still connect their own key. Development mode skips the service route check that would consult that consent.
- A Task with a real provider was not run in verification. This is the owner's manual check.

**Story 2.1 problems found by the owner in development mode (2026-11-12), fixed here.**

These fixes apply to every build, not only to development mode, by the owner's request. They are: the agent's instruction travels as the runtime's `developer_instructions`; the draft carries no note; the Task-folders root is created on first use; the model choice is kept after a failed start; and the large-file transfer check is corrected (the coordinating session fixes that one; see "Open on 2026-11-12"). The frozen intent's "Release builds, and debug builds started without the launcher, behave exactly as today" refers to development mode itself: without the launcher, nothing that development mode adds is switched on.

- *Send with attached material failed: "The attached material could not be prepared for the Task folder, so nothing was sent."*
  - Cause, from main's log in the owner's window: `sources: the start material folder is unavailable (ENOENT … realpath 'D:\Inquello\dev\profile\tasks')`. Main's `startMaterial` builds a `WslTasks` for the principal. `WslTasks` keys its scope by the real path of the profile's Task-folders root (`wslScope` uses `realpathSync`). That root is normally created by `ensureTaskFolder` the first time a Task folder is needed, and on a new profile the first Send with attached material comes before any Task folder exists. So the lookup threw before any manifest was written.
  - This is a Story 2.1 fault on any new profile, not a development-mode one. The engine's `StartMaterial` read, the broker `replace`, the sandbox storage proof and development mode were not involved. The smoke and the sandbox tests missed it because they always create a Task before staging.
  - Fix: the `WslTasks` constructor creates the root privately (`ensurePrivateDirectory`, the same call `ensureTaskFolder` uses) before resolving it.
  - Regression test: `test/sources-start-owner-fixes.test.ts`. It fails on the old code with the same ENOENT.
- *A failed Send reset the model to "Choose model".* The Start view's refused and setup-failed paths cleared the selection. They now keep it (`keepModel`), re-run the model's availability check with the failure notice kept, and drop the choice only if the model is no longer available. Two Story 1.25 tests asserted the old reset; I updated them to the owner's rule. Tests: `test/tasks-start.test.tsx`.
- *The agent note was inserted into the person's message.*
  - How Codex already does it: core injects the config value `developer_instructions` as a developer message in every thread's initial context. Private Task threads load their config with the runtime's `-c` overrides (`config_manager.load_with_overrides`). Guardian reviewer sessions replace it with their own policy. The Claude Messages adapter maps developer messages to trusted system instructions.
  - So main now passes `-c developer_instructions="…"` (`RUNTIME_AGENT_INSTRUCTION_ARGS`, after `RUNTIME_OWNED_CONFIG_ARGS`). It carries one standing instruction, `AGENT_MATERIAL_INSTRUCTION`: when `attached/` exists, read it with `skills/inquello-evidence/SKILL.md` and cite. No engine change was needed.
  - Removed: `sourcesNote`, `withSourcesNote` and `replaceSourcesNote` from the renderer, and the note in the Start view and in between-turn attaching. The draft is now exactly what the person typed.
  - The Start notice now reads "Attached material is optional. It is placed in the Task folder before your request is sent."
  - The attached-material panel and the between-turn attach notice say "The agent is told where the attached material is and how to read and cite it."
  - Main's `sources` service no longer returns a `note` summary field, and the renderer no longer parses one (removed in review pass 1).
  - Tests: `test/sources-start-owner-fixes.test.ts` (including a real-runtime `config/read` check), `test/tasks-start.test.tsx` and `test/sources-renderer.test.tsx`.

**Verification record (2026-11-12, uncommitted working tree on `feat/epic-2-evidence-and-methods` at `d764404611`).**
- Passed:
  - Engine gate and route tests: `cargo test -p codex-app-server --lib --offline --locked -j4 -- development_ inquello_real_session_` gave 6 of 6, including the two existing real-session approval tests, unchanged.
  - All Inquello app-server lib tests: `… -- inquello` gave 174 of 175. The one failure, `user_rules_only_ask_or_forbid_and_win_over_a_workspace_allow`, passed when re-run alone. It plans a `curl` in the real guest, outside the changed code.
  - Default binaries rebuilt: `cargo build -p codex-cli -p codex-app-server -p inquello-service --offline --locked -j4`. The topology source is unchanged, so its binary was not rebuilt.
  - Both type checks.
  - Every `pnpm run build` step, compiled into a scratch folder: `desktop/dist` was left as built at 19:47 because the owner's development window was running from it.
  - Desktop suites: 38 files, 869 tests (2 skipped). They include `development-mode`, `sources-start-owner-fixes`, `security`, `authorization-negative-suite`, `dev-profile`, the `routes-*`, `providers-*`, `tasks-*` and `sources-*` suites, and the renderer surfaces touched. `sources-sandbox` passed 8 of 8 against the real guest.
  - Launcher run 1: window visible; signed in and joined the seeded Workspace (`development-ready`: signedIn true, member true); notice shown (screenshot). Closed with a window-close message. The runtime exited with code 0, the topology stopped, no processes were left, and `psql` listed no `inquello_dev_` database afterwards.
  - Launcher run 2 (`--remote-debugging-port=9333`), checked with no mouse or keyboard: `runtime.getStatus` returned `developmentMode: true`, identity was signed in, the notice showed in the Shell and in Settings, and Settings → AI connections rendered Claude and OpenAI.
- Not run as a pass:
  - The full `codex-app-server --lib` run stops at upstream Windows debug-build stack overflows in `bespoke_event_handling::tests::guardian_command_execution_notifications_wrap_review_lifecycle` and `mcp_refresh::tests::strict_refresh_installs_refreshed_thread_mcp_config`. The first also overflows with the three engine files reset to `HEAD`, so it is pre-existing. The second was not tested against the baseline.
  - The full `pnpm test`: the coordinating session runs it.
  - A Task with a real provider (the owner's manual check). The release-build path, where `development_mode()` is a constant `false`, was checked by reading the code; no release build was compiled.

## Review Triage Log

### Pass 1 — 2026-11-12

Layers on Sonnet: blind hunter (BH, 11), edge-case hunter (EC, 16), verification gap (VG, 5 gaps and 3 other). Diff: working tree against `d764404611` for `engine/` and `desktop/`. Verdicts are the coordinating session's; overlapping findings share a row.

| ID | Finding | Verdict | Evidence | Route |
|---|---|---|---|---|
| VG2 | The saved-model selection check at `inquello_routes.rs:358-370` has no test in either mode | medium | `development_mode()` is a process-wide switch with no seam there; removing it fails no test, and the owner's main use (choosing an unqualified model) would break while the picker says it is available. | patch: injected-flag helper and an off/on test, as for `binding_view_for_mode` |
| EC claim | Spec says release builds "behave exactly as today", but the Story 2.1 owner fixes apply to every build | medium | The developer instruction, removing the draft note, creating the Task-folders root and keeping the model after a failed start are ungated. These are owner-requested Story 2.1 fixes, intended for all builds. | patch: record this in Implementation Notes; the frozen intent stays as written for development mode itself |
| BH9, EC3 | A failed synthetic sign-in or join leaves a signed-out window with no explanation | medium | `main.ts` logs and prints `development-ready` with `signedIn:false`; the launcher inherits stdio and never reads it. | patch: show the failure in the app window |
| EC7 | The topology can stop while the app runs, with nothing telling the owner | medium | `run-dev.cjs` has no `exit` handler for the topology. | patch: print a plain message and close the app |
| BH1, EC5 | `--development` does not refuse every fixture variable the launcher strips | low | Only reachable when starting Electron by hand with fixture variables set. | patch: refuse the same names, with a test |
| EC2 | `reload()` on a window closed during sign-in throws | low | No `isDestroyed()` check. | patch |
| EC6, EC8, EC9, EC10 | Launcher: unchecked first topology line, stdin EPIPE on stop, synchronous setup errors print stack traces, Ctrl+C before the handler | low | Each confirmed in `run-dev.cjs`. | patch |
| BH10, EC13 | Development flag never retried after a failed first status read; brief "unavailable" flash before it resolves | low | `useDevelopmentBuild` sets `pending` once. | patch: retry once; the flash is cosmetic |
| EC11, EC12 | After a failed start, the refusal reason is replaced by the availability notice; reasoning and speed can stay set with no model | low | `StartView.tsx` `keepModel` path. | patch |
| BH2, VG-o1 | New `WslTasks` test comment contradicts its assertion and leaks a profile folder | low | Comment says same scope, assertion checks a different principal; second storage folder not cleaned. | patch |
| BH4, BH5 | Dangling `withSourcesNote` comment; unused `sourcesNote` in main can drift from the real instruction | low | Both confirmed. | patch: delete |
| VG1 | Main-process wiring (`runtimeChildEnv` flag, instruction args) not pinned by a test | medium | Filed pre-verified. | defer: extract the runtime-args builder from `main.ts` |
| VG3 | Picker, route label and Settings not rendered with the flag on | low | Filed pre-verified. | defer |
| VG4 | Nothing observes that `developer_instructions` reaches a Task turn | medium | Filed pre-verified. The owner's first real-model run is the check; if it fails, it is fixed then. | defer |
| VG5, BH8 | Launcher environment stripping untested and duplicated from `runtime/env.ts` | low | The runtime child already blocks provider credentials. | defer |
| EC4 | Persistent profile keeps Tasks and organise data from earlier topologies | medium | Earlier Tasks are invisible because each run mints a new principal; stale local rows are possible. | defer: watch in the owner's runs |
| BH11, EC15 | `route_view` and preflight still report unqualified; `'development'` string mirrored by hand | low | Development sessions are real sessions and take the real-route branch; the renderer covers the label. | defer |
| EC14 | `check_development_route` ignores policy and action | false | By design in the frozen intent: development mode skips the organisation and service route checks; session, credential and actor fences remain. | reject |
| EC16 | A host that skips the environment capture leaves the runtime off | false | Fails closed; the only host is the desktop, which always captures. | reject |
| BH3 | `WslTasks` constructor now creates its root | false | Intended fix for the failed first Send; the same private-directory helper as `ensureTaskFolder`. | reject |
| BH6 | `developer_instructions` applies to every thread | low | The text is conditional on `attached/` existing; Tasks without material are told nothing applies. | defer: revisit if real runs show an effect |
| BH7 | Development mode and Story 2.1 fixes mixed in one change | false | The owner asked for both in the same round; the spec records the split. | reject |

**Pass 1 fixes applied (2026-11-12, uncommitted).**
- VG2: the revalidation condition is now `revalidation_allowed_for_mode(development, credential, config)` in `inquello_routes.rs`, called with `development_mode()`. Test `development_mode_off_refuses_unqualified_revalidation_and_on_still_needs_credentials`: off refuses an unqualified saved model of either provider; on allows it; both still need the credential. It fails when the development branch is removed.
- EC claim: Implementation Notes now say the Story 2.1 owner fixes apply to every build by the owner's request, and that the frozen "behave exactly as today" refers to development mode itself.
- BH9, EC3: a failed development sign-in or Workspace join is now shown in the window under the development notice ("Development sign-in failed: <reason>. Close the window and run pnpm run dev again."). Main computes it with `developmentSignInProblem`, `runtime.getStatus` carries it as `developmentProblem` (development mode only), and the renderer shows it with `role="alert"`. The log line stays.
- EC7: `run-dev.cjs` watches the topology while the app runs. If it stops, the launcher prints "The development topology stopped unexpectedly (code N), so Inquello is closing. Run pnpm run dev again." and closes the app window (`taskkill` without `/F` on Windows, `SIGTERM` elsewhere; killed after ten seconds if still open). After Ctrl+C, which reaches the topology too, it says nothing. When the app closes after the topology was lost, the last line says so instead of "its database was dropped".
- BH1, EC5: `--development` now refuses every fixture and test variable the launcher strips (`DEVELOPMENT_REFUSED_ENV`, compared case-insensitively).
- EC2: the reload after the development sign-in is skipped when the window is already destroyed.
- EC6, EC8, EC9, EC10: the launcher checks that the topology's first line is a JSON service configuration with `service_url` and `issuer_url`; ignores stdin `EPIPE` when stopping; runs its setup inside the same plain-error handling (one line, no stack trace); and registers its Ctrl+C handler before anything starts (Ctrl+C before the app opens stops the topology). The launcher's helpers are exported for tests and `main()` runs only when the file is executed.
- BH10, EC13: the renderer reads the development status once more if the first read fails.
- EC11: after a failed start, when the model's availability check then fails, the notice keeps the refusal reason in front of the availability message. EC12 was not patched: it is unreachable. `keepModel` runs only after a start that had a candidate, so the not-active branch cannot be taken from it, and every path that clears the saved selection (catalog reload, provider change, runtime change, failed preflight) already clears reasoning and speed.
- BH2, VG-o1: the `WslTasks` test now asserts the same root and principal keep the same scope, that another principal gets another scope, and removes both storage folders.
- BH4, BH5: deleted the dangling `withSourcesNote` comment in `TaskLifecycle.tsx`, `sourcesNote` and the `note` field of `SourcesView` and `StageOutcome` in main, and the renderer's parse of `note`. Tests that pinned the field now assert it is absent.
- Verified for these fixes: `cargo test -p codex-app-server --lib --offline --locked -j4 -- model_binding development_` gave 11 of 11. The renderer type check passed. The main type check passed except for two errors in `test/transfer-large-entry.test.ts`, a file the coordinating session is still writing. Seven desktop files passed with 226 tests: `development-mode`, `run-dev-launcher` (new), `tasks-start`, `sources-start-owner-fixes`, `security`, `sources-service` and `sources-renderer`. Each new behavioural test was shown to fail when its fix was reverted, then the fix was restored. `pnpm run build`, the full suite and the launcher were not run.

## Verification

**Commands (from `desktop/`):**
- `pnpm exec tsc -p tsconfig.json --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: exit 0
- `pnpm run build` -- expected: success
- `pnpm test` -- expected: no failure
- Engine tests for the crates touched -- expected: pass, including gate tests with development mode off
- The launcher -- expected: app window visible, signed in, development notice shown, provider settings reachable

**Manual checks (owner):**
- Enter an OpenAI or Claude key in Settings, attach the synthetic engagement folder, ask a question, and watch the agent run the evidence skill and cite.

## Open on 2026-11-12 (resume here)

- **Send with a large attached file still fails** ("The attached material could not be prepared for the Task folder"). Cause from the development window's log (`.tmp/dev-launch.log`): `sources: the start material could not be prepared (Maximum call stack size exceeded)`. The base64 check in `validateTransfer` (`desktop/src/main/runtime/wsl-tasks.ts`, regex `^(?:[A-Za-z0-9+/]{4})*…$`) overflows V8's regex stack on a large file. It also guards between-turn staging. Fix: validate without the regex (length multiple of 4, then `Buffer.from(data,'base64').toString('base64') === data`), with a regression test on a multi-megabyte entry. The Story 2.1 fixtures were too small to reach it.
- **File badge shows "XLS" for a CSV.** `desktop/src/renderer/primitives/FileChip.tsx` has only PDF/XLS/DOC/DIR tags. Show the file's real type (CSV, XLSX and so on).
- Then: apply the Pass 1 `patch` rows above, rebuild (`pnpm run build`; engine only if `engine/` changes), relaunch `pnpm run dev` for the owner, and commit development mode plus the Story 2.1 owner fixes. The full suite run started 20:44 (`.tmp/devmode-full-vitest.log`) had not finished when this was written.
- Full suite at the uncommitted development-mode tree (started 20:44, 2026-11-12): 2,356 passed, 3 failed, 21 skipped. All three failures are Linux-sandbox tests (two in `sources-sandbox`, one in `permissions-integration`): two timeouts and one "Local sandbox unavailable on this device". The owner's development window was using the same sandbox at the time. Re-run the sandbox files on their own with no app open before treating these as defects; if "WSL boot changed" appears, the storage proof needs renewing (owner approval).

## Verification record (2026-11-12, at `967507a639`)

- Large-file send and CSV badge fixed (`wsl-tasks.ts` base64 check without a regex; `chipType` shows the real extension). The old check was shown to throw "Maximum call stack size exceeded" on a 24 MiB file; `test/transfer-large-entry.test.ts` and `test/file-chip-type.test.tsx` pass.
- Both type checks exit 0; engine debug binaries and `pnpm run build` rebuilt.
- Full `pnpm test`: 2,346 passed, 24 failed, 21 skipped. All 24 failures were the six Linux-sandbox files, refused with "WSL storage needs at least 32 GiB free on D:" (29.8 GiB free). The coordinating session removed 446 stale test executables and symbol files older than two days from `engine/codex-rs/target/debug/deps` (19.9 GiB, regenerable build output), leaving 49.3 GiB free.
- The six sandbox files re-run alone: 6 files, 29 of 29 passed (17 minutes). With the rest of the suite already green, no failure remains.
- The earlier run's three sandbox failures (20:44) were most likely the same low-space refusal.
- Launcher: development window opened, `development-ready` with `signedIn: true, member: true`.
- Not yet run: a Task with a real provider (the owner's check).
