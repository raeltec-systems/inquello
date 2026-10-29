---
title: 'Story 1.8: Inspect progress and proposed actions with accessible primitives'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '30506d91b74f14ae78a20a8b356a854acda54e59'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-7-navigate-and-identify-work-with-accessible-primitives.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Progress, claims, attachments, proposed actions, diffs and brief feedback have no primitives yet. Without them, later stories could show a step as done, an agent claim as a decision, or a toast as proof of a save.

**Approach:** Add `JudgmentTag`, `FileChip`, `PlanStep`, `ApprovalCard`, `DiffLine` and `Toast` beside the Story 1.6 and 1.7 primitives. Values come from the DESIGN `components.*` tokens and behaviour from EXPERIENCE. Reuse the jsdom tests, the contrast pair list, the committed evidence file and the smoke design report. This is the first use of the spin and pulse animations. No new dependencies.

## Boundaries & Constraints

**Always:**
- **JudgmentTag:** five kinds: calculation ƒ, observation ◦, suggestion (dashed blue), decision (green dot) and gap (–, amber). The kind is in the accessible text, beside the claim's readable content. `decision` requires a `basis`, the named person or policy plus its scope, which TypeScript enforces.
- **FileChip:** PDF, XLS, DOC and DIR tags, plus a caller label for any other type. The file name is visible and the source detail accessible. Remove is a `<button>` labelled "Remove <name> from task context". The states `failed`, `unreadable` and `permission-limited` show their own text. PDF red is a type cue, not an error.
- **PlanStep:**
  - States are `pending`, `running`, `done`, `blocked`, `failed` and `interrupted`, each with visible or accessible text.
  - Only `done` shows the check. Running uses the blue indicator with pulse or spin.
  - The states are rendered as an ordered list.
  - State transitions are announced once through one polite live region; visual pulses are not announced.
- **ApprovalCard:**
  - Required props are `context`, `action` (the exact action), `destination`, `consequence`, a primary action label and `onPrimary`.
  - Generic labels (Approve, OK, Yes, Confirm, Continue) are rejected with a warning and the card is not rendered.
  - Alternative actions are optional, each with a real label and handler.
  - It is a labelled `region`, with focus left where it is.
- **DiffLine:** kinds `add` (+), `delete` (−), `change` (~) and `context`. The sign and kind text are always present, not colour alone. A required `stage` prop (`suggested`, `applied-locally` or `delivered`) shows as text. An optional gutter shows the source line or row.
- **Toast:**
  - It uses `role="status"` and never moves focus.
  - It auto-dismisses after 2.6s only when `transient` is set, and pausing on hover or focus stops the timer.
  - It accepts no error or required-action kinds; those stay in persistent UI.
- **Reduced motion:** `prefers-reduced-motion` removes spin and pulse while a running step still says "Running".
- **Contrast:** all six join the contrast list and evidence, at 4.5:1 for text and 3:1 for non-text. Exemptions need a written reason.
- **Values:** tokens only.

**Never:**
- No real approval, apply, remove or delivery behaviour; handlers are props only.
- No toast used as confirmation of a save or external action.
- No positioning or queue manager for toasts beyond the single primitive.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Done step | `PlanStep state="done"` | Check marker, done styling, accessible "Done" | N/A |
| Interrupted step | `state="interrupted"` | Text "Interrupted", no check | N/A |
| Step transition | Step rerendered running → done | One polite announcement "<step>: done" | N/A |
| Reduced motion | Running step, `prefers-reduced-motion: reduce` | No animation; "Running" text visible | N/A |
| Generic approval | `primaryLabel="Approve"` | Nothing rendered | Warning naming the label |
| Specific approval | `primaryLabel="Send October statement request"` | Region shows context, action, destination and consequence; button carries that label | N/A |
| Decision tag | `kind="decision"` without `basis` | Type error | Runtime: tag renders as "Decision (basis missing)" and warns |
| Remove file | Tab to the remove button, Enter | `onRemove` called once; label names the file | N/A |
| Unreadable file | `state="unreadable"` | Visible "Unreadable" text; distinct from the PDF type colour | N/A |
| Diff line | `kind="delete" stage="suggested"` | "−" sign, accessible "Removed line, suggested" | N/A |
| Transient toast | `transient`, 2.6s pass | Dismissed; focus unchanged | Hovered or focused: stays until it is left |

