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
 *
 * Story 1.13 adds the providers probe (`probeProviders`). It types one
 * sentinel key into the Providers block for both routes (the Claude API key
 * and a Codex API-key login), requires `stored-unverified` with an OS-backed
 * encrypted vault file and a connected Codex login held in the OS keyring
 * (no `auth.json`), checks that both password fields were cleared, signs out
 * of Inquello and requires both routes unchanged, then removes both routes
 * and requires the identity unchanged. While the sentinel is held it exports
 * local data and searches, in main, every file under userData and the logs
 * directory (the encrypted vault excepted only as ciphertext), the export,
 * the app-server stderr log, main's own log, `/proc/<app-server pid>/environ`
 * (Linux) and everything the renderer can see, for the sentinel and every
 * 8-character fragment of its random part. It also requires that no provider
 * credential variable of the desktop's environment reached the runtime.
 * `evaluateProviders` is pure and decides pass/fail.
 *
 * Story 1.14 adds the organise probe (`probeOrganise`). Without a shared
 * service it opens the Shell and requires the signed-out Sidebar with no
 * Workspace. With the dev topology (started with `--seed-workspace` and its
 * seed file named by `INQUELLO_SMOKE_SEED`) it signs the synthetic user in,
 * accepts the seeded first-administrator invite, opens the Shell, and through
 * the UI creates an Engagement (client and period), a folder and a Task in it.
 * It reads the Header (title, client, period, Workspace), records a synthetic
 * thread ref on the Task in main, moves the Task through the Move menu, and
 * requires the same Task ID, thread ref and references, private visibility,
 * and that a second principal bound to the runtime lists none of the Tasks.
 * It signs out at the end. `evaluateOrganise` is pure and decides pass/fail.
 *
 * Story 1.15 adds the states probe (`probeStates`). Without a shared service it
 * requires `state.list` to answer signed-out and a review write to be refused
 * by main's validator. With the dev topology it signs in again, creates an ad
 * hoc Task in main, and through the renderer's `state.recordTaskState` records
 * task planned, then running, then run execution_finished. It opens the Task
 * in the Shell and requires the States section to show "Execution finished"
 * in the neutral custom-label chip (not the accepted style, not green), every
 * other dimension "Not recorded", no accepted or explained chip and no text
 * claiming acceptance. A review write is refused by main's validator and, sent
 * straight to the runtime as a system actor, with `human_actor_required`. A
 * second principal is refused the Task's states as `not_found`.
 * `evaluateStates` is pure and decides pass/fail.
 *
 * Story 1.16 adds the shell-layout probe (`probeShellLayout`). With the dev
 * topology it signs in and opens a synthetic ad hoc Task in the Shell (without
 * it, it reads the signed-out Shell). Main resizes the real window to a full,
 * a rail, a single and the minimum width; at each the probe reads the layout
 * mode, the Sidebar or rail width, the Header height, the thread's maximum and
 * actual width, that the page has no horizontal overflow
 * (`scrollWidth <= clientWidth`), the landmarks, that the artifact area is
 * closed and that the open Task stays open and marked. It checks that a
 * Ctrl/Cmd+K keydown is left unhandled, that collapsing the rail by keyboard is
 * announced once, and, under an emulated `prefers-color-scheme: dark`, that the
 * Shell stays light. Nothing can open the artifact area yet, so at the single
 * width it requires the Shell to report that the artifact would not fit beside
 * the thread (single mode would apply) with the area closed. `evaluateShellLayout`
 * is pure and decides pass/fail.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { WebContents } from 'electron';

import { digestFile, exportedFilePath, governedRoots, importData, isInside, readManifest, ruleBlockers, takeInventory, type DataService, type GovernedRoots } from './data';
import type { IdentityWiring } from './identity';
import type { OrganiseService, TaskView } from './organise';
import type { ProviderService } from './providers';
import { isProviderCredentialVar } from './runtime/env';
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
  provider: {
    getStatus: 'function',
    setClaudeKey: 'function',
    verifyClaudeKey: 'function',
    removeClaudeKey: 'function',
    codexLogin: 'function',
    codexLogout: 'function',
  },
  organise: {
    getWorkspaces: 'function',
    getTree: 'function',
    createEngagement: 'function',
    updateEngagement: 'function',
    createFolder: 'function',
    createTask: 'function',
    renameTask: 'function',
    moveTask: 'function',
  },
  state: { list: 'function', recordTaskState: 'function' },
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

// ---- provider credentials (Story 1.13) -------------------------------------------

const PROVIDER_SETTLE_MS = 30_000;

const PROVIDER_HELPERS = `
  const wait = async (predicate, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return predicate();
  };
  const block = () => document.querySelector('[data-providers]');
  const attr = (name) => (block() ? block().getAttribute(name) : null);
  const read = () => ({ claude: attr('data-claude-state'), storage: attr('data-claude-storage'), codex: attr('data-codex-state'), account: attr('data-codex-account') });
  const type = (id, value) => {
    const input = document.getElementById(id);
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.type === 'password';
  };
  const fieldValue = (id) => (document.getElementById(id) ? document.getElementById(id).value : null);
  const press = async (action, until) => {
    await wait(() => {
      const button = document.querySelector('[data-provider-action="' + action + '"]');
      return button && button.getAttribute('aria-disabled') !== 'true';
    }, 5000);
    const button = document.querySelector('[data-provider-action="' + action + '"]');
    if (!button || button.getAttribute('aria-disabled') === 'true') return { pressed: false, reached: false };
    button.click();
    return { pressed: true, reached: await wait(until, ${PROVIDER_SETTLE_MS}) };
  };
`;

/** Types the sentinel into both password fields and connects both routes through the Providers block. */
function providerConnectProbe(sentinel: string): string {
  return `(async () => {
    ${PROVIDER_HELPERS}
    const out = {};
    await wait(() => block() && attr('data-claude-state') !== 'unknown' && attr('data-codex-state') !== 'unknown', 10000);
    out.before = read();
    out.claudePassword = type('provider-claude-key', ${JSON.stringify(sentinel)});
    out.claudeStore = await press('claude-store', () => attr('data-claude-state') === 'stored-unverified');
    out.claudeFieldCleared = fieldValue('provider-claude-key') === '';
    out.codexPassword = type('provider-codex-key', ${JSON.stringify(sentinel)});
    out.codexLogin = await press('codex-api-key', () => attr('data-codex-state') === 'connected');
    out.codexFieldCleared = fieldValue('provider-codex-key') === '';
    out.connected = read();
    out.status = await globalThis.inquello.provider.getStatus();
    try {
      await globalThis.inquello.provider.setClaudeKey('/tmp/x', 'extra');
      out.extraRejected = false;
    } catch (error) {
      out.extraRejected = String(error && error.message).includes('invalid payload for provider.setClaudeKey');
    }
    return out;
  })()`;
}

const PROVIDER_DISCONNECT_PROBE = `(async () => {
  ${PROVIDER_HELPERS}
  const out = {};
  out.claudeRemove = await press('claude-remove', () => attr('data-claude-state') === 'not-configured');
  out.codexLogout = await press('codex-logout', () => attr('data-codex-state') === 'not-connected');
  out.disconnected = read();
  out.status = await globalThis.inquello.provider.getStatus();
  return out;
})()`;

interface ProviderBlockRead {
  claude: string | null;
  storage: string | null;
  codex: string | null;
  account: string | null;
}

