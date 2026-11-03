import {taskBindingFixture} from './model-fixtures';
import { describe, expect, it, vi } from 'vitest';
import {CodexAccount} from '../src/main/providers/codex-account';
import {TaskService} from '../src/main/tasks/service';
import { RouteService, type RouteServiceOptions } from '../src/main/routes/service';
import { configureRoutePayload, selectRoutePayload, resolveModelPayload, bindingStatePayload, selectModelPayload } from '../src/main/routes/validators';
import {modelCatalog,taskRouteView} from './model-fixtures';
import { parseRoute,parseTaskRoute, type RouteView } from '../src/main/routes/types';
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
  if(method==='inquello/routes/task/read'||method==='inquello/routes/task/set'){if(method.endsWith('/set'))selected=route;return taskRouteView({taskId:(params as {taskId:string}).taskId,workspaceId:principal,revision:selected?1:0,configurationRevision:selected?1:null,staleConfiguration:false,selected:selected as RouteView|null});}
  if(method==='inquello/routes/invalidate')return{accepted:true};
  if(method==='inquello/permissions/review')return{status:'human_required'};
  throw new Error('Unexpected RPC');
 });
 const freshPolicy=vi.fn(async()=>({workspaceId:principal,policyRevision:1,authorizationEpoch:1,execution:{automatic_permission_review:true}}));
 const options:RouteServiceOptions={taskBinding:async()=>({routeId:route.routeId,configurationRevision:route.revision,disclosureBindings:[{routeId:route.routeId,configurationRevision:route.revision,active:true}]}),runtime:{ready:()=>ready,instance:()=>instance,request:request as RouteServiceOptions['runtime']['request'],privateRouteAuth,stop},identity:{principalId:()=>owner},syncPrincipal:vi.fn(async()=>{}),providers:{routeCredentialChanging:()=>false,snapshot:()=>({claude:{state:'stored-unverified'},codex:{state:'connected'}}),handoffClaude:(send:(key:string)=>Promise<unknown>)=>send(sentinel)} as unknown as ProviderService,freshPolicy,applicableDataTier:async()=>'synthetic'};
 return{service:new RouteService(options),options,request,privateRouteAuth,stop,route,freshPolicy,signOut:()=>{owner=null;},signIn:(id:string)=>{owner=id;}};
}
describe('processing-route boundary',()=>{
 it('credential presence never upgrades evidence; private handoff only',async()=>{const h=setup();const result=await h.service.list();expect(result.ok).toBe(true);if(result.ok){expect(result.value[0]?.enabled).toBe(false);expect(result.value[0]?.verification).toBe('not_verified');expect(JSON.stringify(result)).not.toContain(sentinel);}expect(h.privateRouteAuth).toHaveBeenCalledWith(expect.objectContaining({apiKey:sentinel,routeId:'claude-api-key'}));expect(JSON.stringify(h.request.mock.calls)).not.toContain(sentinel);});
 it('Codex handoff never copies its OS-keyring key',async()=>{const h=setup('codex-responses');await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledWith(expect.objectContaining({apiKey:null,routeId:'codex-responses'}));});
 it('repeated reads do not replace in-flight credential generations',async()=>{const h=setup();await h.service.list();await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);});
 it('one refused provider handoff preserves both visible candidates without fallback',async()=>{const h=setup();h.privateRouteAuth.mockRejectedValueOnce(new Error(sentinel));const r=await h.service.list();expect(r.ok).toBe(true);if(r.ok){expect(r.value[0]?.enabled).toBe(false);expect(r.value[0]?.gate).toContain('Reconnect the provider in Settings');}expect(JSON.stringify(r)).not.toContain(sentinel);});
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

describe('cached named model bindings',()=>{
 it('reads cached metadata with local principal binding and zero provider status, refresh or credential handoff',async()=>{
  const h=setup(),catalog=modelCatalog([h.route]);const getStatus=vi.fn(),handoff=vi.fn();h.options.providers.getStatus=getStatus;h.options.providers.handoffClaude=handoff;
  h.request.mockResolvedValue({catalogVersion:catalog.catalogVersion,choices:catalog.choices,bindings:catalog.bindings});
  expect(await h.service.catalog()).toEqual({ok:true,value:catalog});expect(h.request).toHaveBeenCalledWith('inquello/models/catalog',{});expect(h.request).toHaveBeenCalledTimes(1);expect(h.options.syncPrincipal).toHaveBeenCalledOnce();expect(getStatus).not.toHaveBeenCalled();expect(handoff).not.toHaveBeenCalled();expect(h.privateRouteAuth).not.toHaveBeenCalled();
 });
 it('creating another same-provider model retains the credential lifetime and does not invalidate authority',async()=>{
  const h=setup('codex-responses');await h.service.list();const base=h.request.getMockImplementation()!,binding={...modelCatalog([h.route]).bindings[0]!,name:'gpt-6.1-terra',configurationRevision:2};
  h.options.onChanged=vi.fn();h.options.onCatalogChanged=vi.fn();h.request.mockImplementation(async(method,params)=>{if(method==='inquello/models/resolve'){h.route.revision=2;h.route.configuration={...h.route.configuration!,model:binding.name};return{binding,receipt:{replayed:false},affectedTaskIds:[]};}return base(method,params);});
  expect((await h.service.resolve({operationId:requestId,catalogVersion:'c'.repeat(64),choiceId:'a'.repeat(64)})).ok).toBe(true);await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);expect(h.options.onChanged).not.toHaveBeenCalled();expect(h.options.onCatalogChanged).toHaveBeenCalledOnce();
 });
 it('scoped revoke rejects an A result already received by main while B review and credentials remain current',async()=>{
  const h=setup(),base=h.request.getMockImplementation()!,taskB='44444444-4444-4444-8444-444444444444',requestB='55555555-5555-4555-8555-555555555555';
  let release!:(value:unknown)=>void;const reads=new Map<string,number>();const policy=await h.freshPolicy();h.options.freshPolicy=vi.fn(async task=>{const count=(reads.get(task)??0)+1;reads.set(task,count);return task===taskId&&count===2?new Promise(resolve=>{release=resolve;}):policy;});
  const binding={...modelCatalog([h.route]).bindings[0]!,state:'revoked',stateRevision:2,available:false,reason:'Revoked'};
  h.request.mockImplementation(async(method,params)=>{if(method==='inquello/permissions/review')return{status:'ready'};if(method==='inquello/permissions/reviewApply'){const p=params as {requestId:string};return{status:'decided',request:{requestId:p.requestId,taskId:p.requestId===requestB?taskB:taskId,decision:{actorKind:'automated_reviewer',outcome:'allowed'}}};}if(method==='inquello/models/binding/state')return{binding,affectedTaskIds:[taskId]};return base(method,params);});
  const reviewing=h.service.review(taskId,requestId);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));
  expect(await h.service.review(taskB,requestB)).toBe('allowed');
  expect((await h.service.bindingState({operationId:requestId,bindingId:binding.bindingId,expectedRevision:1,state:'revoked'})).ok).toBe(true);release(policy);expect(await reviewing).toBe('denied');
  expect(h.request.mock.calls.filter(([method,params])=>method==='inquello/permissions/reviewApply'&&(params as {requestId:string}).requestId===requestId)).toHaveLength(0);expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);
 });
 it('new opaque operations refuse renderer credentials, vendor identity and technical fields',()=>{
  const resolve={operationId:requestId,catalogVersion:'c'.repeat(64),choiceId:'a'.repeat(64)},state={operationId:requestId,bindingId:principal,expectedRevision:1,state:'revoked'},select={operationId:requestId,bindingId:principal,taskId,expectedRevision:3};
  expect(resolveModelPayload([resolve])).toEqual(resolve);expect(bindingStatePayload([state])).toEqual(state);expect(selectModelPayload([select])).toEqual(select);
  for(const extra of [{accountRef:principal},{apiKey:sentinel},{endpoint:'https://invalid.example'},{deployment:'openai-api'},{apiVersion:'responses-v1'},{principalId:principal},{enabled:true}])for(const [validator,input]of [[resolveModelPayload,resolve],[bindingStatePayload,state],[selectModelPayload,select]] as const)expect(()=>validator([{...input,...extra}])).toThrow();
 });
});

