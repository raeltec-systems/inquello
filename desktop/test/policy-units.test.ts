/**
 * Story 1.18, main process: the effective managed policy through the policy
 * service with a fake runtime and a fake shared service, the plain-word
 * views, the `policy.*` payload validators and the single thread-settings
 * path.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { ServiceError } from '../src/main/identity/service-client';
import type { ExecutionPolicyView } from '../src/main/identity/wire';
import type { OrganiseIdentity, OrganiseRuntime, WorkspacesView } from '../src/main/organise';
import {
  PermissionMediator,
  BROAD_MODE_REACH,
  DEFAULT_CAPABILITIES,
  DEVICE_NONE,
  POLICY_REASONS,
  PolicyService,
  policyView,
  setBroadModePayload,
  taskPolicyPayload,
  taskPolicyView,
  type ExecutionPolicyRoutes,
} from '../src/main/policy';
import { RpcResponseError } from '../src/main/runtime';
import type { InquelloPolicyEffectiveResponse } from '../src/protocol/generated/v2/InquelloPolicyEffectiveResponse';
import type { InquelloTaskPolicy } from '../src/protocol/generated/v2/InquelloTaskPolicy';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(removeTempDirs);

const PRINCIPAL = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const OP = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

type Source = { kind: string; revision: number | null };
const DEFAULT: Source = { kind: 'inquello_default', revision: null };

function response(overrides: Partial<Record<string, { value: string; source?: Source; restricted?: boolean }>> = {}, device = { configured: false, sandboxModes: null as string[] | null, approvals: null as string[] | null }): InquelloPolicyEffectiveResponse {
  const base: Record<string, { value: string; source: Source; restricted: boolean }> = {
    sandbox: { value: 'workspace_write', source: DEFAULT, restricted: true },
    approval: { value: 'on_request', source: DEFAULT, restricted: false },
    network: { value: 'denied', source: DEFAULT, restricted: true },
    mcp_tools: { value: 'denied', source: DEFAULT, restricted: true },
    extensions: { value: 'denied', source: DEFAULT, restricted: true },
    full_access: { value: 'not_permitted', source: DEFAULT, restricted: true },
    no_prompt: { value: 'not_permitted', source: DEFAULT, restricted: true },
  };
  for (const [name, value] of Object.entries(overrides)) base[name] = { ...base[name]!, ...value };
  return {
    environment: 'local_device',
    workspaceId: WORKSPACE,
    policyRevision: 1,
    authorizationEpoch: 2,
    settings: Object.entries(base).map(([name, setting]) => ({ name, ...setting })),
    device,
    capabilities: [
      { id: 'prompt_inspection', enabled: false, limits: ['Eligibility verification required before enablement'] },
      { id: 'specialist_cyber_access', enabled: false, limits: ['Eligibility verification required before enablement'] },
      { id: 'execution_sandbox', enabled: true, limits: ['Execution sandbox: local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)'] },
    ],
    reach: BOUNDED_REACH,
    commandRules: [],
    reviewer: { enabled: false, state: 'off', label: 'Automated permission review: off. Every request comes to you.', runtimeSetting: 'user' },
    task: null,
  };
}

const BOUNDED_REACH = {
  bounded: true,
  boundaries: [
    { kind: 'working_folder', access: 'write', label: 'working folder (read/write)' },
    { kind: 'output_folder', access: 'write', label: 'output folder' },
    { kind: 'system', access: 'read', label: 'system (read-only)' },
  ],
  network: 'listed',
  domains: [] as string[],
  networkSource: DEFAULT,
};
const UNBOUNDED_REACH = { bounded: false, boundaries: [], network: 'unrestricted', domains: [] as string[], networkSource: { kind: 'workspace_policy', revision: 4 } };

function taskPart(recorded = 'standard', status = 'standard', governing: Source | null = null): InquelloTaskPolicy {
  const effective = status === 'active' ? recorded : 'standard';
  return {
    broadMode: { taskId: TASK, revision: recorded === 'standard' ? 0 : 1, recorded, status, effectiveMode: effective, governing, label: 'Broader execution mode', reach: '' },
    threadSettings: {
      sandbox: effective === 'full_access' ? 'danger-full-access' : 'workspace-write',
      approvalPolicy: effective === 'standard' ? 'on-request' : 'never',
      networkAccess: effective === 'full_access',
      mode: effective,
    },
    reach: effective === 'full_access' ? UNBOUNDED_REACH : BOUNDED_REACH,
    runtimeProfile:
      effective === 'full_access'
        ? { sandbox: 'danger-full-access', permissionProfileId: null, permissionProfile: null, readableRoots: [], writableRoots: [], networkAllowlist: null }
        : null,
  };
}

function harness(options: { runtime?: (method: string, params: Record<string, unknown>) => unknown; service?: ExecutionPolicyRoutes | null; workspaces?: WorkspacesView; taskFolders?: string | null } = {}) {
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const serviceCalls: string[] = [];
  const identity = { principal: PRINCIPAL as string | null };
  const runtime: OrganiseRuntime = {
    ready: () => true,
    instance: () => runtime,
    request: async <T,>(method: string, params?: unknown) => {
      calls.push({ method, params: params as Record<string, unknown> });
      return (options.runtime ?? (() => response()))(method, params as Record<string, unknown>) as T;
    },
  };
  const organiseIdentity: OrganiseIdentity = {
    principalId: () => identity.principal,
    snapshot: () => ({ sharedService: 'available' }),
    withAccess: async (request) => (identity.principal ? request('iqa_access') : null),
  };
  const view: ExecutionPolicyView = { workspace_id: WORKSPACE, policy_revision: '4', authorization_epoch: '9', execution: { sandbox: 'read_only' } };
  const service: ExecutionPolicyRoutes | null =
    options.service === undefined
      ? {
          executionPolicy: async (access, workspaceId) => {
            serviceCalls.push(`${access}:${workspaceId}`);
            return view;
          },
        }
      : options.service;
  const workspaces: WorkspacesView = options.workspaces ?? {
    signedIn: true,
    sharedService: 'available',
    workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit', source: 'service' }],
    engagementCreation: { enabled: true },
  };
  const policy = new PolicyService({
    permissions: new PermissionMediator({ runtime, logger: recordingLogger(), newId: () => '00000000-0000-4000-8000-0000000000aa' }),
    runtime,
    identity: organiseIdentity,
    organise: { syncPrincipal: async () => undefined, getWorkspaces: async () => workspaces },
    service,
    logger: recordingLogger(),
    taskFolders: options.taskFolders ?? null,
    sandboxProbeTarget: null,
  });
  return { policy, calls, serviceCalls, identity };
}

describe('policy views', () => {
  it('shows the Inquello defaults with their sources and no device requirements', () => {
    const view = policyView(response());
    expect(view.environmentLabel).toBe('Local device');
    expect(view.settings.map((setting) => setting.name)).toEqual(['sandbox', 'approval', 'network', 'mcp_tools', 'extensions', 'full_access', 'no_prompt']);
    expect(view.settings.every((setting) => setting.sourceLabel === 'Inquello default')).toBe(true);
    expect(view.settings.find((setting) => setting.name === 'sandbox')!.valueLabel).toBe('Workspace write');
    expect(view.device).toEqual({ configured: false, label: DEVICE_NONE });
    expect(view.capabilities.map((capability) => [capability.label, capability.statusLabel])).toEqual([
      ['Prompt inspection', 'Not enabled — eligibility verification required'],
      ['Specialist cyber access', 'Not enabled — eligibility verification required'],
      ['Execution sandbox', 'Local OS sandbox on this device; no hosted sandbox — V2 revisit (OQ-13)'],
    ]);
    expect(view.capabilities.map((capability) => capability.enabled)).toEqual([false, false, true]);
  });

  it('names each governing rule in plain words', () => {
    const view = policyView(
      response(
        {
          sandbox: { value: 'read_only', source: { kind: 'workspace_policy', revision: 4 }, restricted: true },
          approval: { value: 'untrusted', source: { kind: 'user_config', revision: null }, restricted: true },
          network: { value: 'allowed', source: { kind: 'workspace_policy', revision: 4 }, restricted: false },
          full_access: { value: 'not_permitted', source: { kind: 'device_requirements', revision: null }, restricted: true },
        },
        { configured: true, sandboxModes: ['read_only', 'workspace_write'], approvals: null },
      ),
    );
    const label = (name: string) => view.settings.find((setting) => setting.name === name)!.sourceLabel;
    expect(label('sandbox')).toBe('Restricted by Workspace policy, revision 4');
    expect(label('network')).toBe('Set by Workspace policy, revision 4');
    expect(label('approval')).toBe('Restricted by your runtime configuration');
    expect(label('full_access')).toBe("Restricted by this device's managed requirements");
    expect(view.device.label).toBe('Allowed sandbox levels: Read only, Workspace write.');
  });

  it('refuses an enabled contract entry or an unknown source rather than showing it', () => {
    const enabled = response();
    enabled.capabilities[0]!.enabled = true;
    expect(() => policyView(enabled)).toThrow();
    const odd = response({ sandbox: { value: 'read_only', source: { kind: 'admin_override', revision: null } } });
    expect(() => policyView(odd)).toThrow();
  });

  it('labels a broader mode with its reach and a suspended one with its rule, never with approval wording', () => {
    const active = taskPolicyView(
      response({ full_access: { value: 'permitted', source: { kind: 'workspace_policy', revision: 2 }, restricted: false } }),
      taskPart('full_access', 'active'),
      false,
    );
    expect(active.broadMode).toMatchObject({ label: 'Broader execution mode', status: 'active', statusLabel: 'Full access', reach: BROAD_MODE_REACH.full_access });
    expect(active.options.find((option) => option.mode === 'full_access')).toMatchObject({ available: true, unavailableReason: null });
    expect(active.options.find((option) => option.mode === 'no_prompt')).toMatchObject({ available: false, unavailableReason: 'No prompt is not available: not permitted by the Inquello default.' });
    const suspended = taskPolicyView(response({ full_access: { value: 'not_permitted', source: { kind: 'workspace_policy', revision: 3 } } }), taskPart('full_access', 'suspended', { kind: 'workspace_policy', revision: 3 }), true);
    expect(suspended.broadMode.statusLabel).toBe('Suspended by policy');
    expect(suspended.broadMode.effectiveMode).toBe('standard');
    expect(suspended.broadMode.suspendedReason).toBe('Suspended by policy: Workspace policy, revision 3 no longer permits Full access. This Task runs in Standard mode.');
    expect(suspended.threadSettings).toEqual({ sandbox: 'workspace-write', approvalPolicy: 'on-request', networkAccess: false, mode: 'standard' });
    const texts = [active, suspended].flatMap((view) => [
      view.broadMode.label,
      view.broadMode.statusLabel,
      view.broadMode.reach,
      view.broadMode.suspendedReason ?? '',
      ...view.options.flatMap((option) => [option.title, option.reach, option.unavailableReason ?? '']),
      ...view.settings.flatMap((setting) => [setting.label, setting.valueLabel, setting.sourceLabel]),
      ...view.capabilities.flatMap((capability) => [capability.label, capability.statusLabel]),
    ]);
    const text = texts.join('\n').toLowerCase();
    for (const word of ['approv', 'review', 'accept', 'professional']) expect(text).not.toContain(word);
  });
});

describe('policy payloads', () => {
  it('accept exactly the Task, mode and confirmed reach', () => {
    expect(taskPolicyPayload([{ taskId: TASK }])).toEqual({ taskId: TASK });
    expect(() => taskPolicyPayload([{ taskId: TASK, workspaceId: WORKSPACE }])).toThrow();
    const set = { operationId: OP, taskId: TASK, expectedRevision: 0, mode: 'no_prompt', confirmation: BROAD_MODE_REACH.no_prompt };
    expect(setBroadModePayload([set])).toEqual(set);
    expect(setBroadModePayload([{ ...set, mode: 'standard', confirmation: null }])).toMatchObject({ mode: 'standard', confirmation: null });
    for (const bad of [
      { ...set, confirmation: BROAD_MODE_REACH.full_access },
      { ...set, confirmation: null },
      { ...set, mode: 'standard' },
      { ...set, actorKind: 'human' },
      { ...set, operationId: 'x' },
    ]) {
      expect(() => setBroadModePayload([bad])).toThrow();
    }
  });
});

describe('the policy service', () => {
  it('fetches the Workspace policy and passes it to the runtime with the Task', async () => {
    const h = harness({
      runtime: (method) => {
        if (method === 'inquello/broadMode/read') return { taskId: TASK, workspaceId: WORKSPACE, revision: 0, mode: 'standard' };
        return { ...response(), task: taskPart() };
      },
    });
    const result = await h.policy.forTask(TASK);
    expect(result.ok).toBe(true);
    expect(h.serviceCalls).toEqual([`iqa_access:${WORKSPACE}`]);
    const effective = h.calls.find((call) => call.method === 'inquello/policy/effective')!;
    expect(effective.params).toEqual({
      workspacePolicy: { workspaceId: WORKSPACE, policyRevision: 4, authorizationEpoch: 9, execution: { sandbox: 'read_only' } },
      taskId: TASK,
    });
    // Recomputed on every read: a second open fetches the policy again.
    await h.policy.forTask(TASK);
    expect(h.serviceCalls).toHaveLength(2);
  });

  it('sets a broader mode as the person, with the confirmed reach, and names the rule when refused', async () => {
    let refuse = true;
    const h = harness({
      runtime: (method) => {
        if (method === 'inquello/broadMode/read') return { taskId: TASK, workspaceId: WORKSPACE, revision: 0, mode: 'standard' };
        if (method === 'inquello/broadMode/set' && refuse) {
          throw new RpcResponseError(method, -32600, 'refused', { inquello: { kind: 'broad_mode_not_permitted', rule: 'workspace_policy', revision: 4 } });
        }
        return { ...response(), task: taskPart() };
      },
    });
    const input = { operationId: OP, taskId: TASK, expectedRevision: 0, mode: 'full_access' as const, confirmation: BROAD_MODE_REACH.full_access };
    expect(await h.policy.setBroadMode(input)).toEqual({
      ok: false,
      code: 'broad-mode-not-permitted',
      reason: 'Full access is not available: not permitted by Workspace policy, revision 4.',
    });
    const set = h.calls.find((call) => call.method === 'inquello/broadMode/set')!;
    expect(set.params).toMatchObject({ actorKind: 'human', actorRef: null, mode: 'full_access', confirmation: BROAD_MODE_REACH.full_access, workspacePolicy: { policyRevision: 4 } });
    refuse = false;
    expect((await h.policy.setBroadMode(input)).ok).toBe(true);
  });

  it('fails closed when the Workspace policy cannot be read', async () => {
    const down = harness({
      service: {
        executionPolicy: async () => {
          throw new ServiceError('transport', false);
        },
      },
      runtime: () => ({ taskId: TASK, workspaceId: WORKSPACE, revision: 0, mode: 'standard' }),
    });
    expect(await down.policy.effectiveThreadSettings(TASK)).toEqual({ ok: false, code: 'policy-unavailable', reason: POLICY_REASONS.policyUnavailable });
    expect(down.calls.map((call) => call.method)).toEqual(['inquello/broadMode/read']);
    const unconfigured = harness({ service: null, runtime: () => ({ taskId: TASK, workspaceId: WORKSPACE, revision: 0, mode: 'standard' }) });
    expect(await unconfigured.policy.forTask(TASK)).toMatchObject({ ok: false, code: 'policy-unavailable' });
  });

  it('derives thread settings only from the effective policy and the broad mode', async () => {
    const h = harness({
      taskFolders: tempDir('policy-units-tasks'),
      runtime: (method) => {
        if (method === 'inquello/broadMode/read') return { taskId: TASK, workspaceId: WORKSPACE, revision: 1, mode: 'full_access' };
        return { ...response({ full_access: { value: 'permitted', source: { kind: 'workspace_policy', revision: 4 }, restricted: false } }), task: taskPart('full_access', 'active') };
      },
    });
    expect(await h.policy.effectiveThreadSettings(TASK)).toMatchObject({
      ok: true,
      value: { sandbox: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, mode: 'full_access', profile: { sandbox: 'danger-full-access', permissionProfile: null } },
    });
    // Without a Task folder area nothing is derived for a run.
    const none = harness({ runtime: () => ({ taskId: TASK, workspaceId: WORKSPACE, revision: 0, mode: 'standard' }) });
    expect(await none.policy.effectiveThreadSettings(TASK)).toEqual({ ok: false, code: 'failed', reason: POLICY_REASONS.noTaskFolders });
  });

  it('maps another creator to an unknown Task and a signed-out person to sign-in', async () => {
    const h = harness({
      runtime: (method) => {
        throw new RpcResponseError(method, -32600, 'refused', { inquello: { kind: 'not_found' } });
      },
    });
    expect(await h.policy.forTask(TASK)).toEqual({ ok: false, code: 'not-found', reason: POLICY_REASONS.notFound });
    h.identity.principal = null;
    expect(await h.policy.forTask(TASK)).toMatchObject({ ok: false, code: 'signed-out' });
    expect(await h.policy.settings()).toMatchObject({ signedIn: false, workspaces: [], capabilities: DEFAULT_CAPABILITIES });
  });

  it('lists each Workspace in S07 with its policy or the reason it is missing', async () => {
    const h = harness();
    const settings = await h.policy.settings();
    expect(settings.signedIn).toBe(true);
    expect(settings.workspaces).toHaveLength(1);
    expect(settings.workspaces[0]!.policy?.settings[0]?.sourceLabel).toBe('Inquello default');
    const down = harness({
      service: {
        executionPolicy: async () => {
          throw new ServiceError('denied', true, 403, 'not_a_member');
        },
      },
    });
    const missing = await down.policy.settings();
    expect(missing.workspaces[0]).toMatchObject({ policy: null, reason: POLICY_REASONS.notAMember });
  });
});

describe('the policy smoke evaluation', () => {
  it('passes the signed-out run and fails a broad mode that was not refused', async () => {
    const { evaluatePolicy } = await import('../src/main/smoke-probe');
    expect(evaluatePolicy({ configured: false, signedOut: { settings: { signedIn: false }, request: { ok: false, code: 'signed-out' } } }).ok).toBe(true);
    const report = evaluatePolicy({ configured: false, signedOut: { settings: { signedIn: false }, request: { ok: true } } });
    expect(report.ok).toBe(false);
    expect(report.failures).toContain('a broader mode was not refused while signed out');
    const configured = evaluatePolicy({ configured: true, seedRead: true, signedIn: true, taskCreated: true, signedOutAtEnd: true });
    expect(configured.ok).toBe(false);
    expect(configured.failures).toContain('S07 did not load the policy');
  });
});

/** Real caller + mediator; only the service/runtime I/O boundaries are controlled. */
function pendingToolHarness() {
  const root = tempDir('policy-revalidation');
  const output = path.join(root, 'effect.txt');
  const state = {
    principal: PRINCIPAL as string | null,
    instance: {} as object,
    policy: { workspace_id: WORKSPACE, policy_revision: '1', authorization_epoch: '1', execution: { command_rules: [{ prefix: ['touch'], decision: 'prompt' }] } } as ExecutionPolicyView,
    serviceError: null as Error | null,
    broaden: false,
    serviceReads: 0,
    effectiveReads: 0,
    executionLayers: [] as unknown[],
    commands: [] as string[][],
  };
  const requestId = '4a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
  let requestedCommand: string[] = [];
  const runtime: OrganiseRuntime = {
    ready: () => true,
    instance: () => state.instance,
    request: async <T,>(method: string, input?: unknown): Promise<T> => {
      const params = input as Record<string, unknown>;
      let value: unknown;
      if (method === 'inquello/broadMode/read') value = { taskId: TASK, workspaceId: WORKSPACE };
      else if (method === 'inquello/policy/effective') {
        state.effectiveReads += 1;
        const task = taskPart(state.broaden ? 'full_access' : 'standard', state.broaden ? 'active' : 'standard');
        if (!state.broaden) task.runtimeProfile = {
          sandbox: 'permission-profile', permissionProfileId: 'task-profile',
          permissionProfile: { filesystem: { ':project_roots': 'write' }, network: { enabled: false } },
          readableRoots: [], writableRoots: [String(params.taskFolder)], networkAllowlist: [],
        };
        value = { ...response(), task };
      } else if (method === 'inquello/tools/exec') {
        if (params.sandboxProbeTarget) value = { exitCode: 0, stdout: '', stderr: '' };
        else if (params.permissionRequestId === null) throw new RpcResponseError(method, -32600, 'permission required', { inquello: { kind: 'permission_required' } });
        else {
          // Stand in for the external effect. The caller must not reach this
          // boundary with a stale approval, even if this endpoint accepts it.
          expect(params.permissionRequestId).toBe(requestId);
          expect(params.command).toEqual(requestedCommand);
          state.executionLayers.push(params.workspacePolicy);
          state.commands.push(params.command as string[]);
          fs.writeFileSync(output, 'executed once');
          value = { exitCode: 0, stdout: 'executed once', stderr: '' };
        }
      } else if (method === 'inquello/permissions/request') {
        requestedCommand = [...params.command as string[]];
        value = { request: { requestId }, receipt: {} };
      } else if (method === 'inquello/permissions/decide') {
        value = { request: { decision: { outcome: params.outcome }, evaluation: { controllingRule: null, command: requestedCommand } } };
      } else throw new Error(`unexpected runtime request: ${method}`);
      return value as T;
    },
  };
  const mediator = new PermissionMediator({ runtime, logger: recordingLogger(), newId: () => requestId, setTimer: () => 0, clearTimer: () => undefined });
  const policy = new PolicyService({
    runtime,
    identity: {
      principalId: () => state.principal,
      snapshot: () => ({ sharedService: 'available' }),
      withAccess: async (request) => state.principal ? request('access') : null,
    },
    organise: { syncPrincipal: async () => undefined, getWorkspaces: async () => { throw new Error('not used'); } },
    service: { executionPolicy: async () => {
      state.serviceReads += 1;
      if (state.serviceError) throw state.serviceError;
      return state.policy;
    } },
    permissions: mediator,
    logger: recordingLogger(),
    taskFolders: path.join(root, 'tasks'),
    sandboxProbeTarget: path.join(root, 'store'),
  });
  return {
    state, output, policy,
    start: async (command = ['touch', 'output/result']) => {
      const result = policy.runTool(TASK, command);
      await vi.waitFor(() => expect(mediator.waiting(requestId)).toBe(true));
      return { result };
    },
    allow: () => mediator.decide(requestId, 'allowed', OP),
  };
}

