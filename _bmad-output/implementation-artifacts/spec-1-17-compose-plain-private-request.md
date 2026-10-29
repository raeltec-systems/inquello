---
title: 'Story 1.17: Compose a plain private request without claiming later inputs'
type: 'feature'
created: '2026-10-29'
status: 'done'
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
- [x] Composer component bound to the draft store; key handling (Enter, Shift+Enter, IME); disabled Send with its reasons; clearing rules.
- [x] jsdom tests for every matrix row.
- [x] Smoke `composer` report:
  - type into Task A, open Task B, return and check A's text;
  - Enter does not clear the text;
  - Send is disabled with the reason;
  - no Method or attach control is enabled;
  - after sign-out the drafts are gone.
- [x] `sprint-status.yaml` (1-17).

**Acceptance Criteria:**
- Given the smoke with the seeded topology, when it runs, then `composer` and every earlier report are ok, and it exits 0.

## Implementation Notes

- **As built:**
  - **`Shell/Composer.tsx`:** a plain `<textarea>` with a visually hidden `<label>` ("Request for this Task", or "Request (no Task open)"), a muted placeholder and the round 30px `IconButton` Send. Send always carries `disabledReason`, so it is `aria-disabled`, stays focusable, and shows its reason as a visible note linked by `aria-describedby`: "Sending starts once a processing route is set up.", preceded by "Type a request to send." while the text is empty or only whitespace. Activation does nothing (the primitive swallows the click and there is no `onPress`). Keys: Enter with no modifier is `preventDefault`ed, so nothing is sent and no newline is added; Shift+Enter and other modified Enters keep the field's own behaviour; Enter while composing (`isComposing` on the event or its native event, or keyCode 229) is left entirely to the input method. Escape is not handled by the Composer, so it never clears the draft; Ctrl/Cmd+N stays with the text field as in Story 1.16. No attach, Method, scope, environment or reasoning control is rendered (the spec allows absence), and there are no file chips.
  - **Styling (`shell.css`):** `.iq-composer` uses only DESIGN tokens: `--white`, `--text-primary`, an `--ink-600` boundary (DESIGN `components.Composer.border`), `--radius-composer` (14px), `--shadow-composer`, `--type-body` and a `--text-muted` placeholder. The focus indicator (blue-600 edge outside the blue-150 ring) is drawn on the whole surface while the field has focus. The reason note sits to the left of Send visually; in the DOM, Send comes first, so the field then Send are the last two tab stops in the Shell.
  - **Draft store (`Shell/drafts.ts`):** `createDraftStore()` holds one entry per Task (with its Workspace) plus the no-Task entry, in renderer memory only. `useDraftBinding(taskId, store?, workspaceId?)` subscribes through `useSyncExternalStore` and still gives the Story 1.16 `DraftBinding`. Clearing rules:
    - `clear()` on a sign-in or sign-out attempt from the Account block (`App` passes `onIdentityChanged` through `Specimen` to `Account`), after a sign-in from the signed-out Sidebar, and whenever the Shell reads `signedIn: false`;
    - `claim(owner)` clears every draft when the identity status names a different principal (display name and issuer) from before;
    - `retain(workspaceId, taskIds)` runs after each tree read and drops drafts of that Workspace's Tasks that are no longer listed (deleted).
  - **Mounting (`Shell.tsx`, `App.tsx`):** while signed in, the Shell renders the Composer in the Story 1.16 slot unless a test passes `renderComposer`. The draft follows the Task actually shown; if the open Task disappears, the no-Task draft applies. `App` owns the window's store and passes it as `drafts`, so a visit to Settings (which unmounts the Shell) keeps the drafts. Without that prop the Shell keeps its own store, as before. Nothing is written to disk, `localStorage` or main, and nothing is logged.
  - **Smoke (`probeComposer`, report `composer`, after `shell-layout`):** this report is described under Results below.
- **Deviations:**
  - The Story 1.16 test "the Composer slot is reserved and empty without a Composer" now expects the slot to hold the real Composer. The empty slot was a placeholder for this story.
  - The draft store moved from Shell-local state to an App-owned store, so opening Settings does not discard drafts. Because sign-out happens in Settings, `Account` and `Specimen` gained an optional `onIdentityChanged` callback. This is beyond the Code Map's files, but it is needed for "drafts are cleared on sign-out" once drafts outlive the Shell.
  - The renderer is never given a principal ID, so a change of principal is detected from the identity status's display name and issuer. Every sign-in and sign-out in this window also clears the drafts, so the only gap is an unnoticed main-side session change between two principals with the same display name and issuer.
  - The Composer is hidden while signed out, so nothing is typed into a draft that no principal owns.
  - `TaskView`'s placeholder no longer says the Composer is still to come.
- **Results (2026-10-29):**
  - `pnpm run build` is clean.
  - `pnpm test` with `INQUELLO_TEST_DATABASE_URL` passes 876 tests, 24 of them new in `test/composer.test.tsx`.
  - The keyring smoke with the seeded topology exits 0. These reports are all ok: `renderer-privileges`, `design`, `identity`, `data`, `providers`, `organise`, `states`, `shell-layout` and `composer`.
  - The `composer` report checks that:
    - after creating Tasks A and B and typing in each, each kept its own draft;
    - the field is labelled "Request for this Task";
    - B started empty, with Send showing the empty and route reasons;
    - a real Enter kept the text (length 22, focused) and a real Shift+Enter added one newline (length 23);
    - Send is `aria-disabled`, has `tabIndex` 0, takes focus, carries the route reason, and changed nothing when activated;
    - no other control in the Composer is enabled, and there are no file chips or later-input wording;
    - after signing out through the Account block, the signed-out Shell showed no Composer;
    - after signing in again, both drafts were empty.
  - Draft text never appeared in the smoke output.
  - Step-04 review was skipped by owner rule.

## Verification

**Commands:**
- In `desktop/`: `pnpm run build`, then `pnpm test` with the database URL -- expected: all pass
- Keyring smoke with the seeded topology -- expected: exit 0, all reports ok
