---
title: 'Story 1.5: Apply the selected typography, tokens and icon semantics'
type: 'feature'
created: '2026-10-28'
status: 'in-progress'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '744d854a6bcba3bf1df7c1f4acf3ca73369bd8b5'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The renderer is a static placeholder. It has no DESIGN tokens, no self-hosted IBM Plex and no icon primitive, so Stories 1.6–1.8 have nothing consistent to build on.

**Approach:** Introduce the React renderer, built with Vite into `dist/renderer/` and served by `inquello://app/`. It gets three things:
- a token module and stylesheet whose every value equals DESIGN.md
- the five IBM Plex WOFF2 files with `font-display: swap`
- an accessible `Icon` for the 40 Lucide icons

**Owner decisions (2026-10-28):**
- Install exact pins react 19.3.1, react-dom 19.3.1, @types/react 19.3.0, @types/react-dom 19.3.0, and yaml 2.9.1 (dev-only, for the conformance test).
- Download the official licence texts: IBM Plex `OFL.txt` from github.com/IBM/plex and Lucide `LICENSE` from github.com/lucide-icons/lucide at tag 0.460.0, the version the icons were copied from.

## Boundaries & Constraints

**Always:**
- **Token values:** every DESIGN.md value, unchanged:
  - all colours, including the aliases `text-faint` and `status-accepted-fg` at their source values
  - typography, radii (`pill` is the literal `999px`) and spacing
  - the six shadows and the motion values (120/200/600ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`, the 800ms linear spinner and the 1→0.3 opacity pulse)
- **Fonts:** copied, not re-encoded, from the design-system import. The three Sans files are one variable font: keep all three as supplied, with one `@font-face` per declared weight. Fallback stacks exactly as DESIGN.md states.
- **Icon:** with no label, `aria-hidden="true"` and no role. With a label, `role="img"` and an `aria-label`. Defaults: size 16, stroke 1.75, `currentColor`, 24×24 viewBox. Rendered with React elements, not `dangerouslySetInnerHTML`.
- **CSP:** widen only to `'self'` for script, style, font and img sources.

**Never:**
- No new token values and no dark theme.
- No primitives beyond `Icon` (Button and the rest are Story 1.6).
- No change to the Story 1.3 bridge, sender checks or request policy, apart from the CSP and the served root.
- No remote fonts and no CDN.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Decorative icon | `<Icon name="search" />` | `aria-hidden="true"`, no role, no label | N/A |
| Informative icon | `<Icon name="triangle-alert" label="Needs evidence" />` | `role="img"`, `aria-label="Needs evidence"` | N/A |
| Unknown name | A name outside the 40 | Type error at compile time | At runtime: renders nothing and warns once |
| Token drift | A token value differs from DESIGN.md | Conformance test fails, naming the key | N/A |
| Font load | Renderer loads | `document.fonts.check` true for Sans 400/500/600 and Mono 400/500 | Probe failure fails the smoke |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md` -- canonical values:
  - frontmatter `colors` (around line 19), `typography` (115), `rounded` (159), `spacing` (168), `components.Icon` (196)
  - shadow table around line 489, and motion values in the paragraph after it
- `…/imports/inquello-design-system/` -- `tokens/*.css` holds the source CSS variable names and composites, including `--type-*`. `assets/fonts/*.woff2` and `components/core/icon-paths.js` hold the 40 icons as inner SVG markup from lucide-static 0.460.0. `components/core/Icon.jsx` is the reference only; replace its innerHTML approach.
- `desktop/src/main/security/policy.ts` -- `CONTENT_SECURITY_POLICY`. `desktop/static/index.html` mirrors it, and a Story 1.3 test checks that the two match.
- `desktop/src/main/main.ts` -- calls `handleAppProtocol(protocol, path.join(app.getAppPath(), 'static'), …)`. The root becomes the Vite output.
- `desktop/src/main/smoke-probe.ts` -- `RENDERER_PROBE` and `evaluatePrivileges`. Extend both.
- `desktop/tsconfig.json`, `tsconfig.build.json` and `vitest.config.ts` -- the main process emits CommonJS. The renderer needs its own TSX config and Vite config. Vite 8.3.5 is already pinned.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/package.json` and the lockfile -- add the approved pins. `build` runs both the main tsc build and `vite build`.
- [x] `desktop/vite.config.ts` and `desktop/tsconfig.renderer.json` -- root `src/renderer`, output to `dist/renderer`, no modulepreload polyfill, and assets under `dist/renderer/assets`.
- [x] `desktop/src/renderer/design/` -- `tokens.ts` (typed `as const` maps), `tokens.css` (the source variable names), `fonts.css`, `base.css`, and the fonts and licence files under `assets/`.
- [x] `desktop/src/renderer/icons/` -- `icon-paths.ts`: the 40 icons as element data, with an `IconName` union. `Icon.tsx` follows the matrix.
- [x] `desktop/src/renderer/index.html`, `main.tsx` -- a minimal specimen page for the smoke probe: title text and one decorative and one informative icon. It also renders a hidden span in each of the five weights, so all five fonts load.
- [x] `desktop/src/main/main.ts`, `security/policy.ts`, `static/` -- serve `dist/renderer`, widen the CSP and remove `static/`. Update the Story 1.3 CSP-mirror test to read the renderer's `index.html`.
- [x] `desktop/src/main/smoke-probe.ts` -- add font checks and icon accessibility attributes to the report and to the pass/fail rule.
- [x] `desktop/test/design.test.ts` -- covers:
  - DESIGN.md conformance: parse the frontmatter with yaml and compare every key both ways
  - the shadow and motion table values
  - every `tokens.css` variable matches `tokens.ts`
  - each font file hash equals the import's
  - every icon matches its source SVG path data
  - Icon matrix rows via `react-dom/server`
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-5.

**Acceptance Criteria:**
- Given `pnpm smoke`, when the renderer loads, then `renderer-privileges` still passes. A `design` report shows all five fonts loaded, the decorative icon `aria-hidden`, and the informative icon labelled, and the run exits 0.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

- [x] [Review][Patch] R13: Production build omits the renderer type check [desktop/package.json:16] — BMAD low; likelihood Low; impact Low; change risk Low — recommendation: Optional small cleanup.
  - Fixed in remediation (2026-10-29): `pnpm run build` now runs `tsc -p tsconfig.renderer.json --noEmit`; a temporary renderer type error made the build fail (exit 2), then was removed.

#### Rejected

No formal findings rejected for this story in this pass. Exploratory limits and inherited deferrals are documented in the full report.

## Implementation Notes

- **Cloud machine (Linux, root):** do not commit machine paths.
  - **Install:** `electron_config_cache=/home/user/.cache/inquello/electron-cache pnpm add -D --save-exact <pkg> --store-dir /home/user/.cache/inquello/pnpm-store --config.cache-dir=/home/user/.cache/inquello/pnpm-cache`. Use the same flags with `pnpm install --frozen-lockfile`.
  - **Smoke:** build as root with `pnpm run build`, then `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Never pass `--no-sandbox`. Make sure the `smoke` user can read `dist/`.
  - **Licence texts:** fetch the two approved files with `curl -fsSL` from `raw.githubusercontent.com`.
  - **Baseline:** 153 desktop tests pass and the smoke exits 0. The engine is built.
- **IBM Plex licence source:** `IBM/plex` has no `OFL.txt`, so the text came from its `master/LICENSE.txt`. That file is the IBM copyright line followed by the full OFL 1.1.
- **Licences ship in the build:** both texts live in `src/renderer/public/licenses/`. Vite's `publicDir` copies them into `dist/renderer/licenses/`, because the OFL requires the licence to travel with the fonts.
- **Sans font in the build:** the three Sans source files are identical (one variable font), so Vite emits one file. All three `@font-face` weights point to it.
- **Token scope:** `tokens.css` omits the import's `--focus-ring` and its raw type-scale variables, because they are not DESIGN.md values. The placeholder colour uses `text-muted`, as DESIGN.md says, not the import's `text-faint`.
- **Vite config warning:** `vite build` warns that `vite.config.ts` is ESM loaded as CommonJS. It is harmless.
- **Results (2026-10-28):** both type checks are clean; 228 tests pass (75 new); the smoke reports `renderer-privileges` ok and `design` ok, and exits 0. Step-04 review was skipped by owner rule.

## Verification

**Commands (in `desktop/`):**
- `pnpm install --frozen-lockfile` (with the cloud cache flags) -- expected: success
- `pnpm exec tsc --noEmit` and `pnpm exec tsc -p tsconfig.renderer.json --noEmit` -- expected: no errors
- `pnpm test` -- expected: all pass
- `pnpm run build`, then the smoke as the `smoke` user under `xvfb-run` -- expected: exit 0, with `design.ok: true`
