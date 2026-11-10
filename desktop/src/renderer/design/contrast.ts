/**
 * WCAG 2.2 contrast for the Story 1.6 action and input primitives, the
 * Story 1.7 navigation and identity primitives and the Story 1.8 progress and
 * proposed-action primitives.
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
  primitive:
    | 'Button'
    | 'IconButton'
    | 'TextField'
    | 'Switch'
    | 'Choice'
    | 'Avatar'
    | 'Badge'
    | 'SegmentedControl'
    | 'Tabs'
    | 'Menu'
    | 'StatusChip'
    | 'JudgmentTag'
    | 'FileChip'
    | 'PlanStep'
    | 'ApprovalCard'
    | 'DiffLine'
    | 'Toast';
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

type ToneInput = { variant: string; fg: ColorToken; bg: ColorToken };

/** Avatar person tones (existing colour tokens only) and the decided treatment. */
const AVATAR_TONES = [
  { variant: 'blue', fg: 'blue-600', bg: 'blue-150' },
  { variant: 'green', fg: 'green-600', bg: 'green-100' },
  { variant: 'amber', fg: 'amber-700', bg: 'amber-150' },
  { variant: 'decided', fg: 'white', bg: 'green-600' },
] as const satisfies readonly ToneInput[];

/** DESIGN.md `components.Badge` tones. */
const BADGE_TONES = [
  { variant: 'attention', fg: 'ink-900', bg: 'amber-500' },
  { variant: 'neutral', fg: 'text-secondary', bg: 'ink-150' },
  { variant: 'accent', fg: 'white', bg: 'blue-600' },
] as const satisfies readonly ToneInput[];

/** The seven source states plus a caller-labelled state; accepted and explained use green-800 text. */
const STATUS_CHIPS = [
  { variant: 'suggested', fg: 'status-suggested-fg', bg: 'white' },
  { variant: 'investigating', fg: 'status-investigating-fg', bg: 'status-investigating-bg' },
  { variant: 'open', fg: 'status-open-fg', bg: 'white' },
  { variant: 'evidence', fg: 'status-evidence-fg', bg: 'status-evidence-bg' },
  { variant: 'waiting', fg: 'status-evidence-fg', bg: 'white' },
  { variant: 'accepted', fg: 'green-800', bg: 'status-accepted-bg' },
  { variant: 'explained', fg: 'green-800', bg: 'status-accepted-bg' },
  { variant: 'other', fg: 'status-open-fg', bg: 'white' },
] as const satisfies readonly ToneInput[];

const SEGMENT_ON = '.iq-segment[aria-checked="true"]';
const SEGMENT_OFF = '.iq-segment[aria-checked="false"]';
const TAB_ON = '.iq-tab[aria-selected="true"]';
const TAB_OFF = '.iq-tab[aria-selected="false"]';
/** In the open specimen menu: available items (the first label or description found), and the checked radio item. */
const MENU_ITEM = '.iq-menu-item:not(.iq-menu-item--disabled)';
const MENU_CHECKED = '.iq-menu-item[aria-checked="true"]';

/** DESIGN.md `components.JudgmentTag` kind colours, all on the app surface. */
const JUDGMENT_KINDS = [
  { variant: 'calculation', fg: 'judgment-calculation' },
  { variant: 'observation', fg: 'judgment-observation' },
  { variant: 'suggestion', fg: 'judgment-suggestion' },
  { variant: 'decision', fg: 'judgment-decision' },
  { variant: 'gap', fg: 'judgment-gap' },
] as const satisfies ReadonlyArray<{ variant: string; fg: ColorToken }>;

/** FileChip type tags on the ink-50 chip; an unlisted type uses the muted folder colour. */
const FILE_TAGS = [
  { variant: 'pdf', fg: 'file-pdf' },
  { variant: 'xls', fg: 'file-xls' },
  { variant: 'doc', fg: 'file-doc' },
  { variant: 'folder', fg: 'file-folder' },
  { variant: 'other', fg: 'file-folder' },
] as const satisfies ReadonlyArray<{ variant: string; fg: ColorToken }>;

/** FileChip source states: their own text, red-800 or amber-800, never the PDF red-600. */
const FILE_STATES = [
  { variant: 'failed', fg: 'red-800' },
  { variant: 'unreadable', fg: 'amber-800' },
  { variant: 'permission-limited', fg: 'amber-800' },
] as const satisfies ReadonlyArray<{ variant: string; fg: ColorToken }>;

