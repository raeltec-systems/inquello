import { isPrivatePath } from './runtime/private-paths';
import { observeSyntheticStartup } from './smoke-startup';
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
 * It reads the Header (title, client, period, Workspace), then through
 * "Conversation options" › "Rename or organise" moves the Task through the
 * Move menu and renames it, and requires the same Task ID, no thread binding
 * (threads are bound only by the native Task start workflow), the same
 * references, the new title, private visibility,
 * and that a second principal bound to the runtime lists none of the Tasks.
 * It signs out at the end. `evaluateOrganise` is pure and decides pass/fail.
 *
 * Story 1.15 adds the states probe (`probeStates`). Without a shared service it
 * requires `state.list` to answer signed-out and a review write to be refused
 * by main's validator. With the dev topology it signs in again, creates an ad
 * hoc Task in main, and through the renderer's `state.recordTaskState` records
 * task planned, then running, then run execution_finished. It opens the Task
 * in the Shell and, per the owner amendment of 2026-11-04, requires the
 * truthful pre-run conversation: no end-of-turn line (no native turn ran), no
 * state rows and no "Not recorded" placeholder, nothing green, no accepted or
 * explained chip and no text claiming acceptance. The neutral "Finished ·
 * worked for …" line is checked on fixture-backed turns in the
 * visual-conversation phase. A review write is refused by main's validator and, sent
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
 * Ctrl/Cmd+K keydown opens saved-work search, that collapsing the rail by keyboard is
 * announced once, and, under an emulated `prefers-color-scheme: dark`, that the
 * Shell stays light. Nothing can open the artifact area yet, so at the single
 * width it requires the Shell to report that the artifact would not fit beside
 * the thread (single mode would apply) with the area closed. `evaluateShellLayout`
 * is pure and decides pass/fail.
 *
 * Story 1.17 adds the composer probe (`probeComposer`). With the dev topology
 * it signs in, creates two ad hoc Tasks, types a synthetic draft into each
 * through the Composer and requires each to be kept when the other is opened;
 * a real Enter keeps the text and a real Shift+Enter adds one newline; Send is
 * visible, focusable, `aria-disabled` with its linked reason (and the
 * empty-request reason first while empty) and activating it changes nothing;
 * no later input (attach, Method, scope, environment, reasoning) is available.
 * It signs out through the Account block, requires the signed-out Shell to
 * show no Composer, signs in again and requires both drafts to be gone. Only
 * draft lengths and comparisons leave the renderer, never the text. Without
 * the topology it requires the signed-out Shell to show no Composer.
 * `evaluateComposer` is pure and decides pass/fail.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import type { WebContents } from 'electron';

import { digestFile, exportedFilePath, governedRoots, isInside, readManifest, ruleBlockers, takeInventory, type DataService, type GovernedRoots, type ImportActionResult } from './data';
import type { IdentityWiring } from './identity';
import type { CapabilityService } from './capabilities/service';
import type { CapabilityInventory, CapabilityResult } from './capabilities/types';
import type { OrganiseService, TaskView } from './organise';
import { EXECUTION_SANDBOX_STATUS, networkDenialText, outsideDenialText, type PolicyService, type ToolDenial } from './policy';
import { BROAD_MODE_REACH } from './policy/views';
import type { ProviderService } from './providers';
import { isProviderCredentialVar } from './runtime/env';
import { taskFiles } from './runtime/probe-task-files';
import { RpcResponseError } from './runtime/errors';
import type { BlockedKind } from './security/policy';
import type { SourcesService } from './sources';

/** Exercise main's identity transition hooks as well as the session itself. */
function smokeIdentity(contents: WebContents, action: 'signIn' | 'signOut'): Promise<{ ok: boolean }> {
  return contents.executeJavaScript(`globalThis.inquello.identity.${action}()`);
}

/** Story 1.30 only: real named IPC, native persistence and Chromium modal behavior.
 * Retained conversation/Inbox races are covered by the native and renderer suites;
 * this probe creates an owned metadata draft, never fabricated conversation history.
 */
