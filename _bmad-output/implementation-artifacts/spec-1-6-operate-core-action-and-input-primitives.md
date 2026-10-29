---
title: 'Story 1.6: Operate core action and input primitives'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '3dfa5c522e20e1fe303cb49435899cce5b694fdb'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.5 delivered tokens, fonts and `Icon`, but there are no action or input primitives. Later screens would otherwise each invent their own buttons and fields, with uneven keyboard support and unmeasured contrast.

**Approach:** Build `Button`, `IconButton`, `TextField`, `Switch` and `Choice` (radio group, checkbox and option card) as React primitives on native elements. Values come from the DESIGN `components.*` tokens and behaviour from the EXPERIENCE contract. Prove keyboard behaviour with DOM tests. Record contrast for every adjacent colour pair and state, from tokens and from the rendered page.

**Owner decisions (2026-10-28):**
- Install dev-only exact pins jsdom 30.1.3, @testing-library/react 16.3.3, @testing-library/dom 10.4.2 and @testing-library/user-event 14.6.8.
- Contrast evidence comes from both tokens and rendered Chromium.

## Boundaries & Constraints

**Always:**
- **Native semantics:** `<button>`; `<input type=checkbox|radio>` inside `<fieldset>`/`<legend>` for groups; Switch is `<button role="switch" aria-checked>` with a visible On/Off text.
- **Labels:** every control has a programmatic label. IconButton requires `label`, which TypeScript enforces.
- **Disabled:** shown through `disabled` or `aria-disabled` together with a visible, programmatically linked reason (`aria-describedby`).
- **Pending:** a Button marks `aria-busy`, ignores repeat activation and keeps its text label. The spinner is decorative.
- **TextField:** keeps the entered value when an error is set. The error links through `aria-describedby` and `aria-invalid`. The label persists, and the placeholder is never the label.
- **Focus:** a visible `:focus-visible` indicator using the blue-600 edge and the 3px blue-150 ring.
- **Essential boundaries:** ink-600 for TextField, the Switch off state and unselected Choice. Informative text uses `text-muted`.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` removes the spin and pulse animations; the text state remains.
- **Token values only:** sizes, radii, colours and the .45 disabled opacity come from tokens; no new values.

**Never:**
- No control performs or simulates a business operation: no send, stop, approve or save logic. Handlers are props only.
- No Tabs, Menu or other later primitives.
- No custom keyboard handling where the native element already provides it, apart from the Switch's Space and Enter.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Activate button | Tab to Button, Enter or Space | `onPress` called once | N/A |
| Pending repeat | Button `pending`, activated twice | `aria-busy="true"`, no `onPress` call, label text unchanged | N/A |
| Disabled reason | `disabledReason="No route configured"` | Not activatable; reason visible and in `aria-describedby` | N/A |
| Toggle switch | Focus Switch, Space | `aria-checked` flips; text reads On/Off | Disabled: no change |
| Radio arrows | Radio group, ArrowDown | Next option selected and focused; `onChange` with its value | N/A |
| Checkbox | Space on checkbox | Toggles independently of siblings | N/A |
| Field error | TextField with `error`, typed text | Text retained; `aria-invalid="true"`; error text announced via `aria-describedby` | N/A |
| Icon-only | IconButton without `label` | Type error | N/A |
| Expanded state | IconButton `expanded` prop | `aria-expanded` reflects it | N/A |
| Reduced motion | `prefers-reduced-motion: reduce` | No spin or pulse animation; the pending text still shows | N/A |
| Low contrast | Any recorded pair below 4.5:1 (text) or 3:1 (non-text) | Test or smoke fails, naming the pair and state | N/A |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md` -- frontmatter `components.Button`, `IconButton`, `TextField`, `Switch` and `Choice` (around lines 201–245); the component table at lines 512–519; the AS-UX4 notes around lines 420–445.
- `…/EXPERIENCE.md:74-81` -- behaviour for Icon, Button, IconButton, TextField, Switch and Choice.
- `…/imports/inquello-design-system/components/core/{Button,IconButton}.jsx` and `forms/{TextField,Switch,Choice}.jsx` -- visual reference only. Their known keyboard gaps are listed at DESIGN.md:561; do not copy those patterns.
- `desktop/src/renderer/design/tokens.ts`, `tokens.css` and `base.css` -- reuse the tokens; `base.css` holds the `iq-spin`/`iq-pulse` keyframes.
- `desktop/src/renderer/icons/Icon.tsx` -- reuse it for icons inside buttons.
- `desktop/src/renderer/main.tsx` and `specimen.css` -- the specimen page the smoke probes.
- `desktop/src/main/smoke-probe.ts` -- extend the `design` report.
- `desktop/vitest.config.ts` -- the node environment. DOM tests opt in per file with `// @vitest-environment jsdom`.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/package.json` and the lockfile -- add the approved dev pins.
- [x] `desktop/src/renderer/primitives/` -- `Button.tsx` (primary, secondary, quiet and ghost; sm/md/lg; leading icon; pending; disabled reason) and `IconButton.tsx` (ghost, outline, active, and round send/stop with the 9px square). Also `TextField.tsx` (single and multiline; label, instruction, error, disabled, read-only), `Switch.tsx` and `Choice.tsx` (`RadioGroup`, `Checkbox`, option card). Add a `primitives.css` built from tokens, the reduced-motion rule and an `index.ts`.
- [x] `desktop/src/renderer/design/contrast.ts` -- a WCAG relative-luminance ratio, plus the pair list: each primitive × state, giving foreground, adjacent colour, kind (text or non-text) and threshold.
- [x] `desktop/test/primitives.test.tsx` -- every matrix row via Testing Library and user-event, in jsdom.
- [x] `desktop/test/contrast.test.ts` -- computes every pair from tokens. It fails below threshold and writes `desktop/evidence/contrast-primitives.json`, which is committed and checked to match.
- [x] `desktop/src/renderer/main.tsx` -- render each primitive in each state on the specimen page, with `data-contrast` hooks.
- [x] `desktop/src/main/smoke-probe.ts` -- read computed colours from the hooks, compute the rendered ratios and confirm the `:focus-visible` outline appears on Tab. Add the results to `design` and fail below threshold.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-6.

**Acceptance Criteria:**
- Given `pnpm smoke`, when the specimen renders, then every rendered pair meets its threshold, focus is visible, and the run exits 0.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [x] [Review][Patch] R08: Contrast evidence rejects harmless floating-point serialization differences [desktop/test/contrast.test.ts:194] — BMAD medium; likelihood High; impact Medium; change risk Low — recommendation: Fix now.
  - Fixed in remediation (2026-10-29): the evidence check compares parsed documents (keys, every pair and token, strings exactly; numbers within a relative 1e-9) and separately requires every recorded ratio to meet its threshold. Thresholds unchanged. Tests `contrast evidence` in desktop/test/contrast.test.ts, including float noise accepted and a changed ratio, a missing pair, a changed token and a ratio below threshold rejected.

#### Rejected

No formal findings rejected for this story in this pass. Exploratory limits and inherited deferrals are documented in the full report.

## Implementation Notes

- **Cloud machine (Linux, root):** do not commit machine paths.
  - **Install:** `electron_config_cache=/home/user/.cache/inquello/electron-cache pnpm add -D --save-exact <pkg> --store-dir /home/user/.cache/inquello/pnpm-store --config.cache-dir=/home/user/.cache/inquello/pnpm-cache`. Use the same flags with `pnpm install --frozen-lockfile`.
  - **Smoke:** build as root with `pnpm run build`, run `chmod -R o+rX dist`, then `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Never pass `--no-sandbox`.
  - **Baseline:** 228 desktop tests pass and the smoke exits 0 with `design.ok: true`. The engine is built.
