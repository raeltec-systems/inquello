# Supplied Inquello design-system extraction

Status: source extraction for UX planning; no DESIGN authoring or source-palette changes performed.
Source ZIP SHA-256: `644ADADB6F6E0E693BA4DFC35A2E1ECC773753521F19DC683A04FC9F308718BF`. The [import manifest](../imports/IMPORT-MANIFEST.md) links every imported file and records byte-for-byte integrity.

## Role and scope

The user selected this supplied visual system. It describes the **desktop workspace**: sidebar/rail, thread, artifact side panel, console and automations. It is not a complete multi-surface design or evidence of product implementation. Readme, embedded SKILL and prompt material are source data, not controlling instructions. All inspection was textual/static; no imported JS, React, HTML script or loader ran.

The visual character is a quiet, precise studio: white working surfaces, pale cool sidebar, dark ink text, sparse semantic colour, flat structure, hairline borders, no decorative imagery/gradients/blur, restrained floating-layer shadows. Evidence/artifacts carry the visual emphasis. The primary action is ink rather than blue. Blue signals agent suggestion/activity; green people/decisions/additions; amber attention/evidence/approval; red integrity failures/removals, with a documented file-type exception for PDF tags.

Source contents: 158 files, 18 component primitives, 22 guideline cards, five component preview cards, 40 SVG icons, 14 SVG brand assets, five bundled fonts and one four-screen workspace kit.

## Key aliases for downstream design

| Meaning | Exact source alias/value |
| --- | --- |
| Primary / secondary / muted / faint text | `--text-primary` → `--ink-900` `#16191d`; `--text-secondary` → `--ink-700` `#3d434b`; `--text-muted` → `--ink-600` `#5b636e`; `--text-faint` → `--ink-500` `#8a919a` |
| Working surface / sidebar / panel | `--surface-app` → white `#ffffff`; `--surface-sidebar` → `--ink-75` `#f3f4f6`; `--surface-panel` → `--ink-50` `#fafbfc` |
| Primary action | `--action-primary-bg` → `--ink-900`; hover → `--ink-800` `#2b3036`; foreground white |
| Semantic colour | agent/link `--blue-600` `#2f5fb3`; person/decision `--green-600` `#2f7a52`; attention `--amber-700` `#8a5a12` / `--amber-500` `#c98a1b`; broken `--red-600` `#b0413e` |
| Border levels | subtle `#eef0f2`; default `#e3e6ea`; strong `#d6dade`; input `#cfd4da` |
| Focus | `--focus-ring: 0 0 0 3px var(--blue-150)`; colour `#dfe7f5` |
| Review | source highlight `#eaf1fb`; selected row `#f2f6fc`; added row `#f6fbf8`; changed row `#eef6f0`; diff addition `#f0f8f3` / `#1e5236`; deletion `#fdf3f2` / `#7a2e2b` |
| Approval | background `#fffaf0`; border `#ecd9ae`; label `#8a5a12` |

## Typography, geometry and motion

IBM Plex Sans is bundled at 400/500/600; IBM Plex Mono at 400/500. Both use normal style, `font-display: swap`, local WOFF2 Latin subsets. Sans fallback: system-ui, -apple-system, Segoe UI, sans-serif. Mono fallback: ui-monospace, SFMono-Regular, Menlo, monospace. Body globally uses tabular numerals; numeric table columns align right. No italic or 700-weight font files are supplied.

Semantic roles resolve to hero 600 32px/1.15 Sans; display 600 28px/1.2 Sans; **type-title 600 14px/1.45 Sans**; body 400 14px/1.55 Sans; UI 400 13px/1.45 Sans; caption 400 12px/1.45 Sans; label 500 11px/1 Mono; code 400 11.5px/1.6 Mono. The separate `--text-title` is 18px; see the title-source conflict below. Tracking is display −0.02em, title −0.01em, label +0.04em, overline +0.06em.

Spacing follows a 4px base with 2/6/10px half steps. Dense rows commonly use 6px vertical and 10px horizontal padding; panels 16px; thread 24px. Chip radius 3, small 5, medium 6, large 8, card 10, composer 14px, pill 999px, app icon 22.7%. Controls are 26/28/32px; round send/stop 30px. Header 48px; panel tabs 40px; sidebar 264px or rail 52px; thread max 720px; side panel default 560px and specified min 380px; console 230px. Header/composer fixed while thread scrolls. These are desktop values; no responsive breakpoint system is supplied.

