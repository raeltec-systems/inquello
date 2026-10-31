/**
 * Story 1.14, main process: the organise service with fake runtime, identity
 * and shared service; the operation payload validators; the runtime env.
 */
import { describe, expect, it, vi } from 'vitest';

import { ServiceError } from '../src/main/identity/service-client';
import type { CreateEngagementEnvelope } from '../src/main/identity/wire';
import {
  engagementPayload,
  ORGANISE_REASONS,
  OrganiseService,
  taskMovePayload,
  taskPayload,
  treePayload,
  type OrganiseIdentity,
  type OrganiseRuntime,
  type WorkspaceRoutes,
} from '../src/main/organise';
import { RpcResponseError, runtimeChildEnv, WORKING_STORE_ENV } from '../src/main/runtime';
import { OPERATION_NAMES } from '../src/main/security/operations';
import { recordingLogger } from './helpers';

const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const SERVICE_ENGAGEMENT = '1f2e3d4c-5b6a-4978-8a6b-5c4d3e2f1a0b';
const PRINCIPAL = '11111111-1111-4111-8111-111111111111';
const OP = '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';

const engagement = {
  engagementId: '2a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d',
  workspaceId: WORKSPACE,
  serviceEngagementId: SERVICE_ENGAGEMENT,
  name: 'FY26 audit',
  objectives: 'Opinion',
  scope: 'Group',
  clientEntity: 'Synthetic Client Ltd',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
  revision: 1,
};

const task = {
  taskId: '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d',
  workspaceId: WORKSPACE,
  creatorPrincipalId: PRINCIPAL,
  engagementId: null,
  folderId: null,
  title: 'Untitled thread',
  runtimeThreadId: null,
  sourceRefs: [],
  artifactRefs: [],
  visibility: 'private',
  revision: 1,
};

const receipt = { operationId: OP, command: 'create_task', expectedRevision: 0, resultingRevision: 1, replayed: false };

function refusal(method: string, kind: string, extra: Record<string, unknown> = {}) {
  return new RpcResponseError(method, -32600, kind, { inquello: { kind, ...extra } });
}

interface Harness {
  service: OrganiseService;
  calls: Array<{ method: string; params: unknown }>;
  routes: { [K in keyof WorkspaceRoutes]: ReturnType<typeof vi.fn> };
  identity: { principal: string | null; shared: 'available' | 'unavailable' | 'not-configured' };
  runtime: { instance: object; ready: boolean };
  handlers: Map<string, (params: unknown) => unknown>;
}

