export interface LifecycleReceipt {operationId:string;taskId:string;runId:string;threadId:string;turnId:string|null;runtimeId:string;kind:'steer'|'stop'|'resume';status:'reserved'|'dispatching'|'admitted'|'interrupted'|'completed'|'rejected'|'uncertain'|'unresolved'}
export interface LifecycleCommand {operationId:string;taskId:string;workspaceId:string;request:string|null}
export type NativeRequestId=string|number;
export interface ProgressItem {role?:'user'|'agent';id:string;kind:'message'|'command'|'tool'|'edit';status:'running'|'completed'|'failed'|'cancelled'|'proposed'|'unknown';text:string;application?:'applied'|'suggested'|'unknown'}
export interface ProgressStep {id:string;revision:number;text:string;status:'pending'|'running'|'unconfirmed'|'done';evidenceIds:string[]}
export interface ProgressResult {revision?:number;state?:'current'|'superseded'|'withdrawn';changeReason?:string|null;supersededReason?:string|null;sourceTurnId?:string;id:string;kind:'calculation'|'observation'|'suggestion'|'decision'|'gap'|null;text:string;checks:'unchecked'|'incomplete'|'checked';checkScope:string|null;evidenceIds:string[];basis:{kind:'human'|'policy';id:string;label:string;scope:string}|null}
export interface ProgressQuestion {requestId:NativeRequestId;threadId:string;turnId:string;itemId:string;questions:{id:string;header:string;question:string;isOther:boolean;isSecret:boolean;options:null|{label:string;description:string}[]}[]}
export interface ResultPageRequest {snapshotId?:string;currentOffset?:number;historyOffset?:number}
export interface ResultPage {snapshotId:string;currentOffset:number;historyOffset:number;currentTotal:number;historyTotal:number;currentNextOffset:number|null;historyNextOffset:number|null}
export interface ProgressSnapshot {resultPage?:ResultPage;lifecycleOperations?:Array<{operationId:string;kind:LifecycleReceipt["kind"];request:string|null;status:LifecycleReceipt["status"]}>;lifecycle?:LifecycleReceipt;version:1;taskId:string;runId:string;workspaceId:string;threadId:string;turnId:string|null;runtimeId:string;status:string;historyIncomplete:boolean;items:ProgressItem[];plan:ProgressStep[];results:ProgressResult[];resultHistory?:ProgressResult[];artifact:'absent'|'unknown'|'failed';questions:ProgressQuestion[];sessionGeneration:number}
export interface ProgressInput {taskId:string;workspaceId:string;resultPage?:ResultPageRequest}
export interface AnswerInput extends ProgressInput {requestId:NativeRequestId;answers:Record<string,{answers:string[]}>}

/** Bounded presentation projection, not generated native protocol bindings. */
export interface StartCandidate {routeId:string;configurationRevision:number;reasoning:string[];speeds:string[];available:boolean;reason:string;executionFlow:string;inferenceFlow:string}
export interface StartedTask {operationId:string;taskId:string;runId:string;threadId:string|null;status:string;request:string;accepted:boolean;reason?:string}
export interface StartCommand {operationId:string;workspaceId:string;engagementId:string|null;folderId:string|null;request:string;routeId:string;configurationRevision:number;reasoning:string;speed:string}
interface TaskBridge {settleLifecycle?(input:Omit<LifecycleCommand,"request">):Promise<unknown>;activity?(input:ProgressInput):Promise<unknown>;steer(input:LifecycleCommand):Promise<unknown>;stop(input:Omit<LifecycleCommand,'request'>):Promise<unknown>;resume(input:LifecycleCommand):Promise<unknown>;progress(input:ProgressInput):Promise<unknown>;answer(input:AnswerInput):Promise<unknown>;onProgressChanged?(listener:()=>void):()=>void;onSessionChanged?(listener:(identityChanged:boolean)=>void):()=>void;preflight(input:{workspaceId:string;routeId:string;configurationRevision:number}):Promise<unknown>;start(input:StartCommand):Promise<unknown>;reconcile(input:{operationId:string}):Promise<unknown>}
export const tasksBridge=():TaskBridge|null=>(globalThis as {inquello?:{tasks?:TaskBridge}}).inquello?.tasks??null;
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Task information unavailable.');return v as Record<string,unknown>;}
export function taskValue(v:unknown):unknown {const r=object(v);if(r.ok!==true)throw new Error(typeof r.reason==='string'?r.reason:'Task information unavailable.');return r.value;}
const text=(v:unknown):string=>{if(typeof v!=='string')throw new Error('Task information unavailable.');return v;};
export function parseCandidate(v:unknown):StartCandidate {const r=object(v);if(typeof r.available!=='boolean'||!Number.isSafeInteger(r.configurationRevision)||(r.configurationRevision as number)<0)throw new Error('Candidate information unavailable.');const list=(v:unknown):string[]=>{if(!Array.isArray(v)||v.length>32)throw new Error('Candidate information unavailable.');return v.map(text);};return{routeId:text(r.routeId),configurationRevision:r.configurationRevision as number,reasoning:list(r.reasoning),speeds:list(r.speeds),available:r.available,reason:text(r.reason),executionFlow:text(r.executionFlow),inferenceFlow:text(r.inferenceFlow)};}
export function parseStarted(v:unknown):StartedTask {const r=object(v);if(typeof r.accepted!=='boolean')throw new Error('Binding not confirmed.');return{operationId:text(r.operationId),taskId:text(r.taskId),runId:text(r.runId),threadId:r.threadId===null?null:text(r.threadId),status:text(r.status),request:text(r.request),accepted:r.accepted,...(typeof r.reason==='string'?{reason:r.reason}:{})};}

/** Main has already projected and authorized this bounded snapshot. */
export function parseProgress(v:unknown):ProgressSnapshot {
 const r=object(v);
 if(r.version!==1||typeof r.historyIncomplete!=='boolean'||!Number.isSafeInteger(r.sessionGeneration))throw new Error('Progress information unavailable.');
 for(const key of ['taskId','runId','workspaceId','threadId','runtimeId','status'])text(r[key]);
 if(r.turnId!==null)text(r.turnId);
 if(r.resultHistory!==undefined&&(!Array.isArray(r.resultHistory)||r.resultHistory.length>128))throw new Error('Progress information unavailable.');
 for(const [key,max] of [['items',256],['plan',64],['results',64],['questions',16]] as const){if(!Array.isArray(r[key])||(r[key] as unknown[]).length>max)throw new Error('Progress information unavailable.');}
 if(!['absent','unknown','failed'].includes(String(r.artifact)))throw new Error('Progress information unavailable.');
 return r as unknown as ProgressSnapshot;
}
