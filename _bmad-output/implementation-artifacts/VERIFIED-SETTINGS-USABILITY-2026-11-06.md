# Verified Settings usability checkpoint

Base: `1053adf1821b4a2ab8696e24db8b6fc1de593a64` on `feat/epic-1-secure-private-desktop`.

This is an incremental Epic 1 usability repair, not owner acceptance or permission to start another epic. Verification completed on 2026-11-06 UTC. The preserved log names use the run suffix `20261107`.

## Changes

- Keep Settings navigation visible beside long inventories on desktop-width windows.
- Focus the destination heading when changing ordinary Settings sections, including back/forward navigation. Provider reconnect links retain their specific control focus.
- Show one Tools and connections heading in ordinary Settings, with correct nested inventory headings. The standalone specimen retains its heading.
- Place the existing Add MCP server form before the provider details and long tool inventory, and let it fit narrow/zoomed windows.
- Add two renderer regression tests and five native smoke assertions covering placement, sticky navigation, focus, history/repeated navigation and 200% zoom overflow.

No engine/runtime, permissions, connection lifecycle, OAuth, provider or private-Task integration behavior was changed. Existing warnings and local-program confirmation remain in place. No real provider sign-in, external tool invocation or paid model call was used.

## Verification

All paths below are under `_bmad-output/implementation-artifacts/verification-2026-11-05/` unless stated otherwise.

- Before-fix regression: both new tests failed for the intended issues (`settings-usability-before-20261107.log`).
- Focused renderer suite: 151 passed across seven files (`settings-usability-focused-20261107.log`).
- Rebuilt `codex-cli` and `codex-app-server` offline with the existing Windows toolchain: exit 0 (`settings-usability-native-build-20261107.log`). Engine source was unchanged.
- Final production desktop build: exit 0 (`settings-usability-build-complete-20261107.log`). Existing chunk-size advisory remains.
- Full desktop suite: 2,243 passed, zero failed, 21 existing skips; 119 passing files and four existing skipped files (`desktop-full-docker-settings-usability-complete-20261107.log`).
- Full seeded smoke: all 19 required reports passed, no missing reports, no cleanup errors (`seeded-smoke-baseline-docker-settings-usability-complete-20261107.log`). Tools management passed all 22 checks, with zero forbidden tool/auth calls. The existing visual fixture used only local synthetic responses.
- The first aggregate wrapper exited before launching Vitest because of Windows command syntax. Its log is retained as `desktop-full-docker-settings-usability-final-20261107.log`; the successful run above used the existing direct Node suite runner and owned loopback Docker fixture.
- `git diff --check -- desktop` passed. Existing LF/CRLF notices are not test failures.

The final source snapshot covers 11,034 tracked/unignored files under `engine/` and `desktop/`. It was frozen before the final build, full suite and aggregate smoke and verified unchanged after completion. Manifest: `settings-usability-source-manifest-final-20261107.json`; SHA-256: `6c57f935ab26c469bee69f1e83bf62033c55cfed2abf9b3ad449028da1a13aac`.

## Visual inspection

Inspected actual Electron captures from the final aggregate run under `D:\Inquello\tmp\inquello-seeded-smoke-TcNzxN\`:

- `tools/captures/tools-03-removed-reopened.png`: normal-width Settings with reachable setup and sidebar.
- `tools/captures/tools-05-zoomed-form.png`: form fields and submit control fit at 200% zoom without horizontal clipping.
- `visual/captures/09-settings-tools-and-connections.png`: ordinary Settings in the broader seeded visual journey.

## Remaining gates

The inventory is still verbose and its action presentation needs a broader coherent Settings pass. Provider/account/model navigation and owner live desktop UX acceptance remain open. Private Tasks still keep configured external integrations disabled; enabling them needs the separate owner scope/architecture decision and corresponding implementation/verification. This checkpoint grants no live-provider, OAuth or paid-call permission, and does not mark Epic 1 accepted or merged.
