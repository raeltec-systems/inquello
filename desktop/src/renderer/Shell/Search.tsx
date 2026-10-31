/** S05: inert saved-text search with exact fresh activation, never Resume. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Button,TextField} from '../primitives';
import {searchView,reopenView,type SearchView,type SearchItem,type ReopenView} from '../../main/organise/navigation';
import {organiseBridge,parseOutcome,parseTree,type EngagementItem} from './organise-bridge';
import {taskValue,tasksBridge} from './tasks-bridge';
export function SavedWorkDialog({label,onClose,children}:{label:string;onClose:()=>void;children:React.ReactNode}):ReactElement {
 const ref=useRef<HTMLDialogElement>(null),opener=useRef(document.activeElement as HTMLElement|null),composing=useRef(false);
 useEffect(()=>{
  const dialog=ref.current!;dialog.showModal();dialog.querySelector<HTMLElement>('input,button')?.focus();
  return()=>{dialog.close();if(opener.current?.isConnected)opener.current.focus();};
 },[]);
 return <dialog ref={ref} aria-label={label} aria-modal="true" className="iq-saved-dialog"
  onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
  onCancel={e=>{e.preventDefault();if(!composing.current)onClose();}}
  onKeyDown={e=>{
   // Native modal ownership makes the rest of the document inert. Do not let
   // document shortcuts navigate behind it, including during IME composition.
   e.stopPropagation();
   if(e.key==='Escape'&&!e.nativeEvent.isComposing&&!composing.current){e.preventDefault();onClose();}
   if(e.key==='Tab'){const list=[...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')??[])];const first=list[0],last=list.at(-1);if(first&&last){if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
  }}><h2>{label}</h2>{children}<Button onPress={onClose}>{`Close ${label}`}</Button></dialog>;
}
/** UTF-8 bytes, not JavaScript characters; retain invalid input for correction. */
export function searchQueryError(query:string):string|null {
 if(/[\u0000-\u001f\u007f-\u009f]/.test(query))return 'Search cannot contain control characters. Remove them to continue.';
 if(new TextEncoder().encode(query.trim()).byteLength>256)return 'Search is limited to 256 UTF-8 bytes. Shorten the search term to continue.';
 return null;
}
export function Search({workspaceId,onClose,onOpen,onEngagement}:{workspaceId:string|null;onClose:()=>void;onOpen:(value:ReopenView)=>void;onEngagement:(value:EngagementItem)=>void}):ReactElement {
 const [query,setQuery]=useState(''),[archived,setArchived]=useState(false),[view,setView]=useState<SearchView|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const generation=useRef(0),live=useRef(true),resultHeading=useRef<HTMLParagraphElement>(null),focusResults=useRef(false);
 const [retry,setRetry]=useState<{cursor:string;page:number}|null>(null),[pageNumber,setPageNumber]=useState(1);
 useEffect(()=>{if(view&&focusResults.current){focusResults.current=false;resultHeading.current?.focus();}},[view]);
 const queryError=searchQueryError(query);
 useEffect(()=>{live.current=true;const clear=()=>{generation.current++;setRetry(null);setView(null);setBusy(false);setNotice('Access changed. Search again to check current saved work.');};const unsubscribe=tasksBridge()?.onSessionChanged?.(clear);const usage=(globalThis as {inquello?:{usage?:{onChanged?:(fn:(privateScope:boolean)=>void)=>()=>void}}}).inquello?.usage?.onChanged?.(privateScope=>{if(privateScope)clear();});return()=>{live.current=false;generation.current++;unsubscribe?.();usage?.();};},[]);
 useEffect(()=>{generation.current++;setRetry(null);setView(null);setNotice('');setBusy(false);},[workspaceId]);
 const change=(value:string)=>{generation.current++;setRetry(null);setQuery(value);setView(null);setBusy(false);setNotice('');};
 const search=async(cursor:string|null=null,page=1)=>{
  const api=organiseBridge(),n=++generation.current;setRetry(null);setView(null);setNotice('');if(!workspaceId||!query.trim()||queryError)return;setBusy(true);
  try{if(!api?.search)throw new Error();const next=searchView(taskValue(await api.search({workspaceId,query:query.trim(),includeArchived:archived,cursor})));if(!live.current||n!==generation.current)return;if(next.workspaceId!==workspaceId||next.query!==query.trim())throw new Error();setPageNumber(page);focusResults.current=cursor!==null;setView(next);}
  catch{if(live.current&&n===generation.current){if(cursor!==null)setRetry({cursor,page});setNotice(cursor!==null?'Search page is unavailable. Retry this page, or Search again if saved work changed.':'Search is unavailable. Your search term is kept; try again.');}}
  finally{if(live.current&&n===generation.current)setBusy(false);}
 };
 const open=async(item:SearchItem)=>{
  const api=organiseBridge(),n=++generation.current;if(!api||!workspaceId)return;setView(null);setBusy(true);setNotice('Checking current access…');
  try{
   if(item.kind==='engagement'){const result=parseOutcome(await api.getTree({workspaceId}),parseTree);if(!result.ok)throw new Error();const engagement=result.value.engagements.find(row=>row.engagementId===item.engagementId);if(!engagement)throw new Error();if(live.current&&n===generation.current){onEngagement(engagement);onClose();}}
   else{if(!api.reopen||!item.taskId)throw new Error();const next=reopenView(taskValue(await api.reopen({workspaceId,taskId:item.taskId,query:item.kind==='conversation'?query.trim():null,turnId:item.turnId,itemId:item.itemId})));if(next.task.taskId!==item.taskId||next.task.workspaceId!==workspaceId||item.kind==='conversation'&&(next.hit?.itemId!==item.itemId||next.hit.turnId!==item.turnId))throw new Error();if(live.current&&n===generation.current){onOpen(next);onClose();}}
  }catch{if(live.current&&n===generation.current)setNotice('Saved work is no longer available. No cached snippet was opened. Search again to check current access.');}
  finally{if(live.current&&n===generation.current)setBusy(false);}
 };
 return <SavedWorkDialog label="Search saved work" onClose={onClose}>
  <form onSubmit={e=>{e.preventDefault();void search();}} onKeyDown={e=>{if(e.key==='Enter'&&e.nativeEvent.isComposing)e.preventDefault();}}>
   <TextField type="search" label="Search this Workspace" value={query} onChange={change} instruction="Task titles, retained user and assistant messages, and accessible Engagement details."/>
   <label><input type="checkbox" checked={archived} onChange={e=>{generation.current++;setRetry(null);setArchived(e.target.checked);setView(null);setBusy(false);}}/>Include archived Tasks</label>
   <Button type="submit" pending={busy} disabledReason={!workspaceId?'No Workspace is selected.':!query.trim()?'Enter a search term.':queryError??undefined}>Search</Button>
  </form>
  {queryError&&<p role="alert">{queryError}</p>}
  {!workspaceId&&<p>No Workspace is available or selected. Choose an accessible Workspace first.</p>}
  <p>Files, artifacts, reasoning, tool output, plans and system instructions are not searched.</p>
  {notice&&<p role="status">{notice}</p>}
  {retry&&<Button onPress={()=>void search(retry.cursor,retry.page)}>Retry this page</Button>}
  {view&&<><p ref={resultHeading} tabIndex={-1} role="status" aria-live="polite">Page {pageNumber} · {view.items.length} matches on this page.</p>{view.unavailable&&<p role="status">Some saved content is unavailable or outside this bounded search. This is not a complete search of that content.</p>}{view.coverage.map((line,i)=><p key={i}>{line}</p>)}
   {!view.items.length&&<p role="status">{view.unavailable?'No matches in the content that could be searched.':'No matches in the searched content.'}</p>}
   <ul className="iq-saved-results">{view.items.map((item,i)=><li key={`${item.taskId??item.engagementId}:${item.itemId??i}`}><Button variant="ghost" onPress={()=>void open(item)}>{`${item.title}${item.archived?' · Archived':''}`}</Button><p>{item.kind==='conversation'?'Saved conversation message':item.kind==='engagement'?'Engagement':'Private Task'}</p>{item.snippet!==null&&<p className="iq-progress-text">{item.snippet}</p>}</li>)}</ul>
   {view.nextCursor&&<Button onPress={()=>void search(view.nextCursor,pageNumber+1)}>Next matches</Button>}
  </>}
 </SavedWorkDialog>;
}
