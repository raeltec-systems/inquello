import {describe,expect,it,vi} from 'vitest';
import {OrganiseService,type WorkspaceRoutes,type OrganiseRuntime} from '../src/main/organise';
import {RpcResponseError} from '../src/main/runtime';
const principal='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',taskId='33333333-3333-4333-8333-333333333333';
const input={workspaceId:workspace,taskId,query:null,turnId:null,itemId:null};
const task={taskId,workspaceId:workspace,engagementId:null,folderId:null,title:'Fictional retained Task',runtimeThreadId:null,sourceRefs:[],artifactRefs:[],visibility:'private',revision:1,pinned:false,archived:false};
const refusal=(kind='stale_snapshot',code=-32600,method='inquello/task/reopen')=>new RpcResponseError(method,code,'Fixed refusal',{inquello:{kind}});
function harness(){
 const state={principal:principal as string|null,instance:{} as object,ready:true,member:true,revision:'1'};
 const workspaces=vi.fn(async()=>({principal_id:principal,workspaces:state.member?[{workspace_id:workspace,name:'Fictional',kind:'internal_company',revision:state.revision,authorization_epoch:'1',policy_revision:'1',membership:{status:'active' as const,roles:['audit_lead'],policy_revision:'1',revision:'1'},engagements:[]}]:[]}));
 const reopen=vi.fn(async(_params?:unknown):Promise<unknown>=>({task,hit:null})),mutation=vi.fn(async()=>{throw refusal();});
 const request=vi.fn(async(method:string,params?:unknown)=>{if(method==='inquello/session/setPrincipal')return{};if(method==='inquello/task/reopen')return reopen(params);if(method==='inquello/task/setNavigation')return mutation();throw new Error('Unexpected operation');});
 const runtime:OrganiseRuntime={ready:()=>state.ready,instance:()=>state.instance,request:request as OrganiseRuntime['request']};
 const recover=vi.fn();
 const service=new OrganiseService({runtime,identity:{principalId:()=>state.principal,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>state.principal?fn('synthetic-access'):null},service:{workspaces,capabilities:vi.fn(),workspaceCommand:vi.fn(),acceptInvite:vi.fn()} satisfies WorkspaceRoutes,logger:{info:()=>{},warn:()=>{},error:()=>{}},recoverSession:recover});
 return{state,workspaces,reopen,mutation,request,recover,service};
}
describe('bounded fresh-authority saved Task reopen',()=>{
 it('retries native stale_snapshot exactly once with new before/after service checks',async()=>{
  const x=harness();x.reopen.mockRejectedValueOnce(refusal());
  expect(await x.service.reopen(input)).toEqual({ok:true,value:{task,hit:null}});
  expect(x.reopen).toHaveBeenCalledTimes(2);expect(x.workspaces).toHaveBeenCalledTimes(3);
  expect(x.request.mock.calls.map(call=>call[0])).toEqual(['inquello/session/setPrincipal','inquello/task/reopen','inquello/task/reopen']);
  expect(x.recover).not.toHaveBeenCalled();
 });
 it('does not loop after a second stale snapshot',async()=>{
  const x=harness();x.reopen.mockRejectedValue(refusal());expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(2);
 });
 it.each(['not_found','stale_hit','session_changed','authority_unknown','unauthenticated','revision_conflict'])('never retries native %s',async kind=>{
  const x=harness();x.reopen.mockRejectedValue(refusal(kind));expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(1);
 });
 it.each([refusal('stale_snapshot',-32001),refusal('stale_snapshot',-32600,'inquello/task/setNavigation'),new Error('stale_snapshot'),{rpcCode:-32600,data:{inquello:{kind:'stale_snapshot'}}}])('requires exact native typed method/code/kind',async error=>{
  const x=harness();x.reopen.mockRejectedValue(error);expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(1);
 });
 it.each(['principal','runtime','ready','membership','revision'] as const)('refuses %s change before the second read',async change=>{
  const x=harness();x.reopen.mockImplementationOnce(async()=>{
   if(change==='principal')x.state.principal=null;else if(change==='runtime')x.state.instance={};else if(change==='ready')x.state.ready=false;else if(change==='membership')x.state.member=false;else x.state.revision='2';
   throw refusal();
  });
  expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(1);expect(x.recover).not.toHaveBeenCalled();
 });
 it('refuses service failure before retry and does not bootstrap a replacement session',async()=>{
  const x=harness();x.reopen.mockImplementationOnce(async()=>{x.workspaces.mockRejectedValueOnce(new Error('Service unavailable'));throw refusal();});
  expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(1);expect(x.recover).not.toHaveBeenCalled();
 });
 it('checks authority after the successful second read',async()=>{
  const x=harness();x.reopen.mockRejectedValueOnce(refusal()).mockImplementationOnce(async()=>{x.state.revision='2';return{task,hit:null};});
  expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(2);
 });
 it('freezes exact foreground input across the native await',async()=>{
  const x=harness(),original={...input};x.reopen.mockImplementationOnce(async()=>{original.taskId=principal;throw refusal();});
  expect((await x.service.reopen(original)).ok).toBe(true);expect(x.reopen.mock.calls.map(call=>call[0])).toEqual([input,input]);
 });
 it('never retries navigation mutations even with stale_snapshot',async()=>{
  const x=harness();expect((await x.service.setNavigation({operationId:principal,workspaceId:workspace,taskId,expectedRevision:1,pinned:true,archived:false})).ok).toBe(false);
  expect(x.mutation).toHaveBeenCalledTimes(1);expect(x.reopen).not.toHaveBeenCalled();expect(x.recover).not.toHaveBeenCalled();
 });
 it('refuses malformed native saved data without another read',async()=>{
  const x=harness();x.reopen.mockResolvedValue({task:{...task,pinned:undefined},hit:null});expect((await x.service.reopen(input)).ok).toBe(false);expect(x.reopen).toHaveBeenCalledTimes(1);
 });
});