describe('runTool revalidates authority after permission', () => {
  it('refetches unchanged policy and executes the exact authorized command once', async () => {
    const h = pendingToolHarness();
    const command = ['touch', 'output/result'];
    const { result } = await h.start(command);
    // Caller-owned arrays cannot change what the person authorized.
    command[1] = 'output/different';
    await h.allow();
    await expect(result).resolves.toMatchObject({ ok: true, value: { exitCode: 0, stdout: 'executed once' } });
    expect(fs.readFileSync(h.output, 'utf8')).toBe('executed once');
    expect(h.state.serviceReads).toBe(2);
    expect(h.state.effectiveReads).toBe(2);
    expect(h.state.commands).toEqual([['touch', 'output/result']]);
    expect(h.state.executionLayers).toEqual([{ workspaceId: WORKSPACE, policyRevision: 1, authorizationEpoch: 1, execution: h.state.policy.execution }]);
  });

  it.each(['forbid', 'read-only', 'epoch', 'wider-profile'] as const)('runs nothing when %s changes during the wait', async (change) => {
    const h = pendingToolHarness();
    const { result } = await h.start();
    if (change === 'forbid') {
      // Deliberately mutate a nested policy in place: the approved context
      // must be a snapshot, not another alias of a service-owned object.
      (h.state.policy.execution!.command_rules as Array<{ decision: string }>)[0]!.decision = 'forbid';
      h.state.policy.policy_revision = '2';
    } else if (change === 'read-only') {
      h.state.policy = { ...h.state.policy, policy_revision: '2', execution: { sandbox: 'read_only' } };
    } else if (change === 'epoch') h.state.policy.authorization_epoch = '2';
    else h.state.broaden = true;
    await h.allow();
    await expect(result).resolves.toEqual({ ok: false, code: 'permission-denied', reason: POLICY_REASONS.permissionContextChanged });
    expect(h.state.serviceReads).toBe(2);
    expect(h.state.effectiveReads).toBe(2);
    expect(fs.existsSync(h.output)).toBe(false);
  });

  it.each([
    ['membership removed', 'denied', POLICY_REASONS.notAMember],
    ['service unavailable', 'transport', POLICY_REASONS.policyUnavailable],
  ] as const)('runs nothing when %s before approval', async (_label, kind, reason) => {
    const h = pendingToolHarness();
    const { result } = await h.start();
    h.state.serviceError = new ServiceError(kind);
    await h.allow();
    await expect(result).resolves.toEqual({ ok: false, code: 'policy-unavailable', reason });
    expect(h.state.serviceReads).toBe(2);
    expect(fs.existsSync(h.output)).toBe(false);
  });

  it.each(['principal', 'runtime'] as const)('does not transfer approval to a new %s', async (change) => {
    const h = pendingToolHarness();
    const { result } = await h.start();
    if (change === 'principal') h.state.principal = OP;
    else h.state.instance = {};
    await h.allow();
    await expect(result).resolves.toEqual({ ok: false, code: 'permission-denied', reason: POLICY_REASONS.permissionContextChanged });
    expect(fs.existsSync(h.output)).toBe(false);
  });
});
