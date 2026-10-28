/**
 * `--smoke` renderer privilege probe (AD-5).
 *
 * Runs a script in the live renderer's main world and reports what the page
 * can reach: Node globals, the exact `window.inquello` tree, the result of
 * `runtime.getStatus`, and whether `window.open`, `fetch` and a top-level
 * navigation get through. `evaluatePrivileges` is pure and decides pass/fail.
 *
 * The same script also reads the Story 1.5 design specimen: whether each of
 * the five IBM Plex faces is loaded (`FontFace.status` and
 * `document.fonts.check`), and the accessibility attributes of the decorative
 * and informative icons. `evaluateDesign` is pure and decides pass/fail.
 *
 * Story 1.6 adds the primitives: the specimen declares its contrast pairs in
 * `data-contrast-pairs` and marks each rendered state with a `data-contrast`
 * hook. The probe reads the computed foreground and adjacent colours of every
 * static pair, then presses Tab through the page and, on each focus hook,
 * reads `:focus-visible` and the focus-indicator colours. `evaluateDesign`
 * computes the rendered ratios and fails below 4.5:1 (text) or 3:1 (non-text)
 * or when a focus hook was not reached with a visible indicator.
 *
 * Story 1.7 adds Avatar, Badge, SegmentedControl, Tabs, Menu and StatusChip
 * pairs through the same declaration. Main does not trust the page to declare
 * its focus hooks: `REQUIRED_FOCUS_HOOKS` must all be declared and reached,
 * including the selected tab and the menu trigger.
 *
 * Story 1.8 adds JudgmentTag, FileChip, PlanStep, ApprovalCard, DiffLine and
 * Toast pairs, and two required focus hooks: the FileChip remove button and the
 * ApprovalCard primary action. It also checks motion through
 * `webContents.debugger`: with `Emulation.setEmulatedMedia` it reads the
 * running PlanStep's pulse under `prefers-reduced-motion: no-preference`
 * (animating) and `reduce` (stopped), and its "Running" text in both.
 * `evaluateDesign` fails when the animation does not stop or the text is not
 * visible.
 *
 * Story 1.10b adds the identity probe (`probeIdentity`). Without
 * `INQUELLO_SERVICE_CONFIG` it checks that the Account block shows the shared
 * service as not configured, signed out, with private work local. With it, the
 * probe presses the Account block's Sign in (main signs in through the
 * headless opener), requires `signed-in` with `os-backed` storage, checks the
 * encrypted vault file (mode 0600, no secret in plaintext), dumps what the
 * renderer can see (identity results, the DOM, string globals, web storage,
 * cookies, URL) and searches it in main for every secret the session handled,
 * then presses Sign out and requires `signed-out` with the file removed.
 * Secrets never cross into the renderer for the comparison. `evaluateIdentity`
 * is pure and decides pass/fail.
 *
 * Story 1.12 adds the data probe (`probeData`). It checks that the register
 * loaded with no unknown rule, that the runtime home sits under userData and
 * is the home the runtime reported in its handshake, and that every held file
 * is classified (after adding a synthetic session file). It reads the Local
 * data block and `data.getPolicy` from the renderer and checks that a path
 * passed to `data.export` is rejected. It then exports through the data
 * service (into a temp folder), reimports into fresh temp roots, and requires
 * every included file to come back byte-identical with the identity session
 * and the Chromium profile declared as omissions. `evaluateData` is pure and
 * decides pass/fail.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { WebContents } from 'electron';

import { digestFile, exportedFilePath, governedRoots, importData, isInside, readManifest, ruleBlockers, takeInventory, type DataService, type GovernedRoots } from './data';
import type { IdentityWiring } from './identity';
import type { BlockedKind } from './security/policy';

const PROBE_TARGET = 'https://example.com/';
const NAVIGATION_SETTLE_MS = 500;
/** How long the probe waits for the specimen to render and its fonts to load. */
const DESIGN_SETTLE_MS = 5_000;

/** The five self-hosted faces the renderer must load. */
export const EXPECTED_FONT_FACES = [
  { family: 'IBM Plex Sans', weight: 400 },
  { family: 'IBM Plex Sans', weight: 500 },
  { family: 'IBM Plex Sans', weight: 600 },
  { family: 'IBM Plex Mono', weight: 400 },
  { family: 'IBM Plex Mono', weight: 500 },
] as const;

/** The specimen's informative icon label (`<Icon name="triangle-alert" label=… />`). */
export const EXPECTED_ICON_LABEL = 'Needs evidence';

/** WCAG thresholds by pair kind; main applies them itself rather than trusting the page. */
export const RENDERED_THRESHOLDS = { text: 4.5, 'non-text': 3 } as const;
/** Focus hooks the specimen must declare and Tab must reach with a visible indicator. */
export const REQUIRED_FOCUS_HOOKS = [
  'button-primary',
  'icon-button-ghost',
  'text-field',
  'switch-off',
  'checkbox-unselected',
  'segmented',
  'tabs',
  'menu-trigger',
  'file-chip-remove',
  'approval-primary',
] as const;
/** Upper bound on Tab presses while looking for the focus hooks. */
const MAX_TABS = 120;
/** The specimen hook holding the running PlanStep whose pulse must stop under reduced motion. */
export const MOTION_HOOK = 'plan-steps';
/** The visible text a running step keeps with or without motion. */
export const RUNNING_TEXT = 'Running';
/** The keyframes the running step's dot uses while motion is allowed. */
export const RUNNING_ANIMATION = 'iq-pulse';
const MOTION_SETTLE_MS = 100;
const TAB_SETTLE_MS = 50;

/** The tree `window.inquello` must expose, as `describe` renders it. */
export const EXPECTED_BRIDGE_TREE = {
  runtime: { getStatus: 'function' },
  identity: { getStatus: 'function', signIn: 'function', signOut: 'function' },
  data: { getPolicy: 'function', export: 'function', import: 'function', delete: 'function' },
} as const;

/** Globals that must not exist in the renderer's main world. */
export const FORBIDDEN_GLOBALS = ['require', 'process', 'module', 'exports', 'Buffer', 'global', 'ipcRenderer', 'electron'] as const;

