/**
 * Stories 1.6, 1.7 and 1.8: contrast for every primitive × state, computed from tokens.
 *
 * Fails below 4.5:1 (text) or 3:1 (non-text), naming the pair and state.
 * Writes `evidence/contrast-primitives.json` when it is missing or when
 * `INQUELLO_WRITE_EVIDENCE=1`; otherwise the committed file must match: every
 * category, pair, token and field exactly, ratios within a tiny floating-point
 * tolerance, and every recorded ratio must still meet its threshold.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTRAST_EXEMPT,
  CONTRAST_PAIRS,
  CONTRAST_THRESHOLDS,
  computeTokenContrast,
  contrastFailures,
  contrastRatio,
  relativeLuminance,
  type ContrastPair,
} from '../src/renderer/design/contrast';
import { colors } from '../src/renderer/design/tokens';
import { renderedContrastRatio } from '../src/main/smoke-probe';

const desktop = path.resolve(__dirname, '..');
const evidencePath = path.join(desktop, 'evidence', 'contrast-primitives.json');

function evidence(): string {
  const results = computeTokenContrast();
  const document = {
    kind: 'primitive-contrast-evidence',
    story: '1.6, 1.7, 1.8',
    source: 'src/renderer/design/contrast.ts (CONTRAST_PAIRS) over src/renderer/design/tokens.ts',
    method: 'WCAG 2.2 relative luminance; ratios unrounded. Text needs 4.5:1, non-text indicators and boundaries 3:1.',
    rendered: 'pnpm smoke re-reads every pair whose "rendered" is "static" or "focus" from computed styles in Chromium and prints the ratios in its design report; "token-only" pairs (hover, placeholder, sidebar placements, the agent symbol image, focus inside an open menu, a decision without a basis, focus on a transient toast) are recorded here only.',
    thresholds: CONTRAST_THRESHOLDS,
    summary: {
      pairs: results.length,
      passing: results.filter((result) => result.pass).length,
      rendered: results.filter((result) => result.rendered !== 'token-only').length,
      minimum: Math.min(...results.map((result) => result.ratio)),
    },
    pairs: results,
    exempt: CONTRAST_EXEMPT,
  };
  return `${JSON.stringify(document, null, 2)}\n`;
}

describe('contrast ratio', () => {
  it('matches the WCAG reference points', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.4781, 3);
  });

  it('is symmetric and accepts computed rgb() values', () => {
    expect(contrastRatio(colors['ink-600'], colors.white)).toBe(contrastRatio(colors.white, colors['ink-600']));
    expect(contrastRatio('rgb(91, 99, 110)', 'rgb(255, 255, 255)')).toBe(contrastRatio('#5b636e', '#ffffff'));
    expect(() => contrastRatio('rgba(0, 0, 0, 0)', '#ffffff')).toThrow(/not an opaque colour/);
  });

  it('reproduces the DESIGN.md measurements', () => {
    expect(contrastRatio(colors['text-muted'], colors.white).toFixed(2)).toBe('6.08');
    expect(contrastRatio(colors['text-muted'], colors['surface-sidebar']).toFixed(2)).toBe('5.52');
    expect(contrastRatio(colors['blue-600'], colors.white).toFixed(2)).toBe('6.16');
    expect(contrastRatio(colors['blue-600'], colors['surface-sidebar']).toFixed(2)).toBe('5.60');
    expect(contrastRatio(colors['blue-150'], colors.white).toFixed(2)).toBe('1.24');
  });

  it('agrees with the smoke probe’s copy for every token pair', () => {
    for (const entry of CONTRAST_PAIRS) {
      const toRgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;
      expect(renderedContrastRatio(toRgb(colors[entry.foreground]), toRgb(colors[entry.adjacent])), entry.id).toBe(
        contrastRatio(colors[entry.foreground], colors[entry.adjacent]),
      );
    }
  });
});

describe('primitive contrast pairs', () => {
  const results = computeTokenContrast();

  it('has unique ids', () => {
    expect(new Set(CONTRAST_PAIRS.map((entry) => entry.id)).size).toBe(CONTRAST_PAIRS.length);
  });

  it('covers every primitive in default, focus and disabled states', () => {
    for (const primitive of ['Button', 'IconButton', 'TextField', 'Switch', 'Choice'] as const) {
      const states = new Set(CONTRAST_PAIRS.filter((entry) => entry.primitive === primitive).map((entry) => entry.state));
      expect([...states], primitive).toEqual(expect.arrayContaining(['focus-visible', 'disabled']));
    }
    const buttonStates = (variant: string) => CONTRAST_PAIRS.filter((entry) => entry.primitive === 'Button' && entry.variant === variant).map((entry) => entry.state);
    for (const variant of ['primary', 'secondary', 'quiet', 'ghost']) {
      expect(buttonStates(variant), variant).toEqual(expect.arrayContaining(['default', 'hover', 'pending']));
    }
  });

  it('uses the essential ink-600 boundary for TextField, the Switch off state and unselected Choice', () => {
    const boundary = (primitive: string, variant: string, state: string) =>
      CONTRAST_PAIRS.filter((entry) => entry.primitive === primitive && entry.variant === variant && entry.state === state && entry.part.includes('boundary'));
    for (const [primitive, variant, state] of [
      ['TextField', 'single', 'default'],
      ['TextField', 'multiline', 'default'],
      ['Switch', 'off', 'default'],
      ['Choice', 'radio', 'unselected'],
      ['Choice', 'checkbox', 'unselected'],
    ] as const) {
      const pairs = boundary(primitive, variant, state);
      expect(pairs.length, `${primitive} ${variant} ${state}`).toBeGreaterThan(0);
      for (const entry of pairs) expect(entry.foreground, entry.id).toBe('ink-600');
    }
  });

  it('covers the Story 1.7 primitives, with focus on every keyboard composite', () => {
    const states = (primitive: string) => new Set(CONTRAST_PAIRS.filter((entry) => entry.primitive === primitive).map((entry) => entry.state));
    for (const primitive of ['Avatar', 'Badge', 'SegmentedControl', 'Tabs', 'Menu', 'StatusChip'] as const) {
      expect(states(primitive).size, primitive).toBeGreaterThan(0);
    }
    for (const primitive of ['SegmentedControl', 'Tabs', 'Menu'] as const) {
      expect([...states(primitive)], primitive).toContain('focus-visible');
    }
    expect([...states('Tabs')]).toEqual(expect.arrayContaining(['selected', 'unselected', 'hover']));
    expect([...states('SegmentedControl')]).toEqual(expect.arrayContaining(['selected', 'unselected', 'hover']));
    expect([...states('Menu')]).toEqual(expect.arrayContaining(['default', 'open', 'checked', 'disabled', 'focus']));
    const rendered = (hook: string) => CONTRAST_PAIRS.filter((entry) => entry.render?.when === 'focus' && entry.render.hook === hook);
    expect(rendered('tabs').length).toBeGreaterThan(0);
    expect(rendered('menu-trigger').length).toBeGreaterThan(0);
  });

  it('covers the Story 1.8 primitives: every PlanStep state, every DiffLine kind, both new focus hooks', () => {
    const of = (primitive: string) => CONTRAST_PAIRS.filter((entry) => entry.primitive === primitive);
    for (const primitive of ['JudgmentTag', 'FileChip', 'PlanStep', 'ApprovalCard', 'DiffLine', 'Toast'] as const) {
      expect(of(primitive).length, primitive).toBeGreaterThan(0);
    }
    expect(new Set(of('PlanStep').map((entry) => entry.state))).toEqual(new Set(['pending', 'running', 'done', 'blocked', 'failed', 'interrupted', 'any']));
    expect(new Set(of('DiffLine').map((entry) => entry.variant))).toEqual(new Set(['add', 'delete', 'change', 'context']));
    expect(new Set(of('JudgmentTag').filter((entry) => entry.part === 'kind label' && entry.render).map((entry) => entry.variant))).toEqual(
      new Set(['calculation', 'observation', 'suggestion', 'decision', 'gap']),
    );
    for (const state of ['failed', 'unreadable', 'permission-limited']) {
      const pairEntry = of('FileChip').find((entry) => entry.state === state);
      expect(pairEntry?.foreground, state).not.toBe('file-pdf');
      expect(pairEntry?.render, state).not.toBeNull();
    }
    const rendered = (hook: string) => CONTRAST_PAIRS.filter((entry) => entry.render?.when === 'focus' && entry.render.hook === hook);
    expect(rendered('file-chip-remove').length).toBeGreaterThan(0);
    expect(rendered('approval-primary').length).toBeGreaterThan(0);
  });

  it('measures the explicit text of all seven StatusChip source states, accepted and explained in green-800', () => {
    const chips = CONTRAST_PAIRS.filter((entry) => entry.primitive === 'StatusChip' && entry.part === 'label');
    expect(chips.map((entry) => entry.variant)).toEqual(['suggested', 'investigating', 'open', 'evidence', 'waiting', 'accepted', 'explained', 'other']);
    for (const variant of ['accepted', 'explained']) expect(chips.find((entry) => entry.variant === variant)?.foreground).toBe('green-800');
    for (const entry of chips) expect(entry.render, entry.id).not.toBeNull();
  });

  it('meets 4.5:1 for text and 3:1 for non-text on every pair', () => {
    expect(contrastFailures(results)).toEqual([]);
    for (const result of results) expect(result.threshold).toBe(result.kind === 'text' ? 4.5 : 3);
  });

  it('names the pair and state when a pair falls below its threshold', () => {
    const failing: ContrastPair = {
      id: 'switch.off.default.thumb',
      primitive: 'Switch',
      variant: 'off',
      state: 'default',
      part: 'thumb against off track',
      foreground: 'white',
      adjacent: 'ink-300',
      kind: 'non-text',
      render: null,
    };
    expect(contrastFailures(computeTokenContrast([failing]))).toEqual([
      'Switch off default thumb against off track: white on ink-300 is 1.67:1, below 3:1',
    ]);
  });

  it('records every exemption with a reason', () => {
    for (const exemption of CONTRAST_EXEMPT) expect(exemption.reason.length, exemption.part).toBeGreaterThan(20);
  });
});

/**
 * Relative tolerance for numbers in the evidence. Ratios are floating point:
 * the last digits of a computed value can differ between platforms and Node
 * versions (8.99580851260002 against 8.995808512600018), which says nothing
 * about contrast. Any real change to a token moves a ratio far more than this.
 */
