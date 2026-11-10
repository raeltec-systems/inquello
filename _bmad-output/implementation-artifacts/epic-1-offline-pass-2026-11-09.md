# Epic 1 consolidated offline verification pass — 2026-11-09/10

One offline pass over the shared gates that Stories 1.21–1.30 each list, run on this Windows host. It follows [the remaining-gates inventory](epic-1-remaining-gates-2026-11-09.md).

**Scope and limits.** Synthetic evidence only: no live provider call, no real credentials, no owner acceptance. It does not re-qualify the build for real data; the Story 1.28 evidence in the capability register is still bound to the 2026-11-03 build. It is not a claim that any story is complete.

- Tested commit: `f992919722` (final desktop and smoke gates). Native stage 2 gates ran while the head moved from `22f373ec01` to `f992919722`; the only change between them is 22 files under `desktop/test/`.
- Engine tree: `d2e7f259a8110d7e25cfec6b66f679d075cfd72b`. No file under `engine/` or `desktop/src/` changed during the pass.
- Toolchain: installed Rust 1.99.1 (MSVC), offline, `--locked`, four build jobs, incremental compilation off. Test database: local PostgreSQL `inquello_test`.
- Logs, per-gate exit codes and scripts: `.tmp/epic1-offline-pass-20261109/` (local, not committed).

## Result

| Area | Result |
| --- | --- |
| Native default-feature suites | **passed** (all gates below) |
| Native `inference-fixtures` authorization runtime, 68 cases, both routes | **passed with one caveat**: 67/68 on the full run; the one failure passed twice on re-run |
| Native `inference-fixtures` messages runtime | **not run** (Linux-only test file) |
| Desktop type checks, protocol regeneration, production build | **passed** |
| Full desktop suite | **passed**: 2,270 passed, 0 failed, 21 skipped, 125 files (4 skipped) |
| Seeded Electron smoke | **passed**: 19 of 19 required reports, none missing or failed |

## Native gates (from `engine/codex-rs`)

| Gate | Command (abbreviated) | Result |
| --- | --- | --- |
| Domain | `cargo test -p inquello-domain` | passed |
| Protocol | `cargo test -p inquello-protocol` | passed |
| Adapters | `cargo test -p inquello-adapters` | passed |
| Service | `cargo test -p inquello-service --features test-issuer --all-targets` | passed |
| Exec-server spawn boundary | `-p codex-exec-server --lib inquello_isolated_spawn_boundary` | passed |
| Rollout bounds | `-p codex-rollout --lib saved_bounds_tests` | passed |
| rmcp client (includes the 1.21 OAuth callback repair) | `-p codex-rmcp-client --lib` | passed |
| Core: Inquello, progress control, resume fence, private command | `-p codex-core --lib <filter>` | passed (4 gates) |
| Core: bound Responses | `-p codex-core --test all bound_responses_` | passed |
| App-server library: Inquello | `-p codex-app-server --lib inquello_` | passed, 166/166 (second run; see note 1) |
| App-server library: progress, lifecycle wire | `--lib progress_tests`, `--lib lifecycle_wire_tests` | passed |
| App-server binary and behaviour fingerprint | `--bin codex-app-server --test inquello_behavior_fingerprint` | passed |
| App-server transport | `-p codex-app-server-transport` | passed |
| Clippy, warnings as errors | `-p inquello-domain -p inquello-adapters -p inquello-protocol -p inquello-service` | passed |
| Formatting | `cargo fmt --all -- --check` | passed (run at `99800744e3`; engine unchanged since) |
| Capability register and inventory generator | `-p inquello-domain --test capability_register --test inventory_map` | passed, 24/24 and 11/11 |
| Fixtures build | `cargo build -p codex-app-server --features inference-fixtures` | passed |
| Authorization runtime | `--features inference-fixtures --test inquello_authorization_runtime`, `INQUELLO_FIXTURE_APP_SERVER_BIN` set | 67/68, then the failed case 1/1 twice (note 2) |
| Messages runtime | `--features inference-fixtures --test inquello_messages_runtime` | **0 tests: not run** (note 3) |
| Default rebuild | `cargo build -p codex-cli -p codex-app-server -p inquello-service` | passed |

## Desktop gates (from `desktop`)

