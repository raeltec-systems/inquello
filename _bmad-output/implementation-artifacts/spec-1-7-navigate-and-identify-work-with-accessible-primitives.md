---
title: 'Story 1.7: Navigate and identify work with accessible primitives'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '509a8a5c6abf7d34c02265af7c034708ca1319a7'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-6-operate-core-action-and-input-primitives.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Screens need to identify people and agents, count attention items, switch views and offer context actions. No accessible primitives exist yet for those jobs.

**Approach:** Add `Avatar`, `Badge`, `SegmentedControl`, `Tabs`, `Menu` and `StatusChip` beside the Story 1.6 primitives. Values come from the DESIGN `components.*` tokens and behaviour from EXPERIENCE. Reuse Story 1.6's jsdom tests, contrast pair list, committed evidence file and smoke design report. No new dependencies.

## Boundaries & Constraints

**Always:**
- **Avatar:** a person is an initials disc with an accessible name, the full readable identity, given as a required prop. Initials are supplementary. The agent is the Inquello symbol, using the small symbol at 20px or less; never a face or disc. The `decided` treatment is visual only and needs a recorded identity, so the prop takes one.
- **Badge:** it always carries a text or accessible meaning naming what is counted. Count changes never move focus and are announced politely only when `live`.
- **SegmentedControl and Tabs:** use proper tablist/tab/tabpanel semantics (radiogroup semantics for SegmentedControl). Arrows, Home and End move focus. Tabs default to manual activation, where Enter or Space activates; `activation="automatic"` is opt-in. Selection changes only the view and keeps panel state.
- **Menu:**
  - The trigger exposes `aria-expanded` and `aria-haspopup`.
  - Opening focuses the first enabled item. Arrows, Home and End navigate, and Enter activates.
  - Escape and Tab close the menu; Escape returns focus to the trigger, and so does an outside click.
  - Checkmarks appear only on items with `menuitemradio` or `menuitemcheckbox` semantics.
  - An unavailable item stays listed with its reason.
- **StatusChip:** covers exactly the seven source states (suggested, investigating, open, evidence, waiting, accepted, explained), each with explicit visible text. Any other state needs a caller-supplied truthful label. Accepted and explained use green-800 text.
- **Contrast:** all six join the Story 1.6 contrast list and evidence, at 4.5:1 for text and 3:1 for non-text. Exemptions need a written reason.
- **Values:** tokens only.

