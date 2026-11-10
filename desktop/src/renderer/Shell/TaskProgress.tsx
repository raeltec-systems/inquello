import { ConversationItems as EvidenceItems } from './ConversationItems';
import type {StartedTask} from './tasks-bridge';
import type {QuestionSelection} from './Inbox';
/** Authorized, bounded presentation only. No native notifications or model inference here. */
import {useEffect,useRef,useState,type FormEvent,type ReactElement} from 'react';
import {Button,JudgmentTag,PlanSteps} from '../primitives';
import {activityLabel} from './TaskLifecycle';
import {taskValue,tasksBridge,parseProgress,type ProgressSnapshot,type ProgressQuestion,type ProgressResult,type AnswerInput} from './tasks-bridge';

import {useTaskObservationStatus,refreshTaskObservation} from './task-observation';

const ended=(status:string)=>['completed','failed','cancelled','uncertain','setup-failed'].includes(status);
const scope=(s:ProgressSnapshot)=>JSON.stringify([s.taskId,s.workspaceId,s.runId,s.threadId,s.turnId,s.runtimeId,s.sessionGeneration]);
const questionKey=(q:ProgressQuestion)=>JSON.stringify([typeof q.requestId,q.requestId,q.threadId,q.turnId,q.itemId]);
const invalidAnswer=(text:string)=>/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);

function Question({request,onAnswer}:{request:ProgressQuestion;onAnswer:(answers:AnswerInput['answers'])=>Promise<void>}):ReactElement {
 const [draft,setDraft]=useState<Record<string,string>>({}),[other,setOther]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false);
 const value=(id:string)=>Object.hasOwn(draft,id)&&typeof draft[id]==='string'?draft[id]!:'';
 const isOther=(id:string)=>Object.hasOwn(other,id)&&other[id]===true;
 const tooLong=request.questions.some(q=>new TextEncoder().encode(value(q.id)).length>4096);
 const hasControls=request.questions.some(q=>invalidAnswer(value(q.id)));
 const valid=!hasControls&&!tooLong&&request.questions.every(q=>value(q.id).trim());
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy||!valid)return;setBusy(true);const answers:AnswerInput['answers']=Object.create(null);for(const q of request.questions)answers[q.id]={answers:[value(q.id)]};try{await onAnswer(answers);}finally{setDraft({});setBusy(false);}};
 return <form data-question-item={request.itemId} data-question-turn={request.turnId} data-question-request={JSON.stringify(request.requestId)} tabIndex={-1} className="iq-progress-question" onSubmit={event=>void submit(event)} aria-label="Agent question">
  <p>Answer requested. Your answer grants no tool permission and is not analytical review or Professional Approval.</p>
  {request.questions.map(q=><fieldset key={q.id} disabled={busy}><legend>{q.header}</legend><p>{q.question}</p>
   {q.options?.map((o,index)=><label key={index} className="iq-progress-option"><input type="radio" name={`${questionKey(request)}:${q.id}`} checked={!isOther(q.id)&&draft[q.id]===o.label} onChange={()=>{setOther(d=>({...d,[q.id]:false}));setDraft(d=>({...d,[q.id]:o.label}));}}/>{o.label}<span>{o.description}</span></label>)}
   {!!q.options?.length&&q.isOther&&<label><input type="radio" name={`${questionKey(request)}:${q.id}`} checked={!!isOther(q.id)} onChange={()=>{setOther(d=>({...d,[q.id]:true}));setDraft(d=>({...d,[q.id]:''}));}}/>Other answer</label>}
   {(!q.options?.length||isOther(q.id))&&<label>Answer for {q.header}<input type={q.isSecret?'password':'text'} autoComplete="off" spellCheck={!q.isSecret} value={value(q.id)} maxLength={4096} onChange={e=>setDraft(d=>({...d,[q.id]:e.target.value}))} onKeyDown={e=>{if(e.nativeEvent.isComposing&&e.key==='Enter')e.preventDefault();}}/></label>}
   {new TextEncoder().encode(value(q.id)).length>4096&&<p role="alert">Answer exceeds 4096 UTF-8 bytes. Shorten it before sending; your draft is preserved.</p>}
   {invalidAnswer(value(q.id))&&<p role="alert">Answer contains unsupported control characters. Remove them before sending; your draft is preserved.</p>}
   {q.isSecret&&<p>Secret answer: hidden while typing and discarded from this form after submission.</p>}
  </fieldset>)}
  <Button type="submit" pending={busy} disabledReason={!valid?(hasControls?'Remove unsupported control characters.':tooLong?'Shorten answers to 4096 UTF-8 bytes.':'Answer each question before sending.'):undefined}>Send answer</Button>
 </form>;
}


