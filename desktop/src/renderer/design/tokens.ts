/**
 * Inquello design tokens: every value equals DESIGN.md
 * (`_bmad-output/planning-artifacts/ux-designs/ux-inquello-2026-10-26/DESIGN.md`).
 *
 * - `colors`, `typography`, `rounded`, `spacing` and `icon` mirror the DESIGN.md
 *   frontmatter groups (`icon` is `components.Icon`), keys and values unchanged.
 * - `shadows` and `motion` mirror the Elevation & Depth table and paragraph.
 *
 * `tokens.css` exposes the same values under the design-system import's CSS
 * variable names; `cssVariables()` is that mapping, and `test/design.test.ts`
 * holds DESIGN.md, this module and `tokens.css` equal both ways. No dark theme.
 */

export const colors = {
  'ink-900': '#16191d',
  'ink-800': '#2b3036',
  'ink-700': '#3d434b',
  'ink-600': '#5b636e',
  'ink-500': '#8a919a',
  'ink-400': '#aeb5bd',
  'ink-300': '#c4c9cf',
  'ink-250': '#cfd4da',
  'ink-200': '#d6dade',
  'ink-150': '#e3e6ea',
  'ink-100': '#eef0f2',
  'ink-75': '#f3f4f6',
  'ink-50': '#fafbfc',
  white: '#ffffff',
  'blue-800': '#1d3f80',
  'blue-700': '#244a8f',
  'blue-600': '#2f5fb3',
  'blue-200': '#c9d6ee',
  'blue-150': '#dfe7f5',
  'blue-100': '#eaf1fb',
  'blue-50': '#f2f6fc',
  'green-800': '#1e5236',
  'green-600': '#2f7a52',
  'green-200': '#bfdcc9',
  'green-150': '#e3f1e8',
  'green-100': '#eef6f0',
  'green-50': '#f6fbf8',
  'amber-800': '#5c4210',
  'amber-700': '#8a5a12',
  'amber-500': '#c98a1b',
  'amber-200': '#ecd9ae',
  'amber-150': '#fbf0d9',
  'amber-50': '#fffaf0',
  'red-800': '#7a2e2b',
  'red-600': '#b0413e',
  'red-200': '#efc9c6',
  'red-50': '#fdf3f2',
  'text-primary': '#16191d',
  'text-secondary': '#3d434b',
  'text-muted': '#5b636e',
  /** Source alias kept at its source value; nonessential/decorative marks only. */
  'text-faint': '#8a919a',
  'text-inverse': '#ffffff',
  'text-link': '#2f5fb3',
  'text-link-hover': '#1d3f80',
  'surface-app': '#ffffff',
  'surface-sidebar': '#f3f4f6',
  'surface-panel': '#fafbfc',
  'surface-raised': '#ffffff',
  'surface-subtle': '#eef0f2',
  'surface-hover': '#e6e8eb',
  'surface-selected': '#e3e6ea',
  'surface-console': '#16191d',
  'surface-console-raised': '#2b3036',
  'border-subtle': '#eef0f2',
  'border-default': '#e3e6ea',
  'border-strong': '#d6dade',
  'border-input': '#cfd4da',
  'action-primary-bg': '#16191d',
  'action-primary-bg-hover': '#2b3036',
  'action-primary-fg': '#ffffff',
  'action-secondary-bg': '#ffffff',
  'action-secondary-border': '#d6dade',
  'action-quiet-bg': '#eef0f3',
  'judgment-calculation': '#16191d',
  'judgment-observation': '#5b636e',
  'judgment-suggestion': '#2f5fb3',
  'judgment-decision': '#2f7a52',
  'judgment-gap': '#8a5a12',
  'status-suggested-fg': '#2f5fb3',
  'status-suggested-border': '#2f5fb3',
  'status-investigating-bg': '#eef0f2',
  'status-investigating-fg': '#3d434b',
  'status-open-fg': '#3d434b',
  'status-open-border': '#bfc5cc',
  'status-evidence-bg': '#fbf0d9',
  'status-evidence-fg': '#8a5a12',
  'status-evidence-border': '#ecd9ae',
  'status-accepted-bg': '#e3f1e8',
  /** Source alias kept at its source value; StatusChip applies green-800 (Story 1.8). */
  'status-accepted-fg': '#2f7a52',
  'status-accepted-border': '#bfdcc9',
  'row-added-bg': '#f6fbf8',
  'row-added-mark': '#2f7a52',
  'row-changed-bg': '#eef6f0',
  'row-selected-bg': '#f2f6fc',
  'source-highlight-bg': '#eaf1fb',
  'diff-add-bg': '#f0f8f3',
  'diff-add-fg': '#1e5236',
  'diff-del-bg': '#fdf3f2',
  'diff-del-fg': '#7a2e2b',
  'approval-bg': '#fffaf0',
  'approval-border': '#ecd9ae',
  'file-pdf': '#b0413e',
  'file-xls': '#2f7a52',
  'file-doc': '#2f5fb3',
  'file-folder': '#5b636e',
} as const;