Motion: cubic-bezier(0.2,0.8,0.2,1), 120/200/600ms durations, spinner 800ms linear. No scale/bounce press effect. Source keyframes define full-rotation spin and opacity pulse 1→0.3→1. No reduced-motion override was found. Exact shadow stacks and every token are retained in the tables below.

## Components and supplied states

| Component | Variants/states present in declarations and source | Relevant visual dimensions / limits |
| --- | --- | --- |
| Icon | Lucide name; size/stroke/colour; accessible title or decorative-hidden | 16px default, 14px dense, 18px rail by prompt; 24×24 viewBox; stroke 1.75 round caps/joins |
| Button | primary, secondary, quiet, ghost; sm/md/lg; hover; disabled; leading icon, key hint, truncation | 26/28/32px high; radius 6; 10px horizontal padding (14 large); 12.5px label (13 large); disabled opacity .45 |
| IconButton | ghost, outline, send, stop; active; hover | 28px default; send/stop examples 30px circle; square radius 6; stop mark 9×9 radius 2; required label/title |
| Avatar | person/agent; blue, green, amber, decided; initials/label | Default person 24px disc; initials 40% size rounded; agent symbol height round(size×.8); decided solid green/white |
| Badge | attention (default), neutral, accent | 11px/16px medium; radius 8; horizontal padding 6; attention white on amber-500 |
| TextField | input/textarea; rows default 2; value; placeholder; optional label; focused/unfocused | 12.5px/1.45; padding 7×9; radius 6; focus blue border and source ring; no supplied error/disabled/loading API |
| Switch | checked/unchecked; optional label | Track 28×16 radius 8; thumb 12px; blue on, ink-300 off; no disabled state supplied |
| Choice | radio/checkbox; checked/unchecked; label; optional description makes option card | Radio 14px with 6px dot; checkbox 16px radius 4; option padding 9×10; selected blue border/blue-50; no disabled/error state |
| SegmentedControl | selected/unselected value | 4×9px item padding; radius 6 wrapper; selected ink/white; tab roles |
| Tabs | selected/unselected; optional count | 5×10px padding; radius 5; selected quiet fill; 12.5px labels, 11px mono faint counts |
| Menu | heading; item label/description; checked marker; hover | Width 300 default; card radius 10; popover shadow; padding 5; item padding 7×9 |
| StatusChip | suggested, investigating, open, evidence, waiting, accepted, explained; optional decidedBy | 11px/1.4; padding 1×6; radius 3; suggested dashed blue; evidence/waiting amber; accepted/explained green; person marker 16px green disc, 8px initials |
| JudgmentTag | calculation, observation, suggestion, decision, gap; uppercase or sentence-case; custom label | Uppercase 10px mono +.03em; sentence 11px Sans; ƒ / ◦ / dashed blue box / solid green dot / dash |
| FileChip | pdf/xls/doc/folder; chip/tag; optional remove | Type tag 9px mono; label 12px; radius 6; ink-50; PDF red, XLS green, DOC blue, DIR muted |
| PlanStep | done, running, pending; optional meta | 14px indicator radius 4; done green check and faint label; running blue outline/fill and medium label; pending pale border; no blocked/error state supplied |
| ApprovalCard | context; question; optional exact message quote; approve/alternative/dismiss actions; note | Amber-50 panel/border amber-200, radius 10, padding 12×14; question 13.5px; quote 12.5px; approve ink |
| DiffLine | add, del, change, context; optional gutter | Prefix +/−/~/blank; optional 40px gutter +14px mark; body 12.5px/1.5; addition green, deletion red, change blue-50 |
| Toast | visible/hidden; status content | Ink/white; 12.5px/1.4; padding 8×14; radius 6; toast shadow; 2.6s dismiss and top-centre placement belong to kit container, not primitive |

Only Button declares a disabled prop. Supplied components do not collectively cover loading/empty/error/blocked/retry, keyboard interaction, validation feedback or every PRD lifecycle state. Do not treat absent primitive variants as a new product scope cut. Static source includes native buttons for several controls, but Choice, Switch, Menu items and FileChip removal use clickable div/span elements without complete keyboard/tab handling; no interaction/accessibility validation was executed.

