import {parseProgress,parseQuestion,parseAnswers,progressId,terminalProgress,type ProgressInput,type ProgressSnapshot,type ProgressQuestion,type AnswerInput,type NativeRequestId} from './progress';
/** Trusted named orchestration. A lost acknowledgment is reconciled, never replayed. */
import type {OrganiseIdentity,OrganiseRuntime} from '../organise';
import type {InquelloWorkspaceExecutionPolicy} from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import {uuid,object} from '../usage/types';
import type {EscalationRoute} from '../policy/tools';
import {inquelloRefusal} from '../policy/permissions';
import {parseCandidate,parseStarted,type TaskCandidateInput,type TaskCandidateView,type StartTaskInput,type StartedTaskView,type TasksResult} from './types';
export interface TaskServiceOptions {runtime:OrganiseRuntime;identity:Pick<OrganiseIdentity,'principalId'>;syncPrincipal():Promise<void>;bootstrap?(workspaceId:string):Promise<void>;prepareRoutes():Promise<{ok:boolean}>;freshPolicy(workspaceId:string):Promise<InquelloWorkspaceExecutionPolicy|null>;onAccepted?():void;onProgressChanged?():void;askPermission?(taskId:string,command:readonly string[]):Promise<'allowed'|'denied'|'expired'>}
const unavailable='The local runtime, signed-in identity or Workspace policy is unavailable. Your request is preserved.';
const changed='Your identity, runtime or authority changed. Your draft is preserved; reconcile the existing request before submitting again.';
export class TaskService {
 private epoch=0;
 private historyIncomplete=false;
 private readonly questions=new Map<string,{view:ProgressQuestion;scope:ReturnType<TaskService['scope']>;binding:{taskId:string;workspaceId:string;runId:string;runtimeId:string}|null;resolve:(v:unknown)=>void}>();
 private suppress(taskId:string,workspaceId:string,workspace:boolean){
  for(const [key,q]of this.questions)if(q.binding&&(workspace?q.binding.workspaceId===workspaceId:q.binding.taskId===taskId))this.dropQuestion(key);
  for(const [id,binding]of this.trustedThreads)if(id===taskId||(workspace&&binding.workspaceId===workspaceId))this.trustedThreads.delete(id);
 }
 private questionKey(id:NativeRequestId){return JSON.stringify(id);}
 private clearQuestions(){for(const q of this.questions.values())q.resolve({answers:{}});this.questions.clear();}
 private dropQuestion(key:string){const q=this.questions.get(key);if(q){this.questions.delete(key);q.resolve({answers:{}});this.options.onProgressChanged?.();}}

