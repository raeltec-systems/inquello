/** Explicit, private route selection. This UI never upgrades evidence or starts a turn. */
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Button, TextField } from './primitives';
import { parseRoutes, parseTaskRoute, record, type ConfigureRouteInput, type RouteView, type TaskRouteView } from '../main/routes/types';
interface Bridge { list():Promise<unknown>;configure(input:ConfigureRouteInput):Promise<unknown>;forTask(input:{taskId:string}):Promise<unknown>;select(input:unknown):Promise<unknown>;onChanged?(listener:()=>void):()=>void }
const bridge=():Bridge|null=>(globalThis as {inquello?:{routes?:Bridge}}).inquello?.routes??null;
const evidence:Record<RouteView['verification'],string>={not_verified:'Not verified',verified_for_synthetic:'Verified for synthetic',verified_for_real_data:'Verified for real data'};
function values(value:unknown):unknown { const r=record(value);if(r.ok!==true)throw new Error(typeof r.reason==='string'?r.reason:'Processing routes unavailable');return r.value; }
function RouteFacts({route}:{route:RouteView}):ReactElement {
  const c=route.configuration;
  return <><p>{evidence[route.verification]} — {route.enabled?'Enabled for synthetic data only':'Not enabled'}</p><p>{route.gate}</p>
    <dl className="specimen-policy-settings"><dt>Route ID</dt><dd>{route.routeId}</dd><dt>Provider</dt><dd>{route.provider}</dd><dt>Deployment / endpoint</dt><dd>{c?.deployment??'Not configured'} / {route.endpoint??'Not configured'}</dd><dt>Exact model / API version</dt><dd>{c?.model??'Not configured'} / {c?.apiVersion??'Not configured'}</dd><dt>Account reference (not a credential)</dt><dd>{c?.accountRef??'Not configured'}</dd><dt>Region</dt><dd>{c?.region??'Unknown'}</dd><dt>Credential</dt><dd>{route.credentialPresent?'Present — not evidence of eligibility':'Unavailable'}</dd><dt>Adapter support</dt><dd>{route.adapterSupported?'Implemented — evidence is separate':'Unavailable'}</dd></dl>
    <ul>{route.limits.map((limit,i)=><li key={i}>{limit}</li>)}</ul><p>Evidence: {route.evidence.join('; ')||'No passing evidence recorded'}</p>
    <p>Execution: {route.executionFlow}</p><p>Inference: {route.inferenceFlow}</p><p>Connectors: {route.connectorFlow}</p></>;
}
function Configure({route,disabled,save}:{route:RouteView;disabled:boolean;save:(v:ConfigureRouteInput)=>Promise<void>}):ReactElement {
  const claude=route.routeId==='claude-api-key';const [model,setModel]=useState(route.configuration?.model??(claude?'claude-sonnet-5-5':''));
  const [api,setApi]=useState(route.configuration?.apiVersion??(claude?'2026-10-21':''));const [deployment,setDeployment]=useState(route.configuration?.deployment??(claude?'anthropic-direct':'openai-api'));const [region,setRegion]=useState(route.configuration?.region??'');
  // A draft owns its loaded revision. Background refresh is not consent to overwrite it.
  const [draftRevision,setDraftRevision]=useState(route.revision);
  const changed=route.revision!==draftRevision;
  const reconcile=()=>{
    setModel(route.configuration?.model??(claude?'claude-sonnet-5-5':''));
    setApi(route.configuration?.apiVersion??(claude?'2026-10-21':''));
    setDeployment(route.configuration?.deployment??(claude?'anthropic-direct':'openai-api'));
    setRegion(route.configuration?.region??'');setDraftRevision(route.revision);op.current=null;
  };
  const op=useRef<{key:string;id:string}|null>(null);
  const submit=(e:FormEvent)=>{e.preventDefault();if(disabled||changed)return;const key=JSON.stringify([draftRevision,model,api,deployment,region]);if(op.current?.key!==key)op.current={key,id:crypto.randomUUID()};void save({operationId:op.current.id,expectedRevision:draftRevision,routeId:claude?'claude-api-key':'codex-responses',deployment,model,apiVersion:api,region:region.trim()||null});};
  return <form onSubmit={submit} aria-label={`Configure ${route.provider} route`}>
    {changed&&<><p role="status">This configuration changed since this draft was loaded. Your draft still belongs to revision {draftRevision}; reload the current configuration before saving.</p><Button onPress={reconcile} disabledReason={disabled?'Refresh route status first':undefined}>Reload current configuration and discard draft</Button></>}
    {!claude&&<label>Deployment<select aria-label="Codex deployment" value={deployment} onChange={e=>setDeployment(e.target.value)} disabled={disabled}><option value="openai-api">OpenAI API</option><option value="chatgpt-codex">ChatGPT Codex</option></select></label>}
    <TextField label="Exact model identifier" value={model} onChange={setModel} readOnly={claude} disabledReason={disabled?'Refresh route status before editing':undefined}/>
    <TextField label="Exact API version" value={api} onChange={setApi} readOnly={claude} disabledReason={disabled?'Refresh route status before editing':undefined}/>
    <TextField label="Region (leave blank when unknown)" value={region} onChange={setRegion} disabledReason={disabled?'Refresh route status before editing':undefined}/>
    <Button type="submit" disabledReason={disabled?'Refresh route status before saving':changed?'Reload current configuration before saving':!model||!api?'Supply exact model and API identifiers':undefined}>{`Save ${route.provider} route configuration`}</Button><p>Saving configuration does not verify a credential, enable a route or select it for a Task.</p>
  </form>;
}
export function ProcessingRoutes({taskId}:{taskId?:string}):ReactElement {
  const [rows,setRows]=useState<RouteView[]>([]),[task,setTask]=useState<TaskRouteView|null>(null),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false),[current,setCurrent]=useState(false);
  const generation=useRef(0),scope=useRef(taskId);scope.current=taskId;const reload=useRef<()=>void>(()=>{});
  useEffect(()=>{let live=true;const api=bridge();setRows([]);setTask(null);setCurrent(false);setBusy(false);setNotice(null);
    const load=async(invalidate=false)=>{const n=++generation.current;setCurrent(false);if(invalidate&&taskId){setTask(null);setRows([]);}if(!api){setTask(null);setRows([]);setNotice('Processing routes unavailable');return;}try{const catalog=values(await api.list());const next=parseRoutes({routes:catalog});const chosen=taskId?parseTaskRoute(values(await api.forTask({taskId}))):null;if(!live||n!==generation.current)return;if(chosen&&chosen.taskId!==taskId)throw new Error('Wrong Task route');setRows(next);setTask(chosen);setCurrent(true);setNotice(null);}catch(e){if(live&&n===generation.current){setTask(null);setRows([]);setNotice('Processing routes unavailable. Refresh to review the current route.');}}};
    reload.current=()=>{void load();};void load();const unsubscribe=api?.onChanged?.(()=>{void load(true);});const timer=setInterval(()=>void load(),30000);
    return()=>{live=false;generation.current++;clearInterval(timer);unsubscribe?.();};
  },[taskId]);
  const mutate=async(fn:(api:Bridge)=>Promise<unknown>)=>{const api=bridge(),selected=scope.current;if(!api||busy||!current)return;setBusy(true);setCurrent(false);try{values(await fn(api));if(scope.current===selected){setNotice(null);reload.current();}}catch(e){if(scope.current===selected)setNotice((e as Error).message);}finally{if(scope.current===selected)setBusy(false);}};
  return <section className="specimen-policy-workspace" aria-label="Processing routes" data-processing-routes>
    <h3>{taskId?'This Task’s processing route':'Processing routes'}</h3><p>Automated permission review requires verified route evidence and a trusted Task data tier. Unknown data tier uses permitted human handling.</p><p>No implicit default or provider fallback. Failures stay on the selected route. Real-data use is not enabled.</p>
    <Button onPress={()=>reload.current()} pending={busy}>Refresh processing routes</Button>{!current&&<p>Route status is stale or unavailable; refresh before changing it.</p>}{notice&&<p role="status">{notice}</p>}
    {taskId&&<><p>{!current?'Inference information unavailable':task?.staleConfiguration?'Inference information stale — refresh and review the processing route':task?.selected?`Selected: ${task.selected.provider} (${task.selected.routeId})`:'No processing route explicitly selected'}</p>{task?.staleConfiguration&&<p>Configuration changed. Explicitly select the current candidate again.</p>}{current&&!task?.staleConfiguration&&task?.selected&&<RouteFacts route={task.selected}/>}<p>Switching cancels the old local attempt and clears continuation authority. This does not guarantee remote rollback or reversed billing.</p></>}
    {rows.map(route=><article key={route.routeId} data-processing-route={route.routeId}><h4>{route.provider} — {route.routeId}</h4><RouteFacts route={route}/>
      {taskId?route.configurable&&<Button disabledReason={busy||!current?'Refresh current route status first':!route.configuration?'Configure this route in Settings first':!task?'Task route unavailable':undefined} onPress={()=>void mutate(api=>api.select({operationId:crypto.randomUUID(),expectedRevision:task!.revision,taskId,routeId:route.routeId,configurationRevision:route.revision}))}>{`Select ${route.provider} route for this Task`}</Button>:route.configurable&&<Configure route={route} disabled={busy||!current} save={async input=>mutate(api=>api.configure(input))}/>}
      {!route.configurable&&<p>{route.gate??route.limits.join('; ')}</p>}
    </article>)}
  </section>;
}
