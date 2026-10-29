// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.16: the Shell's layout modes, rail, artifact area, Composer-slot
 * draft preservation, tab order, landmarks, live announcements and the
 * Ctrl/Cmd+N, Ctrl/Cmd+K and Escape rules, against an in-memory fake of main.
 * The artifact and the Composer are test-only content here: the app passes
 * neither.
 */
import fs from 'node:fs';
import path from 'node:path';

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SHELL_LAYOUT } from '../src/main/smoke-probe';
import { spacing } from '../src/renderer/design/tokens';
import type { ShellArtifact } from '../src/renderer/Shell/ArtifactArea';
import type { DraftBinding } from '../src/renderer/Shell/drafts';
import { EscapeStack, isNewThreadShortcut, isTextEntry } from '../src/renderer/Shell/keyboard';
import {
  ARTIFACT_MIN_WIDTH,
  artifactFits,
  HEADER_HEIGHT,
  layoutMode,
  RAIL_WIDTH,
  SIDEBAR_WIDTH,
  THREAD_MAX_WIDTH,
  THREAD_MIN_WIDTH,
  WINDOW_MIN_WIDTH,
} from '../src/renderer/Shell/layout';
import type { TaskItem } from '../src/renderer/Shell/organise-bridge';
import { Shell, UNTITLED_TASK } from '../src/renderer/Shell/Shell';

const renderer = path.resolve(__dirname, '..', 'src', 'renderer');
const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const ENGAGEMENT = '00000000-0000-4000-8000-0000000000e1';
const FOLDER = '00000000-0000-4000-8000-0000000000f1';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const task = (n: number, title: string, engagementId: string | null = null, folderId: string | null = null): TaskItem => ({
  taskId: uuid(n),
  workspaceId: WORKSPACE,
  engagementId,
  folderId,
  title,
  runtimeThreadId: null,
  sourceRefs: [],
  artifactRefs: [],
  visibility: 'private',
  revision: 1,
});

/** Test-only artifact content; the app never opens one. */
const TEST_ARTIFACT: ShellArtifact = {
  artifactId: 'test-artifact',
  title: 'Test-only artifact',
  items: [
    { itemId: 'row-1', label: 'Row one' },
    { itemId: 'row-2', label: 'Row two' },
  ],
  reviewActions: [{ label: 'Test review action', onPress: () => undefined }],
};

/** A test-only stand-in for the Story 1.17 Composer, bound to the preserved draft. */
const testComposer = (draft: DraftBinding) => (
  <textarea aria-label="Test composer" data-test-composer={draft.taskId ?? ''} value={draft.value} onChange={(event) => draft.onChange(event.target.value)} />
);

function fakeMain() {
  const tasks: TaskItem[] = [task(1, 'Bank confirmations'), task(2, 'Cash count', ENGAGEMENT, FOLDER)];
  let next = 10;
  const organise = {
    getWorkspaces: vi.fn(async () => ({
      signedIn: true,
      sharedService: 'available',
      workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', source: 'service' }],
      engagementCreation: { enabled: true },
    })),
    getTree: vi.fn(async () => ({
      ok: true,
      value: {
        workspaceId: WORKSPACE,
        engagements: [{ engagementId: ENGAGEMENT, workspaceId: WORKSPACE, name: 'FY26 audit', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null, revision: 1 }],
        folders: [{ folderId: FOLDER, engagementId: ENGAGEMENT, name: 'Planning', revision: 1 }],
        tasks,
      },
    })),
    createTask: vi.fn(async (request: { title: string; engagementId: string | null; folderId: string | null }) => {
      const created = task(++next, request.title, request.engagementId, request.folderId);
      tasks.push(created);
      return { ok: true, value: created };
    }),
  };
  const identity = {
    signIn: vi.fn(),
    getStatus: vi.fn(async () => ({
      identity: { state: 'signed-in', displayName: 'Priya Raman', issuerLabel: 'Synthetic issuer' },
      sharedService: 'available',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    })),
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ organise: Object.freeze(organise), identity: Object.freeze(identity) });
  return { organise, tasks };
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