export async function probeSavedNavigation(contents: WebContents, options: {
  seedFile: string | null; identity: IdentityWiring; restartRuntime: () => Promise<void>;
}): Promise<{ ok: boolean; failures: string[]; checks: string[] }> {
  const checks: string[] = [], failures: string[] = [];
  const evaluate = <T,>(body: string): Promise<T> => contents.executeJavaScript(`(async () => {
    ${SHELL_HELPERS}
    const require = (value, message) => { if (!value) throw new Error(message); return value; };
    const button = (name, root = document) => [...root.querySelectorAll('button,[role="menuitem"]')].find(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && (el.getAttribute('aria-label') || document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || el.textContent).trim() === name);
    ${body}
  })()`);
  try {
    const seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as { workspace_id: string; invite_id: string };
    if (!(await smokeIdentity(contents, 'signIn')).ok) throw new Error('Seeded sign-in failed');
    const workspaceId = seed.workspace_id;
    const accepted = await options.identity.session.withAccess(access => options.identity.service!.acceptInvite(access, seed.invite_id));
    if (accepted?.workspace_id !== workspaceId) throw new Error('Fictional Workspace invitation was not accepted');
    const created = await evaluate<{ taskId: string }>(`
      await globalThis.inquello.organise.getWorkspaces();
      const result = await globalThis.inquello.organise.createTask({ operationId: ${JSON.stringify(randomUUID())}, workspaceId: ${JSON.stringify(workspaceId)}, engagementId: null, folderId: null, title: 'Procurement January–June navigation audit' });
      require(result.ok, 'Could not create owned draft'); return result.value;
    `);
    const taskId = created.taskId;
    await evaluate(`
      require(await openShell(), 'Shell unavailable');
      const row = await wait(() => qVisible('[data-task-id="${taskId}"] a'), ${SHELL_SETTLE_MS});
      require(row, 'Owned draft not shown').click();
      require(await wait(() => qVisible('[data-task-view="${taskId}"]'), ${SHELL_SETTLE_MS}), 'Draft did not open');
      const dialog = require(await openConversationDialog('Rename or organise'), 'Rename or organise did not open');
      const menu = require(button('Organise conversation', dialog), 'Organise menu unavailable');
      require(menu.getClientRects().length > 0, 'Organise menu is hidden'); menu.click();
      require(await wait(() => button('Pin', dialog), 5000), 'Pin unavailable').click();
      require(await wait(() => qVisible('[data-task-id="${taskId}"]')?.textContent.includes('Pinned'), 5000), 'Pin did not persist to navigation');
      require(button('Organise conversation', dialog), 'Organise menu disappeared').click();
      require(await wait(() => button('Archive', dialog), 5000), 'Archive unavailable').click();
      require(await wait(() => !q('[data-task-id="${taskId}"]'), 5000), 'Archived Task remained in navigation');
      require(await closeConversationDialogs(), 'Rename or organise did not close');
    `);
    checks.push('Pin and archive through actual Task menus');
    await options.restartRuntime();
    await evaluate(`
      const result = await globalThis.inquello.organise.getTree({workspaceId:${JSON.stringify(workspaceId)}});
      const task = result.ok && result.value.tasks.find(t => t.taskId === '${taskId}');
      require(task?.pinned && task?.archived && task.runtimeThreadId === null, 'Restart lost preferences or started execution');
    `);
    checks.push('Native restart preserves pin/archive without execution');
    contents.focus();
    for (const modifier of ['control', 'meta'] as const) {
      await pressKey(contents, 'K', [modifier]);
      await evaluate(`require(await wait(() => q('dialog[open][aria-label="Search saved work"] input[type="search"]'), 5000), 'Shortcut did not open Search');`);
      await pressKey(contents, 'Escape');
      await evaluate(`require(!q('dialog[open]'), 'Escape did not close Search');`);
    }
    checks.push('Independent Ctrl+K / Cmd+K and Escape in Chromium');
    await pressKey(contents, 'K', ['control']);
    await evaluate(`
      const dialog = require(q('dialog[open]'), 'Search missing');
      type(q('input[type="search"]', dialog), 'Procurement January');
      q('form', dialog).requestSubmit();
      require(await wait(() => dialog.textContent.includes('No matches in'), 10000), 'Archived work appeared without explicit filter');
      q('input[type="checkbox"]', dialog).click();
      q('form', dialog).requestSubmit();
      const hit = await wait(() => [...dialog.querySelectorAll('.iq-saved-results button')].find(el => el.textContent.includes('Procurement January')), 10000);
      require(hit, 'Archived search hit missing').click();
      require(await wait(() => !q('dialog[open]') && q('[data-task-view="${taskId}"]'), 10000), 'Archived hit did not reopen');
      const reopened = require(await openConversationDialog('Rename or organise'), 'Reopened Rename or organise did not open');
      require(reopened.textContent.includes('Opening does not unarchive'), 'Reopen silently unarchived');
      require(button('Organise conversation', reopened), 'Reopened Task menu unavailable').click();
      require(await wait(() => button('Unarchive', reopened), 5000), 'Unarchive unavailable').click();
      require(await wait(() => qVisible('[data-task-id="${taskId}"]'), 5000), 'Unarchive did not restore navigation');
      require(await closeConversationDialogs(), 'Reopened Rename or organise did not close');
      const tree = await globalThis.inquello.organise.getTree({workspaceId:${JSON.stringify(workspaceId)}});
      const task = tree.ok && tree.value.tasks.find(t => t.taskId === '${taskId}');
      require(task?.pinned && !task.archived && task.runtimeThreadId === null, 'Navigation changed execution or lost the Task');
    `);
    checks.push('Explicit archive filter, fresh reopen and unarchive without provider credentials');
    if (!(await smokeIdentity(contents, 'signOut')).ok) throw new Error('Sign-out failed');
    await evaluate(`
      const result = await globalThis.inquello.organise.search({workspaceId:${JSON.stringify(workspaceId)},query:'Procurement January',includeArchived:true,cursor:null});
      require(!result.ok, 'Signed-out search disclosed saved work');
      require(await wait(() => !q('[data-task-view]') && !q('.iq-saved-results'), 5000), 'Signed-out renderer retained saved work');
    `);
    checks.push('Sign-out removes rendered work and denies fresh search');
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await smokeIdentity(contents, 'signOut').catch(() => undefined);
  }
  return { ok: failures.length === 0, failures, checks };
}

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
  onboarding: {getState: 'function', saveDraft: 'function', members: 'function', createWorkspace: 'function', acceptInvitation: 'function', invite: 'function', changeRoles: 'function', removeMember: 'function', revokeInvitation: 'function', reconcile: 'function', retry: 'function', discardPending: 'function'},
  tasks: { inbox: 'function', steer: 'function', stop: 'function', resume: 'function',preflight:'function',start:'function',reconcile:'function',progress:'function',activity:'function',settleLifecycle:'function',answer:'function',onProgressChanged:'function',onSessionChanged:'function'},
  sources: { attach: 'function', discard: 'function', stage: 'function', view: 'function', onChanged: 'function' },
  usage: { forTask: 'function', set: 'function', onChanged: 'function' },
  environments: { forTask: 'function', onChanged: 'function' },
  routes: { list: 'function', catalog: 'function', resolve: 'function', bindingState: 'function', selectModel: 'function', pendingModel: 'function', forTask: 'function', select: 'function', onChanged: 'function' },
  capabilities: { onChanged: 'function', getInventory: 'function', manage: 'function' },
  runtime: { getStatus: 'function' },
  identity: { reauthenticate: 'function', getStatus: 'function', signIn: 'function', signOut: 'function' },
  data: { getPolicy: 'function', export: 'function', import: 'function', delete: 'function' },
  provider: {
    getStatus: 'function',
    refreshStatus:'function',
    setClaudeKey: 'function',
    verifyClaudeKey: 'function',
    removeClaudeKey: 'function',
    codexLogin: 'function',
    codexLogout: 'function',
    consent: 'function',
    changeConsent: 'function',
    reconcileConsent: 'function',
    retryConsent: 'function',
  },
  organise: {
    search:'function',reopen:'function',setNavigation:'function',recoverNavigation:'function',
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
  policy: { onSettingsChanged: 'function', getSettings: 'function', forTask: 'function', setBroadMode: 'function' },
  permissions: { pending: 'function', decide: 'function', getRules: 'function', setUserRules: 'function' },
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
  if (!isDeepStrictEqual(probe.bridge, EXPECTED_BRIDGE_TREE)) {
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
  vault?: { exists: boolean; mode: number | null; dirMode: number | null; windowsAclPrivate?: boolean; plaintextSecrets: number };
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
      if (read.vault.windowsAclPrivate === false) failures.push('the credential paths have an unsafe Windows ACL');
      if (read.vault.windowsAclPrivate === undefined && read.vault.mode !== 0o600) failures.push(`the credential file mode is ${read.vault.mode?.toString(8)}, not 600`);
      if (read.vault.windowsAclPrivate === undefined && read.vault.dirMode !== 0o700) failures.push(`the identity directory mode is ${read.vault.dirMode?.toString(8)}, not 700`);
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

function windowsAclRead(file: string): { windowsAclPrivate?: boolean } {
  return process.platform === 'win32'
    ? { windowsAclPrivate: isPrivatePath(file, 'file') && isPrivatePath(path.dirname(file), 'directory') }
    : {};
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
    read.vault = { exists, mode: modeOf(file), dirMode: modeOf(path.dirname(file)), ...windowsAclRead(file), plaintextSecrets };
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
  unownedHistoryRefused: boolean;
  policyLoaded: boolean;
  ruleBlockers: number;
  categories: number;
  runtimeHome: { underUserData: boolean; matchesHandshake: boolean };
  unclassified: string[];
  disabledHeld: string[];
  renderer: { policyLoaded: boolean; categories: number; blockShown: boolean; pathRejected: boolean };
  export: { ok: boolean; reason?: string; included: Record<string, number>; omissions: string[] };
  import: { ok: boolean; reason?: string; restored: number; notRestored: number; byteIdentical: boolean; ownedMetadataRestored: boolean };
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
  if (!read.unownedHistoryRefused) failures.push('unowned synthetic history was not refused');
  if (!read.export.included['working-store']) failures.push('the export did not include owned Task metadata');
  for (const id of REQUIRED_OMISSIONS) if (!read.export.omissions.includes(id)) failures.push(`the export did not declare ${id} as omitted`);
  if (!read.import.ok) failures.push(`the reimport failed: ${read.import.reason ?? 'no reason'}`);
  const exported = Object.values(read.export.included).reduce((sum, count) => sum + count, 0);
  if (read.import.restored !== exported || read.import.notRestored !== 0) failures.push(`reimport restored ${read.import.restored} of ${exported} files`);
  if (!read.import.byteIdentical) failures.push('reimported files differ from the export');
  if (!read.import.ownedMetadataRestored) failures.push('owned Task metadata did not come back byte-identical');
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
  identity: IdentityWiring;
  organise: OrganiseService;
  seedFile: string | null;
  recover(roots: GovernedRoots, source: string): Promise<ImportActionResult>;
  /** `codexHome` from the runtime's handshake. */
  codexHome: string | null;
  tempBase?: string;
}

/** Runs the data probe against the live roots, the renderer and the data service. */
export async function probeData(contents: WebContents, options: DataProbeOptions): Promise<DataReport> {
  const { service, roots } = options;
  const policy = service.policy;
  const read: DataProbeRead = {
    unownedHistoryRefused: false,
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
    import: { ok: false, restored: 0, notRestored: 0, byteIdentical: false, ownedMetadataRestored: false },
  };
  if (!policy) return evaluateData(read);

  // A filename or a synthetic flag cannot establish ownership of history.
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
    const signIn = await contents.executeJavaScript('globalThis.inquello.identity.signIn()') as { ok: boolean };
    if (!signIn.ok) throw new Error('Data smoke sign-in failed');
    await options.organise.syncPrincipal();
    const seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as { workspace_id: string; invite_id: string };
    const accepted = await options.identity.session.withAccess(access => options.identity.service!.acceptInvite(access, seed.invite_id));
    if (accepted?.workspace_id !== seed.workspace_id) throw new Error('Data smoke Workspace invitation failed');
    const task = await options.organise.createTask({ operationId: randomUUID(), workspaceId: seed.workspace_id, engagementId: null, folderId: null, title: 'Synthetic recovery draft' });
    if (!task.ok) throw new Error(task.reason);
    const refused = await service.exportData();
    read.unownedHistoryRefused = !refused.ok && refused.reason.includes('ownership');
    fs.rmSync(sessionFile, { force: true });
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
      const recovered = await options.recover(targetRoots, exported.export.path);
      if (!recovered.ok) throw new Error(recovered.reason);
      const result = recovered.import;
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
      const metadata = manifest.included.find(entry => entry.category === 'working-store');
      read.import = {
        ok: true,
        restored: result.restored.reduce((sum, entry) => sum + entry.files, 0),
        notRestored: result.notRestored.length,
        byteIdentical: identical,
        ownedMetadataRestored: identical && Boolean(metadata?.files.length) && !fs.existsSync(path.join(targetRoots['runtime-home'], ...sessionRel.split('/'))),
      };
    } catch (error) {
      read.import = { ok: false, reason: (error as Error).message, restored: 0, notRestored: 0, byteIdentical: false, ownedMetadataRestored: false };
    }
  } finally {
    for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(sessionFile, { force: true });
    await contents.executeJavaScript('globalThis.inquello.identity.signOut()');
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
  vault: { exists: boolean; mode: number | null; dirMode: number | null; windowsAclPrivate?: boolean; plaintext: boolean };
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
    if (read.vault.windowsAclPrivate === false) failures.push('the provider credential paths have an unsafe Windows ACL');
    if (read.vault.windowsAclPrivate === undefined && read.vault.mode !== 0o600) failures.push(`the Claude key vault mode is ${read.vault.mode?.toString(8)}, not 600`);
    if (read.vault.windowsAclPrivate === undefined && read.vault.dirMode !== 0o700) failures.push(`the providers directory mode is ${read.vault.dirMode?.toString(8)}, not 700`);
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
  if (identity.config.kind === 'configured') await contents.executeJavaScript('globalThis.inquello.identity.signIn()');
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
      read.vault = { exists: true, mode: modeOf(vaultFile), dirMode: modeOf(path.dirname(vaultFile)), ...windowsAclRead(vaultFile), plaintext: needles.some((needle) => bytes.includes(Buffer.from(needle, 'utf8'))) };
    } catch {
      read.vault = { exists: false, mode: null, dirMode: null, plaintext: false };
    }
    read.authJson = fs.existsSync(path.join(roots['runtime-home'], 'auth.json'));
    read.identityUnchanged = JSON.stringify(await identity.session.getStatus()) === identityBefore;

    // Export while signed in, through current native ownership and service
    // authorization. A signed-out export is intentionally unavailable.
    const exported = await options.data.exportData();
    read.exportOk = exported.ok;
    if (exported.ok) {
      temps.push(path.dirname(exported.export.path));
      for (const file of filesUnder(exported.export.path)) search(`export:${path.relative(exported.export.path, file)}`, fs.readFileSync(file));
    }

    // Sign out of Inquello while both routes are connected: provider states stay.
    const beforeSignOut = JSON.stringify(statusSummary(await providers.getStatus()));
    const identityStateBefore = (await identity.session.getStatus()).identity.state;
    await contents.executeJavaScript('globalThis.inquello.identity.signOut()');
    const identityStateAfter = (await identity.session.getStatus()).identity.state;
    read.identitySignOut = {
      identityBefore: identityStateBefore,
      identityAfter: identityStateAfter,
      providersUnchanged: JSON.stringify(statusSummary(await providers.getStatus())) === beforeSignOut,
    };
    const identityAfterSignOut = JSON.stringify(await identity.session.getStatus());

    // Everything the sentinel could leak into while it is held.
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
  // Settings hides the persistent Shell; DOM presence alone is not readiness.
  const visible = (element) => !!element && !element.closest('[hidden]');
  const qVisible = (selector, root) => [...(root || document).querySelectorAll(selector)].find(visible) || null;
  const specimenReady = () => location.hash === '#specimen' && !visible(q('[data-shell]')) && !!qVisible('.specimen');
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
  const readHeader = async () => {
    const trigger = qVisible('button[aria-label="Organization and team"]');
    if (!trigger) throw new Error('Current workspace footer unavailable');
    trigger.click();
    const menu = await wait(() => qVisible('[role="menu"]'), 5000);
    if (!menu) throw new Error('Current workspace menu unavailable');
    const workspace = q('[role="menuitem"] .iq-menu-label', menu)?.textContent ?? null;
    trigger.click();
    return ({
    title: text('[data-header-title]'),
    client: text('[data-header-client]'),
    period: text('[data-header-period]'),
    workspace,
    visibility: q('[data-header-visibility]') ? q('[data-header-visibility]').getAttribute('data-header-visibility') : null,
    });
  };
  // The open conversation's controls live in two dialogs reached from the
  // Header's "Conversation options" menu: "Rename or organise" (Move, rename)
  // and "Permissions" (the compact policy, reach and execution mode).
  const CONVERSATION_DIALOGS = { 'Rename or organise': 'Conversation options', Permissions: 'Conversation permissions' };
  const openConversationDialog = async (item) => {
    const label = CONVERSATION_DIALOGS[item];
    const selector = 'dialog[open][aria-label="' + label + '"]';
    const already = qVisible(selector);
    if (already) return already;
    const trigger = await wait(() => qVisible('[data-header] button[aria-label="Conversation options"]'), ${SHELL_SETTLE_MS});
    if (!trigger) return null;
    trigger.click();
    const entry = await wait(() => [...document.querySelectorAll('[role="menuitem"]')].find((element) => visible(element) && element.textContent.trim() === item), 5000);
    if (!entry) return null;
    entry.click();
    return await wait(() => qVisible(selector), ${SHELL_SETTLE_MS});
  };
  const closeConversationDialogs = async () => {
    for (const label of Object.values(CONVERSATION_DIALOGS)) {
      const dialog = qVisible('dialog[open][aria-label="' + label + '"]');
      const close = dialog && [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Close ' + label);
      if (close) close.click();
    }
    return !!(await wait(() => !document.querySelector('dialog[open]'), 5000));
  };
  const openShell = async () => {
    location.hash = '#shell';
    return !!(await wait(() => location.hash === '#shell' && visible(q('[data-shell]')) && qVisible('[data-sidebar]:not([data-sidebar-state="loading"])'), ${SHELL_SETTLE_MS}));
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

/** Creates the Engagement/folder through the Shell, verifies New chat opens
 * the unsent start surface, then seeds an owned draft through the named bridge
 * for navigation checks. No inference is started to fabricate saved work. */
function shellCreateProbe(workspaceId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    const out = { shellOpened: await openShell() };
    out.ready = !!(await wait(() => q('[data-sidebar][data-sidebar-state="ready"]') && q('[data-rail-workspace=${JSON.stringify(workspaceId)}]'), ${SHELL_SETTLE_MS}));
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
    out.newTaskDraftShown = !!(await wait(() => q('[data-start-view] textarea'), 5000));
    const before = await globalThis.inquello.organise.getTree({workspaceId:${JSON.stringify(workspaceId)}});
    out.newTaskCreatedNothing = before.ok && !before.value.tasks.some(task => task.folderId === out.folderId);
    const created = await globalThis.inquello.organise.createTask({operationId:crypto.randomUUID(),workspaceId:${JSON.stringify(workspaceId)},engagementId:out.engagementId,folderId:out.folderId,title:'Untitled thread'});
    if (!created.ok) return out;
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    await openShell();
    const task = await wait(() => q('[data-folder-id] [data-task-id]'), ${SHELL_SETTLE_MS});
    out.taskId = task ? task.getAttribute('data-task-id') : null;
    if (task) q('a', task)?.click();
    await wait(() => text('[data-header-client]'), 5000);
    out.header = await readHeader();
    // A draft Task has no run yet: its conversation area opens with no turns and no end-of-turn line.
    const view = await wait(() => qVisible('[data-task-view=' + JSON.stringify(out.taskId) + ']'), 5000);
    out.openTaskShown = !!view && !q('[data-progress-item], [data-turn-finished]', view);
    out.shareControls = document.querySelectorAll('[data-shell] button[aria-label*="Share" i]').length;
    return out;
  })()`;
}

export const SMOKE_RENAMED_TITLE = 'Smoke renamed thread';

/** Reopens the Shell (re-reading the tree), opens the Task, moves it to no
 * Engagement and renames it through "Conversation options" › "Rename or organise". */
function shellMoveProbe(taskId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    out.opened = !!(await wait(() => qVisible('[data-task-view=${JSON.stringify(taskId)}]'), 5000));
    out.headerBefore = await readHeader();
    const dialog = await openConversationDialog('Rename or organise');
    if (!dialog) throw new Error('Rename or organise did not open for Move');
    const move = q('[data-task-move] button', dialog);
    out.movePressed = !!move?.getClientRects().length && (move.click(), true);
    const target = await wait(() => [...dialog.querySelectorAll('[role="menuitemradio"]')].find((item) => item.textContent.includes('No Engagement')), 5000);
    if (target) target.click();
    out.moved = !!(await wait(() => q('[data-recent-chats] [data-task-id=${JSON.stringify(taskId)}]'), ${SHELL_SETTLE_MS}));
    out.notice = text('[data-task-notice]');
    const title = await wait(() => qVisible('[data-task-rename] input', dialog), 5000);
    if (title) {
      type(title, ${JSON.stringify(SMOKE_RENAMED_TITLE)});
      await new Promise((resolve) => setTimeout(resolve, 50));
      q('[data-task-rename] button[type="submit"]', dialog)?.click();
    }
    out.renamed = !!(await wait(() => text('[data-header-title]') === ${JSON.stringify(SMOKE_RENAMED_TITLE)}, ${SHELL_SETTLE_MS}));
    out.renameNotice = text('[data-task-notice]');
    out.dialogClosed = await closeConversationDialogs();
    out.headerAfter = await readHeader();
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
    newTaskDraftShown: boolean;
    newTaskCreatedNothing: boolean;
    taskId: string | null;
    header: HeaderRead;
    openTaskShown: boolean;
    shareControls: number;
  };
  before?: TaskView | null;
  move?: { shellOpened: boolean; opened: boolean; headerBefore: HeaderRead; movePressed: boolean; moved: boolean; notice: string | null; renamed: boolean; renameNotice: string | null; dialogClosed: boolean; headerAfter: HeaderRead };
  after?: TaskView | null;
  listedForCreator?: boolean;
  listedForOtherPrincipal?: number;
  /** The runtime refused the other principal's tree read (nothing disclosed). */
  otherPrincipalRefused?: boolean;
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
  if (!create?.newTaskDraftShown || !create.newTaskCreatedNothing) failures.push('New chat did not open an unsent draft without creating saved work');
  if (!create?.engagementId) failures.push(`no Engagement was created through the Sidebar${create?.engagementNotice ? ` (${create.engagementNotice})` : ''}`);
  if (!create?.folderId) failures.push('no folder was created through the Sidebar');
  if (!create?.taskId) failures.push('no Task was created in the folder through the Sidebar');
  if (create?.header.title !== 'Untitled thread') failures.push(`the Header title is ${JSON.stringify(create?.header.title)}`);
  if (create?.header.client !== 'Synthetic Client Ltd') failures.push(`the Header client is ${JSON.stringify(create?.header.client)}`);
  if (create?.header.period !== '2026-01-01 – 2026-12-31') failures.push(`the Header period is ${JSON.stringify(create?.header.period)}`);
  if (!read.seedWorkspaceName || create?.header.workspace !== read.seedWorkspaceName) {
    failures.push(`the footer Workspace is ${JSON.stringify(create?.header.workspace)}, expected ${JSON.stringify(read.seedWorkspaceName)}`);
  }
  if (create?.header.visibility !== 'private') failures.push('the Header does not show the Task as private');
  if (!create?.openTaskShown) failures.push('the opened draft Task did not show an empty conversation');
  if (create?.shareControls !== 0) failures.push('a Share control is shown');
  const before = read.before;
  const after = read.after;
  if (!read.move?.moved) failures.push(`the Task was not moved through the Move menu${read.move?.notice ? ` (${read.move.notice})` : ''}`);
  if (!read.move?.renamed || read.move.headerAfter.title !== SMOKE_RENAMED_TITLE) failures.push(`the Task was not renamed through Rename or organise${read.move?.renameNotice ? ` (${read.move.renameNotice})` : ''}`);
  if (read.move && !read.move.dialogClosed) failures.push('the Rename or organise dialog did not close');
  if (!before || !after) failures.push('the Task could not be read before and after the move');
  else {
    if (after.taskId !== before.taskId) failures.push('the move changed the Task ID');
    if (after.runtimeThreadId !== null || before.runtimeThreadId !== null) failures.push('the draft acquired an unauthorized thread binding');
    if (JSON.stringify(after.sourceRefs) !== JSON.stringify(before.sourceRefs) || JSON.stringify(after.artifactRefs) !== JSON.stringify(before.artifactRefs)) {
      failures.push('the move changed the references');
    }
    if (after.visibility !== 'private') failures.push('the Task is not private after the move');
    if (after.title !== SMOKE_RENAMED_TITLE) failures.push(`main reads the renamed Task as ${JSON.stringify(after.title)}`);
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

    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    const service = identity.service;
    // The data probe may already have consumed this one-use invitation. Verify
    // current membership instead of replaying a completed invitation.
    const memberships = service ? await identity.session.withAccess(access => service.workspaces(access)) : null;
    read.inviteAccepted = memberships?.workspaces.some(workspace => workspace.workspace_id === workspaceId) ?? false;
    if (!read.inviteAccepted) {
      const accepted = service ? await identity.session.withAccess((access) => service.acceptInvite(access, inviteId)) : null;
      read.inviteAccepted = accepted?.workspace_id === workspaceId;
    }

    read.create = (await contents.executeJavaScript(shellCreateProbe(workspaceId))) as OrganiseProbeRead['create'];
    const taskId = read.create?.taskId ?? null;
    if (!taskId) return evaluateOrganise(read);

    const findTask = async (): Promise<TaskView | null> => {
      const tree = await organise.getTree(workspaceId);
      return tree.ok ? (tree.value.tasks.find((task) => task.taskId === taskId) ?? null) : null;
    };
    // Thread binding happens only through the native Task start workflow (see
    // the visual-conversation phase); no renderer- or probe-supplied binding is tried.
    read.before = await findTask();
    read.move = (await contents.executeJavaScript(shellMoveProbe(taskId))) as OrganiseProbeRead['move'];
    read.after = await findTask();
    read.listedForCreator = read.after !== null;

    // A second principal bound to the same runtime lists none of these Tasks:
    // the runtime either answers an empty tree or refuses the Workspace outright.
    await runtimeRequest('inquello/session/setPrincipal', { principalId: OTHER_SMOKE_PRINCIPAL });
    try {
      const other = await runtimeRequest<{ tasks: unknown[] }>('inquello/workspace/tree', { workspaceId });
      read.listedForOtherPrincipal = other.tasks.length;
    } catch (error) {
      // Only a runtime refusal counts; a transport or internal failure stays a failure.
      if (!(error instanceof RpcResponseError) || error.rpcCode !== -32600) throw error;
      read.listedForOtherPrincipal = 0;
      read.otherPrincipalRefused = true;
    } finally {
      await runtimeRequest('inquello/session/setPrincipal', { principalId: identity.session.principalId() });
    }
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluateOrganise(read);
}

// ---- states (Story 1.15) ------------------------------------------------------

const SMOKE_RUN_REF = 'smoke-run-1';

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

/**
 * Opens the Task in the Shell and reads what its conversation shows (owner
 * amendment 2026-11-04). This Task never ran a native turn (no model runs in
 * the normal phase), so the truthful pre-run state is: no end-of-turn line, no
 * state rows (nothing recorded checks, review or the markers), no "Not
 * recorded" placeholder, and nothing green or accepted. The recorded run state
 * is a stored record, not a finished native turn, so it adds no line. The
 * finished line itself is checked on fixture-backed native turns in the
 * visual-conversation phase.
 */
function statesViewProbe(taskId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    const view = await wait(() => qVisible('[data-task-view=${JSON.stringify(taskId)}]'), 5000);
    out.opened = !!view;
    // Let the conversation read settle (it reports unavailable history for a Task that never ran).
    out.settled = !!(await wait(() => view && !/Reading (progress|conversation)/.test(view.textContent) ? view : null, ${SHELL_SETTLE_MS}));
    out.finishedLine = view ? q('[data-turn-finished]', view)?.textContent ?? null : null;
    out.stateRows = view ? [...view.querySelectorAll('[data-task-states] [data-state-dimension]')].map((row) => row.getAttribute('data-state-dimension')) : [];
    const shellRoot = q('[data-shell]');
    out.notRecorded = shellRoot ? shellRoot.textContent.includes('Not recorded') : true;
    out.chips = view ? [...view.querySelectorAll('.iq-status-chip')].map((chip) => {
      const style = getComputedStyle(chip);
      return { className: chip.className, color: style.color, background: style.backgroundColor, border: style.borderTopColor };
    }) : [];
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
    settled: boolean;
    finishedLine: string | null;
    stateRows: Array<string | null>;
    notRecorded: boolean;
    chips: PolicyChipRead[];
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
  if (!view?.settled) failures.push('the conversation read did not settle');
  // No native turn ran: a stored run record is not a finished turn and must not read as one.
  if (view?.finishedLine !== null) failures.push(`a Task that never ran shows an end-of-turn line (${JSON.stringify(view?.finishedLine)})`);
  // Checks, review and the markers appear only once recorded; none is recorded here.
  if ((view?.stateRows ?? ['unread']).length !== 0) failures.push(`the conversation lists state rows ${JSON.stringify(view?.stateRows)}`);
  if (view?.notRecorded !== false) failures.push('the Shell shows a "Not recorded" placeholder');
  checkChips(view?.chips, 'the conversation', failures);
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

    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
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
    const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
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
  windowMinWidth: 544,
  sidebarWidth: 320,
  railWidth: 64,
  headerHeight: 48,
  threadMaxWidth: 720,
  /** Default-sidebar full-mode threshold; the renderer may clamp the sidebar toward 280px. */
  fullWidth: 800,
  /** The narrowest width where the thread and a 380px artifact fit beside the rail. */
  artifactFitWidth: 924,
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
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    if (${JSON.stringify(taskId)}) {
      const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(taskId ?? '')}] a'), ${SHELL_SETTLE_MS});
      if (row) row.click();
      out.opened = !!(await wait(() => qVisible('[data-task-view=${JSON.stringify(taskId ?? '')}]'), 5000));
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

/** Ctrl+K and Cmd+K open Search without execution; Enter on Collapse, then on Expand, toggles the rail with one announcement each. */
async function probeShellKeys(contents: WebContents): Promise<NonNullable<ShellLayoutProbeRead['keys']>> {
  contents.focus();
  const tasksBefore = (await contents.executeJavaScript(SHELL_KEYS_PREPARE)) as number;
  await pressKey(contents, 'K', ['control']);
  await pressKey(contents, 'Escape');
  await pressKey(contents, 'K', ['meta']);
  const keys = (await contents.executeJavaScript(SHELL_KEYS_READ)) as { handled: boolean[]; tasks: number };
  const out: NonNullable<ShellLayoutProbeRead['keys']> = { ctrlK: keys.handled, ctrlKCreatedTask: keys.tasks !== tasksBefore, rail: null };
  await pressKey(contents, 'Escape');
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
    if (keys.ctrlK.length !== 2 || keys.ctrlK.some(value => !value)) failures.push(`Ctrl/Cmd+K did not open Search (${JSON.stringify(keys.ctrlK)})`);
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
      read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
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
      const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
      await organise.syncPrincipal().catch(() => undefined);
      read.signedOutAtEnd = signOut.ok;
    }
  }
  return evaluateShellLayout(read);
}

// ---- composer (Story 1.17) -----------------------------------------------------

/** The synthetic drafts the probe types. Only their lengths and comparisons leave the renderer. */
const COMPOSER_DRAFT_A = 'Smoke draft for Task A';
const COMPOSER_DRAFT_B = 'Smoke draft for Task B';
export const COMPOSER_ROUTE_REASON = 'Choose a model before sending.';
export const COMPOSER_EMPTY_REASON = 'Type a request to send.';

const COMPOSER_HELPERS = `
  ${SHELL_HELPERS}
  const composer = () => qVisible('[data-composer]');
  const field = () => qVisible('[data-composer-input]');
  const sendButton = () => qVisible('[data-composer-send]');
  const described = (element) => element ? (element.getAttribute('aria-describedby') || '').split(' ').map((id) => { const el = document.getElementById(id); return el ? el.textContent : ''; }).join(' ') : null;
  const openTask = async (taskId) => {
    const row = await wait(() => qVisible('[data-task-id="' + taskId + '"] a'), ${SHELL_SETTLE_MS});
    if (!row) return false;
    row.click();
    return !!(await wait(() => qVisible('[data-task-view="' + taskId + '"]') && field() && composer().getAttribute('data-composer-task') === taskId, 5000));
  };
  const readField = (expected) => {
    const el = field();
    return el ? { length: el.value.length, matches: el.value === expected, focused: document.activeElement === el } : null;
  };
  const readSend = () => {
    const el = sendButton();
    return el ? { ariaDisabled: el.getAttribute('aria-disabled'), disabledAttr: el.hasAttribute('disabled'), tabIndex: el.tabIndex, reason: described(el), name: el.getAttribute('aria-label') } : null;
  };
  const otherControls = () => {
    const root = composer();
    if (!root) return null;
    const all = [...root.querySelectorAll('button, input, select, textarea, [role="button"], [role="combobox"], [role="listbox"], [role="menu"]')];
    const others = all.filter((el) => el !== field() && el !== sendButton() && !el.closest('[data-conversation-model]'));
    return {
      others: others.length,
      enabledOthers: others.filter((el) => el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled')).length,
      fileChips: root.querySelectorAll('.iq-file-chip').length,
      // The conversation's model control now also holds its reasoning and environment
      // (owner decision 2026-11-04); no other later input may appear.
      laterWords: /attach|add files|method|scope|environment|reasoning|thorough/i.test((() => { const copy = root.cloneNode(true); copy.querySelectorAll('[data-conversation-model]').forEach((node) => node.remove()); return copy.textContent || ''; })()),
    };
  };
`;

/** Opens Task A then B (typing a draft in each), returns to A, and focuses its field. */
function composerTypeProbe(taskA: string, taskB: string): string {
  return `(async () => {
    ${COMPOSER_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    out.openedA = await openTask(${JSON.stringify(taskA)});
    if (!out.openedA) return out;
    out.label = q('label[for="' + field().id + '"]') ? q('label[for="' + field().id + '"]').textContent : null;
    type(field(), ${JSON.stringify(COMPOSER_DRAFT_A)});
    out.openedB = await openTask(${JSON.stringify(taskB)});
    if (!out.openedB) return out;
    out.bBefore = readField('');
    out.emptySend = readSend();
    type(field(), ${JSON.stringify(COMPOSER_DRAFT_B)});
    out.reopenedA = await openTask(${JSON.stringify(taskA)});
    out.aAfter = readField(${JSON.stringify(COMPOSER_DRAFT_A)});
    out.reopenedB = await openTask(${JSON.stringify(taskB)});
    out.bAfter = readField(${JSON.stringify(COMPOSER_DRAFT_B)});
    await openTask(${JSON.stringify(taskA)});
    field().focus();
    const end = field().value.length;
    field().setSelectionRange(end, end);
    out.focused = document.activeElement === field();
    return out;
  })()`;
}

const COMPOSER_FIELD_READ = (expected: string) => `(() => {
  ${COMPOSER_HELPERS}
  return readField(${JSON.stringify(expected)});
})()`;

/** Reads Send and the other controls, then activates Send and re-reads the field. */
const COMPOSER_SEND_PROBE = `(async () => {
  ${COMPOSER_HELPERS}
  const out = { send: readSend(), controls: otherControls() };
  const el = sendButton();
  if (el) {
    el.focus();
    out.sendFocusable = document.activeElement === el;
    el.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  out.afterSend = readField(${JSON.stringify(`${COMPOSER_DRAFT_A}\n`)});
  out.taskStillOpen = !!q('[data-task-view]');
  return out;
})()`;

/** Signs out through the Account block in Settings, then reads the signed-out Shell. */
const COMPOSER_SIGN_OUT_PROBE = `(async () => {
  ${COMPOSER_HELPERS}
  const out = {};
  location.hash = '#specimen';
  const account = await wait(() => q('[data-account][data-identity-state="signed-in"]'), ${ACCOUNT_SETTLE_MS});
  const button = q('[data-account-action="sign-out"]');
  if (!account || !button || button.getAttribute('aria-disabled') === 'true') { out.pressed = false; return out; }
  button.click();
  out.pressed = true;
  out.reached = !!(await wait(() => q('[data-account][data-identity-state="signed-out"]'), ${ACCOUNT_SETTLE_MS}));
  out.shellOpened = await openShell();
  out.signedOutShown = !!(await wait(() => q('[data-sidebar][data-sidebar-state="signed-out"]'), ${SHELL_SETTLE_MS}));
  out.composerShown = !!q('[data-composer]'); // Sign-out must clear even hidden private drafts.
  return out;
})()`;

/** After signing in again: both Tasks' drafts are empty. */
function composerAfterProbe(taskA: string, taskB: string): string {
  return `(async () => {
    ${COMPOSER_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    out.openedA = await openTask(${JSON.stringify(taskA)});
    out.a = readField('');
    out.openedB = await openTask(${JSON.stringify(taskB)});
    out.b = readField('');
    return out;
  })()`;
}

/** Unconfigured: the signed-out Shell shows no Composer. */
const COMPOSER_SIGNED_OUT_READ = `(async () => {
  ${COMPOSER_HELPERS}
  location.hash = '#specimen';
  await wait(specimenReady, 5000);
  const out = { shellOpened: await openShell() };
  out.signedOutShown = !!(await wait(() => q('[data-sidebar][data-sidebar-state="signed-out"]'), ${SHELL_SETTLE_MS}));
  out.composerShown = !!q('[data-composer]'); // Sign-out must clear even hidden private drafts.
  return out;
})()`;

interface ComposerFieldRead {
  length: number;
  matches: boolean;
  focused: boolean;
}

interface ComposerSendRead {
  ariaDisabled: string | null;
  disabledAttr: boolean;
  tabIndex: number;
  reason: string | null;
  name: string | null;
}

export interface ComposerProbeRead {
  configured: boolean;
  signedIn?: boolean;
  tasks?: { a: string | null; b: string | null };
  typed?: {
    shellOpened: boolean;
    openedA?: boolean;
    openedB?: boolean;
    reopenedA?: boolean;
    reopenedB?: boolean;
    label?: string | null;
    bBefore?: ComposerFieldRead | null;
    emptySend?: ComposerSendRead | null;
    aAfter?: ComposerFieldRead | null;
    bAfter?: ComposerFieldRead | null;
    focused?: boolean;
  };
  /** Task A's field after a real Enter keypress. */
  afterEnter?: ComposerFieldRead | null;
  /** Task A's field after a real Shift+Enter keypress (one newline added). */
  afterShiftEnter?: ComposerFieldRead | null;
  send?: {
    send: ComposerSendRead | null;
    controls: { others: number; enabledOthers: number; fileChips: number; laterWords: boolean } | null;
    sendFocusable?: boolean;
    afterSend: ComposerFieldRead | null;
    taskStillOpen: boolean;
  };
  signOut?: { pressed: boolean; reached?: boolean; shellOpened?: boolean; signedOutShown?: boolean; composerShown?: boolean };
  signedInAgain?: boolean;
  after?: { shellOpened: boolean; openedA?: boolean; a?: ComposerFieldRead | null; openedB?: boolean; b?: ComposerFieldRead | null };
  signedOutShell?: { shellOpened: boolean; signedOutShown: boolean; composerShown: boolean };
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface ComposerReport extends ComposerProbeRead {
  ok: boolean;
  failures: string[];
}

/** Pass/fail for the composer probe. */
export function evaluateComposer(read: ComposerProbeRead): ComposerReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) {
    const signedOut = read.signedOutShell;
    if (!signedOut?.shellOpened || !signedOut.signedOutShown) failures.push('the signed-out Shell did not show');
    else if (signedOut.composerShown) failures.push('a Composer is shown while signed out');
    return { ok: failures.length === 0, failures, ...read };
  }
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.tasks?.a || !read.tasks.b) failures.push('the two synthetic Tasks were not created');
  const typed = read.typed;
  if (!typed?.shellOpened) failures.push('the Shell did not open');
  else if (!typed.openedA || !typed.openedB || !typed.reopenedA || !typed.reopenedB) failures.push('a synthetic Task did not open with its Composer');
  else {
    if (typed.label !== 'Message') failures.push(`the Composer field is labelled ${JSON.stringify(typed.label)}`);
    if (typed.bBefore?.length !== 0) failures.push("Task B's Composer did not start empty");
    const empty = typed.emptySend;
    if (!empty || empty.ariaDisabled !== 'true' || empty.reason !== `${COMPOSER_EMPTY_REASON} ${COMPOSER_ROUTE_REASON}`) failures.push(`with no text, Send is not unavailable with the empty-request reason (${JSON.stringify(empty)})`);
    if (!typed.aAfter?.matches) failures.push("returning to Task A did not keep its draft");
    if (!typed.bAfter?.matches) failures.push("returning to Task B did not keep its draft");
    if (!typed.focused) failures.push("Task A's Composer field could not be focused");
  }
  if (!read.afterEnter?.matches) failures.push(`Enter changed or cleared the draft (${JSON.stringify(read.afterEnter)})`);
  if (!read.afterShiftEnter?.matches) failures.push(`Shift+Enter did not insert one newline (${JSON.stringify(read.afterShiftEnter)})`);
  const send = read.send;
  if (!send?.send) failures.push('Send was not found');
  else {
    const s = send.send;
    if (s.name !== 'Send' || s.ariaDisabled !== 'true' || s.disabledAttr || s.tabIndex < 0) failures.push(`Send is not a visible, focusable, unavailable control (${JSON.stringify(s)})`);
    if (s.reason !== COMPOSER_ROUTE_REASON) failures.push(`Send's linked reason is ${JSON.stringify(s.reason)}`);
    if (!send.sendFocusable) failures.push('Send could not take focus');
    if (!send.afterSend?.matches || !send.taskStillOpen) failures.push('activating Send changed the draft or the open Task');
    const c = send.controls;
    if (!c) failures.push('the Composer was not found');
    else if (c.enabledOthers > 0 || c.fileChips > 0 || c.laterWords) failures.push(`the Composer shows a later input as available (${JSON.stringify(c)})`);
  }
  const out = read.signOut;
  if (!out?.pressed || !out.reached) failures.push('sign-out through the Account block did not complete');
  else if (!out.signedOutShown || out.composerShown) failures.push('after sign-out the Shell still shows a Composer');
  if (!read.signedInAgain) failures.push('the synthetic user could not sign in again');
  const after = read.after;
  if (!after?.openedA || !after.openedB) failures.push('the synthetic Tasks did not reopen after signing in again');
  else if (after.a?.length !== 0 || after.b?.length !== 0) failures.push(`drafts survived sign-out (lengths ${after.a?.length}, ${after.b?.length})`);
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

/** Presses Return in the renderer through real input events, with or without Shift. */
async function pressReturn(contents: WebContents, shift: boolean): Promise<void> {
  const modifiers: Array<'shift'> = shift ? ['shift'] : [];
  contents.sendInputEvent({ type: 'keyDown', keyCode: 'Return', modifiers });
  contents.sendInputEvent({ type: 'char', keyCode: '\r', modifiers });
  contents.sendInputEvent({ type: 'keyUp', keyCode: 'Return', modifiers });
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Runs the composer probe. With the dev topology it signs in, creates two ad
 * hoc Tasks, types a synthetic draft in each through the Composer, checks each
 * is kept, presses real Enter and Shift+Enter, reads Send and the absence of
 * later inputs, signs out through the Account block and, signed in again,
 * requires both drafts to be gone. Draft text never leaves the renderer: only
 * lengths and comparisons are reported. Without it, it requires the signed-out
 * Shell to show no Composer.
 */
export async function probeComposer(contents: WebContents, options: Omit<OrganiseProbeOptions, 'runtimeRequest'>): Promise<ComposerReport> {
  const { identity, organise } = options;
  const configured = identity.config.kind === 'configured';
  const read: ComposerProbeRead = { configured };
  try {
    if (!configured) {
      read.signedOutShell = (await contents.executeJavaScript(COMPOSER_SIGNED_OUT_READ)) as ComposerProbeRead['signedOutShell'];
      return evaluateComposer(read);
    }
    let seed: { workspace_id?: unknown } = {};
    try {
      seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
    } catch {
      seed = {};
    }
    const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    await organise.getWorkspaces();
    const create = async (title: string) => {
      if (!workspaceId) return null;
      const created = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title });
      return created.ok ? created.value.taskId : null;
    };
    read.tasks = { a: await create('Smoke composer A'), b: await create('Smoke composer B') };
    const { a, b } = read.tasks;
    if (!a || !b) return evaluateComposer(read);

    read.typed = (await contents.executeJavaScript(composerTypeProbe(a, b))) as ComposerProbeRead['typed'];
    contents.focus();
    await pressReturn(contents, false);
    read.afterEnter = (await contents.executeJavaScript(COMPOSER_FIELD_READ(COMPOSER_DRAFT_A))) as ComposerFieldRead | null;
    await pressReturn(contents, true);
    read.afterShiftEnter = (await contents.executeJavaScript(COMPOSER_FIELD_READ(`${COMPOSER_DRAFT_A}\n`))) as ComposerFieldRead | null;
    read.send = (await contents.executeJavaScript(COMPOSER_SEND_PROBE)) as ComposerProbeRead['send'];

    read.signOut = (await contents.executeJavaScript(COMPOSER_SIGN_OUT_PROBE)) as ComposerProbeRead['signOut'];
    await organise.syncPrincipal().catch(() => undefined);
    read.signedInAgain = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    read.after = (await contents.executeJavaScript(composerAfterProbe(a, b))) as ComposerProbeRead['after'];
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    if (configured) {
      const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
      await organise.syncPrincipal().catch(() => undefined);
      read.signedOutAtEnd = signOut.ok;
    }
  }
  return evaluateComposer(read);
}

// ---- effective managed policy (Story 1.18) -----------------------------------------

const POLICY_SETTLE_MS = 20_000;
const POLICY_SETTING_NAMES = ['sandbox', 'approval', 'network', 'mcp_tools', 'extensions', 'allow_local_mcp_servers', 'full_access', 'no_prompt'] as const;
const NOT_ENABLED = 'Not enabled — eligibility verification required';
/** Wording a broader mode or the policy must never use. */
const APPROVAL_WORDING = /approv|review|accept|professional/i;
const FULL_ACCESS_REACH = BROAD_MODE_REACH.full_access;

/** Reads S07 in Settings: every setting with its source, the device layer and the Capability Contract. */
function policySettingsProbe(workspaceId: string | null): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const loaded = await wait(() => {
      const section = q('[data-policy-section][data-policy-loaded="true"]');
      if (!section) return null;
      return ${JSON.stringify(workspaceId)} ? q('[data-policy-workspace=${JSON.stringify(workspaceId ?? '')}] [data-policy-setting]') && section : section;
    }, ${POLICY_SETTLE_MS});
    const section = q('[data-policy-section]');
    const out = { loaded: !!loaded, signedIn: section ? section.getAttribute('data-signed-in') : null };
    const workspace = ${JSON.stringify(workspaceId)} ? q('[data-policy-workspace=${JSON.stringify(workspaceId ?? '')}]') : null;
    out.settings = workspace
      ? [...workspace.querySelectorAll('[data-policy-setting]')].map((row) => ({
          name: row.getAttribute('data-policy-setting'),
          value: (q('.iq-status-chip', row) || row).textContent,
          source: (q('[data-policy-source]', row) || row).textContent,
        }))
      : [];
    out.device = workspace && q('[data-policy-device]', workspace) ? q('[data-policy-device]', workspace).textContent : null;
    out.environment = text('[data-policy-environment]');
    out.reason = text('[data-policy-section] [data-policy-reason]');
    out.capabilities = [...document.querySelectorAll('[data-capability-contract] [data-capability]')].map((row) => ({
      id: row.getAttribute('data-capability'),
      text: row.textContent,
    }));
    // Broader execution modes must not imply professional approval. Other
    // settings legitimately describe approval requirements for tool connections.
    out.wording = workspace ? ${APPROVAL_WORDING.toString()}.test([...workspace.querySelectorAll('[data-policy-setting="full_access"], [data-policy-setting="no_prompt"]')].map(row => row.textContent).join(' ')) : true;
    out.chips = section ? [...section.querySelectorAll('.iq-status-chip')].map((chip) => {
      const style = getComputedStyle(chip);
      return { className: chip.className, color: style.color, background: style.backgroundColor, border: style.borderTopColor };
    }) : [];
    return out;
  })()`;
}

/** Opens the Task's "Permissions" dialog (Conversation options), reads its
 * compact policy, then tries Full access through the renderer bridge. */
function policyTaskProbe(taskId: string, operationId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    out.opened = !!(await wait(() => qVisible('[data-task-view=${JSON.stringify(taskId)}]'), ${SHELL_SETTLE_MS}));
    const dialog = await openConversationDialog('Permissions');
    if (!dialog) throw new Error('Permissions did not open for Policy');
    const mode = await wait(() => { const control = q('[data-task-policy=${JSON.stringify(taskId)}] [data-broad-mode]', dialog); return control?.getClientRects().length ? control : null; }, ${POLICY_SETTLE_MS});
    const section = q('[data-task-policy]', dialog);
    out.status = mode ? mode.getAttribute('data-broad-mode-status') : null;
    out.effective = mode ? mode.getAttribute('data-broad-mode-effective') : null;
    // The compact dialog states the asking setting with its source; S07 lists every setting's source.
    out.summary = section && q('[data-conversation-approval-policy]', section) ? q('[data-conversation-approval-policy]', section).textContent : null;
    const full = q('[data-broad-mode-option="full_access"]');
    out.fullDisabled = full ? full.getAttribute('aria-disabled') : null;
    out.fullReason = full && full.getAttribute('aria-describedby') ? (document.getElementById(full.getAttribute('aria-describedby').split(' ')[0]) || {}).textContent || null : null;
    out.sectionText = section ? section.textContent : null;
    out.wording = section ? ${APPROVAL_WORDING.toString()}.test(section.textContent) : true;
    out.acceptedChips = section ? section.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained').length : -1;
    out.chips = section ? [...section.querySelectorAll('.iq-status-chip')].map((chip) => {
      const style = getComputedStyle(chip);
      return { className: chip.className, color: style.color, background: style.backgroundColor, border: style.borderTopColor };
    }) : [];
    // Pressing the unavailable control opens nothing.
    if (full) full.click();
    await new Promise((resolve) => setTimeout(resolve, 300));
    out.confirmOpened = !!q('[data-broad-mode-confirm]');
    const set = (confirmation) => globalThis.inquello.policy.setBroadMode({ operationId: ${JSON.stringify(operationId)}, taskId: ${JSON.stringify(taskId)}, expectedRevision: 0, mode: 'full_access', confirmation });
    out.request = await set(${JSON.stringify(FULL_ACCESS_REACH)}).then((value) => value, (error) => String(error && error.message));
    out.unconfirmed = await set(null).then(() => 'accepted', (error) => String(error && error.message));
    out.dialogClosed = await closeConversationDialogs();
    return out;
  })()`;
}

const POLICY_SIGNED_OUT_PROBE = `(async () => {
  const out = {};
  out.settings = await globalThis.inquello.policy.getSettings();
  out.request = await globalThis.inquello.policy.setBroadMode({ operationId: '00000000-0000-4000-8000-000000000003', taskId: '00000000-0000-4000-8000-000000000001', expectedRevision: 0, mode: 'full_access', confirmation: ${JSON.stringify(FULL_ACCESS_REACH)} });
  return out;
})()`;

interface PolicyChipRead {
  className: string;
  color: string;
  background: string;
  border: string;
}

export interface PolicyProbeRead {
  configured: boolean;
  signedOut?: { settings: unknown; request: unknown };
  seedRead?: boolean;
  signedIn?: boolean;
  taskCreated?: boolean;
  settings?: {
    loaded: boolean;
    signedIn: string | null;
    settings: Array<{ name: string | null; value: string | null; source: string | null }>;
    device: string | null;
    environment: string | null;
    reason: string | null;
    capabilities: Array<{ id: string | null; text: string | null }>;
    wording: boolean;
    chips: PolicyChipRead[];
  };
  task?: {
    shellOpened: boolean;
    opened: boolean;
    status: string | null;
    effective: string | null;
    summary: string | null;
    fullDisabled: string | null;
    fullReason: string | null;
    sectionText: string | null;
    wording: boolean;
    acceptedChips: number;
    chips: PolicyChipRead[];
    confirmOpened: boolean;
    request: unknown;
    unconfirmed: string;
    dialogClosed: boolean;
  };
  threadSettings?: unknown;
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface PolicyReport extends PolicyProbeRead {
  ok: boolean;
  failures: string[];
}

function checkChips(chips: readonly PolicyChipRead[] | undefined, where: string, failures: string[]): void {
  for (const chip of chips ?? []) {
    if (/--accepted|--explained/.test(chip.className)) failures.push(`${where} shows an accepted or explained chip`);
    if (isGreenish(chip.color) || isGreenish(chip.background) || isGreenish(chip.border)) failures.push(`${where} shows a green chip`);
  }
}

function checkContract(capabilities: ReadonlyArray<{ id: string | null; text: string | null }> | undefined, failures: string[]): void {
  const byId = new Map((capabilities ?? []).map((entry) => [entry.id, entry.text ?? '']));
  for (const [id, label] of [
    ['prompt_inspection', 'Prompt inspection'],
    ['specialist_cyber_access', 'Specialist cyber access'],
  ] as const) {
    const textOf = byId.get(id);
    if (!textOf?.includes(label) || !textOf.includes(NOT_ENABLED)) failures.push(`${label} is not listed as not enabled (${JSON.stringify(textOf)})`);
  }
}

/** Pass/fail for the policy probe with the default seed (no `execution` section). */
export function evaluatePolicy(read: PolicyProbeRead): PolicyReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) {
    const settings = read.signedOut?.settings as { signedIn?: unknown; capabilities?: Array<{ id?: unknown; enabled?: unknown }> } | undefined;
    if (settings?.signedIn !== false) failures.push('main showed a policy while signed out');
    const request = read.signedOut?.request as { ok?: unknown; code?: unknown } | undefined;
    if (request?.ok !== false || request.code !== 'signed-out') failures.push('a broader mode was not refused while signed out');
    return { ok: failures.length === 0, failures, ...read };
  }
  if (!read.seedRead) failures.push('the dev topology seed file (INQUELLO_SMOKE_SEED) could not be read');
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.taskCreated) failures.push('no Task was created for the policy probe');
  const s = read.settings;
  if (!s?.loaded || s.signedIn !== 'true') failures.push('S07 did not load the policy');
  const names = (s?.settings ?? []).map((row) => row.name);
  if (JSON.stringify(names) !== JSON.stringify(POLICY_SETTING_NAMES)) failures.push(`S07 lists ${JSON.stringify(names)}`);
  for (const row of s?.settings ?? []) {
    if (row.source !== 'Inquello default') failures.push(`S07 ${row.name} is governed by ${JSON.stringify(row.source)}, not the Inquello default`);
  }
  const value = (name: string) => s?.settings.find((row) => row.name === name)?.value;
  if (value('sandbox') !== 'Workspace write') failures.push(`S07 sandbox reads ${JSON.stringify(value('sandbox'))}`);
  if (value('approval') !== 'Asks when the agent requests it') failures.push(`S07 asking reads ${JSON.stringify(value('approval'))}`);
  for (const name of ['network', 'mcp_tools', 'extensions']) if (value(name) !== 'Denied') failures.push(`S07 ${name} reads ${JSON.stringify(value(name))}`);
  for (const name of ['full_access', 'no_prompt']) if (value(name) !== 'Not available') failures.push(`S07 ${name} reads ${JSON.stringify(value(name))}`);
  if (s?.device !== 'Device-managed requirements: None configured on this device') failures.push(`S07 device layer reads ${JSON.stringify(s?.device)}`);
  if (!s?.environment?.includes('Local device')) failures.push(`S07 environment reads ${JSON.stringify(s?.environment)}`);
  checkContract(s?.capabilities, failures);
  if (s?.wording !== false) failures.push('S07 uses review or approval wording');
  checkChips(s?.chips, 'S07', failures);

  const t = read.task;
  if (!t?.shellOpened || !t.opened) failures.push('the Task did not open in the Shell');
  if (t?.status !== 'standard' || t.effective !== 'standard') failures.push(`the Task mode is ${JSON.stringify(t?.status)} / ${JSON.stringify(t?.effective)}`);
  if (!t?.summary?.includes('Asks when the agent requests it') || !t.summary.includes('Inquello default')) failures.push(`the Task policy summary reads ${JSON.stringify(t?.summary)}`);
  if (t && !t.dialogClosed) failures.push('the Permissions dialog did not close');
  if (!t?.sectionText?.includes('Broader execution mode')) failures.push('the Task does not label its execution mode');
  const ruleText = 'Full access is not available: not permitted by the Inquello default.';
  if (t?.fullDisabled !== 'true' || !t.fullReason?.includes(ruleText)) failures.push(`the Full access control is not unavailable with its rule (${JSON.stringify(t?.fullDisabled)}, ${JSON.stringify(t?.fullReason)})`);
  if (t?.confirmOpened !== false) failures.push('an unavailable broader mode opened its confirmation');
  const request = t?.request as { ok?: unknown; code?: unknown; reason?: unknown } | undefined;
  if (request?.ok !== false || request.code !== 'broad-mode-not-permitted' || request.reason !== ruleText) {
    failures.push(`a Full access request was not refused with its governing rule (${JSON.stringify(request)})`);
  }
  if (!t?.unconfirmed.includes('invalid payload')) failures.push(`a Full access request without its confirmation passed main (${t?.unconfirmed})`);
  if (t?.wording !== false) failures.push('the Task policy uses review or approval wording');
  if (t?.acceptedChips !== 0) failures.push('the Task policy shows an accepted or explained chip');
  checkChips(t?.chips, 'the Task policy', failures);
  const thread = read.threadSettings as { ok?: unknown; value?: { sandbox?: unknown; approvalPolicy?: unknown; mode?: unknown } } | undefined;
  if (thread?.ok !== true || thread.value?.sandbox !== 'workspace-write' || thread.value.approvalPolicy !== 'on-request' || thread.value.mode !== 'standard') {
    failures.push(`effectiveThreadSettings answered ${JSON.stringify(thread)}`);
  }
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

