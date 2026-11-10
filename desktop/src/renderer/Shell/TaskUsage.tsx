import {modelAuthorityApplies,type ModelAuthorityChange} from './model-authority';
/**
 * Story 1.24 surfaces, placed as the Codex desktop places them:
 * - `part="settings"`: the conversation's reasoning and speed, opened from the
 *   composer footer beside the model (`TaskReasoningControl`). Saving is explicit.
 * - `part="history"`: attributable usage and inherited limits, in Settings > Usage.
 * Both read the same bounded, creator-private projection. Inspection starts no work.
 */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {parseTaskUsage,type SetUsageInput,type TaskUsageView,type UsageAttempt,type UsageChoices} from '../../main/usage/types';
import {Button} from '../primitives';
import {SavedWorkDialog} from './Search';
interface UsageBridge {forTask(input:{taskId:string}):Promise<unknown>;set(input:SetUsageInput):Promise<unknown>;onChanged?(listener:(privateScope:boolean)=>void):()=>void}
const bridge=():UsageBridge|null=>(globalThis as {inquello?:{usage?:UsageBridge}}).inquello?.usage??null;
const routesBridge=()=>(globalThis as {inquello?:{routes?:{onChanged?(fn:(change?:ModelAuthorityChange)=>void):()=>void}}}).inquello?.routes;
const defaults=():UsageChoices=>({reasoning:'default',speed:'default'});
function result(value:unknown):TaskUsageView {if(!value||typeof value!=='object'||!('ok' in value)||value.ok!==true||!('value' in value))throw new Error();return parseTaskUsage(value.value);}

/** "Codex plan/Workspace: exhausted. …" — the limit's own source, status and reason; nothing invented. */
export function limitSummary(limits:TaskUsageView['limits']):string {
 const source=limits.source==='claude-api-key'?'Anthropic account usage':limits.source==='codex-responses'?'OpenAI account usage':limits.source;
 return `${source}: ${limits.status}. ${limits.reason}`;
}
export function attemptKind(attempt:UsageAttempt):string {
 return attempt.snapshot.operation_kind==='automated-permission-review'?'Automated permission review':attempt.snapshot.operation_kind==='local-tool'?'Local tool invocation':'Human-requested model work';
}