it('recovers applied resolve before any catalog or credential preflight after an ambiguous result',async()=>{
 const h=setup(),binding=modelCatalog([h.route]).bindings[0]!,input={operationId:requestId,catalogVersion:'c'.repeat(64),choiceId:'a'.repeat(64)};
 let applied=false;h.request.mockImplementation(async(method,params)=>{if(method==='inquello/models/resolve'){expect(params).toEqual(input);if(!applied){applied=true;throw new Error('Response lost after commit');}return{binding,receipt:{replayed:true}};}throw new Error('Catalog and credentials no longer available');});
 expect((await h.service.resolve(input)).ok).toBe(false);expect(await h.service.pendingModel(null)).toEqual({ok:true,value:{operation:{kind:'resolve',input}}});
 expect((await h.service.resolve({...input,operationId:taskId})).ok).toBe(false);expect(h.request).toHaveBeenCalledTimes(1);
 h.options.providers.handoffClaude=vi.fn(async()=>{throw new Error('Credential lost');});h.options.providers.getStatus=vi.fn(async()=>{throw new Error('Provider unavailable');});
 expect(await h.service.resolve(input)).toEqual({ok:true,value:binding});expect(await h.service.pendingModel(null)).toEqual({ok:true,value:{operation:null}});
 expect(h.request.mock.calls.map(([method])=>method)).toEqual(['inquello/models/resolve','inquello/models/resolve']);expect(h.privateRouteAuth).not.toHaveBeenCalled();expect(h.options.providers.handoffClaude).not.toHaveBeenCalled();expect(h.options.providers.getStatus).not.toHaveBeenCalled();
});
it('isolates pending model commands by principal and conversation across navigation',async()=>{
 const h=setup(),input={operationId:requestId,bindingId:principal,taskId,expectedRevision:3};h.request.mockRejectedValue(new Error('Lost reply'));
 await h.service.selectModel(input);expect(await h.service.pendingModel(taskId)).toEqual({ok:true,value:{operation:{kind:'select',input}}});expect(await h.service.pendingModel(null)).toEqual({ok:true,value:{operation:null}});
 h.signOut();expect((await h.service.pendingModel(taskId)).ok).toBe(false);h.signIn('44444444-4444-4444-8444-444444444444');expect(await h.service.pendingModel(taskId)).toEqual({ok:true,value:{operation:null}});
 h.signIn(principal);expect(await h.service.pendingModel(taskId)).toEqual({ok:true,value:{operation:{kind:'select',input}}});
});