/** PlanStep: each state's indicator boundary and, where visible, its state text. */
const PLAN_STATES = [
  { variant: 'pending', boundary: 'ink-600', text: null },
  { variant: 'running', boundary: 'blue-600', text: 'blue-700' },
  { variant: 'done', boundary: 'green-600', text: null },
  { variant: 'blocked', boundary: 'amber-700', text: 'amber-800' },
  { variant: 'failed', boundary: 'red-600', text: 'red-800' },
  { variant: 'interrupted', boundary: 'ink-600', text: 'text-muted' },
] as const satisfies ReadonlyArray<{ variant: string; boundary: ColorToken; text: ColorToken | null }>;

/** DiffLine kinds: body and sign colours on each kind's fill. Context shows no sign. */
const DIFF_KINDS = [
  { variant: 'add', fg: 'diff-add-fg', sign: 'diff-add-fg', bg: 'diff-add-bg' },
  { variant: 'delete', fg: 'diff-del-fg', sign: 'diff-del-fg', bg: 'diff-del-bg' },
  { variant: 'change', fg: 'text-primary', sign: 'blue-600', bg: 'blue-50' },
  { variant: 'context', fg: 'text-secondary', sign: null, bg: 'white' },
] as const satisfies ReadonlyArray<{ variant: string; fg: ColorToken; sign: ColorToken | null; bg: ColorToken }>;

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

  // ---------- Story 1.7 ----------

  // Avatar: supplementary initials on each person disc; the agent symbol (an image file, so token-only).
  ...AVATAR_TONES.map(({ variant, fg, bg }) =>
    pair({
      primitive: 'Avatar', variant, state: 'default', part: 'initials', foreground: fg, adjacent: bg, kind: 'text',
      render: { hook: `avatar-${variant}`, when: 'static', foreground: color('.iq-avatar-initials'), adjacent: read('.iq-avatar', 'background-color') },
    }),
  ),
  pair({ primitive: 'Avatar', variant: 'agent', state: 'default', part: 'symbol against surface', foreground: 'ink-900', adjacent: 'surface-app', kind: 'non-text' }),
  pair({ primitive: 'Avatar', variant: 'agent', state: 'default', part: 'symbol against sidebar', foreground: 'ink-900', adjacent: 'surface-sidebar', kind: 'non-text' }),

  // Badge: the count on each tone's fill.
  ...BADGE_TONES.map(({ variant, fg, bg }) =>
    pair({
      primitive: 'Badge', variant, state: 'default', part: 'count', foreground: fg, adjacent: bg, kind: 'text',
      render: { hook: `badge-${variant}`, when: 'static', foreground: color('.iq-badge'), adjacent: read('.iq-badge', 'background-color') },
    }),
  ),

  // SegmentedControl: selected and unselected labels, the selected fill, focus.
  pair({
    primitive: 'SegmentedControl', variant: 'segment', state: 'selected', part: 'label', foreground: 'white', adjacent: 'ink-900', kind: 'text',
    render: { hook: 'segmented', when: 'static', foreground: color(SEGMENT_ON), adjacent: read(SEGMENT_ON, 'background-color') },
  }),
  pair({
    primitive: 'SegmentedControl', variant: 'segment', state: 'selected', part: 'fill against control', foreground: 'ink-900', adjacent: 'white', kind: 'non-text',
    render: { hook: 'segmented', when: 'static', foreground: read(SEGMENT_ON, 'background-color'), adjacent: read('.iq-segmented', 'background-color') },
  }),
  pair({
    primitive: 'SegmentedControl', variant: 'segment', state: 'unselected', part: 'label', foreground: 'text-muted', adjacent: 'white', kind: 'text',
    render: { hook: 'segmented', when: 'static', foreground: color(SEGMENT_OFF), adjacent: background(SEGMENT_OFF) },
  }),
  pair({ primitive: 'SegmentedControl', variant: 'segment', state: 'hover', part: 'label', foreground: 'text-muted', adjacent: 'ink-75', kind: 'text' }),
  ...focusPairs('SegmentedControl', 'segmented', SEGMENT_ON),

  // Tabs: selected and unselected labels and counts, the panel text, focus.
  pair({
    primitive: 'Tabs', variant: 'tab', state: 'selected', part: 'label', foreground: 'text-primary', adjacent: 'action-quiet-bg', kind: 'text',
    render: { hook: 'tabs', when: 'static', foreground: color(`${TAB_ON} .iq-tab-label`), adjacent: background(`${TAB_ON} .iq-tab-label`) },
  }),
  pair({
    primitive: 'Tabs', variant: 'tab', state: 'selected', part: 'count', foreground: 'text-muted', adjacent: 'action-quiet-bg', kind: 'text',
    render: { hook: 'tabs', when: 'static', foreground: color(`${TAB_ON} .iq-tab-count`), adjacent: background(`${TAB_ON} .iq-tab-count`) },
  }),
  pair({
    primitive: 'Tabs', variant: 'tab', state: 'unselected', part: 'label', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'tabs', when: 'static', foreground: color(`${TAB_OFF} .iq-tab-label`), adjacent: background(`${TAB_OFF} .iq-tab-label`) },
  }),
  pair({
    primitive: 'Tabs', variant: 'tab', state: 'unselected', part: 'count', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'tabs', when: 'static', foreground: color(`${TAB_OFF} .iq-tab-count`), adjacent: background(`${TAB_OFF} .iq-tab-count`) },
  }),
  pair({ primitive: 'Tabs', variant: 'tab', state: 'unselected', part: 'label on sidebar', foreground: 'text-muted', adjacent: 'surface-sidebar', kind: 'text' }),
  pair({ primitive: 'Tabs', variant: 'tab', state: 'hover', part: 'label', foreground: 'text-muted', adjacent: 'surface-hover', kind: 'text' }),
  pair({
    primitive: 'Tabs', variant: 'panel', state: 'selected', part: 'panel text', foreground: 'text-secondary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'tabs', when: 'static', foreground: color('.iq-tab-panel:not([hidden])'), adjacent: background('.iq-tab-panel:not([hidden])') },
  }),
  ...focusPairs('Tabs', 'tabs', TAB_ON),

  // Menu: the trigger, the heading, item label and description, the checkmark, the unavailable reason, focus.
  pair({
    primitive: 'Menu', variant: 'trigger', state: 'default', part: 'label', foreground: 'text-primary', adjacent: 'action-secondary-bg', kind: 'text',
    render: { hook: 'menu-trigger', when: 'static', foreground: color('.iq-menu-trigger'), adjacent: background('.iq-menu-trigger') },
  }),
  pair({
    primitive: 'Menu', variant: 'list', state: 'open', part: 'heading', foreground: 'text-muted', adjacent: 'white', kind: 'text',
    render: { hook: 'menu-open', when: 'static', foreground: color('.iq-menu-heading'), adjacent: background('.iq-menu-heading') },
  }),
  pair({
    primitive: 'Menu', variant: 'item', state: 'default', part: 'label', foreground: 'text-primary', adjacent: 'white', kind: 'text',
    render: { hook: 'menu-open', when: 'static', foreground: color(`${MENU_ITEM} .iq-menu-label`), adjacent: background(`${MENU_ITEM} .iq-menu-label`) },
  }),
  pair({
    primitive: 'Menu', variant: 'item', state: 'default', part: 'description', foreground: 'text-muted', adjacent: 'white', kind: 'text',
    render: { hook: 'menu-open', when: 'static', foreground: color(`${MENU_ITEM} .iq-menu-description`), adjacent: background(`${MENU_ITEM} .iq-menu-description`) },
  }),
  pair({ primitive: 'Menu', variant: 'item', state: 'hover', part: 'label', foreground: 'text-primary', adjacent: 'ink-75', kind: 'text' }),
  pair({ primitive: 'Menu', variant: 'item', state: 'hover', part: 'description', foreground: 'text-muted', adjacent: 'ink-75', kind: 'text' }),
  pair({
    primitive: 'Menu', variant: 'radio', state: 'checked', part: 'checkmark', foreground: 'blue-600', adjacent: 'white', kind: 'non-text',
    render: { hook: 'menu-open', when: 'static', foreground: read(`${MENU_CHECKED} .iq-menu-check svg`, 'stroke'), adjacent: background(`${MENU_CHECKED} .iq-menu-check`) },
  }),
  pair({ primitive: 'Menu', variant: 'radio', state: 'checked hover', part: 'checkmark', foreground: 'blue-600', adjacent: 'ink-75', kind: 'non-text' }),
  pair({ primitive: 'Menu', variant: 'item', state: 'focus', part: 'focus edge against list', foreground: 'blue-600', adjacent: 'white', kind: 'non-text' }),
  pair({ primitive: 'Menu', variant: 'item', state: 'focus', part: 'focus edge against hover fill', foreground: 'blue-600', adjacent: 'ink-75', kind: 'non-text' }),
  reasonPair('Menu', 'menu-open'),
  ...focusPairs('Menu', 'menu-trigger', '.iq-menu-trigger'),

  // StatusChip: the explicit text of every source state, the dashed suggestion outline, and a caller-labelled state.
  ...STATUS_CHIPS.map(({ variant, fg, bg }) =>
    pair({
      primitive: 'StatusChip', variant, state: 'default', part: 'label', foreground: fg, adjacent: bg, kind: 'text',
      render: { hook: `status-${variant}`, when: 'static', foreground: color('.iq-status-chip'), adjacent: background('.iq-status-chip') },
    }),
  ),
  pair({
    primitive: 'StatusChip', variant: 'suggested', state: 'default', part: 'dashed outline against surface', foreground: 'status-suggested-border', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'status-suggested', when: 'static', foreground: border('.iq-status-chip'), adjacent: background(':scope') },
  }),
  pair({ primitive: 'StatusChip', variant: 'suggested', state: 'default', part: 'dashed outline against sidebar', foreground: 'status-suggested-border', adjacent: 'surface-sidebar', kind: 'non-text' }),
  // The optional decision disc: white initials on green-600.
  pair({
    primitive: 'StatusChip', variant: 'decision', state: 'default', part: 'decision initials', foreground: 'white', adjacent: 'green-600', kind: 'text',
    render: { hook: 'status-decided', when: 'static', foreground: color('.iq-status-decision'), adjacent: background('.iq-status-decision') },
  }),

  // ---------- Story 1.8 ----------

  // JudgmentTag: each kind's label (and text glyph) on the surface, the shaped marks, the basis and the claim.
  ...JUDGMENT_KINDS.map(({ variant, fg }) =>
    pair({
      primitive: 'JudgmentTag', variant, state: 'default', part: 'kind label', foreground: fg, adjacent: 'surface-app', kind: 'text',
      render: { hook: `judgment-${variant}`, when: 'static', foreground: color('.iq-judgment-kind'), adjacent: background('.iq-judgment-kind') },
    }),
  ),
  pair({
    primitive: 'JudgmentTag', variant: 'suggestion', state: 'default', part: 'dashed box against surface', foreground: 'judgment-suggestion', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'judgment-suggestion', when: 'static', foreground: border('.iq-judgment-mark'), adjacent: background('.iq-judgment-mark') },
  }),
  pair({
    primitive: 'JudgmentTag', variant: 'decision', state: 'default', part: 'dot against surface', foreground: 'judgment-decision', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'judgment-decision', when: 'static', foreground: read('.iq-judgment-mark', 'background-color'), adjacent: background(':scope') },
  }),
  pair({
    primitive: 'JudgmentTag', variant: 'decision', state: 'default', part: 'basis', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'judgment-decision', when: 'static', foreground: color('.iq-judgment-basis'), adjacent: background('.iq-judgment-basis') },
  }),
  pair({ primitive: 'JudgmentTag', variant: 'decision', state: 'basis missing', part: 'kind label', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text' }),
  pair({
    primitive: 'JudgmentTag', variant: 'any', state: 'default', part: 'claim', foreground: 'text-primary', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'judgment-calculation', when: 'static', foreground: color('.iq-judgment-claim'), adjacent: background('.iq-judgment-claim') },
  }),

  // FileChip: type tags, the name, the remove glyph, the state texts and the remove button's focus.
  ...FILE_TAGS.map(({ variant, fg }) =>
    pair({
      primitive: 'FileChip', variant, state: 'default', part: 'type tag', foreground: fg, adjacent: 'ink-50', kind: 'text',
      render: { hook: `file-${variant}`, when: 'static', foreground: color('.iq-file-chip-tag'), adjacent: background('.iq-file-chip-tag') },
    }),
  ),
  pair({
    primitive: 'FileChip', variant: 'any', state: 'default', part: 'name', foreground: 'text-primary', adjacent: 'ink-50', kind: 'text',
    render: { hook: 'file-pdf', when: 'static', foreground: color('.iq-file-chip-name'), adjacent: background('.iq-file-chip-name') },
  }),
  pair({
    primitive: 'FileChip', variant: 'removable', state: 'default', part: 'remove glyph', foreground: 'text-muted', adjacent: 'ink-50', kind: 'non-text',
    render: { hook: 'file-chip-remove', when: 'static', foreground: color('.iq-file-chip-remove'), adjacent: background('.iq-file-chip-remove') },
  }),
  pair({ primitive: 'FileChip', variant: 'removable', state: 'hover', part: 'remove glyph', foreground: 'text-muted', adjacent: 'surface-hover', kind: 'non-text' }),
  ...FILE_STATES.map(({ variant, fg }) =>
    pair({
      primitive: 'FileChip', variant, state: variant, part: 'state text', foreground: fg, adjacent: 'ink-50', kind: 'text',
      render: { hook: `file-${variant}`, when: 'static', foreground: color('.iq-file-chip-state'), adjacent: background('.iq-file-chip-state') },
    }),
  ),
  pair({
    primitive: 'FileChip', variant: 'removable', state: 'focus-visible', part: 'focus edge against ring', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text',
    render: { hook: 'file-chip-remove', when: 'focus', foreground: read('.iq-file-chip-remove', 'outline-color'), adjacent: read('.iq-file-chip-remove', 'box-shadow') },
  }),
  pair({
    primitive: 'FileChip', variant: 'removable', state: 'focus-visible', part: 'focus edge against chip', foreground: 'blue-600', adjacent: 'ink-50', kind: 'non-text',
    render: { hook: 'file-chip-remove', when: 'focus', foreground: read('.iq-file-chip-remove', 'outline-color'), adjacent: background('.iq-file-chip') },
  }),
  pair({
    primitive: 'FileChip', variant: 'removable', state: 'focus-visible', part: 'focus edge against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'file-chip-remove', when: 'focus', foreground: read('.iq-file-chip-remove', 'outline-color'), adjacent: background(':scope') },
  }),

  // PlanStep: every state's indicator boundary and text; the running fill, the done check, the done label and the meta.
  ...PLAN_STATES.flatMap(({ variant, boundary, text }) => {
    const step = `.iq-plan-step--${variant}`;
    return [
      pair({
        primitive: 'PlanStep', variant: 'step', state: variant, part: 'indicator against surface', foreground: boundary, adjacent: 'surface-app', kind: 'non-text',
        render: { hook: 'plan-steps', when: 'static', foreground: border(`${step} .iq-plan-step-indicator`), adjacent: background(step) },
      }),
      pair({
        primitive: 'PlanStep', variant: 'step', state: variant, part: 'label', foreground: variant === 'done' ? 'text-muted' : 'text-primary', adjacent: 'surface-app', kind: 'text',
        render: { hook: 'plan-steps', when: 'static', foreground: color(`${step} .iq-plan-step-label`), adjacent: background(`${step} .iq-plan-step-label`) },
      }),
      ...(text === null
        ? []
        : [
            pair({
              primitive: 'PlanStep', variant: 'step', state: variant, part: 'state text', foreground: text, adjacent: 'surface-app', kind: 'text',
              render: { hook: 'plan-steps', when: 'static', foreground: color(`${step} .iq-plan-step-state`), adjacent: background(`${step} .iq-plan-step-state`) },
            }),
          ]),
    ];
  }),
  pair({
    primitive: 'PlanStep', variant: 'step', state: 'running', part: 'indicator against its fill', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text',
    render: { hook: 'plan-steps', when: 'static', foreground: border('.iq-plan-step--running .iq-plan-step-indicator'), adjacent: read('.iq-plan-step--running .iq-plan-step-indicator', 'background-color') },
  }),
  pair({
    primitive: 'PlanStep', variant: 'step', state: 'done', part: 'check against marker', foreground: 'white', adjacent: 'green-600', kind: 'non-text',
    render: { hook: 'plan-steps', when: 'static', foreground: read('.iq-plan-step--done .iq-plan-step-indicator svg', 'stroke'), adjacent: read('.iq-plan-step--done .iq-plan-step-indicator', 'background-color') },
  }),
  pair({
    primitive: 'PlanStep', variant: 'step', state: 'any', part: 'meta', foreground: 'text-muted', adjacent: 'surface-app', kind: 'text',
    render: { hook: 'plan-steps', when: 'static', foreground: color('.iq-plan-step-meta'), adjacent: background('.iq-plan-step-meta') },
  }),

  // ApprovalCard: overline, context, action, facts and quote on the amber-50 card; the actions; focus on the card.
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'overline', foreground: 'amber-700', adjacent: 'approval-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-overline'), adjacent: background('.iq-approval-overline') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'context', foreground: 'text-muted', adjacent: 'approval-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-context'), adjacent: background('.iq-approval-context') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'action', foreground: 'text-primary', adjacent: 'approval-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-action'), adjacent: background('.iq-approval-action') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'fact term', foreground: 'text-muted', adjacent: 'approval-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-fact dt'), adjacent: background('.iq-approval-fact dt') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'fact value', foreground: 'text-primary', adjacent: 'approval-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-fact dd'), adjacent: background('.iq-approval-fact dd') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'quoted content', foreground: 'text-muted', adjacent: 'white', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-approval-quote'), adjacent: background('.iq-approval-quote') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'primary action', state: 'default', part: 'label', foreground: 'action-primary-fg', adjacent: 'action-primary-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-button--primary'), adjacent: background('.iq-button--primary') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'alternative action', state: 'default', part: 'label', foreground: 'text-primary', adjacent: 'action-secondary-bg', kind: 'text',
    render: { hook: 'approval', when: 'static', foreground: color('.iq-button--secondary'), adjacent: background('.iq-button--secondary') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'primary action', state: 'focus-visible', part: 'focus edge against ring', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text',
    render: { hook: 'approval-primary', when: 'focus', foreground: read('.iq-button--primary', 'outline-color'), adjacent: read('.iq-button--primary', 'box-shadow') },
  }),
  pair({
    primitive: 'ApprovalCard', variant: 'primary action', state: 'focus-visible', part: 'focus edge against card', foreground: 'blue-600', adjacent: 'approval-bg', kind: 'non-text',
    render: { hook: 'approval-primary', when: 'focus', foreground: read('.iq-button--primary', 'outline-color'), adjacent: background('.iq-approval') },
  }),

  // DiffLine: body, sign, gutter and stage text on each kind's fill.
  ...DIFF_KINDS.flatMap(({ variant, fg, sign, bg }) => {
    const line = `.iq-diff-line--${variant}`;
    return [
      pair({
        primitive: 'DiffLine', variant, state: 'default', part: 'body', foreground: fg, adjacent: bg, kind: 'text',
        render: { hook: 'diff', when: 'static', foreground: color(`${line} .iq-diff-body`), adjacent: background(`${line} .iq-diff-body`) },
      }),
      ...(sign === null
        ? []
        : [
            pair({
              primitive: 'DiffLine', variant, state: 'default', part: 'sign', foreground: sign, adjacent: bg, kind: 'text',
              render: { hook: 'diff', when: 'static', foreground: color(`${line} .iq-diff-sign`), adjacent: background(`${line} .iq-diff-sign`) },
            }),
          ]),
      pair({
        primitive: 'DiffLine', variant, state: 'default', part: 'gutter', foreground: 'text-muted', adjacent: bg, kind: 'text',
        render: { hook: 'diff', when: 'static', foreground: color(`${line} .iq-diff-gutter`), adjacent: background(`${line} .iq-diff-gutter`) },
      }),
      pair({
        primitive: 'DiffLine', variant, state: 'default', part: 'stage text', foreground: 'text-muted', adjacent: bg, kind: 'text',
        render: { hook: 'diff', when: 'static', foreground: color(`${line} .iq-diff-stage`), adjacent: background(`${line} .iq-diff-stage`) },
      }),
    ];
  }),

  // Toast: white text on ink-900, and the ink fill against the surface; focus on a transient toast is token-only.
  pair({
    primitive: 'Toast', variant: 'toast', state: 'default', part: 'message', foreground: 'white', adjacent: 'ink-900', kind: 'text',
    render: { hook: 'toast', when: 'static', foreground: color('.iq-toast'), adjacent: background('.iq-toast') },
  }),
  pair({
    primitive: 'Toast', variant: 'toast', state: 'default', part: 'fill against surface', foreground: 'ink-900', adjacent: 'surface-app', kind: 'non-text',
    render: { hook: 'toast', when: 'static', foreground: read('.iq-toast', 'background-color'), adjacent: background(':scope') },
  }),
  pair({ primitive: 'Toast', variant: 'transient', state: 'focus-visible', part: 'focus edge against surface', foreground: 'blue-600', adjacent: 'surface-app', kind: 'non-text' }),
  pair({ primitive: 'Toast', variant: 'transient', state: 'focus-visible', part: 'focus edge against ring', foreground: 'blue-600', adjacent: 'blue-150', kind: 'non-text' }),
];

