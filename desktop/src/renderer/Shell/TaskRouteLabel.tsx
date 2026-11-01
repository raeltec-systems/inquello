/** Read-only current selected route. Never supplies defaults, choices or authority. */
import {useEffect,useState,type ReactElement} from 'react';
import {parseTaskRoute} from '../../main/routes/types';
import {taskValue,tasksBridge} from './tasks-bridge';
interface Routes {forTask(input:{taskId:string}):Promise<unknown>;onChanged?(listener:()=>void):()=>void}
export function TaskRouteLabel({taskId,workspaceId}:{taskId:string;workspaceId:string}):ReactElement|null{
 const [label,setLabel]=useState<{taskId:string;workspaceId:string;model:string;provider:string;routeId:string;revision:number}|null>(null);
 useEffect(()=>{
  let live=true,generation=0;
  const routes=(globalThis as {inquello?:{routes?:Routes}}).inquello?.routes;
  const clear=()=>{generation++;setLabel(null);};
  const load=async()=>{
   const read=++generation;setLabel(null);
   if(!routes)return;
   try{
    const view=parseTaskRoute(taskValue(await routes.forTask({taskId})));
    if(!live||read!==generation)return;
    const selected=view.selected,configuration=selected?.configuration;
    if(view.taskId!==taskId||view.workspaceId!==workspaceId||view.staleConfiguration||!selected||!configuration||view.configurationRevision!==selected.revision)return;
    setLabel({taskId,workspaceId,model:configuration.model,provider:selected.provider,routeId:selected.routeId,revision:selected.revision});
   }catch{if(live&&read===generation)setLabel(null);}
  };
  void load();
  const changed=routes?.onChanged?.(()=>{void load();});
  // Pre-transition invalidation clears immediately. Only a subsequent fresh route
  // notification/read may repopulate; never fetch using a still-old identity here.
  const session=tasksBridge()?.onSessionChanged?.(()=>clear());
  return()=>{live=false;generation++;changed?.();session?.();};
 },[taskId,workspaceId]);
 if(!label||label.taskId!==taskId||label.workspaceId!==workspaceId)return null;
 return <span className="iq-composer-route" data-composer-route title={`${label.provider} (${label.routeId}) - configuration ${label.revision}`}>
  <span>{label.model}</span><span className="iq-composer-route-provider"> - {label.provider}</span>
 </span>;
}