</frozen-after-approval>

## Code Map

- `…/ux-inquello-2026-10-26/DESIGN.md` -- frontmatter `components.JudgmentTag`, `FileChip`, `PlanStep`, `ApprovalCard`, `DiffLine` and `Toast`; the component table at lines 524–529; the motion paragraph around line 498.
- `…/EXPERIENCE.md:86-91` -- behaviour contracts.
- `…/imports/inquello-design-system/components/status/{JudgmentTag,FileChip}.jsx` and `workflow/{PlanStep,ApprovalCard,DiffLine,Toast}.jsx` -- visual reference only.
- `desktop/src/renderer/primitives/` (Story 1.6–1.7 patterns, `primitives.css`, `index.ts`) and `design/tokens.ts` -- add the six `components.*` groups; the conformance test covers them. `base.css` holds the `iq-spin`/`iq-pulse` keyframes.
- `desktop/src/renderer/design/contrast.ts`, `desktop/evidence/contrast-primitives.json` (regenerate with `INQUELLO_WRITE_EVIDENCE=1`), `Specimen.tsx` and `src/main/smoke-probe.ts` -- the evidence and rendered checks. The probe keeps its own WCAG ratio copy.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/src/renderer/primitives/` -- `JudgmentTag.tsx`, `FileChip.tsx`, `PlanStep.tsx` (with `PlanSteps` list and live region), `ApprovalCard.tsx`, `DiffLine.tsx` and `Toast.tsx`; add their styles, the reduced-motion rule for pulse, and exports.
- [x] `desktop/src/renderer/design/tokens.ts` and `contrast.ts` -- the component tokens; pairs for each primitive × state.
- [x] `desktop/test/primitives-progress.test.tsx` -- every matrix row in jsdom, using fake timers for the Toast.
- [x] `desktop/evidence/contrast-primitives.json` -- regenerate.
- [x] `desktop/src/renderer/Specimen.tsx` and `desktop/src/main/smoke-probe.ts` -- every variant and state; rendered pairs; Tab focus on the FileChip remove button and the ApprovalCard primary action. The probe also confirms that the running step's animation stops when reduced motion is emulated (`Emulation.setEmulatedMedia` through `webContents.debugger`).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-8.

**Acceptance Criteria:**
- Given `pnpm smoke`, when the specimen renders, then every rendered pair meets its threshold, focus is visible, the running step stops animating under emulated reduced motion while still reading "Running", and the run exits 0 with `design.ok: true`.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [x] [Review][Patch] R14: DiffLine collapses significant whitespace in plain-text source [desktop/src/renderer/primitives/primitives.css:852] — BMAD low; likelihood Low; impact Medium; change risk Low — recommendation: Optional small cleanup before source-code diff use.
  - Fixed in remediation (2026-10-29): `.iq-diff-body` uses `white-space: pre-wrap` (still `overflow-wrap: anywhere`). Test `keeps the whitespace of plain-text source, still wrapping long lines (review R14)` in desktop/test/primitives-progress.test.tsx. No real-browser check was run.

Related shared verification issue: R08 in Story 1.6 covers this story’s contrast evidence too; count it once.

#### Rejected

- #10 Toast dismissal survives changed content — `low`; likelihood Low, impact Low. A reused dismissed instance remains hidden, but a new keyed/mounted Toast has a fresh lifecycle; no current transient-message replacement consumer exists (specimen is persistent). Adding message-identity semantics now is unnecessary.

## Implementation Notes

- **Cloud machine (Linux, root):** do not commit machine paths. Dependencies are installed, and no new ones are allowed.
  - **Smoke:** build as root with `pnpm run build`, run `chmod -R o+rX dist`, then `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Never pass `--no-sandbox`.
  - **Baseline:** 329 desktop tests pass; the contrast evidence has 142 pairs; the smoke exits 0 with `design.ok: true`.