export function TaskUsage({taskId,part}:{taskId:string;part:'settings'|'history'}):ReactElement {
 const [view,setView]=useState<TaskUsageView|null>(null),[draft,setDraft]=useState(defaults),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const generation=useRef(0),dirty=useRef(false),reload=useRef<()=>void>(()=>{}),operation=useRef<{id:string;command:string}|null>(null);
 useEffect(()=>{
  let live=true;const api=bridge();dirty.current=false;operation.current=null;setDraft(defaults());
  const load=async(privateScope=false)=>{const gen=++generation.current;if(privateScope)setView(null);setNotice(null);setBusy(false);setLoading(true);try{if(!api)throw new Error();const next=result(await api.forTask({taskId}));if(!live||gen!==generation.current)return;if(next.taskId!==taskId)throw new Error();setView(next);if(!dirty.current)setDraft(next.usage.settings?.choices??defaults());}catch{if(live&&gen===generation.current)setNotice('Usage information unavailable. Refresh to check this private Task.');}finally{if(live&&gen===generation.current)setLoading(false);}};
  reload.current=()=>{operation.current=null;void load();};void load(true);const unsubscribe=api?.onChanged?.((privateScope)=>{if(privateScope){dirty.current=false;operation.current=null;setDraft(defaults());}void load(privateScope);});
  const routeChanged=routesBridge()?.onChanged?.(change=>{if(!modelAuthorityApplies(change,taskId))return;operation.current=null;void load(true);});
  return()=>{live=false;generation.current++;unsubscribe?.();routeChanged?.();};
 },[taskId]);
 const current=view?.taskId===taskId?view:null;
 const change=(key:keyof UsageChoices,value:string)=>{dirty.current=true;operation.current=null;setDraft(old=>({...old,[key]:value}));};
 const supported=!!current&&current.capabilities.available&&current.capabilities.reasoning.includes(draft.reasoning)&&current.capabilities.speeds.includes(draft.speed);
 const save=async()=>{
  const api=bridge();if(!api||!current||busy||loading||!supported)return;const gen=generation.current;setBusy(true);setNotice(null);const command={taskId,expectedRevision:current.usage.settings?.revision??0,routeRevision:current.capabilities.routeRevision,reasoning:draft.reasoning,speed:draft.speed};const key=JSON.stringify(command);if(operation.current?.command!==key)operation.current={id:crypto.randomUUID(),command:key};
  try{const raw=await api.set({...command,operationId:operation.current.id});if(gen!==generation.current)return;
   if(raw&&typeof raw==='object'&&'ok' in raw&&raw.ok===false){if('code' in raw&&raw.code==='conflict'){operation.current=null;setNotice('Task settings or model changed first. Your draft is preserved; refresh and explicitly save again.');return;}throw new Error();}
   const next=result(raw);if(next.taskId!==taskId)throw new Error();setView(next);dirty.current=false;operation.current=null;setNotice('Settings saved for future work. Previous attempts are unchanged.');
  }catch{if(gen===generation.current)setNotice('Settings were not confirmed. Refresh to inspect before trying again; your draft is preserved.');}finally{if(gen===generation.current)setBusy(false);}
 };
 const stale=current?.usage.settings&&current.usage.settings.route_revision!==current.capabilities.routeRevision;
 if(part==='settings')return <section className="iq-task-usage iq-task-reasoning" aria-label="Reasoning and speed" data-task-reasoning>
  <Button size="sm" onPress={()=>reload.current()} pending={loading} pendingText="Reading settings">Refresh settings</Button>
  {notice&&<p role="status">{notice}</p>}
  <p>Reasoning and speed are execution settings, not evidence quality or Professional Approval. Inspection starts no work.</p>
  {current&&<>
   <div className="iq-task-usage-choices">{(['reasoning','speed'] as const).map(key=>{const options=key==='reasoning'?current.capabilities.reasoning:current.capabilities.speeds;return <label key={key}>{key==='reasoning'?'Reasoning':'Speed'}<select aria-label={key==='reasoning'?'Reasoning':'Speed'} value={draft[key]} disabled={busy||!current.capabilities.available} onChange={e=>change(key,e.target.value)}>
    {!options.includes(draft[key])&&<option value={draft[key]} disabled>{draft[key]} — unavailable</option>}{options.map(option=><option key={option} value={option}>{option==='default'?'Provider default':option}</option>)}
   </select></label>;})}
   <Button size="sm" onPress={()=>void save()} disabledReason={!supported?'This model does not support these choices. Review the available settings.':undefined} pending={busy}>Save Task settings</Button></div>
   <p>{current.capabilities.reason}</p>
   {current.capabilities.reasoning.length===1&&current.capabilities.reasoning[0]==='default'&&current.capabilities.speeds.length===1&&current.capabilities.speeds[0]==='default'&&<p>This adapter exposes provider defaults only. Alternative reasoning and speed settings are unavailable.</p>}
   {!current.usage.settings&&<p>Defaults are not saved yet. Explicitly save Task settings before model work.</p>}
   {stale&&<p role="status">Settings belong to an earlier conversation model choice. Review and explicitly save compatible choices.</p>}
   <p>Settings affect future work only. Usage and limits are in <a href="#settings-usage">Settings › Usage</a>.</p>
  </>}
 </section>;
 return <section className="iq-task-usage" aria-label="Usage and limits" data-task-usage>
  <Button size="sm" onPress={()=>reload.current()} pending={loading} pendingText="Reading usage">Refresh usage</Button>
  {notice&&<p role="status">{notice}</p>}
  <p>Inspection starts no work. Reasoning and speed are chosen beside the model in the conversation’s message box.</p>
  {current&&<>
   <h3>Inherited limits</h3><p>{limitSummary(current.limits)}</p><p>{current.limits.nextAction}</p>
   <p>Missing or stale information is not unlimited. Local tools are not blocked by unrelated model quotas. No automatic upgrade, fallback or reset-credit spending.</p>
   <h3>Attempt history</h3><p>Most recent 100 attempts. Unknown consumption is not zero. Reported amounts are not provider billing reconciliation.</p>
   {!current.usage.attempts.length&&<p>No recorded attempts for this Task.</p>}
   <ol className="iq-task-usage-history">{current.usage.attempts.map(a=><li key={a.snapshot.attempt_id} data-usage-attempt={a.snapshot.attempt_id}>
    <h4>{attemptKind(a)} — {a.status==='running'?'Unfinished / outcome pending':a.status}</h4>
    <dl><dt>Attempt / run</dt><dd>{a.snapshot.attempt_id} / {a.snapshot.run_id}</dd>
    <dt>Started</dt><dd>{new Date(a.snapshot.started_at_ms).toLocaleString()}</dd>
    <dt>{a.snapshot.operation_kind==='local-tool'?'Conversation model':'Model'}</dt><dd>{a.snapshot.model??'Not applicable'}</dd>
    <dt>{a.snapshot.operation_kind==='local-tool'?'Task context: requested reasoning / speed':'Requested reasoning / speed'}</dt><dd>{a.snapshot.requested.reasoning} / {a.snapshot.requested.speed}</dd>
    <dt>Effective reasoning / speed</dt><dd>{a.snapshot.operation_kind==='local-tool'?'Not applicable — local tools do not use model settings':`${a.snapshot.effective.reasoning} / ${a.snapshot.effective.speed}`}</dd>
    <dt>Elapsed</dt><dd>{a.elapsed_ms===null?'Unknown':`${a.elapsed_ms} ms`}</dd>
    <dt>Input / output tokens</dt><dd>{a.usage.input_tokens??'Unknown'} / {a.usage.output_tokens??'Unknown'}</dd>
    <dt>Cache read / write tokens</dt><dd>{a.usage.cache_read_tokens??'Unknown'} / {a.usage.cache_write_tokens??'Unknown'}</dd>
    <dt>Reported cost</dt><dd>{a.usage.cost===null?'Unknown':`${a.usage.cost} ${a.usage.currency} (${a.usage.provenance})`}</dd>
    <dt>Output reference</dt><dd>{a.output_ref??'None recorded'}</dd></dl>
    {a.status==='uncertain'&&<p>Outcome or final usage is uncertain. Do not automatically repeat this work.</p>}
   </li>)}</ol>
  </>}
 </section>;
}