export interface ProviderProbeRead {
  /** Provider credential variables in the desktop's environment (names only). */
  inheritedVars: string[];
  /** Whether `/proc/<pid>/environ` of the app-server was read (Linux only). */
  childEnvChecked: boolean;
  /** Inherited provider variable names or values found in the app-server's environment. */
  childEnvLeaks: string[];
  /** A Codex login left in the keyring by an earlier run, removed before the probe. */
  preexistingCodexLogin: boolean;
  initial: { claude: string; codex: string } | null;
  connect: {
    before: ProviderBlockRead | null;
    claudePassword: boolean;
    claudeStore: { pressed: boolean; reached: boolean };
    claudeFieldCleared: boolean;
    codexPassword: boolean;
    codexLogin: { pressed: boolean; reached: boolean };
    codexFieldCleared: boolean;
    connected: ProviderBlockRead | null;
    extraRejected: boolean;
  } | null;
  connectedStatus: { claude: string; storage: string; codex: string; account: string | null } | null;
  vault: { exists: boolean; mode: number | null; dirMode: number | null; plaintext: boolean };
  authJson: boolean;
  /** Provider status before and after Inquello sign-out (both routes connected). */
  identitySignOut: { identityBefore: string; identityAfter: string; providersUnchanged: boolean } | null;
  /** Identity status before connecting and after removing both routes. */
  identityUnchanged: boolean;
  disconnect: { claudeRemove: { pressed: boolean; reached: boolean }; codexLogout: { pressed: boolean; reached: boolean }; disconnected: ProviderBlockRead | null } | null;
  finalStatus: { claude: string; codex: string } | null;
  vaultAfterRemove: boolean;
  exportOk: boolean;
  /** Where the sentinel (or a fragment) was found; empty when nowhere. */
  leaks: string[];
  /** How many files and texts were searched. */
  searched: number;
}

export interface ProvidersReport extends ProviderProbeRead {
  ok: boolean;
  failures: string[];
}

/** Pass/fail for the providers probe. */
export function evaluateProviders(read: ProviderProbeRead): ProvidersReport {
  const failures: string[] = [];
  if (read.inheritedVars.length === 0) failures.push('no inherited provider variable was set, so the environment check did not run');
  if (process.platform === 'linux' && !read.childEnvChecked) failures.push('the app-server environment could not be read');
  if (read.childEnvLeaks.length > 0) failures.push(`provider variables reached the app-server: ${read.childEnvLeaks.join(', ')}`);
  if (!read.initial) failures.push('the provider status could not be read');
  else {
    if (read.initial.claude !== 'not-configured') failures.push(`the Claude key did not start not-configured (${read.initial.claude})`);
    if (read.initial.codex !== 'not-connected') failures.push(`the Codex login did not start not connected despite the inherited key (${read.initial.codex})`);
  }
  const c = read.connect;
  if (!c) failures.push('the Providers block could not be driven');
  else {
    if (!c.claudePassword || !c.codexPassword) failures.push('a provider key field is not a password field');
    if (!c.claudeStore.pressed || !c.claudeStore.reached) failures.push('the Claude key did not reach stored-unverified');
    if (!c.codexLogin.pressed || !c.codexLogin.reached) failures.push('the Codex API key login did not connect');
    if (!c.claudeFieldCleared || !c.codexFieldCleared) failures.push('a provider key field was not cleared after submit');
    if (!c.extraRejected) failures.push('provider.setClaudeKey accepted extra arguments');
  }
  const s = read.connectedStatus;
  if (!s || s.claude !== 'stored-unverified' || s.codex !== 'connected' || s.account !== 'apiKey') failures.push(`the connected status is ${JSON.stringify(s)}`);
  if (s && s.storage !== 'os-backed') failures.push(`the Claude key storage is ${s.storage}, not os-backed`);
  if (!read.vault.exists) failures.push('the Claude key vault file was not written');
  else {
    if (read.vault.mode !== 0o600) failures.push(`the Claude key vault mode is ${read.vault.mode?.toString(8)}, not 600`);
    if (read.vault.dirMode !== 0o700) failures.push(`the providers directory mode is ${read.vault.dirMode?.toString(8)}, not 700`);
    if (read.vault.plaintext) failures.push('the Claude key appears in plaintext in the vault file');
  }
  if (read.authJson) failures.push('the runtime wrote auth.json');
  if (!read.identitySignOut?.providersUnchanged) failures.push('Inquello sign-out changed a provider route');
  if (!read.identityUnchanged) failures.push('connecting or removing a provider route changed the Inquello identity');
  const d = read.disconnect;
  if (!d || !d.claudeRemove.reached || !d.codexLogout.reached) failures.push('the provider routes did not disconnect');
  if (!read.finalStatus || read.finalStatus.claude !== 'not-configured' || read.finalStatus.codex !== 'not-connected') failures.push(`the final status is ${JSON.stringify(read.finalStatus)}`);
  if (read.vaultAfterRemove) failures.push('the Claude key vault file is still present after removal');
  if (!read.exportOk) failures.push('the export for the sentinel scan failed');
  if (read.leaks.length > 0) failures.push(`the sentinel was found in: ${read.leaks.join(', ')}`);
  if (read.searched === 0) failures.push('nothing was searched for the sentinel');
  return { ok: failures.length === 0, failures, ...read };
}

export interface ProviderProbeOptions {
  providers: ProviderService;
  identity: IdentityWiring;
  data: DataService;
  roots: GovernedRoots;
  runtimePid: () => number | undefined;
  stderrLogPath: string;
  /** Everything main logged so far. */
  mainLog: () => readonly string[];
  tempBase?: string;
}

