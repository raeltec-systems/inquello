// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.17: the plain private Composer. One in-memory draft per Task (and
 * one with no Task open) that survives Task switches and layout changes and is
 * cleared on sign-out, a change of principal and Task deletion; Enter,
 * Shift+Enter and input-method rules; a visible, focusable, unavailable Send
 * with its reasons; and no simulated later inputs. Runs against an in-memory
 * fake of main: nothing is sent or saved.
 */
import fs from 'node:fs';
import path from 'node:path';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COMPOSER_EMPTY_REASON, COMPOSER_ROUTE_REASON, evaluateComposer, type ComposerProbeRead } from '../src/main/smoke-probe';
import { App } from '../src/renderer/App';
import { COMPOSER_LABEL, COMPOSER_LABEL_NO_TASK, isComposingEnter, SEND_EMPTY_REASON, SEND_ROUTE_REASON, sendReason } from '../src/renderer/Shell/Composer';
import { createDraftStore, NO_TASK_DRAFT, type DraftStore } from '../src/renderer/Shell/drafts';
import { WINDOW_MIN_WIDTH } from '../src/renderer/Shell/layout';
import type { TaskItem } from '../src/renderer/Shell/organise-bridge';
import { Shell } from '../src/renderer/Shell/Shell';

const renderer = path.resolve(__dirname, '..', 'src', 'renderer');
const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const task = (n: number, title: string): TaskItem => ({
  taskId: uuid(n),
  workspaceId: WORKSPACE,
  engagementId: null,
  folderId: null,
  title,
  runtimeThreadId: null,
  sourceRefs: [],
  artifactRefs: [],
  visibility: 'private',
  revision: 1,
});

const PRIYA = { displayName: 'Priya Raman', issuerLabel: 'Synthetic issuer' };
const OMAR = { displayName: 'Omar Haddad', issuerLabel: 'Synthetic issuer' };

function fakeMain() {
  const tasks: TaskItem[] = [task(1, 'Bank confirmations'), task(2, 'Cash count')];
  const session = { signedIn: true, person: PRIYA };
  let next = 10;
  const status = () => ({
    identity: session.signedIn ? { state: 'signed-in', ...session.person } : { state: 'signed-out' },
    sharedService: 'available',
    credentialStorage: 'os-backed',
    privateWork: 'local',
  });
  const organise = {
    getWorkspaces: vi.fn(async () => ({
      signedIn: session.signedIn,
      sharedService: 'available',
      workspaces: session.signedIn ? [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', source: 'service' }] : [],
      engagementCreation: { enabled: true },
    })),
    getTree: vi.fn(async () => ({ ok: true, value: { workspaceId: WORKSPACE, engagements: [], folders: [], tasks: [...tasks] } })),
    createTask: vi.fn(async (request: { title: string }) => {
      const created = task(++next, request.title);
      tasks.push(created);
      return { ok: true, value: created };
    }),
  };
  const identity = {
    getStatus: vi.fn(async () => status()),
    signIn: vi.fn(async () => {
      session.signedIn = true;
      return { ok: true, status: status() };
    }),
    signOut: vi.fn(async () => {
      session.signedIn = false;
      return { ok: true, status: status() };
    }),
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ organise: Object.freeze(organise), identity: Object.freeze(identity) });
  return { organise, identity, tasks, session };
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

const nav = () => screen.getByRole('navigation', { name: 'Workspace navigation' });
const input = () => document.querySelector<HTMLTextAreaElement>('[data-composer-input]')!;
const send = () => screen.getByRole('button', { name: 'Send' });
const describedText = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ');

async function waitReady() {
  await waitFor(() => expect(nav().dataset.sidebarState).toBe('ready'));
  await waitFor(() => expect(document.querySelector('[data-task-id], .iq-rail-badge')).not.toBeNull());
}

async function renderShell(drafts?: DraftStore) {
  const main = fakeMain();
  const view = render(<Shell onShowSpecimen={() => undefined} operationIds={() => uuid(900)} drafts={drafts} />);
  await waitReady();
  return { main, view };
}

async function openTask(title: string) {
  await userEvent.setup().click(within(nav()).getByRole('link', { name: title }));
  await waitFor(() => expect(document.querySelector('[data-header-title]')!.textContent).toBe(title));
}

/** Calls main received other than the reads every Shell makes. */
const writes = (main: ReturnType<typeof fakeMain>) => main.organise.createTask.mock.calls.length + main.identity.signIn.mock.calls.length + main.identity.signOut.mock.calls.length;

beforeEach(() => setWidth(1280));

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
  globalThis.location.hash = '';
});

