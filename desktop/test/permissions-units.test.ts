/**
 * Story 1.20 in main, without a runtime: the ApprovalCard view of a pending
 * request, the forbid text, the mediator's wait, decision and
 * decline-by-default, the payload validators, the escalation route and the
 * RPC connection's late answers.
 */
import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import {
  ALTERNATIVE_LABEL,
  decidePermissionPayload,
  EscalationGate,
  forbiddenText,
  NO_LONGER_PENDING,
  PermissionMediator,
  permissionCardView,
  primaryLabelFor,
  setUserRulesPayload,
} from '../src/main/policy';
import { RpcConnection } from '../src/main/runtime/rpc';
import type { InquelloCommandEvaluation } from '../src/protocol/generated/v2/InquelloCommandEvaluation';
import type { InquelloPermissionRequest } from '../src/protocol/generated/v2/InquelloPermissionRequest';
import { recordingLogger } from './helpers';

const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const REQUEST = '4a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

function evaluation(overrides: Partial<InquelloCommandEvaluation> = {}): InquelloCommandEvaluation {
  return {
    decision: 'prompt',
    controllingRule: { prefix: ['git', 'push'], decision: 'prompt', note: null },
    source: { kind: 'user_rule', revision: 2, behaviour: null, label: 'your rule' },
    cannotAsk: false,
    command: ['git', 'push', 'origin', 'main'],
    commandText: 'git push origin main',
    analysis: "Runs `git push origin main` in this Task's working folder, with no network access.",
    destination: "This Task's working folder and Output folder; no network destination",
    consequence: 'It can create, change or delete files in this Task\'s working folder and Output folder, and Inquello cannot undo those changes. Nothing outside them changes. Allowing it runs this one request once and adds no rule.',
    ruleText: '`git push` (prompt), from your rule',
    ...overrides,
  };
}

function request(overrides: Partial<InquelloPermissionRequest> = {}): InquelloPermissionRequest {
  return {
    requestId: REQUEST,
    taskId: TASK,
    workspaceId: '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e',
    origin: 'tools_exec',
    label: 'Permission to act',
    evaluation: evaluation(),
    createdAt: 1,
    expiresAt: 600_001,
    status: 'pending',
    revision: 1,
    decision: null,
    used: false,
    ...overrides,
  };
}

describe('the ApprovalCard view of a pending request', () => {
  it('quotes the exact command, names the action and offers only permitted alternatives', () => {
    const card = permissionCardView(request());
    expect(card).toMatchObject({
      label: 'Permission to act',
      quote: 'git push origin main',
      primaryLabel: 'Run `git push origin main`',
      rule: '`git push` (prompt), from your rule',
      rulePrefix: ['git', 'push'],
    });
    expect(card.alternatives.map((entry) => entry.label)).toEqual(['Deny', 'Deny and add a rule to always ask', 'Deny and forbid this prefix']);
    const words = JSON.stringify(card);
    expect(words).not.toMatch(/approve|always allow|professional|review/i);
    // With no controlling rule, a new rule takes the exact command.
    expect(permissionCardView(request({ evaluation: evaluation({ controllingRule: null, source: { kind: 'approval_behaviour', revision: null, behaviour: 'untrusted', label: 'x' } }) })).rulePrefix).toEqual(['git', 'push', 'origin', 'main']);
    // A forbidden decision never becomes a card.
    expect(() => permissionCardView(request({ evaluation: evaluation({ decision: 'forbid' }) }))).toThrow();
  });

  it('shortens a long command inside the button but never in the quote', () => {
    const long = `echo ${'x'.repeat(300)}`;
    expect(primaryLabelFor(long).length).toBeLessThan(170);
    expect(primaryLabelFor(long).startsWith('Run `echo ')).toBe(true);
    expect(permissionCardView(request({ evaluation: evaluation({ commandText: long }) })).quote).toBe(long);
  });

  it('names the rule and its source when a command is forbidden', () => {
    expect(forbiddenText(evaluation({ decision: 'forbid', ruleText: '`rm` (forbid), from your rule', commandText: 'rm -rf x' }))).toBe('Refused: `rm -rf x` is forbidden. Rule: `rm` (forbid), from your rule.');
    expect(forbiddenText(evaluation({ decision: 'forbid', cannotAsk: true }))).toContain("No prompt mode never asks");
    expect(ALTERNATIVE_LABEL.deny).toBe('Deny');
  });
});