 private readonly trustedThreads=new Map<string,{threadId:string;workspaceId?:string;scope:ReturnType<TaskService['scope']>}>();
 private readonly operationWorkspaces=new Map<string,string>();
 constructor(private readonly options:TaskServiceOptions){}
 invalidate(notify=true){this.epoch++;this.trustedThreads.clear();this.clearQuestions();this.historyIncomplete=false;if(notify)this.options.onProgressChanged?.();}
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
 private registerAccepted(value:StartedTaskView,s:ReturnType<TaskService['scope']>){if(value.accepted){if(value.threadId)this.trustedThreads.set(value.taskId,{threadId:value.threadId,workspaceId:this.operationWorkspaces.get(value.operationId),scope:s});this.options.onAccepted?.();}}
 private async prepare(input:TaskCandidateInput,s:ReturnType<TaskService['scope']>){if(!this.current(s))throw new Error();await this.options.syncPrincipal();if(!this.current(s))throw new Error();const routes=await this.options.prepareRoutes();if(!routes.ok||!this.current(s))throw new Error();await this.options.bootstrap?.(input.workspaceId);if(!this.current(s))throw new Error();const policy=await this.options.freshPolicy(input.workspaceId);if(!policy||!this.current(s))throw new Error();return policy;}
 async preflight(input:TaskCandidateInput):Promise<TasksResult<TaskCandidateView>>{const s=this.scope();try{const workspacePolicy=await this.prepare(input,s);const value=parseCandidate(await this.options.runtime.request('inquello/tasks/preflight',{...input,workspacePolicy}),input.workspaceId);if(!this.current(s))return{ok:false,reason:changed};if(value.routeId!==input.routeId||value.configurationRevision!==input.configurationRevision)return{ok:false,reason:'The route configuration changed. Refresh and explicitly reconfirm it.'};return{ok:true,value};}catch(e){return this.failure(e,false);}}
 async start(input:StartTaskInput):Promise<TasksResult<StartedTaskView>>{const s=this.scope();this.operationWorkspaces.set(input.operationId,input.workspaceId);let dispatched=false;try{const workspacePolicy=await this.prepare(input,s);dispatched=true;const value=parseStarted(await this.options.runtime.request('inquello/tasks/start',{...input,workspacePolicy}));if(!this.current(s))return{ok:false,reason:changed};if(value.operationId!==input.operationId||value.request!==input.request)throw new Error();this.registerAccepted(value,s);return{ok:true,value};}catch(e){return this.failure(e,dispatched);}}
 async authority(params:unknown):Promise<{workspacePolicy:InquelloWorkspaceExecutionPolicy|null}>{const s=this.scope();try{const r=object(params);if(Object.keys(r).length!==1)return{workspacePolicy:null};const workspaceId=uuid(r.workspaceId);if(!this.current(s))return{workspacePolicy:null};const policy=await this.options.freshPolicy(workspaceId);return{workspacePolicy:this.current(s)?policy:null};}catch{return{workspacePolicy:null};}}
 async applicableDataTier(taskId:string):Promise<'synthetic'|'unknown'>{const binding=this.trustedThreads.get(taskId);if(!binding||!this.current(binding.scope))return 'unknown';try{const r=object(await this.options.runtime.request('inquello/tasks/forThread',{threadId:binding.threadId}));return r.taskId===taskId&&r.threadId===binding.threadId&&this.current(binding.scope)?'synthetic':'unknown';}catch{return 'unknown';}}
 async permissionRoute(threadId:string|null):Promise<EscalationRoute|null>{const s=this.scope();if(!threadId||!this.current(s)||!this.options.askPermission)return null;try{await this.options.syncPrincipal();if(!this.current(s))return null;const r=object(await this.options.runtime.request('inquello/tasks/forThread',{threadId}));const taskId=uuid(r.taskId);if(r.threadId!==threadId||!this.current(s))return null;this.trustedThreads.set(taskId,{threadId,workspaceId:typeof r.workspaceId==='string'?r.workspaceId:undefined,scope:s});return{ask:async command=>{if(!this.current(s))return 'denied';const answer=await this.options.askPermission!(taskId,command);return this.current(s)?answer:'denied';}};}catch{return null;}}
 async reconcile(operationId:string):Promise<TasksResult<StartedTaskView>>{const s=this.scope();try{if(!this.current(s))return{ok:false,reason:unavailable};await this.options.syncPrincipal();if(!this.current(s))return{ok:false,reason:changed};const workspace=this.operationWorkspaces.get(operationId);if(workspace){await this.options.bootstrap?.(workspace);if(!this.current(s))return{ok:false,reason:changed};}const value=parseStarted(await this.options.runtime.request('inquello/tasks/reconcile',{operationId}));if(!this.current(s))return{ok:false,reason:changed};if(value.operationId!==operationId)throw new Error();this.registerAccepted(value,s);return{ok:true,value};}catch(e){return this.failure(e,true);}}
 /** Notifications are invalidation hints only. No native body reaches the renderer. */
 notification(method:string,params:unknown):void {
  if(method==='serverRequest/resolved'){try{const r=object(params);for(const [key,q] of this.questions)if(q.view.threadId===r.threadId&&q.view.requestId===r.requestId)this.dropQuestion(key);}catch{/* malformed notification reveals nothing */}}
  if(['turn/completed','turn/started','item/started','item/completed','item/agentMessage/delta','item/commandExecution/outputDelta','turn/plan/updated','serverRequest/resolved'].includes(method))this.options.onProgressChanged?.();
 }
 async progress(input:ProgressInput):Promise<TasksResult<ProgressSnapshot>> {
  const s=this.scope();let authorityFailure=false,identityFailure=true;let policyBefore:InquelloWorkspaceExecutionPolicy|null=null;try{
   if(!this.current(s))throw new Error();await this.options.syncPrincipal();if(!this.current(s))throw new Error();identityFailure=false;
   authorityFailure=true;const policy=await this.options.freshPolicy(input.workspaceId);if(!policy||!this.current(s))throw new Error();policyBefore=policy;authorityFailure=false;
   const value=parseProgress(await this.options.runtime.request('inquello/tasks/progress',{taskId:input.taskId,workspacePolicy:policy}));
   if(!this.current(s)||value.taskId!==input.taskId||value.workspaceId!==input.workspaceId)throw new Error();
   authorityFailure=true;const after=await this.options.freshPolicy(input.workspaceId);if(!after||!this.current(s)||JSON.stringify(after)!==JSON.stringify(policy))throw new Error();authorityFailure=false;
   for(const [key,q] of this.questions){if(q.binding?.taskId!==input.taskId)continue;if(!this.current(q.scope)||q.binding.workspaceId!==value.workspaceId||q.binding.runId!==value.runId||q.binding.runtimeId!==value.runtimeId||q.view.threadId!==value.threadId||q.view.turnId!==value.turnId||terminalProgress(value.status))this.dropQuestion(key);}
   value.questions=[...this.questions.values()].filter(q=>q.binding?.taskId===value.taskId&&this.current(q.scope)).map(q=>q.view);
   value.sessionGeneration=s.epoch;value.historyIncomplete ||=this.historyIncomplete;
   return{ok:true,value};
  }catch(error){
   // A failed/malformed hydration still waited: establish current Workspace
   // authority before treating it as Task-local and retaining other questions.
   if(!authorityFailure&&policyBefore&&this.current(s)){
    try{const fresh=await this.options.freshPolicy(input.workspaceId);authorityFailure=!fresh||JSON.stringify(fresh)!==JSON.stringify(policyBefore);}catch{authorityFailure=true;}
   }
   if(!this.current(s)){if(s.epoch===this.epoch)this.invalidate(false);}else{const kind=inquelloRefusal(error)?.kind;if(identityFailure||kind==='session_changed'||kind==='classification_unknown')this.invalidate(false);else this.suppress(input.taskId,input.workspaceId,authorityFailure||kind==='authority_unknown'||kind==='stale');}return{ok:false,reason:'Current Task progress or Workspace authority is unavailable. Previously shown progress and pending answers have been cleared.',code:'refused'};}
 }
 async question(id:NativeRequestId,params:unknown):Promise<unknown> {
  const s=this.scope();let key:string|undefined;
  try{
   const view=parseQuestion(id,params);key=this.questionKey(id);
   if(!this.current(s)||this.questions.has(key))return{answers:{}};
   const bytes=[...this.questions.values()].reduce((n,q)=>n+Buffer.byteLength(JSON.stringify(q.view)),0);
   if(this.questions.size>=16||bytes+Buffer.byteLength(JSON.stringify(view))>131072){this.historyIncomplete=true;this.options.onProgressChanged?.();return{answers:{}};}
   let resolve!:(v:unknown)=>void;const answer=new Promise<unknown>(r=>{resolve=r;});
   const pending={view,scope:s,binding:null as {taskId:string;workspaceId:string;runId:string;runtimeId:string}|null,resolve};this.questions.set(key,pending);
   await this.options.syncPrincipal();if(!this.current(s)||this.questions.get(key)!==pending){this.dropQuestion(key);return{answers:{}};}
   const b=object(await this.options.runtime.request('inquello/tasks/forThread',{threadId:view.threadId}));
   if(!this.current(s)||this.questions.get(key)!==pending||b.threadId!==view.threadId||b.turnId!==view.turnId||terminalProgress(String(b.status)))throw new Error();
   pending.binding={taskId:uuid(b.taskId),workspaceId:uuid(b.workspaceId),runId:progressId(b.runId),runtimeId:progressId(b.runtimeId)};
   const snapshot=await this.progress(pending.binding);if(!snapshot.ok||this.questions.get(key)!==pending)throw new Error();
   this.options.onProgressChanged?.();return await answer;
  }catch{if(key)this.dropQuestion(key);return{answers:{}};}
 }
 async answer(input:AnswerInput):Promise<TasksResult<{answered:boolean}>> {
  const key=this.questionKey(input.requestId),pending=this.questions.get(key);
  if(!pending||pending.binding?.taskId!==input.taskId||pending.binding?.workspaceId!==input.workspaceId)return{ok:false,reason:'This question is no longer available.'};
  try{
   const answers=parseAnswers(input.answers),questions=pending.view.questions;
   if(Object.keys(answers).length!==questions.length||questions.some(q=>!Object.hasOwn(answers,q.id)))throw new Error();
   for(const q of questions){const selected=answers[q.id]!.answers;if(!selected.length||selected.length>1)throw new Error();if(q.options&&!q.isOther&&selected.some(a=>!q.options!.some(o=>o.label===a)))throw new Error();}
   const snapshot=await this.progress(input);
   if(!snapshot.ok||this.questions.get(key)!==pending||!this.current(pending.scope)||!snapshot.value.questions.some(q=>q.requestId===input.requestId))throw new Error();
   this.questions.delete(key);pending.resolve({answers});this.options.onProgressChanged?.();return{ok:true,value:{answered:true}};
  }catch{return{ok:false,reason:'This answer was not submitted. The question or its current authority is unavailable.'};}
 }

}
