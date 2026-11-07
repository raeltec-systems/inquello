import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {object,nullable,uuid,oneOf,parseProviderConsentView} from '../main/identity/wire';
import type {ProviderBridge} from './bridge';
const parseState=object({view:parseProviderConsentView,pending:nullable(object({operationId:uuid,action:oneOf(['allow','revoke'] as const)}))});
type State=ReturnType<typeof parseState>;
export function useProviderConsent(bridge:ProviderBridge|null,workspaceId:string|null){
  const [state,setState]=useState<State|null>(null),[notice,setNotice]=useState<string|null>(null),[busy,setBusy]=useState(false);
  const epoch=useRef(0),sequence=useRef(0),mutating=useRef(false),workspace=useRef(workspaceId);
  workspace.current=workspaceId;
  const current=state?.view.workspace_id===workspaceId?state:null;
  const valid=(token:number,id:string,read:number)=>token===epoch.current&&workspace.current===id&&read===sequence.current;
  const accept=(raw:unknown,token:number,id:string,read:number)=>{
    if(!valid(token,id,read))return;
    const result=raw as {ok?:unknown;value?:unknown;reason?:unknown};
    if(result?.ok===true){const parsed=parseState(result.value,'');if(parsed.view.workspace_id!==id)throw new Error();setState(parsed);setNotice(null);}
    else{setState(null);setNotice(typeof result?.reason==='string'&&result.reason.length<=1024?result.reason:'Workspace permission is unavailable.');}
  };
  useLayoutEffect(()=>{epoch.current++;sequence.current++;mutating.current=false;setState(null);setNotice(null);setBusy(false);},[workspaceId]);
  useEffect(()=>{
    if(!workspaceId||!bridge?.consent)return;
    const id=workspaceId;
    const load=()=>{
      if(mutating.current)return;
      const token=epoch.current,read=++sequence.current;
      void bridge.consent!({workspaceId:id}).then(raw=>accept(raw,token,id,read)).catch(()=>{if(valid(token,id,read)){setState(null);setNotice('Workspace permission could not be read.');}});
    };
    load();const timer=setInterval(load,30_000);
    const tasks=(globalThis as {inquello?:{tasks?:{onSessionChanged?:(listener:(changed:boolean)=>void)=>()=>void}}}).inquello?.tasks;
    const off=tasks?.onSessionChanged?.(()=>{epoch.current++;sequence.current++;mutating.current=false;setState(null);setNotice('Your workspace authority changed. Refreshing permission…');setBusy(false);load();});
    return()=>{clearInterval(timer);off?.();epoch.current++;sequence.current++;};
  },[bridge,workspaceId]);
  const act=async(action:'allow'|'revoke'|'reconcile'|'retry',before?:()=>Promise<boolean>)=>{
    const observed=current,id=workspaceId,token=epoch.current;
    if(!id||!observed||mutating.current)return;
    mutating.current=true;const read=++sequence.current;
    setBusy(true);setNotice(null);
    try{
      if(before&&!(await before()))return;
      if(!valid(token,id,read))return;
      const call=action==='reconcile'?bridge?.reconcileConsent?.({workspaceId:id}):
        action==='retry'?bridge?.retryConsent?.({workspaceId:id}):
        bridge?.changeConsent?.({workspaceId:id,expectedRevision:observed.view.revision,
          contractVersion:observed.view.contract_version,contractDigest:observed.view.contract_digest,action});
      if(!call)throw new Error();
      const result=await call;accept(result,token,id,read);
      if(valid(token,id,read)&&(result as {ok?:unknown})?.ok!==true&&bridge?.consent){
        const refreshed=await bridge.consent({workspaceId:id});accept(refreshed,token,id,read);
        if(valid(token,id,read)&&(refreshed as {ok?:unknown})?.ok===true){
          const reason=(result as {reason?:unknown}).reason;
          setNotice(typeof reason==='string'&&reason.length<=1024?reason:'The permission change was not confirmed. Review the current state and any pending request.');
        }
      }
    }catch{if(valid(token,id,read)){setNotice('The permission change is not confirmed. Check its result before making another change.');
      try{if(bridge?.consent)accept(await bridge.consent({workspaceId:id}),token,id,read);}catch{/* Keep unknown state. */}
    }}finally{if(valid(token,id,read)){mutating.current=false;setBusy(false);}}
  };
  return {state:current,notice,busy,act};
}
