/**
 * Attached material (Story 2.1), renderer side. Main opens the file and folder
 * dialogs, stages, verifies and decides every status; this module only
 * carries main's answers. Nothing here can mark a reference verified.
 *
 * User-facing strings that main also uses are duplicated here on purpose (the
 * renderer cannot import main-process modules); change them together with
 * `src/main/sources/service.ts`.
 */
import {useEffect,useRef,useState} from 'react';

/** Mirrors `SOURCES_DEFERRED_NOTICE` in `src/main/sources/service.ts`. */
export const SOURCES_DEFERRED_NOTICE='Attached files become available to your next message, once this first turn finishes. The request you just sent cannot use them.';
/** Why attaching waits while a turn runs; main refuses with `SOURCES_REASONS.busy` in `src/main/sources/service.ts` if asked anyway. */
export const SOURCES_RUNNING_REASON='Attach material after the current turn finishes.';

export interface ExcludedFile {relative:string;reason:string}
export interface AttachedFileView {id:string;name:string;relative:string;bytes:number;modifiedAt:string;sha256:string;format:string}
export interface AttachmentView {attachmentId:string;label:string;createdAt:string;files:AttachedFileView[];notSearched:ExcludedFile[];inaccessible:ExcludedFile[];incomplete:string[];bytes:number}
export interface CoverageView {filesAttached:number;filesRead:number;rows:{read:number;present:number;unknown:number}|null;unreadable:ExcludedFile[];notSearched:ExcludedFile[];inaccessible:ExcludedFile[];partlyRead:ExcludedFile[];incomplete:boolean;statement:string}
export interface ReferenceFile {name:string;relative:string;modifiedAt:string;sha256:string;bytes:number}
export interface ReferenceExtract {text:string;ocr:boolean;converted:boolean;originalSha256:string|null;wholeFile:boolean}
export interface MarkedReference {index:number;id:string;at:string;quote:string;format:string;location:string;status:'verified'|'unverified';reason:string|null;file:ReferenceFile|null;extract:ReferenceExtract|null;start:number;end:number;raw:string}
export interface CitationProblem {start:number;end:number;raw:string;reason:string}
export interface ComputedMarker {start:number;end:number;command:string;from:string}
export interface InferenceMarker {start:number;end:number}
export interface MessageReferences {itemId:string;state:'checked'|'waiting';references:MarkedReference[];problems:CitationProblem[];computed:ComputedMarker[];inferences:InferenceMarker[]}
export interface AttachedSummary {attachmentId:string;label:string;kind:'folder'|'files';files:number}
export interface SourcesView {available:boolean;reason:string|null;attachments:AttachedSummary[];coverage:CoverageView|null;deferred:{attachmentId:string;label:string}[];problem:string|null;note:string|null;messages:MessageReferences[]}
export type StageOutcome={state:'staged';attachment:AttachmentView;coverage:CoverageView;note:string}|{state:'deferred';label:string;notice:string};

/**
 * Attachments handed to a Task at its start, or seen waiting for its first
 * turn, in this window. When main reports them staged, the Task's composer
 * adds the visible note for the agent to the draft once.
 */
export const awaitingNote=new Set<string>();

interface SourcesBridge {attach(input:{kind:'files'|'folder'}):Promise<unknown>;discard(input:{attachmentId:string}):Promise<unknown>;stage(input:{taskId:string;workspaceId:string;attachmentId:string;firstTurn:boolean}):Promise<unknown>;view(input:{taskId:string;workspaceId:string}):Promise<unknown>;onChanged?(listener:(taskId:string|null)=>void):()=>void}
export const sourcesBridge=():SourcesBridge|null=>(globalThis as {inquello?:{sources?:SourcesBridge}}).inquello?.sources??null;