function fakeRuntime(answers: Record<string, (params: Record<string, unknown>) => unknown>) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    request: async <T,>(method: string, params?: unknown): Promise<T> => {
      calls.push({ method, params: params as Record<string, unknown> });
      const answer = answers[method];
      if (!answer) throw new Error(`unexpected ${method}`);
      return answer(params as Record<string, unknown>) as T;
    },
  };
}

const refusal = (kind: string) => Object.assign(new Error(kind), { data: { inquello: { kind } } });

describe('the permission mediator', () => {
  const policy = { workspaceId: '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e', policyRevision: 1, authorizationEpoch: 1, execution: null };
  let ids = 0;
  const newId = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`;

  it('waits for the person and wakes with the recorded decision', async () => {
    const runtime = fakeRuntime({
      'inquello/permissions/request': () => ({ request: request(), receipt: {} }),
      'inquello/permissions/decide': (params) => ({ request: request({ decision: { outcome: params.outcome as string, actorKind: 'human', actorRef: 'me', decidedAt: 2, label: null } }) }),
    });
    const timers: Array<() => void> = [];
    const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId, setTimer: (callback) => timers.push(callback), clearTimer: () => undefined });
    const asked = mediator.ask({ workspacePolicy: policy, taskId: TASK, command: ['git', 'push', 'origin', 'main'], origin: 'tools_exec' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mediator.waiting(REQUEST)).toBe(true);
    expect(runtime.calls[0]).toMatchObject({ method: 'inquello/permissions/request', params: { taskId: TASK, origin: 'tools_exec', ttlMs: 600_000, command: ['git', 'push', 'origin', 'main'] } });
    const decided = await mediator.decide(REQUEST, 'allowed', newId());
    expect(decided).toMatchObject({ ok: true, outcome: 'allowed', rulePrefix: ['git', 'push'] });
    expect(runtime.calls[1]).toMatchObject({ method: 'inquello/permissions/decide', params: { outcome: 'allowed', actorKind: 'human', actorRef: null, expectedRevision: 1 } });
    await expect(asked).resolves.toEqual({ ok: true, requestId: REQUEST, outcome: 'allowed' });
  });

  it('declines by default when no one decides in time, recorded by the host', async () => {
    const runtime = fakeRuntime({
      'inquello/permissions/request': () => ({ request: request(), receipt: {} }),
      'inquello/permissions/decide': () => ({ request: request({ decision: { outcome: 'expired', actorKind: 'system', actorRef: 'inquello-desktop', decidedAt: 2, label: null } }) }),
    });
    const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId, ttlMs: 5 });
    const asked = await mediator.ask({ workspacePolicy: policy, taskId: TASK, command: ['git', 'push'], origin: 'tools_exec' });
    expect(asked).toEqual({ ok: true, requestId: REQUEST, outcome: 'expired' });
    expect(runtime.calls[1]).toMatchObject({ method: 'inquello/permissions/decide', params: { outcome: 'expired', actorKind: 'system', actorRef: 'inquello-desktop' } });
  });

  it('reports a stale request as no longer pending and never runs it', async () => {
    const runtime = fakeRuntime({
      'inquello/permissions/request': () => ({ request: request(), receipt: {} }),
      'inquello/permissions/decide': () => {
        throw refusal('request_not_pending');
      },
    });
    const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId, setTimer: () => 0, clearTimer: () => undefined });
    const asked = mediator.ask({ workspacePolicy: policy, taskId: TASK, command: ['git', 'push'], origin: 'tools_exec' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const decided = await mediator.decide(REQUEST, 'allowed', newId());
    expect(decided.ok).toBe(false);
    await expect(asked).resolves.toMatchObject({ outcome: 'denied' });
    expect(NO_LONGER_PENDING).toBe('This request is no longer pending');
  });

  it('passes a refusal through without waiting (a forbidden command has no request)', async () => {
    const runtime = fakeRuntime({
      'inquello/permissions/request': () => {
        throw refusal('command_forbidden');
      },
    });
    const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId });
    const asked = await mediator.ask({ workspacePolicy: policy, taskId: TASK, command: ['rm'], origin: 'tools_exec' });
    expect(asked.ok).toBe(false);
  });

  it('lists only pending requests as cards, and declines every waiter on demand', async () => {
    const runtime = fakeRuntime({
      'inquello/permissions/pending': () => ({ requests: [request(), request({ requestId: 'x', status: 'expired' })] }),
      'inquello/permissions/request': () => ({ request: request(), receipt: {} }),
    });
    const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId, setTimer: () => 0, clearTimer: () => undefined });
    expect((await mediator.pending(TASK)).map((card) => card.requestId)).toEqual([REQUEST]);
    const asked = mediator.ask({ workspacePolicy: policy, taskId: TASK, command: ['git', 'push'], origin: 'runtime' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    mediator.declineAll();
    await expect(asked).resolves.toMatchObject({ outcome: 'denied' });
  });
});

describe('permission payloads', () => {
  const operationId = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
  it('accepts a request and a choice only', () => {
    expect(decidePermissionPayload([{ operationId, requestId: REQUEST, choice: 'deny-forbid' }])).toEqual({ operationId, requestId: REQUEST, choice: 'deny-forbid' });
    for (const bad of [{ operationId, requestId: REQUEST, choice: 'allow-always' }, { operationId, requestId: REQUEST }, { operationId, requestId: REQUEST, choice: 'run', actor: 'me' }]) {
      expect(() => decidePermissionPayload([bad])).toThrow();
    }
  });

  it('checks the shape of the person\'s rules and leaves the allow refusal to the runtime', () => {
    expect(setUserRulesPayload([{ operationId, expectedRevision: 3, rules: [{ prefix: ['curl'], decision: 'allow', note: null }] }]).rules[0]!.decision).toBe('allow');
    for (const rules of [[{ prefix: [], decision: 'forbid', note: null }], [{ prefix: [''], decision: 'forbid', note: null }], [{ prefix: ['x'], decision: 'forbid' }], 'none']) {
      expect(() => setUserRulesPayload([{ operationId, expectedRevision: 0, rules }])).toThrow();
    }
  });
});

describe('the escalation route (the path Story 1.25 uses)', () => {
  it('answers a routed command escalation only after the person decides', async () => {
    let decide: (outcome: 'allowed' | 'denied' | 'expired') => void = () => undefined;
    const asked: string[][] = [];
    const gate = new EscalationGate({
      newId: () => 'id',
      routeFor: (threadId) =>
        threadId === 'thread-1'
          ? {
              ask: (command) => {
                asked.push([...command]);
                return new Promise((resolve) => (decide = resolve));
              },
            }
          : null,
    });
    const answer = gate.answer('item/commandExecution/requestApproval', { threadId: 'thread-1', command: 'git push origin main' });
    expect(answer).toBeInstanceOf(Promise);
    expect(gate.pending()[0]!.status).toBe('pending');
    decide('allowed');
    await expect(answer).resolves.toEqual({ decision: 'accept' });
    expect(asked).toEqual([['git', 'push', 'origin', 'main']]);
    expect(gate.pending()[0]!.status).toBe('allowed');
    const denied = gate.answer('execCommandApproval', { conversationId: 'thread-1', command: ['git', 'push'] });
    decide('denied');
    await expect(denied).resolves.toMatchObject({ decision: { denied: {} } });
    // Without a route (no Task known), it is declined at once, as in Story 1.19.
    expect(gate.answer('item/commandExecution/requestApproval', { threadId: 'other', command: 'ls' })).toEqual({ decision: 'decline' });
  });
});

describe('late answers to server requests', () => {
  it('sends a promised answer once it resolves', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const written: string[] = [];
    output.on('data', (chunk: Buffer) => written.push(chunk.toString()));
    let release: (value: unknown) => void = () => undefined;
    const connection = new RpcConnection(input, output, {
      logger: recordingLogger(),
      onServerRequest: () => new Promise((resolve) => (release = resolve)),
      onFatal: () => undefined,
    });
    void connection;
    input.write(`${JSON.stringify({ id: 7, method: 'item/commandExecution/requestApproval', params: {} })}\n`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(written.join('')).toBe('');
    release({ decision: 'decline' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(JSON.parse(written.join('').trim())).toEqual({ id: 7, result: { decision: 'decline' } });
  });
});