- **JudgmentTag:** the kind is visible text ("Calculation", …) after a decorative glyph, then a visually hidden ": " and the claim (`children`, required). `basis` is `{ by, scope }` and shows as "by <by> (<scope>)". A decision without a complete basis (missing or blank) reads "Decision (basis missing)" in text-muted with no green dot, and warns. Dot is 8px and the dashed box 10×8px (spacing tokens; the reference's 9px dot is not a token).
- **FileChip:** the tag is `aria-hidden` and a hidden readable type name (PDF document, Spreadsheet, Document, Folder, or the caller's `typeLabel`) precedes the name; `source` is hidden text ", from <source>". An unknown type without `typeLabel` is a type error; at runtime it shows FILE and warns. State text is red-800 (failed) or amber-800 (unreadable, permission-limited) with a decorative alert glyph, never the file-pdf red-600. The remove button is a 24px target with negative vertical margins so the chip does not grow. The `tag`-only reference variant is not built (the name must stay visible).
- **PlanStep:** state text is visible for running, blocked, failed and interrupted and visually hidden for pending and done. Indicator boundaries: ink-600 (pending, interrupted on surface-subtle), blue-600 on blue-150 (running), green-600 with a white check (done), amber-700 on amber-150 (blocked), red-600 on red-50 (failed); boundaries are 1px (the reference's 1.5px is not a token). Only the running step's inner 6px dot pulses (`iq-pulse var(--duration-slow) var(--ease-standard)`, since DESIGN gives no pulse duration), so the measured boundary never fades. `PlanSteps` tracks states by `id`; the first render, added steps and unchanged rerenders announce nothing.
- **ApprovalCard:** the overline reads "Permission needed" rather than the reference's "Approval needed", so a scoped action permission is not read as Professional Approval. The region is named by the overline plus the action. Destination and consequence are a `<dl>`. Generic labels are matched trimmed, case-insensitively and without trailing punctuation; a blank label counts as generic. Alternatives with a generic or blank label are dropped with a warning (judgment call, same rule as the primary).
- **DiffLine:** hidden text "<Kind> line, <stage>: " precedes the body; the sign and the visible stage text are `aria-hidden`, so nothing is read twice. Context lines show no sign. The change sign is blue-600 on blue-50.
- **Toast:** `TOAST_DISMISS_MS = 2600`. Leaving hover or focus restarts a full 2.6s. A transient toast has `tabIndex=0` so keyboard users can hold it (WCAG 2.2.1); a persistent one is not a tab stop. `kind` is typed `never`; at runtime any `kind` renders nothing and warns.
- **Tests changed outside the new file:** the Story 1.6 CSS size check now splits multi-value tokens (the 12px 14px and 8px 14px paddings), and its animation check now expects the pulse and its reduced-motion rule. `design.test.ts` adds the motion fixture and failure cases; `contrast.test.ts` adds Story 1.8 coverage.
- **Smoke probe:** `REQUIRED_FOCUS_HOOKS` adds `file-chip-remove` and `approval-primary`, and `MAX_TABS` rose from 80 to 120. `probeMotion` attaches `webContents.debugger`, emulates `prefers-reduced-motion` as `no-preference` and then as `reduce`, and reads the running step's `animationName`, its running `getAnimations()`, and whether "Running" is visible. It then clears the emulation and detaches. `evaluateDesign` reports this as `motion`.
- **Exemptions (written reasons in the evidence):** FileChip border, the pulsing running dot, ApprovalCard card and quote borders, and the DiffLine row fills. Token-only Story 1.8 pairs: the remove-glyph hover, the decision without a basis, and focus on a transient Toast (the specimen Toast is persistent so it stays on screen for the probe).
- **Results (2026-10-28):** both type checks are clean. 382 tests pass (53 new). The evidence holds 214 pairs, all passing (overall minimum 3.65:1, the Story 1.6 non-text pair; Story 1.8 minimum 4.95:1), and 177 of them are rendered. The smoke `design` report is ok: it measures all 177 rendered pairs (68 new, minimum 4.95:1) and reaches all ten focus hooks with `:focus-visible`. The running step pulses (`iq-pulse`, 1 running animation) with motion allowed and stops (`none`, 0) under emulated reduced motion, with visible "Running" text both times. Exit 0. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `desktop/`):**
- `pnpm exec tsc --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: clean
- `pnpm test` -- expected: all pass
- `pnpm run build`, `chmod -R o+rX dist`, then the smoke as the `smoke` user under `xvfb-run` -- expected: exit 0, with `design.ok: true`
