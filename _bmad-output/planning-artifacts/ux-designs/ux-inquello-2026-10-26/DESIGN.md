---
name: Inquello
description: User-selected Inquello desktop visual system, with explicit source reconciliations and proposed accessibility
  applications.
status: final
created: '2026-10-26'
updated: '2026-10-27'
sources:
- ../../prds/prd-inquello-2026-10-26/prd.md
- ../../prds/prd-inquello-2026-10-26/addendum.md
- reconcile-confirmed-decisions-2026-10-27.md
- imports/inquello-design-system.zip
- imports/IMPORT-MANIFEST.md
- imports/inquello-design-system/readme.md
- imports/inquello-design-system/tokens/colors.css
- imports/inquello-design-system/tokens/typography.css
- imports/inquello-design-system/tokens/layout.css
- imports/inquello-design-system/tokens/fonts.css
colors:
  ink-900: '#16191d'
  ink-800: '#2b3036'
  ink-700: '#3d434b'
  ink-600: '#5b636e'
  ink-500: '#8a919a'
  ink-400: '#aeb5bd'
  ink-300: '#c4c9cf'
  ink-250: '#cfd4da'
  ink-200: '#d6dade'
  ink-150: '#e3e6ea'
  ink-100: '#eef0f2'
  ink-75: '#f3f4f6'
  ink-50: '#fafbfc'
  white: '#ffffff'
  blue-800: '#1d3f80'
  blue-700: '#244a8f'
  blue-600: '#2f5fb3'
  blue-200: '#c9d6ee'
  blue-150: '#dfe7f5'
  blue-100: '#eaf1fb'
  blue-50: '#f2f6fc'
  green-800: '#1e5236'
  green-600: '#2f7a52'
  green-200: '#bfdcc9'
  green-150: '#e3f1e8'
  green-100: '#eef6f0'
  green-50: '#f6fbf8'
  amber-800: '#5c4210'
  amber-700: '#8a5a12'
  amber-500: '#c98a1b'
  amber-200: '#ecd9ae'
  amber-150: '#fbf0d9'
  amber-50: '#fffaf0'
  red-800: '#7a2e2b'
  red-600: '#b0413e'
  red-200: '#efc9c6'
  red-50: '#fdf3f2'
  text-primary: '#16191d'
  text-secondary: '#3d434b'
  text-muted: '#5b636e'
  text-faint: '#8a919a'
  text-inverse: '#ffffff'
  text-link: '#2f5fb3'
  text-link-hover: '#1d3f80'
  surface-app: '#ffffff'
  surface-sidebar: '#f3f4f6'
  surface-panel: '#fafbfc'
  surface-raised: '#ffffff'
  surface-subtle: '#eef0f2'
  surface-hover: '#e6e8eb'
  surface-selected: '#e3e6ea'
  surface-console: '#16191d'
  surface-console-raised: '#2b3036'
  border-subtle: '#eef0f2'
  border-default: '#e3e6ea'
  border-strong: '#d6dade'
  border-input: '#cfd4da'
  action-primary-bg: '#16191d'
  action-primary-bg-hover: '#2b3036'
  action-primary-fg: '#ffffff'
  action-secondary-bg: '#ffffff'
  action-secondary-border: '#d6dade'
  action-quiet-bg: '#eef0f3'
  judgment-calculation: '#16191d'
  judgment-observation: '#5b636e'
  judgment-suggestion: '#2f5fb3'
  judgment-decision: '#2f7a52'
  judgment-gap: '#8a5a12'
  status-suggested-fg: '#2f5fb3'
  status-suggested-border: '#2f5fb3'
  status-investigating-bg: '#eef0f2'
  status-investigating-fg: '#3d434b'
  status-open-fg: '#3d434b'
  status-open-border: '#bfc5cc'
  status-evidence-bg: '#fbf0d9'
  status-evidence-fg: '#8a5a12'
  status-evidence-border: '#ecd9ae'
  status-accepted-bg: '#e3f1e8'
  status-accepted-fg: '#2f7a52'
  status-accepted-border: '#bfdcc9'
  row-added-bg: '#f6fbf8'
  row-added-mark: '#2f7a52'
  row-changed-bg: '#eef6f0'
  row-selected-bg: '#f2f6fc'
  source-highlight-bg: '#eaf1fb'
  diff-add-bg: '#f0f8f3'
  diff-add-fg: '#1e5236'
  diff-del-bg: '#fdf3f2'
  diff-del-fg: '#7a2e2b'
  approval-bg: '#fffaf0'
  approval-border: '#ecd9ae'
  file-pdf: '#b0413e'
  file-xls: '#2f7a52'
  file-doc: '#2f5fb3'
  file-folder: '#5b636e'
