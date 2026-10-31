import {describe,it,expect,vi} from 'vitest';
import {TaskService} from '../src/main/tasks/service';
import {taskStartPayload,taskPreflightPayload} from '../src/main/tasks/validators';
const id='11111111-1111-4111-8111-111111111111',op='22222222-2222-4222-8222-222222222222';
const command={workspaceId:id,routeId:'codex-responses' as const,configurationRevision:2,operationId:op,engagementId:null,folderId:null,request:'  Reconcile R01 and R03.\n',reasoning:'default',speed:'default'};
function setup(){let principal:string|null=id;const calls:{method:string;params:unknown}[]=[];let answer:unknown={operationId:op,taskId:id,runId:op,threadId:id,status:'running',request:command.request,accepted:true};const request=vi.fn(async(method:string,params:unknown)=>{calls.push({method,params});return answer;});const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>({workspaceId:id,authorizationEpoch:3} as never)});return{service,calls,request,setPrincipal:(value:string|null)=>{principal=value;},setAnswer:(v:unknown)=>{answer=v;}};}
describe('private Task named orchestration',()=>{
 it('preserves exact canonical request and explicit defaults; main adds authority',async()=>{const x=setup();expect((await x.service.start(command)).ok).toBe(true);expect(x.calls).toHaveLength(1);expect(x.calls[0]).toEqual({method:'inquello/tasks/start',params:{...command,workspacePolicy:{workspaceId:id,authorizationEpoch:3}}});});
 it('lost acknowledgment never dispatches another turn during reconciliation',async()=>{const x=setup();x.request.mockRejectedValueOnce(new Error('private request should not escape'));const result=await x.service.start(command);expect(result).toMatchObject({ok:false,code:'uncertain'});expect(JSON.stringify(result)).not.toContain('private request should not escape');await x.service.reconcile(op);expect(x.calls.map(v=>v.method)).toEqual(['inquello/tasks/reconcile']);expect(x.request).toHaveBeenCalledTimes(2);});
 it('suppresses results after sign-out during the native wait',async()=>{const x=setup();x.request.mockImplementationOnce(async()=>{x.setPrincipal(null);return {operationId:op,taskId:id,runId:op,threadId:id,status:'running',request:command.request,accepted:true};});expect(await x.service.start(command)).toMatchObject({ok:false});});
 it('does not dispatch when fresh authority is unknown',async()=>{const request=vi.fn();const x=new TaskService({runtime:{ready:()=>true,instance:()=>1,request},identity:{principalId:()=>id},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>null});expect(await x.start(command)).toMatchObject({ok:false,code:'refused'});expect(request).not.toHaveBeenCalled();});
 it('rejects changed echoed request rather than clearing the draft',async()=>{const x=setup();x.setAnswer({operationId:op,taskId:id,runId:op,threadId:id,status:'running',request:'different',accepted:true});expect(await x.service.start(command)).toMatchObject({ok:false,code:'uncertain'});});
 it('preflight uses no create/turn RPC and cannot silently swap route revisions',async()=>{const x=setup();x.setAnswer({routeId:'codex-responses',configurationRevision:3,reasoning:['default'],speeds:['default'],available:true,reason:'',executionFlow:'This device',inferenceFlow:'OpenAI'});expect(await x.service.preflight(command)).toMatchObject({ok:false});expect(x.calls.map(v=>v.method)).toEqual(['inquello/tasks/preflight']);});
 it('renderer cannot supply identity, thread, policy or classification',()=>{expect(taskStartPayload([command])).toEqual(command);for(const key of ['principalId','threadId','workspacePolicy','dataTier'])expect(()=>taskStartPayload([{...command,[key]:id}])).toThrow();expect(()=>taskStartPayload([{...command,request:' \n '}])).toThrow();expect(()=>taskPreflightPayload([{workspaceId:id,routeId:'codex-responses'}])).toThrow();});
 it('unknown threads receive no permission route',async()=>{const x=setup();expect(await x.service.permissionRoute(id)).toBeNull();expect(x.request).not.toHaveBeenCalled();});
});

describe('native bound model permissions',()=>{
 it('uses trusted native thread association, not a renderer task mapping',async()=>{
  let principal:string|null=id;const ask=vi.fn(async()=> 'allowed' as const);const request=vi.fn(async()=>({taskId:id,runId:op,threadId:op,status:'running'}));
  const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>null,askPermission:ask});
  const route=await service.permissionRoute(op);expect(request).toHaveBeenCalledWith('inquello/tasks/forThread',{threadId:op});expect(await route!.ask(['echo','fictional'])).toBe('allowed');expect(ask).toHaveBeenCalledWith(id,['echo','fictional']);principal=null;expect(await route!.ask(['echo','later'])).toBe('denied');expect(ask).toHaveBeenCalledTimes(1);
 });
 it('declines mismatched native thread and never invokes mediator',async()=>{
  const ask=vi.fn();const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:async()=>({taskId:id,threadId:id}) as never},identity:{principalId:()=>id},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>null,askPermission:ask});expect(await service.permissionRoute(op)).toBeNull();expect(ask).not.toHaveBeenCalled();
 });
});

describe('fresh native authority callback',()=>{
 it('never accepts renderer-shaped authority and suppresses stale service responses',async()=>{let principal:string|null=id;const fresh=vi.fn(async()=>{principal=null;return{workspaceId:id} as never;});const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:vi.fn()},identity:{principalId:()=>principal},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:fresh});expect(await service.authority({workspaceId:id,principalId:id})).toEqual({workspacePolicy:null});expect(fresh).not.toHaveBeenCalled();expect(await service.authority({workspaceId:id})).toEqual({workspacePolicy:null});});
 it('bounds UTF-8 byte length and refuses non-text control characters before native dispatch',()=>{expect(()=>taskStartPayload([{...command,request:'é'.repeat(65537)}])).toThrow();expect(()=>taskStartPayload([{...command,request:'R01\u0001'}])).toThrow();expect(()=>taskStartPayload([{...command,configurationRevision:0}])).toThrow();});
});

it('registers reconciled accepted bindings and triggers the same acceptance callback',async()=>{
 const accepted=vi.fn();const request=vi.fn(async(method:string)=>method==='inquello/tasks/forThread'?{taskId:id,threadId:id}:{operationId:op,taskId:id,runId:op,threadId:id,status:'running',request:command.request,accepted:true});
 const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>id},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>null,onAccepted:accepted});
 expect((await service.reconcile(op)).ok).toBe(true);expect(accepted).toHaveBeenCalledTimes(1);expect(await service.applicableDataTier(id)).toBe('synthetic');
 service.invalidate();expect(await service.applicableDataTier(id)).toBe('unknown');
});
