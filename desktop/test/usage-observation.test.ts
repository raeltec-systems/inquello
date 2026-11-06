import {describe,expect,it,vi} from 'vitest';
import {UsageService} from '../src/main/usage/service';
import {notifySettledWork} from '../src/main/usage/notifications';
import {facts,taskId,principal} from './usage-fixtures';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve};}
const authority=()=>({ok:true as const,value:{sandbox:'available' as const}});
function setup(){
 let owner:string|null=principal,runtime:unknown={},ready=true;
 const inspectEnvironment=vi.fn(async()=>authority()),request=vi.fn(async()=>facts()),changed=vi.fn();
 const service=new UsageService({identity:{principalId:()=>owner},runtime:{instance:()=>runtime,ready:()=>ready,request:request as never},policy:{inspectEnvironment},onChanged:changed});
 return{service,inspectEnvironment,request,changed,owner:()=>{owner=null;},runtime:()=>{runtime={};},stop:()=>{ready=false;}};
}
describe('usage observation reconstruction',()=>{
 it('reconstructs after sandbox completion supersedes a successful held authority inspection',async()=>{
  const h=setup(),held=deferred<ReturnType<typeof authority>>();h.inspectEnvironment.mockImplementationOnce(()=>held.promise);
  const pending=h.service.forTask(taskId);await vi.waitFor(()=>expect(h.inspectEnvironment).toHaveBeenCalledOnce());
  const refresh=(privateScope:boolean)=>{if(privateScope)h.service.invalidate();else h.service.observationsChanged();};
  notifySettledWork('inquello/tools/exec',{sandboxProbeTarget:'/fixture'},Promise.resolve({}),{usageChanged:refresh,environmentChanged:refresh},fn=>fn());
  await Promise.resolve();held.resolve(authority());
  expect(await pending).toMatchObject({ok:true,value:facts()});
  expect(h.inspectEnvironment).toHaveBeenCalledTimes(2);expect(h.request).toHaveBeenCalledExactlyOnceWith('inquello/usage/read',{taskId});
 });
});

describe('bounded current-authority reconstruction',()=>{
 it('discards an observation-superseded native payload and reads current settings from scratch',async()=>{
  const h=setup(),held=deferred<ReturnType<typeof facts>>();h.request.mockImplementationOnce(()=>held.promise);
  const pending=h.service.forTask(taskId);await vi.waitFor(()=>expect(h.request).toHaveBeenCalledOnce());
  h.service.observationsChanged();const latest=facts();latest.usage.settings={revision:2,route_revision:2,choices:{reasoning:'default',speed:'default'}};latest.capabilities.routeRevision=2;h.request.mockResolvedValue(latest);held.resolve(facts());
  expect(await pending).toEqual({ok:true,value:latest});expect(h.inspectEnvironment).toHaveBeenCalledTimes(2);expect(h.request).toHaveBeenCalledTimes(2);
 });
 it.each(['authority','native'] as const)('refuses a second observation change during %s without an unbounded retry',async phase=>{
  const h=setup();
  if(phase==='authority')h.inspectEnvironment.mockImplementation(async()=>{h.service.observationsChanged();return authority();});
  else h.request.mockImplementation(async()=>{h.service.observationsChanged();return facts();});
  expect(await h.service.forTask(taskId)).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledTimes(2);expect(h.request).toHaveBeenCalledTimes(phase==='native'?2:0);
 });
 it.each(['owner','runtime','stop','hard'] as const)('never reconstructs past %s during successful authority wait',async change=>{
  const h=setup(),held=deferred<ReturnType<typeof authority>>();h.inspectEnvironment.mockImplementationOnce(()=>held.promise);
  const pending=h.service.forTask(taskId);await vi.waitFor(()=>expect(h.inspectEnvironment).toHaveBeenCalledOnce());h.service.observationsChanged();if(change==='hard')h.service.invalidate();else h[change]();held.resolve(authority());
  expect(await pending).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledOnce();expect(h.request).not.toHaveBeenCalled();
 });
 it.each(['owner','runtime','stop','hard'] as const)('never reconstructs past %s during successful native wait',async change=>{
  const h=setup(),held=deferred<ReturnType<typeof facts>>();h.request.mockImplementationOnce(()=>held.promise);
  const pending=h.service.forTask(taskId);await vi.waitFor(()=>expect(h.request).toHaveBeenCalledOnce());h.service.observationsChanged();if(change==='hard')h.service.invalidate();else h[change]();held.resolve(facts());
  expect(await pending).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledOnce();expect(h.request).toHaveBeenCalledOnce();
 });
 it.each(['denied','throws'] as const)('does not retry %s policy even with an observation change',async kind=>{
  const h=setup();h.inspectEnvironment.mockImplementationOnce(async()=>{h.service.observationsChanged();if(kind==='throws')throw new Error('authority unavailable');return{ok:false,code:'failed',reason:'unavailable'} as never;});
  expect(await h.service.forTask(taskId)).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledOnce();expect(h.request).not.toHaveBeenCalled();
 });
 it.each(['malformed','foreign','throws'] as const)('does not retry %s native data even with an observation change',async kind=>{
  const h=setup();h.request.mockImplementationOnce(async()=>{h.service.observationsChanged();if(kind==='throws')throw new Error('native unavailable');return(kind==='foreign'?{...facts(),taskId:principal}:{} )as never;});
  expect(await h.service.forTask(taskId)).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledOnce();expect(h.request).toHaveBeenCalledOnce();
 });
 it.each(['authority','native'] as const)('never replays a settings mutation superseded during %s',async phase=>{
  const h=setup();if(phase==='authority')h.inspectEnvironment.mockImplementationOnce(async()=>{h.service.observationsChanged();return authority();});
  else h.request.mockImplementationOnce(async()=>{h.service.observationsChanged();return facts();});
  expect(await h.service.set({taskId,operationId:taskId,expectedRevision:0,routeRevision:1,reasoning:'default',speed:'default'})).toMatchObject({ok:false});
  expect(h.inspectEnvironment).toHaveBeenCalledOnce();expect(h.request).toHaveBeenCalledTimes(phase==='native'?1:0);expect(h.changed).not.toHaveBeenCalled();
 });
 it('holds the original hard generation fixed across reconstruction',async()=>{
  const h=setup();h.inspectEnvironment.mockImplementationOnce(async()=>{h.service.observationsChanged();return authority();});
  h.inspectEnvironment.mockImplementationOnce(async()=>{h.service.invalidate();return authority();});
  expect(await h.service.forTask(taskId)).toMatchObject({ok:false});expect(h.inspectEnvironment).toHaveBeenCalledTimes(2);expect(h.request).not.toHaveBeenCalled();
 });
});