/** "1m 12s" from a measured duration; whole seconds, never rounded up into work that did not happen. */
export function workedFor(ms:number):string {
 const total=Math.floor(ms/1000);
 if(total<1)return 'under 1s';
 const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
 return h?`${h}h ${m}m`:m?`${m}m ${sec}s`:`${sec}s`;
}
/** The neutral end-of-turn line (Codex "Worked for …" pattern): execution ended, nothing more is claimed. */
export function finishedText(durationMs?:number):string {
 return durationMs===undefined?'Finished':`Finished · worked for ${workedFor(durationMs)}`;
}

const checkLabel=(result:ProgressResult)=>result.checks==='checked'?'Checked':result.checks==='incomplete'?'Checks incomplete':'Unchecked';
/** One current result: judgment and check inline; revision, scope, evidence and basis behind one disclosure. */
function ResultEntry({result}:{result:ProgressResult}):ReactElement {
 const details=[result.revision!==undefined?`Revision ${result.revision} · Current${result.changeReason?` · ${result.changeReason}`:''}`:null,result.checkScope?`Check scope: ${result.checkScope}`:null,result.evidenceIds.length?`Evidence: ${result.evidenceIds.join(', ')}`:null].filter((line):line is string=>!!line);
 return <article className="iq-result" data-result-id={result.id}>
  <div className="iq-result-line">
   {result.kind===null?<><span className="iq-result-note">Agent response — structured labels unavailable</span><span className="iq-progress-text">{result.text}</span></>:result.kind==='decision'?(result.basis?<JudgmentTag kind="decision" basis={{by:result.basis.label,scope:result.basis.scope}}>{result.text}</JudgmentTag>:<><span className="iq-result-note">Decision claim — basis missing or unverified. No authoritative decision is established.</span><span className="iq-progress-text">{result.text}</span></>):<JudgmentTag kind={result.kind}>{result.text}</JudgmentTag>}
   <span className="iq-result-check" data-result-check={result.checks}>{checkLabel(result)}</span>
  </div>
  {(details.length>0||result.basis)&&<details className="iq-result-details"><summary>Details</summary>{details.map(line=><p key={line}>{line}</p>)}{result.basis&&<p>Basis: {result.basis.kind} record {result.basis.id}. Permission to execute is not analytical review or Professional Approval.</p>}</details>}
 </article>;
}
/** One earlier version: its state and text inline; its reasons and citations behind one disclosure. */
function HistoricalEntry({result}:{result:ProgressResult}):ReactElement {
 return <article className="iq-result iq-result--history" data-result-history={result.id}>
  <div className="iq-result-line"><span className="iq-result-note">{result.state==='withdrawn'?'Withdrawn':'Superseded'} · Revision {result.revision??1}</span><span className="iq-progress-text">{result.text}</span><span className="iq-result-check" data-result-check="unchecked">Unchecked</span></div>
  <details className="iq-result-details"><summary>Details</summary>
   {result.sourceTurnId&&<p>Turn {result.sourceTurnId}</p>}<p>Revision reason: {result.changeReason??'Initial finding'}</p>{result.supersededReason&&<p>Superseded because: {result.supersededReason}</p>}{result.evidenceIds.length>0&&<p>Evidence: {result.evidenceIds.join(', ')}</p>}
  </details>
 </article>;
}

