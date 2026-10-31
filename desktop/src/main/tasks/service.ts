/** Trusted named orchestration. A lost acknowledgment is reconciled, never replayed. */
import type {OrganiseIdentity,OrganiseRuntime} from '../organise';
import type {InquelloWorkspaceExecutionPolicy} from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import {uuid,object} from '../usage/types';
import type {EscalationRoute} from '../policy/tools';
import {inquelloRefusal} from '../policy/permissions';
import {parseCandidate,parseStarted,type TaskCandidateInput,type TaskCandidateView,type StartTaskInput,type StartedTaskView,type TasksResult} from './types';
export interface TaskServiceOptions {runtime:OrganiseRuntime;identity:Pick<OrganiseIdentity,'principalId'>;syncPrincipal():Promise<void>;bootstrap?(workspaceId:string):Promise<void>;prepareRoutes():Promise<{ok:boolean}>;freshPolicy(workspaceId:string):Promise<InquelloWorkspaceExecutionPolicy|null>;onAccepted?():void;askPermission?(taskId:string,command:readonly string[]):Promise<'allowed'|'denied'|'expired'>}
const unavailable='The local runtime, signed-in identity or Workspace policy is unavailable. Your request is preserved.';
const changed='Your identity, runtime or authority changed. Your draft is preserved; reconcile the existing request before submitting again.';
export class TaskService {
 private epoch=0;
 private readonly trustedThreads=new Map<string,{threadId:string;scope:ReturnType<TaskService['scope']>}>();
 private readonly operationWorkspaces=new Map<string,string>();
 constructor(private readonly options:TaskServiceOptions){}
 invalidate(){this.epoch++;this.trustedThreads.clear();}
 private scope(){return{principal:this.options.identity.principalId(),runtime:this.options.runtime.instance(),epoch:this.epoch};}
 private current(s:ReturnType<TaskService['scope']>){return !!s.principal&&s.principal===this.options.identity.principalId()&&s.runtime===this.options.runtime.instance()&&s.epoch===this.epoch&&this.options.runtime.ready();}
 private failure(error:unknown,dispatch:boolean):{ok:false;reason:string;code:'refused'|'uncertain'}{
  const refusal=inquelloRefusal(error),kind=String(refusal?.kind??'');
  const reasons:Record<string,string>={
   operation_conflict:'This operation belongs to a different request. Keep the draft and reconcile the original submission.',
   revision_conflict:'The selected route configuration changed. Refresh and explicitly reconfirm compatible choices.',
   not_found:'No durable binding is available for this operation. Nothing has been automatically retried.',
   classification_unknown:'This identity and Workspace do not have an authorized private data environment. Your draft is preserved.',
   authority_unknown:'Current Workspace membership and policy could not be verified. Your draft is preserved.',
   credential_unavailable:'The selected route credential is unavailable. No alternative provider was selected.',
   route_unavailable:'The selected route lacks current authorization evidence. No alternative provider was selected.',
   capabilities_unavailable:'Supported settings for this exact model are unavailable. Refresh before choosing again.',
   unsupported_settings:'The selected reasoning or speed is not supported by this configuration. Reconfirm compatible choices.',
   settings_unavailable:'Current Task reasoning and speed settings could not be verified.',
   inherited_limit:'The selected provider account quota does not permit this turn. No credits were purchased or fallback selected.',
   limit_unknown:'Required current-account quota could not be verified. No turn is automatically retried.',
   stale:'Identity, Workspace policy, route or credential changed. Reconcile retained work before any new submission.'
  };
  return{ok:false,code:!dispatch||refusal?.preEffect===true?'refused':'uncertain',reason:reasons[kind]??(dispatch?'The submission outcome is uncertain. Your draft is preserved. Reconcile this operation; do not submit a second turn.':unavailable)};
 }
 private registerAccepted(value:StartedTaskView,s:ReturnType<TaskService['scope']>){if(value.accepted){if(value.threadId)this.trustedThreads.set(value.taskId,{threadId:value.threadId,scope:s});this.options.onAccepted?.();}}
 private async prepare(input:TaskCandidateInput,s:ReturnType<TaskService['scope']>){if(!this.current(s))throw new Error();await this.options.syncPrincipal();if(!this.current(s))throw new Error();const routes=await this.options.prepareRoutes();if(!routes.ok||!this.current(s))throw new Error();await this.options.bootstrap?.(input.workspaceId);if(!this.current(s))throw new Error();const policy=await this.options.freshPolicy(input.workspaceId);if(!policy||!this.current(s))throw new Error();return policy;}
 async preflight(input:TaskCandidateInput):Promise<TasksResult<TaskCandidateView>>{const s=this.scope();try{const workspacePolicy=await this.prepare(input,s);const value=parseCandidate(await this.options.runtime.request('inquello/tasks/preflight',{...input,workspacePolicy}),input.workspaceId);if(!this.current(s))return{ok:false,reason:changed};if(value.routeId!==input.routeId||value.configurationRevision!==input.configurationRevision)return{ok:false,reason:'The route configuration changed. Refresh and explicitly reconfirm it.'};return{ok:true,value};}catch(e){return this.failure(e,false);}}
 async start(input:StartTaskInput):Promise<TasksResult<StartedTaskView>>{const s=this.scope();this.operationWorkspaces.set(input.operationId,input.workspaceId);let dispatched=false;try{const workspacePolicy=await this.prepare(input,s);dispatched=true;const value=parseStarted(await this.options.runtime.request('inquello/tasks/start',{...input,workspacePolicy}));if(!this.current(s))return{ok:false,reason:changed};if(value.operationId!==input.operationId||value.request!==input.request)throw new Error();this.registerAccepted(value,s);return{ok:true,value};}catch(e){return this.failure(e,dispatched);}}
 async authority(params:unknown):Promise<{workspacePolicy:InquelloWorkspaceExecutionPolicy|null}>{const s=this.scope();try{const r=object(params);if(Object.keys(r).length!==1)return{workspacePolicy:null};const workspaceId=uuid(r.workspaceId);if(!this.current(s))return{workspacePolicy:null};const policy=await this.options.freshPolicy(workspaceId);return{workspacePolicy:this.current(s)?policy:null};}catch{return{workspacePolicy:null};}}
 async applicableDataTier(taskId:string):Promise<'synthetic'|'unknown'>{const binding=this.trustedThreads.get(taskId);if(!binding||!this.current(binding.scope))return 'unknown';try{const r=object(await this.options.runtime.request('inquello/tasks/forThread',{threadId:binding.threadId}));return r.taskId===taskId&&r.threadId===binding.threadId&&this.current(binding.scope)?'synthetic':'unknown';}catch{return 'unknown';}}
 async permissionRoute(threadId:string|null):Promise<EscalationRoute|null>{const s=this.scope();if(!threadId||!this.current(s)||!this.options.askPermission)return null;try{await this.options.syncPrincipal();if(!this.current(s))return null;const r=object(await this.options.runtime.request('inquello/tasks/forThread',{threadId}));const taskId=uuid(r.taskId);if(r.threadId!==threadId||!this.current(s))return null;this.trustedThreads.set(taskId,{threadId,scope:s});return{ask:async command=>{if(!this.current(s))return 'denied';const answer=await this.options.askPermission!(taskId,command);return this.current(s)?answer:'denied';}};}catch{return null;}}
 async reconcile(operationId:string):Promise<TasksResult<StartedTaskView>>{const s=this.scope();try{if(!this.current(s))return{ok:false,reason:unavailable};await this.options.syncPrincipal();if(!this.current(s))return{ok:false,reason:changed};const workspace=this.operationWorkspaces.get(operationId);if(workspace){await this.options.bootstrap?.(workspace);if(!this.current(s))return{ok:false,reason:changed};}const value=parseStarted(await this.options.runtime.request('inquello/tasks/reconcile',{operationId}));if(!this.current(s))return{ok:false,reason:changed};if(value.operationId!==operationId)throw new Error();this.registerAccepted(value,s);return{ok:true,value};}catch(e){return this.failure(e,true);}}
}