const shell = () => document.querySelector<HTMLElement>('[data-shell]')!;
const nav = () => screen.getByRole('navigation', { name: 'Workspace navigation' });
const announcer = () => document.querySelector<HTMLElement>('[data-shell-announcer]')!;
const announceCount = () => Number(announcer().dataset.announceCount);

async function renderReady(options: { artifact?: ShellArtifact | null; composer?: boolean } = {}) {
  const main = fakeMain();
  const view = render(
    <Shell onShowSpecimen={() => undefined} operationIds={() => uuid(900)} artifact={options.artifact ?? null} renderComposer={options.composer ? testComposer : undefined} />,
  );
  await waitFor(() => expect(nav().dataset.sidebarState).toBe('ready'));
  // The tree is loaded: Task rows in the Sidebar, or the Task count in the rail.
  await waitFor(() => expect(document.querySelector('[data-task-id], .iq-rail-badge')).not.toBeNull());
  return { main, view };
}

async function openTask(title: string) {
  await userEvent.setup().click(within(nav()).getByRole('link', { name: title }));
  await waitFor(() => expect(document.querySelector('[data-header-title]')!.textContent).toBe(title));
}

beforeEach(() => setWidth(1280));

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
});

describe('layout modes (pure)', () => {
  it('takes every width from the DESIGN tokens', () => {
    expect(SIDEBAR_WIDTH).toBe(Number.parseFloat(spacing['sidebar-width']));
    expect(RAIL_WIDTH).toBe(Number.parseFloat(spacing['rail-width']));
    expect(HEADER_HEIGHT).toBe(Number.parseFloat(spacing['header-height']));
    expect(THREAD_MAX_WIDTH).toBe(Number.parseFloat(spacing['thread-max-width']));
    expect(ARTIFACT_MIN_WIDTH).toBe(Number.parseFloat(spacing['panel-min-width']));
    expect([SIDEBAR_WIDTH, RAIL_WIDTH, HEADER_HEIGHT, THREAD_MAX_WIDTH, ARTIFACT_MIN_WIDTH]).toEqual([264, 52, 48, 720, 380]);
    expect(WINDOW_MIN_WIDTH).toBe(RAIL_WIDTH + THREAD_MIN_WIDTH);
  });

  it('main sizes the window and checks the smoke with the same numbers', () => {
    expect(SHELL_LAYOUT).toEqual({
      windowMinWidth: WINDOW_MIN_WIDTH,
      sidebarWidth: SIDEBAR_WIDTH,
      railWidth: RAIL_WIDTH,
      headerHeight: HEADER_HEIGHT,
      threadMaxWidth: THREAD_MAX_WIDTH,
      fullWidth: SIDEBAR_WIDTH + THREAD_MIN_WIDTH,
      artifactFitWidth: RAIL_WIDTH + THREAD_MIN_WIDTH + ARTIFACT_MIN_WIDTH,
    });
  });

  it('without an artifact: full while the Sidebar and a readable thread fit, rail below', () => {
    const full = SIDEBAR_WIDTH + THREAD_MIN_WIDTH;
    expect(layoutMode(full, false)).toBe('full');
    expect(layoutMode(full - 1, false)).toBe('rail');
    expect(layoutMode(WINDOW_MIN_WIDTH, false)).toBe('rail');
    expect(layoutMode(4000, false)).toBe('full');
  });

  it('with an artifact: full, then rail while thread + 380px fit, then single', () => {
    const full = SIDEBAR_WIDTH + THREAD_MIN_WIDTH + ARTIFACT_MIN_WIDTH;
    const fits = RAIL_WIDTH + THREAD_MIN_WIDTH + ARTIFACT_MIN_WIDTH;
    expect(layoutMode(full, true)).toBe('full');
    expect(layoutMode(full - 1, true)).toBe('rail');
    expect(layoutMode(fits, true)).toBe('rail');
    expect(layoutMode(fits - 1, true)).toBe('single');
    expect(layoutMode(WINDOW_MIN_WIDTH, true)).toBe('single');
    expect(artifactFits(fits)).toBe(true);
    expect(artifactFits(fits - 1)).toBe(false);
  });
});