const NUMBER_TOLERANCE = 1e-9;

/**
 * Where the committed evidence differs from the computed one: every key, every
 * array entry (so every category, pair and token) and every string exactly,
 * numbers within `NUMBER_TOLERANCE`.
 */
function evidenceDifferences(committed: unknown, computed: unknown, where = '$'): string[] {
  if (typeof committed === 'number' && typeof computed === 'number') {
    return Math.abs(committed - computed) <= NUMBER_TOLERANCE * Math.max(1, Math.abs(computed)) ? [] : [`${where}: ${committed} is not ${computed}`];
  }
  if (Array.isArray(committed) && Array.isArray(computed)) {
    if (committed.length !== computed.length) return [`${where}: ${committed.length} entries, not ${computed.length}`];
    return committed.flatMap((entry, index) => evidenceDifferences(entry, computed[index], `${where}[${index}]`));
  }
  if (typeof committed === 'object' && committed !== null && typeof computed === 'object' && computed !== null && !Array.isArray(committed) && !Array.isArray(computed)) {
    const a = committed as Record<string, unknown>;
    const b = computed as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    return keys.flatMap((key) => (key in a && key in b ? evidenceDifferences(a[key], b[key], `${where}.${key}`) : [`${where}.${key}: missing on one side`]));
  }
  return Object.is(committed, computed) ? [] : [`${where}: ${JSON.stringify(committed)} is not ${JSON.stringify(computed)}`];
}

