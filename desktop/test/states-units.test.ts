/**
 * Story 1.15, main process: Task states through the organise service with a
 * fake runtime, the `state.*` payload validators, and the smoke evaluation.
 */
import { describe, expect, it } from 'vitest';

import { evaluateStates, isGreenish, type StatesProbeRead } from '../src/main/smoke-probe';
import {
  DESKTOP_STATE_ACTOR,
  ORGANISE_REASONS,
  OrganiseService,
  recordTaskStatePayload,
  stateListPayload,
  type OrganiseIdentity,
  type OrganiseRuntime,
  type WorkspaceRoutes,
} from '../src/main/organise';
import { RpcResponseError } from '../src/main/runtime';
import { OPERATION_NAMES } from '../src/main/security/operations';
import { recordingLogger } from './helpers';

const PRINCIPAL = '11111111-1111-4111-8111-111111111111';
const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const OP = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

const record = (dimension: string, value: string, revision: number, version = 1) => ({
  dimension,
  scopeKind: dimension === 'run' ? 'run' : 'task',
  scopeId: dimension === 'run' ? 'run-1' : TASK,
  value,
  version,
  actorKind: 'system',
  actorRef: DESKTOP_STATE_ACTOR,
  recordedAt: 1_761_700_000_000,
  revision,
});

function harness(handler: (method: string, params: unknown) => unknown) {
  const calls: Array<{ method: string; params: unknown }> = [];
  const identity = { principal: PRINCIPAL as string | null };
  const runtime: OrganiseRuntime = {
    ready: () => true,
    instance: () => runtime,
    request: async <T,>(method: string, params?: unknown) => {
      calls.push({ method, params });
      if (method === 'inquello/session/setPrincipal') return { principalId: PRINCIPAL } as T;
      return handler(method, params) as T;
    },
  };
  const organiseIdentity: OrganiseIdentity = {
    principalId: () => identity.principal,
    snapshot: () => ({ sharedService: 'available' }),
    withAccess: async fn => fn('synthetic-fixture-access'),
  };
  const service = new OrganiseService({ runtime, identity: organiseIdentity, service: {workspaces:async()=>({principal_id:PRINCIPAL,workspaces:[]})} as unknown as WorkspaceRoutes, logger: recordingLogger() });
  return { service, calls, identity };
}