export interface PolicyProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> {
  policy: PolicyService;
}

/** Runs the policy probe against the live renderer, main's policy service and the runtime. */
export async function probePolicy(contents: WebContents, options: PolicyProbeOptions): Promise<PolicyReport> {
  const { identity, organise, policy } = options;
  const configured = identity.config.kind === 'configured';
  const read: PolicyProbeRead = { configured };
  if (!configured) {
    read.signedOut = (await contents.executeJavaScript(POLICY_SIGNED_OUT_PROBE)) as PolicyProbeRead['signedOut'];
    return evaluatePolicy(read);
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
    if (!workspaceId) return evaluatePolicy(read);
    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    await organise.getWorkspaces();
    const created = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke policy' });
    read.taskCreated = created.ok;
    if (!created.ok) return evaluatePolicy(read);
    const taskId = created.value.taskId;
    read.settings = (await contents.executeJavaScript(policySettingsProbe(workspaceId))) as PolicyProbeRead['settings'];
    read.task = (await contents.executeJavaScript(policyTaskProbe(taskId, randomUUID()))) as PolicyProbeRead['task'];
    // Only the thread settings: the tool profile holds device paths, which no report prints.
    const thread = await policy.effectiveThreadSettings(taskId);
    read.threadSettings = thread.ok
      ? { ok: true, value: { sandbox: thread.value.sandbox, approvalPolicy: thread.value.approvalPolicy, networkAccess: thread.value.networkAccess, mode: thread.value.mode } }
      : thread;
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluatePolicy(read);
}

// ---- bounded tool reads, writes and network (Story 1.19) ------------------------------

const TOOL_BOUNDS_SYSTEM = 'system (read-only)';
const TOOL_BOUNDS_PERMITTED = 'working folder (read/write), output folder, system (read-only)';
const TOOL_BOUNDS_DESTINATION = 'example.com';

/** Opens the Task's "Permissions" dialog and reads what its tools can reach, then S07's sandbox entry and reach. */
function toolBoundsRendererProbe(taskId: string, workspaceId: string): string {
  return `(async () => {
    ${SHELL_HELPERS}
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    const out = { shellOpened: await openShell() };
    const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(taskId)}] a'), ${SHELL_SETTLE_MS});
    if (row) row.click();
    const dialog = (await wait(() => qVisible('[data-task-view=${JSON.stringify(taskId)}]'), ${SHELL_SETTLE_MS})) ? await openConversationDialog('Permissions') : null;
    if (!dialog) throw new Error('Permissions did not open for tool reach');
    const reach = await wait(() => { const control = q('[data-task-reach=${JSON.stringify(taskId)}] [data-reach]', dialog); return control?.getClientRects().length ? control : null; }, ${POLICY_SETTLE_MS});
    const section = q('[data-task-reach=${JSON.stringify(taskId)}]', dialog);
    out.bounded = reach ? reach.getAttribute('data-reach-bounded') : null;
    out.lines = reach ? [...reach.querySelectorAll('[data-reach-line]')].map((line) => ({ name: line.getAttribute('data-reach-line'), text: line.textContent })) : [];
    out.sandbox = section && q('[data-task-sandbox]', section) ? { status: q('[data-task-sandbox]', section).getAttribute('data-task-sandbox'), text: q('[data-task-sandbox]', section).textContent } : null;
    out.sectionText = section ? section.textContent : null;
    out.dialogClosed = await closeConversationDialogs();
    location.hash = '#specimen';
    await wait(specimenReady, 5000);
    await wait(() => q('[data-policy-workspace=${JSON.stringify(workspaceId)}] [data-reach]'), ${POLICY_SETTLE_MS});
    const workspace = q('[data-policy-workspace=${JSON.stringify(workspaceId)}] [data-reach]');
    out.settingsReach = workspace ? workspace.textContent : null;
    const sandbox = q('[data-capability-contract] [data-capability="execution_sandbox"]');
    out.contract = sandbox ? { text: sandbox.textContent, enabled: sandbox.getAttribute('data-enabled') } : null;
    out.pageText = document.body.textContent;
    return out;
  })()`;
}

export interface ToolRunRead {
  ok: boolean;
  code?: string;
  exitCode?: number;
  denials?: ToolDenial[];
  /** Whether the run printed what the check expects (never the output itself). */
  expected?: boolean;
}

export interface ToolBoundsProbeRead {
  configured: boolean;
  seedRead?: boolean;
  signedIn?: boolean;
  tasksCreated?: boolean;
  profile?: { bounded: boolean; sandbox: string; writableCount: number; allowlist: string[] | null; folderUnderUserData: boolean; private: boolean };
  writeInside?: ToolRunRead & { fileOnDevice: boolean };
  writeOutside?: ToolRunRead & { fileOnDevice: boolean };
  writeSystem?: ToolRunRead;
  readOutside?: ToolRunRead;
  network?: ToolRunRead;
  continued?: ToolRunRead;
  renderer?: {
    shellOpened: boolean;
    bounded: string | null;
    lines: Array<{ name: string | null; text: string | null }>;
    sandbox: { status: string | null; text: string | null } | null;
    sectionText: string | null;
    settingsReach: string | null;
    contract: { text: string | null; enabled: string | null } | null;
    dialogClosed?: boolean;
    /** Whether any rendered text held a device path of a Task folder. */
    pathShown?: boolean;
    wording?: boolean;
  };
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface ToolBoundsReport extends Omit<ToolBoundsProbeRead, 'renderer'> {
  ok: boolean;
  failures: string[];
  renderer?: Omit<NonNullable<ToolBoundsProbeRead['renderer']>, 'sectionText'>;
}

const denialTexts = (run: ToolRunRead | undefined): string[] => (run?.denials ?? []).map((denial) => denial.text);

/** Pass/fail for the tool-bounds probe with the default seed (no `execution` section: no destinations). */
export function evaluateToolBounds(read: ToolBoundsProbeRead): ToolBoundsReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) failures.push('the shared service is not configured');
  if (!read.seedRead) failures.push('the dev topology seed file (INQUELLO_SMOKE_SEED) could not be read');
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.tasksCreated) failures.push('the Tasks were not created');
  const p = read.profile;
  if (!p?.bounded || p.sandbox !== 'permission-profile') failures.push(`the Task profile is not bounded (${JSON.stringify(p)})`);
  if (p && (p.writableCount !== 2 || JSON.stringify(p.allowlist) !== '[]')) failures.push(`the Task profile reaches more than its folders (${JSON.stringify(p)})`);
  if (p && (!p.folderUnderUserData || !p.private)) failures.push('the Task folder is not a private folder in the data area');
  const w = read.writeInside;
  if (!w?.ok || w.exitCode !== 0 || !w.expected || !w.fileOnDevice || (w.denials ?? []).length !== 0) failures.push(`a write inside output did not succeed (${JSON.stringify(w)})`);
  const o = read.writeOutside;
  if (!o?.ok || o.exitCode === 0 || o.fileOnDevice || !denialTexts(o).includes(outsideDenialText(TOOL_BOUNDS_PERMITTED))) failures.push(`a write outside was not denied with its boundary (${JSON.stringify(o)})`);
  const sys = read.writeSystem;
  if (!sys?.ok || sys.exitCode === 0 || !denialTexts(sys).includes(outsideDenialText(TOOL_BOUNDS_SYSTEM))) failures.push(`a system write was not denied with its boundary (${JSON.stringify(sys)})`);
  const r = read.readOutside;
  if (!r?.ok || r.exitCode === 0 || r.expected || !denialTexts(r).includes(outsideDenialText(TOOL_BOUNDS_PERMITTED))) failures.push(`another Task's folder was readable (${JSON.stringify(r)})`);
  const n = read.network;
  if (!n?.ok || !denialTexts(n).includes(networkDenialText(TOOL_BOUNDS_DESTINATION))) failures.push(`an unlisted destination was not blocked and named (${JSON.stringify(n)})`);
  const c = read.continued;
  if (!c?.ok || c.exitCode !== 0 || !c.expected) failures.push(`a permitted command after the denials failed, or the earlier output was lost (${JSON.stringify(c)})`);
  const ui = read.renderer;
  if (!ui?.shellOpened) failures.push('the Shell did not open');
  if (ui?.bounded !== 'true') failures.push('the Task does not show a bounded reach');
  const line = (name: string) => ui?.lines.find((entry) => entry.name === name)?.text ?? '';
  if (!line('read').includes("This Task's working folder") || !line('read').includes('Output folder') || !line('read').includes('system files')) failures.push(`the Task's read line reads ${JSON.stringify(line('read'))}`);
  if (!line('write').includes("This Task's working folder") || !line('write').includes('Output folder')) failures.push(`the Task's write line reads ${JSON.stringify(line('write'))}`);
  if (!line('contact').includes('No network destinations')) failures.push(`the Task's contact line reads ${JSON.stringify(line('contact'))}`);
  if (ui?.sandbox?.status !== 'available') failures.push(`the Task's sandbox reads ${JSON.stringify(ui?.sandbox)}`);
  if (ui && ui.dialogClosed === false) failures.push('the Permissions dialog did not close');
  if (ui?.pathShown !== false) failures.push('a device path of a Task folder is shown');
  if (ui?.wording !== false) failures.push('the reach uses review or approval wording');
  if (!ui?.settingsReach?.includes('No network destinations')) failures.push(`S07 reach reads ${JSON.stringify(ui?.settingsReach)}`);
  if (!ui?.contract?.text?.includes('Execution sandbox') || !ui.contract.text.includes(EXECUTION_SANDBOX_STATUS)) failures.push(`S07 does not record the execution sandbox (${JSON.stringify(ui?.contract)})`);
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  const { renderer, ...rest } = read;
  const report: ToolBoundsReport = { ok: failures.length === 0, failures, ...rest };
  if (renderer) {
    const { sectionText: _sectionText, ...shown } = renderer;
    report.renderer = shown;
  }
  return report;
}

export interface ToolBoundsProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> {
  policy: PolicyService;
  /** The data area that holds the Task folders. */
  userDataDir: string;
}

async function toolRun(policy: PolicyService, taskId: string, command: string[], expect?: (stdout: string) => boolean): Promise<ToolRunRead> {
  const result = await policy.runTool(taskId, command, { timeoutMs: 30_000 });
  if (!result.ok) return { ok: false, code: result.code };
  return { ok: true, exitCode: result.value.exitCode, denials: result.value.denials, expected: expect ? expect(result.value.stdout) : undefined };
}

