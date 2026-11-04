// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.15, renderer, as amended by the owner on 2026-11-04 (Codex desktop
 * pattern): checks, review and the local markers are shown only once a record
 * exists, through StatusChip's custom-label path only; there is no "Not
 * recorded" placeholder and nothing reads as accepted or approved.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SOURCE_STATUSES, STATUS_TEXT } from '../src/renderer/primitives';
import { Shell } from '../src/renderer/Shell/Shell';
import { parseTaskStates, STATE_DIMENSIONS, STATE_TEXT, type StateDimension, type TaskStatesItem } from '../src/renderer/Shell/state-bridge';
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

describe('TaskStates (owner amendment 2026-11-04: recorded only)', () => {
  const RECORDED_ONLY = ['checks', 'review', 'approval_marker', 'delivery_marker'] as const;

  it('renders nothing, and no "Not recorded" placeholder, when only execution is recorded', () => {
    const { container } = render(<TaskStates states={states([{ dimension: 'run', value: 'execution_finished', actorKind: 'runtime', revision: 1 }, { dimension: 'task', value: 'running', revision: 2 }])} />);
    expect(container.innerHTML).toBe('');
    expect(document.body.textContent).not.toContain('Not recorded');
    expect(document.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained')).toHaveLength(0);
  });

  it('renders nothing for an empty or unread listing', () => {
    expect(render(<TaskStates states={states([])} />).container.innerHTML).toBe('');
    expect(render(<TaskStates states={null} />).container.innerHTML).toBe('');
  });

  it('checks complete is shown alone; it implies no review, approval or delivery', () => {
    render(<TaskStates states={states([{ dimension: 'checks', value: 'complete', revision: 1 }])} />);
    expect(chipOf('checks')!.textContent).toBe('Checks complete');
    expect([...document.querySelectorAll('[data-state-dimension]')].map((element) => element.getAttribute('data-state-dimension'))).toEqual(['checks']);
    expect(document.body.textContent).not.toContain('Not recorded');
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
    expect(document.querySelectorAll('.iq-status-chip--accepted, .iq-status-chip--explained')).toHaveLength(0);
  });

  it('every shown value goes through the custom-label path with its own text', () => {
    const sourceTexts = Object.values(STATUS_TEXT);
    for (const dimension of RECORDED_ONLY) {
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
    // Execution, Task and output dimensions are never listed here.
    for (const dimension of ['task', 'run', 'output'] as const) {
      for (const value of Object.keys(STATE_TEXT[dimension])) {
        const { container, unmount } = render(<TaskStates states={states([{ dimension, value, revision: 1 }])} />);
        expect(container.innerHTML).toBe('');
        unmount();
      }
    }
    expect(STATE_TEXT.delivery_marker).toEqual({
      attempted: 'Delivery attempted — local marker',
      confirmed: 'Delivery confirmed — local marker',
      uncertain: 'Delivery uncertain — local marker',
    });
  });

  it('lists a recorded dimension history latest first with versions and actors', () => {
    render(
      <TaskStates
        states={states([
          { dimension: 'review', value: 'requested', version: 1, actorKind: 'human', revision: 1 },
          { dimension: 'review', value: 'revision_requested', version: 2, actorKind: 'human', revision: 2 },
          { dimension: 'review', value: 'decision_recorded', version: 3, actorKind: 'human', revision: 3 },
        ])}
      />,
    );
    expect(chipOf('review')!.textContent).toBe('Review decision recorded');
    expect(row('review').textContent).toContain('Version 3, recorded by a person');
    const history = within(row('review')).getByRole('list', { name: 'Earlier Review states' });
    expect(within(history).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Revision requested (Version 2, recorded by a person)',
      'Review requested (Version 1, recorded by a person)',
    ]);
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

  it('reads states without exposing technical dimensions in ordinary conversation or recording one', async () => {
    const state = fakeMain(() => ({ ok: true, value: listing([{ dimension: 'run', value: 'execution_finished', revision: 1 }]) }));
    const user = userEvent.setup();
    render(<Shell onShowSpecimen={() => undefined} operationIds={() => '00000000-0000-4000-8000-000000000999'} />);
    await user.click(await screen.findByRole('link', { name: 'Bank confirmations' }));
    await waitFor(() => expect(state.list).toHaveBeenCalledWith({taskId:TASK}));
    expect(document.querySelector('[data-task-states]')).toBeNull();
    expect(state.list).toHaveBeenCalledWith({ taskId: TASK });
    expect(state.recordTaskState).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading',{name:'States'})).toBeNull();
    expect(document.querySelectorAll('[data-shell] .iq-status-chip--accepted, [data-shell] .iq-status-chip--explained')).toHaveLength(0);
  });

  it('shows a recorded review state in the conversation once it exists, and no placeholders', async () => {
    const state = fakeMain(() => ({ ok: true, value: listing([{ dimension: 'run', value: 'execution_finished', revision: 1 }, { dimension: 'review', value: 'requested', actorKind: 'human', revision: 2 }]) }));
    const user = userEvent.setup();
    render(<Shell onShowSpecimen={() => undefined} />);
    await user.click(await screen.findByRole('link', { name: 'Bank confirmations' }));
    await waitFor(() => expect(document.querySelector('[data-task-view] [data-task-states] [data-state-dimension="review"]')).not.toBeNull());
    expect([...document.querySelectorAll('[data-state-dimension]')].map((element) => element.getAttribute('data-state-dimension'))).toEqual(['review']);
    expect(document.body.textContent).not.toContain('Not recorded');
    expect(screen.queryByText('Execution finished')).toBeNull();
    expect(state.recordTaskState).not.toHaveBeenCalled();
  });

  it('does not expose partial or fabricated state chrome after a malformed listing', async () => {
    const state=fakeMain(() => ({ ok: true, value: { taskId: TASK, revision: 1, dimensions: [{ dimension: 'run', records: [{ value: 'done' }] }] } }));
    const user = userEvent.setup();
    render(<Shell onShowSpecimen={() => undefined} />);
    await user.click(await screen.findByRole('link', { name: 'Bank confirmations' }));
    await waitFor(()=>expect(state.list).toHaveBeenCalledWith({taskId:TASK}));
    expect(document.querySelector('[data-task-states]')).toBeNull();
    expect(state.recordTaskState).not.toHaveBeenCalled();
    expect(screen.queryByText('Execution finished')).toBeNull();
  });
});
