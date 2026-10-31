/** Executed main-process fixtures only. Native adapters/HTTPS service evidence is separate. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {DataService,ExportJournal,governedRoots,loadShippedPolicy,readManifest} from '../src/main/data';
import {fixtureDataAuthority,PRINCIPAL} from './authorization-fixtures';
import {recordingLogger,removeTempDirs,tempDir} from './helpers';
import {TaskService} from '../src/main/tasks/service';
import {parseRouteEligibilityCheckRequest} from '../src/main/identity/wire';
afterAll(removeTempDirs);
function device(){
 const root=tempDir('authorization-device'),roots=governedRoots(root,path.join(root,'logs')),destination=path.join(tempDir('authorization-export'),'export');
 const file=path.join(root,'working','working.sqlite');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'FICTIONAL fixture INV-104 K12,480; INV-105 distinct');
 let allowed=true,principal=PRINCIPAL;const authority=fixtureDataAuthority({allowed:()=>allowed,principal:()=>principal});const runtime={stop:vi.fn(async()=>{}),start:vi.fn(async()=>{}),activeTasks:()=>0};
 const service=new DataService({authority,load:loadShippedPolicy(),roots,journal:new ExportJournal(root),runtime,identity:{principalId:()=>principal,principal:async()=>({displayName:'Fixture',issuerLabel:'Fixture'}),holdsSession:()=>false,signOut:async()=>({ok:true}),forgetLocally:()=>{}},providers:{forgetClaudeKey:()=>{},holdsClaudeKey:()=>false},chooseExportDestination:async()=>destination,chooseImportSource:async()=>destination,clearBrowserProfile:async()=>{},appVersion:'fixture',runtimeVersion:'fixture',logger:recordingLogger()});
 return{root,roots,file,destination,service,runtime,authority,revoke:()=>{allowed=false;},peer:()=>{principal='55555555-5555-4555-8555-555555555555';}};
}
describe('current-route authorization desktop negative suite (fixtures, not native proof)',()=>{
 it('permitted export, delete all including journal, and same-owner recovery use service-held receipt',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);const manifest=readManifest(d.destination);expect(manifest.provenance?.receiptId).toBeTruthy();
  expect((await d.service.deleteData(d.service.deletableCategories())).ok).toBe(true);expect(fs.existsSync(d.file)).toBe(false);expect(fs.existsSync(path.join(d.root,'data','export-journal.json'))).toBe(false);
  expect((await d.service.importData()).ok).toBe(true);expect(fs.readFileSync(d.file,'utf8')).toContain('INV-104');expect(fs.existsSync(path.join(d.root,'data','recovery-unvalidated'))).toBe(false);
 });
 it.each(['revocation','peer','receipt tamper'] as const)('%s denies recovery without reopening protected bytes',async mode=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);
  if(mode==='revocation')d.revoke();else if(mode==='peer')d.peer();else{const manifest=readManifest(d.destination);manifest.provenance!.receiptId='66666666-6666-4666-8666-666666666666';fs.writeFileSync(path.join(d.destination,'manifest.json'),JSON.stringify(manifest));}
  expect(await d.service.importData()).toMatchObject({ok:false});expect(fs.existsSync(d.file)).toBe(false);
 });
 it('native ownership uncertainty is not a successful empty export',async()=>{const d=device();d.authority.inspect=async()=>{throw new Error('unproven');};expect(await d.service.exportData()).toMatchObject({ok:false});expect(fs.existsSync(d.destination)).toBe(false);});
 it('revocation during slow export stops the next chunk and suppresses successful result',async()=>{const d=device();let n=0;const check=d.authority.check;d.authority.check=async(p,a)=>{if(++n===4)d.revoke();await check(p,a);};expect(await d.service.exportData()).toMatchObject({ok:false});expect(fs.existsSync(path.join(d.destination,'manifest.json'))).toBe(false);});
 it('late allowed authority cannot revive a newer main generation fence',async()=>{
  let resolve!:(v:never)=>void;let calls=0;const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:vi.fn()},identity:{principalId:()=>PRINCIPAL},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>++calls===1?await new Promise<never>(r=>{resolve=r;}):null});
  const pending=service.authority({workspaceId:PRINCIPAL});expect(await service.authority({workspaceId:PRINCIPAL})).toEqual({workspacePolicy:null});resolve({workspaceId:PRINCIPAL,policyRevision:1,authorizationEpoch:1} as never);expect(await pending).toEqual({workspacePolicy:null});
 });
 it('unknown evidence or input classification fields are rejected at the strict service wire',()=>{expect(()=>parseRouteEligibilityCheckRequest({identity:{route_id:'claude-subscription'},report_digest:'claimed',binding:{dataTier:'real'}},'')).toThrow();});
});

 it('interrupted recovery marker survives category deletion and failed restore until protected data is cleared',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);const marker=path.join(d.root,'data','recovery-unvalidated');fs.writeFileSync(marker,'unvalidated');
  expect((await d.service.importData()).ok).toBe(false);expect(fs.existsSync(marker)).toBe(true);d.runtime.start.mockClear();
  expect((await d.service.deleteData(['device-id'])).ok).toBe(false);expect(fs.existsSync(marker)).toBe(true);expect(d.runtime.start).not.toHaveBeenCalled();
  expect((await d.service.deleteData(['working-store','task-history','task-folders'])).ok).toBe(true);expect(fs.existsSync(marker)).toBe(false);
  expect((await d.service.importData()).ok).toBe(true);expect(fs.readFileSync(d.file,'utf8')).toContain('INV-104');
 });
 it('historical export paths are only disclosed to the same current owner after awaits',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);d.runtime.stop.mockImplementationOnce(async()=>d.peer());
  const result=await d.service.deleteData(['working-store']);expect(result).toMatchObject({ok:true,delete:{survivingExports:[],otherExportCopiesMayRemain:true}});expect(JSON.stringify(result)).not.toContain(d.destination);
 });
 it('same current owner can still find a surviving exported copy',async()=>{const d=device();expect((await d.service.exportData()).ok).toBe(true);expect(await d.service.deleteData(['working-store'])).toMatchObject({ok:true,delete:{survivingExports:[{path:d.destination}]}});});

 it('pins inspected recovery plan while immutable service receipt validation waits',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);
  let release!:()=>void,entered!:()=>void;const waiting=new Promise<void>(r=>{entered=r;});
  const validate=d.authority.validateReceipt;
  d.authority.validateReceipt=async(...args)=>{await validate(...args);entered();await new Promise<void>(r=>{release=r;});};
  const pending=d.service.importData();await waiting;
  const changed=readManifest(d.destination);const file=changed.included.find(e=>e.category==='working-store')!.files[0]!;
  file.path='working/alternate.sqlite';
  fs.writeFileSync(path.join(d.destination,'manifest.json'),JSON.stringify(changed));
  release();expect(await pending).toMatchObject({ok:false});
  expect(fs.existsSync(d.file)).toBe(false);expect(fs.existsSync(path.join(d.root,'working','alternate.sqlite'))).toBe(false);
 });
 it('does not adopt changed source bytes and matching substituted hashes during a receipt wait',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);
  const validate=d.authority.validateReceipt;
  d.authority.validateReceipt=async(...args)=>{await validate(...args);const m=readManifest(d.destination);const f=m.included.find(e=>e.category==='working-store')!.files[0]!;fs.writeFileSync(path.join(d.destination,'files',f.root,f.path),'OTHER OWNER');f.sha256=createHash('sha256').update('OTHER OWNER').digest('hex');f.size=11;fs.writeFileSync(path.join(d.destination,'manifest.json'),JSON.stringify(m));};
  expect(await d.service.importData()).toMatchObject({ok:false});expect(fs.existsSync(d.file)).toBe(false);
 });
 it.each([false,true])('withdrawal after publication quarantines exact attempted files (move failure=%s)',async failMove=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);d.runtime.start.mockClear();
  const check=d.authority.check;d.authority.check=async(p,a)=>{if(a==='recover'&&fs.existsSync(d.file))d.revoke();await check(p,a);};
  const rename=fs.renameSync.bind(fs);const spy=vi.spyOn(fs,'renameSync').mockImplementation((from,to)=>{if(failMove&&String(to).includes(`${path.sep}quarantine${path.sep}`))throw Object.assign(new Error('fixture move failure'),{code:'EIO'});rename(from,to);});
  try{
   expect(await d.service.importData()).toMatchObject({ok:false});
   expect(fs.existsSync(d.file)).toBe(failMove);
   expect(fs.existsSync(path.join(d.root,'data','recovery-unvalidated'))).toBe(failMove);
   if(failMove)expect(d.runtime.start).not.toHaveBeenCalled();else{expect(d.runtime.start).toHaveBeenCalledOnce();const q=path.join(d.root,'data','quarantine');expect(fs.readdirSync(q,{recursive:true}).some(v=>String(v).endsWith('working.sqlite'))).toBe(true);}
  }finally{spy.mockRestore();}
 });
 it.each([false,true])('revoked suppressed terminal activity requires actual native stop before Local Data (stop failure=%s)',async failStop=>{
  const d=device();const instance={};const input={workspaceId:PRINCIPAL,routeId:'codex-responses' as const,configurationRevision:1,operationId:PRINCIPAL,engagementId:null,folderId:null,request:'Fictional draft preserved',reasoning:'default',speed:'default'};
  const tasks=new TaskService({runtime:{ready:()=>true,instance:()=>instance,request:async()=>({operationId:PRINCIPAL,taskId:PRINCIPAL,runId:PRINCIPAL,threadId:PRINCIPAL,status:'running',request:input.request,accepted:true}) as never},identity:{principalId:()=>PRINCIPAL},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>({workspaceId:PRINCIPAL} as never)});
  await tasks.start(input);Object.assign(d.runtime,{activeTasks:()=>tasks.activeTasks(),canQuiesceUncertainActivity:()=>tasks.canQuiesceUncertainActivity()});
  expect((await d.service.deleteData(['working-store'])).ok).toBe(false);expect(d.runtime.stop).not.toHaveBeenCalled();
  tasks.invalidate();d.revoke();expect(tasks.activeTasks()).toBe(1);
  d.runtime.stop.mockImplementationOnce(async()=>{expect(tasks.activeTasks()).toBe(1);expect(fs.existsSync(d.file)).toBe(true);if(failStop)throw new Error('stop not proven');tasks.runtimeStopped(instance);});
  expect((await d.service.deleteData(['working-store'])).ok).toBe(!failStop);
  expect(tasks.activeTasks()).toBe(failStop?1:0);expect(fs.existsSync(d.file)).toBe(failStop);
  if(failStop)expect(d.runtime.start).not.toHaveBeenCalled();else expect(d.runtime.start).toHaveBeenCalledOnce();
 });

 it('revalidates the same service receipt after publication and quarantines a denied recovery',async()=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);
  const validate=d.authority.validateReceipt;let calls=0;const seen:Array<[string,string]>=[];
  d.authority.validateReceipt=async(...args)=>{seen.push([args[1],args[2]]);if(++calls===2){expect(fs.existsSync(d.file)).toBe(true);d.revoke();}await validate(...args);};
  expect(await d.service.importData()).toMatchObject({ok:false});expect(calls).toBe(2);expect(seen[1]).toEqual(seen[0]);
  expect(fs.existsSync(d.file)).toBe(false);expect(fs.existsSync(path.join(d.root,'data','recovery-unvalidated'))).toBe(false);
  expect(fs.readdirSync(path.join(d.root,'data','quarantine'),{recursive:true}).some(v=>String(v).endsWith('working.sqlite'))).toBe(true);
 });

 it.each(['skipped-family','replacement-family'] as const)('post-publication denial preserves %s and blocks ambiguous reopen',async mode=>{
  const d=device();expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store']);d.runtime.start.mockClear();
  const rename=fs.renameSync.bind(fs);let competed=false;
  const spy=vi.spyOn(fs,'renameSync').mockImplementation((from,to)=>{
   if(mode==='skipped-family'&&String(from).includes('.import-working-')){fs.mkdirSync(String(to),{recursive:true});fs.writeFileSync(path.join(String(to),'working.sqlite'),'COMPETING FAMILY');competed=true;}
   rename(from,to);
  });
  const check=d.authority.check;d.authority.check=async(p,a)=>{
   if(a==='recover'&&fs.existsSync(d.file)){
    if(mode==='replacement-family'&&!competed){rename(path.dirname(d.file),`${path.dirname(d.file)}.published-old`);fs.mkdirSync(path.dirname(d.file));fs.writeFileSync(d.file,'COMPETING FAMILY');competed=true;}
    d.revoke();
   }
   await check(p,a);
  };
  try{expect(await d.service.importData()).toMatchObject({ok:false});expect(competed).toBe(true);expect(fs.readFileSync(d.file,'utf8')).toBe('COMPETING FAMILY');expect(fs.existsSync(path.join(d.root,'data','recovery-unvalidated'))).toBe(mode==='replacement-family');if(mode==='replacement-family')expect(d.runtime.start).not.toHaveBeenCalled();else expect(d.runtime.start).toHaveBeenCalledOnce();}finally{spy.mockRestore();}
 });
 it('post-publication denial quarantines restored family but not a skipped competing ordinary file',async()=>{
  const d=device(),note=path.join(d.root,'tasks','fixture-task','output','note.txt');fs.mkdirSync(path.dirname(note),{recursive:true});fs.writeFileSync(note,'OWNED FIXTURE');
  expect((await d.service.exportData()).ok).toBe(true);await d.service.deleteData(['working-store','task-folders']);d.runtime.start.mockClear();
  const link=fs.linkSync.bind(fs);let competed=false;const spy=vi.spyOn(fs,'linkSync').mockImplementation((from,to)=>{if(String(to).endsWith('note.txt')){fs.writeFileSync(String(to),'COMPETITOR');competed=true;}link(from,to);});
  const check=d.authority.check;d.authority.check=async(p,a)=>{if(a==='recover'&&competed)d.revoke();await check(p,a);};
  try{expect(await d.service.importData()).toMatchObject({ok:false});expect(competed).toBe(true);expect(fs.readFileSync(note,'utf8')).toBe('COMPETITOR');expect(fs.existsSync(d.file)).toBe(false);expect(fs.existsSync(path.join(d.root,'data','recovery-unvalidated'))).toBe(false);expect(d.runtime.start).toHaveBeenCalledOnce();}finally{spy.mockRestore();}
 });
