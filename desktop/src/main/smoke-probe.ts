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
 */
import type { WebContents } from 'electron';

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

/** The tree `window.inquello` must expose, as `describe` renders it. */
export const EXPECTED_BRIDGE_TREE = { runtime: { getStatus: 'function' } } as const;

/** Globals that must not exist in the renderer's main world. */
export const FORBIDDEN_GLOBALS = ['require', 'process', 'module', 'exports', 'Buffer', 'global', 'ipcRenderer', 'electron'] as const;

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
  result.bridgeFrozen = Object.isFrozen(globalThis.inquello) && Object.isFrozen(globalThis.inquello && globalThis.inquello.runtime);
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
  const settled = (design) => design.decorativeIcon && design.informativeIcon && design.fonts.every((font) => font.statuses.includes('loaded'));
  const deadline = Date.now() + ${DESIGN_SETTLE_MS};
  await document.fonts.ready;
  let design = readDesign();
  while (!settled(design) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await document.fonts.ready;
    design = readDesign();
  }
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

export interface DesignProbeResult {
  title: string | null;
  fonts: FontProbe[];
  decorativeIcon: IconProbe;
  informativeIcon: IconProbe;
}

export interface DesignReport {
  ok: boolean;
  failures: string[];
  title: string | null;
  fonts: Array<{ family: string; weight: number; loaded: boolean; check: boolean }>;
  decorativeIcon: IconProbe;
  informativeIcon: IconProbe;
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

/** Pass/fail for the design specimen: all five faces loaded, both icons with the right semantics. */
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
  return {
    ok: failures.length === 0,
    failures,
    title: probe?.title ?? null,
    fonts,
    decorativeIcon: decorative,
    informativeIcon: informative,
  };
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