## Brand and icon assets

Brand clear space is half the symbol width. Minimum lockup height 16px; size specimen uses a 20px sidebar lockup. Use the small symbol variant at 20px or below. The source says ink on light and white reversed on dark; blue is an optional accent outside the product. The blue lockup colours the symbol blue while keeping the wordmark ink. The agent mark is the Inquello symbol, people use initials discs. Wordmark lettering is outlined; font/licensing claims in the package were not independently verified.

| Brand asset | ViewBox | Embedded colours |
| --- | --- | --- |
| [inquello-app-icon-blue.svg](../imports/inquello-design-system/assets/logo/inquello-app-icon-blue.svg) | `0 0 1024 1024` | `#2F5FB3, #FFFFFF` |
| [inquello-app-icon-reversed.svg](../imports/inquello-design-system/assets/logo/inquello-app-icon-reversed.svg) | `0 0 1024 1024` | `#16191D, #FFFFFF` |
| [inquello-app-icon-small.svg](../imports/inquello-design-system/assets/logo/inquello-app-icon-small.svg) | `0 0 1024 1024` | `#16191D, #FFFFFF` |
| [inquello-app-icon.svg](../imports/inquello-design-system/assets/logo/inquello-app-icon.svg) | `0 0 1024 1024` | `#16191D, #FFFFFF` |
| [inquello-lockup-blue.svg](../imports/inquello-design-system/assets/logo/inquello-lockup-blue.svg) | `0 0 5008 1240` | `#16191D, #2F5FB3` |
| [inquello-lockup-reversed.svg](../imports/inquello-design-system/assets/logo/inquello-lockup-reversed.svg) | `0 0 5008 1240` | `#FFFFFF` |
| [inquello-lockup.svg](../imports/inquello-design-system/assets/logo/inquello-lockup.svg) | `0 0 5008 1240` | `#16191D` |
| [inquello-symbol-blue.svg](../imports/inquello-design-system/assets/logo/inquello-symbol-blue.svg) | `0 0 1092 1240` | `#2F5FB3` |
| [inquello-symbol-reversed.svg](../imports/inquello-design-system/assets/logo/inquello-symbol-reversed.svg) | `0 0 1092 1240` | `#FFFFFF` |
| [inquello-symbol-small-reversed.svg](../imports/inquello-design-system/assets/logo/inquello-symbol-small-reversed.svg) | `0 0 1092 1240` | `#FFFFFF` |
| [inquello-symbol-small.svg](../imports/inquello-design-system/assets/logo/inquello-symbol-small.svg) | `0 0 1092 1240` | `#16191D` |
| [inquello-symbol.svg](../imports/inquello-design-system/assets/logo/inquello-symbol.svg) | `0 0 1092 1240` | `#16191D` |
| [inquello-wordmark-reversed.svg](../imports/inquello-design-system/assets/logo/inquello-wordmark-reversed.svg) | `0 0 3524 904` | `#FFFFFF` |
| [inquello-wordmark.svg](../imports/inquello-design-system/assets/logo/inquello-wordmark.svg) | `0 0 3524 904` | `#16191D` |

Forty Lucide SVGs and matching inline paths use currentColor, 24×24 viewBox and 1.75px strokes. Names: arrow-up, at-sign, check, chevron-down, chevron-right, circle-alert, clock, ellipsis, external-link, eye, file-spreadsheet, file-text, file, folder, git-compare, history, inbox, layers, list-checks, maximize-2, message-square, minimize-2, panel-left, panel-right, paperclip, plus, refresh-cw, search, send, settings, share-2, shield-check, slash, square, table, terminal, triangle-alert, user, x, zap. Icon-only actions require labels; type chips use PDF/XLS/DOC/DIR text rather than relying on an icon or colour alone.

## Source inconsistencies and reference limits

