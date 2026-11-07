# Settings inventory usability checkpoint

Base: `5f7fca78be8a862edddf40d32b624e06660f94ec` on `feat/epic-1-secure-private-desktop`.

This is an incremental Story 1.21 repair, not owner UX acceptance, Epic 1 completion or authority to start another epic.

## Delivered behavior

- Source, version and dependencies are available in keyboard-operable reference details instead of filling every inventory row by default.
- Installation/enablement state, effective permission, restrictions, recovery guidance and management actions remain exposed.
- When the last authoritative read knows enablement and offers both Enable and Disable, show the applicable action. Preserve unknown-state actions and sole runtime-provided actions rather than inventing a replacement.
- Keep the focused enablement button through the authoritative reread. No optimistic state update or repeated dispatch is introduced.
- Preserve expanded details through refresh, reset them on Workspace change, and keep cancellation reachable when ordinary mutations are unavailable.
- Compact ordinary Settings rows using existing design tokens; expanded details fit 200% zoom.

Runtime operations, policy enforcement, OAuth, credentials and private-Task external integration boundaries are unchanged. This work used isolated local fixtures only; no live provider sign-in, external tool invocation or paid model call was performed.

## Verification

Evidence directory: `_bmad-output/implementation-artifacts/verification-2026-11-05/`.

- New regression file before implementation: six failures reproduced the missing disclosure and contradictory action behavior, with six existing-contract cases passing (`settings-inventory-before-20261107.log`).
- Focused renderer/service coverage: 163 passed across eight files, including all 12 new presentation cases (`settings-inventory-focused-20261107.log`).
- Rebuilt native `codex-cli` and `codex-app-server` offline with the existing Windows toolchain: exit 0 (`settings-inventory-native-build-20261107.log`). No engine changes or protocol changes were made.
- Final desktop production build: passed (`settings-inventory-build-final-20261107.log`). Existing chunk-size advisory remains.
- Full desktop suite: 2,255 passed, zero failed, 21 existing skips; 120 passing files and four skipped files (`desktop-full-docker-settings-inventory-final-20261107.log`).
- Focused actual Electron journey: 27/27 checks passed, including keyboard disclosure, disable/enable focus, native durable state, restart/reopen, removal and zoom (`seeded-smoke-baseline-docker-settings-inventory-second-20261107.log`). Loopback discovery only: four initialize and four list requests, zero forbidden requests. No cleanup errors.
- The first focused native run failed because the older smoke visibility helper only checked the hidden attribute, not closed details. The probe now uses Chromium checkVisibility for the relevant content. The original failure log is retained (`seeded-smoke-baseline-docker-settings-inventory-first-20261107.log`); no valid product assertion was removed.
- Final aggregate smoke: all 19 required reports passed, no missing reports and no cleanup errors (`seeded-smoke-baseline-docker-settings-inventory-final-20261107.log`). The tools journey passed all 27 checks with zero forbidden requests. The visual phase used five local synthetic responses only.
- `git diff --check -- desktop` passed. Existing LF/CRLF notices are not failures.

The final 11,035-file `engine/` and `desktop/` source snapshot was frozen before the final build, full suite and aggregate smoke. Manifest: `settings-inventory-source-manifest-final-v2-20261107.json`; SHA-256: `e626e94eba3b00f360ac5e782bd3108c54749d714c4508c961510b0a10c107c4`. It matched after the full suite and again after the final aggregate smoke.

## Visual inspection

Actual Electron captures from `D:\Inquello\tmp\inquello-seeded-smoke-qzGGMm\tools\captures\` were inspected: `tools-06-details-expanded.png` and `tools-07-zoomed-details.png`. The collapsed row was also inspected in the first native run. Fields and long dependency text remain readable without horizontal clipping. The same normal-width and zoomed captures from the final aggregate run at `D:\Inquello\tmp\inquello-seeded-smoke-XrRIHN\tools\captures\` were inspected and passed the same visual checks.

## Remaining scope

Broader account/provider/model navigation and owner live UX acceptance remain open. The inventory still contains repeated policy prose and many skills; this checkpoint does not claim the overall Settings experience is finished. Private Tasks still disable configured external integrations. Activating them requires the separate owner scope/architecture decision and implementation/verification; actual provider/organization acceptance retains its separate permission boundaries. No merge or deployment is included.