/** Every recorded pair must meet the threshold for its kind, whatever the comparison above allows. */
function evidenceBelowThreshold(document: { pairs: Array<{ id: string; kind: string; ratio: number; threshold: number; pass: boolean }> }): string[] {
  return document.pairs.flatMap((pair) => {
    const threshold = pair.kind === 'text' ? CONTRAST_THRESHOLDS.text : CONTRAST_THRESHOLDS['non-text'];
    return pair.threshold === threshold && pair.ratio >= threshold && pair.pass ? [] : [`${pair.id}: ${pair.ratio} against ${threshold}`];
  });
}

describe('contrast evidence', () => {
  it('matches evidence/contrast-primitives.json', () => {
    const expected = evidence();
    if (process.env.INQUELLO_WRITE_EVIDENCE === '1' || !fs.existsSync(evidencePath)) {
      fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
      fs.writeFileSync(evidencePath, expected);
    }
    const committed = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    expect(evidenceDifferences(committed, JSON.parse(expected)), 'evidence is stale: rerun with INQUELLO_WRITE_EVIDENCE=1 and commit it').toEqual([]);
    expect(evidenceBelowThreshold(committed)).toEqual([]);
  });

  it('ignores floating-point noise but not a changed ratio, a missing pair or a ratio below its threshold (review R08)', () => {
    const computed = JSON.parse(evidence());
    const copy = () => JSON.parse(evidence());

    const noise = copy();
    for (const pair of noise.pairs) pair.ratio *= 1 + 4e-15;
    noise.summary.minimum *= 1 - 4e-15;
    expect(evidenceDifferences(noise, computed)).toEqual([]);

    const changed = copy();
    changed.pairs[0].ratio += 0.01;
    expect(evidenceDifferences(changed, computed)).toEqual([`$.pairs[0].ratio: ${changed.pairs[0].ratio} is not ${computed.pairs[0].ratio}`]);

    const missing = copy();
    missing.pairs.pop();
    expect(evidenceDifferences(missing, computed)).toEqual([`$.pairs: ${computed.pairs.length - 1} entries, not ${computed.pairs.length}`]);

    const token = copy();
    token.pairs[0].foreground.token = 'ink-300';
    expect(evidenceDifferences(token, computed)).toEqual(['$.pairs[0].foreground.token: "ink-300" is not "action-primary-fg"']);

    const below = copy();
    const pair = below.pairs.find((entry: { kind: string }) => entry.kind === 'non-text');
    pair.ratio = 2.99;
    expect(evidenceBelowThreshold(below)).toEqual([`${pair.id}: 2.99 against 3`]);
    // Even a computed result just under its threshold fails (no tolerance there).
    const nearly = copy();
    nearly.pairs[0].ratio = 4.5 - 1e-12;
    expect(evidenceBelowThreshold(nearly)).toEqual([`${nearly.pairs[0].id}: ${4.5 - 1e-12} against 4.5`]);
  });
});
