// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.15, renderer: the open Task's States section. Every dimension is
 * listed separately with its value or "Not recorded", through StatusChip's
 * custom-label path only; nothing reads as accepted or approved.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SOURCE_STATUSES, STATUS_TEXT } from '../src/renderer/primitives';
import { Shell } from '../src/renderer/Shell/Shell';
import { NOT_RECORDED, parseTaskStates, STATE_DIMENSIONS, STATE_TEXT, type StateDimension, type TaskStatesItem } from '../src/renderer/Shell/state-bridge';
import { TaskStates } from '../src/renderer/Shell/TaskStates';

const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

type Wire = { dimension: StateDimension; value: string; version?: number; actorKind?: 'human' | 'runtime' | 'system'; revision: number };

function wire({ dimension, value, version = 1, actorKind = 'system', revision }: Wire) {
  return {
    dimension,
    scopeKind: dimension === 'task' ? 'task' : dimension === 'run' ? 'run' : 'output',
    scopeId: dimension === 'task' ? TASK : `${dimension}-1`,
    value,
    version,
    actorKind,
    actorRef: 'inquello-desktop',
    recordedAt: 1_761_700_000_000,
    revision,
  };
}

/** A listing as main returns it, latest first per dimension. */
function listing(records: Wire[]) {
  const revision = Math.max(0, ...records.map((record) => record.revision));
  return {
    taskId: TASK,
    revision,
    dimensions: STATE_DIMENSIONS.map((dimension) => ({
      dimension,
      records: records
        .filter((record) => record.dimension === dimension)
        .sort((a, b) => b.revision - a.revision)
        .map(wire),
    })),
  };
}

function states(records: Wire[]): TaskStatesItem {
  const parsed = parseTaskStates(listing(records));
  if (!parsed) throw new Error('the listing did not parse');
  return parsed;
}

const row = (dimension: StateDimension) => document.querySelector<HTMLElement>(`[data-state-dimension="${dimension}"]`)!;
const chipOf = (dimension: StateDimension) => row(dimension).querySelector<HTMLElement>('.iq-status-chip');

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

describe('TaskStates', () => {
  it('a finished run reads "Execution finished" in the neutral style; everything else is not recorded', () => {
    render(<TaskStates states={states([{ dimension: 'run', value: 'execution_finished', actorKind: 'runtime', revision: 1 }])} />);
    expect([...document.querySelectorAll('[data-state-dimension]')].map((element) => element.getAttribute('data-state-dimension'))).toEqual([...STATE_DIMENSIONS]);
    const chip = chipOf('run')!;
    expect(chip.textContent).toBe('Execution finished');
    expect(chip.className).toBe('iq-status-chip iq-status-chip--other');
    expect(row('run').textContent).toContain('recorded by the runtime');
    for (const dimension of STATE_DIMENSIONS.filter((name) => name !== 'run')) {
      expect(row(dimension).dataset.stateValue).toBe('not-recorded');
      expect(within(row(dimension)).getByText(NOT_RECORDED)).toBeTruthy();
      expect(chipOf(dimension)).toBeNull();
    }
    expect(document.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/accept|approved|\bdone\b/i);
  });

  it('checks complete implies no review, approval or delivery', () => {
    render(<TaskStates states={states([{ dimension: 'checks', value: 'complete', revision: 1 }])} />);
    expect(chipOf('checks')!.textContent).toBe('Checks complete');
    for (const dimension of ['review', 'approval_marker', 'delivery_marker'] as const) expect(row(dimension).dataset.stateValue).toBe('not-recorded');
  });

  it('labels review and the local markers truthfully, never as sign-off', () => {
    render(
      <TaskStates
        states={states([
          { dimension: 'review', value: 'requested', actorKind: 'human', revision: 1 },
          { dimension: 'approval_marker', value: 'noted_locally', actorKind: 'human', revision: 2 },
          { dimension: 'delivery_marker', value: 'uncertain', actorKind: 'human', revision: 3 },
        ])}
      />,
    );
    expect(chipOf('review')!.textContent).toBe('Review requested');
    expect(chipOf('approval_marker')!.textContent).toBe('Approval noted locally — not an authoritative record');
    expect(chipOf('delivery_marker')!.textContent).toBe('Delivery uncertain — local marker');
    expect(row('review').textContent).toContain('recorded by a person');
    for (const dimension of ['review', 'approval_marker', 'delivery_marker'] as const) expect(chipOf(dimension)!.className).toContain('iq-status-chip--other');
  });

  it('every value of every dimension goes through the custom-label path with its own text', () => {
    const sourceTexts = Object.values(STATUS_TEXT);
    for (const dimension of STATE_DIMENSIONS) {
      for (const [value, text] of Object.entries(STATE_TEXT[dimension])) {
        const { unmount } = render(<TaskStates states={states([{ dimension, value, revision: 1 }])} />);
        const chip = chipOf(dimension)!;
        expect(chip.textContent).toBe(text);
        expect(chip.className).toBe('iq-status-chip iq-status-chip--other');
        expect(SOURCE_STATUSES as readonly string[]).not.toContain(chip.dataset.status);
        expect(sourceTexts).not.toContain(text);
        unmount();
      }
    }
    expect(STATE_TEXT.delivery_marker).toEqual({
      attempted: 'Delivery attempted — local marker',
      confirmed: 'Delivery confirmed — local marker',
      uncertain: 'Delivery uncertain — local marker',
    });
  });

  it('lists a dimension history latest first with versions and actors', () => {
    render(
      <TaskStates
        states={states([
          { dimension: 'task', value: 'planned', version: 1, revision: 1 },
          { dimension: 'task', value: 'running', version: 2, actorKind: 'runtime', revision: 2 },
          { dimension: 'task', value: 'interrupted', version: 3, revision: 3 },
        ])}
      />,
    );
    expect(chipOf('task')!.textContent).toBe('Interrupted');
    expect(row('task').textContent).toContain('Version 3, recorded by Inquello on this device');
    const history = within(row('task')).getByRole('list', { name: 'Earlier Task states' });
    expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Running (Version 2, recorded by the runtime)',
      'Planned (Version 1, recorded by Inquello on this device)',
    ]);
  });

  it('shows why the states could not be read', () => {
    render(<TaskStates states={null} notice="States could not be read. That item is not available." />);
    expect(screen.getByRole('status').textContent).toContain('States could not be read');
    for (const dimension of STATE_DIMENSIONS) expect(row(dimension).dataset.stateValue).toBe('not-recorded');
  });
});

