/**
 * WCAG 2.2 contrast for the Story 1.6 primitives.
 *
 * - `contrastRatio` is the WCAG relative-luminance ratio, unrounded.
 * - `CONTRAST_PAIRS` lists every adjacent colour pair a primitive shows, per
 *   variant and state: the foreground token, the adjacent token, whether it is
 *   text (4.5:1) or a non-text indicator or boundary (3:1), and where the
 *   specimen page renders it (`render`), so the `--smoke` probe can read the
 *   same pair from computed styles.
 * - `CONTRAST_EXEMPT` names the pairs deliberately not held to a threshold,
 *   with the reason, so the evidence shows them instead of hiding them.
 *
 * `test/contrast.test.ts` computes every pair from tokens and writes
 * `evidence/contrast-primitives.json`.
 */
import { colors, type ColorToken } from './tokens';

export type ContrastKind = 'text' | 'non-text';

/** WCAG 1.4.3 normal text and WCAG 1.4.11 non-text contrast. */
export const CONTRAST_THRESHOLDS: Record<ContrastKind, number> = { text: 4.5, 'non-text': 3 };

/** A computed-style read: `selector` is relative to the specimen hook (`:scope` is the hook itself). */
export interface StyleRead {
  selector: string;
  /** A CSS property whose computed value holds the colour (`box-shadow` reads its first colour). */
  property: string;
  /** For `background-color`: walk up to the first ancestor with an opaque background. */
  effective?: boolean;
}

/**
 * Where the specimen renders a pair. `static` pairs are read as rendered;
 * `focus` pairs after the probe tabs into the hook. `null` means the state
 * (hover) cannot be produced without a pointer, so only the token pair is
 * recorded.
 */
export interface ContrastRender {
  /** The specimen's `data-contrast` hook. */
  hook: string;
  when: 'static' | 'focus';
  foreground: StyleRead;
  adjacent: StyleRead;
}

export interface ContrastPair {
  id: string;
  primitive: 'Button' | 'IconButton' | 'TextField' | 'Switch' | 'Choice';
  variant: string;
  state: string;
  part: string;
  foreground: ColorToken;
  adjacent: ColorToken;
  kind: ContrastKind;
  render: ContrastRender | null;
}

export interface ContrastExemption {
  primitive: ContrastPair['primitive'];
  variant: string;
  state: string;
  part: string;
  foreground: ColorToken | 'opacity 0.45';
  adjacent: ColorToken;
  reason: string;
}

/** `#rrggbb` or `rgb(r, g, b)` / `rgba(r, g, b, 1)` to 0–255 channels. */
export function parseColor(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  if (hex) return [Number.parseInt(hex[1]!, 16), Number.parseInt(hex[2]!, 16), Number.parseInt(hex[3]!, 16)];
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(value.trim());
  if (rgb && (rgb[4] === undefined || Number(rgb[4]) === 1)) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`not an opaque colour: ${value}`);
}

/** WCAG 2.2 relative luminance. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = parseColor(color).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.2 contrast ratio, unrounded, always ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const read = (selector: string, property: string, effective?: boolean): StyleRead =>
  effective ? { selector, property, effective } : { selector, property };
const color = (selector: string) => read(selector, 'color');
const background = (selector: string) => read(selector, 'background-color', true);
const border = (selector: string) => read(selector, 'border-top-color');

/** Within a group hook: the selected option and the first unselected one. */
const SELECTED = '.iq-choice--checked';
const UNSELECTED = '.iq-choice:not(.iq-choice--checked)';

type PairInput = Omit<ContrastPair, 'id' | 'render'> & { render?: ContrastRender | null };

function pair(input: PairInput): ContrastPair {
  const id = [input.primitive, input.variant, input.state, input.part].join('.').toLowerCase();
  return { id, ...input, render: input.render ?? null };
}

const BUTTON_VARIANTS = [
  { variant: 'primary', fg: 'action-primary-fg', bg: 'action-primary-bg', hover: 'action-primary-bg-hover' },
  { variant: 'secondary', fg: 'text-primary', bg: 'action-secondary-bg', hover: 'ink-75' },
  { variant: 'quiet', fg: 'text-primary', bg: 'action-quiet-bg', hover: 'surface-hover' },
  { variant: 'ghost', fg: 'text-muted', bg: 'surface-app', hover: 'ink-75' },
] as const satisfies ReadonlyArray<{ variant: string; fg: ColorToken; bg: ColorToken; hover: ColorToken }>;