it('binding state receipt replay does not invalidate later authorized work twice',async()=>{
 const h=setup(),binding={...modelCatalog([h.route]).bindings[0]!,stateRevision:2};h.options.onChanged=vi.fn();h.options.onBindingChanged=vi.fn();
 h.request.mockResolvedValue({binding,receipt:{replayed:true},affectedTaskIds:[taskId]});const input={operationId:requestId,bindingId:binding.bindingId,expectedRevision:1,state:'active' as const};
 expect((await h.service.bindingState(input)).ok).toBe(true);expect((await h.service.bindingState(input)).ok).toBe(true);expect(h.options.onChanged).toHaveBeenCalledTimes(1);expect(h.options.onBindingChanged).toHaveBeenCalledTimes(1);
});

it('starts a new Task on original Terra A after same-provider Sol B exists without rotating credentials',async()=>{
 const h=setup('codex-responses');h.route.configuration={...h.route.configuration!,model:'gpt-6.1-terra'};await h.service.list();
 const base=h.request.getMockImplementation()!,binding={...modelCatalog([h.route]).bindings[0]!,name:'gpt-6.1-sol',configurationRevision:2};
 const command={operationId:requestId,workspaceId:principal,engagementId:null,folderId:null,routeId:'codex-responses' as const,configurationRevision:1,reasoning:'default',speed:'default',request:'Fictional new Terra Task after Sol exists'};
 h.request.mockImplementation(async(method,params)=>{if(method==='inquello/models/resolve'){h.route.revision=2;h.route.configuration={...h.route.configuration!,model:binding.name};return{binding,receipt:{replayed:false}};}if(method==='inquello/tasks/preflight')return{routeId:command.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'This device',inferenceFlow:'OpenAI'};if(method==='inquello/tasks/start')return{operationId:requestId,taskId,runId:requestId,threadId:taskId,status:'running',request:command.request,accepted:true};return base(method,params);});
 const tasks=new TaskService({taskBinding:taskBindingFixture,runtime:h.options.runtime,identity:h.options.identity,syncPrincipal:h.options.syncPrincipal,prepareRoutes:()=>h.service.list(),freshPolicy:async()=>await h.freshPolicy() as never});h.options.onChanged=()=>tasks.invalidate();
 expect((await h.service.resolve({operationId:principal,catalogVersion:'c'.repeat(64),choiceId:'a'.repeat(64)})).ok).toBe(true);
 expect((await tasks.preflight(command)).ok).toBe(true);expect((await tasks.start(command)).ok).toBe(true);
 expect(h.request.mock.calls.find(([method])=>method==='inquello/tasks/start')?.[1]).toMatchObject({routeId:'codex-responses',configurationRevision:1,request:command.request});expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);
});

