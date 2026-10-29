---
title: 'Story 1.17: Compose a plain private request without claiming later inputs'
type: 'feature'
created: '2026-10-29'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-16-navigate-desktop-shell-keyboard-responsive.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The shell reserves a Composer slot and a per-Task draft store (Story 1.16), but there is no Composer. Users cannot prepare a request, and nothing stops a later control from pretending to work before it does (C01, FR-3, UX-DR29, UX-DR48).

**Approach:** Build the Composer in the Story 1.16 slot as a plain-text editor bound to `useDraftBinding`. It follows the documented Enter, Shift+Enter and input-method rules. Send is disabled with a visible reason until real runs exist. Attachments, Method, scope, environment and reasoning controls are not built; any of them shown is labelled as unavailable, never simulated.

**Owner decisions (2026-10-29):**
- **Draft store:** drafts are kept in memory only, for the window's lifetime. Nothing is written to disk, so there is no new governed local data.
- **Send:** disabled with an explained reason until Story 1.25. Enter never sends and never loses the text.

## Boundaries & Constraints

**Always:**
- **Surface:** the Composer is a white, 14px-radius surface with the composer shadow, body typography and a 30px Send control, all from DESIGN tokens. It is the last stop in the shell tab order, and its text area is labelled (for example "Request for this Task").
- **Drafts:** one draft per Task, plus one for "no Task open", through the Story 1.16 `DraftBinding`.
  - Text survives opening other Tasks, rail and single-mode changes, and the Conversation/Artifact switch.
  - Drafts are cleared on sign-out, a change of principal, or deleting the Task.
  - Never persisted, logged or sent to main.
- **Keys:**
  - Shift+Enter inserts a newline.
  - Enter submits only when the advertised mode permits. In this story Send is never available, so Enter does nothing and keeps the text.
  - During input-method composition (`isComposing`, or keyCode 229), Enter never submits and is left to the input method.
  - Ctrl/Cmd+N and Escape keep their Story 1.16 behaviour. Escape in the Composer never clears the draft.
- **Send:**
  - Visible and disabled (`aria-disabled`, still focusable so the reason can be read).
  - The reason text is linked by `aria-describedby`: "Sending starts once a processing route is set up."
  - When the draft is empty, the reason reads "Type a request to send." before the route reason.
- **Later inputs:** no attach, Method, scope, environment or reasoning controls. If one is shown as a placeholder, it is a disabled control labelled "Not available yet". There are no fake file chips and no Method picker that pretends to select.
- **Privacy:** a draft belongs to the signed-in principal's open Task in this window only. It is never shown for another principal.

**Never:**
- No sending, queuing or recording of requests (Story 1.25).
- No disk, `localStorage` or main-process storage of drafts.
- No simulated attachments or Methods.
- No engine changes.
- No new dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preserve | Type in Task A, open Task B, return to A | A's text intact; B has its own draft | N/A |
| Layout change | Draft exists, window resized to rail or single mode | Text and caret focus kept | N/A |
| Shift+Enter | Pressed in text | Newline inserted | N/A |
| Enter | Pressed with text | Nothing sent; text kept; reason still visible | N/A |
| IME | Enter while composing | Composition commits; no submit | N/A |
| Empty | No text | Send disabled; "Type a request to send." | N/A |
| Send focus | Tab to Send | Focusable; reason announced; activation does nothing | N/A |
| Sign-out | Drafts exist, user signs out | All drafts cleared | N/A |
| Task deleted | Draft on a deleted Task | Draft discarded | N/A |
| Later inputs | Look for attach or Method | Absent, or disabled and labelled "Not available yet" | N/A |
| Restart | App quit and reopened | Drafts gone (memory only) | N/A |

</frozen-after-approval>

## Code Map

- `desktop/src/renderer/Shell/drafts.ts` -- the Story 1.16 `DraftBinding`; add clearing on sign-out, a change of principal and Task deletion.
- `desktop/src/renderer/Shell/` -- new `Composer.tsx`; mount it in the slot in `TaskView.tsx`/`Shell.tsx`; `shell.css`.
- `desktop/src/renderer/primitives/` -- reuse the button and field primitives (Stories 1.6–1.8).
- `desktop/src/main/smoke-probe.ts` -- a `composer` report.

## Tasks & Acceptance

**Execution:**
- [ ] Composer component bound to the draft store; key handling (Enter, Shift+Enter, IME); disabled Send with its reasons; clearing rules.
- [ ] jsdom tests for every matrix row.
- [ ] Smoke `composer` report:
  - type into Task A, open Task B, return and check A's text;
  - Enter does not clear the text;
  - Send is disabled with the reason;
  - no Method or attach control is enabled;
  - after sign-out the drafts are gone.
- [ ] `sprint-status.yaml` (1-17).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `composer` and every earlier report are ok, and it exits 0.

## Verification

**Commands:**
- In `desktop/`: `pnpm run build`, then `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
