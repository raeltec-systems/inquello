import { parseTaskEnvironment, LOCAL_ENVIRONMENT, REMOTE_GATE } from '../src/main/environments/types';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentService } from '../src/main/environments/service';
import type { TaskRouteView } from '../src/main/routes/types';
const taskId = '22222222-2222-4222-8222-222222222222';
const empty: TaskRouteView = {taskId,workspaceId:taskId,revision:0,configurationRevision:null,staleConfiguration:false,selected:null};
function harness() {
  let principal: string | null = 'owner', runtime: unknown = {}, ready = true;
  const inspectEnvironment = vi.fn(async () => ({ok:true as const,value:{sandbox:'not-checked' as const}}));
  const forTask = vi.fn(async () => ({ok:true as const,value:empty}));
  const service = new EnvironmentService({identity:{principalId:()=>principal},runtime:{instance:()=>runtime,ready:()=>ready},policy:{inspectEnvironment},routes:{forTask}});
  return {service,inspectEnvironment,forTask, principal:(p:string|null)=>{principal=p;},replace:()=>{runtime={};},stop:()=>{ready=false;}};
}
describe('read-only environment inspection', () => {
  it('separates local readiness, unchecked sandbox and successful empty route', async () => {
    const h=harness(); expect(await h.service.forTask(taskId)).toMatchObject({ok:true,value:{executionLabel:'This device (local host)',readiness:'ready',sandbox:'not-checked',inference:{status:'none',region:'Unknown'}}});
    expect(h.inspectEnvironment).toHaveBeenCalledExactlyOnceWith(taskId);expect(h.forTask).toHaveBeenCalledExactlyOnceWith(taskId);
  });
  it('uses only explicit selected route facts, not host region or eligibility', async () => {
    const h=harness(); h.forTask.mockResolvedValue({ok:true,value:{...empty,selected:{routeId:'claude-api-key',provider:'Anthropic',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'private-not-for-ui',region:null},endpoint:'https://api.anthropic.com/v1/messages',revision:1,credentialPresent:false,adapterSupported:false,verification:'not_verified',enabled:false,gate:'Disabled',limits:[],evidence:[],executionFlow:'local',inferenceFlow:'cloud',connectorFlow:'none'}}});
    const result=await h.service.forTask(taskId);expect(result).toMatchObject({ok:true,value:{inference:{status:'selected',provider:'Anthropic',deployment:'anthropic-direct',endpoint:'https://api.anthropic.com/v1/messages',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:'Unknown'}}});expect(JSON.stringify(result)).not.toContain('private-not-for-ui');
    const selected = (await h.forTask()).value.selected!; h.forTask.mockResolvedValue({ok:true,value:{...empty,selected:{...selected,configuration:{...selected.configuration!,region:'eu-configured'}}}});
    expect(await h.service.forTask(taskId)).toMatchObject({ok:true,value:{inference:{provider:'Anthropic',deployment:'anthropic-direct',endpoint:'https://api.anthropic.com/v1/messages',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:'eu-configured'}}});
  });
  it('never turns route failure, malformed data or stale configuration into no route', async () => {
    for (const route of [Promise.reject(new Error('secret')),Promise.resolve({ok:true,value:{bad:'data'}}),Promise.resolve({ok:true,value:{...empty,staleConfiguration:true}})]) {
      const h=harness();h.forTask.mockImplementationOnce(()=>route as ReturnType<typeof h.forTask>);const result=await h.service.forTask(taskId);expect(result.ok).toBe(true);if(result.ok)expect(['unavailable','stale']).toContain(result.value.inference.status);expect(JSON.stringify(result)).not.toContain('secret');
    }
  });
  it.each(['principal','runtime','epoch','stopped'] as const)('discards late responses after %s changes', async change => {
    const h=harness();let release!:()=>void;h.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=()=>resolve({ok:true,value:empty});}));const pending=h.service.forTask(taskId);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
    if(change==='principal')h.principal('other');if(change==='runtime')h.replace();if(change==='epoch')h.service.invalidate();if(change==='stopped')h.stop();release();expect(await pending).toMatchObject({ok:false});
  });
  it('refuses missing identity/runtime/invalid Task before private reads', async () => {
    for(const state of ['identity','runtime','invalid']){const h=harness();if(state==='identity')h.principal(null);if(state==='runtime')h.stop();expect(await h.service.forTask(state==='invalid'?'../../secret':taskId)).toMatchObject({ok:false});expect(h.inspectEnvironment).not.toHaveBeenCalled();expect(h.forTask).not.toHaveBeenCalled();}
  });
  it('does not disclose route metadata for unknown or unauthorized Tasks', async () => {
    const h=harness();h.inspectEnvironment.mockImplementationOnce(async()=>{throw new Error('private metadata');});expect(await h.service.forTask(taskId)).toMatchObject({ok:false});expect(h.forTask).not.toHaveBeenCalled();
  });
});

describe('environment status-dependent parsing', () => {
  const base = {taskId,executionLabel:LOCAL_ENVIRONMENT,readiness:'ready',sandbox:'not-checked',remoteGate:REMOTE_GATE,hostedSandboxGate:'V2 revisit (OQ-13)'};
  const selected = {status:'selected',provider:'Provider',deployment:'deployment',endpoint:'https://example.test',model:'model',apiVersion:'version',region:'Unknown'};
  it.each(['provider','deployment','endpoint','model','apiVersion'])('rejects selected metadata missing %s', field => {
    expect(()=>parseTaskEnvironment({...base,inference:{...selected,[field]:null}})).toThrow();
  });
  it.each(['none','unavailable','stale'])('rejects contradictory %s metadata', status => {
    expect(()=>parseTaskEnvironment({...base,inference:{...selected,status}})).toThrow();
    expect(()=>parseTaskEnvironment({...base,inference:{status,provider:null,deployment:null,endpoint:null,model:null,apiVersion:null,region:'inferred-region'}})).toThrow();
  });
  it('retains Unknown for a selected explicit route', () => {
    expect(parseTaskEnvironment({...base,inference:selected}).inference.region).toBe('Unknown');
  });
});