describe('draft store (pure)', () => {
  it('keeps one draft per Task and one with no Task open', () => {
    const store = createDraftStore();
    store.set(uuid(1), WORKSPACE, 'A');
    store.set(NO_TASK_DRAFT, null, 'none');
    expect([store.get(uuid(1)), store.get(uuid(2)), store.get(NO_TASK_DRAFT)]).toEqual(['A', '', 'none']);
    expect(store.count()).toBe(2);
    store.set(uuid(1), WORKSPACE, '');
    expect(store.count()).toBe(1);
  });

  it('a different principal clears every draft; the same one keeps them', () => {
    const store = createDraftStore();
    store.claim('priya');
    store.set(uuid(1), WORKSPACE, 'A');
    store.claim('priya');
    store.claim(null);
    expect(store.get(uuid(1))).toBe('A');
    store.claim('omar');
    expect(store.count()).toBe(0);
  });

  it('retain drops only that Workspace’s missing Tasks; clear drops all', () => {
    const store = createDraftStore();
    store.set(uuid(1), WORKSPACE, 'A');
    store.set(uuid(2), WORKSPACE, 'B');
    store.set(uuid(3), 'other-workspace', 'C');
    store.set(NO_TASK_DRAFT, null, 'none');
    store.retain(WORKSPACE, [uuid(2)]);
    expect([store.get(uuid(1)), store.get(uuid(2)), store.get(uuid(3)), store.get(NO_TASK_DRAFT)]).toEqual(['', 'B', 'C', 'none']);
    store.clear();
    expect(store.count()).toBe(0);
  });

  it('notifies subscribers on change only', () => {
    const store = createDraftStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.set(uuid(1), WORKSPACE, 'A');
    store.set(uuid(1), WORKSPACE, 'A');
    store.clear();
    store.clear();
    off();
    store.set(uuid(1), WORKSPACE, 'B');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('Restart: a new window starts with no drafts, and nothing reaches storage, logs or main', () => {
    expect(createDraftStore().count()).toBe(0);
    const sources = ['drafts.ts', 'Composer.tsx'].map((file) => fs.readFileSync(path.join(renderer, 'Shell', file), 'utf8')).join('\n');
    expect(sources).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|console\.|inquello\b\.|Bridge\(/);
  });
});

describe('Composer', () => {
  it('is labelled, last in the Shell and styled by the DESIGN Composer tokens', async () => {
    await renderShell();
    expect(screen.getByLabelText(COMPOSER_LABEL_NO_TASK)).toBe(input());
    await openTask('Bank confirmations');
    expect(screen.getByLabelText(COMPOSER_LABEL)).toBe(input());
    expect(document.querySelector('[data-composer-slot]')!.getAttribute('data-composer-slot')).toBe('filled');
    const focusable = [...document.querySelectorAll<HTMLElement>('[data-shell] a[href], [data-shell] button, [data-shell] input, [data-shell] textarea')].filter(
      (element) => !element.closest('[hidden]'),
    );
    expect(focusable.slice(-2)).toEqual([input(), send()]);
    const css = fs.readFileSync(path.join(renderer, 'Shell', 'shell.css'), 'utf8');
    const block = css.slice(css.indexOf('.iq-composer {'), css.indexOf('}', css.indexOf('.iq-composer {')));
    for (const token of ['var(--white)', 'var(--radius-composer)', 'var(--shadow-composer)', 'var(--ink-600)']) expect(block).toContain(token);
    expect(css).toMatch(/\.iq-composer-input \{[^}]*font: var\(--type-body\)/);
    expect(send().className).toContain('iq-icon-button--round');
  });

  it('Preserve: each Task keeps its own draft', async () => {
    const user = userEvent.setup();
    await renderShell();
    await openTask('Bank confirmations');
    await user.type(input(), 'Confirm the balances');
    await openTask('Cash count');
    expect(input().value).toBe('');
    await user.type(input(), 'Count the float');
    await openTask('Bank confirmations');
    expect(input().value).toBe('Confirm the balances');
    await openTask('Cash count');
    expect(input().value).toBe('Count the float');
  });

  it('keeps a separate draft while no Task is open', async () => {
    const user = userEvent.setup();
    await renderShell();
    await user.type(input(), 'Before a Task');
    await openTask('Bank confirmations');
    expect(input().value).toBe('');
  });

  it('Layout change: text and caret focus survive every mode', async () => {
    const user = userEvent.setup();
    await renderShell();
    await openTask('Bank confirmations');
    await user.type(input(), 'Keep me');
    const field = input();
    for (const width of [1600, 700, WINDOW_MIN_WIDTH, 1280]) {
      setWidth(width);
      expect(input()).toBe(field);
      expect(input().value).toBe('Keep me');
      expect(document.activeElement).toBe(field);
    }
  });

  it('Shift+Enter inserts a newline', async () => {
    const user = userEvent.setup();
    await renderShell();
    await user.type(input(), 'first{Shift>}{Enter}{/Shift}second');
    expect(input().value).toBe('first\nsecond');
  });

  it('Enter sends nothing, keeps the text and the reason', async () => {
    const user = userEvent.setup();
    const { main } = await renderShell();
    await openTask('Bank confirmations');
    await user.type(input(), 'Hold this');
    const before = writes(main);
    await user.keyboard('{Enter}');
    expect(input().value).toBe('Hold this');
    expect(describedText(send())).toBe(SEND_ROUTE_REASON);
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(writes(main)).toBe(before);
  });

  it('IME: Enter while composing is left to the input method', async () => {
    await renderShell();
    fireEvent.change(input(), { target: { value: 'にほん' } });
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true });
    input().dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false);
    const legacy = new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true });
    input().dispatchEvent(legacy);
    expect(legacy.defaultPrevented).toBe(false);
    expect(input().value).toBe('にほん');
    expect(isComposingEnter({ key: 'Enter', keyCode: 229 })).toBe(true);
    expect(isComposingEnter({ key: 'Enter', keyCode: 13, nativeEvent: { isComposing: false } })).toBe(false);
  });

  it('Empty: Send is unavailable and says to type a request first', async () => {
    const user = userEvent.setup();
    await renderShell();
    expect(send().getAttribute('aria-disabled')).toBe('true');
    expect(describedText(send())).toBe(`${SEND_EMPTY_REASON} ${SEND_ROUTE_REASON}`);
    expect(screen.getByText(`${SEND_EMPTY_REASON} ${SEND_ROUTE_REASON}`)).toBeTruthy();
    await user.type(input(), '   ');
    expect(describedText(send())).toBe(sendReason('   '));
    expect(sendReason('   ')).toBe(`${SEND_EMPTY_REASON} ${SEND_ROUTE_REASON}`);
    await user.type(input(), 'x');
    expect(describedText(send())).toBe(SEND_ROUTE_REASON);
    expect(send().getAttribute('aria-disabled')).toBe('true');
  });

  it('Send focus: Tab reaches Send; activating it does nothing', async () => {
    const user = userEvent.setup();
    const { main } = await renderShell();
    await openTask('Bank confirmations');
    await user.type(input(), 'Hold this');
    await user.tab();
    expect(document.activeElement).toBe(send());
    expect(send().hasAttribute('disabled')).toBe(false);
    const before = writes(main);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    await user.click(send());
    expect(input().value).toBe('Hold this');
    expect(writes(main)).toBe(before);
  });

  it('Escape in the Composer keeps the draft; Ctrl/Cmd+N there is not intercepted', async () => {
    const user = userEvent.setup();
    const { main } = await renderShell();
    await openTask('Bank confirmations');
    await user.type(input(), 'Still here');
    await user.keyboard('{Escape}');
    expect(input().value).toBe('Still here');
    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true });
    input().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(main.organise.createTask).not.toHaveBeenCalled();
  });

  it('Later inputs: no attach, Method, scope, environment or reasoning control, and no file chip', async () => {
    await renderShell();
    const composer = document.querySelector<HTMLElement>('[data-composer]')!;
    const controls = [...composer.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="button"], [role="combobox"], [role="listbox"]')];
    expect(controls).toEqual([input(), send()]);
    expect(composer.querySelector('.iq-file-chip, [data-file-chip]')).toBeNull();
    expect(composer.textContent).not.toMatch(/attach|method|scope|environment|reasoning|thorough/i);
  });

  it('Task deleted: its draft is discarded', async () => {
    const user = userEvent.setup();
    const store = createDraftStore();
    const { main } = await renderShell(store);
    await openTask('Bank confirmations');
    await user.type(input(), 'Gone soon');
    await openTask('Cash count');
    await user.type(input(), 'Stays');
    main.tasks.splice(0, 1);
    // Any change re-reads the tree; New thread is one.
    await user.click(within(nav()).getByRole('button', { name: 'New thread' }));
    await waitFor(() => expect(store.get(uuid(1))).toBe(''));
    expect(store.get(uuid(2))).toBe('Stays');
  });

  it('signed out: no Composer is shown and every draft is cleared', async () => {
    const store = createDraftStore();
    store.set(uuid(1), WORKSPACE, 'Old text');
    const main = fakeMain();
    main.session.signedIn = false;
    render(<Shell onShowSpecimen={() => undefined} drafts={store} />);
    await waitFor(() => expect(nav().dataset.sidebarState).toBe('signed-out'));
    expect(document.querySelector('[data-composer]')).toBeNull();
    expect(store.count()).toBe(0);
  });

  it('a change of principal clears every draft', async () => {
    const user = userEvent.setup();
    const store = createDraftStore();
    const { main, view } = await renderShell(store);
    await openTask('Bank confirmations');
    await user.type(input(), 'Priya only');
    view.unmount();
    main.session.person = OMAR;
    render(<Shell onShowSpecimen={() => undefined} drafts={store} />);
    await waitReady();
    await waitFor(() => expect(store.count()).toBe(0));
    await openTask('Bank confirmations');
    expect(input().value).toBe('');
  });
});