/**
 * The same bounded read for compact surfaces (the composer's reasoning label and
 * the conversation's limit notice). Private-scope changes clear the facts first;
 * a late answer for an older Task, identity or route is discarded.
 */
export function useTaskUsageView(taskId:string):{view:TaskUsageView|null;unavailable:boolean} {
 const [state,setState]=useState<{taskId:string;view:TaskUsageView|null;unavailable:boolean}>({taskId,view:null,unavailable:false});
 const generation=useRef(0);
 useEffect(()=>{
  let live=true;const api=bridge();setState({taskId,view:null,unavailable:false});
  const load=async(privateScope=false)=>{const gen=++generation.current;if(privateScope)setState({taskId,view:null,unavailable:false});try{if(!api)throw new Error();const next=result(await api.forTask({taskId}));if(!live||gen!==generation.current)return;if(next.taskId!==taskId)throw new Error();setState({taskId,view:next,unavailable:false});}catch{if(live&&gen===generation.current)setState({taskId,view:null,unavailable:true});}};
  void load(true);
  const unsubscribe=api?.onChanged?.(privateScope=>void load(privateScope));
  const routeChanged=routesBridge()?.onChanged?.(change=>{if(modelAuthorityApplies(change,taskId))void load(true);});
  return()=>{live=false;generation.current++;unsubscribe?.();routeChanged?.();};
 },[taskId]);
 return state.taskId===taskId?{view:state.view,unavailable:state.unavailable}:{view:null,unavailable:false};
}

/** The composer-footer label for this conversation's saved reasoning and speed. */
export function reasoningLabel(view:TaskUsageView|null):{text:string;state:'saved'|'unsaved'|'stale'|'unknown'} {
 if(!view)return{text:'Reasoning',state:'unknown'};
 const settings=view.usage.settings;
 if(!settings)return{text:'Reasoning not saved',state:'unsaved'};
 if(settings.route_revision!==view.capabilities.routeRevision)return{text:'Reasoning: review',state:'stale'};
 const name=(value:string)=>value==='default'?'Default':value;
 return{text:`Reasoning: ${name(settings.choices.reasoning)}${settings.choices.speed==='default'?'':` · ${name(settings.choices.speed)}`}`,state:'saved'};
}

/** Composer footer control: shows the saved reasoning; opens the explicit settings. */
export function TaskReasoningControl({taskId}:{taskId:string}):ReactElement {
 const {view}=useTaskUsageView(taskId),[open,setOpen]=useState(false);
 const label=reasoningLabel(view);
 useEffect(()=>{setOpen(false);},[taskId]);
 return <>
  <Button size="sm" variant="quiet" onPress={()=>setOpen(true)} data-conversation-reasoning data-reasoning-state={label.state} aria-haspopup="dialog">{label.text}</Button>
  {open&&<SavedWorkDialog label="Reasoning and speed" onClose={()=>setOpen(false)}><TaskUsage taskId={taskId} part="settings"/></SavedWorkDialog>}
 </>;
}

/**
 * Inline, at the end of the conversation where the work stopped: each attempt an
 * inherited limit refused, with the limit's own source, status, reason and next
 * action. Nothing is retried automatically; no numbers are invented.
 */
export function UsageLimitNotices({taskId}:{taskId:string}):ReactElement|null {
 const {view}=useTaskUsageView(taskId);
 if(!view)return null;
 const refused=view.usage.attempts.filter(a=>a.status==='refused').sort((a,b)=>a.snapshot.started_at_ms-b.snapshot.started_at_ms).slice(-3);
 if(!refused.length)return null;
 return <>{refused.map(a=><section key={a.snapshot.attempt_id} className="iq-usage-limit-notice" role="note" aria-label="Usage limit" data-usage-limit-notice data-usage-attempt={a.snapshot.attempt_id}>
  <p className="iq-usage-limit-title"><strong>{attemptKind(a)} — refused at the usage-limit check</strong></p>
  <p>Current limit: {limitSummary(view.limits)}</p>
  <p>{view.limits.nextAction}</p>
  <p>Refused attempt {a.snapshot.attempt_id} · started {new Date(a.snapshot.started_at_ms).toLocaleString()} · model {a.snapshot.model??'Unknown'}. Nothing is retried automatically, and no fallback or reset credit is used.</p>
  <p><a href="#settings-usage">Usage and limits</a></p>
 </section>)}</>;
}