/** Every regular file under `dir` (symbolic links are not followed). */
function filesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesUnder(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** The sentinel and every 8-character window of its random part. */
export function sentinelNeedles(sentinel: string, random: string): string[] {
  const compact = random.replace(/-/g, '');
  const needles = new Set([sentinel, random, compact]);
  for (let i = 0; i + 8 <= compact.length; i += 1) needles.add(compact.slice(i, i + 8));
  return [...needles];
}

function statusSummary(status: Awaited<ReturnType<ProviderService['getStatus']>>) {
  return { claude: status.claude.state, storage: status.claude.storage, codex: status.codex.state, account: status.codex.account?.type ?? null };
}

/** Runs the providers probe against the live renderer, the provider service and the runtime. */
export async function probeProviders(contents: WebContents, options: ProviderProbeOptions): Promise<ProvidersReport> {
  const { providers, identity, roots } = options;
  const random = randomUUID();
  const sentinel = `sk-ant-api03-inquello-smoke-${random}`;
  const needles = sentinelNeedles(sentinel, random);
  const inherited = Object.entries(process.env).filter(([name, value]) => isProviderCredentialVar(name) && typeof value === 'string' && value !== '');
  const read: ProviderProbeRead = {
    inheritedVars: inherited.map(([name]) => name),
    childEnvChecked: false,
    childEnvLeaks: [],
    preexistingCodexLogin: false,
    initial: null,
    connect: null,
    connectedStatus: null,
    vault: { exists: false, mode: null, dirMode: null, plaintext: false },
    authJson: false,
    identitySignOut: null,
    identityUnchanged: false,
    disconnect: null,
    finalStatus: null,
    vaultAfterRemove: true,
    exportOk: false,
    leaks: [],
    searched: 0,
  };
  const leaks = new Set<string>();
  const search = (where: string, haystack: string | Buffer) => {
    read.searched += 1;
    const text = typeof haystack === 'string' ? haystack : haystack.toString('latin1');
    if (needles.some((needle) => text.includes(needle))) leaks.add(where);
  };
  const readEnviron = (): string | null => {
    const pid = options.runtimePid();
    if (process.platform !== 'linux' || pid === undefined) return null;
    try {
      return fs.readFileSync(`/proc/${pid}/environ`, 'latin1');
    } catch {
      return null;
    }
  };

  // Inherited provider variables never reach the runtime.
  const environ = readEnviron();
  if (environ !== null) {
    read.childEnvChecked = true;
    const entries = environ.split('\0').filter(Boolean);
    for (const entry of entries) {
      const name = entry.slice(0, entry.indexOf('='));
      if (isProviderCredentialVar(name)) read.childEnvLeaks.push(name);
    }
    for (const [name, value] of inherited) if (value && environ.includes(value)) read.childEnvLeaks.push(`value of ${name}`);
  }

  let initial = await providers.getStatus();
  if (initial.codex.state === 'connected') {
    read.preexistingCodexLogin = true;
    await providers.codexLogout();
    initial = await providers.getStatus();
  }
  read.initial = { claude: initial.claude.state, codex: initial.codex.state };
  // With the shared service configured, be signed in, so the sign-out below is a real one.
  if (identity.config.kind === 'configured') await identity.session.signIn();
  const identityBefore = JSON.stringify(await identity.session.getStatus());

  const temps: string[] = [];
  try {
    const connect = (await contents.executeJavaScript(providerConnectProbe(sentinel))) as ProviderProbeRead['connect'] & { status: unknown };
    read.connect = connect;
    search('renderer provider results', JSON.stringify(connect));
    const connected = await providers.getStatus();
    read.connectedStatus = statusSummary(connected);

    const vaultFile = providers.vault.filePath;
    try {
      const bytes = fs.readFileSync(vaultFile);
      read.vault = { exists: true, mode: modeOf(vaultFile), dirMode: modeOf(path.dirname(vaultFile)), plaintext: needles.some((needle) => bytes.includes(Buffer.from(needle, 'utf8'))) };
    } catch {
      read.vault = { exists: false, mode: null, dirMode: null, plaintext: false };
    }
    read.authJson = fs.existsSync(path.join(roots['runtime-home'], 'auth.json'));
    read.identityUnchanged = JSON.stringify(await identity.session.getStatus()) === identityBefore;

    // Sign out of Inquello while both routes are connected: provider states stay.
    const beforeSignOut = JSON.stringify(statusSummary(await providers.getStatus()));
    const identityStateBefore = (await identity.session.getStatus()).identity.state;
    await identity.session.signOut();
    const identityStateAfter = (await identity.session.getStatus()).identity.state;
    read.identitySignOut = {
      identityBefore: identityStateBefore,
      identityAfter: identityStateAfter,
      providersUnchanged: JSON.stringify(statusSummary(await providers.getStatus())) === beforeSignOut,
    };
    const identityAfterSignOut = JSON.stringify(await identity.session.getStatus());

    // Everything the sentinel could leak into while it is held.
    const exported = await options.data.exportData();
    read.exportOk = exported.ok;
    if (exported.ok) {
      temps.push(path.dirname(exported.export.path));
      for (const file of filesUnder(exported.export.path)) search(`export:${path.relative(exported.export.path, file)}`, fs.readFileSync(file));
    }
    for (const root of [roots['user-data'], roots.logs]) {
      for (const file of filesUnder(root)) {
        try {
          search(`file:${file}`, fs.readFileSync(file));
        } catch {
          // Removed or unreadable while walking (Chromium holds some open).
        }
      }
    }
    try {
      search('app-server stderr log', fs.readFileSync(options.stderrLogPath));
    } catch {
      // No log yet.
    }
    const environNow = readEnviron();
    if (environNow !== null) search(`/proc/<app-server pid>/environ`, environNow);
    search('renderer', (await contents.executeJavaScript(RENDERER_DUMP)) as string);

    const disconnect = (await contents.executeJavaScript(PROVIDER_DISCONNECT_PROBE)) as ProviderProbeRead['disconnect'] & { status: unknown };
    read.disconnect = disconnect;
    search('renderer provider results', JSON.stringify(disconnect));
    const final = await providers.getStatus();
    read.finalStatus = { claude: final.claude.state, codex: final.codex.state };
    read.vaultAfterRemove = fs.existsSync(vaultFile);
    // Removing both routes left the identity as it was.
    read.identityUnchanged = read.identityUnchanged && JSON.stringify(await identity.session.getStatus()) === identityAfterSignOut;
    for (const file of filesUnder(roots['runtime-home'])) {
      try {
        search(`file:${file}`, fs.readFileSync(file));
      } catch {
        // Removed while walking.
      }
    }
  } finally {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  }
  search('main log', options.mainLog().join('\n'));
  read.leaks = [...leaks];
  return evaluateProviders(read);
}

// ---- organise (Story 1.14) ---------------------------------------------------

/** How long a Shell step may take to show up in the renderer. */
const SHELL_SETTLE_MS = 20_000;
const SMOKE_THREAD_REF = 'smoke-thread-1';
const OTHER_SMOKE_PRINCIPAL = '00000000-0000-4000-8000-00000000beef';

const SHELL_HELPERS = `
  const wait = async (predicate, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const value = predicate();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return predicate();
  };
  const q = (selector, root) => (root || document).querySelector(selector);
  const press = (selector) => {
    const element = q(selector);
    if (!element || element.getAttribute('aria-disabled') === 'true') return false;
    element.click();
    return true;
  };
  const type = (element, value) => {
    const proto = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const text = (selector) => { const element = q(selector); return element ? element.textContent : null; };
  const readHeader = () => ({
    title: text('[data-header-title]'),
    client: text('[data-header-client]'),
    period: text('[data-header-period]'),
    workspace: text('[data-header-workspace]'),
    visibility: q('[data-header-visibility]') ? q('[data-header-visibility]').getAttribute('data-header-visibility') : null,
  });
  const openShell = async () => {
    location.hash = '#shell';
    return !!(await wait(() => q('[data-sidebar]'), ${SHELL_SETTLE_MS}));
  };
`;

/** Unconfigured: the Shell shows the signed-out Sidebar and main lists nothing. */
const SHELL_SIGNED_OUT_PROBE = `(async () => {
  ${SHELL_HELPERS}
  const out = { shellOpened: await openShell() };
  out.signedOutShown = !!(await wait(() => q('[data-sidebar][data-sidebar-state="signed-out"]'), ${SHELL_SETTLE_MS}));
  out.workspaces = await globalThis.inquello.organise.getWorkspaces();
  out.shareControls = document.querySelectorAll('[data-shell] button[aria-label*="Share" i]').length;
  return out;
})()`;

/** Creates an Engagement, a folder and a Task in it through the Shell, then reads the Header. */
function shellCreateProbe(workspaceId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    const out = { shellOpened: await openShell() };
    out.ready = !!(await wait(() => q('[data-sidebar][data-sidebar-state="ready"]') && q('[data-workspace-selector][data-workspace-id=${JSON.stringify(workspaceId)}]'), ${SHELL_SETTLE_MS}));
    out.newEngagementPressed = press('[data-action="new-engagement"]');
    const form = await wait(() => q('[data-engagement-form]'), 5000);
    if (form) {
      type(q('input[name="name"]', form), 'Smoke FY26 audit');
      type(q('textarea[name="objectives"]', form), 'Opinion on the FY26 statements');
      type(q('textarea[name="scope"]', form), 'Group entities');
      type(q('input[name="clientEntity"]', form), 'Synthetic Client Ltd');
      type(q('input[name="periodStart"]', form), '2026-01-01');
      type(q('input[name="periodEnd"]', form), '2026-12-31');
      await new Promise((resolve) => setTimeout(resolve, 50));
      press('[data-engagement-form] [data-action="submit-engagement"]');
    }
    const engagement = await wait(() => q('[data-engagement-id]'), ${SHELL_SETTLE_MS});
    out.engagementId = engagement ? engagement.getAttribute('data-engagement-id') : null;
    out.engagementNotice = text('[data-engagement-notice]');
    out.newFolderPressed = press('[data-engagement-id] [data-action="new-folder"]');
    const folderForm = await wait(() => q('[data-folder-form]'), 5000);
    if (folderForm) {
      type(q('input[name="folderName"]', folderForm), 'Planning');
      await new Promise((resolve) => setTimeout(resolve, 50));
      press('[data-folder-form] [data-action="submit-folder"]');
    }
    const folder = await wait(() => q('[data-folder-id]'), ${SHELL_SETTLE_MS});
    out.folderId = folder ? folder.getAttribute('data-folder-id') : null;
    out.newTaskPressed = press('[data-folder-id] [data-action="new-folder-task"]');
    const task = await wait(() => q('[data-folder-id] [data-task-id]'), ${SHELL_SETTLE_MS});
    out.taskId = task ? task.getAttribute('data-task-id') : null;
    await wait(() => text('[data-header-client]'), 5000);
    out.header = readHeader();
    out.openTaskShown = !!q('[data-task-view] [data-thread-placeholder]');
    out.shareControls = document.querySelectorAll('[data-shell] button[aria-label*="Share" i]').length;
    return out;
  })()`;
}

/** Reopens the Shell (re-reading the tree), opens the Task and moves it to no Engagement. */
function shellMoveProbe(taskId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(() => !q('[data-shell]'), 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => q('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    out.opened = !!(await wait(() => q('[data-task-view=${JSON.stringify(taskId)}]'), 5000));
    out.headerBefore = readHeader();
    out.movePressed = press('[data-task-move] button');
    const target = await wait(() => [...document.querySelectorAll('[role="menuitemradio"]')].find((item) => item.textContent.includes('No Engagement')), 5000);
    if (target) target.click();
    out.moved = !!(await wait(() => q('[data-ad-hoc-tasks] [data-task-id=${JSON.stringify(taskId)}]'), ${SHELL_SETTLE_MS}));
    out.notice = text('[data-task-notice]');
    out.headerAfter = readHeader();
    return out;
  })()`;
}