const bad=():never=>{throw new Error('Attached material information is unavailable.');};
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))return bad();return v as Record<string,unknown>;}
const text=(v:unknown):string=>typeof v==='string'?v:bad();
const list=<T,>(v:unknown,max:number,parse:(v:unknown)=>T):T[]=>{if(!Array.isArray(v)||v.length>max)return bad();return v.map(parse);};
const count=(v:unknown):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:bad();
const excluded=(v:unknown):ExcludedFile=>{const r=object(v);return{relative:text(r.relative),reason:text(r.reason)};};
/** A result from a sources operation: the value, or main's reason as the error message. */
export function sourcesValue(v:unknown):unknown {const r=object(v);if(r.ok!==true)throw new Error(typeof r.reason==='string'?r.reason:'Attached material information is unavailable.');return r.value;}
export function parseAttachment(v:unknown):AttachmentView {const r=object(v);return{attachmentId:text(r.attachmentId),label:text(r.label),createdAt:text(r.createdAt),files:list(r.files,5000,f=>{const x=object(f);return{id:text(x.id),name:text(x.name),relative:text(x.relative),bytes:count(x.bytes),modifiedAt:text(x.modifiedAt),sha256:text(x.sha256),format:text(x.format)};}),notSearched:list(r.notSearched,20000,excluded),inaccessible:list(r.inaccessible,20000,excluded),incomplete:list(r.incomplete,64,text),bytes:count(r.bytes)};}
function parseCoverage(v:unknown):CoverageView {const r=object(v);const rows=r.rows===null?null:(()=>{const x=object(r.rows);return{read:count(x.read),present:count(x.present),unknown:count(x.unknown)};})();if(typeof r.incomplete!=='boolean')return bad();return{filesAttached:count(r.filesAttached),filesRead:count(r.filesRead),rows,unreadable:list(r.unreadable,20000,excluded),notSearched:list(r.notSearched,20000,excluded),inaccessible:list(r.inaccessible,20000,excluded),partlyRead:list(r.partlyRead,20000,excluded),incomplete:r.incomplete,statement:text(r.statement)};}
function parseReference(v:unknown):MarkedReference {
 const r=object(v);if(r.status!=='verified'&&r.status!=='unverified')return bad();
 const file=r.file===null?null:(()=>{const x=object(r.file);return{name:text(x.name),relative:text(x.relative),modifiedAt:text(x.modifiedAt),sha256:text(x.sha256),bytes:count(x.bytes)};})();
 const extract=r.extract===null?null:(()=>{const x=object(r.extract);if(typeof x.ocr!=='boolean'||typeof x.converted!=='boolean'||typeof x.wholeFile!=='boolean')return bad();return{text:text(x.text),ocr:x.ocr,converted:x.converted,originalSha256:x.originalSha256===null?null:text(x.originalSha256),wholeFile:x.wholeFile};})();
 // Main's verdict stands; a "verified" reference without its file and extract is shown as unverified, never the other way round.
 const status=r.status==='verified'&&file&&extract?'verified':'unverified';
 return{index:count(r.index),id:text(r.id),at:text(r.at),quote:text(r.quote),format:text(r.format),location:text(r.location),status,reason:status==='verified'?null:r.reason===null?'Not verified':text(r.reason),file,extract:status==='verified'?extract:null,start:count(r.start),end:count(r.end),raw:text(r.raw)};
}
export function parseSourcesView(v:unknown):SourcesView {
 const r=object(v);if(typeof r.available!=='boolean')return bad();
 return{available:r.available,reason:r.reason===null?null:text(r.reason),
  attachments:list(r.attachments,256,a=>{const x=object(a);return{attachmentId:text(x.attachmentId),label:text(x.label),kind:x.kind==='folder'?'folder':'files',files:count(x.files)};}),
  coverage:r.coverage===null?null:parseCoverage(r.coverage),
  deferred:list(r.deferred,64,d=>{const x=object(d);return{attachmentId:text(x.attachmentId),label:text(x.label)};}),
  problem:r.problem===null?null:text(r.problem),note:r.note===null?null:text(r.note),
  messages:list(r.messages,64,m=>{const x=object(m);return{itemId:text(x.itemId),state:x.state==='waiting'?'waiting':'checked',references:list(x.references,500,parseReference),problems:list(x.problems,500,p=>{const y=object(p);return{start:count(y.start),end:count(y.end),raw:text(y.raw),reason:text(y.reason)};}),computed:list(x.computed,500,c=>{const y=object(c);return{start:count(y.start),end:count(y.end),command:text(y.command),from:text(y.from)};}),inferences:list(x.inferences,500,i=>{const y=object(i);return{start:count(y.start),end:count(y.end)};})};}),
 };
}
export function parseStageOutcome(v:unknown):StageOutcome {const r=object(v);if(r.state==='deferred')return{state:'deferred',label:text(r.label),notice:text(r.notice)};if(r.state!=='staged')return bad();return{state:'staged',attachment:parseAttachment(r.attachment),coverage:parseCoverage(r.coverage),note:text(r.note)};}

/**
 * The Task's attached material as main reports it. Read again whenever `key`
 * changes (the caller passes its run status and message identities) and
 * whenever main says the Task's material changed.
 */
export function useSourcesView(taskId:string,workspaceId:string,key:string,enabled=true):{view:SourcesView|null;notice:string|null} {
 const [state,setState]=useState<{scope:string;view:SourcesView|null;notice:string|null}>({scope:'',view:null,notice:null});
 const [changes,setChanges]=useState(0);
 const generation=useRef(0);
 const scope=`${workspaceId}:${taskId}`;
 useEffect(()=>{const api=sourcesBridge();return api?.onChanged?.(changed=>{if(changed===null||changed===taskId)setChanges(n=>n+1);});},[taskId]);
 useEffect(()=>{
  const api=sourcesBridge();if(!api||!enabled)return;
  const n=++generation.current;
  void (async()=>{try{const view=parseSourcesView(sourcesValue(await api.view({taskId,workspaceId})));if(n===generation.current)setState({scope,view,notice:null});}
   catch(error){if(n===generation.current)setState(old=>({scope,view:old.scope===scope?old.view:null,notice:error instanceof Error?error.message:'Attached material information is unavailable.'}));}})();
  return()=>{generation.current++;};
 },[scope,key,changes,enabled]);
 return state.scope===scope?{view:state.view,notice:state.notice}:{view:null,notice:null};
}

/** FileChip's type for a file name: the three known tags, otherwise the extension as the label. */
export function chipType(name:string):{type:'pdf'|'xls'|'doc'}|{type:string;typeLabel:string} {
 const dot=name.lastIndexOf('.'),ext=dot<0?'':name.slice(dot+1).toLowerCase();
 if(ext==='pdf')return{type:'pdf'};
 if(['xls','xlsx','xlsm','csv','tsv'].includes(ext))return{type:'xls'};
 if(['doc','docx','docm'].includes(ext))return{type:'doc'};
 return{type:'file',typeLabel:ext?ext.slice(0,4).toUpperCase():'File'};
}
