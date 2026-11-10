---
title: 'Story 1.16: Navigate the desktop shell with keyboard and responsive layout'
type: 'feature'
created: '2026-10-29'
status: 'done'
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
- [x] `layout.ts` pure mode function, with unit tests at each threshold.
- [x] Sidebar NavRows, rail, footer; Header; thread column and Composer slot; ArtifactArea and the Single-mode switch with draft and selection preservation.
- [x] Keyboard: tab order, Ctrl/Cmd+N guard, Escape stack, focus return, landmarks, one live announcement per surface change.
- [x] jsdom tests for every matrix row.
- [x] Smoke `shell-layout` report:
  - resize the real window to full, rail and single widths;
  - check the Sidebar and rail widths, the Header height, the thread maximum width and that `scrollWidth <= clientWidth`;
  - check the landmarks;
  - check that Ctrl+K is not handled;
  - check that the artifact area is closed by default.
- [x] `sprint-status.yaml` (1-16).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `shell-layout` and every earlier report are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **`Shell/layout.ts`:** pure `layoutMode(width, artifactOpen)` and `artifactFits(width)`. Widths come from the DESIGN spacing tokens (264, 52, 48, 720, 380). DESIGN.md AS-UX2 leaves thresholds to downstream design, so the narrowest readable thread (`THREAD_MIN_WIDTH = 480`, padding included) is a layout constant, not a token. Thresholds: full at ≥ 744px without an artifact (264 + 480) and ≥ 1124px with one (+ 380); rail below that; single only with an artifact open below 912px (52 + 480 + 380). The window minimum is 532px (rail + readable thread), set in `main.ts` as the BrowserWindow `minWidth` (with `useContentSize`); `SHELL_LAYOUT` in `smoke-probe.ts` mirrors these numbers and a test holds the two equal.
  - **Sidebar (`Sidebar.tsx`):** 20px lockup (`inquello-lockup.svg`, copied byte-for-byte from the design import) with a Collapse navigation IconButton (`aria-expanded`); Workspace selector; New thread; Engagements with nested folders and Tasks; Ad hoc Tasks; person (Avatar + display name and issuer from `identity.getStatus`) and Settings at the bottom. NavRow CSS: 13px UI type, 6×8px padding, 6px radius, `surface-selected` (= ink-150) when current, `surface-hover` on hover. Task rows are links (`<a href="#task-…">`, default prevented) with `aria-current="page"`; Engagements and folders are disclosure buttons with `aria-expanded`/`aria-controls` over their nested lists; actions stay buttons.
  - **Rail:** the symbol as an "Expand navigation" button (`aria-expanded`), New thread, the current Workspace, the Tasks surface (`aria-current="true"`) with a neutral count Badge, the open Task as an `aria-current="page"` link, and the person and Settings at the bottom. Every rail action has an accessible name and a matching visual tooltip shown on `:hover` and `:focus-within`. In full mode Collapse/Expand toggle the Sidebar inline (focus moves to the counterpart control). When the Sidebar does not fit, Expand opens it as a transient overlay inside the same `nav` (focus moves into it); Escape, its Close control, a click outside, or opening a Task closes it and returns focus to the symbol. Collapsing never closes the open Task.
  - **Work area (`Shell.tsx`, `ArtifactArea.tsx`, `shell.css`):** Header, then a grid of the single-mode switch, `main` (thread column, content centred at ≤ 720px), the artifact `aside` (`aria-label="Artifact"`, min 380px growing towards 560px, with a `Contextual review` region for review actions), and the Composer slot last. The Header gains the Engagement name and shows its context in `text-muted`. In single mode a `SegmentedControl` ("Work area": Conversation/Artifact) shows one area at a time; the other stays mounted but `hidden`.
  - **Draft and selection preservation:** `Shell/drafts.ts` `useDraftBinding(taskId)` keeps one unsent draft per Task in the Shell; `renderComposer(binding)` is the plug-in point for Story 1.17. The artifact's selected item is Shell state keyed by artifact ID. Neither is lost on switching views, resizing across modes or reopening a Task.
  - **Keyboard (`Shell/keyboard.ts`):** a renderer `keydown` listener on `window` (no `globalShortcut`): Ctrl+N or Cmd+N (no other modifier, not repeating, target not a text field, the event not already handled) runs New thread when a Workspace is available; Ctrl/Cmd+K is not bound; Escape closes the topmost layer of an `EscapeStack` (today the navigation overlay) and focuses its opener, skipping events a Menu already handled. Nothing binds Escape to a Task, and no "Esc" hint is shown.
  - **Announcements:** one visually hidden `role="status" aria-live="polite"` region (`data-shell-announcer`, with `data-announce-count`) announces each surface change once from its handler: Task opened, Workspace switched, view switched, navigation collapsed/expanded/opened/closed, artifact closed.
  - **Artifact stays closed:** the `artifact` prop is never passed by the app (a test asserts `App.tsx`/`main.tsx` pass neither `artifact` nor `renderComposer`); only tests open it with test-only content.
  - **Smoke (`probeShellLayout`, report `shell-layout`):** after `states`; signs in, creates and opens an ad hoc Task "Smoke layout", then main resizes the real window (smoke-only `resize` → `setContentSize`) to 1200 (full), 700 (rail), 600 (single width) and 532 (minimum). At each width it checks the mode, the 264/52px navigation width, the 48px Header, the 720px thread maximum (and actual width ≤ 720), `scrollWidth <= clientWidth` on the document and body, one navigation, one main, one polite announcer, no complementary region (artifact closed), and the open Task still open and marked. Real key events (`sendInputEvent`) check that Ctrl+K and Cmd+K keydowns end unhandled and change nothing, and that Enter on Collapse then Expand toggles the rail with one announcement each and moves focus. Under an emulated `prefers-color-scheme: dark` the body and Shell stay white.
- **Deviations:**
  - Existing tests and the earlier smoke probes found Task rows as buttons; Task rows are now links as the spec requires, so `organise-shell.test.tsx`, `states-shell.test.tsx` and the `organise`/`states` probe selectors query links instead. No behaviour of Stories 1.14/1.15 changed.
  - The "Design specimen" text button in the Sidebar footer is replaced by the Settings IconButton, which opens the same page (it holds the Account, Providers and Local data blocks).
  - Main gains a window minimum size (532×400 content) besides the smoke-only resize, so "no horizontal overflow down to the window minimum" has a defined minimum.
  - No new DESIGN tokens were needed: every required dimension already existed. The readable-thread minimum is a layout constant (above), passed to CSS as the `--iq-thread-min-width` custom property on the Shell root.
  - Nothing can open the artifact yet, so the smoke cannot show single mode on the real window; at the single width it requires the Shell to report that the artifact would not fit (`data-artifact-fits="false"`, so single mode would apply) with the area closed. Single mode, the switch and draft/selection preservation are covered by the jsdom tests with test-only content.
- **Results (2026-10-29):**
  - `pnpm run build` clean; `pnpm test` with `INQUELLO_TEST_DATABASE_URL` passes 852 tests (27 new in `test/shell-layout.test.tsx`).
  - Keyring smoke with the seeded topology: exit 0; `renderer-privileges`, `design`, `identity`, `data`, `providers`, `organise`, `states` and `shell-layout` all ok.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `desktop/`: `pnpm run build`, then `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