describe('Task states in main', () => {
  it('lists all seven dimensions in order, rebuilt field by field', async () => {
    const h = harness(() => ({
      taskId: TASK,
      revision: 2,
      dimensions: [
        { dimension: 'run', records: [{ ...record('run', 'execution_finished', 2), extra: 'dropped' }] },
        { dimension: 'task', records: [record('task', 'planned', 1)] },
      ],
    }));
    const listed = await h.service.listStates(TASK);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.dimensions.map((entry) => entry.dimension)).toEqual(['task', 'run', 'output', 'checks', 'review', 'approval_marker', 'delivery_marker']);
    expect(listed.value.dimensions[1]!.records).toEqual([record('run', 'execution_finished', 2)]);
    expect(listed.value.dimensions.slice(2).every((entry) => entry.records.length === 0)).toBe(true);
    expect(h.calls.at(-1)).toEqual({ method: 'inquello/state/list', params: { taskId: TASK } });
  });

  it('records Task and run states as this desktop, scoped by main', async () => {
    const h = harness((_method, params) => ({ taskId: TASK, record: record((params as { dimension: string }).dimension, 'running', 1), receipt: {} }));
    await h.service.recordTaskState({ operationId: OP, taskId: TASK, expectedRevision: 0, dimension: 'task', value: 'planned', runId: null });
    await h.service.recordTaskState({ operationId: OP, taskId: TASK, expectedRevision: 1, dimension: 'run', value: 'execution_finished', runId: 'run-1' });
    const sent = h.calls.filter((call) => call.method === 'inquello/state/record').map((call) => call.params);
    expect(sent).toEqual([
      { operationId: OP, expectedRevision: 0, taskId: TASK, dimension: 'task', scopeKind: 'task', scopeId: TASK, value: 'planned', actorKind: 'system', actorRef: DESKTOP_STATE_ACTOR },
      { operationId: OP, expectedRevision: 1, taskId: TASK, dimension: 'run', scopeKind: 'run', scopeId: 'run-1', value: 'execution_finished', actorKind: 'system', actorRef: DESKTOP_STATE_ACTOR },
    ]);
  });

  it('refuses any other dimension before the runtime is reached', async () => {
    const h = harness(() => {
      throw new Error('the runtime must not be called');
    });
    const result = await h.service.recordTaskState({ operationId: OP, taskId: TASK, expectedRevision: 0, dimension: 'review' as 'task', value: 'requested', runId: null });
    expect(result).toEqual({ ok: false, code: 'dimension-not-enabled', reason: ORGANISE_REASONS.dimensionNotEnabled });
    expect(h.calls.filter((call) => call.method === 'inquello/state/record')).toEqual([]);
  });

  it.each([
    ['human_actor_required', 'human-actor-required', ORGANISE_REASONS.humanActorRequired],
    ['dimension_not_enabled', 'dimension-not-enabled', ORGANISE_REASONS.dimensionNotEnabled],
    ['invalid_value', 'invalid-value', ORGANISE_REASONS.invalidValue],
    ['not_found', 'not-found', ORGANISE_REASONS.notFound],
  ])('maps the runtime refusal %s to a fixed reason', async (kind, code, reason) => {
    const h = harness((method) => {
      throw new RpcResponseError(method, -32600, kind, { inquello: { kind } });
    });
    expect(await h.service.recordTaskState({ operationId: OP, taskId: TASK, expectedRevision: 0, dimension: 'run', value: 'done', runId: 'run-1' })).toEqual({ ok: false, code, reason });
  });

  it('keeps the actual revision of a stale write', async () => {
    const h = harness((method) => {
      throw new RpcResponseError(method, -32600, 'conflict', { inquello: { kind: 'revision_conflict', expected: 0, actual: 3 } });
    });
    expect(await h.service.recordTaskState({ operationId: OP, taskId: TASK, expectedRevision: 0, dimension: 'task', value: 'running', runId: null })).toEqual({
      ok: false,
      code: 'conflict',
      reason: ORGANISE_REASONS.conflict,
      actualRevision: 3,
    });
  });

  it('refuses everything while signed out', async () => {
    const h = harness(() => ({}));
    h.identity.principal = null;
    expect(await h.service.listStates(TASK)).toMatchObject({ ok: false, code: 'signed-out' });
    expect(h.calls).toEqual([]);
  });
});

describe('state payloads', () => {
  const base = { operationId: OP, taskId: TASK, expectedRevision: 0, dimension: 'task', value: 'planned', runId: null };

  it('accept a Task or run state with exactly the declared keys', () => {
    expect(stateListPayload([{ taskId: TASK }])).toEqual({ taskId: TASK });
    expect(recordTaskStatePayload([base])).toEqual(base);
    expect(recordTaskStatePayload([{ ...base, dimension: 'run', value: 'execution_finished', runId: 'run-1' }])).toMatchObject({ runId: 'run-1' });
  });

  it('reject other dimensions, an actor, a scope, a principal and malformed fields', () => {
    for (const dimension of ['review', 'approval_marker', 'delivery_marker', 'checks', 'output', 'done']) {
      expect(() => recordTaskStatePayload([{ ...base, dimension }])).toThrow(/task or run/);
    }
    expect(() => recordTaskStatePayload([{ ...base, actorKind: 'human' }])).toThrow(/unknown key actorKind/);
    expect(() => recordTaskStatePayload([{ ...base, scopeKind: 'output' }])).toThrow(/unknown key scopeKind/);
    expect(() => recordTaskStatePayload([{ ...base, principalId: PRINCIPAL }])).toThrow(/unknown key principalId/);
    expect(() => recordTaskStatePayload([{ ...base, runId: 'run-1' }])).toThrow(/no runId/);
    expect(() => recordTaskStatePayload([{ ...base, dimension: 'run', runId: null }])).toThrow(/runId/);
    expect(() => recordTaskStatePayload([{ ...base, dimension: 'run', runId: 'run 1' }])).toThrow(/runId/);
    expect(() => recordTaskStatePayload([{ ...base, expectedRevision: -1 }])).toThrow(/expectedRevision/);
    expect(() => recordTaskStatePayload([{ ...base, value: '' }])).toThrow(/value/);
    expect(() => recordTaskStatePayload([{ ...base, taskId: '/tmp/x' }])).toThrow(/taskId must be a UUID/);
    const { runId: _runId, ...missing } = base;
    expect(() => recordTaskStatePayload([missing])).toThrow(/missing key runId/);
    expect(() => stateListPayload([{ taskId: TASK, workspaceId: TASK }])).toThrow(/unknown key/);
    expect(() => stateListPayload([{ taskId: TASK }, {}])).toThrow(/one argument/);
  });

  it('are registered as named operations', () => {
    expect(OPERATION_NAMES.filter((name) => name.startsWith('state.'))).toEqual(['state.list', 'state.recordTaskState']);
  });
});

