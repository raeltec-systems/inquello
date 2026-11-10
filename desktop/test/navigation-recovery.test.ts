import {describe,expect,it,vi} from 'vitest';
import {OrganiseService,treePayload,type WorkspaceRoutes,type OrganiseRuntime} from '../src/main/organise';
import {RpcResponseError} from '../src/main/runtime';
const principal='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
function harness(){
 const state={principal:principal as string|null,instance:{} as object,ready:true,member:true};
 const workspaces=vi.fn(async()=>({principal_id:principal,workspaces:state.member?[{workspace_id:workspace,name:'Fictional',kind:'internal_company',revision:'1',authorization_epoch:'1',policy_revision:'1',membership:{status:'active' as const,roles:['audit_lead'],policy_revision:'1',revision:'1'},engagements:[]}]:[]}));
 const recover=vi.fn(async(_workspace:string)=>{});
 const request=vi.fn(async(method:string,_params?:unknown)=>{if(method==='inquello/session/setPrincipal')return{};if(method==='inquello/workspace/tree')return{workspaceId:workspace,engagements:[],folders:[],tasks:[]};throw new Error('Unexpected runtime operation');});
 const runtime:OrganiseRuntime={ready:()=>state.ready,instance:()=>state.instance,request:request as OrganiseRuntime['request']};
 const service=new OrganiseService({runtime,identity:{principalId:()=>state.principal,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>state.principal?fn('fictional-access'):null},service:{workspaces,capabilities:vi.fn(),workspaceCommand:vi.fn(),acceptInvite:vi.fn()} satisfies WorkspaceRoutes,logger:{info:()=>{},warn:()=>{},error:()=>{}},recoverSession:recover});
 return{state,workspaces,recover,request,service};
}
describe('explicit navigation session recovery',()=>{
 it('reauthorizes before and after owner bootstrap without issuing any read or mutation itself',async()=>{
  const h=harness();expect(await h.service.recoverNavigation(workspace)).toEqual({ok:true,value:{accepted:true}});
  expect(h.recover).toHaveBeenCalledWith(workspace);expect(h.workspaces).toHaveBeenCalledTimes(2);
  expect(h.request.mock.calls.map(c=>c[0])).toEqual(['inquello/session/setPrincipal']);
  expect((await h.service.getTree(workspace)).ok).toBe(true);
  expect(h.request.mock.calls.map(c=>c[0])).toEqual(['inquello/session/setPrincipal','inquello/workspace/tree']);
 });
 it('does not bootstrap revoked membership or unavailable service',async()=>{
  const h=harness();h.state.member=false;expect((await h.service.recoverNavigation(workspace)).ok).toBe(false);expect(h.recover).not.toHaveBeenCalled();
  h.state.member=true;h.workspaces.mockRejectedValueOnce(new Error('Service unavailable'));expect((await h.service.recoverNavigation(workspace)).ok).toBe(false);expect(h.recover).not.toHaveBeenCalled();
 });
 it.each(['principal','runtime','membership'] as const)('refuses recovery changed during bootstrap: %s',async(change)=>{
  const h=harness();h.recover.mockImplementationOnce(async()=>{if(change==='principal')h.state.principal=null;else if(change==='runtime')h.state.instance={};else h.state.member=false;});
  expect((await h.service.recoverNavigation(workspace)).ok).toBe(false);expect(h.request.mock.calls.every(c=>c[0]==='inquello/session/setPrincipal')).toBe(true);
 });
 it('coalesces same-scope explicit recovery, refuses overlapping other Workspace, and never caches completed authority',async()=>{
  const h=harness();let release!:()=>void;h.recover.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
  const a=h.service.recoverNavigation(workspace),b=h.service.recoverNavigation(workspace);expect(a).toBe(b);
  await vi.waitFor(()=>expect(h.recover).toHaveBeenCalledTimes(1));
  expect((await h.service.recoverNavigation(principal)).ok).toBe(false);release();expect((await a).ok).toBe(true);
  expect((await h.service.recoverNavigation(workspace)).ok).toBe(true);expect(h.recover).toHaveBeenCalledTimes(2);
 });
 it('preserves refused native recovery and does not claim a running runtime stopped',async()=>{
  const h=harness();h.recover.mockRejectedValue(new RpcResponseError('inquello/tasks/bootstrap',-32600,'refused',{inquello:{kind:'stale_authority'}}));
  const result=await h.service.recoverNavigation(workspace);expect(result.ok).toBe(false);if(!result.ok)expect(result.reason).not.toContain('not running');
  h.state.ready=false;const offline=await h.service.recoverNavigation(workspace);expect(offline.ok).toBe(false);if(!offline.ok)expect(offline.reason).toContain('not running');
 });
 it('named bridge payload permits only a Workspace ID, never authority/root/tier/session fields',()=>{
  expect(treePayload([{workspaceId:workspace}])).toEqual({workspaceId:workspace});
  for(const key of ['isolatedRoot','principalId','realSession','recoveryOnly','dataTier'])expect(()=>treePayload([{workspaceId:workspace,[key]:'forbidden'}])).toThrow();
 });
});