/** The focus indicator: a blue-600 edge outside the 3px blue-150 ring, on the app surface. */
function focusPairs(primitive: ContrastPair['primitive'], hook: string, target: string): ContrastPair[] {
  const edgeProperty = 'outline-color';
  return [
    pair({
      primitive, variant: 'any', state: 'focus-visible', part: 'focus edge against ring', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text',
      render: { hook, when: 'focus', foreground: read(target, edgeProperty), adjacent: read(target, 'box-shadow') },
    }),
    pair({
      primitive, variant: 'any', state: 'focus-visible', part: 'focus edge against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text',
      render: { hook, when: 'focus', foreground: read(target, edgeProperty), adjacent: background(':scope') },
    }),
    pair({ primitive, variant: 'any', state: 'focus-visible', part: 'focus edge against sidebar', foreground: 'blue-600', adjacent: 'surface-sidebar', kind: 'non-text' }),
  ];
}

function reasonPair(primitive: ContrastPair['primitive'], hook: string): ContrastPair {
  return pair({
    primitive, variant: 'any', state: 'disabled', part: 'disabled reason text', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook, when: 'static', foreground: color('.iq-note'), adjacent: background('.iq-note') },
  });
}

export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  // Button: the label on each variant's fill, at rest, hovered and pending.
  ...BUTTON_VARIANTS.flatMap(({ variant, fg, bg, hover }) => [
    pair({
      primitive: 'Button', variant, state: 'default', part: 'label', foreground: fg, adjacent: bg, kind: 'text',
      render: { hook: `button-${variant}`, when: 'static', foreground: color('.iq-button'), adjacent: background('.iq-button') },
    }),
    pair({ primitive: 'Button', variant, state: 'hover', part: 'label', foreground: fg, adjacent: hover, kind: 'text' }),
    pair({
      primitive: 'Button', variant, state: 'pending', part: 'label', foreground: fg, adjacent: bg, kind: 'text',
      render: { hook: `button-${variant}-pending`, when: 'static', foreground: color('.iq-button'), adjacent: background('.iq-button') },
    }),
  ]),
  pair({ primitive: 'Button', variant: 'ghost', state: 'default', part: 'label on sidebar', foreground: 'text-muted', adjacent: 'surface-sidebar', kind: 'text' }),
  pair({
    primitive: 'Button', variant: 'any', state: 'pending', part: 'pending text', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'button-primary-pending', when: 'static', foreground: color('.iq-note'), adjacent: background('.iq-note') },
  }),
  reasonPair('Button', 'button-disabled'),
  ...focusPairs('Button', 'button-primary', '.iq-button'),

  // IconButton: the icon (non-text) on each variant's fill.
  pair({
    primitive: 'IconButton', variant: 'ghost', state: 'default', part: 'icon', foreground: 'text-secondary', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'icon-button-ghost', when: 'static', foreground: color('.iq-icon-button'), adjacent: background('.iq-icon-button') },
  }),
  pair({ primitive: 'IconButton', variant: 'ghost', state: 'default', part: 'icon on sidebar', foreground: 'text-secondary', adjacent: 'surface-sidebar', kind: 'non-text' }),
  pair({ primitive: 'IconButton', variant: 'ghost', state: 'hover', part: 'icon', foreground: 'text-secondary', adjacent: 'surface-hover', kind: 'non-text' }),
  pair({
    primitive: 'IconButton', variant: 'outline', state: 'default', part: 'icon', foreground: 'text-secondary', adjacent: 'white', kind: 'non-text',
    render: { hook: 'icon-button-outline', when: 'static', foreground: color('.iq-icon-button'), adjacent: background('.iq-icon-button') },
  }),
  pair({ primitive: 'IconButton', variant: 'outline', state: 'hover', part: 'icon', foreground: 'text-secondary', adjacent: 'surface-hover', kind: 'non-text' }),
  pair({
    primitive: 'IconButton', variant: 'active', state: 'default', part: 'icon', foreground: 'text-secondary', adjacent: 'action-quiet-bg', kind: 'non-text',
    render: { hook: 'icon-button-active', when: 'static', foreground: color('.iq-icon-button'), adjacent: background('.iq-icon-button') },
  }),
  pair({
    primitive: 'IconButton', variant: 'ghost', state: 'expanded', part: 'icon', foreground: 'text-secondary', adjacent: 'action-quiet-bg', kind: 'non-text',
    render: { hook: 'icon-button-expanded', when: 'static', foreground: color('.iq-icon-button'), adjacent: background('.iq-icon-button') },
  }),
  ...(['send', 'stop'] as const).flatMap((variant) => [
    pair({
      primitive: 'IconButton', variant, state: 'default', part: variant === 'send' ? 'arrow icon' : '9px stop square', foreground: 'action-primary-fg', adjacent: 'action-primary-bg', kind: 'non-text',
      render: {
        hook: `icon-button-${variant}`, when: 'static',
        foreground: variant === 'send' ? color('.iq-icon-button') : read('.iq-icon-button-stop', 'background-color'),
        adjacent: background('.iq-icon-button'),
      },
    }),
    pair({ primitive: 'IconButton', variant, state: 'hover', part: variant === 'send' ? 'arrow icon' : '9px stop square', foreground: 'action-primary-fg', adjacent: 'action-primary-bg-hover', kind: 'non-text' }),
    pair({
      primitive: 'IconButton', variant, state: 'default', part: 'round boundary against surface', foreground: 'action-primary-bg', adjacent: 'surface-app', kind: 'non-text',
      render: { hook: `icon-button-${variant}`, when: 'static', foreground: read('.iq-icon-button', 'background-color'), adjacent: background(':scope') },
    }),
  ]),
  reasonPair('IconButton', 'icon-button-disabled'),
  ...focusPairs('IconButton', 'icon-button-ghost', '.iq-icon-button'),

  // TextField: value, label, instruction and placeholder text; the essential boundary; error and read-only.
  pair({
    primitive: 'TextField', variant: 'single', state: 'default', part: 'value', foreground: 'text-primary', adjacent: 'white', kind: 'text',
    render: { hook: 'text-field', when: 'static', foreground: color('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({ primitive: 'TextField', variant: 'single', state: 'default', part: 'placeholder', foreground: 'text-muted', adjacent: 'white', kind: 'text' }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'default', part: 'label', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'text-field', when: 'static', foreground: color('.iq-field-label'), adjacent: background('.iq-field-label') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'default', part: 'instruction', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'text-field', when: 'static', foreground: color('.iq-field-instruction'), adjacent: background('.iq-field-instruction') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'default', part: 'boundary against field', foreground: 'ink-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'text-field', when: 'static', foreground: border('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'default', part: 'boundary against surface', foreground: 'ink-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'text-field', when: 'static', foreground: border('.iq-field-control'), adjacent: background(':scope') },
  }),
  pair({ primitive: 'TextField', variant: 'single', state: 'default', part: 'boundary against sidebar', foreground: 'ink-600', adjacent: 'surface-sidebar', kind: 'non-text' }),
  pair({
    primitive: 'TextField', variant: 'multiline', state: 'default', part: 'boundary against field', foreground: 'ink-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'text-field-multiline', when: 'static', foreground: border('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'error', part: 'error text', foreground: 'red-800', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'text-field-error', when: 'static', foreground: color('.iq-field-error'), adjacent: background('.iq-field-error') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'error', part: 'boundary against field', foreground: 'red-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'text-field-error', when: 'static', foreground: border('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'error', part: 'value', foreground: 'text-primary', adjacent: 'white', kind: 'text',
    render: { hook: 'text-field-error', when: 'static', foreground: color('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'read-only', part: 'value', foreground: 'text-primary', adjacent: 'surface-panel', kind: 'text',
    render: { hook: 'text-field-read-only', when: 'static', foreground: color('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'single', state: 'read-only', part: 'boundary against field', foreground: 'ink-600', adjacent: 'surface-panel', kind: 'non-text',
    render: { hook: 'text-field-read-only', when: 'static', foreground: border('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  reasonPair('TextField', 'text-field-disabled'),
  pair({
    primitive: 'TextField', variant: 'any', state: 'focus-visible', part: 'focus edge against field', foreground: 'blue-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'text-field', when: 'focus', foreground: border('.iq-field-control'), adjacent: background('.iq-field-control') },
  }),
  pair({
    primitive: 'TextField', variant: 'any', state: 'focus-visible', part: 'focus edge against ring', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text',
    render: { hook: 'text-field', when: 'focus', foreground: border('.iq-field-control'), adjacent: read('.iq-field-control', 'box-shadow') },
  }),

  // Switch: the track boundary, the on thumb and the readable On/Off text.
  pair({
    primitive: 'Switch', variant: 'off', state: 'default', part: 'track boundary against surface', foreground: 'ink-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'switch-off', when: 'static', foreground: border('.iq-switch-track'), adjacent: background(':scope') },
  }),
  pair({ primitive: 'Switch', variant: 'off', state: 'default', part: 'track boundary against sidebar', foreground: 'ink-600', adjacent: 'surface-sidebar', kind: 'non-text' }),
  pair({
    primitive: 'Switch', variant: 'off', state: 'default', part: 'track boundary against off track', foreground: 'ink-600', adjacent: 'ink-300', kind: 'non-text',
    render: { hook: 'switch-off', when: 'static', foreground: border('.iq-switch-track'), adjacent: read('.iq-switch-track', 'background-color') },
  }),
  pair({
    primitive: 'Switch', variant: 'on', state: 'default', part: 'track against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'switch-on', when: 'static', foreground: read('.iq-switch-track', 'background-color'), adjacent: background(':scope') },
  }),
  pair({ primitive: 'Switch', variant: 'on', state: 'default', part: 'track against sidebar', foreground: 'blue-600', adjacent: 'surface-sidebar', kind: 'non-text' }),
  pair({
    primitive: 'Switch', variant: 'on', state: 'default', part: 'thumb against track', foreground: 'white', adjacent: 'blue-600', kind: 'non-text',
    render: { hook: 'switch-on', when: 'static', foreground: read('.iq-switch-thumb', 'background-color'), adjacent: read('.iq-switch-track', 'background-color') },
  }),
  ...(['off', 'on'] as const).flatMap((variant) => [
    pair({
      primitive: 'Switch', variant, state: 'default', part: 'On/Off text', foreground: 'text-secondary', adjacent: 'surface-app', kind: 'text',
      render: { hook: `switch-${variant}`, when: 'static', foreground: color('.iq-switch-state'), adjacent: background('.iq-switch-state') },
    }),
    pair({
      primitive: 'Switch', variant, state: 'default', part: 'label', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
      render: { hook: `switch-${variant}`, when: 'static', foreground: color('.iq-switch-label'), adjacent: background('.iq-switch-label') },
    }),
  ]),
  reasonPair('Switch', 'switch-disabled'),
  ...focusPairs('Switch', 'switch-off', '.iq-switch'),

  // Choice: radio and checkbox boundaries and marks, labels, descriptions and option cards.
  // In a group hook, `.iq-choice--checked` is the selected option and `:not(...)` an unselected one.
  pair({
    primitive: 'Choice', variant: 'group', state: 'default', part: 'legend', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'radio-group', when: 'static', foreground: color('.iq-choice-legend'), adjacent: background('.iq-choice-legend') },
  }),
  pair({
    primitive: 'Choice', variant: 'group', state: 'default', part: 'instruction', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'radio-group', when: 'static', foreground: color('.iq-choice-instruction'), adjacent: background('.iq-choice-instruction') },
  }),
  pair({
    primitive: 'Choice', variant: 'radio', state: 'unselected', part: 'boundary against surface', foreground: 'ink-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'radio-group', when: 'static', foreground: border(`${UNSELECTED} .iq-choice-box`), adjacent: background(UNSELECTED) },
  }),
  pair({ primitive: 'Choice', variant: 'radio', state: 'unselected', part: 'boundary against sidebar', foreground: 'ink-600', adjacent: 'surface-sidebar', kind: 'non-text' }),
  pair({
    primitive: 'Choice', variant: 'radio', state: 'unselected', part: 'label', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'radio-group', when: 'static', foreground: color(`${UNSELECTED} .iq-choice-label`), adjacent: background(`${UNSELECTED} .iq-choice-label`) },
  }),
  pair({
    primitive: 'Choice', variant: 'radio', state: 'selected', part: 'boundary against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'radio-group', when: 'static', foreground: border(`${SELECTED} .iq-choice-box`), adjacent: background(SELECTED) },
  }),
  pair({
    primitive: 'Choice', variant: 'radio', state: 'selected', part: 'dot against inner ring', foreground: 'blue-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'radio-group', when: 'static', foreground: read(`${SELECTED} .iq-choice-box`, 'background-color'), adjacent: read(`${SELECTED} .iq-choice-box`, 'box-shadow') },
  }),
  pair({
    primitive: 'Choice', variant: 'radio', state: 'selected', part: 'label', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'radio-group', when: 'static', foreground: color(`${SELECTED} .iq-choice-label`), adjacent: background(`${SELECTED} .iq-choice-label`) },
  }),
  pair({
    primitive: 'Choice', variant: 'checkbox', state: 'unselected', part: 'boundary against surface', foreground: 'ink-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'checkbox-unselected', when: 'static', foreground: border('.iq-choice-box'), adjacent: background('.iq-choice') },
  }),
  pair({
    primitive: 'Choice', variant: 'checkbox', state: 'unselected', part: 'boundary against box', foreground: 'ink-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'checkbox-unselected', when: 'static', foreground: border('.iq-choice-box'), adjacent: read('.iq-choice-box', 'background-color') },
  }),
  pair({
    primitive: 'Choice', variant: 'checkbox', state: 'unselected', part: 'label', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'checkbox-unselected', when: 'static', foreground: color('.iq-choice-label'), adjacent: background('.iq-choice-label') },
  }),
  pair({
    primitive: 'Choice', variant: 'checkbox', state: 'selected', part: 'box against surface', foreground: 'ink-900', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'checkbox-selected', when: 'static', foreground: read('.iq-choice-box', 'background-color'), adjacent: background('.iq-choice') },
  }),
  pair({
    primitive: 'Choice', variant: 'checkbox', state: 'selected', part: 'check mark against box', foreground: 'white', adjacent: 'ink-900', kind: 'non-text',
    render: { hook: 'checkbox-selected', when: 'static', foreground: read('.iq-choice-check', 'stroke'), adjacent: read('.iq-choice-box', 'background-color') },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'unselected', part: 'label', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'card-group', when: 'static', foreground: color(`${UNSELECTED} .iq-choice-label`), adjacent: background(`${UNSELECTED} .iq-choice-label`) },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'unselected', part: 'description', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'card-group', when: 'static', foreground: color(`${UNSELECTED} .iq-choice-description`), adjacent: background(`${UNSELECTED} .iq-choice-description`) },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'unselected', part: 'radio boundary against surface', foreground: 'ink-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'card-group', when: 'static', foreground: border(`${UNSELECTED} .iq-choice-box`), adjacent: background(UNSELECTED) },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'label', foreground: 'text-primary', adjacent: 'blue-50', kind: 'text',
    render: { hook: 'card-group', when: 'static', foreground: color(`${SELECTED} .iq-choice-label`), adjacent: background(`${SELECTED} .iq-choice-label`) },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'description', foreground: 'text-muted', adjacent: 'blue-50', kind: 'text',
    render: { hook: 'card-group', when: 'static', foreground: color(`${SELECTED} .iq-choice-description`), adjacent: background(`${SELECTED} .iq-choice-description`) },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'card border against card', foreground: 'blue-600', adjacent: 'blue-50', kind: 'non-text',
    render: { hook: 'card-group', when: 'static', foreground: border(SELECTED), adjacent: read(SELECTED, 'background-color') },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'card border against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'card-group', when: 'static', foreground: border(SELECTED), adjacent: background(':scope') },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'radio boundary against card', foreground: 'blue-600', adjacent: 'blue-50', kind: 'non-text',
    render: { hook: 'card-group', when: 'static', foreground: border(`${SELECTED} .iq-choice-box`), adjacent: read(SELECTED, 'background-color') },
  }),
  pair({
    primitive: 'Choice', variant: 'card', state: 'selected', part: 'radio dot against inner ring', foreground: 'blue-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'card-group', when: 'static', foreground: read(`${SELECTED} .iq-choice-box`, 'background-color'), adjacent: read(`${SELECTED} .iq-choice-box`, 'box-shadow') },
  }),
  reasonPair('Choice', 'choice-disabled'),
  ...focusPairs('Choice', 'checkbox-unselected', '.iq-choice-box'),
];

export const CONTRAST_EXEMPT: readonly ContrastExemption[] = [
  ...(['Button', 'IconButton', 'TextField', 'Switch', 'Choice'] as const).map((primitive) => ({
    primitive, variant: 'any', state: 'disabled', part: 'control at the .45 disabled opacity', foreground: 'opacity 0.45' as const, adjacent: 'surface-app' as const,
    reason: 'Inactive user-interface components are exempt from WCAG 1.4.3 and 1.4.11; the disabled reason beside the control is measured as text instead.',
  })),
  {
    primitive: 'Button', variant: 'secondary', state: 'default', part: 'outline', foreground: 'action-secondary-border', adjacent: 'surface-app',
    reason: 'The text label identifies the control (WCAG 1.4.11 does not require a boundary for text buttons); the outline is decorative.',
  },
  {
    primitive: 'IconButton', variant: 'outline', state: 'default', part: 'outline', foreground: 'border-strong', adjacent: 'surface-app',
    reason: 'The measured icon identifies the control; the outline is decorative.',
  },
  {
    primitive: 'Switch', variant: 'off', state: 'default', part: 'thumb against off track', foreground: 'white', adjacent: 'ink-300',
    reason: 'State is carried by the visible On/Off text and aria-checked; the thumb position is supplementary. The track boundary is measured as ink-600.',
  },
  {
    primitive: 'Choice', variant: 'card', state: 'unselected', part: 'card border', foreground: 'border-default', adjacent: 'surface-app',
    reason: 'The radio or checkbox boundary inside the card (ink-600, measured) identifies the control; the card border is decorative.',
  },
  {
    primitive: 'Button', variant: 'any', state: 'focus-visible', part: 'blue-150 ring against surface', foreground: 'blue-150', adjacent: 'surface-app',
    reason: 'DESIGN.md keeps the pale ring supplementary; the blue-600 edge is the measured focus indicator.',
  },
];

export interface ContrastResult {
  id: string;
  primitive: ContrastPair['primitive'];
  variant: string;
  state: string;
  part: string;
  kind: ContrastKind;
  foreground: { token: ColorToken; value: string };
  adjacent: { token: ColorToken; value: string };
  ratio: number;
  threshold: number;
  pass: boolean;
  rendered: ContrastRender['when'] | 'token-only';
}

/** Every pair computed from the token values. */
export function computeTokenContrast(pairs: readonly ContrastPair[] = CONTRAST_PAIRS): ContrastResult[] {
  return pairs.map((entry) => {
    const foreground = colors[entry.foreground];
    const adjacent = colors[entry.adjacent];
    const ratio = contrastRatio(foreground, adjacent);
    const threshold = CONTRAST_THRESHOLDS[entry.kind];
    return {
      id: entry.id,
      primitive: entry.primitive,
      variant: entry.variant,
      state: entry.state,
      part: entry.part,
      kind: entry.kind,
      foreground: { token: entry.foreground, value: foreground },
      adjacent: { token: entry.adjacent, value: adjacent },
      ratio,
      threshold,
      pass: ratio >= threshold,
      rendered: entry.render ? entry.render.when : 'token-only',
    };
  });
}

/** One failure message per pair below its threshold, naming the pair and state. */
export function contrastFailures(results: readonly ContrastResult[]): string[] {
  return results
    .filter((result) => !result.pass)
    .map(
      (result) =>
        `${result.primitive} ${result.variant} ${result.state} ${result.part}: ${result.foreground.token} on ${result.adjacent.token} is ${result.ratio.toFixed(2)}:1, below ${result.threshold}:1`,
    );
}