describe('keyboard rules (pure)', () => {
  const key = (overrides: Partial<Parameters<typeof isNewThreadShortcut>[0]>) => ({ key: 'n', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides });

  it('Ctrl+N or Cmd+N alone is New thread; nothing else is', () => {
    expect(isNewThreadShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isNewThreadShortcut(key({ metaKey: true }))).toBe(true);
    expect(isNewThreadShortcut(key({ key: 'N', ctrlKey: true }))).toBe(true);
    expect(isNewThreadShortcut(key({}))).toBe(false);
    expect(isNewThreadShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isNewThreadShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
    expect(isNewThreadShortcut(key({ ctrlKey: true, metaKey: true }))).toBe(false);
    expect(isNewThreadShortcut(key({ key: 'k', ctrlKey: true }))).toBe(false);
  });

  it('recognises text fields, and only them', () => {
    const make = (html: string) => {
      const host = document.createElement('div');
      host.innerHTML = html;
      document.body.appendChild(host);
      return host.firstElementChild!;
    };
    expect(isTextEntry(make('<input type="text">'))).toBe(true);
    expect(isTextEntry(make('<input>'))).toBe(true);
    expect(isTextEntry(make('<textarea></textarea>'))).toBe(true);
    expect(isTextEntry(make('<div contenteditable="true"><span>x</span></div>').firstElementChild)).toBe(true);
    expect(isTextEntry(make('<input type="checkbox">'))).toBe(false);
    expect(isTextEntry(make('<button>x</button>'))).toBe(false);
    expect(isTextEntry(document.body)).toBe(false);
    expect(isTextEntry(null)).toBe(false);
    document.body.innerHTML = '';
  });

  it('Escape closes the topmost layer first and focuses its opener', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);
    const closed: string[] = [];
    const stack = new EscapeStack();
    stack.push({ close: () => closed.push('first'), opener: () => first });
    const remove = stack.push({ close: () => closed.push('second'), opener: () => second });
    expect(stack.closeTopmost()).toBe(true);
    expect(closed).toEqual(['second']);
    expect(document.activeElement).toBe(second);
    remove();
    expect(stack.size).toBe(1);
    expect(stack.closeTopmost()).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(stack.closeTopmost()).toBe(false);
    document.body.innerHTML = '';
  });
});