describe('App: drafts across Settings', () => {
  const go = async (hash: string) => {
    act(() => {
      globalThis.location.hash = hash;
    });
    await waitFor(() => expect(document.querySelector(hash === '#specimen' ? '[data-account]' : '[data-shell]')).not.toBeNull());
  };

  it('a visit to Settings keeps the drafts', async () => {
    const user = userEvent.setup();
    fakeMain();
    render(<App />);
    await waitReady();
    await openTask('Bank confirmations');
    await user.type(input(), 'Across settings');
    await go('#specimen');
    await go('#shell');
    await waitReady();
    await openTask('Bank confirmations');
    expect(input().value).toBe('Across settings');
  });

  it('Sign-out clears every draft', async () => {
    const user = userEvent.setup();
    const main = fakeMain();
    render(<App />);
    await waitReady();
    await openTask('Bank confirmations');
    await user.type(input(), 'Private text');
    await go('#specimen');
    const account = document.querySelector<HTMLElement>('[data-account]')!;
    await waitFor(() => expect(account.dataset.identityState).toBe('signed-in'));
    await user.click(within(account).getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(account.dataset.identityState).toBe('signed-out'));
    expect(main.identity.signOut).toHaveBeenCalledTimes(1);
    // The same principal signs in again elsewhere: the earlier draft is still gone.
    main.session.signedIn = true;
    await go('#shell');
    await waitReady();
    await openTask('Bank confirmations');
    expect(input().value).toBe('');
  });
});