export interface HeaderRead {
  title: string | null;
  client: string | null;
  period: string | null;
  workspace: string | null;
  visibility: string | null;
}

export interface OrganiseProbeRead {
  configured: boolean;
  signedOut?: { shellOpened: boolean; signedOutShown: boolean; workspaces: unknown; shareControls: number };
  seedRead?: boolean;
  /** The Workspace name the topology seeded; the Header must show it. */
  seedWorkspaceName?: string;
  signedIn?: boolean;
  inviteAccepted?: boolean;
  create?: {
    shellOpened: boolean;
    ready: boolean;
    newEngagementPressed: boolean;
    engagementId: string | null;
    engagementNotice: string | null;
    newFolderPressed: boolean;
    folderId: string | null;
    newTaskPressed: boolean;
    taskId: string | null;
    header: HeaderRead;
    openTaskShown: boolean;
    shareControls: number;
  };
  attached?: boolean;
  before?: TaskView | null;
  move?: { shellOpened: boolean; opened: boolean; headerBefore: HeaderRead; movePressed: boolean; moved: boolean; notice: string | null; headerAfter: HeaderRead };
  after?: TaskView | null;
  listedForCreator?: boolean;
  listedForOtherPrincipal?: number;
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface OrganiseReport extends OrganiseProbeRead {
  ok: boolean;
  failures: string[];
}

/** Pass/fail for the organise probe. */
export function evaluateOrganise(read: OrganiseProbeRead): OrganiseReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) {
    const view = read.signedOut?.workspaces as { signedIn?: unknown; workspaces?: unknown[] } | undefined;
    if (!read.signedOut?.shellOpened) failures.push('the Shell did not open');
    if (!read.signedOut?.signedOutShown) failures.push('the Sidebar did not show the signed-out state');
    if (view?.signedIn !== false || (view.workspaces ?? []).length !== 0) failures.push('main listed Workspaces while signed out');
    if (read.signedOut?.shareControls !== 0) failures.push('a Share control is shown');
    return { ok: failures.length === 0, failures, ...read };
  }
  if (!read.seedRead) failures.push('the dev topology seed file (INQUELLO_SMOKE_SEED) could not be read');
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.inviteAccepted) failures.push('the seeded Workspace invite was not accepted');
  const create = read.create;
  if (!create?.shellOpened || !create.ready) failures.push('the Shell did not show the seeded Workspace');
  if (!create?.engagementId) failures.push(`no Engagement was created through the Sidebar${create?.engagementNotice ? ` (${create.engagementNotice})` : ''}`);
  if (!create?.folderId) failures.push('no folder was created through the Sidebar');
  if (!create?.taskId) failures.push('no Task was created in the folder through the Sidebar');
  if (create?.header.title !== 'Untitled thread') failures.push(`the Header title is ${JSON.stringify(create?.header.title)}`);
  if (create?.header.client !== 'Synthetic Client Ltd') failures.push(`the Header client is ${JSON.stringify(create?.header.client)}`);
  if (create?.header.period !== '2026-01-01 – 2026-12-31') failures.push(`the Header period is ${JSON.stringify(create?.header.period)}`);
  if (!read.seedWorkspaceName || create?.header.workspace !== read.seedWorkspaceName) {
    failures.push(`the Header Workspace is ${JSON.stringify(create?.header.workspace)}, expected ${JSON.stringify(read.seedWorkspaceName)}`);
  }
  if (create?.header.visibility !== 'private') failures.push('the Header does not show the Task as private');
  if (!create?.openTaskShown) failures.push('the opened Task did not show its placeholder thread area');
  if (create?.shareControls !== 0) failures.push('a Share control is shown');
  if (!read.attached) failures.push('the synthetic thread ref could not be attached');
  const before = read.before;
  const after = read.after;
  if (!read.move?.moved) failures.push(`the Task was not moved through the Move menu${read.move?.notice ? ` (${read.move.notice})` : ''}`);
  if (!before || !after) failures.push('the Task could not be read before and after the move');
  else {
    if (after.taskId !== before.taskId) failures.push('the move changed the Task ID');
    if (after.runtimeThreadId !== SMOKE_THREAD_REF || before.runtimeThreadId !== SMOKE_THREAD_REF) failures.push('the move changed the thread ref');
    if (JSON.stringify(after.sourceRefs) !== JSON.stringify(before.sourceRefs) || JSON.stringify(after.artifactRefs) !== JSON.stringify(before.artifactRefs)) {
      failures.push('the move changed the references');
    }
    if (after.visibility !== 'private') failures.push('the Task is not private after the move');
    if (after.engagementId !== null || after.folderId !== null) failures.push('the Task did not move to no Engagement');
  }
  if (read.move && (read.move.headerAfter.client !== null || read.move.headerAfter.period !== null)) failures.push('an ad hoc Task still shows a client or period');
  if (!read.listedForCreator) failures.push('the Task is not listed for its creator');
  if (read.listedForOtherPrincipal !== 0) failures.push(`another principal sees ${read.listedForOtherPrincipal} Task(s)`);
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

export interface OrganiseProbeOptions {
  identity: IdentityWiring;
  organise: OrganiseService;
  /** The dev topology's `--seed-out` file; required when the shared service is configured. */
  seedFile: string | null;
  /** A raw runtime request, for binding a second principal. */
  runtimeRequest: <T>(method: string, params?: unknown) => Promise<T>;
}