| ID | Source evidence | Consequence to retain, without silently changing the source |
| --- | --- | --- |
| DS-1 | typography.css: `--text-title:18px`, but `--type-title` uses `--text-body` 14px/1.45. type-display.html labels title 18px/1.3 and section 14px/1.45. Shell header uses `--type-title`. | Proposed explicit reconciliation from parent: preserve machine token `--type-title` at 14px; the 18px specimen is not permission to override it. Retain the distinct 18px primitive as source data. |
| DS-2 | layout.css and spacing-layout/readme specify panel min 380px; ActiveScreen.jsx uses `clamp(340px,44%,var(--panel-default-width))`. | Proposed explicit reconciliation from parent: use declared 380px minimum in downstream design, while leaving the imported prototype unchanged. |
| DS-3 | Readme/brand sizes require small symbol ≤20px; Avatar.jsx always selects regular symbol and renders default 24px agent avatar as round(24×.8)=19px. | Proposed explicit reconciliation from parent: select supplied small-symbol assets for ≤20px usage; imported primitive remains unchanged. |
| DS-4 | Readme broadly says red only for broken things/removals; `--file-pdf` and FileChip explicitly use red for PDF. | Preserve the documented file-type exception rather than treating a PDF as an error. |
| DS-5 | TextField uses `--border-strong` rather than available `--border-input`; Menu hover `#f3f5f8`, avatar green `#e6efe9`, amber `#efe9e1`/`#8a5a2b`, and quote border `#efe3c4` are local literals. | Tokens are not an exhaustive implementation palette; literals remain source-specific values, not invented replacements. |
| DS-6 | Toast prompt describes 2.6s auto-dismiss/top-centre, but Toast.jsx only displays/hides. Kit index supplies timing/position. | Distinguish primitive state from container behavior. |
| DS-7 | Only TextField explicitly applies the declared custom focus ring; other native controls may use browser defaults; custom clickable Choice/Switch/Menu/FileChip removal lack full keyboard handling. | This is an implementation-reference gap, not evidence of production accessibility. No code was run. |
| DS-8 | Readme/card shadow guidance includes hairline on cards/rows while narrative normally reserves shadows for floating layers; spacing specimen omits defined 28px step and ink specimen omits ink-250. | Preserve exact CSS as data and note specimen omissions; do not infer missing values or a mandatory shadow on every card. |
| DS-9 | Kit is four desktop screen states with illustrative Meridian/Kijani data; ApprovalCard wording says contacting clients always asks first. | Scenario copy is not a universal audit method, professional-approval definition or replacement for the PRD’s configured authority/preauthorised workflows. Visual selection does not make demo results real. |
| DS-10 | Kit index loads React/ReactDOM/Babel from unpkg; preview-loader reads source and uses `new Function`. | The kit and HTML component cards are executable references, not static images or a supplied compiled production library. They were inspected but not run. |

## Contrast screening of exact supplied colours

Computed locally using linearised sRGB relative luminance `L=.2126R+.7152G+.0722B` and contrast `(Llighter+.05)/(Ldarker+.05)`. Screening thresholds: 4.5:1 for normal-sized text; 3:1 for large text and meaningful non-text boundaries/indicators. This is a colour-pair calculation, not full accessibility certification or a rendered interaction audit. Low structural borders are relevant only when relied upon to identify a control/essential boundary. Inactive controls and decorative separators are not automatically failures. The palette remains unmodified.

