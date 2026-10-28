/**
 * `--smoke` renderer privilege probe (AD-5).
 *
 * Runs a script in the live renderer's main world and reports what the page
 * can reach: Node globals, the exact `window.inquello` tree, the result of
 * `runtime.getStatus`, and whether `window.open`, `fetch` and a top-level
 * navigation get through. `evaluatePrivileges` is pure and decides pass/fail.
 */
import type { WebContents } from 'electron';

import type { BlockedKind } from './security/policy';

const PROBE_TARGET = 'https://example.com/';
const NAVIGATION_SETTLE_MS = 500;

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
): Promise<PrivilegeReport> {
  await waitForLoad(contents);
  const url = contents.getURL();
  const probe = (await contents.executeJavaScript(RENDERER_PROBE)) as RendererProbeResult;
  const before = blocked.length;
  await contents.executeJavaScript(`location.href = ${JSON.stringify(PROBE_TARGET)}; true`);
  await new Promise((resolve) => setTimeout(resolve, NAVIGATION_SETTLE_MS));
  // Whichever hook fires first (`will-frame-navigate` or `will-navigate`) prevents it.
  const navigationLogged = blocked
    .slice(before)
    .some((entry) => (entry.kind === 'navigation' || entry.kind === 'frame-navigation') && entry.url === PROBE_TARGET);
  const navigation = navigationLogged && contents.getURL() === url ? 'blocked' : 'allowed';
  return evaluatePrivileges(probe, navigation, url, runtimeVersion);
}
