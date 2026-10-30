// @vitest-environment jsdom
/// <reference lib="dom" />
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_ENVIRONMENT, REMOTE_GATE, type TaskEnvironmentView } from '../src/main/environments/types';
import { TaskEnvironment } from '../src/renderer/Shell/TaskEnvironment';
import { TaskView } from '../src/renderer/Shell/TaskView';
import type { TaskItem } from '../src/renderer/Shell/organise-bridge';
const taskId = '22222222-2222-4222-8222-222222222222';
const facts = (overrides: Partial<TaskEnvironmentView> = {}): TaskEnvironmentView => ({
  taskId, executionLabel: LOCAL_ENVIRONMENT, readiness: 'ready', sandbox: 'not-checked',
  inference: { status: 'selected', provider: 'Anthropic', deployment: 'anthropic-direct', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-5-5', apiVersion: '2026-10-21', region: 'Unknown' },
  remoteGate: REMOTE_GATE, hostedSandboxGate: 'V2 revisit (OQ-13)', ...overrides,
});
function setup(view = facts()) {
  let change = () => {};
  const unsubscribe = vi.fn();
  const forTask = vi.fn<(input: { taskId: string }) => Promise<unknown>>(async () => ({ ok: true, value: view }));
  Object.defineProperty(globalThis, 'inquello', { configurable: true, value: { environments: { forTask, onChanged: (fn: () => void) => { change = fn; return unsubscribe; } } } });
  return { forTask, unsubscribe, change: () => change() };
}
afterEach(() => { cleanup(); Reflect.deleteProperty(globalThis, 'inquello'); });
describe('Task environment facts', () => {
  it('distinguishes local execution, verified runtime, unchecked sandbox and selected cloud inference', async () => {
    const h = setup(); render(<TaskEnvironment taskId={taskId} />); await screen.findByText('Anthropic');
    for (const text of ['This device (local host)', 'Ready — runtime-owned configuration verified', 'Not checked', 'anthropic-direct', 'https://api.anthropic.com/v1/messages', 'claude-sonnet-5-5 / 2026-10-21', 'Unknown']) expect(screen.getByText(text)).toBeTruthy();
    expect(h.forTask).toHaveBeenCalledWith({ taskId });
    expect(screen.queryByRole('combobox')).toBeNull(); expect(screen.queryByRole('button', { name: /start/i })).toBeNull();
  });
  it('only a successful empty selection says no processing route selected', async () => {
    setup(facts({ inference: { status: 'none', provider: null, deployment: null, endpoint: null, model: null, apiVersion: null, region: 'Unknown' } })); render(<TaskEnvironment taskId={taskId} />);
    expect(await screen.findByText('No processing route selected')).toBeTruthy(); expect(screen.queryByText('Anthropic')).toBeNull();
  });
  it.each(['unavailable', 'stale'] as const)('does not present a %s route as empty or selected', async status => {
    setup(facts({ inference: { status, provider: null, deployment: null, endpoint: null, model: null, apiVersion: null, region: 'Unknown' } })); render(<TaskEnvironment taskId={taskId} />); await screen.findByText('Ready — runtime-owned configuration verified');
    expect(screen.getByText(status === 'unavailable' ? 'Inference information unavailable' : 'Inference information stale — refresh and review the processing route')).toBeTruthy();
    expect(screen.queryByText('No processing route selected')).toBeNull(); expect(screen.queryByText('Anthropic')).toBeNull();
  });
  it('names unavailable local execution independently of inference', async () => {
    setup(facts({ readiness: 'unavailable' })); render(<TaskEnvironment taskId={taskId} />);
    expect(await screen.findByText('This device (local host) is unavailable for tool execution')).toBeTruthy(); expect(screen.getByText('Anthropic')).toBeTruthy();
  });
  it('shows disabled remote/cloud and separate hosted sandbox gates', async () => {
    const h = setup(); render(<TaskEnvironment taskId={taskId} />); await screen.findByText('Anthropic');
    const remote = screen.getByRole('button', { name: 'Remote / cloud execution — not enabled' });
    expect(remote.getAttribute('aria-disabled')).toBe('true'); expect(screen.getByText(REMOTE_GATE)).toBeTruthy();
    expect(screen.getByText('Collaboration hosting is not execution.')).toBeTruthy(); expect(screen.getByText('V2 revisit (OQ-13)')).toBeTruthy();
    await userEvent.click(remote); expect(h.forTask).toHaveBeenCalledTimes(1);
  });
  it('sanitizes failures and supports keyboard refresh', async () => {
    const h = setup(); h.forTask.mockRejectedValueOnce(new Error('secret credential from server')); render(<TaskEnvironment taskId={taskId} />);
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Environment information unavailable. Refresh to check this Task.');
    expect(screen.queryByText(/secret credential/)).toBeNull(); expect(screen.queryByText('No processing route selected')).toBeNull();
    screen.getByRole('button', { name: 'Refresh environment' }).focus(); await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Anthropic')).toBeTruthy(); expect(h.forTask).toHaveBeenCalledTimes(2);
  });
  it('discards a late old Task response', async () => {
    const h = setup(); let release!: (value: unknown) => void;
    h.forTask.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    h.forTask.mockResolvedValue({ ok: true, value: facts({ taskId: 'new-task', inference: { ...facts().inference, provider: 'New provider' } }) });
    const rendered = render(<TaskEnvironment taskId={taskId} />); await waitFor(() => expect(release).toBeTypeOf('function'));
    rendered.rerender(<TaskEnvironment taskId="new-task" />); await screen.findByText('New provider');
    await act(async () => release({ ok: true, value: facts() })); expect(screen.queryByText('Anthropic')).toBeNull(); expect(screen.getByText('New provider')).toBeTruthy();
  });
  it('hides facts on invalidation and discards an older in-flight read', async () => {
    const h = setup(); render(<TaskEnvironment taskId={taskId} />); await screen.findByText('Anthropic'); let release!: (value: unknown) => void;
    h.forTask.mockImplementationOnce(() => new Promise(resolve => { release = resolve; })); act(() => h.change()); expect(screen.queryByText('Anthropic')).toBeNull();
    h.forTask.mockResolvedValueOnce({ ok: false, reason: 'private server error' }); act(() => h.change()); await screen.findByRole('status');
    await act(async () => release({ ok: true, value: facts() })); expect(screen.queryByText('Anthropic')).toBeNull(); expect(screen.queryByText('No processing route selected')).toBeNull();
  });
  it('rejects wrong-Task and malformed responses', async () => {
    const h = setup(facts({ taskId: 'another-task' })); render(<TaskEnvironment taskId={taskId} />); await screen.findByRole('status'); expect(screen.queryByText('Anthropic')).toBeNull();
    h.forTask.mockResolvedValueOnce({ ok: true, value: { ...facts(), executionLabel: 'Remote machine' } });
    await userEvent.click(screen.getByRole('button', { name: 'Refresh environment' })); await screen.findByRole('status'); expect(screen.queryByText('Remote machine')).toBeNull();
  });
  it('refresh preserves an unsaved Task title', async () => {
    const h = setup(); const task = { taskId, title: 'Saved title', workspaceId: taskId, engagementId: null, folderId: null, revision: 0, runtimeThreadId: null, sourceRefs: [] } as unknown as TaskItem;
    render(<TaskView task={task} engagements={[]} folders={[]} onRename={vi.fn()} onMove={vi.fn()} newOperationId={() => 'operation'} />);
    const input = screen.getByRole('textbox', { name: 'Task title' }); await userEvent.clear(input); await userEvent.type(input, 'Unsent draft');
    await screen.findByText('Anthropic'); act(() => h.change()); await waitFor(() => expect(h.forTask).toHaveBeenCalledTimes(2)); expect(input).toHaveProperty('value', 'Unsent draft');
  });
});