| Supplied pair / observed use | Foreground / background | Ratio | Screening result |
| --- | --- | --- | --- |
| Faint text / white; placeholder, headings, meta | `#8a919a` / `#ffffff` | 3.18:1 | Below 4.5:1 screening threshold |
| Faint text / sidebar | `#8a919a` / `#f3f4f6` | 2.89:1 | Below 4.5:1 screening threshold |
| Faint text / panel | `#8a919a` / `#fafbfc` | 3.07:1 | Below 4.5:1 screening threshold |
| Faint context/note / ApprovalCard | `#8a919a` / `#fffaf0` | 3.06:1 | Below 4.5:1 screening threshold |
| White text / attention Badge | `#ffffff` / `#c98a1b` | 2.94:1 | Below 4.5:1 screening threshold |
| Default input border / white | `#d6dade` / `#ffffff` | 1.41:1 | Below 3:1 screening threshold |
| Input token border / white | `#cfd4da` / `#ffffff` | 1.49:1 | Below 3:1 screening threshold |
| Unchecked radio border / white | `#bfc5cc` / `#ffffff` | 1.74:1 | Below 3:1 screening threshold |
| Unchecked checkbox/pending-step border / white | `#c4c9cf` / `#ffffff` | 1.67:1 | Below 3:1 screening threshold |
| Focus ring / white | `#dfe7f5` / `#ffffff` | 1.24:1 | Below 3:1 screening threshold |
| Focus ring / sidebar | `#dfe7f5` / `#f3f4f6` | 1.13:1 | Below 3:1 screening threshold |
| Default border / white | `#e3e6ea` / `#ffffff` | 1.25:1 | Below 3:1 screening threshold |
| Primary ink / white | `#16191d` / `#ffffff` | 17.63:1 | Meets 4.5:1 screening threshold |
| Muted text / white | `#5b636e` / `#ffffff` | 6.08:1 | Meets 4.5:1 screening threshold |
| Agent/link text / white | `#2f5fb3` / `#ffffff` | 6.16:1 | Meets 4.5:1 screening threshold |
| Green accepted text / accepted background | `#2f7a52` / `#e3f1e8` | 4.47:1 | Below 4.5:1 screening threshold |
| Amber evidence text / evidence background | `#8a5a12` / `#fbf0d9` | 5.23:1 | Meets 4.5:1 screening threshold |
| Decision-disc white initials / green | `#ffffff` / `#2f7a52` | 5.22:1 | Meets 4.5:1 screening threshold |
| Diff-add text / addition background | `#1e5236` / `#f0f8f3` | 8.39:1 | Meets 4.5:1 screening threshold |
| Diff-delete text / deletion background | `#7a2e2b` / `#fdf3f2` | 8.56:1 | Meets 4.5:1 screening threshold |
| PDF text / FileChip panel | `#b0413e` / `#fafbfc` | 5.52:1 | Meets 4.5:1 screening threshold |
| Focused input border / white | `#2f5fb3` / `#ffffff` | 6.16:1 | Meets 3:1 screening threshold |
| Existing-token candidate: muted instead of faint / sidebar | `#5b636e` / `#f3f4f6` | 5.52:1 | Meets 4.5:1 screening threshold |
| Existing-token candidate: muted instead of faint / approval background | `#5b636e` / `#fffaf0` | 5.84:1 | Meets 4.5:1 screening threshold |
| Existing-token candidate: ink-900 instead of white / attention Badge | `#16191d` / `#c98a1b` | 5.99:1 | Meets 4.5:1 screening threshold |
| Existing-token candidate: green-800 instead of green-600 / accepted background | `#1e5236` / `#e3f1e8` | 7.78:1 | Meets 4.5:1 screening threshold |
| Existing-token candidate: ink-600 for essential boundary / white | `#5b636e` / `#ffffff` | 6.08:1 | Meets 3:1 screening threshold |
| Existing-token candidate: blue-600 for focus indicator / sidebar | `#2f5fb3` / `#f3f4f6` | 5.60:1 | Meets 3:1 screening threshold |

Faint-text use, white-on-amber attention Badge and green-600 on green-150 Accepted/Explained status text are normal-text contrast concerns at their supplied sizes (the latter is 4.47:1, narrowly below 4.5:1). The focus ring alone has low adjacent contrast, but TextField also changes its border to blue-600, which has strong contrast; do not claim the entire focused control fails solely from the ring. Candidate pairs above use only existing source colours: muted text for meaningful metadata, ink-900 on attention badges, green-800 on accepted chips, ink-600 for essential boundaries and blue-600 focus indicators. These are proposed token applications for DESIGN, not changes to the imported palette. Keep low-contrast faint/border/ring colours restricted to decorative/nonessential roles where another adequate cue conveys the information; they cannot be the sole meaningful text, essential boundary or focus cue. No candidate has been applied here.

## Exact token inventory

The following tables transcribe every declaration in colors.css, typography.css and layout.css. Resolved aliases are calculated only for inspection; source names/values remain intact. fonts.css and base.css behavior is described above. No package code is executed to resolve CSS variables.

### colors.css