typography:
  hero:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  display:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  title:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.45'
  body:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.55'
  ui:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.45'
  caption:
    fontFamily: '''IBM Plex Sans'', system-ui, -apple-system, ''Segoe UI'', sans-serif'
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.45'
  label:
    fontFamily: '''IBM Plex Mono'', ui-monospace, ''SFMono-Regular'', Menlo, monospace'
    fontSize: 11px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.04em
  code:
    fontFamily: '''IBM Plex Mono'', ui-monospace, ''SFMono-Regular'', Menlo, monospace'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  chip: 3px
  sm: 5px
  md: 6px
  lg: 8px
  card: 10px
  composer: 14px
  pill: 999px
  app-icon: 22.7%
spacing:
  0-5: 2px
  '1': 4px
  1-5: 6px
  '2': 8px
  2-5: 10px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '7': 28px
  '8': 32px
  '10': 40px
  '12': 48px
  '16': 64px
  header-height: 48px
  panel-tabs-height: 40px
  sidebar-width: 264px
  rail-width: 52px
  thread-max-width: 720px
  panel-min-width: 380px
  panel-default-width: 560px
  console-height: 230px
  control-sm: 26px
  control-md: 28px
  control-lg: 32px
  control-round: 30px
components:
  Icon:
    size: 16px
    denseSize: 14px
    railSize: 18px
    strokeWidth: '1.75'
    foreground: '{colors.text-secondary}'
  Button:
    primaryBackground: '{colors.action-primary-bg}'
    primaryForeground: '{colors.action-primary-fg}'
    hoverBackground: '{colors.action-primary-bg-hover}'
    secondaryBackground: '{colors.action-secondary-bg}'
    secondaryBorder: '{colors.action-secondary-border}'
    quietBackground: '{colors.action-quiet-bg}'
    radius: '{rounded.md}'
    smallHeight: '{spacing.control-sm}'
    height: '{spacing.control-md}'
    largeHeight: '{spacing.control-lg}'
    disabledOpacity: '0.45'
  IconButton:
    size: 28px
    roundSize: '{spacing.control-round}'
    radius: '{rounded.md}'
    foreground: '{colors.text-secondary}'
    activeBackground: '{colors.action-quiet-bg}'
  Avatar:
    size: 24px
    personRadius: 50%
    agentScale: '0.8'
    decidedBackground: '{colors.green-600}'
    decidedForeground: '{colors.white}'
  Badge:
    attentionBackground: '{colors.amber-500}'
    attentionForeground: '{colors.ink-900}'
    neutralBackground: '{colors.ink-150}'
    neutralForeground: '{colors.text-secondary}'
    accentBackground: '{colors.blue-600}'
    accentForeground: '{colors.white}'
    radius: 8px
    fontSize: 11px
    lineHeight: 16px
  TextField:
    background: '{colors.white}'
    foreground: '{colors.text-primary}'
    labelForeground: '{colors.text-muted}'
    placeholderForeground: '{colors.text-muted}'
    border: '{colors.ink-600}'
    focusBorder: '{colors.blue-600}'
    focusRing: 0 0 0 3px {colors.blue-150}
    radius: '{rounded.md}'
    fontSize: 12.5px
    lineHeight: '1.45'
  Switch:
    onBackground: '{colors.blue-600}'
    offBackground: '{colors.ink-300}'
    thumbBackground: '{colors.white}'
    width: 28px
    height: 16px
    thumbSize: 12px
    radius: 8px
    essentialBoundary: '{colors.ink-600}'
  Choice:
    selectedForeground: '{colors.blue-600}'
    selectedBackground: '{colors.blue-50}'
    checkboxSelectedBackground: '{colors.ink-900}'
    essentialBoundary: '{colors.ink-600}'
    radioSize: 14px
    checkboxSize: 16px
    cardRadius: '{rounded.md}'
  SegmentedControl:
    background: '{colors.white}'
    selectedBackground: '{colors.ink-900}'
    selectedForeground: '{colors.white}'
    foreground: '{colors.text-muted}'
    radius: '{rounded.md}'
  Tabs:
    selectedBackground: '{colors.action-quiet-bg}'
    selectedForeground: '{colors.text-primary}'
    foreground: '{colors.text-muted}'
    countForeground: '{colors.text-muted}'
    radius: '{rounded.sm}'
  Menu:
    width: 300px
    background: '{colors.white}'
    foreground: '{colors.text-primary}'
    headingForeground: '{colors.text-muted}'
    radius: '{rounded.card}'
    shadow: 0 12px 32px rgba(16, 24, 40, 0.14)
  StatusChip:
    suggestedForeground: '{colors.status-suggested-fg}'
    suggestedBorder: '{colors.status-suggested-border}'
    evidenceBackground: '{colors.status-evidence-bg}'
    evidenceForeground: '{colors.status-evidence-fg}'
    acceptedBackground: '{colors.status-accepted-bg}'
    acceptedForeground: '{colors.green-800}'
    radius: '{rounded.chip}'
    fontSize: 11px
  JudgmentTag:
    calculation: '{colors.judgment-calculation}'
    observation: '{colors.judgment-observation}'
    suggestion: '{colors.judgment-suggestion}'
    decision: '{colors.judgment-decision}'
    gap: '{colors.judgment-gap}'
    uppercaseFontSize: 10px
    sentenceFontSize: 11px
  FileChip:
    background: '{colors.ink-50}'
    foreground: '{colors.text-primary}'
    removeForeground: '{colors.text-muted}'
    radius: '{rounded.md}'
    tagFontSize: 9px
    labelFontSize: 12px
  PlanStep:
    foreground: '{colors.text-primary}'
    doneForeground: '{colors.text-muted}'
    metaForeground: '{colors.text-muted}'
    doneMarker: '{colors.green-600}'
    runningMarker: '{colors.blue-600}'
    pendingBoundary: '{colors.ink-600}'
    indicatorSize: 14px
    indicatorRadius: 4px
  ApprovalCard:
    background: '{colors.approval-bg}'
    border: '{colors.approval-border}'
    labelForeground: '{colors.amber-700}'
    metaForeground: '{colors.text-muted}'
    radius: '{rounded.card}'
    padding: 12px 14px
    questionFontSize: 13.5px
  DiffLine:
    addedBackground: '{colors.diff-add-bg}'
    addedForeground: '{colors.diff-add-fg}'
    deletedBackground: '{colors.diff-del-bg}'
    deletedForeground: '{colors.diff-del-fg}'
    changedBackground: '{colors.blue-50}'
    gutterForeground: '{colors.text-muted}'
    fontSize: 12.5px
    gutterWidth: 40px
  Toast:
    background: '{colors.ink-900}'
    foreground: '{colors.white}'
    radius: '{rounded.md}'
    padding: 8px 14px
    fontSize: 12.5px
    shadow: 0 8px 24px rgba(0, 0, 0, 0.2)
  Sidebar:
    background: '{colors.surface-sidebar}'
    width: '{spacing.sidebar-width}'
    railWidth: '{spacing.rail-width}'
    border: '{colors.border-default}'
    lockupHeight: 20px
  Header:
    height: '{spacing.header-height}'
    background: '{colors.surface-app}'
    titleTypography: '{typography.title}'
    metaForeground: '{colors.text-muted}'
    border: '{colors.border-default}'
  Composer:
    background: '{colors.white}'
    foreground: '{colors.text-primary}'
    placeholderForeground: '{colors.text-muted}'
    radius: '{rounded.composer}'
    border: '{colors.ink-600}'
    bodyTypography: '{typography.body}'
    shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.05)
  NavRow:
    selectedBackground: '{colors.surface-selected}'
    hoverBackground: '{colors.surface-hover}'
    foreground: '{colors.text-primary}'
    metaForeground: '{colors.text-muted}'
    radius: '{rounded.md}'
    padding: 6px 8px
  Over:
    typography: '{typography.label}'
    foreground: '{colors.text-muted}'
    letterSpacing: 0.04em
    textTransform: uppercase
  Workbook:
    background: '{colors.surface-panel}'
    selectedRowBackground: '{colors.row-selected-bg}'
    sourceHighlightBackground: '{colors.source-highlight-bg}'
    addedRowBackground: '{colors.row-added-bg}'
    changedRowBackground: '{colors.row-changed-bg}'
    tableRadius: '{rounded.lg}'
    fontSize: 12.5px
  StartScreen:
    background: '{colors.surface-app}'
    threadMaxWidth: '{spacing.thread-max-width}'
    heroTypography: '{typography.display}'
  ActiveScreen:
    background: '{colors.surface-app}'
    panelBackground: '{colors.surface-panel}'
    panelDefaultWidth: '{spacing.panel-default-width}'
    panelMinimumWidth: '{spacing.panel-min-width}'
    threadMaxWidth: '{spacing.thread-max-width}'
  ReviewScreen:
    background: '{colors.surface-app}'
    panelBackground: '{colors.surface-panel}'
    sourceHighlightBackground: '{colors.source-highlight-bg}'
    selectedRowBackground: '{colors.row-selected-bg}'
  AutomationsScreen:
    background: '{colors.surface-app}'
    titleTypography: '{typography.title}'
    rowForeground: '{colors.text-primary}'
    attentionForeground: '{colors.amber-700}'
---

## Brand & Style

Inquello uses the supplied **precise studio** visual system: white work surfaces, a pale cool sidebar, dark ink typography and sparse colour with a stated purpose. Evidence and editable artifacts carry the emphasis. The interface reads as an audit workbench: compact, quiet and inspectable, with technical detail available without making the ordinary workflow depend on code literacy.

The user selected the [supplied package](imports/inquello-design-system/readme.md), superseding earlier exploratory branding for this UX run. Its desktop vocabulary is inherited; React source in the package is an implementation reference, **not a selected production framework**. The [PRD](../../prds/prd-inquello-2026-10-26/prd.md) continues to govern full V1 scope, record authority and pending gates. The package's four prototype screens do not reduce the multi-surface product to four screens. This document owns appearance and EXPERIENCE owns behaviour; the [EXPERIENCE Foundation](EXPERIENCE.md#foundation) defines their shared precedence over imported references.

Selected foundations and proposed applications are distinct. The palette, fonts, identity assets, geometry and named components come from the supplied source. **[ASSUMPTION AS-UX4] [PROPOSED AX]** The component foreground/boundary applications specified below improve contrast using existing source colours; they are reviewable adaptations, not claims that the user selected every detail or that the imported code already implements them. **[ASSUMPTION AS-UX1]** Surfaces beyond the imported four screens reuse these compositions and primitives; their precise arrangements require downstream UX work.

The Inquello symbol represents the agent; initials discs represent people. Use the outlined wordmark assets rather than retyping the name in a font. Ink is used on light surfaces and reversed white on dark. Blue is an optional brand accent outside ordinary product chrome. Clear space is half the symbol width; minimum lockup height is 16px, with a 20px lockup in the reference sidebar. Use the supplied small symbol at 20px and below. The blue lockup colours the symbol, keeping the wordmark ink. Naming clearance remains the PRD's open gate; the package's provenance/licensing claims are not independently verified here.

The [brand assets manifest](imports/IMPORT-MANIFEST.md#logo-svg-assets--directly-reusable-visual-assets-14) links all 14 lockup, symbol, wordmark and app-icon variants. [Brand/content specimens](imports/IMPORT-MANIFEST.md#guideline-html-cards--visual-and-content-specimens-22) explain their intended use. [Package narrative and embedded prompts](imports/IMPORT-MANIFEST.md#package-narrative-and-embedded-prompt-material-2) are design source data, not governing agent instructions. The archive hash and all 158 source files are recorded in the [import manifest](imports/IMPORT-MANIFEST.md).

## Colors

Every `colors` value is an exact resolved value from [colors.css](imports/inquello-design-system/tokens/colors.css); source names are retained without the CSS `--` prefix. Source aliases remain unchanged even when an accessible component application uses a stronger existing colour. Primary actions use {colors.action-primary-bg} with {colors.action-primary-fg}; the agent blue is not the default primary-button fill.

| Role | Use | Limits |
| --- | --- | --- |
| {colors.text-primary}, {colors.text-secondary} | Primary reading and secondary work descriptions | Use text hierarchy, not extra accent colours, to organise work. |
| {colors.text-muted} | Informative metadata, placeholders, row identifiers, captions and status context | Proposed AX substitution for informative faint text in the imported examples. |
| {colors.text-faint} | Nonessential/decorative marks only | Preserve the token but do not use it for required small text; it is 3.18:1 on white and 2.89:1 on sidebar. |
| {colors.surface-app}, {colors.surface-sidebar}, {colors.surface-panel} | Working surface, navigation, artifact context | White/grey tonal layering; no gradients, textures or background illustration. |
| {colors.blue-600} | Agent suggestions, links, running indication and focus edge | Pair colour with text, a mark or selection state; dashed suggestion outlines remain visibly different from human decisions. |
| {colors.green-600}, {colors.green-800} | Human decision/addition marks; stronger accepted-chip text | A green mark never itself establishes Professional Approval, delivery or assurance. |
| {colors.amber-500}, {colors.amber-700} | Attention counts and evidence/action needs | Attention badge text uses ink-900 under proposed AX; evidence labels use amber-700 on the supplied pale amber. |
| {colors.red-600}, {colors.red-800} | Broken integrity and removed diff content | Do not colour findings red merely because they are findings. PDF type labels are the supplied explicit red exception. |
| {colors.source-highlight-bg}, {colors.row-selected-bg} | Cited source rows and selected work | Keep the row identifier and selection/citation explanation visible; pale fill is supplementary. |
| {colors.diff-add-bg}/{colors.diff-add-fg}, {colors.diff-del-bg}/{colors.diff-del-fg} | Additions and removals | Preserve +/− prefixes and the original content/context. |

No complete dark palette was supplied or selected. The ink technical-console region and Toast are dark local surfaces within the light system, not evidence of a dark theme. A dark theme is a downstream design decision; do not generate an inverted palette automatically.

### Visual accessibility floor and explicit applications

Use at least 4.5:1 for normal text and 3:1 for qualifying large text; meaningful control boundaries/indicators need 3:1 against adjacent colours. Ratios are not rounded up to pass. These are the [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) criteria, not a full conformance finding or resolution of PRD OQ-8.

| Supplied combination | Measured concern | Proposed AX application using existing colours |
| --- | --- | --- |
| Faint small text on white/sidebar/panel | 3.18 / 2.89 / 3.07:1 | Informative text uses {colors.text-muted}; 6.08:1 on white, 5.52:1 on sidebar. |
| White on amber-500 attention Badge | 2.94:1 | {components.Badge.attentionForeground} on {components.Badge.attentionBackground}: 5.99:1. |
| Green-600 on green-150 Accepted/Explained StatusChip | 4.47:1 | {components.StatusChip.acceptedForeground} on {components.StatusChip.acceptedBackground}: 7.78:1. |
| Pale input/unchecked-control borders on white | About 1.4–1.74:1 | Where the boundary is essential to identify the control, use existing ink-600 (6.08:1); decorative row separators retain pale source values. |
| Blue-150 focus ring against white/sidebar | 1.24 / 1.13:1 | Keep the pale ring supplementary; use a visible blue-600 edge/indicator (6.16:1 on white, 5.60:1 on sidebar). |

The proposed applications are represented in component tokens, while `colors.text-faint`, `colors.status-accepted-fg`, pale border aliases and the original focus-ring colour retain their source values. Verify each actual adjacent pair and rendered state; the table is not permission to apply a foreground to arbitrary backgrounds. Inactive controls and decorative separators have different criteria from essential text/control indicators. Colour alone must not convey a claim type, status, selected item, permission or failure.

Exact calculations and source conflicts are retained in the [extraction](.working/input-design-system.md). [Colour specimens and review annotations](imports/IMPORT-MANIFEST.md#guideline-html-cards--visual-and-content-specimens-22) remain visual references; [CSS files](imports/IMPORT-MANIFEST.md#css-tokens-and-entry-stylesheet--visual-values-6) are the numeric source.

## Typography

Use self-hosted IBM Plex Sans for UI/documents and IBM Plex Mono for references, code, overlines and file-type tags. [Five bundled WOFF2 files](imports/IMPORT-MANIFEST.md#bundled-woff2-fonts--typography-assets-5) supply Sans 400/500/600 and Mono 400/500, normal style, Latin subset, `font-display: swap`; do not assume an italic, 700 weight or broader language font exists. Preserve the fallback families in frontmatter; additional scripts and locale-specific typography remain a downstream requirement.

| Role | Frontmatter reference | Application |
| --- | --- | --- |
| Hero | {typography.hero.fontSize}, 600, 1.15 | Available source role; not the imported StartScreen's selected display size. |
| Display | {typography.display.fontSize}, 600, 1.2, −0.02em | StartScreen's opening question and occasional display hierarchy. |
| Title | {typography.title.fontSize}, 600, 1.45 | Header and section title role as resolved by source CSS. |
| Body | {typography.body.fontSize}, 400, 1.55 | Conversation, explanations and longer decision context. |
| UI | {typography.ui.fontSize}, 400, 1.45 | Navigation, compact labels and work rows. |
| Caption | {typography.caption.fontSize}, 400, 1.45 | Supporting information; meaningful text uses muted rather than faint. |
| Label | {typography.label.fontSize}, 500, 1, +0.04em | Mono overlines and compact identifiers. |
| Code | {typography.code.fontSize}, 400, 1.6 | Technical detail; users can enlarge/read it rather than relying on tiny text. |

**Source reconciliation:** the CSS `--type-title` resolves to 14px even though `--text-title` and the title specimen expose 18px. This contract retains the 14px semantic token; the conflicting specimen does not override it. The source's 18px primitive and other raw ramp values remain documented in the extraction for traceability, not silently promoted into a new role. StartScreen uses display 28px; AutomationsScreen uses the Header title role 14px.

Use sentence case for readable UI labels; uppercase only for the supplied mono overline/taxonomy treatment. Preserve tabular numerals and right alignment in numeric columns, with meaningful row/column labels. Dense source tags reach 8–11px: preserve their identity as source data, but do not make essential meaning depend on an unreadably small glyph or truncated value. Zoom, text resizing, legible labels and complete value disclosure are required in the peer experience contract. The [type/number specimens](imports/IMPORT-MANIFEST.md#guideline-html-cards--visual-and-content-specimens-22) and [typography.css](imports/inquello-design-system/tokens/typography.css) are the references; source document data is not a selected audit notation for every methodology.

## Layout & Spacing

Inherit the supplied 4px base and half steps: 2, 4, 6, 8, 10, 12, 16, 20, 24, 28, 32, 40, 48 and 64px. The 28px source token exists even though its specimen omits it. Frontmatter numeric spacing keys preserve the original suffixes, including `0-5`, `1-5` and `2-5`. Panels normally use {spacing.4}; the active thread uses {spacing.6}. Dense rows use source-local 6px/10px padding. Component-specific source measurements remain in the component contract, not an invented spacing scale.

| Region | Visual contract | Relationship |
| --- | --- | --- |
| Sidebar / collapsed rail | {spacing.sidebar-width} / {spacing.rail-width} | Pale navigation with full lockup or symbol; the rail retains accessible actions. |
| Header | {spacing.header-height} | Title/context/actions remain identifiable while working content scrolls. |
| Thread | Centred, max {spacing.thread-max-width} | Conversation and plan are readable alongside inspected work; Composer stays available. |
| Artifact side panel | Default {spacing.panel-default-width}; minimum {spacing.panel-min-width} | Tabs area {spacing.panel-tabs-height}; artifact can become the dominant surface. |
| Technical console region | Source height {spacing.console-height} | Ink surface for code/logs; its exact implementation is not supplied by a working console in the four-screen kit. |
| Dense artifacts | Horizontal scroll in the artifact region where required | Preserve row/column identity and values instead of shrinking text to fit. |

**Source reconciliation:** the declared panel minimum 380px wins over ActiveScreen's 340px prototype clamp. Review/automation reference code also uses context-specific narrower aside clamps; those are specimen layouts, not permission to reduce the declared artifact-panel minimum. On a constrained viewport, change the composition or expose one work region at a time while preserving context; do not force the desktop side-by-side layout to overflow the whole application. **[ASSUMPTION AS-UX2]** Exact responsive thresholds and secondary-client layouts are not supplied and remain downstream design work, not a V1 capability cut.

The [workspace kit](imports/IMPORT-MANIFEST.md#workspace-kit--scenario-and-layout-implementation-references-8) supplies the four visual screen references and shared composition source. Its fixed prototype dimensions and scenario callbacks are not a responsive or runtime contract. S01–S04 in EXPERIENCE use these reference compositions; S05–S13 assemble the same primitives/compositions around the existing PRD needs. Their added search, method, processing, history, policy, delivery, technical and native-record surfaces are explicitly derived placements with no new branded component APIs. V2 record screens remain V2 even when visually composed from V1 primitives.

## Elevation & Depth

Use tonal layering and one-pixel structural lines before shadows. Cards are normally flat. Shadows identify floating objects or paper previews rather than importance, correctness or authority. [layout.css](imports/inquello-design-system/tokens/layout.css) and the [elevation specimens](imports/IMPORT-MANIFEST.md#guideline-html-cards--visual-and-content-specimens-22) provide the exact stacks:

| Source shadow | Exact value | Use |
| --- | --- | --- |
| none | `none` | Ordinary cards and regions. |
| hairline | `0 1px 2px rgba(16, 24, 40, 0.04)` | Optional supplied hairline lift; not mandatory on every card. |
| composer | `0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.05)` | Composer. |
| page | `0 1px 2px rgba(16, 24, 40, 0.05), 0 8px 24px rgba(16, 24, 40, 0.06)` | Paper/document preview on a grey panel. |
| popover | `0 12px 32px rgba(16, 24, 40, 0.14)` | Menu floating layer. |
| toast | `0 8px 24px rgba(0, 0, 0, 0.2)` | Toast. |

No interface blur, translucent glass, gradient or decorative atmospheric effect is selected. The alpha values above belong to shadows. Source timing is 120/200/600ms with `cubic-bezier(0.2,0.8,0.2,1)` and an 800ms linear spinner; the pulse varies opacity from 1 to 0.3 and back. **[PROPOSED AX]** Respect reduced motion by removing nonessential animation while retaining an explicit textual state. The imported files contain no complete reduced-motion implementation, and neither a spinner nor a pulse is sufficient evidence of running or completed work.

## Shapes

The supplied geometry is restrained: {rounded.chip} chips, {rounded.sm}/{rounded.md} controls, {rounded.lg} tables/small cards, {rounded.card} cards/menus, {rounded.composer} Composer and {rounded.pill} pills. Preserve the literal source pill value 999px rather than substituting a conventional 9999px. App-icon radius is {rounded.app-icon}. Person avatars and send/stop controls are circles; this does not make every surface a pill.

One-pixel borders separate ordinary regions; essential interactive outlines use the contrast applications in Colors. The Composer's 14px corner radius gives it the softest rounding among the main surfaces. Do not add coloured left-edge accents. The [shape/brand-size specimens](imports/IMPORT-MANIFEST.md#guideline-html-cards--visual-and-content-specimens-22) and [logo assets](imports/IMPORT-MANIFEST.md#logo-svg-assets--directly-reusable-visual-assets-14) remain the shape references. Select the small symbol asset at ≤20px, correcting the reference Avatar's regular-symbol choice at its default 19px rendered agent height; the imported SVG/JSX files remain unchanged.

## Components

The following **18 primitives and 10 source compositions** are the exact shared vocabulary with EXPERIENCE. They inherit the selected package, with proposed AX applications called out above. `Shell.jsx` groups the shared compositions; it does not export a separate Shell component. `Over` is the uppercase mono overline helper, not an overlay or menu. Logical product surfaces may compose these without inventing another branded component.

| Component | Visual specification and states | Source |
| --- | --- | --- |
| Icon | Lucide outline, 16px default/14px dense/18px rail, 1.75 stroke, round caps/joins, currentColor. Meaningful standalone uses have a visible/accessible label. | [Icon.jsx](imports/inquello-design-system/components/core/Icon.jsx) |
| Button | primary ink/white; secondary outlined; quiet grey; ghost muted. Small/medium/large 26/28/32px, radius {rounded.md}; hover darkens fill; disabled source opacity .45, without hiding the reason. Leading icon/key hint optional. | [Button.jsx](imports/inquello-design-system/components/core/Button.jsx) |
| IconButton | ghost/outline/active plus round send/stop; default 28px and round 30px. Label required; stop uses 9px square. Focus has a visible existing-blue indicator. | [IconButton.jsx](imports/inquello-design-system/components/core/IconButton.jsx) |
| Avatar | Person initials disc in supplied tones; agent uses symbol without a face/disc. Default person 24px; decided green/white. Use small agent symbol at ≤20px. Initials are supplementary to a readable identity. | [Avatar.jsx](imports/inquello-design-system/components/core/Avatar.jsx) |
| Badge | Attention amber-500/ink-900 under proposed AX; neutral pale ink/secondary; accent blue/white. 11px type with a 16px line height, an 8px radius and 6px horizontal padding. A count signals attention, not accepted audit work. | [Badge.jsx](imports/inquello-design-system/components/core/Badge.jsx) |
| TextField | Single/multiline, label and placeholder, radius 6px, 7×9px padding, 12.5px type with a 1.45 line height. Informative placeholder/label muted. Proposed essential border ink-600; focused blue edge plus pale ring. Error/disabled/loading treatment is derived, not supplied API evidence. | [TextField.jsx](imports/inquello-design-system/components/forms/TextField.jsx) |
| Switch | On blue/off ink-300 track 28×16px, white thumb 12px, radius 8px. Provide readable On/Off state; proposed essential off boundary ink-600. Source lacks disabled/error variants. | [Switch.jsx](imports/inquello-design-system/components/forms/Switch.jsx) |
| Choice | Radio 14px/dot 6px or checkbox 16px/radius 4px; description creates an option card. Checked card blue border/blue-50, checkbox ink/white; unselected essential outline uses proposed ink-600. | [Choice.jsx](imports/inquello-design-system/components/forms/Choice.jsx) |
| SegmentedControl | Compact artifact-view options; selected ink/white, otherwise muted/white; radius 6px, 4×9px item padding. Selection includes text/shape/focus cues. | [SegmentedControl.jsx](imports/inquello-design-system/components/forms/SegmentedControl.jsx) |
| Tabs | Selected quiet fill/primary text, other tabs muted; radius 5px, 5×10px padding, 12.5px labels. Counts use readable muted 11px mono under proposed AX. | [Tabs.jsx](imports/inquello-design-system/components/navigation/Tabs.jsx) |
| Menu | White floating list, card radius 10px, popover shadow, default width 300px; heading, label/description, optional checkmark and hover. Proposed heading muted, not faint; selection/focus must remain distinct. | [Menu.jsx](imports/inquello-design-system/components/navigation/Menu.jsx) |
| StatusChip | Suggested dashed blue; investigating pale ink; open outlined; needs evidence/awaiting client amber; accepted/explained pale green with green-800 under proposed AX. 11px label, radius 3px, optional 16px decision disc. Status meaning follows the actual Method; a green chip is not sign-off. | [StatusChip.jsx](imports/inquello-design-system/components/status/StatusChip.jsx) |
| JudgmentTag | Calculation ƒ/ink, observation ◦/muted, suggestion dashed-blue box, decision green dot, gap dash/amber. 10px mono uppercase or 11px sentence case; keep readable claim text alongside. | [JudgmentTag.jsx](imports/inquello-design-system/components/status/JudgmentTag.jsx) |
| FileChip | PDF red, XLS green, DOC blue, DIR muted; mono 9px type tag with 12px name; chip or tag variant, radius 6px, ink-50 background. Proposed removal glyph muted with labelled hit target. | [FileChip.jsx](imports/inquello-design-system/components/status/FileChip.jsx) |
| PlanStep | Supplied done/running/pending: green check, blue running outline/fill, neutral pending. Indicator 14px/radius 4px. Proposed informative completed/meta text muted. Blocked/error/interrupted use explicit words and existing status colours; no false done check. | [PlanStep.jsx](imports/inquello-design-system/components/workflow/PlanStep.jsx) |
| ApprovalCard | Amber-50 panel, amber-200 border, radius 10px, padding 12×14px; mono label, 13.5px question, optional 12.5px exact-message quote and clear action hierarchy. Context/note uses muted under proposed AX. | [ApprovalCard.jsx](imports/inquello-design-system/components/workflow/ApprovalCard.jsx) |
| DiffLine | Add green+/remove red−/change blue~/context neutral; optional 40px gutter, 14px sign, 12.5px body text with a 1.5 line height. Gutter information uses muted under proposed AX. | [DiffLine.jsx](imports/inquello-design-system/components/workflow/DiffLine.jsx) |
| Toast | Ink/white; 6px radius, 8×14px padding, 12.5px type with a 1.4 line height, and toast shadow. Visibility is primitive state; source container supplies top-centre positioning/2.6s timer. Critical outcomes remain readable elsewhere. | [Toast.jsx](imports/inquello-design-system/components/workflow/Toast.jsx) |
| Sidebar | Pale 264px navigation with a 20px lockup, hierarchy of workspaces/tasks and bottom person/settings. Collapsed 52px rail retains symbol/actions. NavRow/Badge/Avatar supply content; derived surfaces retain this vocabulary. | [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) |
| Header | White 48px region with a 14px semantic title, readable muted context and trailing actions; default bottom structural line. Avoid truncating the only source of task/destination identity. | [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) |
| Composer | White 14px-radius input surface, supplied composer shadow, body typography, FileChip context, compact controls and 30px send/stop. Proposed meaningful placeholder muted and essential boundary ink-600. | [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) |
| NavRow | UI 13px, 6×8px padding, 6px radius, selected ink-150 and hover source-hover. Indentation conveys hierarchy in addition to labels; essential metadata is muted. | [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) |
| Over | Supplied mono 11px medium overline, uppercase, +.04em; proposed foreground muted rather than faint for meaningful headings. No independent floating layer. | [Shell.jsx](imports/inquello-design-system/ui_kits/workspace/Shell.jsx) |
| Workbook | Compact artifact view with file identity/version, segmented sheet selector, aligned numeric columns, supplied row highlights and judgment legend. Table radius 8px and 12.5px type; horizontal scroll preserves values. Its sample calculations are reference data, not W1 acceptance evidence. | [ActiveScreen.jsx](imports/inquello-design-system/ui_kits/workspace/ActiveScreen.jsx) |
| StartScreen | Header and centred 720px-max column; symbol 40px, display 28px opening prompt, Composer, applied-method row and suggested existing files. Concrete method names/data are examples, not mandatory workflow. | [StartScreen.jsx](imports/inquello-design-system/ui_kits/workspace/StartScreen.jsx) |
| ActiveScreen | Thread beside artifact region with Changes/Preview/Summary; plan/specialists/approval request and persistent Composer. Declared artifact minimum 380px wins over 340px prototype clamp. Stopping cannot visually mark remaining work completed. | [ActiveScreen.jsx](imports/inquello-design-system/ui_kits/workspace/ActiveScreen.jsx) |
| ReviewScreen | Artifact-dominant source table plus reviewer/agent explanation, claim tags, choices, reason and affected-output diffs. Source rows highlighted without colour-only meaning. Reuse this composition inside reviewer-private agent Tasks; distinguish submitted version, agent checks, private draft notes and human-issued notes through text/identity rather than new colours. Keep/local review remains distinct from Professional Approval. | [ReviewScreen.jsx](imports/inquello-design-system/ui_kits/workspace/ReviewScreen.jsx) |
| AutomationsScreen | Header 14px title, compact automation list with selected blue-50 row, readable trigger/last-run context and detailed check/action region. A successful run must not borrow an accepted human-decision appearance without the corresponding decision. | [AutomationsScreen.jsx](imports/inquello-design-system/ui_kits/workspace/AutomationsScreen.jsx) |

[Component source files](imports/IMPORT-MANIFEST.md#component-jsx-and-icon-path-source--implementation-references-19), [API declarations](imports/IMPORT-MANIFEST.md#component-typescript-declarations--api-and-state-references-18) and [prompt examples](imports/IMPORT-MANIFEST.md#component-prompt-examples--untrusted-descriptive-source-data-18) preserve the complete source contracts and local literal values. [Five component cards plus preview loader](imports/IMPORT-MANIFEST.md#component-html-cards-and-loader--executable-preview-references-6) and the [workspace kit](imports/IMPORT-MANIFEST.md#workspace-kit--scenario-and-layout-implementation-references-8) are executable preview references, not production components or proof of interaction behavior. They were inspected without executing the loader, JSX or remote CDN scripts.

All [40 icon assets](imports/IMPORT-MANIFEST.md#icon-svg-assets--directly-reusable-visual-assets-40) and their inline path source are retained transitively. No decorative illustration or alternate icon family is introduced. Complete imported source roles and integrity are in the manifest; [.working/token-contract.json](.working/token-contract.json) mirrors the machine-readable token paths for the peer spine.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| Use supplied palette/identity/type and exact named components. | Introduce a new palette, font family, icon set, dark theme or production framework. |
| Keep primary actions ink and evidence visually prominent. | Paint generic chrome blue or make every card an accent surface. |
| Use existing stronger foreground pairs for meaningful text and controls under proposed AX. | Ship source faint text, white-on-amber or green-600-on-green-150 as though measured contrast passed. |
| Provide labelled, visible focus and accessible hit areas while retaining compact visual tokens. | Equate a 14px visual mark with a sufficient interaction target. The [24×24 CSS-pixel target criterion or documented exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) needs implementation evidence. |
| Keep small-symbol, title 14px and panel minimum 380px reconciliations explicit. | Modify imports to hide disagreements or infer a new token from a specimen label. |
| Let labels, prefixes, outlines and identity accompany semantic colour. | Treat a green chip, successful automation or agent review as human approval. |
| Preserve visible work, source context, uncertainty, version and confirmed/uncertain delivery distinctions. | Copy prototype Keep, Stop, Excel or message callbacks as real runtime behavior. |
| Show creator-private versus explicitly shared scope, submitted version and private versus issued review notes with readable labels using existing tokens. | Treat Workspace membership, agent agreement or a share icon as authority, professional independence or proof of recipient access. |
| Support text resize/zoom, complete value disclosure and reduced motion. | Shrink a dense desktop table until it fits or rely solely on animation/colour. |
| Use document/artifact previews as the visual material. | Add photography, decorative imagery, gradients, glass effects, coloured side stripes or bounce animation. |
| Treat S05–S13 arrangements and secondary-client details as explicit derived/downstream work. | Omit broad V1 capabilities because the source kit contains only four desktop screens. |

The supplied primitives have known implementation limits: several custom clickable elements lack complete keyboard handling; source disabled/error/loading states are incomplete; no full responsive, dark, internationalisation or reduced-motion system is supplied; contrast calculations are static, not rendered validation. EXPERIENCE defines the behavioural accessibility floor and state requirements. These limits remain work for UX/implementation and PRD gates, not evidence that the user selected a narrower product or that this visual contract already satisfies OQ-8.
