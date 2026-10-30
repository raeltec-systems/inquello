import { describe, expect, it, vi } from 'vitest';
import { RouteService, type RouteServiceOptions } from '../src/main/routes/service';
import { configureRoutePayload, selectRoutePayload } from '../src/main/routes/validators';
import { parseRoute, type RouteView } from '../src/main/routes/types';
import { PermissionMediator } from '../src/main/policy/permissions';
import type { ProviderService } from '../src/main/providers';
const principal='11111111-1111-4111-8111-111111111111',taskId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const sentinel='sk-ant-SENTINEL-private-route-only';
export function fixture(id='claude-api-key'):RouteView{return{routeId:id,provider:id==='claude-api-key'?'Anthropic':'OpenAI',configurable:true,configuration:{routeId:id as 'claude-api-key',deployment:id==='claude-api-key'?'anthropic-direct':'openai-api',model:id==='claude-api-key'?'claude-sonnet-5-5':'gpt-6.1-sol',apiVersion:id==='claude-api-key'?'2026-10-21':'responses-v1',accountRef:principal,region:null},endpoint:id==='claude-api-key'?'https://api.anthropic.com/v1/messages':'https://api.openai.com/v1/responses',revision:1,credentialPresent:false,adapterSupported:true,verification:'not_verified',enabled:false,gate:'No passing route evidence',limits:['Text and runtime-owned tools only'],evidence:[],executionFlow:'This device',inferenceFlow:'Selected provider',connectorFlow:'Separate connection grants'};}
function setup(id='claude-api-key'){
 let owner:string|null=principal;const instance={};let ready=true;const route=fixture(id);let selected:unknown=null;
 const privateRouteAuth=vi.fn(async()=>({accepted:true}));const stop=vi.fn(async()=>{ready=false;});
 const request=vi.fn(async(method:string,params?:unknown):Promise<unknown>=>{
  if(method==='inquello/routes/list')return{routes:[route]};
  if(method==='inquello/routes/configure'){const p=params as {configuration:RouteView['configuration']};route.configuration=p.configuration;route.revision++;return{route,receipt:{}};}
  if(method==='inquello/routes/task/read'||method==='inquello/routes/task/set'){if(method.endsWith('/set'))selected=route;return{taskId:(params as {taskId:string}).taskId,workspaceId:principal,revision:selected?1:0,configurationRevision:selected?1:null,staleConfiguration:false,selected};}
  if(method==='inquello/routes/invalidate')return{accepted:true};
  if(method==='inquello/permissions/review')return{status:'human_required'};
  throw new Error('Unexpected RPC');
 });
 const freshPolicy=vi.fn(async()=>({workspaceId:principal,policyRevision:1,authorizationEpoch:1,execution:{automatic_permission_review:true}}));
 const options:RouteServiceOptions={runtime:{ready:()=>ready,instance:()=>instance,request:request as RouteServiceOptions['runtime']['request'],privateRouteAuth,stop},identity:{principalId:()=>owner},syncPrincipal:vi.fn(async()=>{}),providers:{routeCredentialChanging:()=>false,snapshot:()=>({claude:{state:'stored-unverified'},codex:{state:'connected'}}),handoffClaude:(send:(key:string)=>Promise<unknown>)=>send(sentinel)} as unknown as ProviderService,freshPolicy,applicableDataTier:async()=>'synthetic'};
 return{service:new RouteService(options),options,request,privateRouteAuth,stop,route,freshPolicy,signOut:()=>{owner=null;}};
}
describe('processing-route boundary',()=>{
 it('credential presence never upgrades evidence; private handoff only',async()=>{const h=setup();const result=await h.service.list();expect(result.ok).toBe(true);if(result.ok){expect(result.value[0]?.enabled).toBe(false);expect(result.value[0]?.verification).toBe('not_verified');expect(JSON.stringify(result)).not.toContain(sentinel);}expect(h.privateRouteAuth).toHaveBeenCalledWith(expect.objectContaining({apiKey:sentinel,routeId:'claude-api-key'}));expect(JSON.stringify(h.request.mock.calls)).not.toContain(sentinel);});
 it('Codex handoff never copies its OS-keyring key',async()=>{const h=setup('codex-responses');await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledWith(expect.objectContaining({apiKey:null,routeId:'codex-responses'}));});
 it('repeated reads do not replace in-flight credential generations',async()=>{const h=setup();await h.service.list();await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);});
 it('one refused provider handoff preserves both visible candidates without fallback',async()=>{const h=setup();h.privateRouteAuth.mockRejectedValueOnce(new Error(sentinel));const r=await h.service.list();expect(r.ok).toBe(true);if(r.ok){expect(r.value[0]?.enabled).toBe(false);expect(r.value[0]?.gate).toContain('could not bind');}expect(JSON.stringify(r)).not.toContain(sentinel);});
 it('runtime death invalidates local state, no implicit restart',async()=>{const h=setup();await h.service.list();h.service.runtimeUnavailable();expect((await h.service.list()).ok).toBe(false);expect(h.stop).not.toHaveBeenCalled();});
 it('invalidation is awaited and failed invalidation stops runtime',async()=>{const h=setup();h.request.mockRejectedValueOnce(new Error(sentinel));await h.service.invalidate('claude-api-key');expect(h.stop).toHaveBeenCalledOnce();expect((await h.service.list()).ok).toBe(false);});
 it('does not rebind credentials during replacement/logout',async()=>{const h=setup('codex-responses');h.options.providers.routeCredentialChanging=()=>true;await h.service.list();expect(h.privateRouteAuth).not.toHaveBeenCalled();});
 it('bounded invalidation stops an unresponsive runtime',async()=>{vi.useFakeTimers();try{const h=setup();h.request.mockImplementation(()=>new Promise(()=>{}));const pending=h.service.invalidate();await vi.advanceTimersByTimeAsync(5000);await pending;expect(h.stop).toHaveBeenCalledOnce();}finally{vi.useRealTimers();}});
 it('does not have a default Task selection',async()=>{const h=setup();const r=await h.service.forTask(taskId);expect(r.ok&&r.value.selected).toBe(null);});
 it('persists explicit expected-revision selection then reopens metadata',async()=>{const h=setup();await h.service.select({operationId:requestId,taskId,expectedRevision:0,routeId:'claude-api-key',configurationRevision:1});const r=await h.service.forTask(taskId);expect(r.ok&&r.value.selected?.configuration?.model).toBe('claude-sonnet-5-5');});
 it('never forwards an account reference or evidence from renderer configure',()=>{const base={operationId:requestId,expectedRevision:0,routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:null};expect(configureRoutePayload([base])).toEqual(base);for(const extra of [{accountRef:sentinel},{enabled:true},{verification:'verified_for_real_data'},{endpoint:'http://localhost'}])expect(()=>configureRoutePayload([{...base,...extra}])).toThrow();});
 it('refuses unsupported models/settings before dispatch',()=>{const base={operationId:requestId,expectedRevision:0,routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:null};expect(()=>configureRoutePayload([{...base,model:'latest'}])).toThrow();expect(()=>configureRoutePayload([{...base,temperature:1}])).toThrow();});
 it('route select accepts neither principal nor automatic verdict',()=>{const base={operationId:requestId,taskId,expectedRevision:0,routeId:'claude-api-key',configurationRevision:1};expect(selectRoutePayload([base])).toEqual(base);expect(()=>selectRoutePayload([{...base,principalId:principal}])).toThrow();});
 it('drops late list after identity changes',async()=>{const h=setup();let release!:(v:unknown)=>void;h.request.mockImplementationOnce(()=>new Promise(r=>{release=r;}));const pending=h.service.list();await vi.waitFor(()=>expect(release).toBeTypeOf('function'));h.signOut();release({routes:[h.route]});expect((await pending).ok).toBe(false);expect(h.privateRouteAuth).not.toHaveBeenCalled();});
 it('signed-out reads clear the runtime principal instead of leaving old auth usable',async()=>{const h=setup();await h.service.list();h.signOut();expect((await h.service.list()).ok).toBe(false);expect(h.options.syncPrincipal).toHaveBeenCalledTimes(2);});
 it('never forwards raw runtime errors or secrets',async()=>{const h=setup();h.request.mockRejectedValue(new Error(sentinel));const r=await h.service.list();expect(JSON.stringify(r)).not.toContain(sentinel);expect(r.ok).toBe(false);});
 it('fails closed for malformed or contradictory evidence',()=>{expect(()=>parseRoute({...fixture(),enabled:true})).toThrow();expect(()=>parseRoute({...fixture(),verification:'maybe'})).toThrow();});
});
describe('two-phase scoped permission review',()=>{
 it('unknown Task data tier never infers synthetic from configured route',async()=>{const h=setup();h.options.applicableDataTier=undefined;expect(await h.service.review(taskId,requestId)).toBe(null);expect(h.request.mock.calls.find(c=>c[0]==='inquello/permissions/review')?.[1]).toMatchObject({dataTier:'unknown'});});
 for(const id of ['claude-api-key','codex-responses'])it(`fresh authority before application on ${id}; no verdict input`,async()=>{const h=setup(id);const base=h.request.getMockImplementation()!;h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?{status:'ready'}:m==='inquello/permissions/reviewApply'?{status:'decided',request:{requestId,taskId,decision:{actorKind:'automated_reviewer',outcome:'allowed'}}}:base(m,p));expect(await h.service.review(taskId,requestId)).toBe('allowed');expect(h.freshPolicy).toHaveBeenCalledTimes(2);const apply=h.request.mock.calls.find(c=>c[0].endsWith('reviewApply'));expect(apply?.[1]).toEqual({requestId,workspacePolicy:expect.any(Object),authorityEpoch:1,dataTier:'synthetic'});expect(JSON.stringify(apply)).not.toContain('verdict');});
 it('unverified route goes to human without alternate provider',async()=>{const h=setup();expect(await h.service.review(taskId,requestId)).toBe(null);expect(h.request.mock.calls.filter(c=>c[0].endsWith('reviewApply'))).toHaveLength(0);});
 it('default-off uses runtime policy mediation without enabling inference',async()=>{const h=setup();h.freshPolicy.mockResolvedValue({workspaceId:principal,policyRevision:1,authorizationEpoch:1,execution:{automatic_permission_review:false}});expect(await h.service.review(taskId,requestId)).toBe(null);expect(h.request.mock.calls.find(c=>c[0]==='inquello/permissions/review')?.[1]).toMatchObject({workspacePolicy:{execution:{automatic_permission_review:false}}});});
 it('revocation during model latency discards late ready result',async()=>{const h=setup();const base=h.request.getMockImplementation()!;h.request.mockImplementation(async(m,p)=>{if(m==='inquello/permissions/review'){h.signOut();return{status:'ready'};}return base(m,p);});expect(await h.service.review(taskId,requestId)).toBe('denied');expect(h.request.mock.calls.some(c=>c[0].endsWith('reviewApply'))).toBe(false);});
 it('authority unavailable before apply refuses rather than asking with stale policy',async()=>{const h=setup();h.options.freshPolicy=vi.fn().mockResolvedValueOnce({workspaceId:principal,policyRevision:1,authorizationEpoch:1,execution:{automatic_permission_review:true}}).mockResolvedValue(null);const base=h.request.getMockImplementation()!;h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?{status:'ready'}:base(m,p));expect(await h.service.review(taskId,requestId)).toBe('denied');expect(h.request.mock.calls.some(c=>c[0].endsWith('reviewApply'))).toBe(false);});
 it('malformed automated actor/outcome cannot grant',async()=>{const h=setup();const base=h.request.getMockImplementation()!;h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?{status:'decided',request:{requestId,taskId,decision:{actorKind:'human',outcome:'allowed'}}}:base(m,p));expect(await h.service.review(taskId,requestId)).toBe(null);});
 it('reviewer refusal never widens or falls back',async()=>{const h=setup();const base=h.request.getMockImplementation()!;h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?{status:'refused'}:base(m,p));expect(await h.service.review(taskId,requestId)).toBe('denied');});
 it('human mediator remains usable when review is unavailable',async()=>{const runtime={request:vi.fn(async()=>({request:{requestId}}))};const mediator=new PermissionMediator({runtime:runtime as never,logger:{info(){},warn(){},error(){}},newId:()=>requestId,automatedReview:async()=>null});const promise=mediator.ask({taskId,workspacePolicy:{} as never,command:['pwd'],origin:'tools_exec'});await vi.waitFor(()=>expect(mediator.waiting(requestId)).toBe(true));mediator.declineAll();expect(await promise).toEqual({ok:true,requestId,outcome:'denied'});});
});