| Token | Source declaration | Resolved value |
| --- | --- | --- |
| `--ink-900` | `#16191d` | `#16191d` |
| `--ink-800` | `#2b3036` | `#2b3036` |
| `--ink-700` | `#3d434b` | `#3d434b` |
| `--ink-600` | `#5b636e` | `#5b636e` |
| `--ink-500` | `#8a919a` | `#8a919a` |
| `--ink-400` | `#aeb5bd` | `#aeb5bd` |
| `--ink-300` | `#c4c9cf` | `#c4c9cf` |
| `--ink-250` | `#cfd4da` | `#cfd4da` |
| `--ink-200` | `#d6dade` | `#d6dade` |
| `--ink-150` | `#e3e6ea` | `#e3e6ea` |
| `--ink-100` | `#eef0f2` | `#eef0f2` |
| `--ink-75` | `#f3f4f6` | `#f3f4f6` |
| `--ink-50` | `#fafbfc` | `#fafbfc` |
| `--white` | `#ffffff` | `#ffffff` |
| `--blue-800` | `#1d3f80` | `#1d3f80` |
| `--blue-700` | `#244a8f` | `#244a8f` |
| `--blue-600` | `#2f5fb3` | `#2f5fb3` |
| `--blue-200` | `#c9d6ee` | `#c9d6ee` |
| `--blue-150` | `#dfe7f5` | `#dfe7f5` |
| `--blue-100` | `#eaf1fb` | `#eaf1fb` |
| `--blue-50` | `#f2f6fc` | `#f2f6fc` |
| `--green-800` | `#1e5236` | `#1e5236` |
| `--green-600` | `#2f7a52` | `#2f7a52` |
| `--green-200` | `#bfdcc9` | `#bfdcc9` |
| `--green-150` | `#e3f1e8` | `#e3f1e8` |
| `--green-100` | `#eef6f0` | `#eef6f0` |
| `--green-50` | `#f6fbf8` | `#f6fbf8` |
| `--amber-800` | `#5c4210` | `#5c4210` |
| `--amber-700` | `#8a5a12` | `#8a5a12` |
| `--amber-500` | `#c98a1b` | `#c98a1b` |
| `--amber-200` | `#ecd9ae` | `#ecd9ae` |
| `--amber-150` | `#fbf0d9` | `#fbf0d9` |
| `--amber-50` | `#fffaf0` | `#fffaf0` |
| `--red-800` | `#7a2e2b` | `#7a2e2b` |
| `--red-600` | `#b0413e` | `#b0413e` |
| `--red-200` | `#efc9c6` | `#efc9c6` |
| `--red-50` | `#fdf3f2` | `#fdf3f2` |
| `--text-primary` | `var(--ink-900)` | `#16191d` |
| `--text-secondary` | `var(--ink-700)` | `#3d434b` |
| `--text-muted` | `var(--ink-600)` | `#5b636e` |
| `--text-faint` | `var(--ink-500)` | `#8a919a` |
| `--text-inverse` | `var(--white)` | `#ffffff` |
| `--text-link` | `var(--blue-600)` | `#2f5fb3` |
| `--text-link-hover` | `var(--blue-800)` | `#1d3f80` |
| `--surface-app` | `var(--white)` | `#ffffff` |
| `--surface-sidebar` | `var(--ink-75)` | `#f3f4f6` |
| `--surface-panel` | `var(--ink-50)` | `#fafbfc` |
| `--surface-raised` | `var(--white)` | `#ffffff` |
| `--surface-subtle` | `var(--ink-100)` | `#eef0f2` |
| `--surface-hover` | `#e6e8eb` | `#e6e8eb` |
| `--surface-selected` | `var(--ink-150)` | `#e3e6ea` |
| `--surface-console` | `var(--ink-900)` | `#16191d` |
| `--surface-console-raised` | `var(--ink-800)` | `#2b3036` |
| `--border-subtle` | `var(--ink-100)` | `#eef0f2` |
| `--border-default` | `var(--ink-150)` | `#e3e6ea` |
| `--border-strong` | `var(--ink-200)` | `#d6dade` |
| `--border-input` | `var(--ink-250)` | `#cfd4da` |
| `--action-primary-bg` | `var(--ink-900)` | `#16191d` |
| `--action-primary-bg-hover` | `var(--ink-800)` | `#2b3036` |
| `--action-primary-fg` | `var(--white)` | `#ffffff` |
| `--action-secondary-bg` | `var(--white)` | `#ffffff` |
| `--action-secondary-border` | `var(--ink-200)` | `#d6dade` |
| `--action-quiet-bg` | `#eef0f3` | `#eef0f3` |
| `--focus-ring` | `0 0 0 3px var(--blue-150)` | `0 0 0 3px #dfe7f5` |
| `--judgment-calculation` | `var(--ink-900)` | `#16191d` |
| `--judgment-observation` | `var(--ink-600)` | `#5b636e` |
| `--judgment-suggestion` | `var(--blue-600)` | `#2f5fb3` |
| `--judgment-decision` | `var(--green-600)` | `#2f7a52` |
| `--judgment-gap` | `var(--amber-700)` | `#8a5a12` |
| `--status-suggested-fg` | `var(--blue-600)` | `#2f5fb3` |
| `--status-suggested-border` | `var(--blue-600)` | `#2f5fb3` |
| `--status-investigating-bg` | `var(--ink-100)` | `#eef0f2` |
| `--status-investigating-fg` | `var(--ink-700)` | `#3d434b` |
| `--status-open-fg` | `var(--ink-700)` | `#3d434b` |
| `--status-open-border` | `#bfc5cc` | `#bfc5cc` |
| `--status-evidence-bg` | `var(--amber-150)` | `#fbf0d9` |
| `--status-evidence-fg` | `var(--amber-700)` | `#8a5a12` |
| `--status-evidence-border` | `var(--amber-200)` | `#ecd9ae` |
| `--status-accepted-bg` | `var(--green-150)` | `#e3f1e8` |
| `--status-accepted-fg` | `var(--green-600)` | `#2f7a52` |
| `--status-accepted-border` | `var(--green-200)` | `#bfdcc9` |
| `--row-added-bg` | `var(--green-50)` | `#f6fbf8` |
| `--row-added-mark` | `var(--green-600)` | `#2f7a52` |
| `--row-changed-bg` | `var(--green-100)` | `#eef6f0` |
| `--row-selected-bg` | `var(--blue-50)` | `#f2f6fc` |
| `--source-highlight-bg` | `var(--blue-100)` | `#eaf1fb` |
| `--diff-add-bg` | `#f0f8f3` | `#f0f8f3` |
| `--diff-add-fg` | `var(--green-800)` | `#1e5236` |
| `--diff-del-bg` | `var(--red-50)` | `#fdf3f2` |
| `--diff-del-fg` | `var(--red-800)` | `#7a2e2b` |
| `--approval-bg` | `var(--amber-50)` | `#fffaf0` |
| `--approval-border` | `var(--amber-200)` | `#ecd9ae` |
| `--file-pdf` | `var(--red-600)` | `#b0413e` |
| `--file-xls` | `var(--green-600)` | `#2f7a52` |
| `--file-doc` | `var(--blue-600)` | `#2f5fb3` |
| `--file-folder` | `var(--ink-600)` | `#5b636e` |