describe('Shell layout', () => {
  it('wide window: full mode with the 264px Sidebar, Header, thread column and no artifact area', async () => {
    await renderReady();
    expect(shell().dataset.layoutMode).toBe('full');
    expect(nav().dataset.navPresentation).toBe('sidebar');
    expect(nav().classList.contains('iq-sidebar--sidebar')).toBe(true);
    expect(within(nav()).getByRole('img', { name: 'Inquello' }).getAttribute('src')).toMatch(/lockup/);
    expect(document.querySelector('[data-header]')).not.toBeNull();
    expect(document.querySelector('main .iq-shell-content')).not.toBeNull();
    // Landmarks: one navigation, one main, no artifact while nothing opened one.
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(shell().dataset.artifactOpen).toBe('false');
    // The person and Settings sit at the bottom.
    await waitFor(() => expect(within(nav()).getByRole('img', { name: 'Priya Raman' })).toBeTruthy());
    expect(within(nav()).getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('NavRows: Tasks are links with aria-current, Engagements and folders expose aria-expanded, actions are buttons', async () => {
    const user = userEvent.setup();
    await renderReady();
    const row = within(nav()).getByRole('link', { name: 'Cash count' });
    expect(row.getAttribute('aria-current')).toBeNull();
    await openTask('Cash count');
    expect(within(nav()).getByRole('link', { name: 'Cash count' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav()).getByRole('link', { name: 'Bank confirmations' }).getAttribute('aria-current')).toBeNull();
    const engagement = within(nav()).getByRole('button', { name: 'FY26 audit' });
    const folder = within(nav()).getByRole('button', { name: 'Planning' });
    expect(engagement.getAttribute('aria-expanded')).toBe('true');
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    // Nesting keeps the hierarchy: Engagement list → folder list → Task.
    const engagementList = document.getElementById(engagement.getAttribute('aria-controls')!)!;
    const folderList = document.getElementById(folder.getAttribute('aria-controls')!)!;
    expect(engagementList.contains(folderList)).toBe(true);
    expect(folderList.contains(within(nav()).getByRole('link', { name: 'Cash count' }))).toBe(true);
    await user.click(folder);
    expect(folder.getAttribute('aria-expanded')).toBe('false');
    expect(folderList.hidden).toBe(true);
    await user.click(engagement);
    expect(engagement.getAttribute('aria-expanded')).toBe('false');
    expect(engagementList.hidden).toBe(true);
    // Collapsing a row never closes the open Task.
    expect(document.querySelector(`[data-task-view="${uuid(2)}"]`)).not.toBeNull();
    expect(within(nav()).getByRole('button', { name: 'New folder in FY26 audit' }).tagName).toBe('BUTTON');
  });

  it('narrow: rail mode at 52px keeps the open Task marked, the count and labelled icon actions with tooltips', async () => {
    await renderReady();
    await openTask('Bank confirmations');
    setWidth(SIDEBAR_WIDTH + THREAD_MIN_WIDTH - 1);
    expect(shell().dataset.layoutMode).toBe('rail');
    expect(nav().dataset.navPresentation).toBe('rail');
    expect(nav().classList.contains('iq-sidebar--rail')).toBe(true);
    // The open Task is unchanged and still marked.
    expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
    const current = within(nav()).getByRole('link', { name: 'Open Task: Bank confirmations' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(within(nav()).getByRole('button', { name: 'Workspace: Synthetic Audit Co' })).toBeTruthy();
    expect(within(nav()).getByRole('button', { name: 'Tasks' }).getAttribute('aria-current')).toBe('true');
    expect(within(nav()).getByText('2 Tasks in this Workspace')).toBeTruthy();
    // Every rail action has an accessible name and a matching tooltip (shown on hover and focus by CSS).
    for (const item of nav().querySelectorAll<HTMLElement>('.iq-rail-item')) {
      const control = item.querySelector<HTMLElement>('button, a, [role="img"]')!;
      const tip = item.querySelector('.iq-rail-tip')!;
      expect(control.getAttribute('aria-label')).toBe(tip.textContent);
      expect(tip.getAttribute('aria-hidden')).toBe('true');
    }
    const css = fs.readFileSync(path.join(renderer, 'Shell', 'shell.css'), 'utf8');
    expect(css).toContain('.iq-rail-item:hover > .iq-rail-tip,\n.iq-rail-item:focus-within > .iq-rail-tip');
  });

  it('narrow + artifact: single mode with an explicit Conversation/Artifact switch', async () => {
    setWidth(RAIL_WIDTH + THREAD_MIN_WIDTH + ARTIFACT_MIN_WIDTH - 1);
    await renderReady({ artifact: TEST_ARTIFACT });
    expect(shell().dataset.layoutMode).toBe('single');
    const radios = within(screen.getByRole('radiogroup', { name: 'Work area' })).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['Conversation', 'Artifact']);
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('main', { hidden: true }).hidden).toBe(false);
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-artifact-area]')!.hidden).toBe(true);
  });

  it('switching twice keeps the same draft and selected item, and focus stays on the switch', async () => {
    const user = userEvent.setup();
    await renderReady({ artifact: TEST_ARTIFACT, composer: true });
    await openTask('Bank confirmations');
    setWidth(700);
    expect(shell().dataset.layoutMode).toBe('single');
    await user.type(screen.getByLabelText('Test composer'), 'Unsent request');
    const group = screen.getByRole('radiogroup', { name: 'Work area' });
    await user.click(within(group).getByRole('radio', { name: 'Artifact' }));
    expect(document.activeElement).toBe(within(group).getByRole('radio', { name: 'Artifact' }));
    expect(screen.getByRole('complementary', { name: 'Artifact' })).toBeTruthy();
    expect(screen.queryByRole('main')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Row two' }));
    const before = announceCount();
    await user.click(within(group).getByRole('radio', { name: 'Conversation' }));
    expect(announceCount()).toBe(before + 1);
    expect(announcer().textContent).toBe('Showing the Conversation');
    expect(document.activeElement).toBe(within(group).getByRole('radio', { name: 'Conversation' }));
    expect((screen.getByLabelText('Test composer') as HTMLTextAreaElement).value).toBe('Unsent request');
    // The keyboard route switches back, focus following the selection.
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(within(group).getByRole('radio', { name: 'Artifact' }));
    expect(screen.getByRole('button', { name: 'Row two' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Row one' }).getAttribute('aria-pressed')).toBe('false');
    expect((screen.getByLabelText('Test composer') as HTMLTextAreaElement).value).toBe('Unsent request');
    expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
  });

  it('Ctrl/Cmd+N outside a text field activates New thread; inside a text field it is not intercepted', async () => {
    const user = userEvent.setup();
    const { main } = await renderReady({ composer: true });
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Control>}n{/Control}');
    await waitFor(() => expect(main.organise.createTask).toHaveBeenCalledTimes(1));
    expect(main.organise.createTask).toHaveBeenCalledWith(expect.objectContaining({ engagementId: null, folderId: null, title: UNTITLED_TASK }));
    await waitFor(() => expect(document.querySelector('[data-header-title]')!.textContent).toBe(UNTITLED_TASK));
    expect(announcer().textContent).toBe(`Opened Task ${UNTITLED_TASK}`);
    await user.click(within(nav()).getByRole('link', { name: 'Bank confirmations' }));
    await user.keyboard('{Meta>}n{/Meta}');
    await waitFor(() => expect(main.organise.createTask).toHaveBeenCalledTimes(2));

    const composer = screen.getByLabelText('Test composer');
    composer.focus();
    const event = new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true, cancelable: true });
    composer.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(main.organise.createTask).toHaveBeenCalledTimes(2);
  });

  it('Ctrl/Cmd+K is not handled by Inquello', async () => {
    const { main } = await renderReady();
    const before = announceCount();
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'k', bubbles: true, cancelable: true, ...modifier });
      document.body.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(main.organise.createTask).not.toHaveBeenCalled();
    expect(announceCount()).toBe(before);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape closes the topmost Menu, then the navigation overlay, returning focus each time; the Task is unaffected', async () => {
    const user = userEvent.setup();
    await renderReady();
    await openTask('Bank confirmations');
    setWidth(640);
    const expand = within(nav()).getByRole('button', { name: 'Expand navigation' });
    await user.click(expand);
    const overlay = document.querySelector<HTMLElement>('[data-nav-overlay]')!;
    expect(overlay).not.toBeNull();
    expect(overlay.contains(document.activeElement)).toBe(true);
    // A Menu inside the overlay is topmost.
    const trigger = within(overlay).getByRole('button', { name: 'Synthetic Audit Co' });
    await user.click(trigger);
    expect(screen.getByRole('menu')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('[data-nav-overlay]')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(document.querySelector('[data-nav-overlay]')).toBeNull();
    expect(document.activeElement).toBe(within(nav()).getByRole('button', { name: 'Expand navigation' }));
    expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
    // No overlay: Escape is a no-op.
    const before = announceCount();
    await user.keyboard('{Escape}');
    expect(announceCount()).toBe(before);
    expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
    expect(document.querySelector('[data-header-title]')!.textContent).toBe('Bank confirmations');
  });

  it('opening a Task from the overlay closes it and returns focus to its opener', async () => {
    const user = userEvent.setup();
    await renderReady();
    setWidth(640);
    await user.click(within(nav()).getByRole('button', { name: 'Expand navigation' }));
    await user.click(within(document.querySelector<HTMLElement>('[data-nav-overlay]')!).getByRole('link', { name: 'Cash count' }));
    expect(document.querySelector('[data-nav-overlay]')).toBeNull();
    expect(document.activeElement).toBe(within(nav()).getByRole('button', { name: 'Expand navigation' }));
    await waitFor(() => expect(document.querySelector('[data-header-title]')!.textContent).toBe('Cash count'));
  });

  it('keyboard only: Tab moves navigation → main → artifact and review → Composer slot, with no trap', async () => {
    setWidth(1600);
    const user = userEvent.setup();
    await renderReady({ artifact: TEST_ARTIFACT, composer: true });
    await openTask('Bank confirmations');
    (document.activeElement as HTMLElement | null)?.blur();
    const region = (element: Element | null): number => {
      if (!element || element === document.body) return -1;
      if (element.closest('nav')) return 0;
      if (element.closest('main')) return 1;
      if (element.closest('[data-review-region]')) return 3;
      if (element.closest('aside')) return 2;
      if (element.closest('[data-composer-slot]')) return 4;
      return -2;
    };
    const seen: number[] = [];
    for (let step = 0; step < 80; step += 1) {
      await user.tab();
      const at = region(document.activeElement);
      if (at === -1 && seen.length > 0) break; // wrapped out of the document: no trap
      seen.push(at);
    }
    expect(seen).not.toContain(-2);
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4]);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(seen.at(-1)).toBe(4);
  });

  it('toggling the rail by keyboard is announced once and keeps the current Task and counts', async () => {
    const user = userEvent.setup();
    await renderReady();
    await openTask('Bank confirmations');
    within(nav()).getByRole('button', { name: 'Collapse navigation' }).focus();
    const before = announceCount();
    await user.keyboard('{Enter}');
    expect(nav().dataset.navPresentation).toBe('rail');
    expect(shell().dataset.layoutMode).toBe('full');
    expect(announceCount()).toBe(before + 1);
    expect(announcer().textContent).toBe('Navigation collapsed');
    const expand = within(nav()).getByRole('button', { name: 'Expand navigation' });
    expect(document.activeElement).toBe(expand);
    expect(expand.getAttribute('aria-expanded')).toBe('false');
    expect(within(nav()).getByRole('link', { name: 'Open Task: Bank confirmations' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav()).getByText('2 Tasks in this Workspace')).toBeTruthy();
    expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
    await user.keyboard('{Enter}');
    expect(nav().dataset.navPresentation).toBe('sidebar');
    expect(announceCount()).toBe(before + 2);
    expect(announcer().textContent).toBe('Navigation expanded');
    expect(document.activeElement).toBe(within(nav()).getByRole('button', { name: 'Collapse navigation' }));
    // One polite live region for surface changes.
    expect(document.querySelectorAll('[data-shell-announcer]')).toHaveLength(1);
    expect(announcer().getAttribute('aria-live')).toBe('polite');
  });

  it('opening a Task is announced once', async () => {
    await renderReady();
    const before = announceCount();
    await openTask('Cash count');
    expect(announceCount()).toBe(before + 1);
    expect(announcer().textContent).toBe('Opened Task Cash count');
    await openTask('Cash count');
    expect(announceCount()).toBe(before + 1);
  });

  it('resizing across every threshold keeps the open Task and the draft', async () => {
    const user = userEvent.setup();
    await renderReady({ artifact: TEST_ARTIFACT, composer: true });
    await openTask('Bank confirmations');
    await user.type(screen.getByLabelText('Test composer'), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Row one' }));
    const modes: string[] = [];
    for (const width of [1600, 1000, 800, WINDOW_MIN_WIDTH, 1000, 1600]) {
      setWidth(width);
      modes.push(shell().dataset.layoutMode!);
      expect(document.querySelector(`[data-task-view="${uuid(1)}"]`)).not.toBeNull();
      expect((screen.getByLabelText('Test composer') as HTMLTextAreaElement).value).toBe('Keep me');
      expect(document.querySelector('[data-artifact-item="row-1"]')!.getAttribute('aria-pressed')).toBe('true');
    }
    expect(modes).toEqual(['full', 'rail', 'single', 'single', 'rail', 'full']);
  });

  it('keeps each Task its own draft', async () => {
    const user = userEvent.setup();
    await renderReady({ composer: true });
    await openTask('Bank confirmations');
    await user.type(screen.getByLabelText('Test composer'), 'For bank');
    await openTask('Cash count');
    expect((screen.getByLabelText('Test composer') as HTMLTextAreaElement).value).toBe('');
    await openTask('Bank confirmations');
    expect((screen.getByLabelText('Test composer') as HTMLTextAreaElement).value).toBe('For bank');
  });

  it('the Composer slot holds the Story 1.17 Composer when no other is supplied', async () => {
    await renderReady();
    const slot = document.querySelector<HTMLElement>('[data-composer-slot]')!;
    expect(slot.dataset.composerSlot).toBe('filled');
    expect(slot.querySelector('[data-composer]')).not.toBeNull();
  });

  it('closing the artifact removes the complementary region', async () => {
    const user = userEvent.setup();
    await renderReady({ artifact: TEST_ARTIFACT });
    expect(screen.getByRole('complementary', { name: 'Artifact' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Contextual review' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close artifact' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(shell().dataset.artifactOpen).toBe('false');
  });

  it('shows no "Stop (Esc)" or other Esc hint', async () => {
    await renderReady({ artifact: TEST_ARTIFACT });
    const labels = [...shell().querySelectorAll('[aria-label], [title]')].map((element) => `${element.getAttribute('aria-label')} ${element.getAttribute('title')}`);
    expect(shell().textContent).not.toMatch(/\bEsc\b/);
    expect(labels.join(' ')).not.toMatch(/\bEsc\b/);
  });
});

describe('no demo artifact, light theme only', () => {
  it('nothing in the app opens the artifact area or supplies a Composer', () => {
    const sources = ['App.tsx', 'main.tsx'].map((file) => fs.readFileSync(path.join(renderer, file), 'utf8')).join('\n');
    expect(sources).not.toMatch(/artifact=|renderComposer=/);
    expect(fs.readFileSync(path.join(renderer, 'Shell', 'Shell.tsx'), 'utf8')).not.toMatch(/artifactId: ['"]/);
  });

  it('OS dark preference: no stylesheet branches on prefers-color-scheme', () => {
    const css = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return css(full);
        return entry.name.endsWith('.css') ? [full] : [];
      });
    const files = css(renderer);
    expect(files.map((file) => path.basename(file))).toContain('shell.css');
    for (const file of files) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/prefers-color-scheme|data-theme/);
  });

  it('Ctrl/Cmd+K is never bound and no global shortcut is registered', () => {
    const shellDir = path.join(renderer, 'Shell');
    const source = fs.readdirSync(shellDir).map((file) => fs.readFileSync(path.join(shellDir, file), 'utf8')).join('\n');
    expect(source).not.toMatch(/key\s*===?\s*['"]k['"]/i);
    const main = fs.readFileSync(path.resolve(renderer, '..', 'main', 'main.ts'), 'utf8');
    expect(main).not.toMatch(/globalShortcut/);
  });
});