/** Runs the tool-bounds probe: real runtime, real local sandbox, synthetic paths and destinations. */
export async function probeToolBounds(contents: WebContents, options: ToolBoundsProbeOptions): Promise<ToolBoundsReport> {
  const { identity, organise, policy } = options;
  const read: ToolBoundsProbeRead = { configured: identity.config.kind === 'configured' };
  if (!read.configured) return evaluateToolBounds(read);
  try {
    let seed: { workspace_id?: unknown } = {};
    try {
      seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
    } catch {
      seed = {};
    }
    const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
    read.seedRead = workspaceId !== null;
    if (!workspaceId) return evaluateToolBounds(read);
    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    await organise.getWorkspaces();
    const a = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke tool bounds' });
    const b = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke other Task' });
    read.tasksCreated = a.ok && b.ok;
    if (!a.ok || !b.ok) return evaluateToolBounds(read);
    const taskA = a.value.taskId;
    const settingsA = await policy.effectiveThreadSettings(taskA);
    const settingsB = await policy.effectiveThreadSettings(b.value.taskId);
    if (!settingsA.ok || !settingsB.ok) throw new Error(`the thread settings could not be computed (${settingsA.ok ? '' : settingsA.reason} ${settingsB.ok ? '' : settingsB.reason})`);
    const folders = settingsA.value.folders;
    const files = taskFiles(folders.working, identity.session.principalId()!);
    const otherFiles = taskFiles(settingsB.value.folders.working, identity.session.principalId()!);
    const other = otherFiles.root;
    read.profile = {
      bounded: settingsA.value.reach.bounded,
      sandbox: settingsA.value.profile.sandbox,
      writableCount: settingsA.value.profile.writableRoots.length,
      allowlist: settingsA.value.profile.networkAllowlist,
      folderUnderUserData: isInside(options.userDataDir, folders.working),
      private: isPrivatePath(folders.working, 'directory'),
    };
    // Another Task's synthetic file, written on this device by main.
    await otherFiles.write('synthetic-secret.txt', 'synthetic');
    const inside = await toolRun(policy, taskA, ['/bin/sh', '-c', 'printf tool-bounds > output/a.txt && cat output/a.txt'], (out) => out === 'tool-bounds');
    read.writeInside = { ...inside, fileOnDevice: (await files.read('output/a.txt')) === 'tool-bounds' };
    const outsideFile = `${other.replaceAll('\\', '/')}/written-by-another-task.txt`;
    const outside = await toolRun(policy, taskA, ['/bin/sh', '-c', 'printf x > "$1"', 'tool-bounds', outsideFile]);
    read.writeOutside = { ...outside, fileOnDevice: (await otherFiles.read('written-by-another-task.txt')) !== null };
    read.writeSystem = await toolRun(policy, taskA, ['/bin/sh', '-c', 'printf x > /etc/inquello-tool-bounds']);
    read.readOutside = await toolRun(policy, taskA, ['/bin/cat', `${other.replaceAll('\\', '/')}/synthetic-secret.txt`], (out) => out.includes('synthetic'));
    read.network = await toolRun(policy, taskA, ['curl', '-sS', '-m', '20', `http://${TOOL_BOUNDS_DESTINATION}/`]);
    read.continued = await toolRun(policy, taskA, ['/bin/sh', '-c', 'cat output/a.txt'], (out) => out === 'tool-bounds');
    const ui = (await contents.executeJavaScript(toolBoundsRendererProbe(taskA, workspaceId))) as NonNullable<ToolBoundsProbeRead['renderer']> & { pageText?: string | null };
    const shown = `${ui.sectionText ?? ''} ${ui.settingsReach ?? ''} ${ui.pageText ?? ''}`;
    ui.pathShown = [folders.working, folders.output, other, options.userDataDir].some((dir) => shown.includes(dir)) || shown.includes(`/tasks/`);
    ui.wording = APPROVAL_WORDING.test(`${ui.sectionText ?? ''} ${ui.settingsReach ?? ''}`);
    delete ui.pageText;
    read.renderer = ui;
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluateToolBounds(read);
}

// ---- permission to act (Story 1.20) ---------------------------------------------------

const PERMISSION_SETTLE_MS = 20_000;
/** The prefix the smoke's own prompt rule asks before; no other probe runs it. */
const PERMISSION_PROMPT_PREFIX = ['/usr/bin/touch'];
/** The prefix the smoke's own forbid rule refuses. */
const PERMISSION_FORBID_PREFIX = ['/usr/bin/rm'];
const PERMISSION_FILE = 'permission-smoke.txt';
/** Labels a permission card may never use. */
const BARE_APPROVE = /^\s*approve\s*$/i;

/** Sets the person's own rules through the renderer bridge, at the revision S07 read. */
function permissionRulesProbe(rules: ReadonlyArray<{ prefix: string[]; decision: string; note: string | null }>, operationId: string): string {
  return `(async () => {
    const view = await globalThis.inquello.permissions.getRules();
    const revision = view && view.userRules ? view.userRules.revision : 0;
    return await globalThis.inquello.permissions.setUserRules({ operationId: ${JSON.stringify(operationId)}, expectedRevision: revision, rules: ${JSON.stringify(rules)} });
  })()`;
}

/** Opens the Task, waits for a new card, reads it, announces and presses `press` ('deny' or 'run'). */
function permissionCardProbe(taskId: string, press: 'deny' | 'run', skip: readonly string[]): string {
  return `(async () => {
    ${SHELL_HELPERS}
    const out = { shellOpened: visible(q('[data-shell]')) || await openShell() };
    // An authority or model-catalog change while the Task is opening (the
    // permission review refreshes the catalog) correctly drops that open, so
    // a person would click again: retry the row until the Task view is shown.
    out.taskOpened = !!(await wait(() => {
      if (q('[data-task-view=${JSON.stringify(taskId)}]')) return true;
      const row = qVisible('[data-task-id=${JSON.stringify(taskId)}] a');
      if (row && !row.dataset.smokeClicked) { row.dataset.smokeClicked = 'true'; row.click(); setTimeout(() => { delete row.dataset.smokeClicked; }, 2000); }
      return false;
    }, ${SHELL_SETTLE_MS}));
    const skip = ${JSON.stringify(skip)};
    const holder = await wait(() => [...document.querySelectorAll('[data-permission-review=${JSON.stringify(taskId)}] [data-permission-state="pending"]')].find((el) => !skip.includes(el.getAttribute('data-permission-request'))), ${PERMISSION_SETTLE_MS});
    out.found = !!holder;
    if (!holder) return out;
    out.requestId = holder.getAttribute('data-permission-request');
    const card = holder.querySelector('[role="region"]');
    const region = card ? card.closest('[data-permission-review]') : null;
    out.regionLabel = region ? region.getAttribute('aria-label') : null;
    out.overline = text('.iq-approval-overline');
    out.context = card ? (card.querySelector('.iq-approval-context') || {}).textContent || null : null;
    out.action = card ? (card.querySelector('.iq-approval-action') || {}).textContent || null : null;
    out.quote = card ? (card.querySelector('.iq-approval-quote') || {}).textContent || null : null;
    out.facts = card ? [...card.querySelectorAll('.iq-approval-fact')].map((fact) => ({ term: (fact.querySelector('dt') || {}).textContent || null, detail: (fact.querySelector('dd') || {}).textContent || null })) : [];
    out.buttons = card ? [...card.querySelectorAll('button')].map((button) => button.textContent) : [];
    out.buttonsFocusable = card ? [...card.querySelectorAll('button')].every((button) => button.tabIndex >= 0 && !button.disabled) : false;
    const announcer = q('[data-shell-announcer]');
    out.announced = announcer ? announcer.textContent : null;
    const buttons = card ? [...card.querySelectorAll('button')] : [];
    const target = ${JSON.stringify(press)} === 'run' ? buttons[0] : buttons.find((button) => button.textContent === 'Deny');
    out.pressed = target ? target.textContent : null;
    if (target) target.click();
    out.cardGone = !!(await wait(() => !q('[data-permission-request="' + out.requestId + '"][data-permission-state="pending"]'), ${PERMISSION_SETTLE_MS}));
    const note = await wait(() => q('[data-permission-outcome="' + out.requestId + '"]'), ${PERMISSION_SETTLE_MS});
    out.outcome = note ? note.textContent : null;
    return out;
  })()`;
}

interface PermissionCardRead {
  shellOpened: boolean;
  taskOpened?: boolean;
  found: boolean;
  requestId?: string | null;
  regionLabel?: string | null;
  overline?: string | null;
  context?: string | null;
  action?: string | null;
  quote?: string | null;
  facts?: Array<{ term: string | null; detail: string | null }>;
  buttons?: Array<string | null>;
  buttonsFocusable?: boolean;
  announced?: string | null;
  pressed?: string | null;
  cardGone?: boolean;
  outcome?: string | null;
}

export interface PermissionsProbeRead {
  configured: boolean;
  seedRead?: boolean;
  signedIn?: boolean;
  taskCreated?: boolean;
  promptRuleSet?: unknown;
  denied?: { card: PermissionCardRead; run: { ok: boolean; code?: string; reason?: string }; fileOnDevice: boolean };
  allowed?: { card: PermissionCardRead; run: { ok: boolean; code?: string; exitCode?: number; denials?: string[]; permissionRequestId?: string | null }; fileOnDevice: boolean };
  forbidden?: { ok: boolean; code?: string; reason?: string };
  allowRule?: unknown;
  states?: { before: string; after: string; reviewAndApproval: number };
  rulesCleared?: boolean;
  signedOutAtEnd?: boolean;
  error?: string;
}

export interface PermissionsReport extends PermissionsProbeRead {
  ok: boolean;
  failures: string[];
}

function checkCard(card: PermissionCardRead | undefined, where: string, command: string, failures: string[]): void {
  if (!card?.found) {
    failures.push(`${where}: no ApprovalCard appeared`);
    return;
  }
  if (card.regionLabel !== 'Contextual review') failures.push(`${where}: the card is not in the contextual review area (${JSON.stringify(card.regionLabel)})`);
  if (card.context !== 'Permission to act') failures.push(`${where}: the card is labelled ${JSON.stringify(card.context)}`);
  if (card.quote !== command) failures.push(`${where}: the card quotes ${JSON.stringify(card.quote)}, not the exact command`);
  const fact = (term: string) => card.facts?.find((entry) => entry.term === term)?.detail ?? '';
  if (!fact('Destination').includes("This Task's working folder")) failures.push(`${where}: the destination reads ${JSON.stringify(fact('Destination'))}`);
  if (!fact('Consequence').includes('cannot undo') || !fact('Consequence').includes('adds no rule')) failures.push(`${where}: the consequence reads ${JSON.stringify(fact('Consequence'))}`);
  if (!fact('Rule').includes(PERMISSION_PROMPT_PREFIX.join(' ')) || !fact('Rule').includes('your rule')) failures.push(`${where}: the rule reads ${JSON.stringify(fact('Rule'))}`);
  const buttons = card.buttons ?? [];
  if (buttons[0] !== `Run \`${command}\``) failures.push(`${where}: the primary button reads ${JSON.stringify(buttons[0])}`);
  if (JSON.stringify(buttons.slice(1)) !== JSON.stringify(['Deny', 'Deny and add a rule to always ask', 'Deny and forbid this prefix'])) failures.push(`${where}: the alternatives are ${JSON.stringify(buttons.slice(1))}`);
  if (buttons.some((label) => BARE_APPROVE.test(label ?? '') || /always allow/i.test(label ?? ''))) failures.push(`${where}: a button reads Approve or always allow`);
  if (!card.buttonsFocusable) failures.push(`${where}: the card's buttons are not reachable by keyboard`);
  if (!card.announced?.includes('Permission to act needed')) failures.push(`${where}: the request was not announced (${JSON.stringify(card.announced)})`);
  if (!card.cardGone) failures.push(`${where}: the card stayed pending after ${JSON.stringify(card.pressed)}`);
}

/** Pass/fail for the permissions probe with the default seed and the person's own rules. */
export function evaluatePermissions(read: PermissionsProbeRead, command: string): PermissionsReport {
  const failures: string[] = [];
  if (read.error) failures.push(`the probe stopped: ${read.error}`);
  if (!read.configured) failures.push('the shared service is not configured');
  if (!read.seedRead) failures.push('the dev topology seed file (INQUELLO_SMOKE_SEED) could not be read');
  if (!read.signedIn) failures.push('the synthetic user did not sign in');
  if (!read.taskCreated) failures.push('the Task was not created');
  if ((read.promptRuleSet as { ok?: unknown } | undefined)?.ok !== true) failures.push(`the prompt rule was not set (${JSON.stringify(read.promptRuleSet)})`);
  const d = read.denied;
  checkCard(d?.card, 'deny', command, failures);
  if (d?.card.pressed !== 'Deny') failures.push('Deny was not pressed');
  if (d?.run.ok !== false || d.run.code !== 'permission-denied') failures.push(`a denied command was not refused (${JSON.stringify(d?.run)})`);
  if (d?.fileOnDevice !== false) failures.push('a denied command ran');
  if (!d?.card.outcome?.includes('Denied: nothing ran.')) failures.push(`the denial reads ${JSON.stringify(d?.card.outcome)}`);
  const a = read.allowed;
  checkCard(a?.card, 'allow', command, failures);
  if (a?.card.pressed !== `Run \`${command}\``) failures.push('the action button was not pressed');
  if (a?.run.ok !== true || a.run.permissionRequestId !== a.card.requestId) failures.push(`the allowed command did not run under its request (${JSON.stringify(a?.run)})`);
  if (a?.fileOnDevice !== true) failures.push('the allowed command did not write inside the Task folder');
  if (!(a?.run.denials ?? []).some((denial) => denial.startsWith("Blocked: outside this Task's permitted locations"))) failures.push(`the allowed command was not held to the sandbox (${JSON.stringify(a?.run)})`);
  const f = read.forbidden;
  if (f?.ok !== false || f.code !== 'command-forbidden' || !f.reason?.includes(PERMISSION_FORBID_PREFIX.join(' ')) || !f.reason.includes('your rule')) failures.push(`a forbidden command was not refused with its rule and source (${JSON.stringify(f)})`);
  const allowRule = read.allowRule as { ok?: unknown; code?: unknown } | undefined;
  if (allowRule?.ok !== false || allowRule.code !== 'user-rule-cannot-allow') failures.push(`a user allow rule was not refused (${JSON.stringify(read.allowRule)})`);
  if (!read.states || read.states.before !== read.states.after || read.states.reviewAndApproval !== 0) failures.push(`review or approval states changed (${JSON.stringify(read.states)})`);
  if (!read.rulesCleared) failures.push('the smoke rules were not removed at the end');
  if (!read.signedOutAtEnd) failures.push('the probe could not sign out at the end');
  return { ok: failures.length === 0, failures, ...read };
}

export interface PermissionsProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> {
  policy: PolicyService;
}

/** Runs the permissions probe: the person's own rules, real cards in the Shell, real runtime and sandbox. */
export async function probePermissions(contents: WebContents, options: PermissionsProbeOptions): Promise<PermissionsReport> {
  const { identity, organise, policy } = options;
  const read: PermissionsProbeRead = { configured: identity.config.kind === 'configured' };
  let command = '';
  if (!read.configured) return evaluatePermissions(read, command);
  try {
    let seed: { workspace_id?: unknown } = {};
    try {
      seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as typeof seed;
    } catch {
      seed = {};
    }
    const workspaceId = typeof seed.workspace_id === 'string' ? seed.workspace_id : null;
    read.seedRead = workspaceId !== null;
    if (!workspaceId) return evaluatePermissions(read, command);
    read.signedIn = (await smokeIdentity(contents, 'signIn')).ok;
    await organise.syncPrincipal();
    await organise.getWorkspaces();
    const created = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke permissions' });
    const other = await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke permissions other' });
    read.taskCreated = created.ok && other.ok;
    if (!created.ok || !other.ok) return evaluatePermissions(read, command);
    const taskId = created.value.taskId;
    const settings = await policy.effectiveThreadSettings(taskId);
    const otherSettings = await policy.effectiveThreadSettings(other.value.taskId);
    if (!settings.ok || !otherSettings.ok) throw new Error('the thread settings could not be computed');
    const folders = settings.value.folders;
    const files = taskFiles(folders.working, identity.session.principalId()!);
    const otherFiles = taskFiles(otherSettings.value.folders.working, identity.session.principalId()!);
    // Relative to the Task's working folder, so no device path is quoted or reported.
    const argv = [...PERMISSION_PROMPT_PREFIX, `output/${PERMISSION_FILE}`, `../${other.value.taskId}/${PERMISSION_FILE}`];
    command = argv.join(' ');
    const statesOf = async () => {
      const states = await organise.listStates(taskId);
      if (!states.ok) return { text: 'unread', reviewAndApproval: -1 };
      const pick = states.value.dimensions.filter((entry) => entry.dimension === 'review' || entry.dimension === 'approval_marker');
      return { text: JSON.stringify(pick), reviewAndApproval: pick.reduce((total, entry) => total + entry.records.length, 0) };
    };
    const before = await statesOf();

    // The person's own rules: ask before the smoke command, forbid the smoke's rm prefix.
    read.promptRuleSet = await contents.executeJavaScript(
      permissionRulesProbe(
        [
          { prefix: PERMISSION_PROMPT_PREFIX, decision: 'prompt', note: null },
          { prefix: PERMISSION_FORBID_PREFIX, decision: 'forbid', note: null },
        ],
        randomUUID(),
      ),
    );

    // Deny: nothing runs.
    const deniedRun = policy.runTool(taskId, argv, { timeoutMs: 30_000 });
    const deniedCard = (await contents.executeJavaScript(permissionCardProbe(taskId, 'deny', []))) as PermissionCardRead;
    const denied = await deniedRun;
    read.denied = { card: deniedCard, run: denied.ok ? { ok: true } : { ok: false, code: denied.code, reason: denied.reason }, fileOnDevice: (await files.read(`output/${PERMISSION_FILE}`)) !== null };

    // Allow: runs once, inside the sandbox.
    const allowedRun = policy.runTool(taskId, argv, { timeoutMs: 30_000 });
    const allowedCard = (await contents.executeJavaScript(permissionCardProbe(taskId, 'run', [deniedCard.requestId ?? '']))) as PermissionCardRead;
    const allowed = await allowedRun;
    read.allowed = {
      card: allowedCard,
      run: allowed.ok
        ? { ok: true, exitCode: allowed.value.exitCode, denials: allowed.value.denials.map((denial) => denial.text), permissionRequestId: allowed.value.permissionRequestId }
        : { ok: false, code: allowed.code },
      fileOnDevice: (await files.read(`output/${PERMISSION_FILE}`)) !== null && (await otherFiles.read(PERMISSION_FILE)) === null,
    };

    // Forbid: refused with the rule and its source, without a card.
    const forbidden = await policy.runTool(taskId, [...PERMISSION_FORBID_PREFIX, `output/${PERMISSION_FILE}`], { timeoutMs: 30_000 });
    read.forbidden = forbidden.ok ? { ok: true } : { ok: false, code: forbidden.code, reason: forbidden.reason };

    // A user allow rule is refused by the runtime.
    read.allowRule = await contents.executeJavaScript(permissionRulesProbe([{ prefix: ['/usr/bin/curl'], decision: 'allow', note: null }], randomUUID()));

    const after = await statesOf();
    read.states = { before: before.text, after: after.text, reviewAndApproval: after.reviewAndApproval };
  } catch (error) {
    read.error = (error as Error).message;
  } finally {
    const cleared = (await contents.executeJavaScript(permissionRulesProbe([], randomUUID())).catch(() => null)) as { ok?: unknown } | null;
    read.rulesCleared = cleared?.ok === true;
    const signOut = await smokeIdentity(contents, 'signOut').catch(() => ({ ok: false }));
    await organise.syncPrincipal().catch(() => undefined);
    read.signedOutAtEnd = signOut.ok;
  }
  return evaluatePermissions(read, command);
}


// ---- honest runtime capability inventory (Story 1.21) ------------------------------
export interface CapabilitiesReport {
  ok: boolean; failures: string[]; configured: boolean;
  inventory?: CapabilityInventory; refusal?: CapabilityResult;
  renderer?: { kinds: string[]; builtins: number; providerSeparate: boolean; providerText: string; text: string; ordinarySettings?: boolean; focused?: boolean; returnedToChat?: boolean };
  signedOutAtEnd?: boolean;
}
export interface CapabilitiesProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> { capabilities: CapabilityService }

/** No install is performed: the default seed must refuse before target resolution. */
export async function probeCapabilities(contents: WebContents, options: CapabilitiesProbeOptions): Promise<CapabilitiesReport> {
  const configured = options.identity.config.kind === 'configured';
  const report: CapabilitiesReport = {ok:false, failures:[], configured};
  try {
    if (!configured) {
      report.inventory = await options.capabilities.getInventory('00000000-0000-4000-8000-000000000000');
      if (report.inventory.available) report.failures.push('capability inventory became available without Inquello authority');
    } else {
      const seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as {workspace_id?: string};
      if (!seed.workspace_id) throw new Error('the seeded Workspace is unavailable');
      if (!(await smokeIdentity(contents, 'signIn')).ok) throw new Error('could not sign in for the capability probe');
      await options.organise.syncPrincipal(); await options.organise.getWorkspaces();
      report.inventory = await options.capabilities.getInventory(seed.workspace_id);
      if (!report.inventory.available || report.inventory.stale) report.failures.push('runtime inventory was not current');
      if (!report.inventory.entries.some(entry => entry.kind === 'built_in')) report.failures.push('built-in tools were not listed');
      for (const entry of report.inventory.entries.filter(entry => entry.kind === 'plugin')) {
        if (entry.callable_now || !entry.reason_not_callable?.includes('extensions not allowed')) report.failures.push('a marketplace plugin did not name the blocking extensions rule');
      }
      report.refusal = await options.capabilities.manage({workspaceId:seed.workspace_id,kind:'plugin',id:'inquello-smoke-no-install',action:'install'});
      if (report.refusal.ok || !report.refusal.reason?.includes('extensions not allowed')) report.failures.push('plugin install was not refused with the extensions rule named');
      report.renderer = await contents.executeJavaScript(`(async () => {
        ${SHELL_HELPERS}
        const empty = {kinds:[],builtins:0,providerSeparate:false,providerText:'',text:'',ordinarySettings:false,focused:false,returnedToChat:false};
        if (!(await openShell())) return empty;
        const trigger = await wait(() => qVisible('button[aria-label="Organization and team"]'), ${SHELL_SETTLE_MS});
        if (!trigger) return empty;
        trigger.click();
        const settings = await wait(() => [...document.querySelectorAll('[role="menuitem"]')].find(node => visible(node) && node.textContent.trim() === 'Settings'), 5000);
        if (!settings) return empty;
        settings.click();
        const tools = await wait(() => qVisible('a[href="#settings-tools"]'), 5000);
        if (!tools) return empty;
        tools.focus(); tools.click();
        const section = await wait(() => qVisible('.iq-settings [data-capabilities-section][data-capabilities-loaded="true"]'), ${POLICY_SETTLE_MS});
        if (!section) return empty;
        const provider = q('[data-provider-session]', section);
        const result = {
          kinds:[...section.querySelectorAll('[data-capability-kind]')].map(node => node.getAttribute('data-capability-kind')),
          builtins:section.querySelectorAll('[data-capability-kind="built_in"] [data-inventory-entry]').length,
          providerSeparate:!!provider && !provider.closest('[data-identity-section]') && /separate from your Inquello identity/.test(provider.textContent),
          providerText:provider ? provider.textContent : '', text:section.textContent,
          ordinarySettings:location.hash === '#settings-tools' && tools.getAttribute('aria-current') === 'page' && section.getAttribute('data-capabilities-workspace') === ${JSON.stringify(seed.workspace_id)} && document.querySelectorAll('.iq-settings [data-capabilities-section]').length === 1 && !qVisible('.specimen-back'),
          focused:document.activeElement === q('.iq-settings-panel h2'), returnedToChat:false
        };
        const back = [...document.querySelectorAll('.iq-settings button')].find(node => node.textContent.trim() === 'Back to chat');
        if (back) back.click();
        result.returnedToChat = !!(await wait(() => location.hash === '#shell' && visible(q('[data-shell]')), 5000));
        return result;
      })()`) as CapabilitiesReport['renderer'];
      for (const kind of ['built_in','app','mcp_server','plugin','skill']) if (!report.renderer?.kinds.includes(kind)) report.failures.push(`inventory kind ${kind} did not render`);
      if (!report.renderer?.ordinarySettings || !report.renderer?.focused || !report.renderer?.returnedToChat) report.failures.push('ordinary Settings tools navigation, focus or return to chat failed');
      if (!report.renderer?.text.includes('Private Tasks currently keep configured MCP servers, apps and plugins disabled.')) report.failures.push('runtime readiness was not distinguished from private Task use');
      if (!report.renderer?.builtins) report.failures.push('built-in tools did not render');
      if (!report.renderer?.providerSeparate) report.failures.push('provider session was not separate from Inquello identity');
      if (!report.renderer?.providerText.includes('Account type') || !report.renderer.providerText.includes('Model selection')) report.failures.push('provider account type or effective route was missing');
    }
  } catch { report.failures.push('capabilities smoke could not finish; inspect local runtime availability and seeded topology'); }
  finally {
    if (configured) {
      report.signedOutAtEnd = (await smokeIdentity(contents, 'signOut').catch(() => ({ok:false}))).ok;
      await options.organise.syncPrincipal().catch(() => undefined);
      if (!report.signedOutAtEnd) report.failures.push('could not sign out after the capabilities probe');
    }
  }
  report.ok = report.failures.length === 0;
  return report;
}

// ---- governed processing routes (Story 1.22) ------------------------------------
/** Fixed probe diagnostics only; runtime/provider error text never enters reports. */
class SmokeProbeFailure extends Error {}
export interface RoutesReport { ok:boolean; failures:string[]; configured:boolean; verification:'configuration-only'; inferenceFixture:'not-run'; renderer?:{present:boolean;noDefault:boolean;configuredNotUsable:boolean;bindings:number}; selected?:boolean; reopened?:boolean }
/** No provider call or credential verification. Packaged inference fixtures remain a separate required gate. */
export async function probeRoutes(contents:WebContents, options:Omit<OrganiseProbeOptions,'runtimeRequest'> & {routes: import('./routes/service').RouteService}):Promise<RoutesReport>{
  const report:RoutesReport={ok:false,failures:[],configured:options.identity.config.kind==='configured',verification:'configuration-only',inferenceFixture:'not-run'};
  // Fixed local stage names only: never raw RPC, provider or credential errors.
  let stage='seeded-identity';
  try{
    if(!report.configured){report.failures.push('Seeded identity/runtime topology unavailable; route smoke unmet');return report;}
    const seed=JSON.parse(fs.readFileSync(options.seedFile??'','utf8')) as {workspace_id?:string};if(!seed.workspace_id)throw new SmokeProbeFailure('Missing seed');
    if(!(await smokeIdentity(contents, 'signIn')).ok)throw new SmokeProbeFailure('Sign-in unavailable');await options.organise.syncPrincipal();options.routes.resume();
    stage='route-catalog';const initial=await options.routes.list();if(!initial.ok)throw new SmokeProbeFailure('Routes unavailable');
    const candidate=initial.value.find(r=>r.routeId==='claude-api-key');if(!candidate)throw new SmokeProbeFailure('Missing Claude route');
    stage='route-configure';const saved=await options.routes.configure({operationId:randomUUID(),expectedRevision:candidate.revision,routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:null});if(!saved.ok)throw new SmokeProbeFailure('Configuration refused');
    const route=saved.value.find(r=>r.routeId==='claude-api-key');if(!route?.configuration||route.configuration.region!==null||route.enabled)report.failures.push('Configuration or unknown region falsely established eligibility');
    stage='task-route';const created=await options.organise.createTask({operationId:randomUUID(),workspaceId:seed.workspace_id,engagementId:null,folderId:null,title:'Synthetic processing route smoke'});if(!created.ok)throw new SmokeProbeFailure('Task unavailable');
    const before=await options.routes.forTask(created.value.taskId);if(!before.ok||before.value.selected!==null)report.failures.push('A new Task had an implicit default route');
    const selected=await options.routes.select({operationId:randomUUID(),expectedRevision:0,taskId:created.value.taskId,routeId:'claude-api-key',configurationRevision:route!.revision});report.selected=selected.ok;
    const reopened=await options.routes.forTask(created.value.taskId);report.reopened=reopened.ok&&reopened.value.selected?.configuration?.model==='claude-sonnet-5-5';if(!report.selected||!report.reopened)report.failures.push('Explicit Task route did not reopen');
    stage='settings-models';
    // Settings › Models: no model is preselected, and every saved binding of the
    // configured-but-unconnected Sonnet model is shown unavailable with main's own reason.
    report.renderer=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
      location.hash='#settings-routes';
      const section=await wait(()=>{const node=qVisible('[data-processing-routes]');return node&&q('select[aria-label="Model"]',node)?node:null;},${POLICY_SETTLE_MS});
      const select=section?q('select[aria-label="Model"]',section):null;
      const raw=await globalThis.inquello.routes.catalog();const bindings=raw?.ok?raw.value.bindings.filter(b=>b.name==='claude-sonnet-5-5'&&b.state==='active'):[];
      const shown=section?.textContent??'';
      const configuredNotUsable=bindings.every(b=>!b.available&&(!b.reason||shown.includes(b.reason)));
      location.hash='#specimen';await wait(specimenReady,5000);
      return{present:!!section,noDefault:select?.value==='',configuredNotUsable,bindings:bindings.length};
    })()`);
    if(!report.renderer?.present||!report.renderer.noDefault||!report.renderer.configuredNotUsable)report.failures.push(`Processing routes did not render truthful states (${JSON.stringify(report.renderer)})`);
  }catch(error){report.failures.push(error instanceof SmokeProbeFailure ? error.message : `Route smoke could not finish at ${stage}; native runtime/topology required`);}
  finally{if(report.configured){await options.routes.quiesce();await smokeIdentity(contents, 'signOut');await options.organise.syncPrincipal().catch(()=>{});options.routes.resume();}}
  report.ok=report.failures.length===0;return report;
}

/** Fixed diagnostics only; raw provider/RPC messages, methods and payloads never leave this helper. */
export function quotaFixtureDiagnostic(error: unknown): string {
  if (!(error instanceof RpcResponseError)) return '';
  const code = Number.isSafeInteger(error.rpcCode) && error.rpcCode >= -2147483648 && error.rpcCode <= 2147483647 ? String(error.rpcCode) : 'unknown';
  const data = error.data as { inquello?: { kind?: unknown } } | null;
  const kind = data?.inquello?.kind;
  const allowed = ['classification_unknown', 'fixture_unavailable', 'settings_required', 'settings_incompatible', 'authority_unknown', 'stale_authority', 'not_found', 'invalid', 'permission_required', 'reviewer_not_available', 'route_unavailable', 'store_unavailable', 'unauthenticated'];
  return ` [rpcCode=${code}; kind=${typeof kind === 'string' && allowed.includes(kind) ? kind : 'unclassified'}]`;
}

// ---- local execution facts (Story 1.23), no probes or inference -----------------
export async function probeEnvironments(contents: WebContents, options: OrganiseProbeOptions & {routes: import('./routes/service').RouteService; policy: PolicyService; usageChanged(privateScope:boolean):void}): Promise<{ok:boolean;failures:string[]}> {
  const failures: string[] = [];
  // Fixed local stage names only: never include raw RPC, provider or credential errors.
  let stage = 'seeded-identity';
  const configured = options.identity.config.kind === 'configured';
  try {
    if (!configured) throw new SmokeProbeFailure('Seeded topology unavailable');
    const seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as {workspace_id?:string};
    if (!seed.workspace_id || !(await smokeIdentity(contents, 'signIn')).ok) throw new SmokeProbeFailure('Seeded identity unavailable');
    stage = 'principal-sync';
    await options.organise.syncPrincipal();
    stage = 'task-create';
    const created = await options.organise.createTask({operationId:randomUUID(),workspaceId:seed.workspace_id,engagementId:null,folderId:null,title:'Synthetic environment inspection smoke'});
    if (!created.ok) throw new SmokeProbeFailure('Task unavailable');
    stage = 'native-environment-read';
    const result = await contents.executeJavaScript(`globalThis.inquello.environments.forTask({taskId:${JSON.stringify(created.value.taskId)}})`) as import('./environments/types').TaskEnvironmentResult;
    if (!result.ok || result.value.executionLabel !== 'This device (local host)' || result.value.readiness !== 'ready' || result.value.inference.status !== 'none' || !result.value.remoteGate.includes('Story 8.1') || result.value.hostedSandboxGate !== 'V2 revisit (OQ-13)') failures.push('Environment inspection did not preserve distinct local execution, empty inference and disabled remote gates');
    stage = 'mounted-environment';
    const rendered = await contents.executeJavaScript(`(async () => {
      ${SHELL_HELPERS}
      location.hash = '#specimen'; await wait(specimenReady, 5000);
      if (!(await openShell())) return false;
      const row = await wait(() => qVisible('[data-task-id=${JSON.stringify(created.value.taskId)}] a'), ${SHELL_SETTLE_MS});
      if (!row) return false; row.click();
      if (!(await wait(() => qVisible('[data-task-view=${JSON.stringify(created.value.taskId)}]'), ${SHELL_SETTLE_MS}))) return false;
      // Owner decision 2026-11-04: the environment chip sits beside the model in the composer footer.
      const chip = await wait(() => qVisible('[data-composer] [data-conversation-model] [data-environment-chip]'), ${SHELL_SETTLE_MS});
      if (!chip) return false; chip.click();
      const panel = await wait(() => { const node = qVisible('dialog[open] [data-task-environment]'); return node?.textContent.includes('No conversation model selected') ? node : null; }, ${POLICY_SETTLE_MS});
      if (!panel) return false;
      return panel.textContent.includes('This device (local host)') && panel.textContent.includes('runtime-owned configuration verified') && panel.textContent.includes('Story 8.1') && panel.textContent.includes('V2 revisit (OQ-13)') && [...panel.querySelectorAll('button[aria-disabled="true"]')].length >= 2;
    })()`) as boolean;
    if (!rendered) throw new SmokeProbeFailure('Environment panel did not render: the composer environment chip did not open [data-task-environment] for the open Task');
    // Safe synthetic selection through the real service emits main/preload invalidation.
    // No refresh click, renderer test event, credentials or inference call is used.
    stage = 'route-catalog';
    const catalog = await options.routes.list();
    if (!catalog.ok) throw new SmokeProbeFailure('Routes unavailable');
    const candidate = catalog.value.find(route => route.routeId === 'claude-api-key');
    if (!candidate || candidate.enabled) throw new SmokeProbeFailure('Synthetic disabled route unavailable');
    stage = 'route-configure';
    const configuredRoute = await options.routes.configure({operationId:randomUUID(),expectedRevision:candidate.revision,routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:null});
    if (!configuredRoute.ok) throw new SmokeProbeFailure('Synthetic configuration unavailable');
    const route = configuredRoute.value.find(row => row.routeId === 'claude-api-key');
    if (!route || route.enabled) throw new SmokeProbeFailure('Unexpected route eligibility');
    stage = 'route-select';
    const selectInput:import('./routes/types').SelectRouteInput={operationId:randomUUID(),expectedRevision:0,taskId:created.value.taskId,routeId:'claude-api-key',configurationRevision:route.revision};
    const selected = await options.routes.select(selectInput);
    if (!selected.ok) {
      // Diagnostic reconciliation only: keep the original failure, never substitute
      // a new operation or turn a replay into acceptance of this smoke gate.
      const diagnostic={readAvailable:false,readSelectedMatch:false,revisionMatch:false,replayAccepted:false,replayed:false};
      const current=await options.routes.forTask(selectInput.taskId);
      if(current.ok){diagnostic.readAvailable=true;diagnostic.readSelectedMatch=current.value.selected?.routeId===selectInput.routeId&&current.value.configurationRevision===selectInput.configurationRevision;diagnostic.revisionMatch=current.value.revision===selectInput.expectedRevision+1;}
      try{const replay=await options.runtimeRequest<{revision:number;receipt?:{replayed?:boolean}}>('inquello/routes/task/set',selectInput);diagnostic.replayAccepted=true;diagnostic.replayed=replay.receipt?.replayed===true;}catch{/* Fixed booleans only; no payload or IDs. */}
      throw new SmokeProbeFailure('Synthetic selection unavailable: '+selected.reason+'; reconciliation='+JSON.stringify(diagnostic));
    }
    stage = 'mounted-route-update';
    const updated = await contents.executeJavaScript(`(async () => {
      ${SHELL_HELPERS}
      const updated = !!(await wait(() => { const panel = qVisible('dialog[open] [data-task-environment]'); return panel?.textContent.includes('Selected conversation model') && panel.textContent.includes('claude-sonnet-5-5') && panel.textContent.includes('Unknown') && !panel.textContent.includes('No conversation model selected') && !/Deployment|Endpoint|API version|anthropic-direct|api[.]anthropic[.]com/i.test(panel.textContent) ? panel : null; }, ${POLICY_SETTLE_MS}));
      const close = [...document.querySelectorAll('dialog[open] button')].find((button) => button.textContent === 'Close Environment');
      if (close) close.click();
      if (!updated) { const panel = q('dialog[open] [data-task-environment]'); return JSON.stringify({taskView: !!qVisible('[data-task-view=${JSON.stringify(created.value.taskId)}]'), chip: !!qVisible('[data-environment-chip]'), dialog: !!q('dialog[open]'), panel: panel ? panel.textContent.slice(0, 400) : null}); }
      return !!(await wait(() => !q('dialog[open] [data-task-environment]'), ${SHELL_SETTLE_MS}));
    })()`) as boolean | string;
    if (updated !== true) failures.push('Mounted environment panel did not update via production route invalidation' + (typeof updated === 'string' ? '; observed=' + updated : ''));
    // Story 1.24: mounted choices follow the same real main/preload notification.
    // Persist defaults explicitly; this does not enable the disabled route or call a provider.
    stage = 'mounted-usage-settings';
    const usageChoices = await contents.executeJavaScript(`(async () => {
      ${SHELL_HELPERS}
      // Choosing the conversation model must leave the open conversation in place.
      if (!qVisible('[data-task-view=${JSON.stringify(created.value.taskId)}]')) return JSON.stringify({taskView:false,trigger:null,dialog:!!q('dialog[open]')});
      // Reasoning sits beside the model in the composer footer; it opens the explicit settings.
      const trigger = await wait(() => { const node=qVisible('[data-composer] [data-conversation-model] [data-conversation-reasoning]'); return node?.getAttribute('data-reasoning-state')==='unsaved' ? node : null; }, ${POLICY_SETTLE_MS});
      if (!trigger) { const node = q('[data-conversation-reasoning]'); return JSON.stringify({taskView: !!qVisible('[data-task-view=${JSON.stringify(created.value.taskId)}]'), trigger: node ? node.getAttribute('data-reasoning-state') : null, dialog: !!q('dialog[open]')}); }
      trigger.click();
      const panel = await wait(() => { const node=qVisible('dialog[open] [data-task-reasoning]'); return node?.querySelector('select[aria-label="Reasoning"]:not(:disabled)') ? node : null; }, ${POLICY_SETTLE_MS});
      if (!panel || !panel.textContent.includes('Defaults are not saved yet')) return false;
      const save=[...panel.querySelectorAll('button')].find(button=>button.textContent==='Save Task settings');
      if (!save) return false; save.click();
      const saved = !!(await wait(() => { const node=qVisible('dialog[open] [data-task-reasoning]'); return node?.querySelector('select[aria-label="Reasoning"]') && !node.textContent.includes('Defaults are not saved yet') && qVisible('[data-conversation-reasoning]')?.getAttribute('data-reasoning-state')==='saved' ? node : null; }, ${POLICY_SETTLE_MS}));
      const close = [...document.querySelectorAll('dialog[open] button')].find((button) => button.textContent === 'Close Reasoning and speed');
      if (close) close.click();
      return saved && !!(await wait(() => !q('dialog[open] [data-task-reasoning]'), ${SHELL_SETTLE_MS}));
    })()`) as boolean | string;
    if (usageChoices !== true) failures.push('Mounted usage choices did not save explicit defaults' + (typeof usageChoices === 'string' ? '; observed=' + usageChoices : ''));
    // Harmless local invocations, repeated and failed, are accounted at the real boundary.
    stage = 'bounded-local-invocations';
    for (const command of [['/bin/sh','-c','exit 0'],['/bin/sh','-c','exit 7'],['/bin/sh','-c','exit 0']]) {
      const run=await options.policy.runTool(created.value.taskId,command,{timeoutMs:30_000});
      if (!run.ok) throw new SmokeProbeFailure('Synthetic local invocation unavailable ('+run.code+')');
    }
    stage = 'mounted-usage-history';
    const history = await contents.executeJavaScript(`(async () => {
      ${SHELL_HELPERS}
      // Attributable usage and limits live in Settings > Usage for the open conversation.
      location.hash = '#settings-usage';
      const found = !!(await wait(() => { const node=qVisible('[data-settings-usage-task=${JSON.stringify(created.value.taskId)}] [data-task-usage]'); const rows=node?.querySelectorAll('[data-usage-attempt]'); return rows?.length>=3 && node.textContent.includes('Local tool invocation — completed') && node.textContent.includes('Local tool invocation — failed') && node.textContent.includes('Unknown / Unknown') ? node : null; }, ${POLICY_SETTLE_MS}));
      const observed = found ? null : JSON.stringify({settings: !!q('[data-settings-usage]'), task: q('[data-settings-usage]')?.getAttribute('data-settings-usage-task') === ${JSON.stringify(created.value.taskId)}, rows: q('[data-task-usage]')?.querySelectorAll('[data-usage-attempt]').length ?? null, text: q('[data-task-usage]')?.textContent.slice(0, 300) ?? null});
      location.hash = '#shell';
      return found || observed;
    })()`) as boolean | string;
    if (history !== true) failures.push('Native repeated/failed tool history did not reach mounted usage through production notifications' + (typeof history === 'string' ? '; observed=' + history : ''));




  } catch (error) { failures.push((error instanceof SmokeProbeFailure ? error.message : `Environment smoke could not finish at ${stage}; seeded identity and matching native runtime required`) + (stage === 'quota-fixture-refuse' ? quotaFixtureDiagnostic(error) : '')); }
  finally { if (configured) { await smokeIdentity(contents, 'signOut'); await options.organise.syncPrincipal().catch(() => {}); } }
  return {ok:failures.length===0,failures};
}


/** Diagnostic pixels only, bounded and scoped to the launch-owned fixture folder. */
async function captureSmokeFailure(contents:WebContents,fixtureFile:string):Promise<{name:string;path:string;width:number;height:number}|null>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    if(!fixtureFile||!fs.existsSync(fixtureFile))return null;
    const image=await Promise.race([contents.capturePage(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Capture deadline')),2000);})]);
    if(image.isEmpty())return null;
    const folder=path.join(path.dirname(fixtureFile),'captures');fs.mkdirSync(folder,{recursive:true});
    const file=path.join(folder,'failure-synthetic.png'),size=image.getSize();fs.writeFileSync(file,image.toPNG());
    return{name:'failure-synthetic',path:file,width:size.width,height:size.height};
  }catch{return null;}finally{if(timer)clearTimeout(timer);}
}

/** Dedicated debug-only Electron quota journey. The launcher supplies an isolated
 * service Workspace and pinned loopback fixture; no renderer may classify data. */
export async function probeQuota(contents: WebContents, options: OrganiseProbeOptions & {
  routes: import('./routes/service').RouteService; policy: PolicyService;
  usageChanged(privateScope:boolean):void; isolatedRoot:string; fixtureFile:string; armSyntheticSession(workspaceId:string):Promise<void>;
}):Promise<{ok:boolean;failures:string[];failureCapture?:{name:string;path:string;width:number;height:number}}> {
  const failures:string[]=[]; let stage='seeded-identity';
  let failureCapture:{name:string;path:string;width:number;height:number}|null=null;
  try {
    const seed=JSON.parse(fs.readFileSync(options.seedFile??'', 'utf8')) as {workspace_id:string;invite_id:string};
    const transport=JSON.parse(fs.readFileSync(options.fixtureFile,'utf8')) as {endpoint:string;certificate:number[]};
    const endpoint=new URL(transport.endpoint);
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='127.0.0.1'||endpoint.pathname!=='/v1/messages'||!Array.isArray(transport.certificate)||transport.certificate.length>8192||transport.certificate.some(n=>!Number.isInteger(n)||n<0||n>255))throw new SmokeProbeFailure('Pinned local quota fixture unavailable');
    if(!(await smokeIdentity(contents,'signIn')).ok)throw new SmokeProbeFailure('Quota identity unavailable');
    const accepted=await options.identity.session.withAccess(access=>options.identity.service!.acceptInvite(access,seed.invite_id));
    if(accepted?.workspace_id!==seed.workspace_id)throw new SmokeProbeFailure('Quota Workspace invitation unavailable');
    await options.organise.syncPrincipal(); await options.organise.getWorkspaces();
    stage='native-bootstrap';
    fs.writeFileSync(path.join(options.isolatedRoot,'.inquello-fictional-audit-session'),'explicit isolated quota fixture');
    await options.armSyntheticSession(seed.workspace_id);
    const principal=options.identity.session.principalId();
    // Match the passing native quota witness: configure both candidates before
    // starting work. A later candidate edit correctly invalidates inference state.
    await options.runtimeRequest('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:0,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'fixture-model-20261030',apiVersion:'responses-v1',accountRef:principal,region:null}});
    const configuration={routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:principal,region:null};
    await options.runtimeRequest('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:0,configuration});
    const bound=await options.runtimeRequest<{accepted:boolean;providerCalls:number}>('inquello/fixture/taskTransport',{workspaceId:seed.workspace_id,configurationRevision:1,routeId:'claude-api-key',...transport,failBeforeSampling:true});
    if(!bound.accepted||bound.providerCalls!==0)throw new SmokeProbeFailure('Native quota transport refused');
    const initialPolicy=await options.policy.startPolicy(seed.workspace_id);
    const expectedExecution={automatic_permission_review:true,command_rules:[{prefix:['/usr/bin/true'],decision:'prompt'}]};
    const execution=JSON.parse(JSON.stringify(initialPolicy?.execution??null));
    if(!execution||execution.automatic_permission_review!==true||JSON.stringify(execution.command_rules)!==JSON.stringify(expectedExecution.command_rules)||Object.keys(execution).sort().join(',')!=='automatic_permission_review,command_rules')throw new SmokeProbeFailure('Quota service policy did not match explicit fixture policy');
    stage='native-task-start';
    const operationId=randomUUID();
    type Run={taskId:string;threadId:string|null;status:string};
    let run=await options.runtimeRequest<Run>('inquello/tasks/start',{operationId,workspaceId:seed.workspace_id,engagementId:null,folderId:null,request:'Fictional quota validation only. No customer data.',routeId:'claude-api-key',configurationRevision:1,reasoning:'default',speed:'default',workspacePolicy:initialPolicy});
    const deadline=Date.now()+30_000;
    while(!['failed','setup-failed','completed','cancelled','uncertain'].includes(run.status)&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,50));run=await options.runtimeRequest<Run>('inquello/tasks/reconcile',{operationId});}
    if(run.status!=='failed'||!run.threadId)throw new SmokeProbeFailure('Quota native pre-sampling failure was not established');
    const created={value:{taskId:run.taskId}};
    const selected={value:await options.runtimeRequest<{revision:number}>('inquello/routes/task/read',{taskId:run.taskId})};
    // No provider is needed after this pre-sampling failure. Retire our fixture
    // credential BEFORE mounting ordinary route readers; otherwise they correctly
    // invalidate the mismatched main/native credential and stale concurrent reads.
    await options.runtimeRequest('inquello/routes/invalidate',{routeId:'claude-api-key',generation:Date.now(),taskId:null});
    stage='mounted-native-task';
    const mounted=await contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      const result={shell:false,sidebar:false,task:false,controls:false};
      location.hash='#specimen';await wait(specimenReady,5000);result.shell=await openShell();if(!result.shell)return result;
      const row=await wait(()=>qVisible('[data-task-id=${JSON.stringify(run.taskId)}] a'),${SHELL_SETTLE_MS});result.sidebar=!!row;if(!row)return result;row.click();
      result.task=!!(await wait(()=>qVisible('[data-task-view=${JSON.stringify(run.taskId)}]'),${SHELL_SETTLE_MS}));if(!result.task)return result;
      result.controls=!!(await wait(()=>qVisible('[data-composer] [data-conversation-model] [data-conversation-reasoning]')&&qVisible('[data-composer] [data-conversation-model] [data-environment-chip]'),${POLICY_SETTLE_MS}));return result;
    })()`) as {shell:boolean;sidebar:boolean;task:boolean;controls:boolean};
    if(!mounted.controls)throw new SmokeProbeFailure('Classified quota Task controls did not mount; stages='+JSON.stringify(mounted));
    stage='bounded-local-invocations';
    for(const command of [['/bin/sh','-c','exit 0'],['/bin/sh','-c','exit 7'],['/bin/sh','-c','exit 0']]){
      const result=await options.policy.runTool(run.taskId,command,{timeoutMs:30_000});if(!result.ok)throw new SmokeProbeFailure('Quota local invocation unavailable');
    }
    options.usageChanged(false);
    // Attributable usage and limits live in Settings > Usage for the open conversation.
    const usagePanel=`qVisible('[data-settings-usage-task=${JSON.stringify(run.taskId)}] [data-task-usage]')`;
    const history=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}location.hash='#settings-usage';const found=!!(await wait(()=>{const node=${usagePanel};return node&&node.querySelectorAll('[data-usage-attempt]').length>=3&&node.textContent.includes('Local tool invocation — completed')&&node.textContent.includes('Local tool invocation — failed')?node:null;},${POLICY_SETTLE_MS}));location.hash='#shell';return found;})()`);
    if(!history)throw new SmokeProbeFailure('Quota prior local history did not mount');
    // Combined Story 1.24 gate: existing default-off debug fixture dispatcher,
    // production native reviewer/ledger, then the real mounted preload panel.
    // Default/release binaries reject the fixture method rather than bypass gates.
    stage = 'quota-fixture-setup';
    const latestCatalog=await options.routes.list();
    if(!latestCatalog.ok)throw new SmokeProbeFailure('Fixture route catalog unavailable');
    const codex=latestCatalog.value.find(row=>row.routeId==='codex-responses');
    if(!codex)throw new SmokeProbeFailure('Fixture Codex route unavailable');
    const codexRevision=codex.revision;
    if(codexRevision!==1||codex.configuration?.accountRef!==principal||codex.configuration.model!=='fixture-model-20261030'||codex.configuration.deployment!=='openai-api'||codex.configuration.apiVersion!=='responses-v1')throw new SmokeProbeFailure('Fixture route revision unavailable');
    const codexSelection=await options.routes.select({operationId:randomUUID(),expectedRevision:selected.value.revision,taskId:created.value.taskId,routeId:'codex-responses',configurationRevision:codexRevision});
    if(!codexSelection.ok)throw new SmokeProbeFailure('Fixture route selection unavailable');
    const workspacePolicy=await options.policy.reviewPolicy(created.value.taskId);
    if(!workspacePolicy)throw new SmokeProbeFailure('Fixture private policy unavailable');
    const fixture=(phase:'prepare'|'refuse'|'clear')=>options.runtimeRequest<{accepted?:boolean;providerCalls?:number;retainedAttempts?:number;refused?:boolean}>('inquello/fixture/messagesTurn',{scenario:'usage-limit',phase,taskId:created.value.taskId,workspacePolicy});
    try {
      stage = 'quota-fixture-prepare';
      const prepared=await fixture('prepare');
      if(prepared.accepted!==true||prepared.providerCalls!==0)throw new SmokeProbeFailure('Isolated native quota fixture unavailable');
      options.usageChanged(true);
      const defaultsSaved=await contents.executeJavaScript(`(async()=>{
        ${SHELL_HELPERS}
        // The usage surface first reflects the prepared fixture's inherited limits.
        location.hash='#settings-usage';
        const fixtureSeen=!!(await wait(()=>{const node=${usagePanel};return node?.textContent.includes('synthetic fixture')?node:null;},${POLICY_SETTLE_MS}));
        location.hash='#shell';if(!fixtureSeen)return false;
        // Then defaults are saved explicitly from the composer footer, beside the model.
        const trigger=await wait(()=>qVisible('[data-task-view=${JSON.stringify(run.taskId)}]')&&qVisible('[data-composer] [data-conversation-model] [data-conversation-reasoning]'),${POLICY_SETTLE_MS});
        if(!trigger)return false;trigger.click();
        const panel=await wait(()=>{const node=qVisible('dialog[open] [data-task-reasoning]');return node?.querySelector('select[aria-label="Reasoning"]:not(:disabled)')?node:null;},${POLICY_SETTLE_MS});
        if(!panel)return false;
        const save=[...panel.querySelectorAll('button')].find(button=>button.textContent==='Save Task settings');if(!save)return false;save.click();
        const saved=!!(await wait(()=>{const node=qVisible('dialog[open] [data-task-reasoning]');return node&&!node.textContent.includes('older route revision')&&!node.textContent.includes('Defaults are not saved yet')&&qVisible('[data-conversation-reasoning]')?.getAttribute('data-reasoning-state')==='saved'?node:null;},${POLICY_SETTLE_MS}));
        const close=[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Close Reasoning and speed');if(close)close.click();
        return saved&&!!(await wait(()=>!q('dialog[open] [data-task-reasoning]'),${SHELL_SETTLE_MS}));
      })()`) as boolean;
      if(!defaultsSaved)throw new SmokeProbeFailure('Mounted fixture defaults were not saved');
      const nativeHistory=await options.runtimeRequest<{usage:{attempts:Array<{snapshot:{attempt_id:string;operation_kind:string}}>}}>('inquello/usage/read',{taskId:run.taskId});
      const retainedIds=nativeHistory.usage.attempts.map(row=>row.snapshot.attempt_id);
      if(nativeHistory.usage.attempts.filter(row=>row.snapshot.operation_kind==='local-tool').length<3)throw new SmokeProbeFailure('Quota native local history incomplete');
      const allHistoryMounted=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}const retained=${JSON.stringify(retainedIds)};location.hash='#settings-usage';const found=!!(await wait(()=>{const panel=${usagePanel};if(!panel||!panel.getClientRects().length)return false;const ids=[...panel.querySelectorAll('[data-usage-attempt]')].map(node=>node.getAttribute('data-usage-attempt'));return ids.length===retained.length&&retained.every(id=>ids.includes(id));},${POLICY_SETTLE_MS}));location.hash='#shell';return found;})()`);
      if(!allHistoryMounted)throw new SmokeProbeFailure('Quota mounted history omitted retained native attempts');
      stage = 'quota-fixture-refuse';
      const refused=await fixture('refuse');
      if(refused.accepted!==true||refused.refused!==true||refused.providerCalls!==0||refused.retainedAttempts!==retainedIds.length)throw new SmokeProbeFailure('Native limit refusal did not prove zero provider calls and retained work');
      // Same main/preload notification function used after native tool/reviewer settlement.
      options.usageChanged(false);
      const mountedRefusal=await contents.executeJavaScript(`(async()=>{
        ${SHELL_HELPERS}
        const retained=${JSON.stringify(retainedIds)};const result={usage:false,inline:false};let refusedId=null;
        // Settings > Usage: the refused attempt joins the retained history with the limit explanation.
        location.hash='#settings-usage';
        result.usage=!!(await wait(()=>{const node=${usagePanel};if(!node)return null;const ids=[...node.querySelectorAll('[data-usage-attempt]')].map(row=>row.getAttribute('data-usage-attempt'));
          refusedId=ids.find(id=>!retained.includes(id))??null;
          return node.textContent.includes('Automated permission review — refused')&&node.textContent.includes('exhausted')&&node.textContent.includes('Codex plan/Workspace')&&node.textContent.includes('Use permitted human handling')&&ids.length===retained.length+1&&retained.every(id=>ids.includes(id))?node:null;},${POLICY_SETTLE_MS}));
        // The conversation: an inline notice at the point the limit stopped work, naming the refused attempt.
        location.hash='#shell';
        result.inline=!!refusedId&&!!(await wait(()=>{const node=qVisible('[data-task-view=${JSON.stringify(run.taskId)}] [data-usage-limit-notice][data-usage-attempt="'+refusedId+'"]');
          return node&&node.textContent.includes('Automated permission review — refused')&&node.textContent.includes('exhausted')&&node.textContent.includes('Codex plan/Workspace')&&node.textContent.includes('Use permitted human handling')&&node.textContent.includes(refusedId)?node:null;},${POLICY_SETTLE_MS}));
        return result;
      })()`) as {usage:boolean;inline:boolean};
      if(!mountedRefusal.usage)failures.push('Native quota refusal did not reach mounted usage with retained prior work');
      if(!mountedRefusal.inline)failures.push('Native quota refusal did not show an inline limit notice in the conversation');
    } finally {try{await fixture('clear');}catch{failures.push('Quota fixture cleanup failed');}options.usageChanged(true);}
  }catch(error){failures.push((error instanceof SmokeProbeFailure?error.message:`Quota smoke could not finish at ${stage}`)+quotaFixtureDiagnostic(error));failureCapture=await captureSmokeFailure(contents,options.fixtureFile);if(!failureCapture)failures.push('Diagnostic failure capture unavailable');}
  finally {try{if(!(await smokeIdentity(contents,'signOut')).ok)failures.push('Quota sign-out failed');await options.organise.syncPrincipal();}catch{failures.push('Quota identity cleanup failed');}}
  return{ok:failures.length===0,failures,...(failureCapture?{failureCapture}: {})};
}

