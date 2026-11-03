/** Presentation orchestration only. Main/native retain journals, CAS and authority. */
import {useEffect,useRef,useState,type ReactElement} from 'react';
import {Menu,Button} from '../primitives';
import {parseModelCatalog,parseModelBinding,parsePendingModelOperation,parseTaskRoute,record,savedModelReason,type ModelBinding,type ModelCatalog,type PendingModelOperation,type TaskRouteView} from '../../main/routes/types';
import {tasksBridge,taskValue} from './tasks-bridge';
export function displayModelName(name:string):string {
 return name.replace(/^gpt-(\d+(?:\.\d+)?)-([a-z]+)$/,(_,version:string,model:string)=>'GPT-'+version+' '+model[0]!.toUpperCase()+model.slice(1));
}
import {rememberTaskModel,type ModelAuthorityChange} from './model-authority';

interface Routes {
 catalog():Promise<unknown>; pendingModel(input:{taskId:string|null}):Promise<unknown>;
 resolve(input:Extract<PendingModelOperation,{kind:'resolve'}>['input']):Promise<unknown>;
 selectModel(input:Extract<PendingModelOperation,{kind:'select'}>['input']):Promise<unknown>;
 bindingState(input:Extract<PendingModelOperation,{kind:'state'}>['input']):Promise<unknown>;
 forTask(input:{taskId:string}):Promise<unknown>; onChanged?(fn:(change?:ModelAuthorityChange)=>void):()=>void;
}
const bridge=()=> (globalThis as {inquello?:{routes?:Routes}}).inquello?.routes;
function result(raw:unknown):unknown {
 const value=record(raw);
 if(value.ok!==true)throw Object.assign(new Error(typeof value.reason==='string'?value.reason:'Model change could not be confirmed.'),{definitive:value.code==='conflict'||value.code==='refused'});
 return value.value;
}
export interface ConversationModelPickerProps {
 active?:boolean;workspaceId:string;taskId?:string;selected:ModelBinding|null;disabled?:boolean;
 onResolved?:(binding:ModelBinding)=>void;onPendingChange?:(pending:boolean,recovering:boolean)=>void;
}
export function ConversationModelPicker({workspaceId,taskId,selected,disabled=false,active=true,onResolved,onPendingChange}:ConversationModelPickerProps):ReactElement {
 const [connectionEpoch,setConnectionEpoch]=useState(0);
 const [catalog,setCatalog]=useState<ModelCatalog|null>(null),[saved,setSaved]=useState<TaskRouteView|null>(null);
 const [pending,setPending]=useState<PendingModelOperation|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState<string|null>(null);
 const root=useRef<HTMLDivElement>(null),journalReady=useRef(false);
 const scope=useRef({key:'',generation:0}),read=useRef(0),operation=useRef<PendingModelOperation|null>(null),working=useRef(false);
 const key=JSON.stringify([workspaceId,taskId??null,active]);
 if(scope.current.key!==key)scope.current={key,generation:scope.current.generation+1};
 const callbacks=useRef({onResolved,onPendingChange});callbacks.current={onResolved,onPendingChange};
 const loadRef=useRef<()=>Promise<void>>(async()=>{});
 const setOperation=(next:PendingModelOperation|null)=>{operation.current=next;setPending(next);callbacks.current.onPendingChange?.(next!==null||!journalReady.current,!journalReady.current);};
 useEffect(()=>{
  let live=true;const api=bridge(),generation=scope.current.generation;
  journalReady.current=false;setCatalog(null);setSaved(null);setNotice(null);setBusy(false);working.current=false;setOperation(null);
  const current=()=>live&&scope.current.generation===generation;
  const load=async()=>{
   const n=++read.current;
   try {
    if(!api)throw new Error();
    // Resolve/state use the principal scope; select uses this exact conversation.
    const globalPending=parsePendingModelOperation(record(result(await api.pendingModel({taskId:null}))).operation);
    const taskPending=taskId?parsePendingModelOperation(record(result(await api.pendingModel({taskId}))).operation):null;
    if(!current()||n!==read.current)return;
    if(taskPending&&(taskPending.kind!=='select'||taskPending.input.taskId!==taskId))throw new Error();
    if(globalPending?.kind==='select')throw new Error();
    journalReady.current=true;
    if(!working.current)setOperation(taskPending??globalPending);
    const next=parseModelCatalog(result(await api.catalog()));
    const task=taskId?parseTaskRoute(result(await api.forTask({taskId}))):null;
    if(!current()||n!==read.current)return;
    if(task&&(task.taskId!==taskId||task.workspaceId!==workspaceId))throw new Error();
    setCatalog(next);setSaved(task);if(task)rememberTaskModel(task);
    if(!working.current){setOperation(taskPending??globalPending);setNotice(taskPending||globalPending?'A previous model change needs confirmation.':null);}
   } catch {if(current()&&n===read.current){setCatalog(null);setSaved(null);setNotice('Models are unavailable. Try again.');}}
  };
  loadRef.current=load;if(active)void load();
  const off=api?.onChanged?.(change=>{if(change?.authority!==false&&!change?.taskId){scope.current.generation++;setConnectionEpoch(v=>v+1);}else void load();});
  const session=tasksBridge()?.onSessionChanged?.(()=>{scope.current.generation++;read.current++;setCatalog(null);setSaved(null);setBusy(false);working.current=false;setNotice('Your connection changed. Reconnecting models…');setConnectionEpoch(v=>v+1);});
  return()=>{live=false;read.current++;scope.current.generation++;off?.();session?.();};
 },[key,connectionEpoch]);
 const run=async(command:PendingModelOperation,selectAfterResolve:boolean)=>{
  const api=bridge();if(!api||working.current||disabled||!active)return;
  const generation=scope.current.generation,expectedRevision=saved?.revision;
  const current=()=>scope.current.generation===generation;
  working.current=true;setBusy(true);setNotice(null);setOperation(command);
  try {
   const value=result(await (command.kind==='resolve'?api.resolve(command.input):command.kind==='select'?api.selectModel(command.input):api.bindingState(command.input)));
   if(!current())return;
   if(command.kind==='select'){
    const next=parseTaskRoute(value);
    const expected=catalog?.bindings.find(binding=>binding.bindingId===command.input.bindingId);
    if(!expected||next.taskId!==taskId||next.workspaceId!==workspaceId||next.configurationRevision!==expected.configurationRevision||next.selected?.routeId!==expected.routeId)throw new Error('Model selection was not confirmed.');
    rememberTaskModel(next);setSaved(next);setOperation(null);
   }else{
    const binding=parseModelBinding(value);setOperation(null);
    if(command.kind==='resolve'&&selectAfterResolve){
     if(taskId){
      if(expectedRevision===undefined)throw new Error('Reopen this conversation before choosing a model.');
      const select:PendingModelOperation={kind:'select',input:{operationId:crypto.randomUUID(),taskId,expectedRevision,bindingId:binding.bindingId}};
      setOperation(select);
      const next=parseTaskRoute(result(await api.selectModel(select.input)));
      if(!current())return;
      if(next.taskId!==taskId||next.workspaceId!==workspaceId||next.configurationRevision!==binding.configurationRevision||next.selected?.routeId!==binding.routeId)throw new Error('Model selection was not confirmed.');
      rememberTaskModel(next);setSaved(next);setOperation(null);
     }else callbacks.current.onResolved?.(binding);
    }
    // A restored resolve has no surviving conversation intent. Never silently
    // apply it to a newly opened conversation after an unmount or identity loss.
   }
   if(current())await loadRef.current();
  }catch(error){if(current()){
   if((error as {definitive?:boolean}).definitive)setOperation(null);
   setNotice(error instanceof Error?error.message:'Model change could not be confirmed.');
  }}finally{if(current()){working.current=false;setBusy(false);}}
 };
 const choose=(choiceId:string)=>{
  if(!active||disabled||working.current||operation.current||!catalog)return;
  queueMicrotask(()=>active&&root.current?.closest('.iq-composer')?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
  void run({kind:'resolve',input:{operationId:crypto.randomUUID(),catalogVersion:catalog.catalogVersion,choiceId}},true);
 };
 const configuration=saved?.selected?.configuration;
 const rawLabel=taskId?configuration?.model??'Choose model':selected?.name??'Choose model';
 const label=displayModelName(rawLabel);
 const currentChoice=catalog?.choices.find(c=>c.name===(taskId?configuration?.model:selected?.name)&&c.provider===(taskId?saved?.selected?.provider:selected?.provider))?.choiceId??'';
 const unavailable=saved?savedModelReason(saved.selected,saved.staleConfiguration,saved.disclosureBindings.some(ref=>!ref.active)):null;
 const blocked=disabled?'Finish or stop the current response first.':busy?'Changing model…':pending?'Confirm the previous model change first.':undefined;
 if(!active)return <></>;
 return <div ref={root} className="iq-conversation-model" data-conversation-model>
  <Menu label="Choose model" triggerContent={<span data-composer-route>{label}</span>} heading="Model" triggerVariant="quiet" className="iq-model-menu"
   items={[
    ...(catalog?[{kind:'radio' as const,label:'Model',value:unavailable?'':currentChoice,options:catalog.choices.map(choice=>({value:choice.choiceId,label:displayModelName(choice.name),description:choice.provider,disabledReason:blocked})),onChange:choose}]:[]),
    ...(!catalog?[{label:'Try again',onSelect:()=>void loadRef.current()}]:[]),
    {label:'AI connections',onSelect:()=>{globalThis.location.hash='#settings-providers';}}
   ]}/>
  {unavailable&&<span className="iq-model-unavailable" title={unavailable}>Unavailable</span>}
  {pending&&<Button size="sm" variant="quiet" pending={busy} onPress={()=>void run(pending,false)} disabledReason={disabled?'Finish or stop the current response first.':undefined}>Confirm model change</Button>}
  {notice&&<span role="status" className="iq-model-notice">{notice}</span>}
 </div>;
}
