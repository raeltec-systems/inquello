/**
 * Story 1.6: contrast for every primitive × state, computed from tokens.
 *
 * Fails below 4.5:1 (text) or 3:1 (non-text), naming the pair and state.
 * Writes `evidence/contrast-primitives.json` when it is missing or when
 * `INQUELLO_WRITE_EVIDENCE=1`; otherwise the committed file must match.
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
    story: '1.6',
    source: 'src/renderer/design/contrast.ts (CONTRAST_PAIRS) over src/renderer/design/tokens.ts',
    method: 'WCAG 2.2 relative luminance; ratios unrounded. Text needs 4.5:1, non-text indicators and boundaries 3:1.',
    rendered: 'pnpm smoke re-reads every pair whose "rendered" is "static" or "focus" from computed styles in Chromium and prints the ratios in its design report; "token-only" pairs (hover, placeholder, sidebar placements) are recorded here only.',
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

describe('contrast evidence', () => {
  it('matches evidence/contrast-primitives.json', () => {
    const expected = evidence();
    if (process.env.INQUELLO_WRITE_EVIDENCE === '1' || !fs.existsSync(evidencePath)) {
      fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
      fs.writeFileSync(evidencePath, expected);
    }
    expect(fs.readFileSync(evidencePath, 'utf8'), 'evidence is stale: rerun with INQUELLO_WRITE_EVIDENCE=1 and commit it').toBe(expected);
  });
});