/** Story 1.25 Start-surface probe only; never sends a request or claims provider acceptance. */
export async function probeStartSurface(contents:WebContents,options:Omit<OrganiseProbeOptions,'runtimeRequest'>):Promise<{ok:boolean;skipped:boolean;failures:string[]}> {
 if(options.identity.config.kind!=='configured')return{ok:true,skipped:true,failures:[]};
 const failures:string[]=[];
 try {
  const seed=JSON.parse(fs.readFileSync(options.seedFile??'','utf8')) as {workspace_id?:string};
  if(!seed.workspace_id)throw new Error('Seeded Workspace unavailable');
  if(!(await smokeIdentity(contents, 'signIn')).ok)throw new Error('Seeded identity unavailable');
  await options.organise.syncPrincipal();await options.organise.getWorkspaces();
  const before=await options.organise.getTree(seed.workspace_id);if(!before.ok)throw new Error('Private tree unavailable');
  const read=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
   const opened=await openShell();const ready=await wait(()=>q('[data-sidebar][data-sidebar-state="ready"]'),${SHELL_SETTLE_MS});
   const button=qVisible('[data-action="new-thread"]');if(!opened||!ready||!button)return{opened:false};button.click();
   const start=await wait(()=>qVisible('[data-start-view]'),${SHELL_SETTLE_MS});const field=start?.querySelector('textarea');const send=start?.querySelector('[aria-label="Send"]');
   return{opened:!!start,prompt:start?.textContent.includes('What should we work on?'),focused:document.activeElement===field,empty:field?.value==='',disabled:send?.getAttribute('aria-disabled')==='true',modelChoice:!!start?.querySelector('[data-conversation-model] button[aria-label="Choose model"]'),noUnsupportedControls:!start?.querySelector('[aria-label="Attach files"],[aria-label="Voice"]')};
  })()`) as Record<string,boolean>;
  // The conversation model is chosen in the Composer; response options appear only when a model offers non-default choices.
  for(const key of ['opened','prompt','focused','empty','disabled','modelChoice','noUnsupportedControls'])if(read[key]!==true)failures.push(`Start surface ${key} not established`);
  const after=await options.organise.getTree(seed.workspace_id);if(!after.ok||after.value.tasks.length!==before.value.tasks.length)failures.push('New chat changed persisted Tasks before Send');
 }catch{failures.push('Seeded Start surface could not be verified');}
 finally{await smokeIdentity(contents, 'signOut').catch(()=>undefined);await options.organise.syncPrincipal().catch(()=>undefined);}
 return{ok:failures.length===0,skipped:false,failures};
}


/** Actual Electron pixels from a native, pinned local synthetic conversation.
 * The text is fixture-authored, not a live model result or product acceptance. */
export async function probeVisualConversation(contents: WebContents, options: OrganiseProbeOptions & {
  policy: PolicyService; isolatedRoot:string; fixtureFile:string; armSyntheticSession(workspaceId:string):Promise<void>;
  resize(width:number,height:number):void; restore:{width:number;height:number};
}):Promise<{ok:boolean;failures:string[];synthetic:true;settingsSurface:'implemented-settings';captures:{name:string;path:string;width:number;height:number}[]}> {
  const failures:string[]=[],captures:{name:string;path:string;width:number;height:number}[]=[];
  let stage='visual-fixture';
  try {
    const seed=JSON.parse(fs.readFileSync(options.seedFile??'','utf8')) as {workspace_id:string;invite_id:string};
    const fixture=JSON.parse(fs.readFileSync(options.fixtureFile,'utf8')) as {endpoint:string;certificate:number[];answer:string;answers:string[];requests:string[];bRequest:string;bAnswer:string;stateFile:string;captureDir:string};
    const endpoint=new URL(fixture.endpoint),captureDir=path.join(path.dirname(options.fixtureFile),'captures');
    if(endpoint.protocol!=='https:'||endpoint.hostname!=='127.0.0.1'||endpoint.pathname!=='/v1/responses'||
       !Array.isArray(fixture.certificate)||fixture.certificate.length>8192||fixture.certificate.some(n=>!Number.isInteger(n)||n<0||n>255)||
       !fixture.answer.startsWith('Synthetic visual QA response - generated by the local test fixture, not a live model.')||fixture.answer.length>4096||
       path.resolve(fixture.captureDir)!==path.resolve(captureDir)||
       !Array.isArray(fixture.answers)||fixture.answers.length!==4||fixture.answers.some(value=>typeof value!=='string'||!value.startsWith('Synthetic visual QA response - generated by the local test fixture, not a live model.')||value.length>4096)||
       !Array.isArray(fixture.requests)||fixture.requests.length!==3||fixture.requests.some(value=>typeof value!=='string'||!value.startsWith('Synthetic UI ')||value.length>4096)||
       path.resolve(fixture.stateFile)!==path.resolve(path.join(path.dirname(options.fixtureFile),'synthetic-journey-state.json')))throw new SmokeProbeFailure('Local visual fixture invalid');
    fs.mkdirSync(captureDir,{recursive:false});
    const boundedCaptureStep = <T,>(pending: Promise<T>, reason: string): Promise<T> => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new SmokeProbeFailure(reason)), 8_000);
      pending.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); reject(new SmokeProbeFailure(reason + ' (operation rejected, not deadline)')); });
    });
    const capture=async(name:string)=>{
      // Wait for actual layout/font completion, never a fixed screenshot delay.
      await boundedCaptureStep(contents.executeJavaScript(`(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()`), 'Visual layout readiness unavailable');
      const image=await boundedCaptureStep(contents.capturePage(), 'Actual Electron capture timed out'),size=image.getSize();
      if(image.isEmpty()||size.width<640||size.height<480)throw new SmokeProbeFailure('Actual Electron capture unavailable');
      const file=path.join(captureDir,`${name}.png`);fs.writeFileSync(file,image.toPNG());
      captures.push({name,path:file,width:size.width,height:size.height});
    };
    const usableComposer=async(stage:string,inline=false)=>{
      const geometry=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
        const read=()=>{const fields=[...document.querySelectorAll('[data-composer-input]')].filter(element=>visible(element)&&element.getClientRects().length);const field=fields[0],composer=field?.closest('[data-composer]'),actions=composer?.querySelector('.iq-composer-actions');if(!field||!composer||!actions)return null;const input=field.getBoundingClientRect(),surface=composer.getBoundingClientRect(),buttons=actions.getBoundingClientRect();return {viewportWidth:innerWidth,viewportHeight:innerHeight,inputWidth:input.width,inputHeight:input.height,composerWidth:surface.width,composerHeight:surface.height,oneComposer:fields.length===1,noPageOverflow:document.documentElement.scrollWidth<=document.documentElement.clientWidth,inside:input.left>=surface.left&&input.right<=surface.right&&input.top>=surface.top&&input.bottom<=surface.bottom,inline:buttons.top>=input.bottom-1&&buttons.right<=surface.right&&buttons.bottom<=surface.bottom};};
        const usable=value=>value&&value.oneComposer&&value.noPageOverflow&&value.inside&&value.inputWidth>=240&&value.inputHeight>=20&&value.inputHeight<=112&&(!${inline}||value.inline);
        const value=await wait(()=>{const value=read();return usable(value)?value:null;},5000)??read();return {stage:${JSON.stringify(stage)},...value,usable:!!usable(value)};
      })()`);
      console.info(JSON.stringify({event:'visual-composer-geometry',...geometry}));
      if(!geometry.usable)throw new SmokeProbeFailure('Composer input geometry unusable at '+stage);
    };
    await contents.executeJavaScript(`void Object.defineProperty(globalThis,'__iqSyntheticStartTrace',{value:[],configurable:true});`);
    stage='visual-identity';
    if(!(await smokeIdentity(contents,'signIn')).ok)throw new SmokeProbeFailure('Visual identity unavailable');
    const accepted=await options.identity.session.withAccess(access=>options.identity.service!.acceptInvite(access,seed.invite_id));
    if(accepted?.workspace_id!==seed.workspace_id)throw new SmokeProbeFailure('Visual Workspace unavailable');
    await options.organise.syncPrincipal();await options.organise.getWorkspaces();
    options.resize(1920,1200);
    const home=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return await openShell()&&!q('[data-task-view]');})()`);
    if(!home)throw new SmokeProbeFailure('Fresh home did not mount');
    const homeShape=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return !!(await wait(()=>{const fields=[...document.querySelectorAll('[data-composer-input]')].filter(element=>visible(element)&&element.getClientRects().length);return Math.abs(q('nav[data-sidebar]').getBoundingClientRect().width-320)<0.5&&fields.length===1&&q('[data-rail-workspace="'+${JSON.stringify(seed.workspace_id)}+'"]')&&q('[data-shell]')?.getAttribute('data-nav-presentation')==='sidebar';},${SHELL_SETTLE_MS}));})()`);
    if(!homeShape)throw new SmokeProbeFailure('Expanded home did not show exactly one real composer');
    await usableComposer('expanded-home',true);
    await capture('01-home-synthetic');
    const collapsedHome=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}if(!press('[data-action="collapse-nav"]'))return false;return !!(await wait(()=>q('[data-shell]')?.getAttribute('data-nav-presentation')==='rail'&&Math.abs(q('nav[data-sidebar]').getBoundingClientRect().width-64)<0.5,5000));})()`);
    if(!collapsedHome)throw new SmokeProbeFailure('Home navigation did not collapse');
    await capture('01b-home-collapsed-synthetic');
    const footerOpen=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}if(!press('button[aria-label="Organization and team"]'))return false;return !!(await wait(()=>{const menu=qVisible('[role="menu"]');if(!menu)return false;const rect=menu.getBoundingClientRect();return rect.width>0&&rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight;},5000));})()`);
    if(!footerOpen)throw new SmokeProbeFailure('Account workspace menu unavailable');
    await capture('01c-account-workspace-synthetic');
    const expandedHome=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}press('button[aria-label="Organization and team"]');if(!press('[data-action="expand-nav"]'))return false;return !!(await wait(()=>q('[data-shell]')?.getAttribute('data-nav-presentation')==='sidebar',5000));})()`);
    if(!expandedHome)throw new SmokeProbeFailure('Home navigation did not expand');
    const draftExpanded=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}const field=qVisible('[data-composer-input]');if(!field)return false;type(field,'Fictional unsent planning draft\\nSecond planning line\\nThird planning line');return !!(await wait(()=>field.getBoundingClientRect().height>48,5000));})()`);
    if(!draftExpanded)throw new SmokeProbeFailure('Multiline unsent draft did not expand');
    await capture('01d-multiline-unsent-synthetic');
    options.resize(SHELL_LAYOUT.windowMinWidth,900);
    const minimumHome=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return !!(await wait(()=>{const fields=[...document.querySelectorAll('[data-composer-input]')].filter(element=>visible(element)&&element.getClientRects().length);return innerWidth===${SHELL_LAYOUT.windowMinWidth}&&q('[data-shell]')?.getAttribute('data-nav-presentation')==='rail'&&document.documentElement.scrollWidth<=document.documentElement.clientWidth&&fields.length===1&&fields[0].value==='Fictional unsent planning draft\\nSecond planning line\\nThird planning line';},5000));})()`);
    if(!minimumHome)throw new SmokeProbeFailure('Minimum-width home overflowed or lost its draft');
    await usableComposer('minimum-home');
    options.resize(1920,1200);
    if(!await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return !!(await wait(()=>innerWidth===1920&&q('[data-shell]')?.getAttribute('data-nav-presentation')==='sidebar',5000));})()`))throw new SmokeProbeFailure('Expanded home was not restored');
    await contents.executeJavaScript(`(()=>{${SHELL_HELPERS}const field=qVisible('[data-composer-input]');if(!field)throw new Error('Draft unavailable');type(field,'');})()`);
    if(!(await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}location.hash='#settings-routes';return !!(await wait(()=>location.hash==='#settings-routes'&&!visible(q('[data-shell]'))&&qVisible('[data-processing-routes]'),${SHELL_SETTLE_MS}));})()`)))throw new SmokeProbeFailure('Visual setup surface unavailable');
    stage='visual-native-start';
    fs.writeFileSync(path.join(options.isolatedRoot,'.inquello-fictional-audit-session'),'explicit isolated visual fixture');
    await options.armSyntheticSession(seed.workspace_id);
    const principal=options.identity.session.principalId();
    await options.runtimeRequest('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:0,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'gpt-6.1-terra',apiVersion:'responses-v1',accountRef:principal,region:null}});
    const bound=await options.runtimeRequest<{accepted:boolean;providerCalls:number}>('inquello/fixture/taskTransport',{workspaceId:seed.workspace_id,configurationRevision:1,routeId:'codex-responses',endpoint:fixture.endpoint,certificate:fixture.certificate,failBeforeSampling:false});
    if(!bound.accepted||bound.providerCalls!==0)throw new SmokeProbeFailure('Visual pinned transport refused');
    stage='visual-native-proof';
    const proof=await options.runtimeRequest<{accepted:boolean}>('inquello/fixture/taskTransportStatus',{workspaceId:seed.workspace_id,configurationRevision:1,routeId:'codex-responses'});
    if(proof.accepted!==true)throw new SmokeProbeFailure('Visual native transport proof refused');
    // Direct fixture configuration bypasses RouteService.configure's normal notification.
    // Notify only this owned visual renderer after the exact pinned transport is proved.
    contents.send('inquello:routes-changed',{authority:false});
    // Composition boundary: creation and exact saved-binding selection use the
    // existing public main bridge against prequalified synthetic revisions.
    // The picker resolves fresh revisions, which this pinned fixture cannot
    // prequalify. Actual picker input is covered separately by source-Electron.
    // Follow-up Send, Stop, reopen and Resume below use actual renderer controls.
    const checkFixture=async(expected:number,stopped=false)=>{
      const deadline=Date.now()+5000;
      do{
        let state:{calls:number;invalidCalls:number;heldCancelled:boolean;heldTimedOut:boolean;contextMatches:boolean[]}|null=null;
        try{state=JSON.parse(fs.readFileSync(fixture.stateFile,'utf8'));}catch{/* The owned writer may be publishing a new observation. */}
        if(state){
          if(state.calls>expected||state.invalidCalls!==0||state.heldTimedOut||state.contextMatches.some(value=>value!==true))throw new SmokeProbeFailure('Synthetic UI dispatch/context assertion failed');
          if(state.calls===expected&&state.contextMatches.length===expected&&(!stopped||state.heldCancelled))return;
        }
        await new Promise(resolve=>setTimeout(resolve,50));
      }while(Date.now()<deadline);
      throw new SmokeProbeFailure('Synthetic UI dispatch/context observation timed out');
    };
    const taskSnapshot=async(taskId:string,expectedStatus:'completed'|'cancelled')=>{
      // An item can complete before the retained turn transaction settles. Observe
      // the actual lifecycle condition rather than treating item completion as it.
      const deadline=Date.now()+POLICY_SETTLE_MS;
      do {
        const result=await boundedCaptureStep(contents.executeJavaScript(`(async()=>{const response=await globalThis.inquello.tasks.activity({taskId:${JSON.stringify(taskId)},workspaceId:${JSON.stringify(seed.workspace_id)}});if(!response?.ok)return {refused:true,superseded:response?.code==='refused'&&['A newer Task run is being observed.','The result snapshot changed. Read the current authorized result pages.'].includes(response?.reason),code:['refused','unavailable','invalid','uncertain','not_found','permission_required'].includes(response?.code)?response.code:'other'};const value=response.value;return {taskId:value.taskId,threadId:value.threadId,runId:value.runId,status:value.status};})()`),'Synthetic current Task read timed out') as {taskId:string;threadId:string|null;runId:string;status:string;refused?:boolean;superseded?:boolean;code?:string};
        if(result.superseded){await new Promise(resolve=>setTimeout(resolve,50));continue;}
        if(result.refused)throw new SmokeProbeFailure('Synthetic current Task read refused: '+result.code);
        if(result.taskId!==taskId||!result.threadId||!result.runId)throw new SmokeProbeFailure('Synthetic native Task binding unavailable');
        if(result.status===expectedStatus)return result;
        if(['failed','setup-failed','uncertain','cancelled','completed'].includes(result.status))throw new SmokeProbeFailure('Synthetic Task reached an unexpected terminal state');
        await new Promise(resolve=>setTimeout(resolve,50));
      }while(Date.now()<deadline);
      throw new SmokeProbeFailure('Synthetic native lifecycle did not settle');
    };
    const waitAnswer=async(taskId:string,answer:string,completed=true)=>contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      return !!(await wait(()=>{const task=qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]');return task&&[...task.querySelectorAll('.iq-conversation-item--agent'+${JSON.stringify(completed?'[data-status="completed"]':'')}+' .iq-message-body .iq-progress-text')].some(node=>node.textContent===${JSON.stringify(answer)}&&node.getClientRects().length);},${POLICY_SETTLE_MS}));
    })()`);
    const latestAnswerVisible=async(taskId:string,answer:string,role:'agent'|'user'='agent')=>contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      return !!(await wait(()=>{const task=qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]');const thread=task?.closest('.iq-thread');if(!task||!thread)return false;const clip=thread.getBoundingClientRect();return [...task.querySelectorAll('.iq-conversation-item--'+${JSON.stringify(role)}+' .iq-message-body .iq-progress-text')].some(node=>{if(node.textContent!==${JSON.stringify(answer)})return false;const rect=node.getBoundingClientRect();return rect.height>0&&rect.bottom>clip.top&&rect.bottom<=clip.bottom+2&&rect.top<clip.bottom;});},${SHELL_SETTLE_MS}));
    })()`);
    const startPinnedConversation=async(configurationRevision:number,request:string)=>contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      location.hash='#settings-routes';
      if(!await wait(()=>!visible(q('[data-shell]')),${SHELL_SETTLE_MS}))return null;
      const preflight=await globalThis.inquello.tasks.preflight({workspaceId:${JSON.stringify(seed.workspace_id)},routeId:'codex-responses',configurationRevision:${configurationRevision}});
      if(!preflight?.ok||!preflight.value.available||!preflight.value.reasoning.includes('default')||!preflight.value.speeds.includes('default'))return null;
      const began=performance.now();
      const result=await globalThis.inquello.tasks.start({operationId:${JSON.stringify(randomUUID())},workspaceId:${JSON.stringify(seed.workspace_id)},engagementId:null,folderId:null,request:${JSON.stringify(request)},routeId:'codex-responses',configurationRevision:${configurationRevision},reasoning:'default',speed:'default'});
      const elapsedMs=Math.round(performance.now()-began);
      console.info('SYNTHETIC_STARTUP_OBSERVATION',JSON.stringify({source:'public-main-bridge-start-not-ui-click',configurationRevision:${configurationRevision},elapsedMs,exceeded20s:elapsedMs>20000,accepted:result?.ok===true&&result.value?.accepted===true}));
      if(!result?.ok||!result.value.accepted||!result.value.taskId)return null;
      const id=result.value.taskId;
      if(!await openShell())return null;
      const row=await wait(()=>qVisible('[data-task-id="'+id+'"] a'),${SHELL_SETTLE_MS});if(!row)return null;row.click();
      if(!await wait(()=>qVisible('[data-task-view="'+id+'"]'),${SHELL_SETTLE_MS}))return null;
      return id;
    })()`) as Promise<string|null>;
    // Story 1.15 owner amendment (2026-11-04): a finished native turn ends with
    // the neutral "Finished · worked for …" line, measured from the turn's own
    // timestamps; an interrupted turn keeps its wording and shows no such line.
    const endOfTurn=async(id:string,finished:boolean,where:string)=>{
      const read=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
        const view=()=>qVisible('[data-task-view="'+${JSON.stringify(id)}+'"]');
        const line=await wait(()=>{const task=view();if(!task)return null;const node=q('[data-turn-finished]',task);return ${finished}?(node&&node.getAttribute('data-turn-duration')==='measured'&&node.getClientRects().length?node:null):(node?null:task);},${POLICY_SETTLE_MS});
        if(!line)return {found:false,text:view()?.querySelector('[data-turn-finished]')?.textContent??null};
        if(!${finished})return {found:true,absent:true};
        const style=getComputedStyle(line),items=view().querySelector('.iq-conversation-items');
        return {found:true,text:line.textContent,className:line.className,color:style.color,background:style.backgroundColor,border:style.borderTopColor,afterItems:!!items&&!!(items.compareDocumentPosition(line)&Node.DOCUMENT_POSITION_FOLLOWING),chip:!!line.closest('.iq-status-chip,[role="alert"]')||!!line.querySelector('.iq-status-chip')};
      })()`) as {found:boolean;absent?:boolean;text?:string|null;className?:string;color?:string;background?:string;border?:string;afterItems?:boolean;chip?:boolean};
      console.info(JSON.stringify({event:'visual-end-of-turn',where,finished,...read}));
      if(!finished){if(!read.found)throw new SmokeProbeFailure(`An interrupted turn showed an end-of-turn line at ${where}`);return;}
      if(!read.found)throw new SmokeProbeFailure(`The finished turn showed no measured end-of-turn line at ${where} (${JSON.stringify(read.text)})`);
      if(!/^Finished · worked for (\d+h \d+m|\d+m \d+s|\d+s|under 1s)$/.test(read.text??'')||/accept|approv|\bdone\b/i.test(read.text??''))throw new SmokeProbeFailure(`The end-of-turn line reads ${JSON.stringify(read.text)} at ${where}`);
      if(read.className!=='iq-turn-finished'||read.chip||isGreenish(read.color??'')||isGreenish(read.background??'')||isGreenish(read.border??''))throw new SmokeProbeFailure(`The end-of-turn line is not neutral at ${where}`);
      if(!read.afterItems)throw new SmokeProbeFailure(`The end-of-turn line is not at the end of the turn at ${where}`);
    };
    stage='visual-bridge-first-start';
    const taskId=await startPinnedConversation(1,fixture.requests[0]!);
    if(!taskId)throw new SmokeProbeFailure('Pinned synthetic bridge start did not open its saved conversation');
    if(!(await waitAnswer(taskId,fixture.answers[0]!)))throw new SmokeProbeFailure('First synthetic assistant answer did not render');
    const first=await taskSnapshot(taskId,'completed');if(first.status!=='completed')throw new SmokeProbeFailure('First synthetic native turn did not complete');
    await checkFixture(1);
    await endOfTurn(taskId,true,'first-turn');
    stage='visual-same-provider-model-b';
    // Both names are present in bundled supported metadata. Only this owned,
    // pinned Responses fixture qualifies them for fictional validation here.
    await options.runtimeRequest('inquello/routes/configure',{operationId:randomUUID(),expectedRevision:1,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'gpt-6.1-sol',apiVersion:'responses-v1',accountRef:principal,region:null}});
    const secondBinding=await options.runtimeRequest<{accepted:boolean;providerCalls:number}>('inquello/fixture/taskTransport',{workspaceId:seed.workspace_id,configurationRevision:2,routeId:'codex-responses',endpoint:fixture.endpoint,certificate:fixture.certificate,failBeforeSampling:false});
    if(!secondBinding.accepted||secondBinding.providerCalls!==0)throw new SmokeProbeFailure('Second exact Responses binding refused');
    const catalog=await options.runtimeRequest<{bindings:Array<{bindingId:string;name:string;configurationRevision:number}>}>('inquello/models/catalog',{});
    const modelB=catalog.bindings.find(binding=>binding.name==='gpt-6.1-sol'&&binding.configurationRevision===2);
    if(!modelB)throw new SmokeProbeFailure('Supported Sol binding absent from cached catalog');
    contents.send('inquello:routes-changed',{authority:false});
    const taskB=await startPinnedConversation(2,fixture.bRequest);
    if(!taskB||taskB===taskId||!await waitAnswer(taskB,fixture.bAnswer))throw new SmokeProbeFailure('Pinned synthetic bridge Sol conversation did not complete independently');
    const bSnapshot=await taskSnapshot(taskB,'completed');
    if(bSnapshot.threadId===first.threadId)throw new SmokeProbeFailure('Independent Sol conversation reused the Terra thread');
    const bState=JSON.parse(fs.readFileSync(fixture.stateFile,'utf8')) as {bCalls:number};
    if(bState.bCalls!==1)throw new SmokeProbeFailure('Independent Sol conversation dispatch count differed');
    const aChoice=await options.runtimeRequest<{revision:number;configurationRevision:number;staleConfiguration:boolean;selected:{configuration:{model:string}}}>('inquello/routes/task/read',{taskId});
    if(aChoice.revision!==1||aChoice.configurationRevision!==1||aChoice.staleConfiguration||aChoice.selected.configuration.model!=='gpt-6.1-terra')throw new SmokeProbeFailure('Creating Sol changed the Terra conversation binding');
    const reopenedA=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}const row=await wait(()=>qVisible('[data-task-id="'+${JSON.stringify(taskId)}+'"] a'),${SHELL_SETTLE_MS});if(!row)return false;row.click();return !!(await wait(()=>qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]'),${SHELL_SETTLE_MS}));})()`);
    if(!reopenedA||!await waitAnswer(taskId,fixture.answers[0]!))throw new SmokeProbeFailure('Reopened Terra conversation lost its answer after Sol was created');
    await checkFixture(1);await capture('02c-independent-sol-and-reopened-terra-synthetic');
    const cleanConversation=await contents.executeJavaScript(`(()=>{const task=document.querySelector('[data-task-view="'+${JSON.stringify(taskId)}+'"]');return !!task&&!task.querySelector('[data-task-inspector]')&&!['Initial request','Source and status','Execution details','Environment'].some(label=>task.textContent.includes(label));})()`);
    if(!cleanConversation)throw new SmokeProbeFailure('Ordinary conversation exposed obsolete technical chrome');
    await capture('02-completed-conversation-synthetic');
    options.resize(700,900);
    const narrow=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return !!(await wait(()=>innerWidth===700&&q('[data-shell]')?.getAttribute('data-nav-presentation')==='rail'&&document.documentElement.scrollWidth<=document.documentElement.clientWidth,5000));})()`);
    if(!narrow)throw new SmokeProbeFailure('Narrow conversation did not fit');
    await capture('02b-narrow-conversation-synthetic');
    options.resize(1920,1200);
    const sendFollowup=async(request:string)=>contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      const task=await wait(()=>{const controls=qVisible('[data-task-controls="'+${JSON.stringify(taskId)}+'"]');return controls?.getAttribute('data-task-controls-status')==='completed'?controls:null;},${POLICY_SETTLE_MS});if(!task)return false;
      const input=q('[data-composer-input]',task);if(!input)return false;
      type(input,${JSON.stringify(request)});
      const send=await wait(()=>{const button=q('[data-composer-send]',task);return button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true'?button:null;},${SHELL_SETTLE_MS});if(!send)return false;send.click();return true;
    })()`);
    stage='visual-ui-completed-followup';
    if(!(await sendFollowup(fixture.requests[1]!))||!(await waitAnswer(taskId,fixture.answers[1]!)))throw new SmokeProbeFailure('Completed conversation follow-up did not render');
    const second=await taskSnapshot(taskId,'completed');
    if(second.status!=='completed'||second.threadId!==first.threadId||second.runId===first.runId)throw new SmokeProbeFailure('Follow-up did not retain Task/thread with a new run');
    if(!(await latestAnswerVisible(taskId,fixture.answers[1]!)))throw new SmokeProbeFailure('Completed follow-up remained outside the conversation viewport');
    await checkFixture(2);await capture('03-followup-conversation-synthetic');
    stage='visual-bridge-exact-model-switch';
    const switched=await contents.executeJavaScript(`(async()=>{
      const result=await globalThis.inquello.routes.selectModel({operationId:${JSON.stringify(randomUUID())},taskId:${JSON.stringify(taskId)},expectedRevision:1,bindingId:${JSON.stringify(modelB.bindingId)}});
      if(!result?.ok||result.value.revision!==2||result.value.configurationRevision!==2)return false;
      const usage=await globalThis.inquello.usage.forTask({taskId:${JSON.stringify(taskId)}});
      return usage?.ok===true&&usage.value.usage.settings?.route_revision===2&&usage.value.usage.settings?.choices.reasoning==='default'&&usage.value.usage.settings?.choices.speed==='default';
    })()`);
    const switchedRoute=await options.runtimeRequest<{revision:number;configurationRevision:number}>('inquello/routes/task/read',{taskId});
    if(!switched||switchedRoute.revision!==2||switchedRoute.configurationRevision!==2)throw new SmokeProbeFailure('Exact main-bridge selection did not atomically align its saved settings');
    stage='visual-ui-stop';
    if(!(await sendFollowup(fixture.requests[2]!))||!(await waitAnswer(taskId,fixture.answers[2]!,false)))throw new SmokeProbeFailure('Held synthetic turn did not render before Stop');
    if(!(await latestAnswerVisible(taskId,fixture.answers[2]!)))throw new SmokeProbeFailure('Live streamed answer remained outside the conversation viewport');
    await capture('03b-live-streaming-conversation-synthetic');
    const stopped=await contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      const task=qVisible('[data-task-controls="'+${JSON.stringify(taskId)}+'"]');if(!task)return false;
      const stop=await wait(()=>{const button=q('[data-composer-stop]',task);return button&&!button.disabled&&button.getAttribute('aria-disabled')!=='true'?button:null;},${SHELL_SETTLE_MS});if(!stop)return false;stop.click();
      return !!(await wait(()=>{const controls=qVisible('[data-task-controls="'+${JSON.stringify(taskId)}+'"]');return controls&&[...controls.querySelectorAll('button')].find(button=>button.textContent.trim()==='Resume'&&button.getClientRects().length&&!button.disabled);},${POLICY_SETTLE_MS}));
    })()`);
    if(!stopped)throw new SmokeProbeFailure('Actual Stop did not expose explicit Resume');
    const interrupted=await taskSnapshot(taskId,'cancelled');
    if(interrupted.status!=='cancelled'||interrupted.threadId!==first.threadId||interrupted.runId===second.runId)throw new SmokeProbeFailure('Native interruption binding was not confirmed');
    await endOfTurn(taskId,false,'interrupted-turn');
    await checkFixture(3,true);await capture('04-interrupted-conversation-synthetic');
    // The short retained transcript fits the large desktop; establish real overflow before testing reader intent.
    options.resize(900,700);
    const readerViewport=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}if(!await wait(()=>innerWidth===900&&innerHeight===700,5000))return false;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true;})()`);
    if(!readerViewport)throw new SmokeProbeFailure('Reader viewport did not settle');
    await usableComposer('saved-task-900x700');
    await capture('04a-readable-composer-narrow-synthetic');
    const readerDistance=await contents.executeJavaScript(`(()=>{${SHELL_HELPERS}const task=qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]'),thread=task?.closest('.iq-thread'),conversation=task?.querySelector('.iq-task-progress');if(!thread||!conversation)return null;const target=Math.max(0,Math.min(thread.scrollHeight-thread.clientHeight,conversation.getBoundingClientRect().bottom-thread.getBoundingClientRect().top+thread.scrollTop-thread.clientHeight));return {viewportWidth:innerWidth,viewportHeight:innerHeight,threadHeight:thread.clientHeight,overflow:thread.scrollHeight-thread.clientHeight,conversationTarget:target,scrollTop:thread.scrollTop};})()`);
    console.info(JSON.stringify({event:'visual-reader-precondition',...readerDistance}));
    if(!readerDistance)throw new SmokeProbeFailure('Conversation scroll target unavailable');
    // A compact composer can make the conversation itself fit even while other
    // thread content overflows. Keep the 900x700 geometry witness above, then
    // establish genuine conversation distance in a smaller readable viewport.
    if(readerDistance.conversationTarget<=64){
      options.resize(900,600);
      const smaller=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}if(!await wait(()=>innerWidth===900&&innerHeight===600,5000))return false;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true;})()`);
      if(!smaller)throw new SmokeProbeFailure('Reader distance viewport did not settle');
      await usableComposer('reader-900x600');
    }
    const readerJump=await contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      const task=qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]'),thread=task?.closest('.iq-thread');if(!thread)return {ok:false,phase:'thread'};
      const read=()=>{const conversation=task.querySelector('.iq-task-progress');if(!conversation)return null;const overflow=thread.scrollHeight-thread.clientHeight,target=Math.max(0,Math.min(overflow,conversation.getBoundingClientRect().bottom-thread.getBoundingClientRect().top+thread.scrollTop-thread.clientHeight));return {viewportWidth:innerWidth,viewportHeight:innerHeight,threadHeight:thread.clientHeight,overflow,conversationTarget:target,initialTop:thread.scrollTop};};
      const before=await wait(()=>{const value=read();return value&&value.threadHeight>=160&&value.overflow>64&&value.conversationTarget>64&&Math.abs(value.initialTop-value.conversationTarget)<=2?value:null;},5000);
      if(!before)return {ok:false,phase:'conversation-distance',...read()};
      thread.scrollTop=0;thread.dispatchEvent(new Event('scroll'));
      const jump=await wait(()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Jump to latest'&&button.getClientRects().length&&!button.disabled),${SHELL_SETTLE_MS});
      if(!jump)return {ok:false,phase:'jump',...before,readerTop:thread.scrollTop};await new Promise(resolve=>setTimeout(resolve,200));if(thread.scrollTop>2)return {ok:false,phase:'reader-preservation',...before,readerTop:thread.scrollTop};jump.click();return {ok:true,phase:'jumped',...before,readerTop:0};
    })()`);
    console.info(JSON.stringify({event:'visual-reader-jump',...readerJump}));
    if(!readerJump.ok)throw new SmokeProbeFailure('Reader scroll-up preservation or explicit Jump control failed: '+readerJump.phase);
    // Stop may discard the uncommitted live assistant fragment. This is an explicit
    // UX limitation, not proof of durable partial-answer retention. Check the latest
    // retained user prompt; live partial visibility was separately required before Stop.
    if(!(await latestAnswerVisible(taskId,fixture.requests[2]!,'user')))throw new SmokeProbeFailure('Jump did not reveal the latest retained user prompt');
    await capture('04b-reader-jump-narrow-synthetic');
    options.resize(1920,1200);
    if(!await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}return !!(await wait(()=>innerWidth===1920&&innerHeight===1200,5000));})()`))throw new SmokeProbeFailure('Full conversation viewport was not restored');
    stage='visual-ui-reopen';
    const reopened=await contents.executeJavaScript(`(async()=>{
      ${SHELL_HELPERS}
      if(!press('[data-action="new-thread"]')||!await wait(()=>qVisible('[data-start-view]'),${SHELL_SETTLE_MS}))return false;
      const row=await wait(()=>qVisible('[data-task-id="'+${JSON.stringify(taskId)}+'"] a'),${SHELL_SETTLE_MS});if(!row)return false;row.click();
      const task=await wait(()=>qVisible('[data-task-view="'+${JSON.stringify(taskId)}+'"]'),${SHELL_SETTLE_MS});if(!task)return false;
      return !!(await wait(()=>{const controls=qVisible('[data-task-controls="'+${JSON.stringify(taskId)}+'"]');return controls&&[...controls.querySelectorAll('button')].find(button=>button.textContent.trim()==='Resume'&&button.getClientRects().length&&!button.disabled);},${POLICY_SETTLE_MS}));
    })()`);
    if(!reopened||!(await waitAnswer(taskId,fixture.answers[0]!))||!(await waitAnswer(taskId,fixture.answers[1]!)))throw new SmokeProbeFailure('Reopened interrupted Task did not retain conversation and Resume');
    await checkFixture(3,true);await capture('05-reopened-conversation-synthetic');
    await contents.executeJavaScript(`(()=>{const thread=document.querySelector('[data-task-view="'+${JSON.stringify(taskId)}+'"]')?.closest('.iq-thread');if(thread){thread.scrollTop=0;thread.dispatchEvent(new Event('scroll'));}})()`);
    stage='visual-ui-explicit-resume';
    const resumed=await contents.executeJavaScript(`(()=>{const task=document.querySelector('[data-task-controls="'+${JSON.stringify(taskId)}+'"]');const button=task&&[...task.querySelectorAll('button')].find(button=>button.textContent.trim()==='Resume'&&button.getClientRects().length&&!button.disabled&&button.getAttribute('aria-disabled')!=='true');if(!button)return false;button.click();return true;})()`);
    if(!resumed||!(await waitAnswer(taskId,fixture.answers[3]!)))throw new SmokeProbeFailure('Explicit Resume did not complete the retained synthetic Task');
    const last=await taskSnapshot(taskId,'completed');
    if(last.status!=='completed'||last.threadId!==first.threadId||last.runId===interrupted.runId)throw new SmokeProbeFailure('Resume did not retain Task/thread with a new run');
    await endOfTurn(taskId,true,'resumed-turn');
    if(!(await latestAnswerVisible(taskId,fixture.answers[3]!)))throw new SmokeProbeFailure('Resumed answer remained outside the conversation viewport');
    await checkFixture(4,true);await capture('06-resumed-conversation-synthetic');
    const details=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
      if(!press('button[aria-label="Conversation options"]'))return false;
      const item=await wait(()=>[...document.querySelectorAll('[role="menuitem"]')].find(e=>visible(e)&&e.textContent.trim()==='Rename or organise'),${SHELL_SETTLE_MS});
      if(!item)return false;item.click();
      return !!(await wait(()=>qVisible('dialog[open][aria-label="Conversation options"]'),${SHELL_SETTLE_MS}));
    })()`);
    if(!details)throw new SmokeProbeFailure('Task details unavailable for visual capture');
    await capture('07-task-details-synthetic');
    stage='visual-settings';
    const settings=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
      const dialog=qVisible('dialog[open][aria-label="Conversation options"]');
      const close=dialog&&[...dialog.querySelectorAll('button')].find(button=>button.textContent.trim()==='Close Conversation options');
      if(!close)return false;close.click();if(!await wait(()=>!qVisible('dialog[open]'),${SHELL_SETTLE_MS}))return false;
      location.hash='#settings-routes';return !!(await wait(()=>location.hash==='#settings-routes'&&!visible(q('[data-shell]'))&&qVisible('[data-processing-routes]'),${SHELL_SETTLE_MS}));})()`);
    if(!settings)throw new SmokeProbeFailure('Implemented Settings unavailable');
    await capture('08-settings-processing-routes');
    stage='visual-tools-settings';
    const toolsSettings=await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
      const link=qVisible('a[href="#settings-tools"]');if(!link)return false;link.click();
      return !!(await wait(()=>location.hash==='#settings-tools'&&qVisible('.iq-settings [data-capabilities-section][data-capabilities-loaded="true"]'),${POLICY_SETTLE_MS}));})()`);
    if(!toolsSettings)throw new SmokeProbeFailure('Ordinary tools Settings unavailable for visual capture');
    await capture('09-settings-tools-and-connections');
    fs.writeFileSync(path.join(captureDir,'manifest.json'),JSON.stringify({synthetic:true,source:'Actual Electron capturePage; pinned synthetic bridge creation/model selection plus renderer follow-up/Stop/Resume, not live inference',modelPicker:'Separate actual source-Electron input evidence; fresh picker resolution is not integrated in this pinned fixture',settingsSurface:'implemented-settings',captures},null,2));
  }catch(error){failures.push(error instanceof SmokeProbeFailure?error.message:`Visual conversation failed at ${stage}${quotaFixtureDiagnostic(error)}`);const diagnostic=await captureSmokeFailure(contents,options.fixtureFile);if(diagnostic)captures.push(diagnostic);else failures.push('Diagnostic failure capture unavailable');}
  finally {
    try{options.resize(options.restore.width,options.restore.height);}catch{failures.push('Owned visual window size could not be restored');}
    // Record BEFORE sign-out, so cleanup refusals cannot masquerade as the cause.
    try{
      const timeline=await contents.executeJavaScript(`(()=>{const rows=globalThis.__iqSyntheticStartTrace;delete globalThis.__iqSyntheticStartTrace;if(!Array.isArray(rows))return [];const events=['start-send','start-accepted','shell-accepted','tree-start','tree-result','shell-committed'];const keys=['foreground','workspaceAllowed','scopeCurrent','selected','taskPresent','receiptPresent','showStart','ok','hasTasks','selectedUnavailable'];return rows.slice(0,128).filter(row=>row&&events.includes(row.event)&&Number.isSafeInteger(row.ms)&&row.ms>=0).map(row=>({event:row.event,ms:row.ms,flags:Object.fromEntries(keys.filter(key=>typeof row.flags?.[key]==='boolean').map(key=>[key,row.flags[key]])),...(Number.isSafeInteger(row.read)&&row.read>=0?{read:row.read}:{})}));})()`);
      console.info(JSON.stringify({event:'visual-start-timeline',beforeCleanup:true,timeline}));
    }catch{console.info(JSON.stringify({event:'visual-start-timeline',beforeCleanup:true,unavailable:true}));}
    try{if(!(await smokeIdentity(contents,'signOut')).ok)failures.push('Visual identity cleanup failed');await options.organise.syncPrincipal();}catch{failures.push('Visual identity cleanup unavailable');}}
  return{ok:failures.length===0,failures,synthetic:true,settingsSurface:'implemented-settings',captures};
}