| Gate | Result |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json --noEmit` | passed after `f992919722` (was 55 errors, all in test files) |
| `pnpm exec tsc -p tsconfig.renderer.json --noEmit` | passed |
| `pnpm run generate:protocol` | 816 files for runtime 0.165.0, matching the engine tree; working tree unchanged |
| `pnpm run build` | passed (existing chunk-size warning) |
| `pnpm test` | 2,270 passed, 0 failed, 21 skipped |
| `node scripts/run-seeded-smoke.cjs` | `ok: true`, 19 required, none missing or failed |

Smoke reports: renderer-privileges, design, identity, data, providers, organise, states, shell-layout, composer, start-surface, policy, tool-bounds, permissions, capabilities, routes, environments (normal phase); quota; visual-reader-jump and visual-conversation; tools-management. Every phase reported no cleanup errors. The quota and visual phases used the fixtures app-server; the visual phase recorded five local synthetic calls and zero invalid fixture calls.

Binaries used for the smoke (SHA-256):

- `codex.exe` `0cb2ffdde202b9636818d9b3ddb8e383c49b9aa3fd6278e991ee8b6b6e9a78db`
- `codex-app-server.exe` `e9e85eeb5aa2a826d5fe39b18efbaca9ee809b8c90ec2e929e581dc21a100fca`
- `inquello-service.exe` `5d1392db6d97269f0302709e01f9978af7950abf3090d7fe94a96e738218e083`
- `inquello-dev-topology.exe` `1d4627286c9575e6bfdef79c365156d0e8cdd934c22b2e0ccfa96e05243aa95c`
- fixtures `codex-app-server.exe` `67130893054d9695106b1b4c96820bcd1fcf4ee2eb9e46c5c32f379bc01dc7e6`

## Notes on failures seen during the pass

1. **Disk floor, not code.** The Linux sandbox refuses to start with less than 32 GiB free on D:. While free space was 29.7–30 GiB, 16 desktop tests (five integration files) and 3 app-server library tests failed with "WSL storage needs at least 32 GiB free on D:" or the consequent "Local sandbox unavailable on this device". After space was freed, the same 19 tests passed with no code change. The first-run logs are retained.
2. **`messages_allowed` failed once.** On the full authorization run it was the first case and failed with `setup-failed`; the runtime logged "Linux Task setup unavailable … Setup probe timed out". Re-run alone twice with the guest warm, it passed both times. Cold guest start is the likely cause but was not isolated. Recorded in `deferred-work.md` against Story 1.25, because a user's first Task after a restart could fail the same way and is not retried.
3. **Messages runtime suite is Linux-only.** The test file is compiled only for Linux, so on Windows it reports zero tests. Stories 1.22, 1.25, 1.26 and 1.27 list it as a gate. Recorded in `deferred-work.md`.
4. **Harness errors, corrected.** The first authorization run omitted `INQUELLO_FIXTURE_APP_SERVER_BIN` and failed 64 cases at the driver's precondition; that run says nothing about the code and was repeated correctly.
5. **Test typing regression, fixed.** The main type check had regressed to 55 errors in 22 test files. Fixed type-only in `f992919722`; no assertion changed.

## Not run in this pass

- `inquello_messages_runtime` (Linux-only), and the guest-side exec-server and sandbox suites for the WSL backend.
- `cargo clippy` for `codex-core` and `codex-app-server` (only the four Inquello crates were linted).
- `node scripts/run-navigation-native.cjs` and the populated native latency measurement (Story 1.30).
- The stalled-authority-plus-concurrent-writer exercise (Story 1.25) and the Electron reproduction of R3-B10 (Story 1.29).
- The onboarding smoke phase (`--onboarding`) and the two-person onboarding journey (Story 1.31).
- Which four desktop files and 21 tests were skipped was not itemised; the reporter does not list them on a passing run.
- Everything in pile C of the inventory: re-qualification, paid provider calls, owner acceptance.

## Housekeeping done with owner approval

Deleted to free space: nine `runtime-<hash>` binary copies under `.tmp/epic1-repairs-20261101/` (5.6 GB) and 131 `inquello-smoke-<uuid>` scratch profiles under `D:\Inquello\tmp` (1.84 GB). No committed or untracked evidence file cited them. The three log files that `validation/epic1-baseline-repairs-20261101.md` cites were kept, as were the retained pilot and the cited `inquello-seeded-smoke-*` folders.
