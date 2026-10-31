/** Bounded presentation contracts, not generated native protocol bindings. */
import {type TaskView} from './views';
export interface SearchInput {workspaceId:string;query:string;includeArchived:boolean;cursor:string|null}
export interface ReopenInput {workspaceId:string;taskId:string;query:string|null;turnId:string|null;itemId:string|null}
export interface NavigationInput {operationId:string;workspaceId:string;taskId:string;expectedRevision:number;pinned:boolean;archived:boolean}
export interface SearchItem {kind:'task'|'engagement'|'conversation';taskId:string|null;engagementId:string|null;title:string;snippet:string|null;turnId:string|null;itemId:string|null;archived:boolean}
export interface SearchView {workspaceId:string;query:string;items:SearchItem[];nextCursor:string|null;unavailable:boolean;coverage:string[]}
export interface SavedHit {turnId:string;itemId:string;text:string;truncated:boolean}
export interface ReopenView {task:TaskView;hit:SavedHit|null}
const object=(v:unknown):Record<string,unknown>=>{if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Saved work unavailable');return v as Record<string,unknown>;};
const text=(v:unknown,max=256):string=>{if(typeof v!=='string'||v.length>max)throw new Error('Saved work unavailable');return v;};
const nullable=(v:unknown,max=256)=>v===null?null:text(v,max);
const bool=(v:unknown):boolean=>{if(typeof v!=='boolean')throw new Error('Saved work unavailable');return v;};
export function searchView(value:unknown):SearchView {
 const r=object(value);if(!Array.isArray(r.items)||r.items.length>50||!Array.isArray(r.coverage)||r.coverage.length>16)throw new Error('Saved work unavailable');
 return{workspaceId:text(r.workspaceId),query:text(r.query),nextCursor:nullable(r.nextCursor,4096),unavailable:bool(r.unavailable),coverage:r.coverage.map(v=>text(v,1024)),items:r.items.map(v=>{
  const x=object(v);if(!['task','engagement','conversation'].includes(String(x.kind)))throw new Error('Saved work unavailable');
  const item:SearchItem={kind:x.kind as SearchItem['kind'],taskId:nullable(x.taskId),engagementId:nullable(x.engagementId),title:text(x.title,8192),snippet:nullable(x.snippet,2048),turnId:nullable(x.turnId),itemId:nullable(x.itemId),archived:bool(x.archived)};
  if(item.kind==='engagement'?!item.engagementId:!item.taskId)throw new Error('Saved work unavailable');
  if(item.kind==='conversation'&&(!item.turnId||!item.itemId||item.snippet===null))throw new Error('Saved work unavailable');return item;
 })};
}
/** Strict wire-to-view projection; malformed fields never become strings. */
export function savedTaskView(value:unknown):TaskView {
 const r=object(value);
 const id=(v:unknown)=>{const x=text(v,36);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x))throw new Error('Saved work unavailable');return x;};
 const optionalId=(v:unknown)=>v===null?null:id(v);
 const refs=(v:unknown)=>{if(!Array.isArray(v)||v.length>256)throw new Error('Saved work unavailable');return v.map(entry=>text(entry,1024));};
 if(r.visibility!=='private'||typeof r.revision!=='number'||!Number.isSafeInteger(r.revision)||r.revision<0)throw new Error('Saved work unavailable');
 const title=text(r.title,800);if(!title.trim()||[...title].length>200||/[\u0000-\u001f\u007f-\u009f]/.test(title))throw new Error('Saved work unavailable');
 const runtimeThreadId=nullable(r.runtimeThreadId,128);if(runtimeThreadId!==null&&(!runtimeThreadId||new TextEncoder().encode(runtimeThreadId).length>128||/[\u0000-\u001f\u007f-\u009f]/.test(runtimeThreadId)))throw new Error('Saved work unavailable');
 return {taskId:id(r.taskId),workspaceId:id(r.workspaceId),engagementId:optionalId(r.engagementId),folderId:optionalId(r.folderId),title,runtimeThreadId,sourceRefs:refs(r.sourceRefs),artifactRefs:refs(r.artifactRefs),visibility:'private',revision:r.revision,pinned:bool(r.pinned),archived:bool(r.archived)};
}
export function reopenView(value:unknown):ReopenView {
 const r=object(value),task=savedTaskView(r.task);let hit:SavedHit|null=null;
 if(r.hit!==null){const h=object(r.hit);hit={turnId:text(h.turnId),itemId:text(h.itemId),text:text(h.text,16384),truncated:bool(h.truncated)};if(!hit.turnId||!hit.itemId)throw new Error('Saved work unavailable');}return{task,hit};
}
