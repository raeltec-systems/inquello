# Epic 1 remaining-gates inventory — 2026-11-09

Read-only inventory of what stands between Epic 1 and its pull request. Built from the spec and support files for Stories 1.14 and 1.21–1.31, `deferred-work.md`, the capability register and the 2026-11-03/07/09 evidence. Head at the time: `99800744e3`.

**How to read it.** Nothing was executed to produce this file. File existence was spot-checked; test counts and "corrected" claims are taken from the documents unverified. Unchecked task boxes are not a measure of missing code: most specs were last edited on 30–31 October in a snapshot with no Rust toolchain and were never updated.

Piles:

- **A — source work:** code or tests still to write or correct.
- **B — offline check:** runnable on this machine without the owner, paid calls or real credentials.
- **C — owner / paid call / qualified build:** owner sign-in or acceptance, live provider call, external OAuth or vendor account, organisation approval, or reviewed real-data evidence for the exact build.

## Summary

| Story | Spec status | Boxes | A | B | C | Own acceptance met apart from C? |
| --- | --- | --- | --- | --- | --- | --- |
| 1.14 organise | done (tracker says review) | 8/8 | none | none | none | Yes |
| 1.21 tools and connections | in-progress | 0/6 | 1 | many | 1 | No |
| 1.21 WSL backend | in-progress | 0/5 | unclear | many | 1 | No / unclear |
| 1.22 processing routes | in-progress | 0/8 | none named | many | none | No per spec text |
| 1.22 model bindings | in-progress | 0/6 | not stated | some | 1 | Unclear (spec has no results; commit `a2b31f0bab` claims completion) |
| 1.22 OpenAI production chat | in-progress | 0/5 | none stated | many | several | Unclear |
| 1.23 local execution | in-progress | 5/7 | 1 | some | 1 | No |
| 1.24 usage | in-progress | 0/5 | none | many | none | No |
| 1.25 start a Task | in-progress | 0/5 | 1 residual | many | 3 | No |
| 1.26 progress | in-progress | 5/6 | none | many | 3 | Unclear |
| 1.27 untrusted output | in-progress | 0/5 | none | many | 2 | No |
| 1.28 real-data gate | in-progress | 0/7 | none (stale docs) | many | 6 | Unclear |
| 1.29 steer/stop/recover | in-progress | 0/6 | none (2 deferred) | many | 4 | Unclear |
| 1.30 find and reopen | in-progress | 0/6 | none | few | 5 | Yes, on the spec's own evidence |
| 1.31 customer onboarding | in-progress | 0/7 | 2–3 | some | 4 | No |

## Three findings that shape the plan

1. **Most of pile B is one job, not eleven.** Nearly every story lists the same gates: native fmt/check/test/clippy, the `inference-fixtures` build and runtime tests, `pnpm generate:protocol`, desktop type checks and build, full `pnpm test`, and the seeded Electron smoke. One full offline verification pass on the current tree would discharge most of pile B for every story at once.
2. **Later evidence already exists but is not written back into the specs.** The 2026-11-03 qualification ran the native suites and 58 authorization scenarios; the 2026-11-07 checkpoint recorded 2,265 desktop tests passed (21 skipped) and 19 smoke reports. Both are bound to earlier source and do not cover today's tree, but they show the "cargo absent / unrun" text in 1.24, 1.25, 1.27, 1.28 and 1.29 is stale, not a sign of missing work.
3. **Real source work is small and concentrated:** 1.21 (OAuth callback teardown), 1.23 (inventory map), 1.31 (journal recovery, onboarding journey script), with open questions on the WSL backend and one accepted residual in 1.25.

## Pile A — source work

| Story | Item | Note |
| --- | --- | --- |
| 1.21 tools | OAuth callback transport teardown in `engine/codex-rs/rmcp-client/src/perform_oauth_login.rs` | Regression reproduced failing on 11-06; repair recorded as "underway" and unverified. Later commit `612e99e2e3` ("satisfy OAuth transport lint checks") may have landed it: check before redoing. Edits `engine/`. |
| 1.21 WSL | Bridge, transfers, mode transitions never recorded as finished | Files exist (`desktop/scripts/wsl/`, `runtime/wsl.ts`, integration test); likely authored and the spec not updated. Needs a read of the code against the spec matrix. |
| 1.23 | `execution.remote-cloud` missing from `register/inventory-map.json`; run the genuine inventory generator | Confirmed absent from the map, present in `capabilities.json`. Edits `engine/`. |
| 1.25 | R5-B7: SQLite 5 s busy timeout under two authority fences of up to 15 s each | Accepted residual with a follow-up design; owner decision whether it blocks the epic. |
| 1.31 | Bounded per-scope pending-journal recovery | Spec says "explicitly unfinished"; a single pending operation fails closed globally. |
| 1.31 | Normal-operation two-person Electron onboarding journey script | No onboarding-named script in `desktop/scripts/`. |
| 1.28, 1.30 | Stale documents: spec/support text, `inquello-authorization-evidence-not-run.json`, two register references still `pending` | Documentation only. Register edits are under `engine/`. |

**Follow-up the same day (two of these rows were not real source work):**

- **1.21 OAuth teardown: already landed.** Commit `c79147358c` (2026-11-06) replaced the callback server and `FORK-CUT.md` records the Linux and Windows RPC regression and rmcp library tests passing on the final source. The spec's "repair underway" text and the `deferred-work.md` entry are stale. Not re-run today; the consolidated pass will cover it.
- **1.23 inventory map: no change needed.** The spec's own notes say the map must not cite a disabled entry. The outstanding item was only the native generator gate, which was run today and passed (`capability_register` 24/24, `inventory_map` 11/11, `cargo fmt --check` clean). Recorded in the 1.23 spec; its register task is now checked.