describe('Task-scoped route epochs and current classification',()=>{
 it('selecting Task A preserves Task B reviewer and unchanged credential binding',async()=>{
  const h=setup();const base=h.request.getMockImplementation()!;
  let release!:(value:unknown)=>void;
  h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?new Promise(resolve=>{release=resolve;}):m==='inquello/permissions/reviewApply'?{status:'decided',request:{requestId,taskId,decision:{actorKind:'automated_reviewer',outcome:'allowed'}}}:base(m,p));
  const reviewing=h.service.review(taskId,requestId);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
  expect((await h.service.select({operationId:requestId,taskId:principal,expectedRevision:0,routeId:'claude-api-key',configurationRevision:1})).ok).toBe(true);
  await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);
  release({status:'ready'});expect(await reviewing).toBe('allowed');
 });
 it('selecting the reviewed Task rejects late output without reassigning credentials',async()=>{
  const h=setup();const base=h.request.getMockImplementation()!;let release!:(value:unknown)=>void;
  h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?new Promise(resolve=>{release=resolve;}):base(m,p));
  const reviewing=h.service.review(taskId,requestId);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
  await h.service.select({operationId:requestId,taskId,expectedRevision:0,routeId:'claude-api-key',configurationRevision:1});
  release({status:'ready'});expect(await reviewing).toBe('denied');expect(h.request.mock.calls.some(c=>c[0].endsWith('reviewApply'))).toBe(false);
 });
 for(const tier of ['unknown','real'] as const)it(`fresh ${tier} classification replaces synthetic before atomic apply`,async()=>{
  const h=setup();h.options.applicableDataTier=vi.fn().mockResolvedValueOnce('synthetic').mockResolvedValue(tier);const base=h.request.getMockImplementation()!;
  h.request.mockImplementation(async(m,p)=>m==='inquello/permissions/review'?{status:'ready'}:m==='inquello/permissions/reviewApply'?{status:'human_required'}:base(m,p));
  expect(await h.service.review(taskId,requestId)).toBe(null);expect(h.options.applicableDataTier).toHaveBeenCalledTimes(2);
  expect(h.request.mock.calls.find(c=>c[0].endsWith('reviewApply'))?.[1]).toMatchObject({dataTier:tier});
 });
 it('task-scoped invalidation does not rebind unchanged credentials',async()=>{const h=setup();await h.service.list();await h.service.invalidate(null,taskId);await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);});
});


it('failed fresh policy cannot return a stale human grant path',async()=>{
 const h=setup();h.options.freshPolicy=async()=>{throw new Error('unavailable');};
 expect(await h.service.review(taskId,requestId)).toBe('denied');
 expect(h.request.mock.calls.some(c=>c[0]==='inquello/permissions/review')).toBe(false);
});
it('failed classification is sent as unknown for current runtime policy handling',async()=>{
 const h=setup();h.options.applicableDataTier=async()=>{throw new Error('classification unavailable');};
 expect(await h.service.review(taskId,requestId)).toBe(null);
 expect(h.request.mock.calls.find(c=>c[0]==='inquello/permissions/review')?.[1]).toMatchObject({dataTier:'unknown'});
});