describe('states smoke evaluation', () => {
  const dimension = (name: string, value: string, text: string) => ({ dimension: name, value, text });
  const passing: StatesProbeRead = {
    configured: true,
    seedRead: true,
    signedIn: true,
    taskCreated: true,
    record: { writes: [{ ok: true }, { ok: true }, { ok: true }], reviewWrite: 'invalid payload for state.recordTaskState' },
    runtimeReviewRefusal: 'human_actor_required',
    view: {
      shellOpened: true,
      opened: true,
      shown: true,
      dimensions: [
        dimension('task', 'running', 'RunningVersion 2, recorded by Inquello on this devicePlanned (Version 1, recorded by Inquello on this device)'),
        dimension('run', 'execution_finished', 'Execution finishedVersion 1, recorded by Inquello on this device'),
        ...['output', 'checks', 'review', 'approval_marker', 'delivery_marker'].map((name) => dimension(name, 'not-recorded', 'Not recorded')),
      ],
      runChip: {
        text: 'Execution finished',
        className: 'iq-status-chip iq-status-chip--other',
        color: 'rgb(31, 41, 55)',
        background: 'rgb(255, 255, 255)',
        border: 'rgb(156, 163, 175)',
        acceptedColor: 'rgb(22, 101, 52)',
        acceptedBackground: 'rgb(220, 252, 231)',
        acceptedBorder: 'rgb(134, 239, 172)',
      },
      acceptedChips: 0,
      acceptanceText: false,
      toasts: [],
    },
    listed: { revision: 3, task: ['running', 'planned'], run: ['execution_finished'], others: 0 },
    otherPrincipalRefusal: 'not_found',
    signedOutAtEnd: true,
  };

  it('passes the expected read', () => {
    expect(evaluateStates(passing)).toMatchObject({ ok: true, failures: [] });
  });

  it.each<[string, Partial<StatesProbeRead>]>([
    ['the run chip is accepted', { view: { ...passing.view!, runChip: { ...passing.view!.runChip!, className: 'iq-status-chip iq-status-chip--accepted', color: 'rgb(22, 101, 52)' } } }],
    ['the run chip is green', { view: { ...passing.view!, runChip: { ...passing.view!.runChip!, background: 'rgb(200, 250, 200)' } } }],
    ['an accepted chip is shown', { view: { ...passing.view!, acceptedChips: 1 } }],
    ['the shell claims acceptance', { view: { ...passing.view!, acceptanceText: true } }],
    ['review recorded through the renderer', { record: { ...passing.record!, reviewWrite: 'accepted' } }],
    ['review reached the runtime', { runtimeReviewRefusal: null }],
    ['another principal saw the states', { otherPrincipalRefusal: null }],
    ['checks shows a value', { view: { ...passing.view!, dimensions: passing.view!.dimensions.map((row) => (row.dimension === 'checks' ? { ...row, value: 'complete', text: 'Checks complete' } : row)) } }],
  ])('fails when %s', (_label, change) => {
    expect(evaluateStates({ ...passing, ...change }).ok).toBe(false);
  });

  it('passes signed out only when listing and a review write are refused', () => {
    expect(evaluateStates({ configured: false, signedOut: { list: { ok: false, code: 'signed-out' }, reviewWrite: 'invalid payload for state.recordTaskState' } }).ok).toBe(true);
    expect(evaluateStates({ configured: false, signedOut: { list: { ok: true }, reviewWrite: 'invalid payload' } }).ok).toBe(false);
  });

  it('recognises green-dominant colours only', () => {
    expect(isGreenish('rgb(22, 101, 52)')).toBe(true);
    expect(isGreenish('rgb(255, 255, 255)')).toBe(false);
    expect(isGreenish('rgba(0, 200, 0, 0)')).toBe(false);
  });
});
