/** Named controls over authorized snapshots. Neither navigation nor recovery starts work. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Button} from '../primitives';
import {Composer} from './Composer';
import type {DraftBinding} from './drafts';
import {taskValue,tasksBridge,type ProgressSnapshot,type LifecycleReceipt} from './tasks-bridge';

export {useTaskObservation as useTaskActivity} from './task-observation';
import {useTaskObservation} from './task-observation';
export function activityLabel(view:ProgressSnapshot):string {
 if(view.questions.length&&!['completed','cancelled','failed','uncertain'].includes(view.status))return 'Waiting for your answer';
 if(view.status==='cancelled')return 'Interrupted — Resume available';
 if(view.status==='uncertain')return 'Interrupted — outcome uncertain';
 if(view.status==='completed')return 'Finished — review not recorded';
 if(view.status==='failed')return 'Stopped after an error';
 return ['active','running'].includes(view.status)?'Running':view.status;
}
export function TaskActivityLabel({taskId,workspaceId}:{taskId:string;workspaceId:string}):ReactElement {
 const view=useTaskObservation(taskId,workspaceId);return <span id={`task-activity-${taskId}`} className="iq-nav-row-meta" data-task-activity>{view?activityLabel(view):'Status unavailable'}</span>;
}
export function interruptionSummary(view:ProgressSnapshot):string {
 const done=view.plan.filter(step=>step.status==='done').length,remain=view.plan.length-done;
 return view.plan.length&&!view.historyIncomplete?`Work interrupted. ${done} steps completed; ${remain} remain.`:'Work interrupted. Completed and remaining step counts are not fully known.';
}
type Settlement={applied:boolean;acknowledged:boolean;pending:boolean};
const settlementStores=new WeakMap<object,Map<string,Settlement>>();
function settlementStore(api:NonNullable<ReturnType<typeof tasksBridge>>){let store=settlementStores.get(api);if(!store){store=new Map();settlementStores.set(api,store);api.onSessionChanged?.(identityChanged=>{if(identityChanged)store!.clear();});}return store;}
export function TaskLifecycle({taskId,workspaceId,draft,operationIds=()=>crypto.randomUUID()}:{taskId:string;workspaceId:string;draft:DraftBinding;operationIds?:()=>string}):ReactElement {
 const view=useTaskObservation(taskId,workspaceId,true,true),[busy,setBusy]=useState<'steer'|'stop'|'resume'|null>(null),[notice,setNotice]=useState('');
 const pending=useRef<{operationId:string;kind:'steer'|'stop'|'resume';request:string|null}|null>(null),mounted=useRef(true),latest=useRef(draft);latest.current=draft;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const settle=(receipt:Pick<LifecycleReceipt,'operationId'|'taskId'|'kind'|'status'>,retained?:{kind:LifecycleReceipt['kind'];request:string|null})=>{
  const api=tasksBridge();if(!api)return;
  const op=pending.current?.operationId===receipt.operationId?pending.current:retained??view?.lifecycleOperations?.find(op=>op.operationId===receipt.operationId);if(!op||receipt.taskId!==taskId||receipt.kind!==op.kind)return;
  const terminal=['admitted','interrupted','completed','rejected','unresolved'].includes(receipt.status);
  if(!terminal){setNotice(receipt.kind==='stop'?'Stopping… awaiting confirmed interruption.':'The operation is being reconciled. Your draft is preserved; no command is repeated.');return;}
  const store=settlementStore(api),key=JSON.stringify([workspaceId,taskId,receipt.operationId]);let state=store.get(key);
  if(!state){state={applied:false,acknowledged:false,pending:false};store.set(key,state);for(const [id,old]of store){if(store.size<=256)break;if(old.acknowledged)store.delete(id);}}
  if(!state.applied){
   state.applied=true;
   if(receipt.status==='admitted'){
    if(op.request!==null){if(latest.current.clearIfUnchanged)latest.current.clearIfUnchanged(op.request);else if(latest.current.value===op.request)latest.current.onChange('');}
    setNotice(receipt.kind==='steer'?'Guidance received. Revisions will appear as the agent completes them.':'Continuing this Task with its retained history.');
   }else if(receipt.status==='interrupted')setNotice('Interruption confirmed. Confirmed effects remain; interruption is not rollback.');
   else if(receipt.status==='completed')setNotice('The work finished before interruption was confirmed.');
   else if(receipt.status==='unresolved')setNotice('The prior instruction outcome could not be confirmed. Work is no longer running; your draft is preserved.');
   else setNotice('The instruction was not admitted. Your draft is preserved.');
  }
  if(pending.current?.operationId===receipt.operationId)pending.current=null;
  if(!state.acknowledged&&!state.pending&&api.settleLifecycle){state.pending=true;const entry=state;void api.settleLifecycle({operationId:receipt.operationId,taskId,workspaceId}).then(response=>{const value=taskValue(response) as {settled?:boolean};if(value?.settled===true)entry.acknowledged=true;}).catch(()=>{/* Retry acknowledgement on the next authorized observation, never the instruction or draft change. */}).finally(()=>{entry.pending=false;});}
 };
 useEffect(()=>{for(const op of view?.lifecycleOperations??[])settle({...op,taskId},op);if(view?.lifecycle)settle(view.lifecycle);},[view?.lifecycle,view?.lifecycleOperations]);
 const running=!!view&&['active','running'].includes(view.status),resumable=!!view&&['cancelled','uncertain','failed'].includes(view.status);
 const execute=async(kind:'steer'|'stop'|'resume')=>{
  const api=tasksBridge();if(!api||!view||(kind==='stop'?(busy==='stop'||pending.current?.kind==='stop'||view.lifecycleOperations?.some(op=>op.kind==='stop'&&['reserved','dispatching','uncertain'].includes(op.status))):(busy||(pending.current&&!(kind==='resume'&&resumable)))))return;const request=kind==='stop'?null:draft.value.trim()?draft.value:null;if(kind==='steer'&&request===null)return;
  const op={operationId:operationIds(),kind,request};pending.current=op;setBusy(kind);setNotice(kind==='stop'?'Stopping… awaiting confirmed interruption.':kind==='resume'?'Checking access to retained work…':'Sending guidance…');
  try{const base={operationId:op.operationId,taskId,workspaceId};const response=await (kind==='stop'?api.stop(base):api[kind]({...base,request}));if(response&&typeof response==='object'&&(response as {ok?:boolean;code?:string}).ok===false&&(response as {code?:string}).code!=='uncertain')pending.current=null;const value=taskValue(response) as LifecycleReceipt;if(mounted.current)settle(value);}
  catch(error){if(mounted.current){setNotice(error instanceof Error?error.message:'The operation is unconfirmed. Your draft is preserved.');}}
  finally{if(mounted.current)setBusy(current=>current===kind?null:current);}
 };
 const unavailable=busy?'Waiting for the current operation.':pending.current?'Reconciling the current operation.':!view?'Current Task access is unavailable.':!running?'Use Resume to continue interrupted work.':undefined;
 return <section aria-label="Task controls">
  {view?.status==='cancelled'&&<p role="status">{interruptionSummary(view)}</p>}
  {view?.status==='uncertain'&&<p role="status">Work was interrupted or its outcome is uncertain. Resume is explicit; work does not restart automatically.</p>}
  {notice&&<p role="status">{notice}</p>}
  {resumable&&<Button onPress={()=>void execute('resume')} disabledReason={busy?'Reconciling the current operation.':undefined}>Resume</Button>}
  <Composer draft={draft} onSend={()=>void execute('steer')} disabledReason={unavailable} onStop={view?()=>void execute('stop'):undefined} stopDisabledReason={busy==='stop'||pending.current?.kind==='stop'||view?.lifecycleOperations?.some(op=>op.kind==='stop'&&['reserved','dispatching','uncertain'].includes(op.status))?'Waiting for interruption confirmation.':!running?'Work is not running.':undefined}/>
 </section>;
}
