---
title: 'Story 1.16: Navigate the desktop shell with keyboard and responsive layout'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-14-organise-workspaces-engagements-folders-tasks.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-15-distinguish-execution-checks-review-delivery-states.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Story 1.14 shell has a fixed Sidebar, a Header and a Task area. It has no rail, no artifact area, no defined keyboard order, no shortcuts and no narrow-window behaviour (FR-3, UX-DR27, UX-DR30, UX-DR48, UX-DR50, UX-DR55).

**Approach:** Complete the shell's layout and keyboard behaviour in the renderer only:
- the documented Sidebar and its 52px rail;
- the Header, the centred thread and a reserved Composer slot;
- a 380px artifact area that stays closed until something real opens it;
- three layout modes decided by window width;
- the tab order, landmarks and a single announcement per surface change;
- safe Ctrl/Cmd+N and Escape behaviour.

**Owner decision (2026-10-29):**
- **Artifact area:** build the full layout now: the artifact area, the narrow-window conversation/artifact switch, and keeping the selection and unsent text when switching. The area stays closed until a later story opens a real artifact. Tests open it with test-only content; users never see a fake artifact.

**Build decisions (inside the ACs):**
- **Ctrl/Cmd+K** stays unbound until a Search surface exists (Story 1.30). UX-DR48 permits a shortcut only where the action is implemented.
- **Ctrl/Cmd+N** opens the existing New thread (new Task) control. It is bound in the renderer and only while focus is not in a text field, so it never takes over a browser or system shortcut.
- **Composer slot:** the Composer itself arrives with Story 1.17. This story reserves its slot in the layout, keeps it last in the tab order, and owns the draft-preservation mechanism the Composer will use.

## Boundaries & Constraints

**Always:**
- **Full desktop layout:**
  - Sidebar 264px, with:
    - the 20px lockup;
    - the Workspace selector;
    - an Engagements section with nested Folders and Tasks as NavRows: 13px, padding 6×8, radius 6, ink-150 when selected, surface-hover on hover;
    - Ad hoc Tasks;
    - person and settings controls at the bottom.
  - Header 48px, with the 14px title and the Workspace and Engagement context in muted text.
  - Thread centred at up to 720px, with the Composer slot below it.
  - Artifact area minimum 380px, shown only while open.
- **NavRow semantics:**
  - Navigation rows are links with `aria-current`; actions are buttons.
  - Expanded state is exposed with `aria-expanded`, and nesting keeps the hierarchy.
  - No row routes to a fixed demo record.
- **Rail (52px):**
  - Keeps the symbol, labelled icon actions (accessible names plus tooltips on hover and focus) and counts.
  - The current Workspace, surface and Task stay marked.
  - Expanding from the logo works by keyboard.
  - Collapsing never closes the open Task.
- **Layout modes**, recalculated live when the window resizes:
  - **Full:** the Sidebar plus a readable thread (and the artifact area, when open) fit.
  - **Rail:** the Sidebar does not fit, so navigation collapses automatically.
  - **Single:** the thread plus the 380px artifact area do not fit. One work area, with an explicit Conversation/Artifact switch. Switching keeps the selected item and the unsent draft, and returns focus to the control that switched.
  - No horizontal page overflow at any width down to the window minimum.
- **Keyboard:**
  - Tab order: Task navigation, then main content, then artifact and contextual review actions, then the Composer slot.
  - No focus traps in scroll areas.
  - Hover-only actions also appear on focus.
  - Escape closes the topmost Menu or overlay, returns focus to the control that opened it, and does nothing to a Task.
  - No "Stop (Esc)" hint.
- **Landmarks:** `nav` (Workspace navigation), `main` (Task work), a labelled `complementary` region (Artifact), and a region for contextual review. Each surface change (Task opened, view switched, rail toggled) is announced once through one polite live region.
- **Theme:** light only. No dark theme and no `prefers-color-scheme` branch.
- **Tokens:** use the DESIGN tokens; add any missing dimension tokens there.

**Never:**
- No fake or demo artifact visible to users.
- No Ctrl/Cmd+K binding.
- No Composer behaviour beyond the slot and draft preservation.
- No engine changes.
- No new dependencies.
- No global or OS-level shortcut registration (no `globalShortcut`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Wide window | Width fits Sidebar + thread | Full mode; 264px Sidebar, 48px Header, thread ≤ 720px | N/A |
| Narrow | Sidebar does not fit | Rail mode at 52px; current Task still marked; open Task unchanged | N/A |
| Narrow + artifact | Artifact open, thread + 380px do not fit | Single mode with Conversation/Artifact switch | N/A |
| Switch | Draft and selection exist, user switches twice | Same draft, same selected item, focus on the switch | N/A |
| Ctrl/Cmd+N | Focus outside text fields | New thread control activated | Inside a text field: not intercepted |
| Ctrl/Cmd+K | Pressed | Not handled by Inquello | N/A |
| Escape | Menu or overlay open | Topmost closes; focus returns to its opener; Task unaffected | No overlay: no-op |
| Keyboard only | Tab through the shell | Navigation → main → artifact/review → Composer slot; no trap | N/A |
| Rail collapse | Toggle rail by keyboard | Announced once; current Task and counts kept | N/A |
| Resize | Window dragged across thresholds | Mode changes without losing the open Task or draft; no horizontal overflow | N/A |
| Theme | OS prefers dark | Light theme unchanged | N/A |

</frozen-after-approval>

## Code Map

- `desktop/src/renderer/Shell/` -- `Shell.tsx` (layout modes, live region, shortcuts), `Sidebar.tsx` (NavRows, rail, footer), `Header.tsx`, `TaskView.tsx` (thread column, Composer slot), new `ArtifactArea.tsx` and `layout.ts` (pure width → mode function), `shell.css`.
- `desktop/src/renderer/` tokens (`tokens.ts` and its CSS) -- dimension tokens.
- `desktop/src/renderer/primitives/` -- existing Menu and overlay primitives (Story 1.7/1.8), reused for Escape handling.
- `desktop/src/main/smoke-probe.ts` -- a `shell-layout` report.

## Tasks & Acceptance

**Execution:**
- [ ] `layout.ts` pure mode function, with unit tests at each threshold.
- [ ] Sidebar NavRows, rail, footer; Header; thread column and Composer slot; ArtifactArea and the Single-mode switch with draft and selection preservation.
- [ ] Keyboard: tab order, Ctrl/Cmd+N guard, Escape stack, focus return, landmarks, one live announcement per surface change.
- [ ] jsdom tests for every matrix row.
- [ ] Smoke `shell-layout` report:
  - resize the real window to full, rail and single widths;
  - check the Sidebar and rail widths, the Header height, the thread maximum width and that `scrollWidth <= clientWidth`;
  - check the landmarks;
  - check that Ctrl+K is not handled;
  - check that the artifact area is closed by default.
- [ ] `sprint-status.yaml` (1-16).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `shell-layout` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `desktop/`: `pnpm run build`, then `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
