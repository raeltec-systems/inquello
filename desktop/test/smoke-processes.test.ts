import {createRequire} from 'node:module';
import {describe,expect,it,vi} from 'vitest';
const require=createRequire(import.meta.url);
const {createOwnedProcessGuard:makeGuard}=require('../scripts/smoke-processes.cjs');
const createOwnedProcessGuard=(process:unknown,options:Record<string,unknown>)=>makeGuard(process,{canonicalExecutable:(file:string)=>file.toLowerCase(),...options});
const binary='D:\\fixture\\electron.exe';
const root={pid:101,created:'root-start',executable:binary};
const descendant={pid:102,created:'child-start',executable:'D:\\fixture\\runtime.exe'};
const child=()=>({pid:101,exitCode:null as number|null,signalCode:null as string|null});

describe('synthetic smoke owned process cleanup (mocked OS only)',()=>{
  it('terminates the still-owned Windows tree before verifying every captured identity',async()=>{
    const process=child();let reads=0;
    const read=vi.fn((_pid:number,identities?:number[])=>{
      reads++;if(reads<=2)return[root,descendant];
      expect(identities).toEqual([101,102]);return[];
    });
    const kill=vi.fn((pid:number)=>{expect(pid).toBe(101);expect(process.exitCode).toBeNull();process.exitCode=1;});
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,readWindowsTree:read,taskkill:kill});
    await guard.stop(false);
    expect(kill).toHaveBeenCalledTimes(1);
  });
  it('never terminates a reused or replacement Windows PID',async()=>{
    const process=child();let reads=0;const kill=vi.fn();
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,readWindowsTree:()=>++reads===1?[root]:[{...root,created:'replacement'}],taskkill:kill});
    await expect(guard.stop()).rejects.toThrow('identity changed');
    expect(kill).not.toHaveBeenCalled();
  });
  it('accepts a verified graceful runtime shutdown even when assertions made app exit 1',async()=>{
    const process=child(),kill=vi.fn();
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,readWindowsTree:()=>[root],taskkill:kill});
    process.exitCode=1;
    await guard.stop(true);
    expect(kill).not.toHaveBeenCalled();
  });
  it('does not guess descendant ownership after an abrupt parent exit',async()=>{
    const process=child(),kill=vi.fn();
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,readWindowsTree:()=>[root],taskkill:kill});
    process.exitCode=1;
    await expect(guard.stop(false)).rejects.toThrow('descendants unresolved');
    expect(kill).not.toHaveBeenCalled();
  });
  it('fails bounded verification when an owned reparented descendant survives',async()=>{
    const process=child();let reads=0,time=0;
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,
      readWindowsTree:()=>++reads<=2?[root,descendant]:[descendant],
      taskkill:()=>{process.exitCode=1;},now:()=>time,sleep:async()=>{time+=1000;}});
    await expect(guard.stop(false)).rejects.toThrow('did not terminate within bound');
    expect(time).toBe(5000);
  });
  it('does not mistake an unrelated reused descendant PID for an owned survivor',async()=>{
    const process=child();let reads=0;
    const guard=createOwnedProcessGuard(process,{platform:'win32',executable:binary,
      readWindowsTree:()=>++reads<=2?[root,descendant]:[{...descendant,created:'unrelated-start'}],
      taskkill:()=>{process.exitCode=1;}});
    await guard.stop(false);
  });
  it('escalates only its own POSIX group with a bounded final verification',async()=>{
    const process=child();let time=0,gone=false;
    const kill=vi.fn((_pid:number,signal:string|number)=>{
      expect(_pid).toBe(101);
      if(signal==='SIGKILL'){gone=true;process.signalCode='SIGKILL';}
      if(signal===0&&gone)throw Object.assign(new Error('absent'),{code:'ESRCH'});
    });
    const guard=createOwnedProcessGuard(process,{platform:'linux',killGroup:kill,now:()=>time,sleep:async()=>{time+=1000;}});
    await guard.stop(false);
    expect(kill.mock.calls.filter(([,signal])=>signal==='SIGTERM')).toHaveLength(1);
    expect(kill.mock.calls.filter(([,signal])=>signal==='SIGKILL')).toHaveLength(1);
    expect(time).toBe(6000);
  });
});
