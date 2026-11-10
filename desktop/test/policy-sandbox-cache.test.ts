/** Synthetic Windows backend: verifies cache scope and fresh authority, not OS isolation. */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PolicyService, PermissionMediator } from '../src/main/policy';
import type { OrganiseRuntime } from '../src/main/organise';
import type { InquelloPolicyEffectiveResponse } from '../src/protocol/generated/v2/InquelloPolicyEffectiveResponse';
import type { InquelloTaskPolicy } from '../src/protocol/generated/v2/InquelloTaskPolicy';
import { recordingLogger } from './helpers';

const storage = vi.hoisted(() => ({ backendReads: 0, transferring: false, folderStarted: false, folderHold: null as Promise<void> | null }));
vi.mock('../src/main/runtime/wsl', async original => ({...await original<typeof import('../src/main/runtime/wsl')>(), preflightWsl: vi.fn()}));
vi.mock('../src/main/runtime/wsl-tasks', async original => ({
  ...await original<typeof import('../src/main/runtime/wsl-tasks')>(),
  WslTasks: class {
    scope = 'synthetic-cache-scope';
    binding() { return {backend:'linux',state:storage.transferring?'transferring':'ready'}; }
    async settledBinding() { storage.backendReads++; return this.binding(); }
    async transition() {}
  },
}));
vi.mock('../src/main/policy/tools', async original => ({
  ...await original<typeof import('../src/main/policy/tools')>(),
  ensureTaskFolder: (root:string, taskId:string) => ({working:path.join(root,taskId),output:path.join(root,taskId,'output')}),
  ensureTaskFolderAsync: async (root:string, taskId:string) => { storage.folderStarted=true; if(storage.folderHold)await storage.folderHold; return {working:path.join(root,taskId),output:path.join(root,taskId,'output')}; },
}));
const PRINCIPAL='11111111-1111-4111-8111-111111111111';
const WORKSPACE='5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';
const TASK='3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const SECOND='3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3e';
type Source = { kind: string; revision: number | null };
const DEFAULT: Source = { kind: 'inquello_default', revision: null };