/**
 * Page-side helpers: `readPair` resolves a pair's two style reads inside its
 * hook and returns the computed colours, refusing translucent results.
 */
const STYLE_READERS = `
  const colourOf = (raw) => { const match = /rgba?\\([^)]*\\)/.exec(raw || ''); return match ? match[0] : null; };
  const alphaOf = (colour) => { const parts = colour.slice(colour.indexOf('(') + 1, -1).split(/[\\s,\\/]+/).filter(Boolean); return parts.length > 3 ? Number(parts[3]) : 1; };
  const opacityOf = (element) => { let product = 1; for (let node = element; node; node = node.parentElement) product *= Number(getComputedStyle(node).opacity); return product; };
  const readStyle = (hookElement, spec) => {
    const element = spec.selector === ':scope' ? hookElement : hookElement.querySelector(spec.selector);
    if (!element) return { error: 'no element matches ' + spec.selector };
    const opacity = opacityOf(element);
    if (opacity !== 1) return { error: spec.selector + ' is rendered at opacity ' + opacity };
    if (spec.effective) {
      for (let node = element; node; node = node.parentElement) {
        const colour = colourOf(getComputedStyle(node).backgroundColor);
        if (!colour) continue;
        const alpha = alphaOf(colour);
        if (alpha === 1) return { value: colour };
        if (alpha > 0) return { error: spec.selector + ' sits on a translucent background ' + colour };
      }
      return { error: spec.selector + ' has no opaque background' };
    }
    const colour = colourOf(getComputedStyle(element).getPropertyValue(spec.property));
    if (!colour) return { error: spec.selector + ' ' + spec.property + ' has no colour' };
    if (alphaOf(colour) !== 1) return { error: spec.selector + ' ' + spec.property + ' is translucent ' + colour };
    return { value: colour };
  };
  const readPair = (pair) => {
    const hook = document.querySelector('[data-contrast~="' + pair.render.hook + '"]');
    const base = { id: pair.id, kind: pair.kind, when: pair.render.when, hook: pair.render.hook, foreground: null, adjacent: null, error: null };
    if (!hook) return { ...base, error: 'hook ' + pair.render.hook + ' is not rendered' };
    const foreground = readStyle(hook, pair.render.foreground);
    const adjacent = readStyle(hook, pair.render.adjacent);
    return { ...base, foreground: foreground.value || null, adjacent: adjacent.value || null, error: foreground.error || adjacent.error || null };
  };
  const declaredPairs = () => {
    const holder = document.querySelector('[data-contrast-pairs]');
    return holder ? JSON.parse(holder.getAttribute('data-contrast-pairs')) : null;
  };
`;

/** Reads the focused element: which focus hook holds it, `:focus-visible`, and that hook's focus pairs. */
const FOCUS_PROBE = `(() => {
  ${STYLE_READERS}
  const pairs = (declaredPairs() || []).filter((pair) => pair.render.when === 'focus');
  const active = document.activeElement;
  if (!active || active === document.body) return null;
  const hooks = [...new Set(pairs.map((pair) => pair.render.hook))];
  const hook = hooks.find((name) => active.closest('[data-contrast~="' + name + '"]'));
  if (!hook) return { hook: null, tag: active.tagName.toLowerCase() };
  const container = document.querySelector('[data-contrast~="' + hook + '"]');
  const targetSelector = pairs.find((pair) => pair.render.hook === hook).render.foreground.selector;
  const target = targetSelector === ':scope' ? container : container.querySelector(targetSelector);
  const style = target ? getComputedStyle(target) : null;
  return {
    hook,
    tag: active.tagName.toLowerCase(),
    focusVisible: active.matches(':focus-visible'),
    indicator: style ? { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: style.outlineColor, borderTopColor: style.borderTopColor, boxShadow: style.boxShadow } : null,
    pairs: pairs.filter((pair) => pair.render.hook === hook).map(readPair),
  };
})()`;

/** Reads the running PlanStep: its pulse's animation, the media query, and whether "Running" is visible text. */
const MOTION_PROBE = `(() => {
  const step = document.querySelector('[data-contrast~="${MOTION_HOOK}"] .iq-plan-step--running');
  if (!step) return { error: 'no running plan step is rendered in ${MOTION_HOOK}' };
  const pulse = step.querySelector('.iq-plan-step-pulse');
  const state = step.querySelector('.iq-plan-step-state');
  const visible = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 1 && box.height > 1 && style.visibility === 'visible' && style.display !== 'none' && style.clipPath === 'none' && Number(style.opacity) > 0;
  };
  return {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animationName: pulse ? getComputedStyle(pulse).animationName : null,
    runningAnimations: pulse ? pulse.getAnimations().filter((animation) => animation.playState === 'running').length : 0,
    stateText: state ? state.textContent : null,
    stateVisible: visible(state),
  };
})()`;

