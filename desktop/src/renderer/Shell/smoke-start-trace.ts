/** Observation only. The unpackaged pinned visual probe alone installs this sink.
 * No data in it is used for authorization, navigation, or dispatch. */
type Event='start-send'|'start-accepted'|'shell-accepted'|'tree-start'|'tree-result'|'shell-committed';
type Flag='foreground'|'workspaceAllowed'|'scopeCurrent'|'selected'|'taskPresent'|'receiptPresent'|'showStart'|'ok'|'hasTasks'|'selectedUnavailable';
export function smokeStartTrace(event:Event,flags:Partial<Record<Flag,boolean>>={},read?:number):void{
 try{
  const sink=(globalThis as {__iqSyntheticStartTrace?:unknown}).__iqSyntheticStartTrace;
  if(!Array.isArray(sink)||sink.length>=128)return;
  const safe:Record<string,boolean>={};
  for(const key of ['foreground','workspaceAllowed','scopeCurrent','selected','taskPresent','receiptPresent','showStart','ok','hasTasks','selectedUnavailable'] as const)if(typeof flags[key]==='boolean')safe[key]=flags[key]!;
  sink.push({event,ms:Math.round(performance.now()),flags:safe,...(Number.isSafeInteger(read)&&read!>=0?{read}: {})});
 }catch{/* Diagnostic observation never alters application behavior. */}
}
