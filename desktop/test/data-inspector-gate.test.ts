/** Portable actual child-event seam; no production authority or executable override. */
import {EventEmitter} from 'node:events';
import path from 'node:path';
import {afterAll,afterEach,expect,it,vi} from 'vitest';
const seam=vi.hoisted(()=>({spawn:vi.fn()}));
vi.mock('node:child_process',async original=>({...await original<typeof import('node:child_process')>(),spawn:seam.spawn}));
import {inspectNative,inspectorsQuiescent} from '../src/main/runtime/data-inspector';
import {DataService,ExportJournal,governedRoots,loadShippedPolicy} from '../src/main/data';
import {fixtureDataAuthority,PRINCIPAL} from './authorization-fixtures';
import {recordingLogger,removeTempDirs,tempDir} from './helpers';
afterAll(removeTempDirs);afterEach(()=>{vi.useRealTimers();seam.spawn.mockReset();});
function child(){const process=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),kill:vi.fn(()=>true)});seam.spawn.mockReturnValueOnce(process);return process;}
it('decodes a multibyte path split across actual stdout data events',async()=>{
 const c=child(),value={path:'/owned/é/审计.txt'};const bytes=Buffer.from(JSON.stringify(value));const split=bytes.indexOf(Buffer.from('é'))+1;
 const pending=inspectNative('fixed-binary',{},{});c.stdout.emit('data',bytes.subarray(0,split));c.stdout.emit('data',bytes.subarray(split));c.emit('close',0);
 await expect(pending).resolves.toEqual(value);expect(inspectorsQuiescent()).toBe(true);
});
it('unconfirmed close rejects boundedly and DataService cannot restart until actual late close',async()=>{
 vi.useFakeTimers();const c=child(),root=tempDir('inspector-gate'),roots=governedRoots(root,path.join(root,'logs'));
 const authority=fixtureDataAuthority();authority.inspect=async()=>{await inspectNative('fixed-binary',{}, {},{timeoutMs:10,terminateMs:10,closeMs:10,maxBytes:1024});throw new Error('not reached');};
 const runtime={stop:vi.fn(async()=>{}),start:vi.fn(async()=>{}),activeTasks:()=>0};
 const service=new DataService({authority,load:loadShippedPolicy(),roots,journal:new ExportJournal(root),runtime,identity:{principalId:()=>PRINCIPAL,principal:async()=>({displayName:'Fixture',issuerLabel:'Fixture'}),holdsSession:()=>false,signOut:async()=>({ok:true}),forgetLocally:()=>{}},providers:{forgetClaudeKey:()=>{},holdsClaudeKey:()=>false},chooseExportDestination:async()=>path.join(root,'export'),chooseImportSource:async()=>null,clearBrowserProfile:async()=>{},appVersion:'fixture',runtimeVersion:'fixture',logger:recordingLogger()});
 const pending=service.exportData();await vi.advanceTimersByTimeAsync(31);
 expect(await pending).toMatchObject({ok:false,reason:expect.stringContaining('inspector exit')});expect(c.kill.mock.calls).toEqual([['SIGTERM'],['SIGKILL']]);expect(inspectorsQuiescent()).toBe(false);expect(runtime.start).not.toHaveBeenCalled();
 expect(await service.deleteData(['working-store'])).toMatchObject({ok:false});expect(runtime.start).not.toHaveBeenCalled();
 c.emit('close',null);expect(inspectorsQuiescent()).toBe(true);
 expect(await service.deleteData(['working-store'])).toMatchObject({ok:true});expect(runtime.start).toHaveBeenCalledOnce();
});