/** Runs the organise probe against the live renderer, main's organise service and the runtime. */
export async function probeOrganise(contents: WebContents, options: OrganiseProbeOptions): Promise<OrganiseReport> {
  const { identity, organise, runtimeRequest } = options;
  const configured = identity.config.kind === 'configured';
  const read: OrganiseProbeRead = { configured };
  if (!configured) {
    read.signedOut = (await contents.executeJavaScript(SHELL_SIGNED_OUT_PROBE)) as OrganiseProbeRead['signedOut'];
    return evaluateOrganise(read);
  }
  try {
    let seed: { workspace_id?: unknown; invite_id?: unknown; workspace_name?: unknown } = {};
    try {
      seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
    } catch {
      seed = {};
    }
    const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
    const inviteId = typeof seed.invite_id === 'string' ? seed.invite_id : null;
    if (typeof seed.workspace_name === 'string') read.seedWorkspaceName = seed.workspace_name;
    read.seedRead = workspaceId !== null && inviteId !== null;
    if (!workspaceId || !inviteId) return evaluateOrganise(read);

    read.signedIn = (await identity.session.signIn()).ok;
    await organise.syncPrincipal();
    const service = identity.service;
    const accepted = service ? await identity.session.withAccess((access) => service.acceptInvite(access, inviteId)) : null;
    read.inviteAccepted = accepted?.workspace_id === workspaceId;

    read.create = (await contents.executeJavaScript(shellCreateProbe(workspaceId))) as OrganiseProbeRead['create'];
    const taskId = read.create?.taskId ?? null;
    if (!taskId) return evaluateOrganise(read);

    const findTask = async (): Promise<TaskView | null> => {
      const tree = await organise.getTree(workspaceId);
      return tree.ok ? (tree.value.tasks.find((task) => task.taskId === taskId) ?? null) : null;
    };
    const created = await findTask();
    const attached = created
      ? await organise.attachThread({ operationId: randomUUID(), workspaceId, taskId, expectedRevision: created.revision, runtimeThreadId: SMOKE_THREAD_REF })
      : null;
    read.attached = attached?.ok === true;
    read.before = await findTask();
    read.move = (await contents.executeJavaScript(shellMoveProbe(taskId))) as OrganiseProbeRead['move'];
    read.after = await findTask();
    read.listedForCreator = read.after !== null;

    // A second principal bound to the same runtime lists none of these Tasks.
    await runtimeRequest('inquello/session/setPrincipal', { principalId: OTHER_SMOKE_PRINCIPAL });
    try {
      const other = await runtimeRequest<{ tasks: unknown[] }>('inquello/workspace/tree', { workspaceId });
      read.listedForOtherPrincipal = other.tasks.length;
    } finally {
      await runtimeRequest('inquello/session/setPrincipal', { principalId: identity.session.principalId() });
    }
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const signOut = await identity.session.signOut().catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluateOrganise(read);
}

// ---- states (Story 1.15) ------------------------------------------------------

const SMOKE_RUN_REF = 'smoke-run-1';
const STATE_DIMENSION_NAMES = ['task', 'run', 'output', 'checks', 'review', 'approval_marker', 'delivery_marker'] as const;

/** Signed out: listing is refused by main and a review write never passes the validator. */
const STATES_SIGNED_OUT_PROBE = `(async () => {
  const out = {};
  out.list = await globalThis.inquello.state.list({ taskId: '00000000-0000-4000-8000-000000000001' });
  out.reviewWrite = await globalThis.inquello.state
    .recordTaskState({ operationId: '00000000-0000-4000-8000-000000000002', taskId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0, dimension: 'review', value: 'requested', runId: null })
    .then(() => 'accepted', (error) => String(error && error.message));
  return out;
})()`;

/** Records task planned → running and run execution_finished through the renderer bridge, then tries a review write. */
function statesRecordProbe(taskId: string, operationIds: readonly string[]): string {
  return `(async () => {
    const taskId = ${JSON.stringify(taskId)};
    const ops = ${JSON.stringify(operationIds)};
    const record = (operationId, expectedRevision, dimension, value, runId) =>
      globalThis.inquello.state.recordTaskState({ operationId, taskId, expectedRevision, dimension, value, runId });
    const out = { writes: [] };
    out.writes.push(await record(ops[0], 0, 'task', 'planned', null));
    out.writes.push(await record(ops[1], 1, 'task', 'running', null));
    out.writes.push(await record(ops[2], 2, 'run', 'execution_finished', ${JSON.stringify(SMOKE_RUN_REF)}));
    out.reviewWrite = await record(ops[3], 3, 'review', 'requested', null).then(() => 'accepted', (error) => String(error && error.message));
    return out;
  })()`;
}

/** Opens the Task in the Shell and reads its States section. */
function statesViewProbe(taskId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(() => !q('[data-shell]'), 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => q('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    out.opened = !!(await wait(() => q('[data-task-view=${JSON.stringify(taskId)}]'), 5000));
    out.shown = !!(await wait(() => q('[data-task-states] [data-state-dimension="run"][data-state-value="execution_finished"]'), ${SHELL_SETTLE_MS}));
    out.dimensions = [...document.querySelectorAll('[data-task-states] [data-state-dimension]')].map((row) => ({
      dimension: row.getAttribute('data-state-dimension'),
      value: row.getAttribute('data-state-value'),
      text: (q('dd', row) || row).textContent,
    }));
    const chip = q('[data-task-states] [data-state-dimension="run"] .iq-status-chip');
    if (chip) {
      const reference = document.createElement('span');
      reference.className = 'iq-status-chip iq-status-chip--accepted';
      document.body.appendChild(reference);
      const style = getComputedStyle(chip);
      const accepted = getComputedStyle(reference);
      out.runChip = {
        text: chip.textContent,
        className: chip.className,
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopColor,
        acceptedColor: accepted.color,
        acceptedBackground: accepted.backgroundColor,
        acceptedBorder: accepted.borderTopColor,
      };
      reference.remove();
    }
    const shellRoot = q('[data-shell]');
    out.acceptedChips = shellRoot ? shellRoot.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained').length : -1;
    out.acceptanceText = shellRoot ? /\\baccept|\\bapproved\\b/i.test(shellRoot.textContent) : true;
    out.toasts = [...document.querySelectorAll('.iq-toast')].map((toast) => toast.textContent);
    return out;
  })()`;
}

export interface StatesProbeRead {
  configured: boolean;
  signedOut?: { list: unknown; reviewWrite: string };
  seedRead?: boolean;
  signedIn?: boolean;
  taskCreated?: boolean;
  record?: { writes: unknown[]; reviewWrite: string };
  runtimeReviewRefusal?: string | null;
  view?: {
    shellOpened: boolean;
    opened: boolean;
    shown: boolean;
    dimensions: Array<{ dimension: string | null; value: string | null; text: string | null }>;
    runChip?: { text: string | null; className: string; color: string; background: string; border: string; acceptedColor: string; acceptedBackground: string; acceptedBorder: string };
    acceptedChips: number;
    acceptanceText: boolean;
    toasts: string[];
  };
  listed?: { revision: number; task: string[]; run: string[]; others: number } | null;
  otherPrincipalRefusal?: string | null;
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface StatesReport extends StatesProbeRead {
  ok: boolean;
  failures: string[];
}

/** True when an `rgb(...)`/`rgba(...)` colour is visibly green-dominant. */
export function isGreenish(color: string): boolean {
  const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
  if (parts.length < 3) return false;
  const [r, g, b, a = 1] = parts as [number, number, number, number?];
  return a > 0 && g > r + 24 && g > b + 24;
}

/** Pass/fail for the states probe. */
export function evaluateStates(read: StatesProbeRead): StatesReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) {
    const list = read.signedOut?.list as { ok?: unknown; code?: unknown } | undefined;
    if (list?.ok !== false || list.code !== 'signed-out') failures.push('main listed Task states while signed out');
    if (!read.signedOut?.reviewWrite.includes('invalid payload')) failures.push(`a review write was not refused by main (${read.signedOut?.reviewWrite})`);
    return { ok: failures.length === 0, failures, ...read };
  }
  if (!read.seedRead) failures.push('the dev topology seed file (INQUELLO_SMOKE_SEED) could not be read');
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.taskCreated) failures.push('no Task was created for the states probe');
  const writes = read.record?.writes ?? [];
  if (writes.length !== 3 || !writes.every((write) => (write as { ok?: unknown }).ok === true)) {
    failures.push(`task planned → running and run execution_finished were not all recorded (${JSON.stringify(writes)})`);
  }
  if (!read.record?.reviewWrite.includes('invalid payload')) failures.push(`a review write through the renderer was not refused (${read.record?.reviewWrite})`);
  if (read.runtimeReviewRefusal !== 'human_actor_required') failures.push(`a system review write reached the runtime and answered ${JSON.stringify(read.runtimeReviewRefusal)}`);
  const view = read.view;
  if (!view?.shellOpened || !view.opened) failures.push('the Task did not open in the Shell');
  if (!view?.shown) failures.push('the States section did not show the finished run');
  const rows = new Map((view?.dimensions ?? []).map((row) => [row.dimension, row]));
  if (JSON.stringify([...rows.keys()]) !== JSON.stringify(STATE_DIMENSION_NAMES)) failures.push(`the States section lists ${JSON.stringify([...rows.keys()])}`);
  const run = rows.get('run');
  if (!run?.text?.includes('Execution finished')) failures.push(`the run state reads ${JSON.stringify(run?.text)}`);
  const task = rows.get('task');
  if (task?.value !== 'running' || !task.text?.includes('Running') || !task.text.includes('Planned')) failures.push(`the Task state reads ${JSON.stringify(task?.text)}`);
  for (const dimension of STATE_DIMENSION_NAMES.slice(2)) {
    const row = rows.get(dimension);
    if (row?.value !== 'not-recorded' || row.text?.trim() !== 'Not recorded') failures.push(`${dimension} is not shown as "Not recorded" (${JSON.stringify(row?.text)})`);
  }
  const chip = view?.runChip;
  if (!chip) failures.push('the run state has no chip');
  else {
    if (chip.text !== 'Execution finished') failures.push(`the run chip reads ${JSON.stringify(chip.text)}`);
    if (!chip.className.includes('iq-status-chip--other') || /--accepted|--explained/.test(chip.className)) failures.push(`the run chip is styled ${chip.className}`);
    if (chip.color === chip.acceptedColor || chip.background === chip.acceptedBackground || chip.border === chip.acceptedBorder) failures.push('the run chip shares the accepted style');
    if (isGreenish(chip.color) || isGreenish(chip.background) || isGreenish(chip.border)) failures.push('the run chip is green');
  }
  if (view?.acceptedChips !== 0) failures.push('an accepted or explained chip is shown');
  if (view?.acceptanceText !== false) failures.push('the Shell states acceptance or approval');
  if ((view?.toasts ?? []).some((toast) => /accept|approv/i.test(toast))) failures.push('a toast states acceptance');
  const listed = read.listed;
  if (!listed) failures.push('main could not list the Task states');
  else {
    if (listed.revision !== 3) failures.push(`the Task state revision is ${listed.revision}`);
    if (JSON.stringify(listed.task) !== JSON.stringify(['running', 'planned'])) failures.push(`the Task state history is ${JSON.stringify(listed.task)}`);
    if (JSON.stringify(listed.run) !== JSON.stringify(['execution_finished'])) failures.push(`the run state history is ${JSON.stringify(listed.run)}`);
    if (listed.others !== 0) failures.push('a dimension other than task and run has a record');
  }
  if (read.otherPrincipalRefusal !== 'not_found') failures.push(`another principal listing the states got ${JSON.stringify(read.otherPrincipalRefusal)}`);
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

/** The `data.inquello.kind` of a runtime refusal, or null. */
function refusalKind(error: unknown): string | null {
  const data = (error as { data?: { inquello?: { kind?: unknown } } } | null)?.data?.inquello;
  return typeof data?.kind === 'string' ? data.kind : null;
}

/** Runs the states probe against the live renderer, main's organise service and the runtime. */
export async function probeStates(contents: WebContents, options: OrganiseProbeOptions): Promise<StatesReport> {
  const { identity, organise, runtimeRequest } = options;
  const configured = identity.config.kind === 'configured';
  const read: StatesProbeRead = { configured };
  if (!configured) {
    read.signedOut = (await contents.executeJavaScript(STATES_SIGNED_OUT_PROBE)) as StatesProbeRead['signedOut'];
    return evaluateStates(read);
  }
  try {
    let seed: { workspace_id?: unknown } = {};
    try {
      seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
    } catch {
      seed = {};
    }
    const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
    read.seedRead = workspaceId !== null;
    if (!workspaceId) return evaluateStates(read);

    read.signedIn = (await identity.session.signIn()).ok;
    await organise.syncPrincipal();
    // The Shell lists only Workspaces the service names; this also remembers them.
    await organise.getWorkspaces();
    const created = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke states' });
    read.taskCreated = created.ok;
    if (!created.ok) return evaluateStates(read);
    const taskId = created.value.taskId;

    read.record = (await contents.executeJavaScript(statesRecordProbe(taskId, [randomUUID(), randomUUID(), randomUUID(), randomUUID()]))) as StatesProbeRead['record'];
    try {
      await runtimeRequest('inquello/state/record', {
        operationId: randomUUID(),
        expectedRevision: 3,
        taskId,
        dimension: 'review',
        scopeKind: 'task',
        scopeId: taskId,
        value: 'requested',
        actorKind: 'system',
        actorRef: 'inquello-desktop',
      });
      read.runtimeReviewRefusal = null;
    } catch (error) {
      read.runtimeReviewRefusal = refusalKind(error) ?? (error as Error).message;
    }

    read.view = (await contents.executeJavaScript(statesViewProbe(taskId))) as StatesProbeRead['view'];
    const listed = await organise.listStates(taskId);
    read.listed = listed.ok
      ? {
          revision: listed.value.revision,
          task: listed.value.dimensions.find((entry) => entry.dimension === 'task')?.records.map((record) => record.value) ?? [],
          run: listed.value.dimensions.find((entry) => entry.dimension === 'run')?.records.map((record) => record.value) ?? [],
          others: listed.value.dimensions.filter((entry) => entry.dimension !== 'task' && entry.dimension !== 'run').reduce((sum, entry) => sum + entry.records.length, 0),
        }
      : null;

    // A second principal bound to the same runtime is refused like an unknown Task.
    await runtimeRequest('inquello/session/setPrincipal', { principalId: OTHER_SMOKE_PRINCIPAL });
    try {
      await runtimeRequest('inquello/state/list', { taskId });
      read.otherPrincipalRefusal = null;
    } catch (error) {
      read.otherPrincipalRefusal = refusalKind(error) ?? (error as Error).message;
    } finally {
      await runtimeRequest('inquello/session/setPrincipal', { principalId: identity.session.principalId() });
    }
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const signOut = await identity.session.signOut().catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluateStates(read);
}

// ---- shell layout (Story 1.16) ---------------------------------------------------

/**
 * The renderer's layout numbers (`src/renderer/Shell/layout.ts`), which main
 * cannot import; `test/shell-layout.test.tsx` holds the two equal.
 */
export const SHELL_LAYOUT = {
  windowMinWidth: 532,
  sidebarWidth: 264,
  railWidth: 52,
  headerHeight: 48,
  threadMaxWidth: 720,
  /** The narrowest width that is still full mode without an artifact. */
  fullWidth: 744,
  /** The narrowest width where the thread and a 380px artifact fit beside the rail. */
  artifactFitWidth: 912,
} as const;

/** The window content widths the probe resizes to. */
export const SHELL_LAYOUT_WIDTHS = { full: 1200, rail: 700, single: 600, minimum: SHELL_LAYOUT.windowMinWidth } as const;
const LAYOUT_SETTLE_MS = 5_000;

const SHELL_LAYOUT_READ = `(() => {
  const q = (selector) => document.querySelector(selector);
  const frame = q('[data-shell]');
  const nav = q('nav[data-sidebar]');
  const header = q('[data-header]');
  const content = q('main .iq-shell-content');
  const root = document.documentElement;
  return {
    innerWidth: window.innerWidth,
    mode: frame ? frame.getAttribute('data-layout-mode') : null,
    presentation: frame ? frame.getAttribute('data-nav-presentation') : null,
    artifactOpen: frame ? frame.getAttribute('data-artifact-open') : null,
    artifactFits: frame ? frame.getAttribute('data-artifact-fits') : null,
    navWidth: nav ? nav.getBoundingClientRect().width : null,
    headerHeight: header ? header.getBoundingClientRect().height : null,
    threadMaxWidth: content ? getComputedStyle(content).maxWidth : null,
    threadWidth: content ? content.getBoundingClientRect().width : null,
    scroll: { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, bodyScrollWidth: document.body.scrollWidth, bodyClientWidth: document.body.clientWidth },
    landmarks: {
      navigation: document.querySelectorAll('nav[aria-label="Workspace navigation"], [role="navigation"]').length,
      main: document.querySelectorAll('main, [role="main"]').length,
      complementary: document.querySelectorAll('aside, [role="complementary"]').length,
      announcers: document.querySelectorAll('[data-shell-announcer][aria-live="polite"]').length,
    },
    artifactArea: !!q('[data-artifact-area]'),
    taskViewId: q('[data-task-view]') ? q('[data-task-view]').getAttribute('data-task-view') : null,
    currentMarked: !!q('nav[data-sidebar] [aria-current="page"]'),
  };
})()`;

/** Signs in state permitting, opens the given Task (or just the Shell) and waits for it. */
function shellLayoutOpenProbe(taskId: string | null): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(() => !q('[data-shell]'), 5000);
    const out = { shellOpened: await openShell() };
    if (${JSON.stringify(taskId)}) {
      const row = await wait(() => q('[data-task-id=${JSON.stringify(taskId ?? '')}] a'), ${SHELL_SETTLE_MS});
      if (row) row.click();
      out.opened = !!(await wait(() => q('[data-task-view=${JSON.stringify(taskId ?? '')}]'), 5000));
    }
    return out;
  })()`;
}

/** Before the real key presses: records whether each K keydown ends handled, and focuses nothing. */
const SHELL_KEYS_PREPARE = `(() => {
  const record = [];
  Object.defineProperty(document, '__iqSmokeKeys', { value: record, configurable: true });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'k' || event.key === 'K') setTimeout(() => record.push(event.defaultPrevented), 0);
  });
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  return document.querySelectorAll('[data-task-id]').length;
})()`;

const SHELL_KEYS_READ = `(() => ({ handled: [...(document.__iqSmokeKeys || [])], tasks: document.querySelectorAll('[data-task-id]').length }))()`;

const SHELL_RAIL_READ = `(() => {
  const q = (selector) => document.querySelector(selector);
  const announcer = q('[data-shell-announcer]');
  return {
    presentation: q('[data-shell]') ? q('[data-shell]').getAttribute('data-nav-presentation') : null,
    count: Number(announcer ? announcer.getAttribute('data-announce-count') : NaN),
    text: announcer ? announcer.textContent : null,
    focus: document.activeElement ? document.activeElement.getAttribute('data-action') : null,
    currentMarked: !!q('nav[data-sidebar] [aria-current="page"]'),
  };
})()`;

const focusAction = (action: string) => `(() => { const el = document.querySelector('[data-sidebar] [data-action="${action}"]'); if (el) el.focus(); return !!el && document.activeElement === el; })()`;

interface RailRead {
  presentation: string | null;
  count: number;
  text: string | null;
  focus: string | null;
  currentMarked: boolean;
}

/** Presses a key in the renderer through real input events. */
async function pressKey(contents: WebContents, keyCode: string, modifiers: Array<'control' | 'meta'> = []): Promise<void> {
  contents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  if (keyCode === 'Return') contents.sendInputEvent({ type: 'char', keyCode: '\r', modifiers });
  contents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** Ctrl+K and Cmd+K go unhandled; Enter on Collapse, then on Expand, toggles the rail with one announcement each. */
async function probeShellKeys(contents: WebContents): Promise<NonNullable<ShellLayoutProbeRead['keys']>> {
  contents.focus();
  const tasksBefore = (await contents.executeJavaScript(SHELL_KEYS_PREPARE)) as number;
  await pressKey(contents, 'K', ['control']);
  await pressKey(contents, 'K', ['meta']);
  const keys = (await contents.executeJavaScript(SHELL_KEYS_READ)) as { handled: boolean[]; tasks: number };
  const out: NonNullable<ShellLayoutProbeRead['keys']> = { ctrlK: keys.handled, ctrlKCreatedTask: keys.tasks !== tasksBefore, rail: null };
  if (!(await contents.executeJavaScript(focusAction('collapse-nav')))) return out;
  const before = (await contents.executeJavaScript(SHELL_RAIL_READ)) as RailRead;
  await pressKey(contents, 'Return');
  const collapsed = (await contents.executeJavaScript(SHELL_RAIL_READ)) as RailRead;
  await pressKey(contents, 'Return');
  const expanded = (await contents.executeJavaScript(SHELL_RAIL_READ)) as RailRead;
  out.rail = {
    collapsed: {
      presentation: collapsed.presentation,
      announced: collapsed.count - before.count,
      text: collapsed.text,
      focusOnExpand: collapsed.focus === 'expand-nav',
      currentMarked: collapsed.currentMarked,
    },
    expandedPresentation: expanded.presentation,
    expandAnnounced: expanded.count - collapsed.count,
  };
  return out;
}

const SHELL_THEME_READ = `(() => {
  const frame = document.querySelector('[data-shell]');
  const main = document.querySelector('main');
  return {
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    body: getComputedStyle(document.body).backgroundColor,
    shell: frame ? getComputedStyle(frame).backgroundColor : null,
    main: main ? getComputedStyle(main.closest('.iq-shell-main') || main).color : null,
  };
})()`;

export interface ShellLayoutRead {
  innerWidth: number;
  mode: string | null;
  presentation: string | null;
  artifactOpen: string | null;
  artifactFits: string | null;
  navWidth: number | null;
  headerHeight: number | null;
  threadMaxWidth: string | null;
  threadWidth: number | null;
  scroll: { scrollWidth: number; clientWidth: number; bodyScrollWidth: number; bodyClientWidth: number };
  landmarks: { navigation: number; main: number; complementary: number; announcers: number };
  artifactArea: boolean;
  taskViewId: string | null;
  currentMarked: boolean;
}

export interface ShellLayoutProbeRead {
  configured: boolean;
  signedIn?: boolean;
  taskId?: string | null;
  open?: { shellOpened: boolean; opened?: boolean };
  widths?: Partial<Record<keyof typeof SHELL_LAYOUT_WIDTHS, ShellLayoutRead | null>>;
  keys?: {
    ctrlK: boolean[];
    ctrlKCreatedTask: boolean;
    rail: { collapsed: { presentation: string | null; announced: number; text: string | null; focusOnExpand: boolean; currentMarked: boolean }; expandedPresentation: string | null; expandAnnounced: number } | null;
  };
  theme?: { dark: boolean; body: string; shell: string | null; main: string | null } | null;
  themeError?: string | null;
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface ShellLayoutReport extends ShellLayoutProbeRead {
  ok: boolean;
  failures: string[];
}

const WHITE = 'rgb(255, 255, 255)';

/** Pass/fail for the shell-layout probe. */
export function evaluateShellLayout(read: ShellLayoutProbeRead): ShellLayoutReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.open?.shellOpened) failures.push('the Shell did not open');
  if (read.configured) {
    if (!read.signedIn) failures.push('the synthetic user did not sign in');
    if (!read.taskId || !read.open?.opened) failures.push('the synthetic Task did not open in the Shell');
  }
  const expected: Record<keyof typeof SHELL_LAYOUT_WIDTHS, { mode: string; nav: number }> = {
    full: { mode: 'full', nav: SHELL_LAYOUT.sidebarWidth },
    rail: { mode: 'rail', nav: SHELL_LAYOUT.railWidth },
    single: { mode: 'rail', nav: SHELL_LAYOUT.railWidth },
    minimum: { mode: 'rail', nav: SHELL_LAYOUT.railWidth },
  };
  for (const name of Object.keys(SHELL_LAYOUT_WIDTHS) as Array<keyof typeof SHELL_LAYOUT_WIDTHS>) {
    const at = read.widths?.[name];
    const width = SHELL_LAYOUT_WIDTHS[name];
    if (!at) {
      failures.push(`the ${name} width (${width}px) was not read`);
      continue;
    }
    const where = `at ${width}px (${name})`;
    if (at.innerWidth !== width) failures.push(`${where} the window is ${at.innerWidth}px wide`);
    if (at.mode !== expected[name].mode) failures.push(`${where} the layout mode is ${JSON.stringify(at.mode)}`);
    if (at.navWidth === null || Math.abs(at.navWidth - expected[name].nav) > 0.5) failures.push(`${where} the navigation is ${at.navWidth}px wide, expected ${expected[name].nav}px`);
    if (at.headerHeight === null || Math.abs(at.headerHeight - SHELL_LAYOUT.headerHeight) > 0.5) failures.push(`${where} the Header is ${at.headerHeight}px high`);
    if (at.threadMaxWidth !== `${SHELL_LAYOUT.threadMaxWidth}px`) failures.push(`${where} the thread maximum width is ${JSON.stringify(at.threadMaxWidth)}`);
    if (at.threadWidth === null || at.threadWidth > SHELL_LAYOUT.threadMaxWidth + 0.5) failures.push(`${where} the thread is ${at.threadWidth}px wide`);
    if (at.scroll.scrollWidth > at.scroll.clientWidth || at.scroll.bodyScrollWidth > at.scroll.bodyClientWidth) failures.push(`${where} the page overflows horizontally (${JSON.stringify(at.scroll)})`);
    if (at.landmarks.navigation !== 1 || at.landmarks.main !== 1 || at.landmarks.announcers !== 1) failures.push(`${where} the landmarks are ${JSON.stringify(at.landmarks)}`);
    if (at.landmarks.complementary !== 0 || at.artifactArea || at.artifactOpen !== 'false') failures.push(`${where} an artifact area is open`);
    const fits = width >= SHELL_LAYOUT.artifactFitWidth ? 'true' : 'false';
    if (at.artifactFits !== fits) failures.push(`${where} the Shell reports the artifact ${at.artifactFits === 'true' ? 'fits' : 'does not fit'}; expected ${fits}`);
    if (read.configured) {
      if (at.taskViewId !== read.taskId) failures.push(`${where} the open Task changed to ${JSON.stringify(at.taskViewId)}`);
      if (!at.currentMarked) failures.push(`${where} the open Task is not marked in the navigation`);
    }
  }
  const keys = read.keys;
  if (!keys) failures.push('the keyboard checks did not run');
  else {
    if (keys.ctrlK.length !== 2 || keys.ctrlK.some(Boolean)) failures.push(`Ctrl/Cmd+K was handled (${JSON.stringify(keys.ctrlK)})`);
    if (keys.ctrlKCreatedTask) failures.push('Ctrl/Cmd+K changed the Task list');
    const rail = keys.rail;
    if (!rail) failures.push('the Collapse navigation control was not found');
    else {
      if (rail.collapsed.presentation !== 'rail') failures.push('Collapse navigation did not show the rail');
      if (rail.collapsed.announced !== 1) failures.push(`collapsing was announced ${rail.collapsed.announced} times`);
      if (!rail.collapsed.focusOnExpand) failures.push('focus did not move to Expand navigation after collapsing');
      if (read.configured && !rail.collapsed.currentMarked) failures.push('the rail does not mark the open Task');
      if (rail.expandedPresentation !== 'sidebar' || rail.expandAnnounced !== 1) failures.push('Expand navigation did not restore the Sidebar with one announcement');
    }
  }
  if (read.themeError) failures.push(`the dark-preference check failed: ${read.themeError}`);
  else if (!read.theme?.dark) failures.push('the dark colour-scheme preference was not emulated');
  else if (read.theme.body !== WHITE || read.theme.shell !== WHITE) failures.push(`under a dark preference the Shell is not light (${JSON.stringify(read.theme)})`);
  if (read.configured && !read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

export interface ShellLayoutProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> {
  /** Resizes the real window's content area (smoke-only). */
  resize: (width: number, height: number) => void;
  /** The content size to restore afterwards. */
  restore: { width: number; height: number };
}

/** Runs the shell-layout probe against the live renderer and the real window. */
export async function probeShellLayout(contents: WebContents, options: ShellLayoutProbeOptions): Promise<ShellLayoutReport> {
  const { identity, organise } = options;
  const configured = identity.config.kind === 'configured';
  const read: ShellLayoutProbeRead = { configured, widths: {} };
  try {
    let taskId: string | null = null;
    if (configured) {
      let seed: { workspace_id?: unknown } = {};
      try {
        seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
      } catch {
        seed = {};
      }
      const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
      read.signedIn = (await identity.session.signIn()).ok;
      await organise.syncPrincipal();
      await organise.getWorkspaces();
      if (workspaceId) {
        const created = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke layout' });
        taskId = created.ok ? created.value.taskId : null;
      }
    }
    read.taskId = taskId;
    read.open = (await contents.executeJavaScript(shellLayoutOpenProbe(taskId))) as ShellLayoutProbeRead['open'];

    for (const name of Object.keys(SHELL_LAYOUT_WIDTHS) as Array<keyof typeof SHELL_LAYOUT_WIDTHS>) {
      const width = SHELL_LAYOUT_WIDTHS[name];
      options.resize(width, options.restore.height);
      const deadline = Date.now() + LAYOUT_SETTLE_MS;
      let at = (await contents.executeJavaScript(SHELL_LAYOUT_READ)) as ShellLayoutRead;
      while (at.innerWidth !== width && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        at = (await contents.executeJavaScript(SHELL_LAYOUT_READ)) as ShellLayoutRead;
      }
      // One more frame for React to apply the new mode.
      await new Promise((resolve) => setTimeout(resolve, 200));
      read.widths![name] = (await contents.executeJavaScript(SHELL_LAYOUT_READ)) as ShellLayoutRead;
    }

    options.resize(options.restore.width, options.restore.height);
    await new Promise((resolve) => setTimeout(resolve, 300));
    read.keys = await probeShellKeys(contents);

    const cdp = contents.debugger;
    try {
      cdp.attach('1.3');
      try {
        await cdp.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
        await new Promise((resolve) => setTimeout(resolve, MOTION_SETTLE_MS));
        read.theme = (await contents.executeJavaScript(SHELL_THEME_READ)) as ShellLayoutProbeRead['theme'];
      } finally {
        await cdp.sendCommand('Emulation.setEmulatedMedia', { features: [] }).catch(() => undefined);
        cdp.detach();
      }
      read.themeError = null;
    } catch (error) {
      read.themeError = (error as Error).message;
    }
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    try {
      options.resize(options.restore.width, options.restore.height);
    } catch {
      // The window may already be gone.
    }
    if (configured) {
      const signOut = await identity.session.signOut().catch(() => ({ ok: false }));
      await organise.syncPrincipal().catch(() => undefined);
      read.signedOutAtEnd = signOut.ok;
    }
  }
  return evaluateShellLayout(read);
}