function response(overrides: Partial<Record<string, { value: string; source?: Source; restricted?: boolean }>> = {}, device = { configured: false, sandboxModes: null as string[] | null, approvals: null as string[] | null }): InquelloPolicyEffectiveResponse {
  const base: Record<string, { value: string; source: Source; restricted: boolean }> = {
    sandbox: { value: 'workspace_write', source: DEFAULT, restricted: true },
    approval: { value: 'on_request', source: DEFAULT, restricted: false },
    network: { value: 'denied', source: DEFAULT, restricted: true },
    mcp_tools: { value: 'denied', source: DEFAULT, restricted: true },
    extensions: { value: 'denied', source: DEFAULT, restricted: true },
    allow_local_mcp_servers: { value: 'denied', source: DEFAULT, restricted: true },
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


function cacheHarness() {
  storage.backendReads=0;storage.transferring=false;storage.folderStarted=false;storage.folderHold=null;
  const state={principal:PRINCIPAL as string|null, runtime:{} as object, revision:1, denied:false, reads:0, effectiveReads:0, probes:[] as string[], hold:null as null|Promise<void>};
  const runtime:OrganiseRuntime={ready:()=>true,instance:()=>state.runtime,request:async<T,>(method:string,raw?:unknown)=>{
    const params=raw as {taskId?:string};
    if(method==='inquello/broadMode/read')return {workspaceId:WORKSPACE} as T;
    if(method==='inquello/policy/effective'){
      state.effectiveReads++;
      const value=response();value.policyRevision=state.revision;
      value.task=taskPart();value.task.broadMode.taskId=params.taskId!;
      return value as T;
    }
    if(method==='inquello/tools/exec'){
      state.probes.push(params.taskId!);
      if(params.taskId===TASK&&state.hold)await state.hold;
      return {exitCode:0,stdout:'',stderr:''} as T;
    }
    throw new Error('Unexpected synthetic runtime method: '+method);
  }};
  const policy=new PolicyService({executionPlatform:'win32',runtime,
    identity:{principalId:()=>state.principal,snapshot:()=>({sharedService:'available'}),withAccess:async request=>state.principal?request('synthetic-not-a-credential'):null},
    organise:{syncPrincipal:async()=>undefined,getWorkspaces:async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic',source:'service'}],engagementCreation:{enabled:false,reason:'fixture'}})},
    service:{executionPolicy:async()=>{state.reads++;if(state.denied)throw new Error('Synthetic membership refusal');return {workspace_id:WORKSPACE,policy_revision:String(state.revision),authorization_epoch:'1',execution:null};}},
    logger:recordingLogger(),taskFolders:path.resolve('synthetic-cache-tasks'),sandboxProbeTarget:path.resolve('synthetic-cache-store'),
    permissions:new PermissionMediator({runtime,logger:recordingLogger(),newId:randomUUID}),
  });
  return {policy,state};
}

describe('bounded Windows sandbox probe reuse',()=>{
  it('does not reprobe unchanged Task A after visiting Task B, while refetching authority every time',async()=>{
    const {policy,state}=cacheHarness();
    for(const id of [TASK,SECOND,TASK])expect((await policy.forTask(id)).ok).toBe(true);
    expect(state.reads).toBe(3);
    expect(state.probes).toEqual([TASK,SECOND]);
  });
  it('shares the pending exact probe across interleaved Task reads',async()=>{
    const {policy,state}=cacheHarness();let release!:()=>void;
    state.hold=new Promise<void>(resolve=>{release=resolve;});
    const first=policy.forTask(TASK);
    await vi.waitFor(()=>expect(state.probes).toEqual([TASK]));
    expect((await policy.forTask(SECOND)).ok).toBe(true);
    const repeated=policy.forTask(TASK);
    await vi.waitFor(()=>expect(state.reads).toBe(3));release();
    expect((await first).ok).toBe(true);expect((await repeated).ok).toBe(true);
    expect(state.probes).toEqual([TASK,SECOND]);
  });
  it('requires a new probe when policy, runtime or principal changes',async()=>{
    const {policy,state}=cacheHarness();
    expect((await policy.forTask(TASK)).ok).toBe(true);
    state.revision++;expect((await policy.forTask(TASK)).ok).toBe(true);
    state.runtime={};expect((await policy.forTask(TASK)).ok).toBe(true);
    state.principal='22222222-2222-4222-8222-222222222222';expect((await policy.forTask(TASK)).ok).toBe(true);
    expect(state.probes).toEqual([TASK,TASK,TASK,TASK]);
  });
  it('never reuses a probe to bypass unavailable authority or signed-out state',async()=>{
    const {policy,state}=cacheHarness();expect((await policy.forTask(TASK)).ok).toBe(true);
    state.denied=true;expect((await policy.forTask(TASK)).ok).toBe(false);
    state.principal=null;expect((await policy.forTask(TASK)).ok).toBe(false);
    expect(state.probes).toEqual([TASK]);expect(state.reads).toBe(2);
  });
  it('does not let cached availability override an interrupted transfer',async()=>{
    const {policy,state}=cacheHarness();expect((await policy.forTask(TASK)).ok).toBe(true);
    storage.transferring=true;
    try {expect(await policy.forTask(TASK)).toMatchObject({ok:true,value:{sandbox:{status:'unavailable'}}});expect(state.probes).toEqual([TASK]);}
    finally {storage.transferring=false;}
  });
  it('bounds retained probes and evicts the least recently observed key',async()=>{
    const {policy,state}=cacheHarness();
    const ids=Array.from({length:33},(_,n)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
    for(const id of ids)expect((await policy.forTask(id)).ok).toBe(true);
    expect((await policy.forTask(ids[1]!)).ok).toBe(true);
    expect(state.probes).toHaveLength(33);
    expect((await policy.forTask(ids[0]!)).ok).toBe(true);
    expect(state.probes).toHaveLength(34);
  });
  it.each(['sign-out', 'runtime replacement'] as const)('refuses %s during async private folder preparation before another runtime request', async change => {
    const {policy,state}=cacheHarness();let release!:()=>void;
    storage.folderHold=new Promise<void>(resolve=>{release=resolve;});
    const pending=policy.forTask(TASK);
    await vi.waitFor(()=>expect(storage.folderStarted).toBe(true));
    expect(state.effectiveReads).toBe(0);expect(state.probes).toEqual([]);
    if(change==='sign-out')state.principal=null;else state.runtime={};
    release();
    expect(await pending).toMatchObject({ok:false,code:change==='sign-out'?'signed-out':'runtime-unavailable'});
    expect(state.effectiveReads).toBe(0);expect(state.probes).toEqual([]);
  });
  it('fails closed when async private folder protection fails', async () => {
    const {policy,state}=cacheHarness();let reject!:(error:Error)=>void;
    storage.folderHold=new Promise<void>((_resolve,fail)=>{reject=fail;});
    const pending=policy.forTask(TASK);
    await vi.waitFor(()=>expect(storage.folderStarted).toBe(true));
    reject(new Error('Synthetic ACL refusal'));
    expect(await pending).toMatchObject({ok:false,code:'failed'});
    expect(state.effectiveReads).toBe(0);expect(state.probes).toEqual([]);
  });

});


describe('read-only Task policy inspection', () => {
  it('refetches authority without preparing folders, reading execution storage, or running a probe', async () => {
    const {policy,state}=cacheHarness();
    for (const id of [TASK,SECOND,TASK]) expect(await policy.inspectTask(id)).toMatchObject({ok:true,value:{taskId:id,sandbox:{status:'not-checked'},environmentLabel:'Linux on this device'}});
    expect(state.reads).toBe(3);expect(state.effectiveReads).toBe(3);
    expect(storage.folderStarted).toBe(false);expect(storage.backendReads).toBe(0);expect(state.probes).toEqual([]);
    expect(await policy.forTask(TASK)).toMatchObject({ok:true,value:{sandbox:{status:'available'}}});
    expect(storage.folderStarted).toBe(true);expect(storage.backendReads).toBeGreaterThan(0);expect(state.probes).toEqual([TASK]);
  });
  it('does not bypass revoked authority or claim a previously checked sandbox is currently available', async () => {
    const {policy,state}=cacheHarness();await policy.forTask(TASK);
    expect(await policy.inspectTask(TASK)).toMatchObject({ok:true,value:{sandbox:{status:'not-checked'}}});
    state.denied=true;expect(await policy.inspectTask(TASK)).toMatchObject({ok:false,code:'policy-unavailable'});
    state.principal=null;expect(await policy.inspectTask(TASK)).toMatchObject({ok:false,code:'signed-out'});
    expect(state.probes).toEqual([TASK]);
  });
});