const RENDERER_PROBE = `(async () => {
  const describe = (value) => {
    if (typeof value === 'function') return 'function';
    if (typeof value !== 'object' || value === null) return typeof value;
    const out = {};
    for (const key of Reflect.ownKeys(value)) out[String(key)] = describe(value[key]);
    return out;
  };
  const result = { globals: {} };
  for (const name of ${JSON.stringify(FORBIDDEN_GLOBALS)}) result.globals[name] = typeof globalThis[name];
  result.bridge = describe(globalThis.inquello);
  result.bridgeFrozen = Object.isFrozen(globalThis.inquello) && Object.isFrozen(globalThis.inquello && globalThis.inquello.runtime) && Object.isFrozen(globalThis.inquello && globalThis.inquello.identity);
  try {
    result.status = await globalThis.inquello.runtime.getStatus();
  } catch (error) {
    result.statusError = String(error && error.message);
  }
  const faces = ${JSON.stringify(EXPECTED_FONT_FACES)};
  const unquote = (family) => family.replace(/^["']|["']$/g, '');
  const readIcon = (probe) => {
    const svg = document.querySelector('[data-probe="' + probe + '"] svg');
    if (!svg) return null;
    const attrs = {};
    for (const name of ['aria-hidden', 'role', 'aria-label', 'viewBox', 'width', 'height', 'stroke', 'stroke-width']) attrs[name] = svg.getAttribute(name);
    return attrs;
  };
  const readDesign = () => ({
    title: document.querySelector('h1') ? document.querySelector('h1').textContent : null,
    fonts: faces.map(({ family, weight }) => {
      const matching = [...document.fonts].filter((face) => unquote(face.family) === family && String(face.weight) === String(weight) && face.style === 'normal');
      return { family, weight, declared: matching.length, statuses: matching.map((face) => face.status), check: document.fonts.check(weight + ' 16px "' + family + '"') };
    }),
    decorativeIcon: readIcon('icon-decorative'),
    informativeIcon: readIcon('icon-informative'),
  });
  ${STYLE_READERS}
  const settled = (design) => design.decorativeIcon && design.informativeIcon && design.fonts.every((font) => font.statuses.includes('loaded'));
  const deadline = Date.now() + ${DESIGN_SETTLE_MS};
  await document.fonts.ready;
  let design = readDesign();
  while (!settled(design) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await document.fonts.ready;
    design = readDesign();
  }
  const declared = declaredPairs();
  design.contrast = declared ? declared.map((pair) => (pair.render.when === 'static' ? readPair(pair) : { id: pair.id, kind: pair.kind, when: 'focus', hook: pair.render.hook, foreground: null, adjacent: null, error: 'focus hook not reached' })) : null;
  design.focus = [];
  result.design = design;
  try {
    result.windowOpen = window.open(${JSON.stringify(PROBE_TARGET)}) === null ? 'blocked' : 'opened';
  } catch {
    result.windowOpen = 'blocked';
  }
  try {
    await fetch(${JSON.stringify(PROBE_TARGET)});
    result.fetch = 'allowed';
  } catch {
    result.fetch = 'blocked';
  }
  return result;
})()`;

export interface RendererProbeResult {
  globals: Record<string, string>;
  bridge: unknown;
  bridgeFrozen: boolean;
  status?: unknown;
  statusError?: string;
  windowOpen: 'blocked' | 'opened';
  fetch: 'blocked' | 'allowed';
}

/** Everything `RENDERER_PROBE` returns: the privilege fields plus the design specimen. */
export interface RendererProbeOutput extends RendererProbeResult {
  design: DesignProbeResult;
}

export interface FontProbe {
  family: string;
  weight: number;
  /** `@font-face` rules declared for this family and weight. */
  declared: number;
  /** `FontFace.status` of each declared rule. */
  statuses: string[];
  /** `document.fonts.check('<weight> 16px "<family>"')`. */
  check: boolean;
}

/** The icon `<svg>`'s attributes, or `null` when it was not rendered. */
export type IconProbe = Record<string, string | null> | null;

/** One declared contrast pair as rendered: computed `rgb()` colours, or why they could not be read. */
export interface ContrastProbe {
  id: string;
  kind: 'text' | 'non-text';
  when: 'static' | 'focus';
  hook: string;
  foreground: string | null;
  adjacent: string | null;
  error: string | null;
}

/** What one Tab press focused. `hook` is null when focus landed outside every focus hook. */
export interface FocusProbe {
  hook: string | null;
  tag: string;
  focusVisible?: boolean;
  indicator?: { outlineStyle: string; outlineWidth: string; outlineColor: string; borderTopColor: string; boxShadow: string } | null;
  pairs?: ContrastProbe[];
}

/** The running PlanStep under one emulated `prefers-reduced-motion` value. */
export interface MotionRead {
  reducedMotion: boolean;
  animationName: string | null;
  runningAnimations: number;
  stateText: string | null;
  stateVisible: boolean;
}

/** The running PlanStep with motion allowed (`motion`) and with reduced motion emulated (`reduced`). */
export interface MotionProbe {
  motion: MotionRead | null;
  reduced: MotionRead | null;
  error: string | null;
}

export interface DesignProbeResult {
  title: string | null;
  fonts: FontProbe[];
  decorativeIcon: IconProbe;
  informativeIcon: IconProbe;
  /** The specimen's declared pairs, or null when it declared none. */
  contrast?: ContrastProbe[] | null;
  /** The focus hooks reached by Tab, in order (first visit only). */
  focus?: FocusProbe[];
  /** The reduced-motion check of the running PlanStep. */
  motion?: MotionProbe;
}

export interface ContrastReport {
  declared: number;
  measured: number;
  minimum: number | null;
  pairs: Array<{
    id: string;
    kind: 'text' | 'non-text';
    when: 'static' | 'focus';
    foreground: string | null;
    adjacent: string | null;
    ratio: number | null;
    threshold: number;
    pass: boolean;
    error: string | null;
  }>;
}

export interface DesignReport {
  ok: boolean;
  failures: string[];
  title: string | null;
  fonts: Array<{ family: string; weight: number; loaded: boolean; check: boolean }>;
  decorativeIcon: IconProbe;
  informativeIcon: IconProbe;
  contrast: ContrastReport;
  focus: FocusProbe[];
  motion: MotionProbe | null;
}

export interface RendererReport {
  privileges: PrivilegeReport;
  design: DesignReport;
}

export interface PrivilegeReport {
  ok: boolean;
  failures: string[];
  url: string;
  globals: Record<string, string>;
  bridge: unknown;
  bridgeFrozen: boolean;
  getStatus: unknown;
  windowOpen: string;
  fetch: string;
  navigation: 'blocked' | 'allowed';
}

