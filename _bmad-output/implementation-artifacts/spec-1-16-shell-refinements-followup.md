---
title: 'Story 1.16 follow-up: Finish the approved conversation shell refinements'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context: []
baseline_commit: '34706d5bf65da344b010ad11d4bd625cf2cfd3d7'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The approved shell still has oversized navigation, duplicate branding and technical account terminology. The handed-off UI candidate lacks Windows qualification.

**Approach:** Integrate the verified 20-file candidate, preserving the approved visual vocabulary, workspace, profile and existing conversation behavior. Validate the result locally before committing on `feat/epic-1-secure-private-desktop`.

## Boundaries & Constraints

**Always:** Default total navigation 320px: 64px rail plus 256px history. Resize within 280–424px by pointer/keyboard, with reset, validated persistence and responsive clamp. Keep one rail symbol, Engagements/Chats, centered composer, Task/drafts and accessible focus. Show organization/team, Settings and confirmed Sign out. Permit signout during pending work; warn that logout does not undo effects. Reconnect mounts and focuses the actual provider control without starting authentication.

Preserve authority, request IDs, cancellation, stale-response fences, real overflow/menu/one-composer assertions, 60-second functional gate and separate 20-second observation. Protect the real profile/workspace; use isolated fictional smoke fixtures.

**Never:** Installs/downloads, engine edits, paid inference, Auth0/account changes, main merge, profile reset/seed/overwrite, mutation replay or Epic acceptance claims. Model-form replacement remains the separate model-binding goal.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Resize | Pointer or arrows/Home/End/Enter | Owned pointer only; bounded width; reset and persisted remount | Invalid/nonfinite/fractional stored values use 320px |
| Narrow window | Preferred width cannot fit | Clamp or overlay; keep readable work and draft | No page overflow at minimum width |
| Sign out | Draft or pending request | Confirmation; cancel preserves draft; confirm calls existing identity action once | Late acceptance cannot open private Task or replay request |
| Reconnect | Allowlisted provider destination | Focus actual mounted secure control | Unknown destination does not start login or focus another provider |

</frozen-after-approval>

## Code Map

- `.tmp/local-dev-handoff-20261102-1317/UNINTEGRATED/review/ui-followup-manifest.json`: exact 20-file candidate; all normalized baselines match HEAD. ZIP and 33 packet hashes verified.
- `desktop/src/renderer/Shell/{Shell,Sidebar,SidebarResize}.tsx`, `layout.ts`, `sidebar-width.ts`, `shell.css`: layout, owned resize input and safe width persistence.
- `desktop/src/renderer/{App,Account,Providers,Settings}.tsx`, `provider-settings.ts`: navigation, explicit signout and committed provider focus; reuse identity/provider actions.
- `desktop/src/renderer/design/tokens.{ts,css}` and `_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md`: matched canonical dimensions.
- `desktop/src/main/smoke-probe.ts`: only geometry and footer selector changes; preserve the canonical full conversation probe.
- `desktop/test/{organise-shell,settings-route,shell-layout,shell-refinement,sidebar-followup}.test.tsx`: candidate coverage.

## Tasks & Acceptance

**Execution:**
- [x] Manifest-listed files -- integrate only after rechecking hashes/baselines; inspect the diff for scope drift.
- [x] Renderer/tests -- resolve Windows failures; retain pending-operation and focus coverage.
- [x] `desktop/src/main/smoke-probe.ts` -- run actual isolated synthetic full conversation and inspect resulting pixels, responsive geometry and cleanup.
- [x] `desktop/src/main/smoke-probe.ts` -- fix CodeRabbit startup deadlines using one start origin and observation-time bounds; add boundary regression coverage. `docs/qualification/conversation-shell-validation-2026-11-02.md` -- make evidence inspectable or reproducible.
- [x] `docs/qualification/` -- record commands, results, pixels and limits; mark done after required checks; sync `sprint-status.yaml` without closing other Epic gates.
- [x] Commit verified files locally on the existing branch; continue the existing PR4 CodeRabbit review without duplicating the completed request for the old head.

**Acceptance Criteria:**
- Given the shell, when resized/reopened, then dimensions, keyboard/persistence and organization footer work without losing conversation state.
- Given pending start, when confirmed signout precedes late acceptance, then no replay or private Task opening occurs.
- Given rebuilt Windows and fictional fixtures, when Send/follow-up/Stop/Jump/reopen/Resume run, then four valid local calls and clean cleanup pass with zero live calls.

## Implementation Notes

No unresolved product decisions. Twenty candidate files; no privileged API or migration. Baseline: `34706d5bf65da344b010ad11d4bd625cf2cfd3d7`.

Owner approved UI implementation on 2026-11-02. Story 1.16 is already done in sprint status; this follow-up does not downgrade it. Model-selection spec remains draft and unapproved.

Subsequently the owner approved the separate model spec; it is ready-for-dev and remains queued until this UI checkpoint is committed.

Completed on 2026-11-02. The parent inspected the scoped unified diff, all matrix coverage and actual home/menu/narrow-composer/resumed pixels. Native CLI/app-server, fixture runtime/topology and final desktop builds passed. Full focused suite: 289/289 in 13 files; final probe-related rerun: 81/81 in four files. Final actual Electron run `sjqVr9` passed with four valid local calls, all contexts true, native cancellation, Jump/reopen/Resume, 15 captures, native exit 0 and empty cleanup errors. Startup 18,120.3ms passed both observations; earlier performance misses and a follow-up dispatch timeout remain documented limitations. No engine/protocol edits or real-profile changes.

Pixel audit required available-column composer wrapping; the exact-minimum visual callback reuses existing smoke-only Windows DPI handling. Reader validation now waits for settled layout and requires genuine transcript distance, preserving actual upward reader intent and explicit Jump. The final 900x700 witness needed no smaller-viewport fallback. Inspectable sanitized JSON/four PNGs and exact reproduction commands are tracked under `docs/qualification/`.

Matrix audit: resize bounds/reset/persistence/pointer ownership and pending-signout/cancel/late acceptance are covered by passing `sidebar-followup.test.tsx`; narrow retained work by `shell-layout.test.tsx` and actual minimum/900px geometry; committed allowlisted reconnect focus/no actions by `settings-route.test.tsx`. Eight passing `smoke-startup.test.ts` cases cover exact and late deadline observations. Review layers were skipped by owner rule; external CodeRabbit review of the next published head is separate from local qualification.

## Spec Change Log

## Review Triage Log

Owner rule skips BMAD step 4 and review subagents. CodeRabbit remains the external review route.

## Verification

- `engine/codex-rs`: `cargo build --offline -j 4 -p codex-cli -p codex-app-server`; use matched topology/protocol. Report offline failures before any download.
- `desktop`: `pnpm run build` (both types, policy and Vite); `pnpm exec vitest run --configLoader runner --maxWorkers=1 test/organise-shell.test.tsx test/settings-route.test.tsx test/shell-layout.test.tsx test/shell-refinement.test.tsx test/sidebar-followup.test.tsx test/design.test.ts test/conversation-presentation.test.tsx test/conversation-follow.test.tsx test/providers-block.test.tsx test/tasks-start.test.tsx test/tasks-lifecycle-shell.test.tsx` plus deadline coverage.
- Root, using existing `.tmp/story121-env.ps1` synthetic database environment and workspace-contained temporary root: `node desktop/scripts/run-seeded-smoke.cjs --visual-only`. Inspect pixels, full journey and owned cleanup. Never use the real pilot profile.
