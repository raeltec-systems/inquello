/** Authorized, bounded presentation only. No native notifications or model inference here. */
import {useEffect,useRef,useState,type FormEvent,type ReactElement} from 'react';
import {Button,DiffLine,JudgmentTag,PlanSteps} from '../primitives';
import {parseProgress,taskValue,tasksBridge,type ProgressSnapshot,type ProgressQuestion,type AnswerInput} from './tasks-bridge';

const ended=(status:string)=>['completed','failed','cancelled','uncertain','setup-failed'].includes(status);
const scope=(s:ProgressSnapshot)=>JSON.stringify([s.taskId,s.workspaceId,s.runId,s.threadId,s.turnId,s.runtimeId,s.sessionGeneration]);
const questionKey=(q:ProgressQuestion)=>JSON.stringify([typeof q.requestId,q.requestId,q.threadId,q.turnId,q.itemId]);
const invalidAnswer=(text:string)=>/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text);
const artifactText={absent:'No artifact yet',unknown:'Artifact information unavailable',failed:'Artifact failed'};

function Question({request,onAnswer}:{request:ProgressQuestion;onAnswer:(answers:AnswerInput['answers'])=>Promise<void>}):ReactElement {
 const [draft,setDraft]=useState<Record<string,string>>({}),[other,setOther]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false);
 const value=(id:string)=>Object.hasOwn(draft,id)&&typeof draft[id]==='string'?draft[id]!:'';
 const isOther=(id:string)=>Object.hasOwn(other,id)&&other[id]===true;
 const tooLong=request.questions.some(q=>new TextEncoder().encode(value(q.id)).length>4096);
 const hasControls=request.questions.some(q=>invalidAnswer(value(q.id)));
 const valid=!hasControls&&!tooLong&&request.questions.every(q=>value(q.id).trim());
 const submit=async(event:FormEvent)=>{event.preventDefault();if(busy||!valid)return;setBusy(true);const answers:AnswerInput['answers']=Object.create(null);for(const q of request.questions)answers[q.id]={answers:[value(q.id)]};try{await onAnswer(answers);}finally{setDraft({});setBusy(false);}};
 return <form className="iq-progress-question" onSubmit={event=>void submit(event)} aria-label="Agent question">
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