export function TaskProgress({taskId,workspaceId,selectedQuestion,accepted}:{taskId:string;workspaceId:string;pollMs?:number;selectedQuestion?:QuestionSelection|null;accepted?:StartedTask}):ReactElement {
 const observation=useTaskObservationStatus(taskId,workspaceId,true,true),observed=observation.snapshot;
 const [snapshot,setSnapshot]=useState<ProgressSnapshot|null>(null),[notice,setNotice]=useState('Reading progress…'),[announcement,setAnnouncement]=useState('');
 const [pages,setPages]=useState<{current?:ProgressSnapshot;history?:ProgressSnapshot}>({}),[pageBusy,setPageBusy]=useState(false);
 const offsets=useRef<{current:number[];history:number[]}>({current:[],history:[]});
 const current=useRef<ProgressSnapshot|null>(null),generation=useRef(0),consumed=useRef(new Set<string>());
 useEffect(()=>{generation.current++;current.current=null;consumed.current.clear();setPages({});setPageBusy(false);offsets.current={current:[],history:[]};setSnapshot(null);setAnnouncement('');setNotice('Reading progress…');return()=>{generation.current++;current.current=null;};},[taskId,workspaceId]);
 useEffect(()=>{
  if(!observed){generation.current++;current.current=null;setPages({});setPageBusy(false);offsets.current={current:[],history:[]};setSnapshot(null);setAnnouncement('');consumed.current.clear();setNotice(observation.settled?'Conversation history is unavailable. Refresh to check again.':'Reading conversation…');return;}
  const next={...observed,questions:observed.questions.filter(q=>!consumed.current.has(`${scope(observed)}:${questionKey(q)}`))};
  const before=current.current;if(before?.resultPage?.snapshotId!==next.resultPage?.snapshotId||before&&scope(before)!==scope(next)){setPages({});setPageBusy(false);offsets.current={current:[],history:[]};}
  if(before&&scope(before)===scope(next)){
   const messages:string[]=[];if(before.status!==next.status)messages.push(`Execution: ${next.status==='completed'?'finished':next.status}.`);
   for(const q of next.questions)if(!before.questions.some(old=>questionKey(old)===questionKey(q)))messages.push('An answer is requested.');
   for(const item of next.items){const old=before.items.find(row=>row.id===item.id);if((old&&old.status!==item.status)||(!old&&['completed','failed','cancelled'].includes(item.status)))messages.push(`${item.kind === 'message' ? 'Response' : 'Tool activity'} ${next.items.indexOf(item)+1}: ${item.status}.`);}
   if(messages.length)setAnnouncement(messages.join(' '));
  }else setAnnouncement([...next.questions.map(q=>'An answer is requested.'),...next.items.filter(item=>['completed','failed','cancelled'].includes(item.status)).map(item=>`${item.kind === 'message' ? 'Response' : 'Tool activity'} ${next.items.indexOf(item)+1}: ${item.status}.`)].join(' '));
  current.current=next;setSnapshot(next);setNotice('');
 },[observed,observation.settled]);
 const focusedQuestion=useRef<number|null>(null);
 const [questionNotice,setQuestionNotice]=useState('');
 useEffect(()=>{
  if(!selectedQuestion){focusedQuestion.current=null;setQuestionNotice('');return;}
  if(!snapshot)return;
  const exact=snapshot.questions.some(q=>q.requestId===selectedQuestion.requestId&&q.turnId===selectedQuestion.turnId&&q.itemId===selectedQuestion.itemId);
  if(!exact||ended(snapshot.status)){setQuestionNotice('The selected question was resolved or replaced. No answer was sent.');return;}
  setQuestionNotice('');if(focusedQuestion.current===selectedQuestion.visit)return;
  const target=[...document.querySelectorAll<HTMLElement>('[data-question-item]')].find(e=>e.dataset.questionItem===selectedQuestion.itemId&&e.dataset.questionTurn===selectedQuestion.turnId&&e.dataset.questionRequest===JSON.stringify(selectedQuestion.requestId));
  if(target){focusedQuestion.current=selectedQuestion.visit;target.focus();target.scrollIntoView?.({block:'center'});}
 },[selectedQuestion,snapshot]);
 const baseView=snapshot?.taskId===taskId&&snapshot.workspaceId===workspaceId?snapshot:null;
 const currentPage=pages.current?.resultPage?.snapshotId===baseView?.resultPage?.snapshotId?pages.current:undefined;
 const historyPage=pages.history?.resultPage?.snapshotId===baseView?.resultPage?.snapshotId?pages.history:undefined;
 const view=baseView?{...baseView,results:currentPage?.results??baseView.results,resultHistory:historyPage?.resultHistory??baseView.resultHistory}:null;
 const page=async(kind:'current'|'history',offset:number,back=false)=>{
  const before=current.current,api=tasksBridge(),gen=generation.current;if(!api||!before?.resultPage||pageBusy)return;setPageBusy(true);
  const prior=(kind==='current'?currentPage:historyPage)?.resultPage??before.resultPage;
  try{const result=parseProgress(taskValue(await api.progress({taskId,workspaceId,resultPage:{snapshotId:before.resultPage.snapshotId,currentOffset:kind==='current'?offset:before.resultPage.currentTotal,historyOffset:kind==='history'?offset:before.resultPage.historyTotal}})));
   if(gen!==generation.current||!current.current||scope(current.current)!==scope(before)||current.current.resultPage?.snapshotId!==result.resultPage?.snapshotId)return;
   if(offset===0)offsets.current[kind]=[];else if(back)offsets.current[kind].pop();else offsets.current[kind]=[...offsets.current[kind],kind==='current'?prior.currentOffset:prior.historyOffset].slice(-128);
   setPages(old=>({...old,[kind]:result}));setNotice('');
  }catch{if(gen===generation.current){setPages({});current.current=null;setSnapshot(null);setNotice('Result page changed or access is unavailable. Refreshing authorized progress…');refreshTaskObservation(taskId,workspaceId);}}
  finally{if(gen===generation.current)setPageBusy(false);}
 };
 // Quiet paging: shown only when a result list spans more than one snapshot-bound page.
 const paging=(kind:'current'|'history')=>{const meta=(kind==='current'?currentPage:historyPage)?.resultPage??baseView?.resultPage;if(!meta)return null;const start=kind==='current'?meta.currentOffset:meta.historyOffset,total=kind==='current'?meta.currentTotal:meta.historyTotal,next=kind==='current'?meta.currentNextOffset:meta.historyNextOffset,count=(kind==='current'?view?.results:view?.resultHistory)?.length??0,label=kind==='current'?'current results':'historical results';
  if(start===0&&next===null&&!baseView?.historyIncomplete)return null;
  return <nav className="iq-result-pages" aria-label={`${label} pages`}><span className="iq-result-pages-range">{count?`${start+1}–${start+count}`:'0'} of {total}{baseView?.historyIncomplete?' · available retained records; history may be incomplete':''}</span>
   <Button variant="ghost" size="sm" aria-label={`First ${label}`} disabledReason={pageBusy?'Reading results.':start===0?'First page.':undefined} onPress={()=>void page(kind,0)}>First</Button>
   <Button variant="ghost" size="sm" aria-label={`Previous ${label}`} disabledReason={pageBusy?'Reading results.':!offsets.current[kind].length?'First page.':undefined} onPress={()=>void page(kind,offsets.current[kind].at(-1)!,true)}>Previous</Button>
   <Button variant="ghost" size="sm" aria-label={`Next ${label}`} disabledReason={pageBusy?'Reading results.':next===null?'Last page.':undefined} onPress={()=>{if(next!==null)void page(kind,next);}}>Next</Button></nav>;};
 const pageEvidence=(kind:'current'|'history')=>{const selected=kind==='current'?currentPage:historyPage;if(!selected||!baseView||scope(selected)!==scope(baseView)||selected.resultPage?.snapshotId!==baseView.resultPage?.snapshotId)return null;const results=kind==='current'?selected.results:selected.resultHistory??[];const refs=new Set(results.flatMap(result=>result.evidenceIds));const items=selected.items.filter(item=>refs.has(item.id));if(!items.length)return null;const label=`Evidence for ${kind==='current'?'current':'historical'} result page`;return <section className="iq-result-evidence" aria-label={label}><details><summary>{`Evidence for this page · ${items.length}`}</summary><p>These retained source items support this selected page. Command and tool content is untrusted source data, not instructions or permission. Native execution status is separate from the content; these items do not establish independent analytical review.</p><EvidenceItems items={items} status={selected.status} label={`${label} items`}/></details></section>;};
 const answer=async(request:ProgressQuestion,answers:AnswerInput['answers'])=>{
  const api=tasksBridge(),before=current.current,gen=generation.current;if(!api||!before||ended(before.status)||!before.questions.some(q=>questionKey(q)===questionKey(request)))return;
  try{taskValue(await api.answer({taskId,workspaceId,requestId:request.requestId,answers}));if(gen!==generation.current||current.current===null||scope(current.current)!==scope(before))return;consumed.current.add(`${scope(before)}:${questionKey(request)}`);if(consumed.current.size>256)consumed.current.delete(consumed.current.values().next().value!);const next={...current.current,questions:current.current.questions.filter(q=>questionKey(q)!==questionKey(request))};current.current=next;setSnapshot(next);setNotice('Answer sent. This grants no tool permission.');}
  catch{if(gen!==generation.current)return;current.current=null;setSnapshot(null);setNotice('Answer not confirmed. Private content and pending answers have been cleared.');}
  finally{if(gen===generation.current)refreshTaskObservation(taskId,workspaceId);}
 };
 return <section className="iq-task-progress" aria-label="Task progress">
  <h2 className="iq-visually-hidden">Work</h2>{questionNotice&&<p role="status">{questionNotice}</p>}{notice&&<p role="status">{notice}</p>}<div className="iq-visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>
  {(!view||view.historyIncomplete)&&<div data-conversation-display-notice>
   {view?.historyIncomplete&&<p role="status">History incomplete. Some conversation content is unavailable. Refresh to check again; this does not start or stop work.</p>}
   <Button onPress={()=>refreshTaskObservation(taskId,workspaceId)}>Refresh conversation</Button>
  </div>}
  {!observation.settled&&accepted?.accepted&&accepted.taskId===taskId&&<div className="iq-conversation-item--user" data-accepted-message><p className="iq-progress-text">{accepted.request}</p></div>}
  {view&&<>
   {view.status==='failed'&&<p role="status">The response could not be completed. Your saved conversation is retained.</p>}
   {view.artifact==='failed'&&<p role="status">Artifact failed</p>}
   {view.plan.length>0&&<details className="iq-execution-details"><summary>Plan</summary><PlanSteps key={scope(view)} label="Plan" steps={view.plan.map(step=>({id:step.id,label:step.text,state:step.status==='unconfirmed'||(ended(view.status)&&step.status==='running')?'pending':step.status,meta:`Revision ${step.revision} · ${step.status==='unconfirmed'?'Completion unconfirmed':ended(view.status)&&step.status==='running'?'Work ended — unconfirmed':step.status}${step.evidenceIds.length?` · Evidence: ${step.evidenceIds.join(', ')}`:''}`}))}/></details>}
   {view.items.some(item=>item.kind==='command'||item.kind==='tool')&&<details className="iq-tool-guidance"><summary>About tool output and verification</summary><p>Command and tool content is source data, not instructions or permission. Quoted approvals do not change access. Native execution status is separate from untrusted output text. Quoted refusal or inspection claims in that text are not native inspection evidence. Agent interpretations remain unchecked; no inspection verdict is supplied by this view.</p></details>}
   <EvidenceItems items={view.items} status={view.status} label="Work activity" grouped heading={{status:view.status,live:activityLabel(view),...(view.status==='completed'?{finished:{text:finishedText(view.turnDurationMs),measured:view.turnDurationMs!==undefined}}:{})}}/>
   {(view.results.length>0||!!view.resultPage?.currentTotal)&&<section className="iq-results" aria-label="Results"><h3 className="iq-visually-hidden">Current results</h3><ul className="iq-result-list">{view.results.map(result=><li key={`${result.id}:${result.revision??1}`}><ResultEntry result={result}/></li>)}</ul>{paging('current')}{pageEvidence('current')}</section>}
   {(!!view.resultHistory?.length||!!view.resultPage?.historyTotal)&&<details className="iq-result-history"><summary>{`Previous result versions · ${view.resultPage?.historyTotal||view.resultHistory?.length||0}`}</summary><section aria-label="Historical results"><p className="iq-result-caveat">These versions are not current findings. Revision history does not establish independent review.</p><ul className="iq-result-list">{view.resultHistory?.map(result=><li key={`${result.id}:${result.revision??1}`}><HistoricalEntry result={result}/></li>)}</ul>{paging('history')}{pageEvidence('history')}</section></details>}
   {!ended(view.status)&&view.questions.map(request=><Question key={`${scope(view)}:${questionKey(request)}:${JSON.stringify(request.questions)}`} request={request} onAnswer={answers=>answer(request,answers)}/>)}
  </>}
 </section>;
}