export const FONT_SANS = "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

export const typography = {
  hero: { fontFamily: FONT_SANS, fontSize: '32px', fontWeight: '600', lineHeight: '1.15', letterSpacing: '-0.02em' },
  display: { fontFamily: FONT_SANS, fontSize: '28px', fontWeight: '600', lineHeight: '1.2', letterSpacing: '-0.02em' },
  title: { fontFamily: FONT_SANS, fontSize: '14px', fontWeight: '600', lineHeight: '1.45' },
  body: { fontFamily: FONT_SANS, fontSize: '14px', fontWeight: '400', lineHeight: '1.55' },
  ui: { fontFamily: FONT_SANS, fontSize: '13px', fontWeight: '400', lineHeight: '1.45' },
  caption: { fontFamily: FONT_SANS, fontSize: '12px', fontWeight: '400', lineHeight: '1.45' },
  label: { fontFamily: FONT_MONO, fontSize: '11px', fontWeight: '500', lineHeight: '1', letterSpacing: '0.04em' },
  code: { fontFamily: FONT_MONO, fontSize: '11.5px', fontWeight: '400', lineHeight: '1.6' },
} as const;

export const rounded = {
  chip: '3px',
  sm: '5px',
  md: '6px',
  lg: '8px',
  card: '10px',
  composer: '14px',
  /** The literal source value, not a conventional 9999px. */
  pill: '999px',
  'app-icon': '22.7%',
} as const;

export const spacing = {
  '0-5': '2px',
  '1': '4px',
  '1-5': '6px',
  '2': '8px',
  '2-5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '7': '28px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  'header-height': '48px',
  'panel-tabs-height': '40px',
  'sidebar-width': '264px',
  'rail-width': '52px',
  'thread-max-width': '720px',
  'panel-min-width': '380px',
  'panel-default-width': '560px',
  'console-height': '230px',
  'control-sm': '26px',
  'control-md': '28px',
  'control-lg': '32px',
  'control-round': '30px',
} as const;

/** DESIGN.md `components.Icon`. */
export const icon = {
  size: '16px',
  denseSize: '14px',
  railSize: '18px',
  strokeWidth: '1.75',
  foreground: '{colors.text-secondary}',
} as const;

/** DESIGN.md Elevation & Depth table. */
export const shadows = {
  none: 'none',
  hairline: '0 1px 2px rgba(16, 24, 40, 0.04)',
  composer: '0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.05)',
  page: '0 1px 2px rgba(16, 24, 40, 0.05), 0 8px 24px rgba(16, 24, 40, 0.06)',
  popover: '0 12px 32px rgba(16, 24, 40, 0.14)',
  toast: '0 8px 24px rgba(0, 0, 0, 0.2)',
} as const;

/** DESIGN.md motion: 120/200/600ms, the standard ease, an 800ms linear spinner and a 1→0.3→1 opacity pulse. */
export const motion = {
  durationFast: '120ms',
  durationBase: '200ms',
  durationSlow: '600ms',
  easeStandard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  spinDuration: '800ms',
  spinEasing: 'linear',
  pulseOpacityFrom: '1',
  pulseOpacityTo: '0.3',
} as const;

export const tokens = { colors, typography, rounded, spacing, icon, shadows, motion } as const;

export type ColorToken = keyof typeof colors;
export type TypographyRole = keyof typeof typography;
export type RoundedToken = keyof typeof rounded;
export type SpacingToken = keyof typeof spacing;
export type ShadowToken = keyof typeof shadows;

/** `font` shorthand for a role, as the import's `--type-*` composites write it. */
export function fontShorthand(role: TypographyRole): string {
  const { fontWeight, fontSize, lineHeight, fontFamily } = typography[role];
  return `${fontWeight} ${fontSize}/${lineHeight} ${fontFamily}`;
}

/**
 * Every CSS custom property `tokens.css` declares, by the import's source
 * variable name. Numeric spacing keys use `--space-*`; layout and control
 * sizes keep their own names, as in the import's `layout.css`.
 */
export function cssVariables(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) out[`--${key}`] = value;
  out['--font-sans'] = FONT_SANS;
  out['--font-mono'] = FONT_MONO;
  for (const role of Object.keys(typography) as TypographyRole[]) out[`--type-${role}`] = fontShorthand(role);
  out['--tracking-display'] = typography.display.letterSpacing;
  out['--tracking-label'] = typography.label.letterSpacing;
  for (const [key, value] of Object.entries(rounded)) out[`--radius-${key}`] = value;
  for (const [key, value] of Object.entries(spacing)) out[/^\d/.test(key) ? `--space-${key}` : `--${key}`] = value;
  for (const [key, value] of Object.entries(shadows)) out[`--shadow-${key}`] = value;
  out['--ease-standard'] = motion.easeStandard;
  out['--duration-fast'] = motion.durationFast;
  out['--duration-base'] = motion.durationBase;
  out['--duration-slow'] = motion.durationSlow;
  out['--spin-duration'] = motion.spinDuration;
  return out;
}
