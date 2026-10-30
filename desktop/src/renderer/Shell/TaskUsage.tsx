import {useEffect,useRef,useState,type ReactElement} from 'react';
import {parseTaskUsage,type SetUsageInput,type TaskUsageView,type UsageChoices} from '../../main/usage/types';
import {Button} from '../primitives';
interface UsageBridge {forTask(input:{taskId:string}):Promise<unknown>;set(input:SetUsageInput):Promise<unknown>;onChanged?(listener:(privateScope:boolean)=>void):()=>void}
const bridge=():UsageBridge|null=>(globalThis as {inquello?:{usage?:UsageBridge}}).inquello?.usage??null;
const defaults=():UsageChoices=>({reasoning:'default',speed:'default'});
function result(value:unknown):TaskUsageView {if(!value||typeof value!=='object'||!('ok' in value)||value.ok!==true||!('value' in value))throw new Error();return parseTaskUsage(value.value);}
export function TaskUsage({taskId}:{taskId:string}):ReactElement {
 const [view,setView]=useState<TaskUsageView|null>(null),[draft,setDraft]=useState(defaults),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const generation=useRef(0),dirty=useRef(false),reload=useRef<()=>void>(()=>{}),operation=useRef<{id:string;command:string}|null>(null);
 useEffect(()=>{
  let live=true;const api=bridge();dirty.current=false;operation.current=null;setDraft(defaults());
  const load=async(privateScope=false)=>{const gen=++generation.current;if(privateScope)setView(null);setNotice(null);setBusy(false);setLoading(true);try{if(!api)throw new Error();const next=result(await api.forTask({taskId}));if(!live||gen!==generation.current)return;if(next.taskId!==taskId)throw new Error();setView(next);if(!dirty.current)setDraft(next.usage.settings?.choices??defaults());}catch{if(live&&gen===generation.current)setNotice('Usage information unavailable. Refresh to check this private Task.');}finally{if(live&&gen===generation.current)setLoading(false);}};
  reload.current=()=>{operation.current=null;void load();};void load(true);const unsubscribe=api?.onChanged?.((privateScope)=>{if(privateScope){dirty.current=false;operation.current=null;setDraft(defaults());}void load(privateScope);});
  return()=>{live=false;generation.current++;unsubscribe?.();};
 },[taskId]);
 const current=view?.taskId===taskId?view:null;
 const change=(key:keyof UsageChoices,value:string)=>{dirty.current=true;operation.current=null;setDraft(old=>({...old,[key]:value}));};
 const supported=!!current&&current.capabilities.available&&current.capabilities.reasoning.includes(draft.reasoning)&&current.capabilities.speeds.includes(draft.speed);
 const save=async()=>{
  const api=bridge();if(!api||!current||busy||loading||!supported)return;const gen=generation.current;setBusy(true);setNotice(null);const command={taskId,expectedRevision:current.usage.settings?.revision??0,routeRevision:current.capabilities.routeRevision,reasoning:draft.reasoning,speed:draft.speed};const key=JSON.stringify(command);if(operation.current?.command!==key)operation.current={id:crypto.randomUUID(),command:key};
  try{const raw=await api.set({...command,operationId:operation.current.id});if(gen!==generation.current)return;
   if(raw&&typeof raw==='object'&&'ok' in raw&&raw.ok===false){if('code' in raw&&raw.code==='conflict'){operation.current=null;setNotice('Task settings or route changed first. Your draft is preserved; refresh and explicitly save again.');return;}throw new Error();}
   const next=result(raw);if(next.taskId!==taskId)throw new Error();setView(next);dirty.current=false;operation.current=null;setNotice('Settings saved for future work. Previous attempts are unchanged.');
  }catch{if(gen===generation.current)setNotice('Settings were not confirmed. Refresh to inspect before trying again; your draft is preserved.');}finally{if(gen===generation.current)setBusy(false);}
 };
 const stale=current?.usage.settings&&current.usage.settings.route_revision!==current.capabilities.routeRevision;
 return <section className="iq-task-usage" aria-label="Task reasoning and usage" data-task-usage>
  <h2 className="iq-task-states-heading">Reasoning and usage</h2>
  <Button size="sm" onPress={()=>reload.current()} pending={loading} pendingText="Reading usage">Refresh usage</Button>
  {notice&&<p role="status">{notice}</p>}
  <p>Reasoning and speed are execution settings, not evidence quality or Professional Approval. Inspection starts no work.</p>
  {current&&<>
   <div className="iq-task-usage-choices">{(['reasoning','speed'] as const).map(key=>{const options=key==='reasoning'?current.capabilities.reasoning:current.capabilities.speeds;return <label key={key}>{key==='reasoning'?'Reasoning':'Speed'}<select aria-label={key==='reasoning'?'Reasoning':'Speed'} value={draft[key]} disabled={busy||!current.capabilities.available} onChange={e=>change(key,e.target.value)}>
    {!options.includes(draft[key])&&<option value={draft[key]} disabled>{draft[key]} — unavailable</option>}{options.map(option=><option key={option} value={option}>{option==='default'?'Provider default':option}</option>)}
   </select></label>;})}
   <Button size="sm" onPress={()=>void save()} disabledReason={!supported?'The selected route does not support these choices. Review the route and available settings.':undefined} pending={busy}>Save Task settings</Button></div>
   <p>{current.capabilities.reason}</p>
   {current.capabilities.reasoning.length===1&&current.capabilities.reasoning[0]==='default'&&current.capabilities.speeds.length===1&&current.capabilities.speeds[0]==='default'&&<p>This adapter exposes provider defaults only. Alternative reasoning and speed settings are unavailable.</p>}
   {!current.usage.settings&&<p>Defaults are not saved yet. Explicitly save Task settings before model work.</p>}
   {stale&&<p role="status">Settings belong to an older route revision. Review and explicitly save compatible choices; no fallback is selected.</p>}
   <h3>Inherited limits</h3><p>{current.limits.source}: {current.limits.status}. {current.limits.reason}</p><p>{current.limits.nextAction}</p>
   <p>Missing or stale information is not unlimited. Local tools are not blocked by unrelated model quotas. No automatic upgrade, fallback or reset-credit spending.</p>
   <h3>Attempt history</h3><p>Most recent 100 attempts. Unknown consumption is not zero. Reported amounts are not provider billing reconciliation.</p>
   {!current.usage.attempts.length&&<p>No recorded attempts for this Task.</p>}
   <ol className="iq-task-usage-history">{current.usage.attempts.map(a=><li key={a.snapshot.attempt_id} data-usage-attempt={a.snapshot.attempt_id}>
    <h4>{a.snapshot.operation_kind==='automated-permission-review'?'Automated permission review':a.snapshot.operation_kind==='local-tool'?'Local tool invocation':'Human-requested model work'} — {a.status==='running'?'Unfinished / outcome pending':a.status}</h4>
    <dl><dt>Attempt / run</dt><dd>{a.snapshot.attempt_id} / {a.snapshot.run_id}</dd>
    <dt>Started</dt><dd>{new Date(a.snapshot.started_at_ms).toLocaleString()}</dd>
    <dt>{a.snapshot.operation_kind==='local-tool'?'Task context: route / model / API':'Route / model / API'}</dt><dd>{a.snapshot.route_id??'Not applicable'} / {a.snapshot.model??'Not applicable'} / {a.snapshot.api_version??'Not applicable'}</dd>
    <dt>{a.snapshot.operation_kind==='local-tool'?'Task context: requested reasoning / speed':'Requested reasoning / speed'}</dt><dd>{a.snapshot.requested.reasoning} / {a.snapshot.requested.speed}</dd>
    <dt>Effective reasoning / speed</dt><dd>{a.snapshot.operation_kind==='local-tool'?'Not applicable — local tools do not use model settings':`${a.snapshot.effective.reasoning} / ${a.snapshot.effective.speed}`}</dd>
    <dt>Settings / route / configuration revision</dt><dd>{a.snapshot.settings_revision} / {a.snapshot.route_revision} / {a.snapshot.configuration_revision}</dd>
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
