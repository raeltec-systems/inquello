import {modelAuthorityApplies,rememberTaskModel,forgetTaskModel,forgetTaskModels,type ModelAuthorityChange} from './model-authority';
/** Read-only current selected route. Never supplies defaults, choices or authority. */
import {useEffect,useState,type ReactElement} from 'react';
import {parseTaskRoute,savedModelReason} from '../../main/routes/types';
import {taskValue,tasksBridge} from './tasks-bridge';
interface Routes {forTask(input:{taskId:string}):Promise<unknown>;onChanged?(listener:(change?:ModelAuthorityChange)=>void):()=>void}
export function TaskRouteLabel({taskId,workspaceId}:{taskId:string;workspaceId:string}):ReactElement|null{
 const [label,setLabel]=useState<{taskId:string;workspaceId:string;model:string;provider:string;reason:string|null}|null>(null);
 useEffect(()=>{
  let live=true,generation=0;
  const routes=(globalThis as {inquello?:{routes?:Routes}}).inquello?.routes;
  const clear=()=>{generation++;forgetTaskModel(taskId);setLabel(null);};
  const load=async()=>{
   const read=++generation;
   if(!routes)return;
   try{
    const view=parseTaskRoute(taskValue(await routes.forTask({taskId})));
    if(!live||read!==generation)return;
    const selected=view.selected,configuration=selected?.configuration;
    if(view.taskId!==taskId||view.workspaceId!==workspaceId||!selected||!configuration||view.configurationRevision!==selected.revision)return;
    rememberTaskModel(view);setLabel({taskId,workspaceId,model:configuration.model,provider:selected.provider,reason:savedModelReason(selected,view.staleConfiguration,view.disclosureBindings?.some(ref=>!ref.active))});
   }catch{if(live&&read===generation)setLabel(null);}
  };
  void load();
  const changed=routes?.onChanged?.(change=>{if(!modelAuthorityApplies(change,taskId))return;clear();void load();});
  // Pre-transition invalidation clears immediately. Only a subsequent fresh route
  // notification/read may repopulate; never fetch using a still-old identity here.
  const session=tasksBridge()?.onSessionChanged?.(()=>{forgetTaskModels();clear();});
  return()=>{live=false;generation++;changed?.();session?.();};
 },[taskId,workspaceId]);
 if(!label||label.taskId!==taskId||label.workspaceId!==workspaceId)return null;
 return <span className="iq-composer-route" data-composer-route title={label.reason??label.provider}>
  <span>{label.model}</span><span className="iq-composer-route-provider">{label.reason?' · unavailable':` · ${label.provider}`}</span>
 </span>;
}