- **Specimen file:** the specimen moved from `main.tsx` into `src/renderer/Specimen.tsx`, so `test/primitives.test.tsx` can render it in jsdom and check that every hook and selector the rendered pairs read exists. `main.tsx` only mounts it.
- **Component tokens:** `tokens.ts` gains `components` (Button, IconButton, TextField, Switch, Choice) exactly as DESIGN.md writes them, plus `resolveToken`. `tokens.css` is unchanged, because the import has no variables for these values; `primitives.css` writes them as literals, and a test allows only token sizes, the component table's literals (7×9px padding, 4px checkbox radius, 9px stop square), 1px borders and the 0.45 opacity.
- **Focus indicator:** a 1px blue-600 outline at a 3px offset, outside the 3px blue-150 ring, so the edge meets the ring (4.95:1) and the surface (6.16:1) whatever the control's fill. TextField instead turns its border blue-600 inside the ring, as DESIGN.md describes.
- **Disabled:** Button, IconButton and Switch use `aria-disabled` and stay focusable, so the reason can be found; TextField and Choice use native `disabled`. There is no bare `disabled` prop. The disabled control itself is listed under `exempt` (WCAG treats inactive controls as exempt); the reason text is measured.
- **Pending text:** a pending Button shows a visible `In progress` note (`pendingText` overrides it), linked through `aria-describedby`. The label text is unchanged.
- **Exemptions recorded, not hidden:** the off-switch thumb on its ink-300 track (1.67:1) is supplementary, because the visible On/Off text and `aria-checked` carry the state. Decorative outlines and the pale ring are also listed, each with its reason, in `evidence/contrast-primitives.json`.
- **Rendered coverage:** 72 of the 91 token pairs are re-read in Chromium (static states, plus focus after real Tab presses on five hooks). Hover, placeholder and sidebar placements are token-only, because the probe does not move a pointer or style the `::placeholder` pseudo-element.
- **Main cannot import renderer modules:** `vite build` empties `dist/renderer`, so `smoke-probe.ts` carries its own copy of the WCAG ratio. `test/contrast.test.ts` holds the two copies equal on every pair, and the page supplies the pair list in `data-contrast-pairs`. Main applies the thresholds by kind itself.
- **Pulse:** none of these primitives pulses, so the reduced-motion rule removes only the spin. The `iq-pulse` keyframes stay in `base.css` for Story 1.8.
- **Results (2026-10-28):** both type checks are clean; 284 tests pass (56 new); the smoke `design` report is ok, with 72 rendered pairs measured (minimum 3.65:1, non-text), all five focus hooks reached with `:focus-visible`, and exit 0. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `desktop/`):**
- `pnpm install --frozen-lockfile` (with the cloud cache flags) -- expected: success
- `pnpm exec tsc --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: clean
- `pnpm test` -- expected: all pass
- `pnpm run build`, then the smoke as the `smoke` user under `xvfb-run` -- expected: exit 0, with `design.ok: true`