function harness(options: { configured?: boolean } = {}): Harness {
  const calls: Harness['calls'] = [];
  const handlers = new Map<string, (params: unknown) => unknown>([
    ['inquello/session/setPrincipal', (params) => ({ principalId: (params as { principalId: string | null }).principalId })],
    ['inquello/workspace/list', () => ({ workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', labelRevision: 1 }] })],
    ['inquello/workspace/remember', () => ({})],
    ['inquello/workspace/tree', () => ({ workspaceId: WORKSPACE, engagements: [engagement], folders: [], tasks: [task] })],
    ['inquello/engagement/create', () => ({ engagement, receipt: { ...receipt, command: 'create_engagement' } })],
    ['inquello/task/create', () => ({ task, receipt })],
  ]);
  const runtimeState = { instance: {}, ready: true };
  const runtime: OrganiseRuntime = {
    ready: () => runtimeState.ready,
    instance: () => runtimeState.instance,
    request: async <T,>(method: string, params?: unknown) => {
      calls.push({ method, params });
      const handler = handlers.get(method);
      if (!handler) throw new Error(`unexpected ${method}`);
      return handler(params) as T;
    },
  };
  const identityState = { principal: PRINCIPAL as string | null, shared: 'available' as Harness['identity']['shared'] };
  const identity: OrganiseIdentity = {
    principalId: () => identityState.principal,
    snapshot: () => ({ sharedService: identityState.shared }),
    withAccess: async (request) => (identityState.principal ? request('access-credential') : null),
  };
  const routes = {
    capabilities: vi.fn(async () => ({ protocol_major: 1, schema_version: 1, command_epoch: '7' })),
    workspaces: vi.fn(async () => ({
      principal_id: PRINCIPAL,
      workspaces: [
        {
          workspace_id: WORKSPACE,
          name: 'Synthetic Audit Co',
          kind: 'internal_company',
          revision: '1',
          authorization_epoch: '1',
          policy_revision: '1',
          membership: { status: 'active' as const, roles: ['audit_lead'], policy_revision: '1', revision: '1' },
          engagements: [],
        },
      ],
    })),
    workspaceCommand: vi.fn(async (_access: string, envelope: CreateEngagementEnvelope) => ({
      operation_id: envelope.operation_id,
      resource_id: SERVICE_ENGAGEMENT,
      revision: '1',
      authorization_epoch: '1',
      status: 'applied' as const,
      receipt_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    })),
    acceptInvite: vi.fn(),
  };
  const service = new OrganiseService({ runtime, identity, service: options.configured === false ? null : routes, logger: recordingLogger() });
  return { service, calls, routes, identity: identityState, runtime: runtimeState, handlers };
}

const engagementInput = {
  operationId: OP,
  workspaceId: WORKSPACE,
  name: 'FY26 audit',
  objectives: 'Opinion',
  scope: 'Group',
  clientEntity: 'Synthetic Client Ltd',
  periodStart: '2026-01-01',
  periodEnd: '2026-12-31',
};

describe('organise service', () => {
  it('refuses everything while signed out, without touching the runtime', async () => {
    const h = harness();
    h.identity.principal = null;
    expect(await h.service.getWorkspaces()).toMatchObject({ signedIn: false, workspaces: [], engagementCreation: { enabled: false, reason: ORGANISE_REASONS.signedOut } });
    expect(await h.service.createTask({ operationId: OP, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'x' })).toEqual({
      ok: false,
      code: 'signed-out',
      reason: ORGANISE_REASONS.signedOut,
    });
    expect(h.calls).toEqual([]);
  });

  it('binds the principal once per runtime and principal, never from a payload', async () => {
    const h = harness();
    await h.service.getWorkspaces();
    await h.service.getTree(WORKSPACE);
    const binds = () => h.calls.filter((call) => call.method === 'inquello/session/setPrincipal').map((call) => call.params);
    expect(binds()).toEqual([{ principalId: PRINCIPAL }]);
    h.runtime.instance = {};
    await h.service.getTree(WORKSPACE);
    expect(binds()).toHaveLength(2);
    h.identity.principal = null;
    await h.service.syncPrincipal();
    expect(binds().at(-1)).toEqual({ principalId: null });
  });

  it('lists current service Workspaces without trusting or mutating remembered labels', async () => {
    const h = harness();
    h.handlers.set('inquello/workspace/list', () => ({ workspaces: [{ workspaceId: WORKSPACE, name: 'Old name', labelRevision: 3 }] }));
    const view = await h.service.getWorkspaces();
    expect(view).toEqual({
      signedIn: true,
      sharedService: 'available',
      workspaces: [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', source: 'service' }],
      engagementCreation: { enabled: true },
    });
    expect(h.calls.find((call) => call.method === 'inquello/workspace/remember')).toBeUndefined();
  });

  it('with the service down, withholds remembered Workspaces and private trees', async () => {
    const h = harness();
    h.routes.workspaces.mockRejectedValue(new ServiceError('transport'));
    const view = await h.service.getWorkspaces();
    expect(view).toEqual({
      signedIn: true,
      sharedService: 'unavailable',
      workspaces: [],
      engagementCreation: { enabled: false, reason: ORGANISE_REASONS.serviceDown },
    });
    const tree = await h.service.getTree(WORKSPACE);
    expect(tree.ok).toBe(false);
  });

  it('refuses a tree for a Workspace the principal was not given', async () => {
    const h = harness();
    expect(await h.service.getTree('6e7f8091-a2b3-4c4d-8e5f-6a7b8c9d0e1f')).toEqual({ ok: false, code: 'not-found', reason: ORGANISE_REASONS.unknownWorkspace });
  });

  it('creates the service Engagement first, then the local record under the same operation ID', async () => {
    const h = harness();
    await h.service.getWorkspaces();
    const result = await h.service.createEngagement(engagementInput);
    expect(result).toEqual({ ok: true, value: { ...engagement } });
    expect(h.routes.workspaceCommand).toHaveBeenCalledWith('access-credential', {
      command_epoch: '7',
      operation_id: OP,
      workspace_id: WORKSPACE,
      expected_revision: '0',
      schema_version: 1,
      payload: { command: 'create_engagement', name: 'FY26 audit' },
    });
    expect(h.calls.find((call) => call.method === 'inquello/engagement/create')?.params).toMatchObject({
      operationId: OP,
      expectedRevision: 0,
      serviceEngagementId: SERVICE_ENGAGEMENT,
      clientEntity: 'Synthetic Client Ltd',
      periodStart: '2026-01-01',
    });
  });

  it('creates nothing locally when the service step fails, and names the reason', async () => {
    const h = harness();
    await h.service.getWorkspaces();
    h.routes.workspaceCommand.mockRejectedValueOnce(new ServiceError('denied', true, 403, 'role_lacks_action'));
    expect(await h.service.createEngagement(engagementInput)).toEqual({ ok: false, code: 'not-permitted', reason: ORGANISE_REASONS.roleLacksAction });
    h.routes.workspaceCommand.mockRejectedValueOnce(new ServiceError('transport'));
    expect(await h.service.createEngagement(engagementInput)).toEqual({ ok: false, code: 'service-unavailable', reason: ORGANISE_REASONS.serviceUnreachable });
    expect(h.calls.some((call) => call.method === 'inquello/engagement/create')).toBe(false);
  });

  it('reports a local failure after the service step as incomplete, and a retry reuses the operation ID', async () => {
    const h = harness();
    await h.service.getWorkspaces();
    let failLocal = true;
    h.handlers.set('inquello/engagement/create', () => {
      if (failLocal) {
        failLocal = false;
        throw refusal('inquello/engagement/create', 'store_unavailable');
      }
      return { engagement, receipt };
    });
    expect(await h.service.createEngagement(engagementInput)).toEqual({ ok: false, code: 'incomplete', reason: ORGANISE_REASONS.incomplete });
    expect(await h.service.createEngagement(engagementInput)).toMatchObject({ ok: true });
    const opIds = h.routes.workspaceCommand.mock.calls.map(([, envelope]) => (envelope as CreateEngagementEnvelope).operation_id);
    expect(opIds).toEqual([OP, OP]);
  });

  it('maps runtime refusals to fixed reasons, keeping the actual revision of a conflict', async () => {
    const h = harness();
    h.handlers.set('inquello/task/rename', () => {
      throw refusal('inquello/task/rename', 'revision_conflict', { expected: 1, actual: 2 });
    });
    h.handlers.set('inquello/task/move', () => {
      throw refusal('inquello/task/move', 'workspace_mismatch');
    });
    expect(await h.service.renameTask({ operationId: OP, workspaceId: WORKSPACE, taskId: task.taskId, expectedRevision: 1, title: 'x' })).toEqual({
      ok: false,
      code: 'conflict',
      reason: ORGANISE_REASONS.conflict,
      actualRevision: 2,
    });
    expect(await h.service.moveTask({ operationId: OP, workspaceId: WORKSPACE, taskId: task.taskId, expectedRevision: 1, engagementId: engagement.engagementId, folderId: null })).toEqual({
      ok: false,
      code: 'workspace-mismatch',
      reason: ORGANISE_REASONS.workspaceMismatch,
    });
  });

  it('without shared-service configuration, withholds private local work', async () => {
    const h = harness({ configured: false });
    const view = await h.service.getWorkspaces();
    expect(view.engagementCreation).toEqual({ enabled: false, reason: ORGANISE_REASONS.serviceDown });
    expect(view.workspaces.map((workspace) => workspace.source)).toEqual([]);
  });

  it('returns only the published Task fields to the renderer', async () => {
    const h = harness();
    h.handlers.set('inquello/task/create', () => ({ task: { ...task, extra: 'nope' }, receipt }));
    const created = await h.service.createTask({ operationId: OP, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Untitled thread' });
    expect(created.ok && Object.keys(created.value).sort()).toEqual(
      ['artifactRefs', 'engagementId', 'folderId', 'revision', 'runtimeThreadId', 'sourceRefs', 'taskId', 'title', 'visibility', 'workspaceId'].sort(),
    );
  });
});

describe('organise payloads', () => {
  it('accept exactly the declared keys with UUIDs, bounded text and null where allowed', () => {
    expect(treePayload([{ workspaceId: WORKSPACE }])).toEqual({ workspaceId: WORKSPACE });
    expect(taskPayload([{ operationId: OP, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: '' }])).toMatchObject({ engagementId: null });
    expect(engagementPayload([{ ...engagementInput }])).toEqual(engagementInput);
  });

  it('reject a principal, a path, extra or missing keys, bad IDs and bad revisions', () => {
    const base = { operationId: OP, workspaceId: WORKSPACE, taskId: task.taskId, expectedRevision: 1, engagementId: null, folderId: null };
    expect(() => taskMovePayload([{ ...base, principalId: PRINCIPAL }])).toThrow(/unknown key principalId/);
    expect(() => taskMovePayload([{ ...base, workspaceId: '/tmp/x' }])).toThrow(/workspaceId must be a UUID/);
    expect(() => taskMovePayload([{ ...base, expectedRevision: -1 }])).toThrow(/expectedRevision/);
    expect(() => taskMovePayload([{ ...base, expectedRevision: 1.5 }])).toThrow(/expectedRevision/);
    const { folderId: _folderId, ...missing } = base;
    expect(() => taskMovePayload([missing])).toThrow(/missing key folderId/);
    expect(() => taskMovePayload([base, base])).toThrow(/one argument/);
    expect(() => treePayload([{ workspaceId: WORKSPACE.toUpperCase() }])).toThrow(/UUID/);
    expect(() => taskPayload([{ operationId: OP, workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'x'.repeat(9000) }])).toThrow(/title/);
  });

  it('are registered as named operations', () => {
    expect(OPERATION_NAMES.filter((name) => name.startsWith('organise.'))).toEqual([
      'organise.getWorkspaces',
      'organise.getTree',
      'organise.createEngagement',
      'organise.updateEngagement',
      'organise.createFolder',
      'organise.createTask',
      'organise.renameTask',
      'organise.moveTask',
    ]);
  });
});

describe('runtime env', () => {
  it('names the working store only when main gives it, dropping an inherited value', () => {
    const inherited = { PATH: '/bin', [WORKING_STORE_ENV]: '/tmp/elsewhere.sqlite' };
    expect(runtimeChildEnv(inherited, { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG' })[WORKING_STORE_ENV]).toBeUndefined();
    expect(runtimeChildEnv(inherited, { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', workingStore: '/data/working/working.sqlite' })[WORKING_STORE_ENV]).toBe('/data/working/working.sqlite');
  });
});

 it('does not revive a Workspace listing after a newer authority failure during binding',async()=>{
  const h=harness();let release!:(v:unknown)=>void;
  h.handlers.set('inquello/session/setPrincipal',()=>new Promise(resolve=>{release=resolve;}));
  const old=h.service.getWorkspaces();await vi.waitFor(()=>expect(release).toBeDefined());
  h.routes.workspaces.mockRejectedValueOnce(new ServiceError('transport'));
  expect((await h.service.getWorkspaces()).workspaces).toEqual([]);release({});expect((await old).workspaces).toEqual([]);
 });
 it('projects only safe unavailable Task IDs and reason codes',async()=>{
  const h=harness();h.handlers.set('inquello/workspace/tree',()=>({workspaceId:WORKSPACE,engagements:[],folders:[],tasks:[],unavailableTasks:[{taskId:task.taskId,reason:'current_authority_unavailable',title:'WITHHELD SECRET'}]}));
  await h.service.getWorkspaces();const result=await h.service.getTree(WORKSPACE);expect(result).toMatchObject({ok:true,value:{unavailableTasks:[{taskId:task.taskId,reason:'current_authority_unavailable'}]}});expect(JSON.stringify(result)).not.toContain('WITHHELD SECRET');
 });

describe('ordered successful Workspace observations',()=>{
 it('a delayed allowed list cannot republish a Workspace removed by a newer successful list',async()=>{
  const h=harness();const allowed=await (h.routes.workspaces as unknown as WorkspaceRoutes['workspaces'])('fixture');let release!:(v:unknown)=>void;
  h.routes.workspaces.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const old=h.service.getWorkspaces();
  h.routes.workspaces.mockResolvedValueOnce({...allowed,workspaces:[]});
  expect((await h.service.getWorkspaces()).workspaces).toEqual([]);
  release(allowed);expect((await old).workspaces).toEqual([]);
  h.routes.workspaces.mockResolvedValue({...allowed,workspaces:[]});
  expect(await h.service.getTree(WORKSPACE)).toMatchObject({ok:false});
  expect(h.calls.some(c=>c.method==='inquello/workspace/tree')).toBe(false);
 });
 it('an older failed list cannot erase newer successful authority during native hydration',async()=>{
  const h=harness();let reject!:(error:Error)=>void;
  h.routes.workspaces.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;}));
  const old=h.service.getWorkspaces();expect((await h.service.getWorkspaces()).workspaces).toHaveLength(1);
  reject(new Error('older outage'));expect((await old).workspaces).toEqual([]);
  expect((await h.service.getTree(WORKSPACE)).ok).toBe(true);
  expect(h.routes.workspaces).toHaveBeenCalledTimes(4);
 });
});