/** Separate permitted, fictional loopback setup journey. Never invokes a tool/model. */
export async function probeToolsManagement(contents: WebContents, options: OrganiseProbeOptions & {
  capabilities: CapabilityService; runtimeHome: string; restartRuntime: () => Promise<void>;
}): Promise<{ok:boolean;failures:string[];checks:string[];fixture:{initialize:number;toolsList:number;forbidden:number};captures:string[]}> {
  const {startToolsSmokeFixture} = await import('./tools-smoke-fixture');
  const report = {ok:false,failures:[] as string[],checks:[] as string[],fixture:{initialize:0,toolsList:0,forbidden:0},captures:[] as string[]};
  let fixture: Awaited<ReturnType<typeof startToolsSmokeFixture>> | null = null;
  let workspaceId: string | null = null, stage = 'fixture-start';
  const name = 'inquello_ui_' + randomUUID().replaceAll('-','');
  const requireCheck = (value: unknown, label: string) => {if (!value) throw new Error(label); report.checks.push(label);};
  const ui = async (body: string) => contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
    const row=()=>qVisible('[data-inventory-entry="${name}"]');
    const button=(label,root=document)=>[...root.querySelectorAll('button')].find(node=>visible(node)&&node.textContent.trim()===label&&node.getAttribute('aria-disabled')!=='true');
    const openTools=async()=>{
      if(!(await openShell()))return false;
      const trigger=await wait(()=>qVisible('button[aria-label="Organization and team"]'),${SHELL_SETTLE_MS});if(!trigger)return false;trigger.click();
      const settings=await wait(()=>[...document.querySelectorAll('[role="menuitem"]')].find(node=>visible(node)&&node.textContent.trim()==='Settings'),5000);if(!settings)return false;settings.click();
      const link=await wait(()=>qVisible('a[href="#settings-tools"]'),5000);if(!link)return false;link.focus();link.click();
      return !!(await wait(()=>qVisible('.iq-settings [data-capabilities-workspace="${workspaceId}"][data-capabilities-loaded="true"]'),${POLICY_SETTLE_MS}));
    };
    ${body}
  })()`);
  const state = async (enabled: boolean | null) => {
    const response = await options.runtimeRequest<{config:{mcp_servers?:Record<string,{url?:string;enabled?:boolean}>}}>('config/read',{includeLayers:false});
    const entry = response.config.mcp_servers?.[name];
    const disk = fs.readFileSync(path.join(options.runtimeHome,'config.toml'),'utf8');
    if (enabled === null) return !entry && !disk.includes(name) && !disk.includes(fixture!.url);
    return entry?.url === fixture!.url && entry.enabled === enabled && disk.includes(name) && disk.includes(fixture!.url);
  };
  const capture = async (label: string) => {
    await ui(label.includes('removed') ? "window.scrollTo(0,0);" : "row()?.scrollIntoView({block:'start'});");
    await contents.executeJavaScript('(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})()');
    const image = await contents.capturePage();
    if (image.isEmpty()) throw new Error('Empty capture');
    const folder = path.join(path.dirname(options.seedFile!), 'captures');fs.mkdirSync(folder,{recursive:true});
    const file = path.join(folder,label+'.png');fs.writeFileSync(file,image.toPNG());report.captures.push(file);
  };
  try {
    if (options.identity.config.kind !== 'configured' || !options.seedFile) throw new Error('Missing isolated topology');
    const seed = JSON.parse(fs.readFileSync(options.seedFile,'utf8')) as {workspace_id?:string;invite_id?:string};
    if (!seed.workspace_id || !seed.invite_id) throw new Error('Missing Workspace');
    workspaceId = seed.workspace_id;fixture = await startToolsSmokeFixture();
    stage='sign-in';requireCheck((await smokeIdentity(contents,'signIn')).ok,'identity-signed-in');
    const accepted=await options.identity.session.withAccess(access=>options.identity.service!.acceptInvite(access,seed.invite_id!));
    requireCheck(accepted?.workspace_id===workspaceId,'fictional-workspace-membership');
    await options.organise.syncPrincipal();await options.organise.getWorkspaces();
    requireCheck(await state(null),'initial-config-absent');
    stage='ordinary-settings-add';
    requireCheck(await ui(`
      if(!(await openTools()))return false;
      const form=qVisible('form[aria-label="Add MCP server"]');if(!form)return false;
      const field=label=>{const node=[...form.querySelectorAll('label')].find(node=>node.textContent.trim()===label);return node?document.getElementById(node.htmlFor):null;};
      const serverName=field('MCP server name'),url=field('MCP server URL');if(!serverName||!url)return false;
      type(serverName,${JSON.stringify(name)});type(url,${JSON.stringify(fixture.url)});
      const add=await wait(()=>button(${JSON.stringify('Add '+name+' MCP server')},form),5000);if(!add)return false;add.focus();add.click();
      return !!(await wait(()=>{const entry=row();return entry&&entry.textContent.includes('Installed; Enabled;')&&button(${JSON.stringify('Disable '+name)},entry);},${POLICY_SETTLE_MS}));
    `),'form-add-visible');
    requireCheck(await state(true),'add-native-and-durable');
    requireCheck(fixture.counts.initialize>0&&fixture.counts.toolsList>0&&fixture.counts.forbidden===0,'loopback-discovery-only');
    await capture('tools-01-added');
    stage='inventory-presentation';
    requireCheck(await ui(`const entry=row();return !!entry&&!!button(${JSON.stringify('Disable '+name)},entry)&&![...entry.querySelectorAll('button')].some(node=>node.textContent.trim()===${JSON.stringify('Enable '+name)});`),'single-applicable-enablement');
    requireCheck(await ui(`
      const entry=row(),details=entry?.querySelector('details'),summary=details?.querySelector('summary');
      if(!details||details.open||!summary||details.querySelector('dl')?.checkVisibility()||!entry.querySelector('.iq-tool-permission')?.checkVisibility())return false;
      summary.focus();return document.activeElement===summary;
    `),'reference-details-collapsed');
    await pressKey(contents,'Return');
    requireCheck(await ui(`return !!(await wait(()=>{const details=row()?.querySelector('details');return details?.open&&details.querySelector('dl')?.checkVisibility()&&document.activeElement===details.querySelector('summary');},5000));`),'reference-details-keyboard-open');
    await capture('tools-06-details-expanded');
    await pressKey(contents,'Return');
    requireCheck(await ui(`return !!(await wait(()=>{const details=row()?.querySelector('details');return details&&!details.open&&document.activeElement===details.querySelector('summary');},5000));`),'reference-details-keyboard-close');
    stage='disable';
    requireCheck(await ui(`const disable=button(${JSON.stringify('Disable '+name)},row());if(!disable)return false;disable.focus();disable.click();return !!(await wait(()=>document.activeElement===disable&&row()?.textContent.includes('Disabled by you')&&button(${JSON.stringify('Enable '+name)},row()),${POLICY_SETTLE_MS}));`),'disable-visible');
    requireCheck(await state(false),'disable-native-and-durable');
    stage='restart-and-reopen';
    await options.restartRuntime();
    requireCheck(await state(false),'disabled-survives-native-restart');
    requireCheck(await ui(`if(!(await openTools()))return false;return !!(await wait(()=>row()?.textContent.includes('Disabled by you')&&button(${JSON.stringify('Enable '+name)},row()),${POLICY_SETTLE_MS}));`),'disabled-reopened');
    await capture('tools-02-disabled-reopened');
    stage='enable';
    requireCheck(await ui(`const enable=button(${JSON.stringify('Enable '+name)},row());if(!enable)return false;enable.focus();enable.click();return !!(await wait(()=>document.activeElement===enable&&row()?.textContent.includes('Installed; Enabled;')&&button(${JSON.stringify('Disable '+name)},row()),${POLICY_SETTLE_MS}));`),'enable-visible');
    requireCheck(await state(true),'enable-native-and-durable');
    stage='remove';
    requireCheck(await ui(`const remove=button(${JSON.stringify('Remove '+name)},row());if(!remove)return false;remove.click();return !!(await wait(()=>!row(),${POLICY_SETTLE_MS}));`),'remove-visible');
    requireCheck(await state(null),'remove-native-and-durable');
    stage='removed-reopened';
    requireCheck(await ui(`if(!(await openTools()))return false;return !row()&&!!qVisible('form[aria-label="Add MCP server"]');`),'removed-reopened');
    requireCheck(await state(null),'removed-still-absent');
    await capture('tools-03-removed-reopened');
    stage='settings-usability';
    requireCheck(await ui(`
      const form=qVisible('form[aria-label="Add MCP server"]'),provider=qVisible('[data-provider-session]');
      return !!form&&!!provider&&(form.compareDocumentPosition(provider)&Node.DOCUMENT_POSITION_FOLLOWING)!==0&&[...document.querySelectorAll('.iq-settings h3')].every(node=>node.textContent!=='Tools and connections');
    `),'setup-before-inventory');
    requireCheck(await ui(`
      window.scrollTo(0,document.documentElement.scrollHeight);
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const nav=qVisible('.iq-settings > nav'),rect=nav?.getBoundingClientRect();
      return innerWidth<=700||!!rect&&rect.top>=-1&&rect.top<2&&rect.bottom<=innerHeight+1;
    `),'navigation-stays-reachable');
    requireCheck(await ui(`
      const link=qVisible('a[href="#settings-usage"]');if(!link)return false;link.focus();link.click();
      return !!(await wait(()=>{const h=qVisible('.iq-settings h2');return h?.textContent==='Usage'&&document.activeElement===h&&h.getBoundingClientRect().top>=0;},5000));
    `),'section-focus-from-scrolled-inventory');
    requireCheck(await ui(`
      history.back();if(!(await wait(()=>location.hash==='#settings-tools'&&qVisible('[data-capabilities-loaded="true"]'),5000)))return false;
      history.forward();if(!(await wait(()=>location.hash==='#settings-usage'&&document.activeElement===qVisible('.iq-settings h2'),5000)))return false;
      const link=qVisible('a[href="#settings-tools"]');link?.focus();link?.click();
      return !!(await wait(()=>qVisible('[data-capabilities-loaded="true"]')&&document.activeElement===qVisible('.iq-settings h2'),5000));
    `),'settings-history-and-repeat-navigation');
    const priorZoom=contents.getZoomFactor();
    try {
      contents.setZoomFactor(2);
      requireCheck(await ui(`
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return document.documentElement.scrollWidth<=document.documentElement.clientWidth&&!!qVisible('form[aria-label="Add MCP server"]');
      `),'settings-200-percent-no-horizontal-overflow');
      await capture('tools-04-removed-zoomed');
      await ui(`qVisible('form[aria-label="Add MCP server"]')?.scrollIntoView({block:'start'});`);
      await capture('tools-05-zoomed-form');
      requireCheck(await ui(`
        const details=qVisible('.iq-tool-details'),summary=details?.querySelector('summary');if(!summary)return false;
        summary.click();summary.scrollIntoView({block:'start'});
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return details.open&&document.documentElement.scrollWidth<=document.documentElement.clientWidth;
      `),'expanded-reference-details-200-percent');
      await capture('tools-07-zoomed-details');
    } finally {contents.setZoomFactor(priorZoom);}
    requireCheck(fixture.counts.forbidden===0,'no-tool-invocations-or-auth');
  } catch {report.failures.push('Tools management failed at '+stage);try {if(options.seedFile)await capture('tools-failure');}catch {report.failures.push('Failure capture unavailable');}}
  finally {
    if (workspaceId && fixture) {
      try {
        if (!(await state(null))) {
          const removed = await options.capabilities.manage({workspaceId,kind:'mcp_server',id:name,action:'remove'});
          if (!removed.ok || !(await state(null))) report.failures.push('Owned MCP configuration cleanup failed');
        }
      } catch {report.failures.push('Owned MCP configuration cleanup unavailable');}
    }
    try {if (!(await smokeIdentity(contents,'signOut')).ok) report.failures.push('Identity cleanup failed');await options.organise.syncPrincipal();} catch {report.failures.push('Identity cleanup unavailable');}
    if (fixture) {report.fixture={...fixture.counts};try {await fixture.close();} catch {report.failures.push('Loopback fixture cleanup failed');}}
  }
  report.ok=report.failures.length===0;return report;
}

// ---- attached material and verified references (Story 2.1) ----------------------------

export interface SourceReferencesProbeOptions extends Omit<OrganiseProbeOptions, 'runtimeRequest'> {
  policy: PolicyService;
  sources: SourcesService;
  /** `desktop/test/fixtures/engagement`: the synthetic engagement folder and its answer key. */
  fixtureRoot: string;
  /** Plays the person's part in the attach dialog; null restores "cancelled". */
  choose(selection: { files: string[]; folders: string[] } | null): void;
}
export interface SourceReferencesReport { ok: boolean; skipped: boolean; failures: string[]; facts: Record<string, unknown> }

function fixtureDigests(folder: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of fs.readdirSync(folder).sort()) out[name] = createHash('sha256').update(fs.readFileSync(path.join(folder, name))).digest('hex');
  return out;
}

/**
 * Story 2.1 seeded smoke: the start view's attach control with the synthetic
 * engagement folder (main plays the dialog), attach and view over the real
 * IPC operations, staging into an idle Task's real sandbox folder, checking a
 * fixture answer's references in the sandbox (the answer is authored from the
 * answer key, not produced by a model), retention, deletion and unchanged
 * originals. A Task without a runtime thread has no authorized progress read,
 * so the renderer's idle-Task path would refuse it; main stages directly.
 */
export async function probeSourceReferences(contents: WebContents, options: SourceReferencesProbeOptions): Promise<SourceReferencesReport> {
  const facts: Record<string, unknown> = {};
  if (options.identity.config.kind !== 'configured') return { ok: true, skipped: true, failures: [], facts };
  const failures: string[] = [];
  const check = (condition: boolean, what: string) => { if (!condition) failures.push(what); };
  const folder = path.join(options.fixtureRoot, 'folder');
  let stage = 'fixture';
  try {
    const before = fixtureDigests(folder);
    const key = JSON.parse(fs.readFileSync(path.join(options.fixtureRoot, 'answer-key.json'), 'utf8')) as { files: Record<string, { format: string; keys: Array<{ at: string; text: string }> }> };
    stage = 'seed';
    const seed = JSON.parse(fs.readFileSync(options.seedFile ?? '', 'utf8')) as { workspace_id?: string; invite_id?: string };
    if (!seed.workspace_id) throw new Error('Seeded Workspace unavailable');
    const workspaceId = seed.workspace_id;
    stage = 'sign-in';
    if (!(await smokeIdentity(contents, 'signIn')).ok) throw new Error('Seeded identity unavailable');
    // Run alone, this report joins the seeded Workspace itself; in the normal phase an earlier report already has.
    if (seed.invite_id) await options.identity.session.withAccess(access => options.identity.service!.acceptInvite(access, seed.invite_id!)).catch(() => null);
    await options.organise.syncPrincipal(); await options.organise.getWorkspaces();
    stage = 'task';
    const created = await options.organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Smoke source references' });
    if (!created.ok) throw new Error(created.reason);
    const taskId = created.value.taskId;
    const settings = await options.policy.effectiveThreadSettings(taskId);
    if (!settings.ok) throw new Error(settings.reason);

    // The start view: Attach folder through the real control and IPC; main shows the folder's summary, never a path.
    stage = 'start-view-attach';
    options.choose({ files: [], folders: [folder] });
    const start = await contents.executeJavaScript(`(async()=>{${SHELL_HELPERS}
      const opened=await openShell();const ready=await wait(()=>q('[data-sidebar][data-sidebar-state="ready"]'),${SHELL_SETTLE_MS});
      const fresh=qVisible('[data-action="new-thread"]');if(!opened||!ready||!fresh)return{opened:false};fresh.click();
      const view=await wait(()=>qVisible('[data-start-view]'),${SHELL_SETTLE_MS});const button=view&&await wait(()=>{const b=view.querySelector('button[data-attach="folder"]');return b&&b.getAttribute('aria-disabled')!=='true'?b:null;},${SHELL_SETTLE_MS});
      if(!button)return{opened:!!view,control:false};button.click();
      const summary=await wait(()=>view.querySelector('[data-attachment]'),60000);
      const counts=summary?.querySelector('[data-attachment-counts]')?.textContent??null;const label=summary?.querySelector('.iq-file-chip-name')?.textContent??null;const notice=view.querySelector('[data-attach-notice]')?.textContent??null;const pageText=document.body.innerText;
      summary?.querySelector('button[aria-label^="Remove"]')?.click();const removed=await wait(()=>!view.querySelector('[data-attachment]'),5000);
      return{opened:true,control:true,counts,label,notice,removed,pageText};
    })()`) as { opened: boolean; control?: boolean; counts?: string | null; label?: string | null; notice?: string | null; removed?: boolean; pageText?: string };
    facts.startView = { ...start, pageText: undefined };
    check(start.opened && start.control === true, 'The start view has no available Attach folder control');
    check(start.counts === '17 files to read · 1 not searched', `The start view summary was ${JSON.stringify(start.counts)}`);
    check(start.label === 'folder', `The start view named the attachment ${JSON.stringify(start.label)}`);
    check(!!start.notice && /placed in the Task folder before your request is sent/.test(start.notice), 'The start view does not say the material is placed in the Task folder before the request is sent');
    check(start.removed === true, 'Removing the attachment on the start view did not clear it');
    check(!(start.pageText ?? '').includes(options.fixtureRoot), 'The renderer showed an absolute path');

    // Attach over IPC (main plays the dialog with selected files of the same folder, to keep the sandbox work bounded).
    stage = 'attach-ipc';
    const chosen = ['payables-export.csv', 'meeting-notes.txt', 'ap-ledger.xlsx', 'purchasing-policy.docx', 'planning-deck.pptx', 'sample-report.pdf', 'scanned-receipt.pdf', 'confirmation-letter.png', 'protected-statement.pdf', 'system-dump.bin'];
    options.choose({ files: chosen.map(name => path.join(folder, name)), folders: [] });
    const attached = await contents.executeJavaScript('globalThis.inquello.sources.attach({kind:"files"})') as { ok: boolean; reason?: string; value?: { attachmentId: string; files: unknown[]; notSearched: Array<{ relative: string; reason: string }> } };
    if (!attached.ok || !attached.value) throw new Error(attached.reason ?? 'attach returned nothing');
    check(attached.value.files.length === 9, `${attached.value.files.length} files attached, expected 9`);
    check(JSON.stringify(attached.value.notSearched) === JSON.stringify([{ relative: 'system-dump.bin', reason: 'Unsupported file type' }]), 'The unsupported file was not listed as not searched');
    check(!JSON.stringify(attached.value).includes(options.fixtureRoot), 'The attach result named an absolute path');
    const pathRefused = await contents.executeJavaScript(`globalThis.inquello.sources.attach({kind:${JSON.stringify(folder)}}).then(()=>false,()=>true)`) as boolean;
    check(pathRefused, 'A path from the renderer was accepted');

    stage = 'stage';
    const started = Date.now();
    const staged = await options.sources.stage(taskId, attached.value.attachmentId);
    facts.stageMs = Date.now() - started;
    if (!staged.ok) throw new Error(staged.reason);
    const cover = staged.value.coverage;
    facts.coverage = cover.statement;
    check(cover.filesAttached === 10 && cover.incomplete, `Coverage was ${cover.statement}`);
    check(cover.unreadable.some(item => item.relative === 'protected-statement.pdf' && /password/i.test(item.reason)), 'The protected PDF was not listed as unreadable with its reason');

    stage = 'view-ipc';
    const view = await contents.executeJavaScript(`globalThis.inquello.sources.view(${JSON.stringify({ taskId, workspaceId })})`) as { ok: boolean; reason?: string; value?: { attachments: unknown[]; coverage: { statement: string } | null; available: boolean } };
    if (!view.ok || !view.value) throw new Error(view.reason ?? 'view returned nothing');
    check(view.value.available && view.value.attachments.length === 1 && view.value.coverage?.statement === cover.statement, 'The renderer view did not carry the attachment and its Coverage');
    check(!JSON.stringify(view.value).includes(options.fixtureRoot), 'The renderer view named an absolute path');

    // A fixture answer: one keyed location per staged format, one wrong quote, a computed figure and an inference.
    stage = 'verify';
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const good = chosen.filter(name => key.files[name]).map(name => ({ name, ...key.files[name]!.keys[0]! }));
    const answer = [
      ...good.map(item => `From ${item.name} :inquello-source{id="attached/${item.name}" at="${item.at}" quote="${escape(item.text)}"}`),
      'A wrong quote :inquello-source{id="attached/payables-export.csv" at="R3" quote="Fabrikam paid twice"}',
      'Total :inquello-computed{command="python3 -c \'print(1)\'" from="attached/payables-export.csv R2-R4"} probably monthly :inquello-inference{}',
    ].join('\n');
    const checked = await options.sources.references(taskId, answer);
    if (!checked.ok) throw new Error(checked.reason);
    const views = checked.value.references;
    facts.references = views.map(item => ({ file: item.id, at: item.at, status: item.status, reason: item.reason, ocr: item.extract?.ocr ?? null }));
    for (const [index, item] of good.entries()) check(views[index]?.status === 'verified', `${item.name} ${item.at} was not verified (${views[index]?.reason ?? 'missing'})`);
    check(views.at(-1)?.status === 'unverified' && views.at(-1)?.reason === 'The quoted text is not at that location', 'A wrong quote was not shown as unverified');
    check(views.some(item => item.id.endsWith('scanned-receipt.pdf') && item.extract?.ocr === true), 'The scanned PDF reference is not labelled as recognised text');
    check(checked.value.computed.length === 1 && checked.value.computed[0]!.command === "python3 -c 'print(1)'" && checked.value.inferences.length === 1, 'The computed command or the inference marker was lost');
    check(checked.value.retained === good.length, `${checked.value.retained} extracts retained, expected ${good.length}`);

    stage = 'retained';
    const extracts = options.sources.extracts(taskId);
    check(extracts.ok && extracts.value.length === good.length && extracts.value.every(item => item.reference.file.sha256.length === 64), 'The retained extracts do not match the verified references');

    stage = 'delete';
    const removed = options.sources.deleteTask(taskId);
    check(removed.ok && removed.value.remaining === 0, 'Deleting the Task’s extracts left files behind');
    const after = options.sources.extracts(taskId);
    check(after.ok && after.value.length === 0, 'Extracts remained after deletion');
    stage = 'originals';
    check(isDeepStrictEqual(fixtureDigests(folder), before), 'An original file changed');
  } catch (error) {
    failures.push(`${stage}: ${(error as Error).message.slice(0, 240)}`);
  } finally {
    options.choose(null);
    await smokeIdentity(contents, 'signOut').catch(() => undefined);
    await options.organise.syncPrincipal().catch(() => undefined);
  }
  return { ok: failures.length === 0, skipped: false, failures, facts };
}