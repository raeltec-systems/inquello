/** Main-only route mediation. No provider secret or automated verdict crosses preload. */
import { randomUUID } from 'node:crypto';
import type { OrganiseIdentity, OrganiseRuntime } from '../organise';
import type { ProviderService } from '../providers';
import type { InquelloWorkspaceExecutionPolicy } from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import { inquelloRefusal } from '../policy/permissions';
import { parseRoutes, parseTaskRoute, record, type ConfigureRouteInput, type RouteId, type RouteResult, type RouteView, type SelectRouteInput, type TaskRouteView } from './types';
export const ROUTE_REASONS = { unavailable:'Processing routes are unavailable. Sign in and start the local runtime.', changed:'The route or signed-in session changed. Refresh before trying again.', conflict:'The processing route changed first. Refresh and explicitly select again.', unknown:'That private Task or route is not available.', failed:'The processing-route request did not complete. No alternate provider was selected.' };
export interface RouteServiceOptions {
  runtime: OrganiseRuntime & { privateRouteAuth(params: {routeId:RouteId;accountRef:string;generation:number;apiKey:string|null}):Promise<unknown>; stop():Promise<void> };
  identity: Pick<OrganiseIdentity,'principalId'>; syncPrincipal():Promise<void>; providers:ProviderService;
  freshPolicy(taskId:string):Promise<InquelloWorkspaceExecutionPolicy|null>;
  /** Trusted Task classification only; unknown never means synthetic. No preload setter. */
  applicableDataTier?(taskId:string):Promise<'synthetic'|'real'|'unknown'>;
  onChanged?():void;
}
export class RouteService {
  /** Identity/runtime/credential lifetime is independent of each Task selection. */
  private epoch=0;
  private readonly taskEpochs=new Map<string,number>();
  private generation=Date.now();
  private paused=false;
  private signedOutCleared=false;
  private readonly bound=new Map<string,string>();
  private readonly authFailures=new Set<string>();
  private authQueue:Promise<unknown>=Promise.resolve();
  constructor(private readonly options:RouteServiceOptions) {}
  private scope(){return{principal:this.options.identity.principalId(),runtime:this.options.runtime.instance(),epoch:this.epoch};}
  private current(s:ReturnType<RouteService['scope']>){return !this.paused&&s.principal!==null&&s.principal===this.options.identity.principalId()&&s.runtime===this.options.runtime.instance()&&s.epoch===this.epoch&&this.options.runtime.ready();}
  private changed(){this.epoch++;this.bound.clear();this.authFailures.clear();this.taskEpochs.clear();this.options.onChanged?.();}
  private taskChanged(taskId:string){this.taskEpochs.set(taskId,(this.taskEpochs.get(taskId)??0)+1);this.options.onChanged?.();}
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
  private failure<T>(e:unknown):RouteResult<T>{const k=inquelloRefusal(e)?.kind;return{ok:false,reason:k==='revision_conflict'||k==='operation_conflict'?ROUTE_REASONS.conflict:k==='not_found'?ROUTE_REASONS.unknown:ROUTE_REASONS.failed};}
  private async prepare(){if(!this.options.identity.principalId()){if(!this.signedOutCleared){this.signedOutCleared=true;await this.invalidate();}throw new Error('Unavailable');}this.signedOutCleared=false;if(this.paused||!this.options.runtime.ready())throw new Error('Unavailable');const s=this.scope();await this.options.syncPrincipal();if(!this.current(s))throw new Error('Changed');return s;}
  private async bind(routes:RouteView[],s:ReturnType<RouteService['scope']>){
    const work=async()=>{for(const route of routes){if(!this.current(s))throw new Error('Changed');const c=route.configuration;if(!c||this.options.providers.routeCredentialChanging(c.routeId))continue;const status=this.options.providers.snapshot();const present=c.routeId==='claude-api-key'?status.claude.state!=='not-configured'&&status.claude.state!=='rejected':status.codex.state==='connected';if(!present){if(this.bound.has(c.routeId)||route.credentialPresent){await this.invalidate(c.routeId);throw new Error('Credential removed');}continue;}
      const marker=`${s.principal}:${route.revision}:${c.accountRef}`;if(this.bound.get(c.routeId)===marker)continue;const generation=++this.generation;
      const send=(apiKey:string|null)=>this.options.runtime.privateRouteAuth({routeId:c.routeId,accountRef:c.accountRef,generation,apiKey});
      let response:unknown;
      try { response=c.routeId==='claude-api-key'?await this.options.providers.handoffClaude(send):await send(null); }
      catch { if(!this.current(s))throw new Error('Changed'); this.authFailures.add(c.routeId);continue; }
      if(!this.current(s)){await this.invalidate();throw new Error('Changed');}
      if(record(response).accepted!==true)throw new Error('Private handoff refused');this.bound.set(c.routeId,marker);this.authFailures.delete(c.routeId);
    }};
    const pending=this.authQueue.then(work);this.authQueue=pending.catch(()=>{});await pending;
  }
  async list():Promise<RouteResult<RouteView[]>>{try{const s=await this.prepare();let rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));await this.bind(rows,s);rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};return{ok:true,value:rows.map(row=>this.authFailures.has(row.routeId)?{...row,enabled:false,credentialPresent:false,gate:'The selected configuration could not bind its current provider credential. Check the deployment/model/API identifiers and provider status; no other route was used.'}:row)};}catch(e){return this.failure(e);}}
  async configure(input:ConfigureRouteInput):Promise<RouteResult<RouteView[]>>{try{const s=await this.prepare();const rows=parseRoutes(await this.options.runtime.request('inquello/routes/list',{}));if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};const current=rows.find(r=>r.routeId===input.routeId);if(!current||!current.configurable)return{ok:false,reason:ROUTE_REASONS.unknown};
    const {operationId,expectedRevision,...configuration}=input;const accountRef=current.configuration?.accountRef??randomUUID();
    await this.options.runtime.request('inquello/routes/configure',{operationId,expectedRevision,configuration:{...configuration,accountRef}});
    if(!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};this.changed();return this.list();
  }catch(e){return this.failure(e);}}
  async forTask(taskId:string):Promise<RouteResult<TaskRouteView>>{try{const s=await this.prepare();const view=parseTaskRoute(await this.options.runtime.request('inquello/routes/task/read',{taskId}));if(view.taskId!==taskId||!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};return{ok:true,value:view};}catch(e){return this.failure(e);}}
  async select(input:SelectRouteInput):Promise<RouteResult<TaskRouteView>>{try{const s=await this.prepare();const view=parseTaskRoute(await this.options.runtime.request('inquello/routes/task/set',input));if(view.taskId!==input.taskId||!this.current(s))return{ok:false,reason:ROUTE_REASONS.changed};this.taskChanged(input.taskId);return{ok:true,value:view};}catch(e){return this.failure(e);}}
  /** No caller supplies a verdict; policy AND trusted classification are reread at each phase. */
  async review(taskId:string,requestId:string):Promise<'allowed'|'denied'|null>{
    let authorityLost=false;
    let s:ReturnType<RouteService['scope']>;
    try{s=await this.prepare();}catch{return 'denied';}
    const taskEpoch=this.taskEpochs.get(taskId)??0;
    const current=()=>this.current(s)&&(this.taskEpochs.get(taskId)??0)===taskEpoch;
    const fresh=async()=>{
      let policy:InquelloWorkspaceExecutionPolicy|null;
      try{policy=await this.options.freshPolicy(taskId);}catch{authorityLost=true;throw new Error('Authority unavailable');}
      let dataTier:'synthetic'|'real'|'unknown'='unknown';
      try{dataTier=await this.options.applicableDataTier?.(taskId)??'unknown';}catch{/* Unknown classification cannot enable inference. */}
      if(!policy||!current()){authorityLost=true;throw new Error('Authority unavailable');}
      return{requestId,workspacePolicy:policy,authorityEpoch:policy.authorizationEpoch,dataTier};
    };
    try{
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
