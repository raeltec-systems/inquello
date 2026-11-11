import {modelAuthorityApplies,type ModelAuthorityChange} from './model-authority';
/** Named controls over authorized snapshots. Neither navigation nor recovery starts work. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Button} from '../primitives';
import {Composer} from './Composer';
import {ConversationModelPicker} from './ConversationModelPicker';
import type {DraftBinding} from './drafts';
import {taskValue,tasksBridge,type ProgressSnapshot,type LifecycleReceipt} from './tasks-bridge';
import {AttachControl} from './AttachControl';
import {awaitingNote,parseAttachment,parseStageOutcome,sourcesBridge,sourcesValue,useSourcesView,SOURCES_RUNNING_REASON,type AttachmentView} from './sources-bridge';

/** Adds the visible note that tells the agent where the material is, unless the draft already has it. The person can edit or remove it. */
export function withSourcesNote(draft:string,note:string):string {return draft.includes(note)?draft:draft.trim()?`${draft.replace(/\s+$/,'')}\n\n${note}`:note;}

export {useTaskObservation as useTaskActivity} from './task-observation';
import {useTaskObservation} from './task-observation';
export function activityLabel(view:ProgressSnapshot):string {
 if(view.questions.length&&!['completed','cancelled','failed','uncertain'].includes(view.status))return 'Waiting for your answer';
 if(view.status==='cancelled')return 'Interrupted — Resume available';
 if(view.status==='uncertain')return 'Interrupted — outcome uncertain';
 if(view.status==='completed')return '';
 if(view.status==='failed')return 'Stopped after an error';
 return ['active','running'].includes(view.status)?'Running':view.status;
}
export function TaskActivityLabel({taskId,workspaceId}:{taskId:string;workspaceId:string}):ReactElement {
 const view=useTaskObservation(taskId,workspaceId);return <span id={`task-activity-${taskId}`} className="iq-nav-row-meta" data-task-activity hidden={view?.status==='completed'}>{view?activityLabel(view):'Status unavailable'}</span>;
}
export function interruptionSummary(view:ProgressSnapshot):string {
 const done=view.plan.filter(step=>step.status==='done').length,remain=view.plan.length-done;
 return view.plan.length&&!view.historyIncomplete?`Work interrupted. ${done} steps completed; ${remain} remain.`:'Work interrupted. Completed and remaining step counts are not fully known.';
}
type Settlement={applied:boolean;acknowledged:boolean;pending:boolean};
const settlementStores=new WeakMap<object,Map<string,Settlement>>();
function settlementStore(api:NonNullable<ReturnType<typeof tasksBridge>>){let store=settlementStores.get(api);if(!store){store=new Map();settlementStores.set(api,store);api.onSessionChanged?.(identityChanged=>{if(identityChanged)store!.clear();});}return store;}
export function TaskLifecycle({taskId,workspaceId,draft,operationIds=()=>crypto.randomUUID(),onContinuationRequested}:{taskId:string;workspaceId:string;draft:DraftBinding;operationIds?:()=>string;onContinuationRequested?:()=>()=>void}):ReactElement {
 const [modelPending,setModelPending]=useState(true),[modelRecovering,setModelRecovering]=useState(true);
 const view=useTaskObservation(taskId,workspaceId,true,true),[busy,setBusy]=useState<'steer'|'stop'|'resume'|null>(null),[notice,setNotice]=useState('');
 const pending=useRef<{operationId:string;kind:'steer'|'stop'|'resume';request:string|null;follow?:()=>void}|null>(null),mounted=useRef(true),latest=useRef(draft);latest.current=draft;
 const authorityEpoch=useRef(0);
 useEffect(()=>{const routes=(globalThis as {inquello?:{routes?:{onChanged?(fn:(change?:ModelAuthorityChange)=>void):()=>void}}}).inquello?.routes;return routes?.onChanged?.(change=>{if(!modelAuthorityApplies(change,taskId))return;authorityEpoch.current++;setNotice('The saved model authority changed. Your draft is retained.');});},[taskId]);
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
    if(pending.current?.operationId===receipt.operationId&&receipt.kind!=='stop')pending.current.follow?.();
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
 const running=!!view&&['active','running'].includes(view.status),resumable=!!view&&['cancelled','uncertain','failed'].includes(view.status),completed=view?.status==='completed';
 const execute=async(kind:'steer'|'stop'|'resume')=>{
  const api=tasksBridge();if(!api||!view||(kind!=='stop'&&modelPending)||(kind==='stop'?(busy==='stop'||pending.current?.kind==='stop'||view.lifecycleOperations?.some(op=>op.kind==='stop'&&['reserved','dispatching','uncertain'].includes(op.status))):(busy||(pending.current&&!(kind==='resume'&&resumable)))))return;const request=kind==='stop'?null:draft.value.trim()?draft.value:null;if((kind==='steer'||(kind==='resume'&&completed))&&request===null)return;
  const op={operationId:operationIds(),kind,request,follow:kind==='stop'?undefined:onContinuationRequested?.()};pending.current=op;setBusy(kind);setNotice(kind==='stop'?'Stopping… awaiting confirmed interruption.':kind==='resume'?'Checking access to retained work…':'Sending guidance…');
  const operationEpoch=authorityEpoch.current;
  try{const base={operationId:op.operationId,taskId,workspaceId};const response=await (kind==='stop'?api.stop(base):api[kind]({...base,request}));if(operationEpoch!==authorityEpoch.current)throw new Error('Model authority changed before the result could be shown. Your draft is retained.');if(response&&typeof response==='object'&&(response as {ok?:boolean;code?:string}).ok===false&&(response as {code?:string}).code!=='uncertain')pending.current=null;const value=taskValue(response) as LifecycleReceipt;if(mounted.current)settle(value);}
  catch(error){if(mounted.current){setNotice(error instanceof Error?error.message:'The operation is unconfirmed. Your draft is preserved.');}}
  finally{if(mounted.current)setBusy(current=>current===kind?null:current);}
 };
 // Story 2.1: attach files or a folder to this Task between turns. Main stages them only while the Task is idle.
 const sourcesApi=sourcesBridge();
 const [attachment,setAttachment]=useState<{pending:boolean;shown:AttachmentView[];notice:string|null}>({pending:false,shown:[],notice:null});
 const sourceView=useSourcesView(taskId,workspaceId,view?.status??'',!!sourcesApi&&!!view);
 useEffect(()=>{const current=sourceView.view;if(!current)return;
  for(const item of current.deferred)awaitingNote.add(item.attachmentId);
  const ready=current.attachments.filter(item=>awaitingNote.has(item.attachmentId));
  if(ready.length&&current.note){for(const item of ready)awaitingNote.delete(item.attachmentId);latest.current.onChange(withSourcesNote(latest.current.value,current.note));setAttachment(old=>({...old,notice:`${ready.map(item=>item.label).join(', ')} is now in the Task folder. A note for the agent was added to your message; edit it as you like.`}));}
 },[sourceView.view]);
 const attachNow=async(kind:'files'|'folder')=>{
  if(!sourcesApi||attachment.pending)return;setAttachment(old=>({...old,pending:true,notice:null}));
  let held:AttachmentView|null=null;
  try{const value=sourcesValue(await sourcesApi.attach({kind}));if(value===null){if(mounted.current)setAttachment(old=>({...old,pending:false}));return;}held=parseAttachment(value);
   if(mounted.current)setAttachment(old=>({...old,shown:[held!]}));
   const outcome=parseStageOutcome(sourcesValue(await sourcesApi.stage({taskId,workspaceId,attachmentId:held.attachmentId,firstTurn:false})));
   if(!mounted.current)return;
   if(outcome.state==='staged'){latest.current.onChange(withSourcesNote(latest.current.value,outcome.note));setAttachment({pending:false,shown:[outcome.attachment],notice:`Attached ${outcome.attachment.label}: ${outcome.attachment.files.length} file${outcome.attachment.files.length===1?'':'s'} in the Task folder, available to your next message. A note for the agent was added to your message.`});}
   else setAttachment({pending:false,shown:[],notice:`${outcome.label}: ${outcome.notice}`});
  }catch(error){if(held)void sourcesApi.discard({attachmentId:held.attachmentId}).catch(()=>undefined);if(mounted.current)setAttachment({pending:false,shown:[],notice:error instanceof Error?error.message:'Nothing was attached.'});}
 };
 const stopPending=busy==='stop'||pending.current?.kind==='stop'||view?.lifecycleOperations?.some(op=>op.kind==='stop'&&['reserved','dispatching','uncertain'].includes(op.status));
 const unavailable=modelPending?(modelRecovering?'Checking model…':'Confirm the model change before sending.'):busy?'Waiting for the current operation.':pending.current?'Reconciling the current operation.':!view?'Current Task access is unavailable.':!running&&!completed?'Use Resume to continue interrupted work.':undefined;
 return <section aria-label="Message composer" data-task-controls={taskId} data-task-controls-status={view?.status ?? 'unavailable'}>
  {view?.status==='cancelled'&&<p role="status">{interruptionSummary(view)}</p>}
  {view?.status==='uncertain'&&<p role="status">Work was interrupted or its outcome is uncertain. Resume is explicit; work does not restart automatically.</p>}
  {notice&&<p role="status">{notice}{completed&&draft.value.trim()&&notice==='That turn has ended. Your instruction is preserved; no new turn was started.'?' Press Send again to start a follow-up.':''}</p>}
  {resumable&&<Button onPress={()=>void execute('resume')} disabledReason={busy?'Reconciling the current operation.':undefined}>Resume</Button>}
  {sourcesApi&&view&&<AttachControl attachments={attachment.shown} onAttach={kind=>void attachNow(kind)} pending={attachment.pending}
   disabledReason={sourceView.view&&!sourceView.view.available?sourceView.view.reason??'Attaching is unavailable.':running?SOURCES_RUNNING_REASON:busy||pending.current?'Waiting for the current operation.':undefined} notice={attachment.notice}/>}
  <Composer draft={draft} routeBeforeField routeLabel={<ConversationModelPicker taskId={taskId} workspaceId={workspaceId} selected={null} onPendingChange={(pending,recovering)=>{setModelPending(pending);setModelRecovering(recovering);}} disabled={running||!!busy||!!pending.current}/>} onSend={()=>void execute(completed?'resume':'steer')} disabledReason={unavailable} onStop={view&&(!completed||stopPending)?()=>void execute('stop'):undefined} stopDisabledReason={stopPending?'Waiting for interruption confirmation.':!running?'Work is not running.':undefined}/>
 </section>;
}