describe('parseTaskStates', () => {
  it('rejects a value outside its dimension, an unknown dimension and a misfiled record', () => {
    const good = listing([{ dimension: 'run', value: 'execution_finished', revision: 1 }]);
    expect(parseTaskStates(good)).not.toBeNull();
    const withRecord = (records: unknown[], dimension = 'run') => ({ ...good, dimensions: [{ dimension, records }] });
    expect(parseTaskStates(withRecord([{ ...wire({ dimension: 'run', value: 'done', revision: 1 }) }]))).toBeNull();
    expect(parseTaskStates(withRecord([{ ...wire({ dimension: 'run', value: 'accepted', revision: 1 }) }]))).toBeNull();
    expect(parseTaskStates(withRecord([], 'approval'))).toBeNull();
    expect(parseTaskStates(withRecord([wire({ dimension: 'task', value: 'planned', revision: 1 })], 'run'))).toBeNull();
    expect(parseTaskStates(withRecord([{ ...wire({ dimension: 'run', value: 'running', revision: 1 }), actorKind: 'model' }]))).toBeNull();
    // Missing dimensions are not recorded, never defaulted.
    expect(parseTaskStates({ ...good, dimensions: [] })!.dimensions.every((entry) => entry.records.length === 0)).toBe(true);
  });
});

describe('Shell with Task states', () => {
  function fakeMain(list: (request: { taskId: string }) => unknown) {
    const task = { taskId: TASK, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Bank confirmations', runtimeThreadId: null, sourceRefs: [], artifactRefs: [], visibility: 'private', revision: 1 };
    const organise = {
      getWorkspaces: vi.fn(async () => ({ signedIn: true, sharedService: 'available', workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', source: 'service' }], engagementCreation: { enabled: true } })),
      getTree: vi.fn(async () => ({ ok: true, value: { workspaceId: WORKSPACE, engagements: [], folders: [], tasks: [task] } })),
    };
    const state = { list: vi.fn(async (request: { taskId: string }) => list(request)), recordTaskState: vi.fn() };
    (globalThis as { inquello?: unknown }).inquello = Object.freeze({ organise: Object.freeze(organise), state: Object.freeze(state) });
    return state;
  }

  it('reads the open Task states through state.list and never records one', async () => {
    const state = fakeMain(() => ({ ok: true, value: listing([{ dimension: 'run', value: 'execution_finished', revision: 1 }]) }));
    const user = userEvent.setup();
    render(<Shell onShowSpecimen={() => undefined} operationIds={() => '00000000-0000-4000-8000-000000000999'} />);
    await user.click(await screen.findByRole('link', { name: 'Bank confirmations' }));
    await waitFor(() => expect(chipOf('run')?.textContent).toBe('Execution finished'));
    expect(state.list).toHaveBeenCalledWith({ taskId: TASK });
    expect(state.recordTaskState).not.toHaveBeenCalled();
    expect(within(document.querySelector<HTMLElement>('[data-task-states]')!).getByRole('heading', { name: 'States' })).toBeTruthy();
    expect(document.querySelectorAll('[data-shell] .iq-status-chip--accepted, [data-shell] .iq-status-chip--explained')).toHaveLength(0);
  });

  it('shows a refused or malformed listing as unread, not half-read', async () => {
    fakeMain(() => ({ ok: true, value: { taskId: TASK, revision: 1, dimensions: [{ dimension: 'run', records: [{ value: 'done' }] }] } }));
    const user = userEvent.setup();
    render(<Shell onShowSpecimen={() => undefined} />);
    await user.click(await screen.findByRole('link', { name: 'Bank confirmations' }));
    await screen.findByText(/States could not be read/);
    expect(row('run').dataset.stateValue).toBe('not-recorded');
  });
});