it.each(['accepted','rejected','stale'] as const)('rebinds a saved OpenAI model after actual CodexAccount reset only on current cached native acceptance (%s)',async outcome=>{
 const h=setup('codex-responses'),accountRpc=vi.fn(async()=>{throw new Error('No account refresh or network inspection is needed');});
 const codex=new CodexAccount({runtime:{ready:()=>true,request:accountRpc},openBrowser:vi.fn(),logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()} as never});
 codex.confirmPrivateBinding();expect(codex.snapshot().state).toBe('connected');codex.runtimeReset();expect(codex.snapshot().state).toBe('not-connected');
 Object.defineProperty(h.options.providers,'codex',{value:codex});h.options.providers.snapshot=()=>({claude:{state:'not-configured',storage:'memory-only'},codex:codex.snapshot()});
 let done!:(value:{accepted:boolean})=>void;if(outcome==='rejected')h.privateRouteAuth.mockRejectedValueOnce(new Error('Cached native credential unavailable'));if(outcome==='stale')h.privateRouteAuth.mockImplementationOnce(()=>new Promise(resolve=>{done=resolve;}));
 const pending=h.service.list();if(outcome==='stale'){await vi.waitFor(()=>expect(done).toBeTypeOf('function'));h.signOut();done({accepted:true});}await pending;
 expect(h.privateRouteAuth).toHaveBeenCalledWith(expect.objectContaining({routeId:'codex-responses',apiKey:null,accountRef:principal}));expect(accountRpc).not.toHaveBeenCalled();
 expect(codex.snapshot().state).toBe(outcome==='accepted'?'connected':'not-connected');if(outcome==='accepted')expect(codex.snapshot().account).toEqual({type:'other'});
});

it.each([false,true])('revoke fences reviewer A omitted from the bounded task list and preserves B before and after A settles (history=%s)',async history=>{
 const h=setup(),other='44444444-4444-4444-8444-444444444444',requestB='55555555-5555-4555-8555-555555555555',base=h.request.getMockImplementation()!;
 h.options.taskBinding=async task=>({routeId:'claude-api-key',configurationRevision:history?2:task===taskId?1:2,disclosureBindings:(history&&task===taskId?[1,2]:[history?2:task===taskId?1:2]).map(configurationRevision=>({routeId:'claude-api-key',configurationRevision,active:true}))});let release!:(value:unknown)=>void;const reads=new Map<string,number>(),policy=await h.freshPolicy();h.options.freshPolicy=vi.fn(async task=>{const count=(reads.get(task)??0)+1;reads.set(task,count);return task===taskId&&count===2?new Promise(resolve=>{release=resolve;}):policy;});
 const binding={...modelCatalog([h.route]).bindings[0]!,state:'revoked',stateRevision:2,available:false,reason:'Revoked'};
 h.request.mockImplementation(async(method,params)=>{if(method==='inquello/permissions/review')return{status:'ready'};if(method==='inquello/permissions/reviewApply'){const request=(params as {requestId:string}).requestId;return{status:'decided',request:{requestId:request,taskId:other,decision:{actorKind:'automated_reviewer',outcome:'allowed'}}};}if(method==='inquello/models/binding/state')return{binding,affectedTaskIds:[]};return base(method,params);});
 const a=h.service.review(taskId,requestId);await vi.waitFor(()=>expect(release).toBeTypeOf('function'));await h.service.bindingState({operationId:principal,bindingId:binding.bindingId,expectedRevision:1,state:'revoked'});expect(await h.service.review(other,requestB)).toBe('allowed');release(policy);expect(await a).toBe('denied');expect(await h.service.review(other,requestB)).toBe('allowed');
});

it('refuses incomplete, malformed or overflowing Task disclosure dependencies before Main accepts them',()=>{
 const selected=fixture(),view={taskId,workspaceId:principal,revision:1,configurationRevision:1,staleConfiguration:false,selected};const ref={routeId:'claude-api-key',configurationRevision:1,active:true};
 expect(parseTaskRoute({...view,disclosureBindings:[ref]}).disclosureBindings).toEqual([ref]);
 expect(()=>parseTaskRoute(view)).toThrow();for(const refs of [[],[ref,ref],[{...ref,active:'yes'}],[{...ref,routeId:'arbitrary'}],Array.from({length:1025},(_,i)=>({...ref,configurationRevision:i+1}))])expect(()=>parseTaskRoute({...view,disclosureBindings:refs})).toThrow();
});

it('newly accepted cached handoff emits only a catalog notification, once per credential lifetime',async()=>{
 const h=setup('codex-responses');h.options.onCatalogChanged=vi.fn();h.options.onChanged=vi.fn();await h.service.list();await h.service.list();expect(h.privateRouteAuth).toHaveBeenCalledTimes(1);expect(h.options.onCatalogChanged).toHaveBeenCalledTimes(1);expect(h.options.onChanged).not.toHaveBeenCalled();
});
