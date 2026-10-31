/** Inbox categories are evidence, not an execution or approval state. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Badge,Button} from '../primitives';
import {SavedWorkDialog} from './Search';
import {tasksBridge,taskValue,parseProgress} from './tasks-bridge';
import type {TaskItem} from './organise-bridge';
export interface InputRequest {taskId:string;workspaceId:string;requestId:string|number;turnId:string;itemId:string;question:string}
export type QuestionSelection=Pick<InputRequest,'requestId'|'turnId'|'itemId'>&{visit:number};
export interface AttentionView {workspaceId:string;items:InputRequest[];unavailable:boolean}
export function parseAttention(value:unknown):AttentionView {
 if(!value||typeof value!=='object')throw new Error();const r=value as AttentionView;
 if(typeof r.workspaceId!=='string'||typeof r.unavailable!=='boolean'||!Array.isArray(r.items)||r.items.length>16)throw new Error();
 for(const q of r.items){for(const key of ['taskId','workspaceId','turnId','itemId','question'] as const)if(typeof q[key]!=='string'||q[key].length>512)throw new Error();if(q.workspaceId!==r.workspaceId||!(typeof q.requestId==='string'||typeof q.requestId==='number'&&Number.isSafeInteger(q.requestId)))throw new Error();}
 return{workspaceId:r.workspaceId,unavailable:r.unavailable,items:r.items.map(q=>({taskId:q.taskId,workspaceId:q.workspaceId,requestId:q.requestId,turnId:q.turnId,itemId:q.itemId,question:q.question}))};
}
/** Later categories are read-model-only: never manufactured as production items. */
export function attentionCounts(input:{input:readonly unknown[];review:readonly unknown[];delivery:readonly unknown[]}) {return{input:input.input.length,review:input.review.length,delivery:input.delivery.length};}
export function useInbox(workspaceId:string|null,enabled:boolean):AttentionView|null {
 const [view,setView]=useState<AttentionView|null>(null);
 useEffect(()=>{let live=true,generation=0,busy=false;setView(null);const api=tasksBridge();if(!enabled||!workspaceId||!api?.inbox)return;
  const load=async()=>{if(busy)return;busy=true;const n=++generation;try{const next=parseAttention(taskValue(await api.inbox!({workspaceId})));if(next.workspaceId!==workspaceId)throw new Error();if(live&&n===generation)setView(next);}catch{if(live&&n===generation)setView(null);}finally{busy=false;}};
  const invalidate=()=>{generation++;setView(null);void load();};void load();const timer=setInterval(()=>void load(),1500);const off=api.onProgressChanged?.(invalidate),session=api.onSessionChanged?.(invalidate);const usage=(globalThis as {inquello?:{usage?:{onChanged?:(fn:(privateScope:boolean)=>void)=>()=>void}}}).inquello?.usage?.onChanged?.(privateScope=>{if(privateScope)invalidate();});return()=>{live=false;generation++;clearInterval(timer);off?.();session?.();usage?.();};
 },[workspaceId,enabled]);return view?.workspaceId===workspaceId?view:null;
}
export function Inbox({view,tasks,onClose,onOpen}:{view:AttentionView|null;tasks:TaskItem[];onClose:()=>void;onOpen:(task:TaskItem,request:InputRequest)=>void}):ReactElement {
 const [notice,setNotice]=useState(''),[busy,setBusy]=useState(false),generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const questionScope=JSON.stringify(view?[view.workspaceId,view.unavailable,view.items.map(q=>[q.taskId,q.requestId,q.turnId,q.itemId,q.question])]:null);
 useEffect(()=>{generation.current++;setNotice('');setBusy(false);},[questionScope]);
 const open=async(q:InputRequest)=>{const api=tasksBridge(),n=++generation.current;setBusy(true);try{if(!api)throw new Error();const next=parseProgress(taskValue(await api.progress({taskId:q.taskId,workspaceId:q.workspaceId})));const task=tasks.find(t=>t.taskId===q.taskId&&t.workspaceId===q.workspaceId);if(!task||next.taskId!==q.taskId||next.workspaceId!==q.workspaceId||!next.questions.some(row=>row.requestId===q.requestId&&row.turnId===q.turnId&&row.itemId===q.itemId))throw new Error();if(n===generation.current){onOpen(task,q);onClose();}}catch{if(n===generation.current)setNotice('This question is no longer available. The Inbox will refresh; no work was started.');}finally{if(n===generation.current)setBusy(false);}};
 return <SavedWorkDialog label="Inbox" onClose={onClose}>
  <h3>Requests for input {view&&!view.unavailable&&<Badge count={view.items.length} label="requests for input"/>}</h3>
  {(!view||view.unavailable)&&<p role="status">Current attention is unavailable or incomplete, not zero.</p>}
  {view&&!view.unavailable&&!view.items.length&&<p>No current requests for input.</p>}
  {notice&&<p role="status">{notice}</p>}
  <ul className="iq-saved-results">{view?.items.map(q=><li key={JSON.stringify([q.taskId,q.requestId,q.itemId])}><Button variant="ghost" disabledReason={busy?'Checking current question.':undefined} onPress={()=>void open(q)}>{`${tasks.find(t=>t.taskId===q.taskId)?.title??'Private Task'} · ${q.question}`}</Button></li>)}</ul>
  <p>Includes archived Tasks. Opening a question does not answer it or resume work. Review and Delivery workflows are not enabled.</p>
 </SavedWorkDialog>;
}