export function evaluatePrivileges(
  probe: RendererProbeResult,
  navigation: 'blocked' | 'allowed',
  url: string,
  runtimeVersion: string,
): PrivilegeReport {
  const failures: string[] = [];
  for (const name of FORBIDDEN_GLOBALS) {
    if (probe.globals[name] !== 'undefined') failures.push(`renderer has ${name} (${probe.globals[name] ?? 'not probed'})`);
  }
  if (JSON.stringify(probe.bridge) !== JSON.stringify(EXPECTED_BRIDGE_TREE)) {
    failures.push(`inquello exposes ${JSON.stringify(probe.bridge)}`);
  }
  const status = probe.status as { state?: unknown; runtimeVersion?: unknown } | undefined;
  if (probe.statusError !== undefined) failures.push(`getStatus rejected: ${probe.statusError}`);
  else if (status?.state !== 'ready' || status.runtimeVersion !== runtimeVersion) {
    failures.push(`getStatus returned ${JSON.stringify(probe.status)}`);
  }
  if (probe.windowOpen !== 'blocked') failures.push('window.open was not blocked');
  if (probe.fetch !== 'blocked') failures.push('fetch was not blocked');
  if (navigation !== 'blocked') failures.push('navigation was not blocked');
  return {
    ok: failures.length === 0,
    failures,
    url,
    globals: probe.globals,
    bridge: probe.bridge,
    bridgeFrozen: probe.bridgeFrozen,
    getStatus: probe.statusError !== undefined ? { error: probe.statusError } : probe.status,
    windowOpen: probe.windowOpen,
    fetch: probe.fetch,
    navigation,
  };
}

/**
 * WCAG 2.2 contrast of two computed `rgb()` colours. It mirrors
 * `src/renderer/design/contrast.ts` (main cannot import renderer modules);
 * `test/contrast.test.ts` holds the two equal on every token pair.
 */
