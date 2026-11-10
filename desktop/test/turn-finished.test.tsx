// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.15, owner amendment 2026-11-04 (Codex desktop pattern): a finished
 * turn ends with a neutral "Finished · worked for …" line whose duration comes
 * only from the native turn's own timestamps; interrupted, failed and
 * uncertain turns keep their wording; no "Not recorded" placeholder appears.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { taskBindingFixture } from './model-fixtures';
import { TaskService, nativeTurnDurationMs } from '../src/main/tasks/service';
import { TaskView } from '../src/renderer/Shell/TaskView';
import { finishedText, workedFor } from '../src/renderer/Shell/TaskProgress';
import { activityLabel } from '../src/renderer/Shell/TaskLifecycle';
import { parseProgress, type ProgressSnapshot } from '../src/renderer/Shell/tasks-bridge';
import { parseTaskStates, STATE_DIMENSIONS } from '../src/renderer/Shell/state-bridge';

const TASK = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const RUN = '44444444-4444-4444-8444-444444444444';
const base: ProgressSnapshot = { version: 1, taskId: TASK, workspaceId: WORKSPACE, runId: RUN, threadId: 'thread-1', turnId: 'turn-1', runtimeId: 'runtime-1', sessionGeneration: 1, status: 'completed', historyIncomplete: false, items: [{ id: 'agent', kind: 'message', role: 'agent', status: 'completed', text: 'Fictional brief ready' }], plan: [], results: [], artifact: 'absent', questions: [] };
const task = { taskId: TASK, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Bank confirmations', runtimeThreadId: null, sourceRefs: [], artifactRefs: [], visibility: 'private' as const, revision: 1 };

function show(snapshot: ProgressSnapshot, states: unknown = null) {
  Object.assign(globalThis, { inquello: { tasks: { progress: vi.fn(async () => ({ ok: true, value: snapshot })), answer: vi.fn(), onProgressChanged: () => () => undefined } } });
  render(<TaskView task={task} engagements={[]} folders={[]} onRename={vi.fn()} onMove={vi.fn()} newOperationId={() => 'op'} states={states === null ? null : parseTaskStates(states)} />);
}

/** Everything that would read as success, sign-off or a green chip. */
function expectNeutral(element: HTMLElement) {
  expect(element.textContent).not.toMatch(/accept|approv|\bdone\b|success/i);
  expect(element.className).not.toMatch(/accepted|success|green|status-chip/);
  expect(element.closest('.iq-status-chip, [role="alert"]')).toBeNull();
  expect(element.querySelector('.iq-status-chip')).toBeNull();
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

describe('the end-of-turn line', () => {
  it('reads "Finished · worked for 1m 12s" from the measured duration at the end of the turn', async () => {
    show({ ...base, turnDurationMs: 72_400 });
    const line = await waitFor(() => {
      const found = document.querySelector<HTMLElement>('[data-turn-finished]');
      if (!found) throw new Error('no finished line');
      return found;
    });
    expect(line.textContent).toBe('Finished · worked for 1m 12s');
    expect(line.dataset.turnDuration).toBe('measured');
    // It closes the turn: after the conversation's last item.
    const items = document.querySelector('.iq-conversation-items')!;
    expect(items.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expectNeutral(line);
    expect(line.className).toBe('iq-turn-finished');
  });

  it('reads just "Finished" when the duration is unknown', async () => {
    show({ ...base });
    const line = await screen.findByText('Finished');
    expect(line.dataset.turnDuration).toBe('unknown');
    expect(line.textContent).toBe('Finished');
    expectNeutral(line);
  });

  it('is muted and never green, a chip, a toast or acceptance wording', async () => {
    const css = (await import('node:fs')).readFileSync(`${process.cwd()}/src/renderer/Shell/shell.css`, 'utf8');
    const rule = /\.iq-turn-finished\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/color:\s*var\(--text-muted\)/);
    expect(rule).not.toMatch(/green|success|accepted|background/i);
    show({ ...base, turnDurationMs: 5_000 });
    const line = await screen.findByText('Finished · worked for 5s');
    expectNeutral(line);
    expect(document.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained, [role="alert"]')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/accepted|approved|\bdone\b/i);
  });

  it('shows no "Not recorded" placeholder and no state rows when nothing is recorded', async () => {
    const empty = { taskId: TASK, revision: 0, dimensions: STATE_DIMENSIONS.map((dimension) => ({ dimension, records: [] })) };
    show({ ...base }, empty);
    await screen.findByText('Finished');
    expect(document.body.textContent).not.toContain('Not recorded');
    expect(document.querySelector('[data-task-states], [data-state-dimension]')).toBeNull();
  });

  it.each([
    ['cancelled', 'Interrupted — Resume available'],
    ['failed', 'Stopped after an error'],
    ['uncertain', 'Interrupted — outcome uncertain'],
  ] as const)('a %s turn keeps its wording and gets no finished line', async (status, label) => {
    expect(activityLabel({ ...base, status })).toBe(label);
    show({ ...base, status, turnDurationMs: 72_400 });
    await waitFor(() => expect(document.querySelector('[data-progress-item="agent"]')).not.toBeNull());
    expect(document.querySelector('[data-turn-finished]')).toBeNull();
    expect(document.body.textContent).not.toContain('Finished');
    if (status === 'failed') expect(screen.getByText('The response could not be completed. Your saved conversation is retained.')).toBeTruthy();
  });

  it('keeps the sidebar status hidden for a completed turn and live while running', () => {
    expect(activityLabel({ ...base, status: 'completed' })).toBe('');
    expect(activityLabel({ ...base, status: 'running' })).toBe('Running');
  });
});

describe('the duration source', () => {
  it('formats measured whole seconds only', () => {
    expect(workedFor(72_400)).toBe('1m 12s');
    expect(workedFor(5_999)).toBe('5s');
    expect(workedFor(400)).toBe('under 1s');
    expect(workedFor(3_726_000)).toBe('1h 2m');
    expect(finishedText(undefined)).toBe('Finished');
    expect(finishedText(60_000)).toBe('Finished · worked for 1m 0s');
  });

  it('takes the native durationMs, else completedAt - startedAt, and never guesses', () => {
    expect(nativeTurnDurationMs({ id: 't', durationMs: 72_400, startedAt: 1, completedAt: 2 })).toBe(72_400);
    expect(nativeTurnDurationMs({ id: 't', durationMs: null, startedAt: 1_761_700_000, completedAt: 1_761_700_072 })).toBe(72_000);
    expect(nativeTurnDurationMs({ id: 't', durationMs: null, startedAt: null, completedAt: 1_761_700_072 })).toBeNull();
    expect(nativeTurnDurationMs({ id: 't', durationMs: -1 })).toBeNull();
    expect(nativeTurnDurationMs({ id: 't', startedAt: 20, completedAt: 10 })).toBeNull();
    expect(nativeTurnDurationMs(null)).toBeNull();
  });

  it('the renderer drops a duration on an unfinished turn or a malformed one', () => {
    expect(parseProgress({ ...base, turnDurationMs: 1000 }).turnDurationMs).toBe(1000);
    expect(parseProgress({ ...base, status: 'failed', turnDurationMs: 1000 }).turnDurationMs).toBeUndefined();
    expect(parseProgress({ ...base, turnDurationMs: 1.5 }).turnDurationMs).toBeUndefined();
    expect(parseProgress({ ...base, turnDurationMs: '72s' }).turnDurationMs).toBeUndefined();
  });

  it('main attaches the duration of the exact finished native turn to an authorized progress read', async () => {
    let snapshot: Record<string, unknown> = { ...base, status: 'running', items: [] };
    const request = vi.fn(async (method: string) => (method === 'inquello/tasks/progress' ? snapshot : null));
    const service = new TaskService({ taskBinding: taskBindingFixture, runtime: { ready: () => true, instance: () => 1, request: request as never }, identity: { principalId: () => TASK }, syncPrincipal: async () => {}, prepareRoutes: async () => ({ ok: true }), freshPolicy: async () => ({ workspaceId: WORKSPACE, authorizationEpoch: 1 }) as never });
    const input = { taskId: TASK, workspaceId: WORKSPACE };
    expect(await service.progress(input)).toMatchObject({ ok: true, value: { status: 'running' } });
    // Another turn's completion is not this turn's duration.
    service.notification('turn/completed', { threadId: 'thread-1', turn: { id: 'turn-0', durationMs: 9_000 } });
    snapshot = { ...base, items: [] };
    const unknown = await service.progress(input);
    expect(unknown.ok && unknown.value.turnDurationMs).toBeUndefined();
    service.notification('turn/completed', { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed', startedAt: 1_761_700_000, completedAt: 1_761_700_072, durationMs: 72_400 } });
    const measured = await service.progress(input);
    expect(measured).toMatchObject({ ok: true, value: { status: 'completed', turnDurationMs: 72_400 } });
    // The native runtime cannot supply the field itself.
    snapshot = { ...base, items: [], turnId: 'turn-2', turnDurationMs: 1 };
    const forged = await service.progress(input);
    expect(forged.ok && forged.value.turnDurationMs).toBeUndefined();
  });
});