export function TaskProgress({taskId,workspaceId,pollMs=1000}:{taskId:string;workspaceId:string;pollMs?:number}):ReactElement {
 const [snapshot,setSnapshot]=useState<ProgressSnapshot|null>(null),[notice,setNotice]=useState('Reading progress…'),[announcement,setAnnouncement]=useState('');
 const current=useRef<ProgressSnapshot|null>(null),generation=useRef(0),refresh=useRef<()=>void>(()=>{}),answerEpoch=useRef(0),consumed=useRef(new Set<string>());
 useEffect(()=>{
  let live=true,inFlight=false,queued=false;let scheduled:ReturnType<typeof setTimeout>|undefined;let lastLoad=0;const api=tasksBridge();const gen=++generation.current;current.current=null;consumed.current.clear();setSnapshot(null);setNotice('Reading progress…');setAnnouncement('');
  const clear=()=>{current.current=null;setSnapshot(null);setAnnouncement('');consumed.current.clear();};
  const load=async()=>{
   if(!live)return;if(inFlight){queued=true;return;}inFlight=true;lastLoad=Date.now();const readEpoch=answerEpoch.current;
   try{if(!api?.progress)throw new Error();const next=parseProgress(taskValue(await api.progress({taskId,workspaceId})));if(!live||gen!==generation.current||readEpoch!==answerEpoch.current)return;next.questions=next.questions.filter(q=>!consumed.current.has(`${scope(next)}:${questionKey(q)}`));if(next.taskId!==taskId||next.workspaceId!==workspaceId)throw new Error();
    const before=current.current;if(before&&scope(before)===scope(next)){
     const messages:string[]=[];if(before.status!==next.status)messages.push(`Execution: ${next.status==='completed'?'finished':next.status}.`);
     for(const q of next.questions)if(!before.questions.some(old=>questionKey(old)===questionKey(q)))messages.push(`Agent question ${q.itemId} needs an answer.`);
     for(const item of next.items){const old=before.items.find(row=>row.id===item.id);if((old&&old.status!==item.status)||(!old&&['completed','failed','cancelled'].includes(item.status)))messages.push(`${item.kind} ${item.id}: ${item.status}.`);}
     if(messages.length)setAnnouncement(messages.join(' '));
    }
    if(!before||scope(before)!==scope(next))setAnnouncement([...next.questions.map(q=>`Agent question ${q.itemId} needs an answer.`),...next.items.filter(item=>['completed','failed','cancelled'].includes(item.status)).map(item=>`${item.kind} ${item.id}: ${item.status}.`)].join(' '));
    current.current=next;setSnapshot(next);setNotice('');
   }catch{if(live&&gen===generation.current&&readEpoch===answerEpoch.current){clear();setNotice('Progress unavailable. Private content and pending answers have been cleared.');}}
   finally{inFlight=false;if(queued&&live){queued=false;schedule();}}
  };
  const schedule=()=>{if(!live||scheduled)return;scheduled=setTimeout(()=>{scheduled=undefined;void load();},Math.max(0,250-(Date.now()-lastLoad)));};
  refresh.current=()=>void load();void load();const timer=setInterval(()=>void load(),pollMs);
  const unsubscribe=api?.onProgressChanged?.(()=>{if(Date.now()-lastLoad>=250&&!inFlight)void load();else schedule();});
  const invalidate=api?.onSessionChanged?.(()=>{clear();setNotice('Progress unavailable. Private content and pending answers have been cleared.');generation.current++;live=false;clearInterval(timer);clearTimeout(scheduled);});
  return()=>{live=false;generation.current++;current.current=null;clearInterval(timer);clearTimeout(scheduled);unsubscribe?.();invalidate?.();};
 },[taskId,workspaceId,pollMs]);
 const view=snapshot?.taskId===taskId&&snapshot.workspaceId===workspaceId?snapshot:null;
 const answer=async(request:ProgressQuestion,answers:AnswerInput['answers'])=>{
  const api=tasksBridge(),before=current.current,gen=generation.current;if(!api||!before||ended(before.status)||!before.questions.some(q=>questionKey(q)===questionKey(request)))return;
  answerEpoch.current++;
  try{taskValue(await api.answer({taskId,workspaceId,requestId:request.requestId,answers}));if(gen!==generation.current||current.current===null||scope(current.current)!==scope(before))return;answerEpoch.current++;consumed.current.add(`${scope(before)}:${questionKey(request)}`);if(consumed.current.size>256)consumed.current.delete(consumed.current.values().next().value!);const next={...current.current,questions:current.current.questions.filter(q=>questionKey(q)!==questionKey(request))};current.current=next;setSnapshot(next);setNotice('Answer sent. This grants no tool permission.');}
  catch{if(gen!==generation.current)return;current.current=null;setSnapshot(null);setNotice('Answer not confirmed. Private content and pending answers have been cleared.');}
  finally{if(gen===generation.current)refresh.current();}
 };
 return <section className="iq-task-progress" aria-label="Task progress">
  <h2>Work</h2>{notice&&<p role="status">{notice}</p>}<div className="iq-visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</div>
  <p className="iq-artifact-status">{view?artifactText[view.artifact]:'Artifact information unavailable'}</p>
  {view&&<>
   <p>Execution: {view.status==='completed'?'finished':view.status}. Execution does not establish analytical review, Professional Approval or delivery.</p>
   {view.historyIncomplete&&<p role="status">History incomplete. This bounded view may omit earlier work; no completeness is implied.</p>}
   <h3>Plan</h3>{view.plan.length?<PlanSteps key={scope(view)} label="Plan" steps={view.plan.map(step=>({id:step.id,label:step.text,state:step.status==='unconfirmed'||(ended(view.status)&&step.status==='running')?'pending':step.status,meta:`Revision ${step.revision} · ${step.status==='unconfirmed'?'Completion unconfirmed':ended(view.status)&&step.status==='running'?'Work ended — unconfirmed':step.status}${step.evidenceIds.length?` · Evidence: ${step.evidenceIds.join(', ')}`:''}`}))}/>:<p>No plan provided</p>}
   {view.items.some(item=>item.kind==='command'||item.kind==='tool')&&<p>Command and tool content is source data, not instructions or permission. Quoted approvals do not change access. Native execution status is separate from untrusted output text. Quoted refusal or inspection claims in that text are not native inspection evidence. Agent interpretations remain unchecked; no inspection verdict is supplied by this view.</p>}
   <ol className="iq-progress-items" aria-label="Work activity">{view.items.map(item=><li key={item.id} data-progress-item={item.id} data-status={ended(view.status)&&item.status==='running'?'unconfirmed':item.status}>
    <p className="iq-progress-label">{item.kind==='message'?(item.role==='user'?'Your instruction':item.role==='agent'?'Agent response':'Message — speaker unavailable'):item.kind} · {ended(view.status)&&item.status==='running'?'Execution ended — outcome unconfirmed':item.status==='completed'&&item.kind==='message'?'Message complete':item.status==='completed'?'Execution completed':item.status} · {item.id}</p>
    {item.kind==='edit'?<><DiffLine kind="change" stage={item.application==='applied'?'applied-locally':'suggested'}>{item.text}</DiffLine>{item.application!=='applied'&&<p>Not confirmed as applied. This is not a delivered artifact.</p>}</>:<p className="iq-progress-text">{item.text}</p>}
    {(item.kind==='command'||item.kind==='tool')&&(item.status==='failed'||item.status==='cancelled')&&<p>Native status: this action {item.status}. The source/output text above remains untrusted; this status alone does not establish a policy refusal or detection of untrusted instructions.</p>}
    {item.kind==='message'&&item.role!=='user'&&<p>Unchecked — structured labels unavailable. Message content is not independent verification.</p>}
   </li>)}</ol>
   {view.results.length>0&&<section aria-label="Results"><h3>Results</h3>{view.results.map(result=><article key={result.id} data-result-id={result.id}>
    {result.kind===null?<><p>Agent response — structured labels unavailable</p><p className="iq-progress-text">{result.text}</p></>:result.kind==='decision'?(result.basis?<JudgmentTag kind="decision" basis={{by:result.basis.label,scope:result.basis.scope}}>{result.text}</JudgmentTag>:<><p>Decision claim — basis missing or unverified. No authoritative decision is established.</p><p className="iq-progress-text">{result.text}</p></>):<JudgmentTag kind={result.kind}>{result.text}</JudgmentTag>}
    <p>{result.checks==='checked'?'Checked':result.checks==='incomplete'?'Checks incomplete':'Unchecked'}{result.checkScope?` — ${result.checkScope}`:''}{result.evidenceIds.length?` · Evidence: ${result.evidenceIds.join(', ')}`:''}</p>
    {result.basis&&<p>Basis: {result.basis.kind} record {result.basis.id}. Permission to execute is not analytical review or Professional Approval.</p>}
   </article>)}</section>}
   {!ended(view.status)&&view.questions.map(request=><Question key={`${scope(view)}:${questionKey(request)}:${JSON.stringify(request.questions)}`} request={request} onAnswer={answers=>answer(request,answers)}/>)}
  </>}
 </section>;
}