export function renderedContrastRatio(a: string, b: string): number {
  const luminance = (colour: string) => {
    const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(colour.trim());
    if (!match) throw new Error(`not an rgb() colour: ${colour}`);
    const [r, g, b] = [match[1], match[2], match[3]].map((channel) => {
      const c = Number(channel) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function evaluateContrast(probe: DesignProbeResult | undefined, failures: string[]): ContrastReport {
  const declared = probe?.contrast ?? null;
  if (!declared || declared.length === 0) failures.push('the specimen declared no contrast pairs');
  const pairs = (declared ?? []).map((pair) => {
    const threshold = RENDERED_THRESHOLDS[pair.kind] ?? RENDERED_THRESHOLDS.text;
    let ratio: number | null = null;
    let error = pair.error;
    if (!error && pair.foreground && pair.adjacent) {
      try {
        ratio = renderedContrastRatio(pair.foreground, pair.adjacent);
      } catch (cause) {
        error = (cause as Error).message;
      }
    } else if (!error) error = 'colours were not read';
    const pass = ratio !== null && ratio >= threshold;
    if (error) failures.push(`contrast ${pair.id} (${pair.when}): ${error}`);
    else if (!pass) failures.push(`contrast ${pair.id} (${pair.when}): rendered ${pair.foreground} on ${pair.adjacent} is ${ratio!.toFixed(2)}:1, below ${threshold}:1`);
    return { id: pair.id, kind: pair.kind, when: pair.when, foreground: pair.foreground, adjacent: pair.adjacent, ratio, threshold, pass, error };
  });
  const ratios = pairs.map((pair) => pair.ratio).filter((ratio): ratio is number => ratio !== null);
  return {
    declared: pairs.length,
    measured: ratios.length,
    minimum: ratios.length > 0 ? Math.min(...ratios) : null,
    pairs,
  };
}

function evaluateFocus(probe: DesignProbeResult | undefined, failures: string[]): FocusProbe[] {
  const focus = probe?.focus ?? [];
  const hooks = [...new Set((probe?.contrast ?? []).filter((pair) => pair.when === 'focus').map((pair) => pair.hook))];
  if (hooks.length === 0) failures.push('the specimen declared no focus hooks');
  for (const hook of REQUIRED_FOCUS_HOOKS) {
    if (!hooks.includes(hook)) failures.push(`the specimen declared no focus pairs for ${hook}`);
  }
  for (const hook of hooks) {
    const visit = focus.find((entry) => entry.hook === hook);
    if (!visit) {
      failures.push(`Tab never reached focus hook ${hook}`);
      continue;
    }
    if (visit.focusVisible !== true) failures.push(`${hook} is focused without :focus-visible`);
    const indicator = visit.indicator;
    if (!indicator) failures.push(`${hook} has no focus indicator target`);
    else {
      const outlined = indicator.outlineStyle !== 'none' && indicator.outlineWidth !== '0px';
      const ringed = /\b3px\b/.test(indicator.boxShadow) && indicator.boxShadow !== 'none';
      if (!ringed) failures.push(`${hook} focus shows no 3px ring (${indicator.boxShadow})`);
      if (!outlined && indicator.borderTopColor !== 'rgb(47, 95, 179)') failures.push(`${hook} focus shows no blue-600 edge`);
    }
  }
  return focus;
}

function evaluateMotion(probe: DesignProbeResult | undefined, failures: string[]): MotionProbe | null {
  const motion = probe?.motion ?? null;
  if (!motion) {
    failures.push('the reduced-motion check did not run');
    return null;
  }
  if (motion.error) {
    failures.push(`reduced-motion check: ${motion.error}`);
    return motion;
  }
  const checks: Array<[string, MotionRead | null, boolean]> = [
    ['with motion allowed', motion.motion, false],
    ['under reduced motion', motion.reduced, true],
  ];
  for (const [label, read, reduced] of checks) {
    if (!read) {
      failures.push(`the running step was not read ${label}`);
      continue;
    }
    if (read.reducedMotion !== reduced) failures.push(`prefers-reduced-motion was ${read.reducedMotion ? 'reduce' : 'no-preference'} ${label}`);
    if (read.stateText !== RUNNING_TEXT || !read.stateVisible) failures.push(`the running step does not show visible "${RUNNING_TEXT}" text ${label} (${JSON.stringify(read.stateText)})`);
    if (reduced) {
      if (read.animationName !== 'none' || read.runningAnimations !== 0) failures.push(`the running step still animates under reduced motion (${read.animationName}, ${read.runningAnimations} running)`);
    } else if (read.animationName !== RUNNING_ANIMATION || read.runningAnimations === 0) {
      failures.push(`the running step does not pulse with motion allowed (${read.animationName}, ${read.runningAnimations} running)`);
    }
  }
  return motion;
}

/** Pass/fail for the design specimen: all five faces loaded, both icons with the right semantics, rendered contrast and focus. */
export function evaluateDesign(probe: DesignProbeResult | undefined): DesignReport {
  const failures: string[] = [];
  const fonts = EXPECTED_FONT_FACES.map(({ family, weight }) => {
    const font = probe?.fonts.find((entry) => entry.family === family && entry.weight === weight);
    const loaded = font !== undefined && font.declared > 0 && font.statuses.includes('loaded');
    const check = font?.check === true;
    if (!font || font.declared === 0) failures.push(`${family} ${weight} has no @font-face`);
    else if (!loaded) failures.push(`${family} ${weight} did not load (${font.statuses.join(', ')})`);
    if (font && !check) failures.push(`document.fonts.check failed for ${family} ${weight}`);
    return { family, weight, loaded, check };
  });
  const decorative = probe?.decorativeIcon ?? null;
  if (!decorative) failures.push('decorative icon was not rendered');
  else {
    if (decorative['aria-hidden'] !== 'true') failures.push(`decorative icon aria-hidden is ${JSON.stringify(decorative['aria-hidden'])}`);
    if (decorative.role !== null) failures.push(`decorative icon has role ${JSON.stringify(decorative.role)}`);
    if (decorative['aria-label'] !== null) failures.push('decorative icon has an aria-label');
  }
  const informative = probe?.informativeIcon ?? null;
  if (!informative) failures.push('informative icon was not rendered');
  else {
    if (informative.role !== 'img') failures.push(`informative icon role is ${JSON.stringify(informative.role)}`);
    if (informative['aria-label'] !== EXPECTED_ICON_LABEL) failures.push(`informative icon aria-label is ${JSON.stringify(informative['aria-label'])}`);
    if (informative['aria-hidden'] !== null) failures.push('informative icon is aria-hidden');
  }
  const focus = evaluateFocus(probe, failures);
  const contrast = evaluateContrast(probe, failures);
  const motion = evaluateMotion(probe, failures);
  return {
    ok: failures.length === 0,
    failures,
    title: probe?.title ?? null,
    fonts,
    decorativeIcon: decorative,
    informativeIcon: informative,
    contrast,
    focus,
    motion,
  };
}

/** Presses Tab until every focus hook was visited (or `MAX_TABS`), merging each hook's focus pairs into `design.contrast`. */
async function probeFocus(contents: WebContents, design: DesignProbeResult): Promise<void> {
  const hooks = new Set((design.contrast ?? []).filter((pair) => pair.when === 'focus').map((pair) => pair.hook));
  const visits: FocusProbe[] = [];
  contents.focus();
  for (let press = 0; press < MAX_TABS && visits.length < hooks.size; press += 1) {
    contents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
    contents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
    await new Promise((resolve) => setTimeout(resolve, TAB_SETTLE_MS));
    const visit = (await contents.executeJavaScript(FOCUS_PROBE)) as FocusProbe | null;
    if (!visit?.hook || visits.some((entry) => entry.hook === visit.hook)) continue;
    visits.push(visit);
    for (const read of visit.pairs ?? []) {
      const index = (design.contrast ?? []).findIndex((pair) => pair.id === read.id);
      if (index >= 0) design.contrast![index] = read;
    }
  }
  design.focus = visits.map(({ pairs: _pairs, ...visit }) => visit);
}

/**
 * Emulates `prefers-reduced-motion` through the DevTools protocol and reads the
 * running PlanStep under `no-preference`, then `reduce`; the emulation is
 * cleared and the debugger detached afterwards.
 */
async function probeMotion(contents: WebContents, design: DesignProbeResult): Promise<void> {
  const motion: MotionProbe = { motion: null, reduced: null, error: null };
  const cdp = contents.debugger;
  const emulate = (value: string | null) =>
    cdp.sendCommand('Emulation.setEmulatedMedia', { features: value === null ? [] : [{ name: 'prefers-reduced-motion', value }] });
  const readUnder = async (value: string) => {
    await emulate(value);
    await new Promise((resolve) => setTimeout(resolve, MOTION_SETTLE_MS));
    const read = (await contents.executeJavaScript(MOTION_PROBE)) as MotionRead | { error: string };
    if ('error' in read) throw new Error(read.error);
    return read;
  };
  try {
    cdp.attach('1.3');
    try {
      motion.motion = await readUnder('no-preference');
      motion.reduced = await readUnder('reduce');
    } finally {
      await emulate(null).catch(() => undefined);
      cdp.detach();
    }
  } catch (error) {
    motion.error = (error as Error).message;
  }
  design.motion = motion;
}

async function waitForLoad(contents: WebContents): Promise<void> {
  if (!contents.isLoading()) return;
  await new Promise<void>((resolve, reject) => {
    contents.once('did-finish-load', () => resolve());
    contents.once('did-fail-load', (_event, code, description) => reject(new Error(`renderer load failed (${code}): ${description}`)));
  });
}

/** Probes `contents` and evaluates the result; `blocked` is the policy's live block log. */
export async function probeRenderer(
  contents: WebContents,
  blocked: ReadonlyArray<{ kind: BlockedKind; url: string }>,
  runtimeVersion: string,
): Promise<RendererReport> {
  await waitForLoad(contents);
  const url = contents.getURL();
  const probe = (await contents.executeJavaScript(RENDERER_PROBE)) as RendererProbeOutput;
  await probeFocus(contents, probe.design);
  await probeMotion(contents, probe.design);
  const before = blocked.length;
  await contents.executeJavaScript(`location.href = ${JSON.stringify(PROBE_TARGET)}; true`);
  await new Promise((resolve) => setTimeout(resolve, NAVIGATION_SETTLE_MS));
  // Whichever hook fires first (`will-frame-navigate` or `will-navigate`) prevents it.
  const navigationLogged = blocked
    .slice(before)
    .some((entry) => (entry.kind === 'navigation' || entry.kind === 'frame-navigation') && entry.url === PROBE_TARGET);
  const navigation = navigationLogged && contents.getURL() === url ? 'blocked' : 'allowed';
  return { privileges: evaluatePrivileges(probe, navigation, url, runtimeVersion), design: evaluateDesign(probe.design) };
}

// ---- identity (Story 1.10b) ------------------------------------------------------

/** How long the probe waits for the Account block to reach a state. */
const ACCOUNT_SETTLE_MS = 30_000;

const ACCOUNT_HELPERS = `
  const wait = async (predicate, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return predicate();
  };
  const account = () => document.querySelector('[data-account]');
  const readAccount = () => {
    const block = account();
    if (!block) return null;
    return {
      identity: block.getAttribute('data-identity-state'),
      sharedService: block.getAttribute('data-shared-service'),
      credentialStorage: block.getAttribute('data-credential-storage'),
      privateWork: block.getAttribute('data-private-work'),
      text: block.textContent,
    };
  };
  const press = async (action, until) => {
    const button = document.querySelector('[data-account-action="' + action + '"]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return { pressed: false, reached: false };
    button.click();
    return { pressed: true, reached: await wait(() => account() && account().getAttribute('data-identity-state') === until, ${ACCOUNT_SETTLE_MS}) };
  };
`;

/** Reads the Account block and status; when `signIn`, presses Sign in and waits for `signed-in`. */
function accountProbe(signIn: boolean): string {
  return `(async () => {
    ${ACCOUNT_HELPERS}
    const out = {};
    out.status = await globalThis.inquello.identity.getStatus();
    await wait(() => account() && account().getAttribute('data-identity-state') !== 'unknown' && account().getAttribute('data-shared-service') !== 'unknown', 10000);
    out.dom = readAccount();
    if (${signIn}) {
      out.signIn = await press('sign-in', 'signed-in');
      out.afterSignIn = await globalThis.inquello.identity.getStatus();
      out.domAfterSignIn = readAccount();
    }
    return out;
  })()`;
}

const SIGN_OUT_PROBE = `(async () => {
  ${ACCOUNT_HELPERS}
  const out = {};
  out.signOut = await press('sign-out', 'signed-out');
  out.afterSignOut = await globalThis.inquello.identity.getStatus();
  out.domAfterSignOut = readAccount();
  return out;
})()`;

/** Everything the renderer can see that a secret could hide in, as one string. Main searches it. */
const RENDERER_DUMP = `(() => {
  const strings = [];
  for (const key of Object.getOwnPropertyNames(globalThis)) {
    try {
      const value = globalThis[key];
      if (typeof value === 'string') strings.push(key + '=' + value);
    } catch {}
  }
  const storage = (name) => {
    try {
      const area = globalThis[name];
      const out = {};
      for (let i = 0; i < area.length; i += 1) out[area.key(i)] = area.getItem(area.key(i));
      return out;
    } catch {
      return null;
    }
  };
  let cookie = null;
  try { cookie = document.cookie; } catch {}
  return JSON.stringify({ html: document.documentElement.outerHTML, url: location.href, title: document.title, name: globalThis.name, cookie, strings, local: storage('localStorage'), session: storage('sessionStorage') });
})()`;

export interface AccountRead {
  identity: string | null;
  sharedService: string | null;
  credentialStorage: string | null;
  privateWork: string | null;
  text: string | null;
}

export interface IdentityProbeRead {
  configured: boolean;
  status: unknown;
  dom: AccountRead | null;
  signIn?: { pressed: boolean; reached: boolean };
  afterSignIn?: unknown;
  domAfterSignIn?: AccountRead | null;
  /** The vault while signed in. */
  vault?: { exists: boolean; mode: number | null; dirMode: number | null; plaintextSecrets: number };
  signOut?: { pressed: boolean; reached: boolean };
  afterSignOut?: unknown;
  domAfterSignOut?: AccountRead | null;
  vaultAfterSignOut?: { exists: boolean };
  /** How many distinct secrets were searched for; never the secrets. */
  secretsChecked: number;
  /** How many of them appeared anywhere in what the renderer saw. */
  rendererLeaks: number;
}

export interface IdentityReport {
  ok: boolean;
  failures: string[];
  configured: boolean;
  before: unknown;
  afterSignIn: unknown;
  afterSignOut: unknown;
  vault: IdentityProbeRead['vault'] | null;
  secretsChecked: number;
  rendererLeaks: number;
}

/** The minimum distinct secrets a sign-in handles: access, refresh, proof, code, verifier, ID token. */
const MIN_SECRETS = 6;

function statusOf(value: unknown): { identity?: { state?: unknown; displayName?: unknown }; sharedService?: unknown; credentialStorage?: unknown; privateWork?: unknown } {
  return typeof value === 'object' && value !== null ? (value as never) : {};
}

/** Pass/fail for the identity probe. */
export function evaluateIdentity(read: IdentityProbeRead): IdentityReport {
  const failures: string[] = [];
  const before = statusOf(read.status);
  if (before.privateWork !== 'local') failures.push(`private work is ${JSON.stringify(before.privateWork)}, not local`);
  if (read.dom?.privateWork !== 'local') failures.push('the Account block does not show private work as local');
  if (!read.configured) {
    if (before.sharedService !== 'not-configured') failures.push(`shared service is ${JSON.stringify(before.sharedService)} without a configuration`);
    if (before.identity?.state !== 'signed-out') failures.push(`identity is ${JSON.stringify(before.identity?.state)} without a configuration`);
    if (read.dom?.sharedService !== 'not-configured') failures.push('the Account block does not show the shared service as not configured');
  } else {
    if (before.identity?.state !== 'signed-out') failures.push(`the run did not start signed out (${JSON.stringify(before.identity?.state)})`);
    if (!read.signIn?.pressed) failures.push('Sign in could not be pressed');
    else if (!read.signIn.reached) failures.push('the Account block never showed signed-in');
    const after = statusOf(read.afterSignIn);
    if (after.identity?.state !== 'signed-in') failures.push(`identity after sign-in is ${JSON.stringify(after.identity?.state)}`);
    if (after.sharedService !== 'available') failures.push(`shared service after sign-in is ${JSON.stringify(after.sharedService)}`);
    if (after.credentialStorage !== 'os-backed') failures.push(`credential storage is ${JSON.stringify(after.credentialStorage)}, not os-backed`);
    if (after.privateWork !== 'local') failures.push('private work is not local after sign-in');
    if (read.domAfterSignIn?.identity !== 'signed-in' || read.domAfterSignIn.sharedService !== 'available') failures.push('the Account block does not show signed-in with the service available');
    if (!read.vault?.exists) failures.push('no encrypted credential file was written');
    else {
      if (read.vault.mode !== 0o600) failures.push(`the credential file mode is ${read.vault.mode?.toString(8)}, not 600`);
      if (read.vault.dirMode !== 0o700) failures.push(`the identity directory mode is ${read.vault.dirMode?.toString(8)}, not 700`);
      if (read.vault.plaintextSecrets !== 0) failures.push(`${read.vault.plaintextSecrets} secret(s) appear in plaintext in the credential file`);
    }
    if (read.secretsChecked < MIN_SECRETS) failures.push(`only ${read.secretsChecked} secrets were recorded for the leak check`);
    if (!read.signOut?.pressed) failures.push('Sign out could not be pressed');
    else if (!read.signOut.reached) failures.push('the Account block never showed signed-out');
    const out = statusOf(read.afterSignOut);
    if (out.identity?.state !== 'signed-out') failures.push(`identity after sign-out is ${JSON.stringify(out.identity?.state)}`);
    if (read.vaultAfterSignOut?.exists !== false) failures.push('the credential file is still present after sign-out');
  }
  if (read.rendererLeaks !== 0) failures.push(`${read.rendererLeaks} secret(s) reached the renderer`);
  return {
    ok: failures.length === 0,
    failures,
    configured: read.configured,
    before: read.status,
    afterSignIn: read.afterSignIn ?? null,
    afterSignOut: read.afterSignOut ?? null,
    vault: read.vault ?? null,
    secretsChecked: read.secretsChecked,
    rendererLeaks: read.rendererLeaks,
  };
}

function modeOf(file: string): number | null {
  try {
    return fs.statSync(file).mode & 0o777;
  } catch {
    return null;
  }
}

/** Runs the identity probe against the live renderer and the main-owned session. */
export async function probeIdentity(contents: WebContents, identity: IdentityWiring): Promise<IdentityReport> {
  const configured = identity.config.kind === 'configured';
  const first = (await contents.executeJavaScript(accountProbe(configured))) as Omit<IdentityProbeRead, 'configured' | 'secretsChecked' | 'rendererLeaks'>;
  const read: IdentityProbeRead = { configured, ...first, secretsChecked: 0, rendererLeaks: 0 };
  const seen: string[] = [JSON.stringify(first)];
  if (configured) {
    const secrets = identity.session.knownSecrets();
    const file = identity.vault.filePath;
    let plaintextSecrets = 0;
    let exists = false;
    try {
      const bytes = fs.readFileSync(file);
      exists = true;
      for (const secret of secrets) if (bytes.includes(Buffer.from(secret, 'utf8'))) plaintextSecrets += 1;
    } catch {
      exists = false;
    }
    read.vault = { exists, mode: modeOf(file), dirMode: modeOf(path.dirname(file)), plaintextSecrets };
    seen.push((await contents.executeJavaScript(RENDERER_DUMP)) as string);
    const second = (await contents.executeJavaScript(SIGN_OUT_PROBE)) as Pick<IdentityProbeRead, 'signOut' | 'afterSignOut' | 'domAfterSignOut'>;
    Object.assign(read, second);
    seen.push(JSON.stringify(second));
    read.vaultAfterSignOut = { exists: fs.existsSync(file) };
  }
  seen.push((await contents.executeJavaScript(RENDERER_DUMP)) as string);
  const secrets = identity.session.knownSecrets();
  const haystack = seen.join('\n');
  read.secretsChecked = secrets.length;
  read.rendererLeaks = secrets.filter((secret) => haystack.includes(secret)).length;
  return evaluateIdentity(read);
}

// ---- local data (Story 1.12) ---------------------------------------------------

/** Omissions every export must declare. */
export const REQUIRED_OMISSIONS = ['identity-session', 'chromium-profile'] as const;

export interface DataProbeRead {
  policyLoaded: boolean;
  ruleBlockers: number;
  categories: number;
  runtimeHome: { underUserData: boolean; matchesHandshake: boolean };
  unclassified: string[];
  disabledHeld: string[];
  renderer: { policyLoaded: boolean; categories: number; blockShown: boolean; pathRejected: boolean };
  export: { ok: boolean; reason?: string; included: Record<string, number>; omissions: string[] };
  import: { ok: boolean; reason?: string; restored: number; notRestored: number; byteIdentical: boolean; syntheticRestored: boolean };
}

export interface DataReport extends DataProbeRead {
  ok: boolean;
  failures: string[];
}

/** Pass/fail for the data probe. */
export function evaluateData(read: DataProbeRead): DataReport {
  const failures: string[] = [];
  if (!read.policyLoaded) failures.push('the local data policy did not load');
  if (read.ruleBlockers > 0) failures.push(`${read.ruleBlockers} enabled categories have an unknown rule`);
  if (!read.runtimeHome.underUserData) failures.push('the runtime home is not under userData');
  if (!read.runtimeHome.matchesHandshake) failures.push('the runtime did not report the runtime home as its CODEX_HOME');
  if (read.unclassified.length > 0) failures.push(`unclassified files: ${read.unclassified.join(', ')}`);
  if (read.disabledHeld.length > 0) failures.push(`files in disabled categories: ${read.disabledHeld.join(', ')}`);
  if (!read.renderer.policyLoaded || read.renderer.categories !== read.categories) failures.push('the renderer did not receive the full policy');
  if (!read.renderer.blockShown) failures.push('the Local data block did not list the categories');
  if (!read.renderer.pathRejected) failures.push('a renderer-supplied path to data.export was not rejected');
  if (!read.export.ok) failures.push(`the export failed: ${read.export.reason ?? 'no reason'}`);
  if (!read.export.included['task-history']) failures.push('the export did not include task history');
  for (const id of REQUIRED_OMISSIONS) if (!read.export.omissions.includes(id)) failures.push(`the export did not declare ${id} as omitted`);
  if (!read.import.ok) failures.push(`the reimport failed: ${read.import.reason ?? 'no reason'}`);
  const exported = Object.values(read.export.included).reduce((sum, count) => sum + count, 0);
  if (read.import.restored !== exported || read.import.notRestored !== 0) failures.push(`reimport restored ${read.import.restored} of ${exported} files`);
  if (!read.import.byteIdentical) failures.push('reimported files differ from the export');
  if (!read.import.syntheticRestored) failures.push('the synthetic session file did not come back byte-identical');
  return { ok: failures.length === 0, failures, ...read };
}

const DATA_RENDERER_PROBE = `(async () => {
  const out = {};
  const policy = await globalThis.inquello.data.getPolicy();
  out.policyLoaded = policy && policy.loaded === true;
  out.categories = policy && Array.isArray(policy.categories) ? policy.categories.length : 0;
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline && document.querySelectorAll('[data-local-data-category]').length === 0) await new Promise((r) => setTimeout(r, 100));
  out.blockCategories = document.querySelectorAll('[data-local-data-category]').length;
  try {
    await globalThis.inquello.data.export('/tmp/renderer-chosen-path');
    out.pathRejected = false;
  } catch (error) {
    out.pathRejected = String(error && error.message).includes('invalid payload for data.export');
  }
  return out;
})()`;

function realpathOrNull(file: string | null): string | null {
  if (!file) return null;
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}

export interface DataProbeOptions {
  service: DataService;
  roots: GovernedRoots;
  /** `codexHome` from the runtime's handshake. */
  codexHome: string | null;
  tempBase?: string;
}

/** Runs the data probe against the live roots, the renderer and the data service. */
export async function probeData(contents: WebContents, options: DataProbeOptions): Promise<DataReport> {
  const { service, roots } = options;
  const policy = service.policy;
  const read: DataProbeRead = {
    policyLoaded: policy !== null,
    ruleBlockers: policy ? ruleBlockers(policy).length : 0,
    categories: policy?.categories.length ?? 0,
    runtimeHome: {
      underUserData: isInside(roots['user-data'], roots['runtime-home']) && path.resolve(roots['user-data']) !== path.resolve(roots['runtime-home']),
      matchesHandshake: realpathOrNull(options.codexHome) !== null && realpathOrNull(options.codexHome) === realpathOrNull(roots['runtime-home']),
    },
    unclassified: [],
    disabledHeld: [],
    renderer: { policyLoaded: false, categories: 0, blockShown: false, pathRejected: false },
    export: { ok: false, included: {}, omissions: [] },
    import: { ok: false, restored: 0, notRestored: 0, byteIdentical: false, syntheticRestored: false },
  };
  if (!policy) return evaluateData(read);

  // A synthetic session file, so the round trip carries task history.
  const sessionRel = `sessions/2026/10/28/rollout-smoke-${randomUUID()}.jsonl`;
  const sessionFile = path.join(roots['runtime-home'], ...sessionRel.split('/'));
  const sessionBytes = `${JSON.stringify({ type: 'session_meta', payload: { id: randomUUID(), source: 'inquello-smoke', synthetic: true } })}\n`;
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(sessionFile, sessionBytes, { mode: 0o600 });

  const inventory = takeInventory(policy, roots);
  read.unclassified = [...inventory.unclassified];
  read.disabledHeld = inventory.disabledHeld.map((entry) => entry.path);

  const renderer = (await contents.executeJavaScript(DATA_RENDERER_PROBE)) as { policyLoaded: boolean; categories: number; blockCategories: number; pathRejected: boolean };
  read.renderer = { policyLoaded: renderer.policyLoaded === true, categories: renderer.categories, blockShown: renderer.blockCategories === read.categories, pathRejected: renderer.pathRejected === true };

  const temps: string[] = [];
  try {
    const exported = await service.exportData();
    if (!exported.ok) {
      read.export = { ok: false, reason: exported.reason, included: {}, omissions: [] };
      return evaluateData(read);
    }
    temps.push(path.dirname(exported.export.path));
    read.export = {
      ok: true,
      included: Object.fromEntries(exported.export.included.map((entry) => [entry.category, entry.files])),
      omissions: exported.export.omissions.map((entry) => entry.category ?? 'unclassified'),
    };

    const target = fs.mkdtempSync(path.join(options.tempBase ?? os.tmpdir(), 'inquello-smoke-reimport-'));
    temps.push(target);
    const targetRoots = governedRoots(path.join(target, 'user-data'), path.join(target, 'user-data', 'logs'));
    try {
      const result = await importData({ policy, roots: targetRoots, source: exported.export.path });
      const manifest = readManifest(exported.export.path);
      let identical = true;
      for (const entry of manifest.included) {
        for (const file of entry.files) {
          const restored = path.join(targetRoots[file.root], ...file.path.split('/'));
          const digest = await digestFile(restored).catch(() => null);
          const original = await digestFile(exportedFilePath(exported.export.path, file.root, file.path)).catch(() => null);
          if (!digest || digest.sha256 !== file.sha256 || original?.sha256 !== file.sha256) identical = false;
        }
      }
      const syntheticBack = fs.existsSync(path.join(targetRoots['runtime-home'], ...sessionRel.split('/')))
        ? fs.readFileSync(path.join(targetRoots['runtime-home'], ...sessionRel.split('/')), 'utf8')
        : null;
      read.import = {
        ok: true,
        restored: result.restored.reduce((sum, entry) => sum + entry.files, 0),
        notRestored: result.notRestored.length,
        byteIdentical: identical,
        syntheticRestored: syntheticBack === sessionBytes,
      };
    } catch (error) {
      read.import = { ok: false, reason: (error as Error).message, restored: 0, notRestored: 0, byteIdentical: false, syntheticRestored: false };
    }
  } finally {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(sessionFile, { force: true });
  }
  return evaluateData(read);
}