Deferred and not proposed for this epic unless the owner says otherwise: 1.27 Responses-route retained end-to-end (Blind3-6); 1.29 R3-B4 (64-step plan window); the four 1.14 follow-ups; the 1.26 measurement items; the eight 1.28 "unverified" witnesses in `deferred-work.md`.

## Pile B — offline checks

**One consolidated pass on the current tree** (covers 1.21–1.30 unless noted):

- Native, from `engine/codex-rs`: `cargo fmt --all -- --check`; `cargo check` and `cargo test` for `inquello-domain`, `inquello-adapters`, `inquello-protocol`, `inquello-service` (with `test-issuer`), `codex-core` focused suites, `codex-app-server` lib/bin/integration tests; `cargo clippy … -- -D warnings`.
- Fixture build with `inference-fixtures`, then `inquello_messages_runtime` and `inquello_authorization_runtime` tests.
- Rebuild `codex-cli`, `codex-app-server`, `inquello-service`.
- Desktop: `pnpm run generate:protocol` (inspect any diff), type checks, `pnpm run build`, full `pnpm test`.
- Seeded Electron smoke, all reports.

**Story-specific additions:**

| Story | Check |
| --- | --- |
| 1.21 tools | App-server/rmcp cancellation and plugin-install boundary tests; capabilities integration suite with a database URL; Settings navigation checks in the seeded smoke. |
| 1.21 WSL | Guest exec-server and sandbox suites, bridge tests, and the 13-report smoke against the real `Inquello-Engine` guest on this host; in-guest program resolution has only run against a fake channel. |
| 1.22 routes | Messages fixture runbook `engine/codex-rs/app-server/tests/INQUELLO-MESSAGES-FIXTURES.md`; `routes` smoke report. |
| 1.22 bindings | Commands live in `model-bindings-engineering.md` (not read for this inventory). |
| 1.23 | `cargo test -p inquello-domain --test capability_register` after the inventory-map fix. |
| 1.24 | `usage_limit_fixture_refuses_at_native_boundary_and_preserves_local_work`; quota-refusal-to-panel smoke path. |
| 1.25 | Retained-child fixtures; stalled-authority-plus-concurrent-writer exercise; seeded Start-to-Active journey. |
| 1.26 | Support file's exact command block; `real_private_task_retains_publication_question_and_truthful_progress`. |
| 1.27 | Support file's exact command block; Windows seeded permission/sandbox/focus validation. |
| 1.28 | `coupled_` retained-fixture tests; `inquello_behavior_fingerprint`; `inspection_composition_tests`. |
| 1.29 | From `desktop`: `node scripts/run-lifecycle-native.cjs` (spec names 36 cases; the test file now has 38 matches — reconcile); Electron reproduction of R3-B10. |
| 1.30 | Populated native latency measurement. |
| 1.31 | Two-person synthetic-topology Electron journey with keyboard/focus/resize; `cargo test --locked --offline -j1 -p inquello-domain -p inquello-protocol -p inquello-service --features inquello-service/test-issuer` and matching clippy. |

Constraints: installed tools only, offline, at most four build jobs; D: has about 31 GB free, which is tight for a default build plus a fixtures build.

**Result:** the consolidated pass was run on 2026-11-09/10 and is recorded in [epic-1-offline-pass-2026-11-09.md](epic-1-offline-pass-2026-11-09.md), including what it did not cover.

## Pile C — owner, paid call or qualified build

| Gate | Stories |
| --- | --- |
| Re-qualify the current build (reviewed negative-authorization evidence, register attachment, fresh workspace approval). Deferred by the owner to the end of Epic 1. | 1.28, 1.29, 1.30, 1.22 chat, retained-pilot spec |
| Authorized paid provider calls on fictional fixtures: procurement usefulness (1.25, 1.26, 1.28), untrusted-output resistance on both routes (1.27), three-steer invoice run on both providers (1.29), actual OpenAI response (1.22 chat) | 1.22, 1.25–1.29 |
| Messages route qualification (register: "separately unqualified") | 1.28 |
| Owner Windows UI acceptance: keyboard, IME, focus, minimum width, Stop/crash/relaunch/Resume, export/recovery, audit journey | 1.23, 1.26–1.31 |
| Owner two-company/two-peer acceptance with revoke during real running work | 1.28 |
| Owner scope decision on tool use inside private Tasks | 1.21 tools |
| Owner approval for any further global WSL configuration change or shared restart | 1.21 WSL |
| Auth0 real-tenant pilot, production issuer, Resend delivery qualification | 1.31 |
| Fresh exact-build guest receipt | 1.30 |
| Actual-head CodeRabbit review named in two specs — superseded by the Codex review on the pull request per `CLAUDE.md`; confirm | 1.22 bindings, 1.22 chat |
| End-of-Epic-1 auditor session on the owner's machine | all |

## Housekeeping found on the way

- Tracker says 1.14 is `review`; its spec says `done` with 8/8 tasks. Tracker and status notes for 1.21–1.30 predate the November evidence.
- Uncommitted edits remain in the 1.21 and 1.26 specs, the 1.26 support file, `sprint-status.yaml`, `CLAUDE.md` and planning documents.
- 1.27's support file says independent reviews are "pending" in one place and complete in a later one; the later statement stands.

## Suggested order

1. Check the three small source items that may already be done (1.21 OAuth teardown, WSL backend state) and fix 1.23's inventory map.
2. Decide 1.31 scope: finish journal recovery and the onboarding journey, or move them out of Epic 1.
3. Run the consolidated offline pass once on the resulting tree; fix what it exposes; write results back into each spec and the tracker.
4. Open the Epic 1 pull request for Codex review; address comments.
5. Freeze source, re-qualify once, then do the pile C owner acceptance in one sitting.
