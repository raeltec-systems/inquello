/** Main-only route mediation. No provider secret or automated verdict crosses preload. */
import { randomUUID } from 'node:crypto';
import type { OrganiseIdentity, OrganiseRuntime } from '../organise';
import type { ProviderService } from '../providers';
import type { InquelloWorkspaceExecutionPolicy } from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import { inquelloRefusal } from '../policy/permissions';
import { parseRoutes, parseTaskRoute, record, type ConfigureRouteInput, type RouteId, type RouteResult, type RouteView, type SelectRouteInput, type TaskRouteView } from './types';
import {parseModelCatalog,parseModelBinding,parseModelDisclosureBindings,type ModelCatalog,type ModelBinding,type ResolveModelInput,type BindingStateInput,type SelectModelInput,type PendingModelOperation} from './types';
export const ROUTE_REASONS = { unavailable:'Processing routes are unavailable. Sign in and start the local runtime.', changed:'The route or signed-in session changed. Refresh before trying again.', conflict:'The processing route changed first. Refresh and explicitly select again.', unknown:'That private Task or route is not available.', failed:'The processing-route request did not complete. No alternate provider was selected.' };
export interface RouteServiceOptions {
  runtime: OrganiseRuntime & { privateRouteAuth(params: {routeId:RouteId;accountRef:string;generation:number;apiKey:string|null}):Promise<unknown>; stop():Promise<void> };
  identity: Pick<OrganiseIdentity,'principalId'>; syncPrincipal():Promise<void>; providers:ProviderService;
  freshPolicy(taskId:string):Promise<InquelloWorkspaceExecutionPolicy|null>;
  /** Trusted Task classification only; unknown never means synthetic. No preload setter. */
  applicableDataTier?(taskId:string):Promise<'synthetic'|'real'|'unknown'>;
  /** Main-only dedicated debug smoke verifier; never supplied by preload. No provider handoff in this mode. */
  syntheticFixtureBinding?(route:RouteView):Promise<void>;
  taskBinding(taskId:string):Promise<{routeId:string;configurationRevision:number;disclosureBindings:{routeId:string;configurationRevision:number;active:boolean}[]}|null>;
  onChanged?(taskId?:string):void;
  onCatalogChanged?():void;
  onBindingChanged?(binding:ModelBinding,taskIds:string[]):void;
}
export class RouteService {
  /** Identity/runtime/credential lifetime is independent of each Task selection. */
  private epoch=0;
  private readonly taskEpochs=new Map<string,number>();
  private generation=Date.now();
  private paused=false;
  private signedOutCleared=false;
  private readonly bound=new Map<string,string>();
  private readonly connectionRefs=new Map<RouteId,string>();
  private readonly pendingModels=new Map<string,{principal:string;operation:PendingModelOperation}>();
  private readonly authFailures=new Set<string>();
  private bindingGeneration=0;
  private readonly bindingEpochs=new Map<string,number>();
  private readonly bindingStateRevisions=new Map<string,number>();
  private authQueue:Promise<unknown>=Promise.resolve();
  constructor(private readonly options:RouteServiceOptions) {}
  private modelOperationKey(operation:PendingModelOperation){const input=operation.input as unknown as Record<string,unknown>;return JSON.stringify([operation.kind,Object.keys(input).sort().map(key=>[key,input[key]])]);}
  private async modelMutation<T>(operation:PendingModelOperation,taskId:string|null,run:()=>Promise<RouteResult<T>>):Promise<RouteResult<T>>{
    const principal=this.options.identity.principalId();if(!principal)return{ok:false,reason:ROUTE_REASONS.unavailable};
    const key=JSON.stringify([principal,taskId]),old=this.pendingModels.get(key);
    if(old&&this.modelOperationKey(old.operation)!==this.modelOperationKey(operation))return{ok:false,reason:'An earlier model operation is unconfirmed. Restore and retry that exact operation first.'};
    if(!old){if(this.pendingModels.size>=128)return{ok:false,reason:'Confirm outstanding model operations before starting another.'};this.pendingModels.set(key,{principal,operation:structuredClone(operation)});}
    let result:RouteResult<T>;try{result=await run();}catch(error){result=this.failure(error);}
    if(result.ok||result.code==='conflict'||result.code==='refused')this.pendingModels.delete(key);
    return result;
  }
  async pendingModel(taskId:string|null):Promise<RouteResult<{operation:PendingModelOperation|null}>>{const scope=this.scope();if(!this.current(scope))return{ok:false,reason:ROUTE_REASONS.unavailable};const entry=this.pendingModels.get(JSON.stringify([scope.principal,taskId]));return{ok:true,value:{operation:entry?structuredClone(entry.operation):null}};}
  resolve(input:ResolveModelInput){return this.modelMutation({kind:'resolve',input:{...input}},null,()=>this.resolveNow(input));}
  bindingState(input:BindingStateInput){return this.modelMutation({kind:'state',input:{...input}},null,()=>this.bindingStateNow(input));}
  selectModel(input:SelectModelInput){return this.modelMutation({kind:'select',input:{...input}},input.taskId,()=>this.selectModelNow(input));}
  private scope(){return{principal:this.options.identity.principalId(),runtime:this.options.runtime.instance(),epoch:this.epoch};}
  private current(s:ReturnType<RouteService['scope']>){return !this.paused&&s.principal!==null&&s.principal===this.options.identity.principalId()&&s.runtime===this.options.runtime.instance()&&s.epoch===this.epoch&&this.options.runtime.ready();}
  private changed(){this.epoch++;this.bound.clear();this.connectionRefs.clear();this.authFailures.clear();this.taskEpochs.clear();this.options.onChanged?.();}
  private taskChanged(taskId:string){this.taskEpochs.set(taskId,(this.taskEpochs.get(taskId)??0)+1);this.options.onChanged?.(taskId);}
  runtimeReset(){this.paused=false;this.changed();}
  runtimeUnavailable(){this.paused=true;this.changed();}
  /** Called before identity/credential replacement. Unknown invalidation stops the child. */
  async invalidate(routeId:RouteId|null=null,taskId:string|null=null):Promise<void>{
    if(taskId!==null)this.taskChanged(taskId);else this.changed();const generation=++this.generation;
    if(!this.options.runtime.ready())return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([this.options.identity.principalId()?this.options.runtime.request('inquello/routes/invalidate',{routeId,generation,taskId}):this.options.syncPrincipal(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Invalidation timeout')),5000);})]);}
    catch{this.paused=true;await this.options.runtime.stop();}
    finally{if(timer)clearTimeout(timer);}
  }
  async quiesce(){this.paused=true;await this.invalidate();}
  resume(){this.paused=false;this.changed();}
  private failure<T>(e:unknown):RouteResult<T>{const k=inquelloRefusal(e)?.kind;const conflict=k==='revision_conflict'||k==='operation_conflict';return{ok:false,reason:conflict?ROUTE_REASONS.conflict:k==='pending_work'?'Finish or stop pending work before changing this conversation model.':k==='not_found'?ROUTE_REASONS.unknown:ROUTE_REASONS.failed,...(conflict?{code:'conflict' as const}:['catalog_changed','pending_work','credential_unavailable'].includes(typeof k==='string'?k:'')?{code:'refused' as const}:{})};}
  private async prepare(){if(!this.options.identity.principalId()){if(!this.signedOutCleared){this.signedOutCleared=true;await this.invalidate();}throw new Error('Unavailable');}this.signedOutCleared=false;if(this.paused||!this.options.runtime.ready())throw new Error('Unavailable');const s=this.scope();await this.options.syncPrincipal();if(!this.current(s))throw new Error('Changed');return s;}
  private async bind(routes:RouteView[],s:ReturnType<RouteService['scope']>){
    if(this.options.syntheticFixtureBinding){
      const empty=()=>{const status=this.options.providers.snapshot();return status.claude.state==='not-configured'&&status.codex.state==='not-connected'&&status.codex.account===null&&!this.options.providers.routeCredentialChanging('claude-api-key')&&!this.options.providers.routeCredentialChanging('codex-responses');};
      await this.options.providers.getStatus();
      if(!this.current(s)||!empty())throw new Error('Synthetic fixture refuses provider credentials');
      for(const route of routes){
        if(!route.configuration){if(route.credentialPresent)throw new Error('Unexpected synthetic credential');continue;}
        await this.options.syntheticFixtureBinding(route);
        if(!this.current(s)||!empty())throw new Error('Synthetic fixture authority changed');
      }
      return;
    }
    const work=async()=>{for(const route of routes){if(!this.current(s))throw new Error('Changed');const c=route.configuration;if(!c||this.options.providers.routeCredentialChanging(c.routeId))continue;const status=this.options.providers.snapshot();const present=c.routeId==='claude-api-key'?status.claude.state!=='not-configured'&&status.claude.state!=='rejected':true;if(!present){if(this.bound.has(c.routeId)||route.credentialPresent){await this.invalidate(c.routeId);throw new Error('Credential removed');}continue;}
      const marker=`${s.principal}:${c.accountRef}`;if(this.bound.get(c.routeId)===marker)continue;const generation=++this.generation;
      const send=(apiKey:string|null)=>this.options.runtime.privateRouteAuth({routeId:c.routeId,accountRef:c.accountRef,generation,apiKey});
      let response:unknown;
      try { response=c.routeId==='claude-api-key'?await this.options.providers.handoffClaude(send):await send(null); }
      catch { if(!this.current(s))throw new Error('Changed'); this.authFailures.add(c.routeId);continue; }
      if(!this.current(s)){await this.invalidate();throw new Error('Changed');}
      if(record(response).accepted!==true)throw new Error('Private handoff refused');if(c.routeId==='codex-responses')this.options.providers.codex?.confirmPrivateBinding();this.bound.set(c.routeId,marker);this.authFailures.delete(c.routeId);this.options.onCatalogChanged?.();
    }};
    const pending=this.authQueue.then(work);this.authQueue=pending.catch(()=>{});await pending;
  }
  async list():Promise<RouteResult<RouteView[]>>{try{const s=await this.prepare();let rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));await this.bind(rows,s);rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));if(this.options.syntheticFixtureBinding)await this.bind(rows,s);if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};return{ok:true,value:rows.map(row=>this.authFailures.has(row.routeId)?{...row,enabled:false,credentialPresent:false,gate:'The saved model could not connect to its current provider credential. Reconnect the provider in Settings, then choose this model again.'}:row)};}catch(e){return this.failure(e);}}
  async configure(input:ConfigureRouteInput):Promise<RouteResult<RouteView[]>>{try{const s=await this.prepare();const rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};const current=rows.find(r=>r.routeId===input.routeId);if(!current||!current.configurable)return{ok:false,reason:ROUTE_REASONS.unknown};
    const {operationId,expectedRevision,...configuration}=input;const accountRef=current.configuration?.accountRef??randomUUID();
    await this.options.runtime.request('inquello/routes/configure',{operationId,expectedRevision,configuration:{...configuration,accountRef}});
    if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};this.options.onCatalogChanged?.();return this.list();
  }catch(e){return this.failure(e);}}
  /** Offline inspection never hands off credentials or calls provider status. */
  async catalog():Promise<RouteResult<ModelCatalog>>{try{const s=await this.prepare();const catalog=parseModelCatalog(await this.options.runtime.request('inquello/models/catalog',{}));if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};return{ok:true,value:catalog};}catch(e){return this.failure(e);}}
  private async connectForChoice(provider:string,s:ReturnType<RouteService['scope']>){
    const id:RouteId=provider==='OpenAI'?'codex-responses':provider==='Anthropic'?'claude-api-key':(()=>{throw new Error('Unknown provider');})();
    const rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));
    if(!this.current(s))throw new Error('Changed');
    const existing=rows.find(r=>r.routeId===id)?.configuration;
    const accountRef=existing?.accountRef??this.connectionRefs.get(id)??randomUUID();
    this.connectionRefs.set(id,accountRef);
    const marker=`${s.principal}:${accountRef}`;
    if(this.bound.get(id)===marker)return;
    if(this.options.providers.routeCredentialChanging(id))throw new Error('Credential changing');
    const generation=++this.generation;
    const send=(apiKey:string|null)=>this.options.runtime.privateRouteAuth({routeId:id,accountRef,generation,apiKey});
    const result=id==='claude-api-key'?await this.options.providers.handoffClaude(send):await send(null);
    if(!this.current(s)||this.options.providers.routeCredentialChanging(id))throw new Error('Changed');
    if(record(result).accepted!==true)throw new Error('Private handoff refused');if(id==='codex-responses')this.options.providers.codex?.confirmPrivateBinding();
    this.bound.set(id,marker);this.authFailures.delete(id);this.options.onCatalogChanged?.();
  }
  private async resolveNow(input:ResolveModelInput):Promise<RouteResult<ModelBinding>>{
    try{
      const s=await this.prepare();let raw:unknown;
      try{raw=await this.options.runtime.request('inquello/models/resolve',input);}
      catch(error){
        if(inquelloRefusal(error)?.kind!=='credential_unavailable')throw error;
        const catalog=parseModelCatalog(await this.options.runtime.request('inquello/models/catalog',{}));
        const choice=catalog.choices.find(c=>c.choiceId===input.choiceId);
        if(catalog.catalogVersion!==input.catalogVersion||!choice)return{ok:false,reason:'Cached model choices changed. Refresh and choose again.'};
        const work=async()=>{if(!this.current(s))throw new Error('Changed');await this.connectForChoice(choice.provider,s);};
        const pending=this.authQueue.then(work);this.authQueue=pending.catch(()=>{});await pending;
        if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};
        raw=await this.options.runtime.request('inquello/models/resolve',input);
      }
      if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};
      const binding=parseModelBinding(record(raw).binding);this.options.onCatalogChanged?.();return{ok:true,value:binding};
    }catch(error){return this.failure(error);}
  }
  private async bindingStateNow(input:BindingStateInput):Promise<RouteResult<ModelBinding>>{
    try{
      const s=await this.prepare();
      let raw:unknown;try{raw=await this.options.runtime.request('inquello/models/binding/state',input);}catch(error){if(input.state!=='active'||!['route_unavailable','credential_unavailable'].includes(String(inquelloRefusal(error)?.kind??'')))throw error;const bound=await this.list();if(!bound.ok||!this.current(s))throw error;raw=await this.options.runtime.request('inquello/models/binding/state',input);}const result=record(raw);
      if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};
      const binding=parseModelBinding(result.binding);
      if(!Array.isArray(result.affectedTaskIds)||result.affectedTaskIds.length>1024||result.affectedTaskIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)))throw new Error('Invalid binding scope');
      const taskIds=[...new Set(result.affectedTaskIds as string[])];
      const stateKey=JSON.stringify([s.principal,binding.bindingId]);
      if((this.bindingStateRevisions.get(stateKey)??0)<binding.stateRevision){this.bindingStateRevisions.set(stateKey,binding.stateRevision);this.bindingEpochs.set(JSON.stringify([binding.routeId,binding.configurationRevision]),++this.bindingGeneration);for(const task of taskIds)this.taskChanged(task);this.options.onBindingChanged?.(binding,taskIds);}
      this.options.onCatalogChanged?.();
      return{ok:true,value:binding};
    }catch(error){return this.failure(error);}
  }
  private async selectModelNow(input:SelectModelInput):Promise<RouteResult<TaskRouteView>>{
    try{const s=await this.prepare();const raw=record(await this.options.runtime.request('inquello/models/select',input));const view=parseTaskRoute(raw);if(view.taskId!==input.taskId||!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};if(!raw.receipt||record(raw.receipt).replayed!==true)this.taskChanged(input.taskId);return{ok:true,value:view};}catch(error){return this.failure(error);}
  }
  async forTask(taskId:string):Promise<RouteResult<TaskRouteView>>{try{const s=await this.prepare();const view=parseTaskRoute(await this.options.runtime.request('inquello/routes/task/read',{taskId}));if(view.taskId!==taskId||!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};return{ok:true,value:view};}catch(e){return this.failure(e);}}
  async select(input:SelectRouteInput):Promise<RouteResult<TaskRouteView>>{try{const s=await this.prepare();const view=parseTaskRoute(await this.options.runtime.request('inquello/routes/task/set',input));if(view.taskId!==input.taskId||!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};this.taskChanged(input.taskId);return{ok:true,value:view};}catch(e){return this.failure(e);}}
  /** No caller supplies a verdict; policy AND trusted classification are reread at each phase. */
  async review(taskId:string,requestId:string):Promise<'allowed'|'denied'|null>{
    let authorityLost=false;
    let s:ReturnType<RouteService['scope']>;
    try{s=await this.prepare();}catch{return 'denied';}
    const taskEpoch=this.taskEpochs.get(taskId)??0,bindingGeneration=this.bindingGeneration;let bindingKeys:string[]=[];
    const current=()=>this.current(s)&&(this.taskEpochs.get(taskId)??0)===taskEpoch&&bindingKeys.every(key=>(this.bindingEpochs.get(key)??0)<=bindingGeneration);
    const fresh=async()=>{
      let policy:InquelloWorkspaceExecutionPolicy|null;
      try{policy=await this.options.freshPolicy(taskId);}catch{authorityLost=true;throw new Error('Authority unavailable');}
      let dataTier:'synthetic'|'real'|'unknown'='unknown';
      try{dataTier=await this.options.applicableDataTier?.(taskId)??'unknown';}catch{/* Unknown classification cannot enable inference. */}
      if(!policy||!current()){authorityLost=true;throw new Error('Authority unavailable');}
      return{requestId,workspacePolicy:policy,authorityEpoch:policy.authorizationEpoch,dataTier};
    };
    try{
      {const binding=await this.options.taskBinding(taskId);if(!binding||!current())return 'denied';const refs=parseModelDisclosureBindings(binding.disclosureBindings,binding.routeId,binding.configurationRevision);if(refs.some(ref=>!ref.active))return 'denied';bindingKeys=refs.map(ref=>JSON.stringify([ref.routeId,ref.configurationRevision]));if(!current())return 'denied';}
      // Bind credentials first: no async catalog work between the freshness read and dispatch.
      const catalog=await this.list();if(!catalog.ok||!current())return 'denied';
      const before=await fresh();
      let answer=record(await this.options.runtime.request('inquello/permissions/review',before));
      if(!current())return 'denied';
      if(answer.status==='ready'){
        const after=await fresh();
        answer=record(await this.options.runtime.request('inquello/permissions/reviewApply',after));
      }
      if(!current())return 'denied';
      if(answer.status==='human_required')return null;
      if(answer.status==='refused')return 'denied';
      if(answer.status!=='decided')return null;
      const request=record(answer.request),decision=record(request.decision);
      if(request.requestId!==requestId||request.taskId!==taskId||decision.actorKind!=='automated_reviewer'||!['allowed','denied'].includes(String(decision.outcome)))return null;
      return decision.outcome as 'allowed'|'denied';
    }catch{
      const wasCurrent=current();await this.invalidate(null,taskId);
      return !authorityLost&&wasCurrent&&this.current(s)?null:'denied';
    }
  }
}