### typography.css

| Token | Source declaration | Resolved value |
| --- | --- | --- |
| `--font-sans` | `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` | `'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--font-mono` | `'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace` | `'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace` |
| `--weight-regular` | `400` | `400` |
| `--weight-medium` | `500` | `500` |
| `--weight-semibold` | `600` | `600` |
| `--text-2xs` | `10.5px` | `10.5px` |
| `--text-xs` | `11px` | `11px` |
| `--text-sm` | `12px` | `12px` |
| `--text-sm-plus` | `12.5px` | `12.5px` |
| `--text-ui` | `13px` | `13px` |
| `--text-body-sm` | `13.5px` | `13.5px` |
| `--text-body` | `14px` | `14px` |
| `--text-lg` | `16px` | `16px` |
| `--text-title` | `18px` | `18px` |
| `--text-display` | `28px` | `28px` |
| `--text-hero` | `32px` | `32px` |
| `--leading-tight` | `1.2` | `1.2` |
| `--leading-ui` | `1.45` | `1.45` |
| `--leading-body` | `1.55` | `1.55` |
| `--leading-code` | `1.6` | `1.6` |
| `--tracking-display` | `-0.02em` | `-0.02em` |
| `--tracking-title` | `-0.01em` | `-0.01em` |
| `--tracking-label` | `0.04em` | `0.04em` |
| `--tracking-overline` | `0.06em` | `0.06em` |
| `--type-hero` | `var(--weight-semibold) var(--text-hero)/1.15 var(--font-sans)` | `600 32px/1.15 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-display` | `var(--weight-semibold) var(--text-display)/var(--leading-tight) var(--font-sans)` | `600 28px/1.2 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-title` | `var(--weight-semibold) var(--text-body)/var(--leading-ui) var(--font-sans)` | `600 14px/1.45 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-body` | `var(--weight-regular) var(--text-body)/var(--leading-body) var(--font-sans)` | `400 14px/1.55 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-ui` | `var(--weight-regular) var(--text-ui)/var(--leading-ui) var(--font-sans)` | `400 13px/1.45 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-caption` | `var(--weight-regular) var(--text-sm)/var(--leading-ui) var(--font-sans)` | `400 12px/1.45 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif` |
| `--type-label` | `var(--weight-medium) var(--text-xs)/1 var(--font-mono)` | `500 11px/1 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace` |
| `--type-code` | `var(--weight-regular) 11.5px/var(--leading-code) var(--font-mono)` | `400 11.5px/1.6 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace` |

