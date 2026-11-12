import {rememberTaskModel} from './Shell/model-authority';
/** Name-only model selection. Main retains ambiguous owner-bound commands. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Button} from './primitives';
import {useDevelopmentBuild} from './development';
import {tasksBridge} from './Shell/tasks-bridge';
import {parseModelCatalog,parseModelBinding,parseTaskRoute,parsePendingModelOperation,savedModelReason,record,type ModelCatalog,type ModelBinding,type PendingModelOperation,type BindingStateInput,type ResolveModelInput,type SelectModelInput,type TaskRouteView} from '../main/routes/types';
interface Bridge {catalog():Promise<unknown>;pendingModel(input:{taskId:string|null}):Promise<unknown>;resolve(input:ResolveModelInput):Promise<unknown>;bindingState(input:BindingStateInput):Promise<unknown>;forTask(input:{taskId:string}):Promise<unknown>;selectModel(input:SelectModelInput):Promise<unknown>;onChanged?(listener:()=>void):()=>void}
const bridge=():Bridge|null=>(globalThis as {inquello?:{routes?:Bridge}}).inquello?.routes??null;
function value(raw:unknown):unknown {const result=record(raw);if(result.ok!==true){const error=new Error(typeof result.reason==='string'?result.reason:'Model information is unavailable.');Object.assign(error,{definitive:result.code==='conflict'||result.code==='refused'});throw error;}return result.value;}
export function ProcessingRoutes({taskId,onReconnect}:{taskId?:string;onReconnect?:(destination:string)=>void}):ReactElement {
 const development=useDevelopmentBuild();
 const [catalog,setCatalog]=useState<ModelCatalog|null>(null),[task,setTask]=useState<TaskRouteView|null>(null),[choice,setChoice]=useState(''),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false),[current,setCurrent]=useState(false);
 const epoch=useRef(0),scopeVersion=useRef(0),reload=useRef<()=>void>(()=>{}),pending=useRef<PendingModelOperation|null>(null);
 useEffect(()=>{let live=true;scopeVersion.current++;const api=bridge();setCatalog(null);setTask(null);setChoice('');setCurrent(false);setBusy(false);pending.current=null;
  const load=async()=>{const generation=++epoch.current;try{
   if(!api)throw new Error();const restored=parsePendingModelOperation(record(value(await api.pendingModel({taskId:taskId??null}))).operation);
   if(!live||generation!==epoch.current)return;
   if(restored){if(restored.kind==='select'?restored.input.taskId!==taskId:taskId!==undefined)throw new Error();pending.current=restored;setChoice(restored.kind==='resolve'?restored.input.choiceId:restored.kind==='select'?restored.input.bindingId:'');setNotice('An earlier model operation is unconfirmed. Retry that same operation before making another choice.');}
   const next=parseModelCatalog(value(await api.catalog()));const saved=taskId?parseTaskRoute(value(await api.forTask({taskId}))):null;
   if(!live||generation!==epoch.current)return;if(saved&&saved.taskId!==taskId)throw new Error();if(saved)rememberTaskModel(saved);setCatalog(next);setTask(saved);setCurrent(true);if(!pending.current)setNotice(null);
  }catch{if(live&&generation===epoch.current){setCurrent(false);setNotice('Model information is unavailable. Your choice and any unconfirmed operation are retained. Refresh to try again.');}}};
  reload.current=()=>void load();void load();const off=api?.onChanged?.(()=>void load());
  const session=tasksBridge()?.onSessionChanged?.(identityChanged=>{scopeVersion.current++;epoch.current++;setCurrent(false);setBusy(false);if(identityChanged){setCatalog(null);setTask(null);setChoice('');pending.current=null;setBusy(false);setNotice(null);}});
  return()=>{live=false;epoch.current++;scopeVersion.current++;off?.();session?.();};
 },[taskId]);
 const perform=async(command:PendingModelOperation)=>{const api=bridge();if(!api||busy)return;const version=scopeVersion.current;pending.current=command;setBusy(true);setNotice(null);
  try{const result=value(await (command.kind==='state'?api.bindingState(command.input):command.kind==='select'?api.selectModel(command.input):api.resolve(command.input)));if(version!==scopeVersion.current)return;
   if(command.kind==='select'){const saved=parseTaskRoute(result);rememberTaskModel(saved);setTask(saved);}else parseModelBinding(result);pending.current=null;reload.current();
  }catch(error){if(version===scopeVersion.current){const definitive=(error as {definitive?:boolean}).definitive===true;if(definitive){pending.current=null;setCurrent(false);}setNotice(`${(error as Error).message} ${definitive?'Refresh models and choose again.':'Retry checks the same saved operation.'}`);}}
  finally{if(version===scopeVersion.current)setBusy(false);}
 };
 const save=()=>{if(pending.current){void perform(pending.current);return;}if(!catalog||!current||!choice)return;void perform(taskId?{kind:'select',input:{operationId:crypto.randomUUID(),taskId,expectedRevision:task?.revision??0,bindingId:choice}}:{kind:'resolve',input:{operationId:crypto.randomUUID(),catalogVersion:catalog.catalogVersion,choiceId:choice}});};
 const changeState=(binding:ModelBinding,state:'active'|'revoked')=>{if(pending.current){if(pending.current.kind==='state'&&pending.current.input.bindingId===binding.bindingId&&pending.current.input.state===state)void perform(pending.current);else setNotice('Retry the unconfirmed model operation before making another change.');return;}if(current)void perform({kind:'state',input:{operationId:crypto.randomUUID(),bindingId:binding.bindingId,expectedRevision:binding.stateRevision,state}});};
 const selected=task?.selected;
 const binding=task?.configurationRevision===null?undefined:catalog?.bindings.find(b=>b.routeId===selected?.routeId&&b.configurationRevision===task?.configurationRevision);
 const choices=taskId?catalog?.bindings.filter(b=>b.state==='active').map(b=>({id:b.bindingId,label:`${b.provider} · ${b.name}`,reason:b.reason})):catalog?.choices.map(c=>({id:c.choiceId,label:`${c.provider} · ${c.name}`,reason:null}));
 const savedReason=savedModelReason(selected??null,task?.staleConfiguration,task?.disclosureBindings?.some(ref=>!ref.active),development);
 return <section className="specimen-policy-workspace" aria-label="Models" data-processing-routes>
  <h3>{taskId?'Conversation model':'Choose a model'}</h3>
  {taskId&&<><p><strong>{selected?.configuration?.model??'No model selected'}</strong></p>{selected&&<p>{task?.staleConfiguration?binding?.reason??'This saved model is unavailable. Revalidate it in Settings or choose another model.':savedReason}</p>}{selected&&!selected.credentialPresent&&onReconnect&&<Button onPress={()=>onReconnect(selected.routeId==='claude-api-key'?'provider-claude-key':selected.configuration?.deployment==='chatgpt-codex'?'codex-chatgpt':'provider-codex-key')}>{`Connect ${selected.provider}`}</Button>}</>}
  {!taskId&&<p>Connect an account in <a href="#settings-providers">AI connections</a>, then choose a supported model by name. Account access and qualification are checked separately.</p>}
  <label>Model<select aria-label="Model" value={choice} disabled={busy||pending.current!==null} onChange={e=>setChoice(e.target.value)}><option value="">Choose a model</option>{choices?.map(c=><option key={c.id} value={c.id}>{c.label}{c.reason?' · unavailable':''}</option>)}</select></label>
  <Button onPress={save} pending={busy} disabledReason={pending.current?undefined:!current?'Refresh model information first':!choice?'Choose a model first':taskId&&!task?'Conversation information unavailable':undefined}>{pending.current?'Retry same model operation':taskId?'Change conversation model':'Save model'}</Button>
  <Button variant="quiet" onPress={()=>reload.current()} disabledReason={busy?'Wait for the model operation':undefined}>Refresh models</Button>
  {taskId&&<p>Finish or stop pending work before changing this conversation’s model.</p>}
  {!taskId&&catalog?.bindings.map(b=><div key={b.bindingId}><p><strong>{b.name}</strong> · {b.provider}</p><p>{b.reason??(b.qualification==='synthetic-only'?'Qualified for fictional work only.':b.qualification==='development'?'Development build: qualification checks are off.':b.qualification==='requires-fresh-policy'?'Model qualification verified. Current workspace approval and account access are checked before use.':'Current availability must be checked before use.')} Account access: {b.accountAccess}.</p>{b.state==='legacy-superseded'&&<Button onPress={()=>changeState(b,'active')} disabledReason={busy||!current?'Refresh model information first':undefined}>{`Revalidate saved ${b.name}`}</Button>}{b.state!=='revoked'&&<Button variant="quiet" onPress={()=>changeState(b,'revoked')} disabledReason={busy||!current?'Refresh model information first':undefined}>{`Revoke ${b.name}`}</Button>}</div>)}
  {notice&&<p role="status">{notice}</p>}
 </section>;
}