describe('composer smoke evaluation (pure)', () => {
  const field = (length: number) => ({ length, matches: true, focused: true });
  const send = (reason: string) => ({ ariaDisabled: 'true', disabledAttr: false, tabIndex: 0, reason, name: 'Send' });
  const passing: ComposerProbeRead = {
    configured: true,
    signedIn: true,
    tasks: { a: uuid(1), b: uuid(2) },
    typed: {
      shellOpened: true,
      openedA: true,
      openedB: true,
      reopenedA: true,
      reopenedB: true,
      label: COMPOSER_LABEL,
      bBefore: field(0),
      emptySend: send(`${COMPOSER_EMPTY_REASON} ${COMPOSER_ROUTE_REASON}`),
      aAfter: field(22),
      bAfter: field(22),
      focused: true,
    },
    afterEnter: field(22),
    afterShiftEnter: field(23),
    send: { send: send(COMPOSER_ROUTE_REASON), controls: { others: 0, enabledOthers: 0, fileChips: 0, laterWords: false }, sendFocusable: true, afterSend: field(23), taskStillOpen: true },
    signOut: { pressed: true, reached: true, shellOpened: true, signedOutShown: true, composerShown: false },
    signedInAgain: true,
    after: { shellOpened: true, openedA: true, a: field(0), openedB: true, b: field(0) },
    signedOutAtEnd: true,
  };

  it('uses the Composer’s own reason text', () => {
    expect([COMPOSER_EMPTY_REASON, COMPOSER_ROUTE_REASON]).toEqual([SEND_EMPTY_REASON, SEND_ROUTE_REASON]);
  });

  it('passes a clean run and fails each broken rule', () => {
    expect(evaluateComposer(passing)).toMatchObject({ ok: true, failures: [] });
    const broken: Array<Partial<ComposerProbeRead>> = [
      { afterEnter: { length: 0, matches: false, focused: true } },
      { send: { ...passing.send!, controls: { others: 1, enabledOthers: 1, fileChips: 0, laterWords: true } } },
      { send: { ...passing.send!, send: { ...send(COMPOSER_ROUTE_REASON), ariaDisabled: null } } },
      { signOut: { ...passing.signOut!, composerShown: true } },
      { after: { ...passing.after!, a: field(22) } },
    ];
    for (const change of broken) expect(evaluateComposer({ ...passing, ...change }).ok).toBe(false);
  });

  it('signed out without the topology: passes only when no Composer shows', () => {
    expect(evaluateComposer({ configured: false, signedOutShell: { shellOpened: true, signedOutShown: true, composerShown: false } }).ok).toBe(true);
    expect(evaluateComposer({ configured: false, signedOutShell: { shellOpened: true, signedOutShown: true, composerShown: true } }).ok).toBe(false);
  });
});