export const CONTRAST_EXEMPT: readonly ContrastExemption[] = [
  ...(['Button', 'IconButton', 'TextField', 'Switch', 'Choice', 'Menu'] as const).map((primitive) => ({
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
  // Story 1.7.
  {
    primitive: 'Avatar', variant: 'person', state: 'default', part: 'disc against surface', foreground: 'blue-150', adjacent: 'surface-app',
    reason: 'The required name is the accessible identity and the initials are measured against the disc; the disc outline itself carries no information.',
  },
  {
    primitive: 'Badge', variant: 'attention', state: 'default', part: 'fill against surface', foreground: 'amber-500', adjacent: 'surface-app',
    reason: 'The count text is measured against its fill and the accessible text names what is counted; the fill edge carries no further information.',
  },
  {
    primitive: 'SegmentedControl', variant: 'control', state: 'default', part: 'outline', foreground: 'border-strong', adjacent: 'surface-app',
    reason: 'Each segment is identified by its measured text label; the outline around the group is decorative.',
  },
  {
    primitive: 'Tabs', variant: 'tab', state: 'selected', part: 'quiet fill against surface', foreground: 'action-quiet-bg', adjacent: 'surface-app',
    reason: 'Selection is carried by aria-selected and by the weight-500 text-primary label against weight-400 muted labels; the pale fill is supplementary, as DESIGN.md specifies it.',
  },
  {
    primitive: 'Menu', variant: 'list', state: 'open', part: 'border against surface', foreground: 'border-strong', adjacent: 'surface-app',
    reason: 'The floating list is identified by its measured item text and the popover shadow; the pale border is decorative.',
  },
  ...(['open', 'investigating', 'evidence', 'waiting', 'accepted', 'explained'] as const).map((variant) => ({
    primitive: 'StatusChip' as const, variant, state: 'default', part: 'border and fill against surface',
    foreground: ({ open: 'status-open-border', investigating: 'status-investigating-bg', evidence: 'status-evidence-border', waiting: 'status-evidence-border', accepted: 'status-accepted-border', explained: 'status-accepted-border' } as const)[variant],
    adjacent: 'surface-app' as const,
    reason: 'The explicit visible text names the state and is measured; the chip border and fill are supplementary.',
  })),
  // Story 1.8.
  {
    primitive: 'FileChip', variant: 'any', state: 'default', part: 'chip border against surface', foreground: 'border-default', adjacent: 'surface-app',
    reason: 'The chip is identified by its measured name and type tag; its border is decorative. The remove control is a labelled button whose glyph is measured.',
  },
  {
    primitive: 'PlanStep', variant: 'step', state: 'running', part: 'pulsing inner dot', foreground: 'blue-600', adjacent: 'blue-150',
    reason: 'The dot animates between opacity 1 and 0.3 and is supplementary: the still blue-600 boundary and the visible "Running" text carry the state, and both are measured.',
  },
  {
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'card border against surface', foreground: 'approval-border', adjacent: 'surface-app',
    reason: 'The card is a labelled region identified by its measured overline and text; the amber-200 border and amber-50 fill are supplementary.',
  },
  {
    primitive: 'ApprovalCard', variant: 'card', state: 'default', part: 'quote border against quote', foreground: 'approval-border', adjacent: 'white',
    reason: 'The quoted content is measured text; the border around it is decorative.',
  },
  ...(['add', 'delete', 'change'] as const).map((variant) => ({
    primitive: 'DiffLine' as const, variant, state: 'default', part: 'row fill against surface',
    foreground: ({ add: 'diff-add-bg', delete: 'diff-del-bg', change: 'blue-50' } as const)[variant],
    adjacent: 'surface-app' as const,
    reason: 'The kind is carried by the measured sign and the accessible kind text; the pale row fill is supplementary.',
  })),
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