**Never:**
- No business actions behind any control.
- No status implying execution completion, approval or delivery.
- No positioning library; the Menu uses simple anchored placement.
- No JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine or Toast (Story 1.8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tabs manual | Focus tab 1, ArrowRight | Focus moves to tab 2; selection unchanged until Enter or Space | N/A |
| Tabs wrap | Last tab, ArrowRight / Home / End | Wraps to first / first / last | N/A |
| Segmented | ArrowRight on segment | Next segment selected; `onChange` called | N/A |
| Menu open | Enter on trigger | `aria-expanded="true"`; first enabled item focused | N/A |
| Menu close | Escape inside the menu | Closed; focus on trigger | N/A |
| Menu disabled item | Arrow onto an unavailable item | Focusable, `aria-disabled`, reason exposed; Enter does nothing | N/A |
| Menu choice | `menuitemradio` items | Exactly one `aria-checked="true"`; checkmark shown | N/A |
| Unknown status | `status="blocked"` with no label | Type error | Runtime: renders the supplied `label` or nothing, and warns |
| Person avatar | `name="Dana Osei" initials="DO"` | Accessible name "Dana Osei"; initials visible | N/A |
| Badge live | `live`, count 3 to 4 | Polite announcement; focus unchanged | N/A |

</frozen-after-approval>

## Code Map

- `…/ux-inquello-2026-10-26/DESIGN.md` -- frontmatter `components.Avatar`, `Badge`, `SegmentedControl`, `Tabs`, `Menu` and `StatusChip`; the component table at lines 515–523.
- `…/EXPERIENCE.md:77-85` -- behaviour contracts.
- `…/imports/inquello-design-system/components/{core/Avatar,core/Badge,forms/SegmentedControl,navigation/Tabs,navigation/Menu,status/StatusChip}.jsx` -- visual reference and person tones. `assets/logo/inquello-symbol.svg` and `inquello-symbol-small.svg` -- copy them for the agent Avatar, with the symbol decorative inside a labelled wrapper.
- `desktop/src/renderer/primitives/` -- Story 1.6 patterns and `index.ts`. `design/contrast.ts` holds the pair list. `desktop/evidence/contrast-primitives.json` is the evidence file, written with `INQUELLO_WRITE_EVIDENCE=1`.
- `desktop/src/renderer/Specimen.tsx` and `desktop/src/main/smoke-probe.ts` -- the specimen hooks and rendered checks (the probe keeps its own WCAG ratio copy).
- `desktop/src/renderer/design/tokens.ts` -- add the six `components.*` entries; the DESIGN conformance test covers them.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/src/renderer/primitives/` -- `Avatar.tsx`, `Badge.tsx`, `SegmentedControl.tsx`, `Tabs.tsx` (`Tabs`, `TabList`, `Tab`, `TabPanel`), `Menu.tsx` and `StatusChip.tsx`, with styles in `primitives.css` and exports added.
- [x] `desktop/src/renderer/design/tokens.ts`, `contrast.ts`, and the symbol assets -- the new component tokens; pairs for each primitive × state.
- [x] `desktop/test/primitives-navigation.test.tsx` -- every matrix row in jsdom.
- [x] `desktop/evidence/contrast-primitives.json` -- regenerate; the contrast test still matches.
- [x] `desktop/src/renderer/Specimen.tsx` and `desktop/src/main/smoke-probe.ts` -- render each variant and state; read the rendered pairs; confirm the Tab focus indicator on the tab and menu trigger.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-7.

**Acceptance Criteria:**
- Given `pnpm smoke`, when the specimen renders, then every rendered pair for the new primitives meets its threshold, focus is visible, and the run exits 0 with `design.ok: true`.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [x] [Review][Patch] R12: Lossy ID normalization creates duplicate tab and menu ARIA references [desktop/src/renderer/primitives/shared.tsx:64] — BMAD medium; likelihood Low; impact Medium; change risk Low — recommendation: Schedule before dynamic values; cheap to fix sooner.
  - Fixed in remediation (2026-10-29): idFragment escapes every character other than ASCII letters, digits and `-` (including `_`) as `_<hex>_`, so distinct values never share an id. Tests `ARIA ids for caller values (review R12)` in desktop/test/primitives-navigation.test.tsx: `a.b`, `a b`, `a_b` and others in Tabs and a Menu radio group, unique ids and correct aria-controls/aria-labelledby targets.

Related shared verification issue: R08 in Story 1.6 covers this story’s contrast evidence too; count it once.

#### Rejected

- #8 Tabs retains removed selection — `low`; likelihood Low, impact Low. The uncontrolled selection stays stale if children remove that value. Existing caller has a fixed tab set; dynamic removal is not an accepted current flow. Automatic reconciliation adds state/registration complexity; revisit with that caller.
- #9 SegmentedControl retains absent selection — `low`; likelihood Low, impact Low. Changed options can leave none checked, but the first option remains keyboard reachable and selection recovers on interaction. Current options are fixed. Additional reconciliation is not worth adding before a dynamic consumer exists.

## Implementation Notes

- **Cloud machine (Linux, root):** do not commit machine paths. Dependencies are installed, and no new ones are allowed.
  - **Smoke:** build as root with `pnpm run build`, run `chmod -R o+rX dist`, then `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Never pass `--no-sandbox`.
  - **Baseline:** 284 desktop tests pass and the smoke exits 0 with `design.ok: true`.
- **Avatar tones:** the reference's green (`#e6efe9`) and amber (`#efe9e1`/`#8a5a2b`) person tones are not tokens, so the tones use green-800 on green-150 and amber-800 on amber-150; blue keeps blue-600 on blue-150 (4.95:1). Sizes are 20, 24 (default) and 32px, all spacing tokens; initials use 11px (13px at 32px). The agent symbol height is `size × 0.8`, so 20 and 24px use the small symbol and 32px the regular one. The two SVGs are copied byte for byte into `design/assets/logo/` (a test checks this) and served as `'self'` assets; `src/renderer/assets.d.ts` types the `.svg` import.
- **Decided:** `decided={{ recordedIdentity }}` applies the green/white treatment only when the identity is non-blank (otherwise it warns and shows the tone); the accessible name stays the person's name.
- **Badge:** the number is `aria-hidden` and a visually hidden "<count> <label>" carries the meaning; only `live` adds `aria-live="polite"` and `aria-atomic`.
- **Tabs:** every panel stays mounted (`hidden` when unselected, `tabIndex=0`); a text space between label and count keeps the name "Changes 3". `Tabs` requires `value` or `defaultValue` by type.
- **Menu:** items are `tabIndex=-1` rows navigated from the menu's key handler; Enter or Space clicks the focused row. Action and radio items close the menu and return focus to the trigger; checkbox items stay open. Tab closes the menu after moving focus to the trigger, so Tab continues in page order from it. An outside click closes the menu and returns focus to the trigger, except when that click focused another control, which keeps focus (judgment call: never pull focus away from a field the user clicked). The heading names the menu (`aria-labelledby`), otherwise the trigger does.
- **StatusChip:** an unknown state with a label renders it in the neutral outlined style without a warning; with no label it renders nothing and warns. A label passed for a source state is ignored with a warning, so the seven source texts cannot be relabelled. The optional 16px decision disc from the component table is not built (not in this story's Always list).
- **Key handling:** the Story 1.6 test that forbids `onKeyDown`/`addEventListener` in primitive sources now exempts only `SegmentedControl`, `Tabs` and `Menu`, whose keyboard model no native element provides.
- **Exemptions (written reasons in the evidence):** the person disc edge, the Badge fill edge, the SegmentedControl group outline, the selected Tab's pale quiet fill (selection is carried by `aria-selected` and the weight-500 primary label), the Menu border, StatusChip borders and fills other than the measured dashed suggestion outline, and the disabled Menu label at .45 opacity.
- **Smoke probe:** `REQUIRED_FOCUS_HOOKS` (the five Story 1.6 hooks plus `segmented`, `tabs` and `menu-trigger`) must be declared and reached; `MAX_TABS` rose from 60 to 80 for the longer page. Token-only Story 1.7 pairs: hovers, sidebar placements, the agent symbol (inside an image file) and focus inside an open menu.
- **Results (2026-10-28):** both type checks are clean; 327 tests pass (43 new); the evidence holds 141 pairs, all passing (minimum 3.65:1, the Story 1.6 non-text pair), 108 of them rendered. The smoke `design` report is ok with 108 rendered pairs measured (36 new, minimum 4.95:1), all eight focus hooks reached with `:focus-visible`, and exit 0. Step-04 review was skipped by owner rule.

- **Owner follow-up (2026-10-28):**
  - **Avatar tones:** these now use the approved brand foregrounds the source tones intended: green-600 `#2F7A52` on green-100 (4.74:1) and amber-700 `#8A5A12` on amber-150 (5.23:1); blue-600 on blue-150 is unchanged. green-600 on green-150 would be 4.47:1, so green-100 is the nearest passing palette background.
  - **Decision disc:** no later story builds StatusChip's optional 16px decision disc (UX-DR20), so it is added here. It is green-600 with white 8px initials (5.22:1), and its accessible name is "Decided by <name>". It needs the decision's recorded identity, and without one it is not shown and a warning is logged.
  - **Results:** 329 tests pass; contrast evidence has 142 pairs, all passing; the smoke measures all three new pairs and exits 0.

## Verification

**Commands (in `desktop/`):**
- `pnpm exec tsc --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: clean
- `pnpm test` -- expected: all pass
- `pnpm run build`, `chmod -R o+rX dist`, then the smoke as the `smoke` user under `xvfb-run` -- expected: exit 0, with `design.ok: true`
