import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
// Only close, never sending a signal, proves all inspector handles released.
const inspecting = new Set<object>();
export const inspectorsQuiescent = (): boolean => inspecting.size === 0;
export function inspectNative(binary:string,env:NodeJS.ProcessEnv,input:unknown,
 timings={timeoutMs:30000,terminateMs:1000,closeMs:5000,maxBytes:8*1024*1024}):Promise<unknown>{
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,['--inquello-data-inspect'],{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  inspecting.add(child);
  const decoder=new StringDecoder('utf8');
  let output='',bytes=0,failed=false,settled=false;
  let escalation:ReturnType<typeof setTimeout>|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const settle=(value?:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);clearTimeout(escalation);clearTimeout(deadline);if(failed||value===undefined)reject(new Error(inspecting.has(child)?'Native inspector exit could not be confirmed; runtime reopening is blocked':'Native data inspection unavailable'));else resolve(value);};
  const fail=()=>{if(failed)return;failed=true;clearTimeout(timer);child.kill('SIGTERM');escalation=setTimeout(()=>{child.kill('SIGKILL');deadline=setTimeout(()=>settle(),timings.closeMs);},timings.terminateMs);};
  const timer=setTimeout(fail,timings.timeoutMs);
  child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>timings.maxBytes)fail();else if(!failed)output+=decoder.write(chunk);});
  child.stderr.on('data',()=>{});child.on('error',fail);
  child.on('close',code=>{inspecting.delete(child);if(code!==0)failed=true;try{settle(JSON.parse(output+decoder.end()));}catch{failed=true;settle();}});
  child.stdin.on('error',fail);try{child.stdin.end(JSON.stringify(input));}catch{fail();}
 });
}