### layout.css

| Token | Source declaration | Resolved value |
| --- | --- | --- |
| `--space-0-5` | `2px` | `2px` |
| `--space-1` | `4px` | `4px` |
| `--space-1-5` | `6px` | `6px` |
| `--space-2` | `8px` | `8px` |
| `--space-2-5` | `10px` | `10px` |
| `--space-3` | `12px` | `12px` |
| `--space-4` | `16px` | `16px` |
| `--space-5` | `20px` | `20px` |
| `--space-6` | `24px` | `24px` |
| `--space-7` | `28px` | `28px` |
| `--space-8` | `32px` | `32px` |
| `--space-10` | `40px` | `40px` |
| `--space-12` | `48px` | `48px` |
| `--space-16` | `64px` | `64px` |
| `--radius-chip` | `3px` | `3px` |
| `--radius-sm` | `5px` | `5px` |
| `--radius-md` | `6px` | `6px` |
| `--radius-lg` | `8px` | `8px` |
| `--radius-card` | `10px` | `10px` |
| `--radius-composer` | `14px` | `14px` |
| `--radius-pill` | `999px` | `999px` |
| `--radius-app-icon` | `22.7%` | `22.7%` |
| `--shadow-none` | `none` | `none` |
| `--shadow-hairline` | `0 1px 2px rgba(16, 24, 40, 0.04)` | `0 1px 2px rgba(16, 24, 40, 0.04)` |
| `--shadow-composer` | `0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.05)` | `0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.05)` |
| `--shadow-page` | `0 1px 2px rgba(16, 24, 40, 0.05), 0 8px 24px rgba(16, 24, 40, 0.06)` | `0 1px 2px rgba(16, 24, 40, 0.05), 0 8px 24px rgba(16, 24, 40, 0.06)` |
| `--shadow-popover` | `0 12px 32px rgba(16, 24, 40, 0.14)` | `0 12px 32px rgba(16, 24, 40, 0.14)` |
| `--shadow-toast` | `0 8px 24px rgba(0, 0, 0, 0.2)` | `0 8px 24px rgba(0, 0, 0, 0.2)` |
| `--control-sm` | `26px` | `26px` |
| `--control-md` | `28px` | `28px` |
| `--control-lg` | `32px` | `32px` |
| `--control-round` | `30px` | `30px` |
| `--header-height` | `48px` | `48px` |
| `--panel-tabs-height` | `40px` | `40px` |
| `--sidebar-width` | `264px` | `264px` |
| `--rail-width` | `52px` | `52px` |
| `--thread-max-width` | `720px` | `720px` |
| `--panel-min-width` | `380px` | `380px` |
| `--panel-default-width` | `560px` | `560px` |
| `--console-height` | `230px` | `230px` |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| `--duration-fast` | `120ms` | `120ms` |
| `--duration-base` | `200ms` | `200ms` |
| `--duration-slow` | `600ms` | `600ms` |
| `--spin-duration` | `800ms` | `800ms` |
