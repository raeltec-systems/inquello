/** Shared bounded observation: navigation reads status, selected work reads history. */
import {useEffect,useState} from 'react';
import {parseProgress,taskValue,tasksBridge,type ProgressSnapshot} from './tasks-bridge';
type Entry={taskId:string;workspaceId:string;listeners:Map<(value:ProgressSnapshot|null)=>void,boolean>;value:ProgressSnapshot|null;busy:symbol|null;background:boolean;upgrade:boolean;dirty:boolean;generation:number};
const entries=new Map<string,Entry>();
let timer:ReturnType<typeof setInterval>|undefined,scheduled:ReturnType<typeof setTimeout>|undefined;
let unsubscribe:(()=>void)|undefined,session:(()=>void)|undefined,cursor=0,activeReads=0,backgroundReads=0;
const full=(entry:Entry)=>[...entry.listeners.values()].some(Boolean);
const capacity=(entry:Entry)=>activeReads<4&&(full(entry)||backgroundReads<3);
const publish=(entry:Entry,value:ProgressSnapshot|null)=>{entry.value=value;for(const listener of entry.listeners.keys())listener(value);};
async function read(entry:Entry){
 if((entry.busy&&!entry.upgrade)||!entry.listeners.size||!capacity(entry))return;const background=!full(entry),token=Symbol('observation');activeReads++;if(background)backgroundReads++;entry.busy=token;entry.background=background;entry.upgrade=false;entry.dirty=false;const generation=entry.generation;
 try{const api=tasksBridge();if(!api)throw new Error();const full=[...entry.listeners.values()].some(Boolean);const result=await (full||!api.activity?api.progress({taskId:entry.taskId,workspaceId:entry.workspaceId}):api.activity({taskId:entry.taskId,workspaceId:entry.workspaceId}));const value=parseProgress(taskValue(result));if(value.taskId!==entry.taskId||value.workspaceId!==entry.workspaceId)throw new Error();if(generation===entry.generation)publish(entry,value);}
 catch{
  if(generation!==entry.generation)return;
  // Clear protected payload before even an authorized fallback starts waiting.
  publish(entry,null);
  // A bounded/full-history failure must not remove independently authorized
  // interruption. Re-read only cheap current status; never reuse stale content.
  try{const api=tasksBridge();if(![...entry.listeners.values()].some(Boolean)||!api?.activity)throw new Error();const value=parseProgress(taskValue(await api.activity({taskId:entry.taskId,workspaceId:entry.workspaceId})));if(value.taskId!==entry.taskId||value.workspaceId!==entry.workspaceId)throw new Error();if(generation===entry.generation)publish(entry,{...value,historyIncomplete:true});}
  catch{if(generation===entry.generation)publish(entry,null);}
 }finally{if(entry.busy===token){entry.busy=null;entry.background=false;}activeReads--;if(background)backgroundReads--;if(entry.dirty&&entry.listeners.size)schedule();}
}
function tick(){const rows=[...entries.values()];if(!rows.length)return;
 const ordered=[...rows.slice(cursor),...rows.slice(0,cursor)];
 // A selected Task never queues behind navigation. Background work can use
 // at most three slots, leaving one for controls/questions and invalidations.
 const priority=ordered.filter(full),background=ordered.filter(entry=>!full(entry));
 for(const entry of [...priority.filter(e=>e.dirty),...priority.filter(e=>!e.dirty),...background.filter(e=>e.dirty),...background.filter(e=>!e.dirty)])if((!entry.busy||entry.upgrade)&&capacity(entry))void read(entry);
 cursor=(cursor+3)%rows.length;
}
function schedule(){if(!scheduled)scheduled=setTimeout(()=>{scheduled=undefined;tick();},250);}
function start(){if(timer)return;timer=setInterval(tick,1500);const api=tasksBridge();unsubscribe=api?.onProgressChanged?.(()=>{for(const entry of entries.values())entry.dirty=true;schedule();});session=api?.onSessionChanged?.(()=>{for(const entry of entries.values()){entry.generation++;entry.dirty=true;publish(entry,null);}schedule();});}
function stop(){if(entries.size)return;clearInterval(timer);timer=undefined;clearTimeout(scheduled);scheduled=undefined;unsubscribe?.();session?.();unsubscribe=session=undefined;}
export function useTaskObservation(taskId:string,workspaceId:string,enabled=true,full=false):ProgressSnapshot|null{
 const [snapshot,setSnapshot]=useState<ProgressSnapshot|null>(null);
 useEffect(()=>{setSnapshot(null);if(!enabled)return;const key=JSON.stringify([workspaceId,taskId]);let entry=entries.get(key);if(!entry){entry={taskId,workspaceId,listeners:new Map(),value:null,busy:null,background:false,upgrade:false,dirty:true,generation:0};entries.set(key,entry);}const wasFull=[...entry.listeners.values()].some(Boolean);entry.listeners.set(setSnapshot,full);if(entry.value)setSnapshot(entry.value);start();if(full&&!wasFull&&entry.busy&&entry.background&&!entry.upgrade){entry.generation++;entry.dirty=true;entry.upgrade=true;}if((!entry.busy||entry.upgrade)&&capacity(entry)&&(entries.size<=3||full&&!wasFull))void read(entry);else if(entry.upgrade)schedule();return()=>{entry!.listeners.delete(setSnapshot);if(![...entry!.listeners.values()].some(Boolean))entry!.upgrade=false;if(!entry!.listeners.size){entry!.generation++;entries.delete(key);}stop();};},[taskId,workspaceId,enabled,full]);
 return snapshot?.taskId===taskId&&snapshot.workspaceId===workspaceId?snapshot:null;
}
export function refreshTaskObservation(taskId:string,workspaceId:string){const entry=entries.get(JSON.stringify([workspaceId,taskId]));if(!entry)return;entry.generation++;if(entry.busy)entry.dirty=true;else {entry.dirty=true;if(capacity(entry))void read(entry);else schedule();}}
