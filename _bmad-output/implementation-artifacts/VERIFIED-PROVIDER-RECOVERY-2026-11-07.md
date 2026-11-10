# Provider action recovery checkpoint

Base: `f25c81faa20fe7e76a803e84afda5b5d9bb711e6` on `feat/epic-1-secure-private-desktop`.

This is a narrow failure-recovery repair within the existing provider Settings contract. It is not owner UX acceptance, Story 1.21 completion, Epic 1 completion or authority to start another epic.

## Delivered behavior

Provider bridge dispatch now occurs inside the existing try/catch/finally. A synchronous bridge exception, like a rejected promise, shows the existing generic failure message and releases pending controls. API-key inputs still clear before dispatch, private diagnostics stay hidden, and a retry requires another deliberate action. Main-process credential storage, provider consent, runtime operations and external integration boundaries are unchanged.

The new regression file covers Claude store/check/remove and OpenAI API-key connect/disconnect, each with synchronous and asynchronous failures followed by one deliberate retry. No real credentials, provider sign-in, external tool invocation or paid model call were used.

## Verification

Evidence directory: `_bmad-output/implementation-artifacts/verification-2026-11-05/`.

- Before implementation: all five synchronous cases failed, with five asynchronous cases passing and five unhandled errors (`provider-recovery-before-20261107.log`).
- After implementation: 50/50 focused tests passed across five files, including all ten new recovery cases (`provider-recovery-focused-after-20261107.log`).
- Desktop production build passed, including both TypeScript checks, the data-policy checker and Vite (`provider-recovery-build-20261107.log`).
- Final source-matched native CLI/app-server, inference-fixture app-server and development topology builds passed offline using the existing Windows toolchain (`provider-recovery-native-final-20261107.log`, `provider-recovery-fixture-final-20261107.log`, `provider-recovery-topology-final-20261107.log`).
- Actual production Electron renderer with a synthetic preload bridge: four failure/retry journeys passed, covering synchronous and asynchronous Claude/OpenAI failures. Each cleared the key field, released controls, concealed private errors and dispatched exactly twice across the initial attempt plus explicit retry (`provider-recovery-electron-final-20261107.log`). This verifies renderer behavior, not a live provider connection. Captures and result JSON are retained at `D:\Inquello\tmp\provider-recovery-ui-S2BkAb`; the synchronous Claude and OpenAI failure captures were visually inspected. The OpenAI capture displays the generic failure notice and empty key field, with unrelated Claude controls available.
- Final full desktop suite: 2,265 passed, zero failed, 21 existing skips; 121 passing files and four skipped files (`desktop-full-docker-provider-recovery-final-live-20261107.log`).
- Final aggregate smoke: all 19 required reports passed, with no missing reports or cleanup errors. Normal, quota, visual and tools phases all passed. The visual phase used five local synthetic responses and zero invalid fixture calls (`seeded-smoke-baseline-docker-provider-recovery-final-live-20261107.log`).
- `git diff --check -- desktop` passed. No product source or assertion was changed during the final full-suite/smoke verification.

The 11,036-file `engine/` and `desktop/` source snapshot was frozen before final native builds and remained unchanged after the full suite and aggregate smoke. Manifest: `provider-recovery-source-manifest-final-20261107.json`; SHA-256: `828a5436066aa72799ada2135e0148f67dd6c12eb4cc151163d07191cbfad4bc`.

## Preserved failures and environment recovery

- The original local verification launcher stopped before tests with a Windows command-syntax error. Its log remains `desktop-full-docker-provider-recovery-final-20261107.log`. A local evidence-only runner invokes the already-installed pnpm Node entry directly and passes `--maxWorkers=1` without an extra positional separator. Fixture ownership, private receipt, loopback port and container checks are unchanged.
- The first complete suite then reported 2,249 passes and 16 failures across five files because the machine restart invalidated the WSL boot-specific storage receipt (`desktop-full-docker-provider-recovery-final-direct-20261107.log`). All failure stacks traced to the stale boot proof or the resulting unavailable sandbox; smoke did not start.
- The existing live-storage verifier checked the unchanged WSL configuration, D-drive swap identity, disk cap, current boot and successful HCS attachment event, then backed up and refreshed only its evidence receipt (`provider-recovery-live-storage-proof-20261107.log`). No WSL shutdown, shared configuration, security settings, guest installation or gate relaxation was performed. The full suite and aggregate smoke were rerun after this evidence refresh and passed as recorded above.
- Original repro logs and harness-development failures are retained rather than overwritten. Unrelated Kobba tests and Inquello planning/research edits were left untouched.

## Remaining scope

Broader account/provider/model navigation and owner live UX acceptance remain open. Private Tasks still disable configured external integrations. Enabling them requires the separate owner scope/architecture decision and implementation/verification; actual provider and organization acceptance retain their separate permission boundaries. No PR, merge or deployment is included.
