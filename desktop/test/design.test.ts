/**
 * Story 1.5: the renderer's design layer equals DESIGN.md and the
 * design-system import.
 *
 * - Token maps equal the DESIGN.md frontmatter, compared both ways.
 * - Shadows and motion equal the Elevation & Depth table and paragraph.
 * - `tokens.css` declares exactly `cssVariables()`.
 * - Fonts are byte-identical to the import; icons match the source SVGs.
 * - `Icon` follows the accessibility matrix (rendered with react-dom/server).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { cssVariables, FONT_MONO, FONT_SANS, tokens } from '../src/renderer/design/tokens';
import { Icon, type IconProps } from '../src/renderer/icons/Icon';
import { ICON_NAMES, ICON_PATHS, type IconName } from '../src/renderer/icons/icon-paths';
import {
  evaluateDesign,
  EXPECTED_FONT_FACES,
  REQUIRED_FOCUS_HOOKS,
  type ContrastProbe,
  type DesignProbeResult,
  type FocusProbe,
  type MotionProbe,
  type MotionRead,
} from '../src/main/smoke-probe';

const desktop = path.resolve(__dirname, '..');
const renderer = path.join(desktop, 'src', 'renderer');
const designDir = path.resolve(desktop, '..', '_bmad-output', 'planning-artifacts', 'ux-designs', 'ux-inquello-2026-10-26');
const importDir = path.join(designDir, 'imports', 'inquello-design-system');
const designMd = fs.readFileSync(path.join(designDir, 'DESIGN.md'), 'utf8');

function frontmatter(): Record<string, any> {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(designMd);
  if (!match?.[1]) throw new Error('DESIGN.md has no frontmatter');
  return parseYaml(match[1]) as Record<string, any>;
}

/** Every key path whose value differs, or that exists on only one side. */
function drift(expected: unknown, actual: unknown, at = '', [source, target] = ['DESIGN.md', 'tokens']): string[] {
  const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
  if (isObject(expected) && isObject(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    return [...keys].flatMap((key) => {
      const where = at ? `${at}.${key}` : key;
      if (!(key in actual)) return [`${where}: missing from ${target}`];
      if (!(key in expected)) return [`${where}: not in ${source}`];
      return drift(expected[key], actual[key], where, [source, target]);
    });
  }
  return expected === actual ? [] : [`${at}: ${source} ${JSON.stringify(expected)} != ${target} ${JSON.stringify(actual)}`];
}

const sha256 = (file: string) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('DESIGN.md conformance', () => {
  const design = frontmatter();

  it.each(['colors', 'typography', 'rounded', 'spacing'] as const)('%s equals the frontmatter, both ways', (group) => {
    expect(drift(design[group], tokens[group], group)).toEqual([]);
  });

  it('icon equals components.Icon, both ways', () => {
    expect(drift(design.components.Icon, tokens.icon, 'components.Icon')).toEqual([]);
  });

  it('keeps the source aliases and the literal pill value', () => {
    expect(tokens.colors['text-faint']).toBe('#8a919a');
    expect(tokens.colors['status-accepted-fg']).toBe('#2f7a52');
    expect(tokens.rounded.pill).toBe('999px');
  });

  it('keeps the fallback stacks exactly', () => {
    expect(FONT_SANS).toBe("'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif");
    expect(FONT_MONO).toBe("'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace");
  });

  it('reports drift by key name', () => {
    expect(drift({ a: { b: '1px' } }, { a: { b: '2px', c: '3px' } }, 'x')).toEqual([
      'x.a.b: DESIGN.md "1px" != tokens "2px"',
      'x.a.c: not in DESIGN.md',
    ]);
  });
});

describe('shadow and motion values', () => {
  const elevation = designMd.slice(designMd.indexOf('## Elevation & Depth'), designMd.indexOf('## Shapes'));

  it('shadows equal the Elevation & Depth table, both ways', () => {
    const table: Record<string, string> = {};
    for (const row of elevation.matchAll(/^\| (\w+) \| `([^`]+)` \|/gm)) table[row[1]!] = row[2]!;
    expect(Object.keys(table)).toHaveLength(6);
    expect(drift(table, tokens.shadows, 'shadows')).toEqual([]);
  });

  it('motion equals the Elevation & Depth paragraph', () => {
    const timing = /timing is (\d+)\/(\d+)\/(\d+)ms with `(cubic-bezier\([^)]*\))` and an (\d+)ms (\w+) spinner/.exec(elevation);
    const pulse = /pulse varies opacity from ([\d.]+) to ([\d.]+) and back/.exec(elevation);
    expect(timing).not.toBeNull();
    expect(pulse).not.toBeNull();
    const bezier = (value: string) => value.replace(/\s+/g, '');
    expect({
      durationFast: `${timing![1]}ms`,
      durationBase: `${timing![2]}ms`,
      durationSlow: `${timing![3]}ms`,
      easeStandard: bezier(timing![4]!),
      spinDuration: `${timing![5]}ms`,
      spinEasing: timing![6],
      pulseOpacityFrom: pulse![1],
      pulseOpacityTo: pulse![2],
    }).toEqual({ ...tokens.motion, easeStandard: bezier(tokens.motion.easeStandard) });
    expect(tokens.motion.easeStandard).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
  });

  it('base.css spins and pulses with the motion values', () => {
    const base = fs.readFileSync(path.join(renderer, 'design', 'base.css'), 'utf8');
    expect(base).toContain('@keyframes iq-spin { to { transform: rotate(360deg); } }');
    expect(base).toContain(
      `@keyframes iq-pulse { 0%, 100% { opacity: ${tokens.motion.pulseOpacityFrom}; } 50% { opacity: ${tokens.motion.pulseOpacityTo}; } }`,
    );
  });
});

describe('tokens.css', () => {
  const css = fs.readFileSync(path.join(renderer, 'design', 'tokens.css'), 'utf8');

  it('declares exactly the variables of tokens.ts, both ways', () => {
    const declared: Record<string, string> = {};
    for (const match of css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) {
      expect(declared[match[1]!], `${match[1]} declared twice`).toBeUndefined();
      declared[match[1]!] = match[2]!.trim();
    }
    expect(drift(cssVariables(), declared, '', ['tokens.ts', 'tokens.css'])).toEqual([]);
  });

  it('uses the import’s source variable names', () => {
    const source = ['colors.css', 'typography.css', 'layout.css']
      .map((file) => fs.readFileSync(path.join(importDir, 'tokens', file), 'utf8'))
      .join('\n');
    const sourceNames = new Set([...source.matchAll(/^\s*(--[\w-]+):/gm)].map((match) => match[1]));
    const unknown = Object.keys(cssVariables()).filter((name) => !sourceNames.has(name));
    expect(unknown).toEqual([]);
  });

  it('has no dark theme', () => {
    for (const file of ['tokens.css', 'base.css', 'fonts.css', 'index.css']) {
      expect(fs.readFileSync(path.join(renderer, 'design', file), 'utf8')).not.toMatch(/prefers-color-scheme|\.dark\b|data-theme/);
    }
  });
});

describe('fonts', () => {
  const ours = path.join(renderer, 'design', 'assets', 'fonts');
  const theirs = path.join(importDir, 'assets', 'fonts');
  const woff2 = (dir: string) => fs.readdirSync(dir).filter((file) => file.endsWith('.woff2')).sort();

  it('copies the five WOFF2 files byte for byte', () => {
    expect(woff2(ours)).toEqual(woff2(theirs));
    expect(woff2(ours)).toHaveLength(5);
    for (const file of woff2(theirs)) expect(sha256(path.join(ours, file)), file).toBe(sha256(path.join(theirs, file)));
  });

  it('declares one swap @font-face per face, all local', () => {
    const css = fs.readFileSync(path.join(renderer, 'design', 'fonts.css'), 'utf8');
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => {
      const body = match[1]!;
      const prop = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1]?.trim();
      return {
        family: prop('font-family')?.replace(/'/g, ''),
        weight: Number(prop('font-weight')),
        style: prop('font-style'),
        display: prop('font-display'),
        src: prop('src'),
      };
    });
    expect(faces.map(({ family, weight }) => ({ family, weight })).sort((a, b) => `${a.family}${a.weight}`.localeCompare(`${b.family}${b.weight}`))).toEqual(
      [...EXPECTED_FONT_FACES].sort((a, b) => `${a.family}${a.weight}`.localeCompare(`${b.family}${b.weight}`)),
    );
    for (const face of faces) {
      expect(face.style).toBe('normal');
      expect(face.display).toBe('swap');
      const file = `${face.family!.replace(/ /g, '')}-${face.weight}.woff2`;
      expect(face.src).toBe(`url('./assets/fonts/${file}') format('woff2')`);
    }
    expect(css).not.toMatch(/https?:|\/\/fonts\./);
  });

  it('ships the licence texts', () => {
    // Vite copies src/renderer/public verbatim into dist/renderer, so these ship with every build.
    const licenses = path.join(renderer, 'public', 'licenses');
    expect(fs.readFileSync(path.join(licenses, 'IBM-Plex-OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(fs.readFileSync(path.join(licenses, 'LUCIDE-LICENSE.txt'), 'utf8')).toMatch(/^ISC License/);
  });
});

type ParsedElement = [string, Record<string, string>];

function parseElements(markup: string): ParsedElement[] {
  const withoutMetadata = markup.replace(/<metadata>[\s\S]*?<\/metadata>/g, '').replace(/<svg[^>]*>|<\/svg>/g, '');
  return [...withoutMetadata.matchAll(/<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/?>/g)].map((match) => [
    match[1]!,
    Object.fromEntries([...match[2]!.matchAll(/([\w-]+)="([^"]*)"/g)].map((attr) => [attr[1]!, attr[2]!])),
  ]);
}

describe('icon paths', () => {
  const svgDir = path.join(importDir, 'assets', 'icons');
  const svgNames = fs.readdirSync(svgDir).filter((file) => file.endsWith('.svg')).map((file) => file.slice(0, -4)).sort();
  const asData = (name: IconName) => ICON_PATHS[name].map(([tag, attrs]) => [tag, { ...attrs }]);

  it('has the same 40 names as the source SVGs', () => {
    expect([...ICON_NAMES].sort()).toEqual(svgNames);
    expect(ICON_NAMES).toHaveLength(40);
  });

  it.each(svgNames)('%s matches its source SVG', (name) => {
    expect(asData(name as IconName)).toEqual(parseElements(fs.readFileSync(path.join(svgDir, `${name}.svg`), 'utf8')));
  });

  it('matches the import’s icon-paths.js', () => {
    const source = fs.readFileSync(path.join(importDir, 'components', 'core', 'icon-paths.js'), 'utf8');
    const icons = JSON.parse(/export const ICONS = (\{[\s\S]*\});/.exec(source)![1]!) as Record<string, string>;
    expect(Object.keys(icons).sort()).toEqual([...ICON_NAMES].sort());
    for (const name of ICON_NAMES) expect(asData(name), name).toEqual(parseElements(icons[name]!));
  });
});

describe('Icon', () => {
  const render = (props: IconProps) => renderToStaticMarkup(createElement(Icon, props));

  afterEach(() => vi.restoreAllMocks());

  it('is decorative without a label: aria-hidden, no role, no label', () => {
    const html = render({ name: 'search' });
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role=');
    expect(html).not.toContain('aria-label');
  });

  it('is informative with a label: role="img" and aria-label', () => {
    const html = render({ name: 'triangle-alert', label: 'Needs evidence' });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Needs evidence"');
    expect(html).not.toContain('aria-hidden');
  });

  it('defaults to 16px, 1.75 stroke, currentColor and a 24×24 viewBox', () => {
    const html = render({ name: 'search' });
    expect(html).toMatch(/^<svg [^>]*width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/);
    expect(html).toContain('<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>');
  });

  it('honours size, stroke and colour overrides', () => {
    const html = render({ name: 'check', size: 14, strokeWidth: 2, color: '#2f7a52' });
    expect(html).toContain('width="14" height="14"');
    expect(html).toContain('stroke="#2f7a52" stroke-width="2"');
  });

  it('renders nothing for an unknown name and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const unknown = { name: 'not-an-icon' as IconName };
    expect(render(unknown)).toBe('');
    expect(render(unknown)).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('not-an-icon');
    // @ts-expect-error -- a name outside the 40 is a compile-time error.
    void render({ name: 'not-an-icon' });
  });

  it('builds React elements, never innerHTML', () => {
    const source = fs.readFileSync(path.join(renderer, 'icons', 'Icon.tsx'), 'utf8');
    expect(source).not.toMatch(/dangerouslySetInnerHTML|innerHTML/);
  });
});

describe('smoke design evaluation', () => {
  const loaded = EXPECTED_FONT_FACES.map(({ family, weight }) => ({ family, weight, declared: 1, statuses: ['loaded'], check: true }));
  const contrast: ContrastProbe[] = [
    { id: 'button.primary.default.label', kind: 'text', when: 'static', hook: 'button-primary', foreground: 'rgb(255, 255, 255)', adjacent: 'rgb(22, 25, 29)', error: null },
    { id: 'button.any.focus-visible.focus edge against ring', kind: 'non-text', when: 'focus', hook: 'button-primary', foreground: 'rgb(47, 95, 179)', adjacent: 'rgb(223, 231, 245)', error: null },
    { id: 'textfield.any.focus-visible.focus edge against field', kind: 'non-text', when: 'focus', hook: 'text-field', foreground: 'rgb(47, 95, 179)', adjacent: 'rgb(255, 255, 255)', error: null },
  ];
  /** The remaining required focus hooks (Story 1.7 adds the segmented control, the selected tab and the menu trigger; Story 1.8 the FileChip remove button and the ApprovalCard primary action). */
  const otherHooks = REQUIRED_FOCUS_HOOKS.filter((hook) => hook !== 'button-primary' && hook !== 'text-field');
  const otherContrast: ContrastProbe[] = otherHooks.map((hook) => ({
    id: `${hook}.focus edge against ring`, kind: 'non-text', when: 'focus', hook, foreground: 'rgb(47, 95, 179)', adjacent: 'rgb(223, 231, 245)', error: null,
  }));
  const ring = 'rgb(223, 231, 245) 0px 0px 0px 3px';
  const outlined = (hook: string): FocusProbe => ({
    hook, tag: 'button', focusVisible: true, indicator: { outlineStyle: 'solid', outlineWidth: '1px', outlineColor: 'rgb(47, 95, 179)', borderTopColor: 'rgb(22, 25, 29)', boxShadow: ring },
  });
  const focus: FocusProbe[] = [
    outlined('button-primary'),
    { hook: 'text-field', tag: 'input', focusVisible: true, indicator: { outlineStyle: 'none', outlineWidth: '0px', outlineColor: 'rgb(22, 25, 29)', borderTopColor: 'rgb(47, 95, 179)', boxShadow: ring } },
    ...otherHooks.map(outlined),
  ];
  const motionRead: MotionRead = { reducedMotion: false, animationName: 'iq-pulse', runningAnimations: 1, stateText: 'Running', stateVisible: true };
  const reducedRead: MotionRead = { reducedMotion: true, animationName: 'none', runningAnimations: 0, stateText: 'Running', stateVisible: true };
  const motion: MotionProbe = { motion: motionRead, reduced: reducedRead, error: null };
  const clean: DesignProbeResult = {
    title: 'Inquello',
    fonts: loaded,
    decorativeIcon: { 'aria-hidden': 'true', role: null, 'aria-label': null },
    informativeIcon: { 'aria-hidden': null, role: 'img', 'aria-label': 'Needs evidence' },
    contrast: [...contrast, ...otherContrast],
    focus,
    motion,
  };

  it('passes the specimen with five loaded faces, correct icon semantics, rendered contrast and visible focus', () => {
    const report = evaluateDesign(clean);
    expect(report).toMatchObject({ ok: true, failures: [] });
    expect(report.contrast.measured).toBe(3 + otherHooks.length);
    expect(report.focus.map((visit) => visit.hook)).toEqual(expect.arrayContaining(['tabs', 'menu-trigger', 'file-chip-remove', 'approval-primary']));
    expect(report.motion).toEqual(motion);
    expect(report.contrast.minimum).toBeCloseTo(4.95, 2);
  });

  it.each<[string, Partial<DesignProbeResult>]>([
    ['a face is still loading', { fonts: loaded.map((font, i) => (i === 2 ? { ...font, statuses: ['loading'] } : font)) }],
    ['a face is not declared', { fonts: loaded.slice(1) }],
    ['document.fonts.check fails', { fonts: loaded.map((font, i) => (i === 4 ? { ...font, check: false } : font)) }],
    ['the decorative icon has a role', { decorativeIcon: { 'aria-hidden': 'true', role: 'img', 'aria-label': null } }],
    ['the decorative icon is not hidden', { decorativeIcon: { 'aria-hidden': null, role: null, 'aria-label': null } }],
    ['the informative icon has no label', { informativeIcon: { 'aria-hidden': null, role: 'img', 'aria-label': null } }],
    ['an icon is missing', { informativeIcon: null }],
    ['the specimen declares no contrast pairs', { contrast: null }],
    ['a pair could not be read', { contrast: [{ ...contrast[0]!, foreground: null, error: 'hook button-primary is not rendered' }] }],
    ['a focus hook was never reached', { focus: focus.slice(0, 1) }],
    ['the menu trigger was never reached', { focus: focus.filter((visit) => visit.hook !== 'menu-trigger') }],
    ['the tabs declare no focus pairs', { contrast: [...contrast, ...otherContrast.filter((pair) => pair.hook !== 'tabs')], focus: focus.filter((visit) => visit.hook !== 'tabs') }],
    ['focus is not :focus-visible', { focus: [{ ...focus[0]!, focusVisible: false }, focus[1]!] }],
    ['focus shows no ring', { focus: [{ ...focus[0]!, indicator: { ...focus[0]!.indicator!, boxShadow: 'none' } }, focus[1]!] }],
    ['focus shows no edge', { focus: [focus[0]!, { ...focus[1]!, indicator: { ...focus[1]!.indicator!, borderTopColor: 'rgb(91, 99, 110)' } }] }],
    ['the FileChip remove button was never reached', { focus: focus.filter((visit) => visit.hook !== 'file-chip-remove') }],
    ['the ApprovalCard primary action was never reached', { focus: focus.filter((visit) => visit.hook !== 'approval-primary') }],
    ['the reduced-motion check did not run', { motion: undefined }],
    ['the reduced-motion check failed', { motion: { motion: null, reduced: null, error: 'no running plan step is rendered in plan-steps' } }],
    ['the running step still pulses under reduced motion', { motion: { ...motion, reduced: { ...reducedRead, animationName: 'iq-pulse', runningAnimations: 1 } } }],
    ['an animation keeps running under reduced motion', { motion: { ...motion, reduced: { ...reducedRead, runningAnimations: 1 } } }],
    ['reduced motion was not emulated', { motion: { ...motion, reduced: { ...reducedRead, reducedMotion: false } } }],
    ['the running step does not pulse with motion allowed', { motion: { ...motion, motion: { ...motionRead, animationName: 'none', runningAnimations: 0 } } }],
    ['"Running" is hidden under reduced motion', { motion: { ...motion, reduced: { ...reducedRead, stateVisible: false } } }],
    ['"Running" is missing under reduced motion', { motion: { ...motion, reduced: { ...reducedRead, stateText: null } } }],
  ])('fails when %s', (_label, change) => {
    expect(evaluateDesign({ ...clean, ...change }).ok).toBe(false);
  });

  it('fails a rendered pair below its threshold, naming the pair and state', () => {
    const faint = { ...contrast[0]!, id: 'button.ghost.default.label', foreground: 'rgb(138, 145, 154)', adjacent: 'rgb(255, 255, 255)' };
    const report = evaluateDesign({ ...clean, contrast: [...clean.contrast!, faint] });
    expect(report.ok).toBe(false);
    expect(report.failures).toEqual([
      'contrast button.ghost.default.label (static): rendered rgb(138, 145, 154) on rgb(255, 255, 255) is 3.18:1, below 4.5:1',
    ]);
  });

  it('applies the 3:1 non-text threshold itself', () => {
    const boundary: ContrastProbe = { id: 'switch.off.default.track', kind: 'non-text', when: 'static', hook: 'switch-off', foreground: 'rgb(214, 218, 222)', adjacent: 'rgb(255, 255, 255)', error: null };
    expect(evaluateDesign({ ...clean, contrast: [...clean.contrast!, boundary] }).failures[0]).toMatch(/below 3:1$/);
  });

  it('fails when the probe returned nothing', () => {
    expect(evaluateDesign(undefined).ok).toBe(false);
  });
});
