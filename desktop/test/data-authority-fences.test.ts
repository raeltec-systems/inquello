/** Production authority control with a stubbed native inspector; not native provenance evidence. */
import path from 'node:path';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {createDataAuthority,DataAuthorityError} from '../src/main/data/authority';
import type {SharedService} from '../src/main/identity/service-client';
import {parseRouteApprovalView,parseRouteEligibilityCheckRequest,parseRouteEligibilityCheckResponse,parseExportProvenanceReceipt} from '../src/main/identity/wire';
import {DataService,ExportJournal,governedRoots,loadShippedPolicy} from '../src/main/data';
import {fixtureDataAuthority,PRINCIPAL,WORKSPACE,TASK} from './authorization-fixtures';
import {tempDir,removeTempDirs,recordingLogger} from './helpers';
import {inspectNative} from '../src/main/runtime/data-inspector';
vi.mock('../src/main/runtime/data-inspector',async importOriginal=>({...await importOriginal<typeof import('../src/main/runtime/data-inspector')>(),inspectNative:vi.fn()}));
afterAll(removeTempDirs);
async function setup(tier='not-applicable'){
 const root=tempDir('native-inspector-stand-in'),roots=governedRoots(root,path.join(root,'logs'));
 const session=(await fixtureDataAuthority().inspect(roots)).session;
 const inventory={version:1,available:true,files:[],workspaces:[{workspace_id:WORKSPACE,tasks:[{task_id:TASK,provenance_kind:'draft_metadata',data_tier:tier,route_identity:null,report_digest:null,processing_scope:null,data_policy_digest:null}]}]};
 vi.mocked(inspectNative).mockResolvedValue(inventory);
 let allowed=true;
 const access=vi.fn(async()=>{if(!allowed)throw new Error('unavailable');return{decision:'allowed',authorization_epoch:'1'};});
 const service={session:async()=>session,executionPolicy:async()=>({workspace_id:WORKSPACE,authorization_epoch:'1',policy_revision:'1'}),workspaceAccess:access} as unknown as SharedService;
 const authority=createDataAuthority({identity:{principalId:()=>PRINCIPAL,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>fn('fictional-test-access')},service,binary:()=>process.execPath,env:()=>process.env,storeName:'working.sqlite'});
 return{roots,authority,access,allow:(value:boolean)=>{allowed=value;}};
}
describe('production main provenance and generation fences',()=>{
 it('native draft metadata permits current export without claiming an inference tier',async()=>{const d=await setup();const p=await d.authority.inspect(d.roots);expect(p.workspaces[0]?.tasks[0]?.data_tier).toBe('not-applicable');await d.authority.check(p,'export');expect(d.access).toHaveBeenCalledWith('fictional-test-access',WORKSPACE,'export');});
 it('a failed check permanently fences that inspection even if access later returns',async()=>{const d=await setup();const p=await d.authority.inspect(d.roots);await d.authority.check(p,'recover');d.allow(false);await expect(d.authority.check(p,'recover')).rejects.toBeInstanceOf(DataAuthorityError);d.allow(true);await expect(d.authority.check(p,'recover')).rejects.toBeInstanceOf(DataAuthorityError);const fresh=await d.authority.inspect(d.roots);await d.authority.check(fresh,'recover');});
 it.each(['synthetic','real'])('draft provenance cannot assert %s inference classification',async tier=>{const d=await setup(tier);await expect(d.authority.inspect(d.roots)).rejects.toBeInstanceOf(DataAuthorityError);});
});

/** Real-content branch of production DataAuthority; inspector and HTTPS are fixtures. */
async function realContent(){
 const root=tempDir('real-content-authority-fixture'),roots=governedRoots(root,path.join(root,'logs'));
 const session=(await fixtureDataAuthority().inspect(roots)).session;
 const route={schema_version:2,route_id:'codex-responses' as const,deployment:'fixture',endpoint:'https://fixture.invalid/responses',model:'fixture-model',api_version:'v1',adapter_configuration_digest:'1'.repeat(64),implementation_digest:'2'.repeat(64),runtime_version:'fixture',contract_version:'1',platform:'linux'};
 const task={task_id:TASK,provenance_kind:'task_content',data_tier:'real',route_identity:route,report_digest:'3'.repeat(64),processing_scope:'fictional-scope',data_policy_digest:'4'.repeat(64)};
 const inventory={version:1,available:true,files:[],workspaces:[{workspace_id:WORKSPACE,tasks:[task]}]};
 vi.mocked(inspectNative).mockResolvedValue(inventory);
 let epoch='1';const approval={workspace_id:WORKSPACE,route_id:route.route_id,evidence_digest:task.report_digest,processing_scope:task.processing_scope,data_policy_digest:task.data_policy_digest,issuer:'fixture',operator_reference:'fixture-only',valid_from:0,expires_at:9999999999,review_at:9999999999,revision:'1',policy_revision:'1',revoked:false};
 const access=vi.fn(async()=>({decision:'allowed',authorization_epoch:epoch}));
 const routeApproval=vi.fn(async()=>parseRouteApprovalView({approval,authorization_epoch:epoch,policy_revision:'1'},'body'));
 const routeCheck=vi.fn(async(_credential:string,_workspace:string,request:import('../src/main/identity/wire').RouteEligibilityCheckRequest)=>parseRouteEligibilityCheckResponse({authority:{binding:parseRouteEligibilityCheckRequest(request,'request').binding,approval,checked_at:1}},'body'));
 const service={session:async()=>session,executionPolicy:async()=>({workspace_id:WORKSPACE,authorization_epoch:epoch,policy_revision:'1'}),workspaceAccess:access,routeApproval,routeEligibilityCheck:routeCheck} as unknown as SharedService;
 const authority=createDataAuthority({identity:{principalId:()=>PRINCIPAL,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>fn('fixture-access')},service,binary:()=>process.execPath,env:()=>process.env,storeName:'working.sqlite'});
 return{authority,roots,session,route,task,approval,access,routeApproval,routeCheck,service,inventory,epoch:(value:string)=>{epoch=value;}};
}
describe('production DataAuthority real task_content gate (fixture endpoints, not native evidence)',()=>{
 it.each(['export','recover'] as const)('allowed %s requires exact route approval and operation-bound service check',async action=>{
  const d=await realContent(),p=await d.authority.inspect(d.roots);await d.authority.check(p,action);
  expect(d.routeApproval).toHaveBeenCalledExactlyOnceWith('fixture-access',WORKSPACE,'codex-responses');
  expect(d.access).toHaveBeenCalledExactlyOnceWith('fixture-access',WORKSPACE,action==='export'?'export':'read');
  expect(d.routeCheck).toHaveBeenCalledOnce();const [credential,workspace,request]=d.routeCheck.mock.calls[0]!;
  expect(credential).toBe('fixture-access');expect(workspace).toBe(WORKSPACE);
  expect(request).toEqual({identity:d.route,report_digest:d.task.report_digest,binding:{action:action==='export'?'export':'read',principal_id:PRINCIPAL,session_id:d.session.session_id,task_id:TASK,workspace_id:WORKSPACE,operation_id:expect.stringMatching(/^[0-9a-f-]{36}$/),generation:1,principal_revision:'1',session_revision:'1',authorization_epoch:'1',policy_revision:'1',approval_revision:'1',processing_scope:d.task.processing_scope,data_policy_digest:d.task.data_policy_digest}});
 });
 it.each(['approval-rejected','approval-missing','approval-epoch-mismatch','check-rejected','binding-mismatch'] as const)('%s denies real-content export',async mode=>{
  const d=await realContent(),p=await d.authority.inspect(d.roots);
  if(mode==='approval-rejected')d.routeApproval.mockRejectedValueOnce(new Error('revoked'));
  if(mode==='approval-missing')d.routeApproval.mockResolvedValueOnce(parseRouteApprovalView({approval:null,authorization_epoch:'1',policy_revision:'1'},'body'));
  if(mode==='approval-epoch-mismatch')d.routeApproval.mockResolvedValueOnce(parseRouteApprovalView({approval:d.approval,authorization_epoch:'2',policy_revision:'1'},'body'));
  if(mode==='check-rejected')d.routeCheck.mockRejectedValueOnce(new Error('revoked'));
  if(mode==='binding-mismatch')d.routeCheck.mockImplementationOnce(async(_c,_w,r)=>parseRouteEligibilityCheckResponse({authority:{binding:{...r.binding,action:'read'},approval:d.approval,checked_at:1}},'body'));
  await expect(d.authority.check(p,'export')).rejects.toBeInstanceOf(DataAuthorityError);
  if(mode.startsWith('approval-'))expect(d.routeCheck).not.toHaveBeenCalled();else expect(d.routeCheck).toHaveBeenCalledOnce();
  await expect(d.authority.check(p,'export')).rejects.toBeInstanceOf(DataAuthorityError);
 });
 it('a delayed real-route allowed response cannot revive an older Workspace epoch',async()=>{
  const d=await realContent(),p=await d.authority.inspect(d.roots);let release!:(value:Awaited<ReturnType<typeof d.routeCheck>>)=>void;
  d.routeCheck.mockImplementationOnce(async()=>new Promise(resolve=>{release=resolve;}));
  const older=d.authority.check(p,'export');await vi.waitFor(()=>expect(d.routeCheck).toHaveBeenCalledOnce());
  const request=d.routeCheck.mock.calls[0]![2];d.epoch('2');await d.authority.check(p,'export');
  release(parseRouteEligibilityCheckResponse({authority:{binding:request.binding,approval:d.approval,checked_at:1}},'body'));
  await expect(older).rejects.toBeInstanceOf(DataAuthorityError);
 });
});

/** Actual DataService filesystem effects composed with production real-content
 * authority. Only native inspection and shared-service responses are fixtures;
 * this is not cross-process native/HTTPS or live-provider qualification. */
async function realContentFiles(){
 const d=await realContent(),root=d.roots['user-data'];
 const relative=path.join(TASK,'output','evidence.txt'),file=path.join(root,'tasks',relative);
 const bytes=Buffer.from('Owned fictional procurement evidence, byte-exact recovery.\n');
 fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
 vi.mocked(inspectNative).mockImplementation(async(_binary,_env,input)=>{
  const taskRoot=(input as {task_root:string}).task_root;
  const inspected=path.join(taskRoot,relative),present=fs.existsSync(inspected);
  return{...d.inventory,files:present?[{path:inspected,sha256:createHash('sha256').update(fs.readFileSync(inspected)).digest('hex'),size:fs.statSync(inspected).size,category:'task-folders'}]:[]};
 });
 type Receipt=import('../src/main/identity/wire').ExportProvenanceReceipt;
 const receipts=new Map<string,Receipt>();
 const createReceipt=vi.fn(async(_access:string,request:{manifest_digest:string;workspace_ids:string[]})=>{
  const receipt=parseExportProvenanceReceipt({receipt_id:randomUUID(),principal_id:PRINCIPAL,manifest_digest:request.manifest_digest,workspace_ids:request.workspace_ids},'body');
  receipts.set(receipt.receipt_id,receipt);return receipt;
 });
 const validateReceipt=vi.fn(async(_access:string,id:string,digest:string)=>{
  const receipt=receipts.get(id);if(!receipt||receipt.manifest_digest!==digest)throw new Error('Unknown receipt');return parseExportProvenanceReceipt(receipt,'body');
 });
 Object.assign(d.service,{capabilities:async()=>({command_epoch:'1'}),createExportReceipt:createReceipt,validateExportReceipt:validateReceipt});
 const destination=path.join(tempDir('composed-real-content-export'),'export');
 const events:string[]=[];
 const data=new DataService({
  authority:d.authority,load:loadShippedPolicy(),roots:d.roots,journal:new ExportJournal(root),
  runtime:{stop:async()=>{events.push('stop');},start:async()=>{events.push('start');},activeTasks:()=>0},
  identity:{principalId:()=>PRINCIPAL,principal:async()=>null,holdsSession:()=>false,signOut:async()=>({ok:true}),forgetLocally:()=>{}},
  providers:{forgetClaudeKey:()=>{},holdsClaudeKey:()=>false},chooseExportDestination:async()=>destination,chooseImportSource:async()=>destination,
  clearBrowserProfile:async()=>{},appVersion:'fixture',runtimeVersion:'fixture',logger:recordingLogger(),
 });
 return{...d,data,file,bytes,destination,events,createReceipt,validateReceipt};
}
describe('composed production real-content authority and owned filesystem effects',()=>{
 it('exports, deletes and recovers exact bytes with independently bound service receipt checks',async()=>{
  const d=await realContentFiles();const exported=await d.data.exportData();if(!exported.ok)throw new Error(exported.reason);
  expect(d.createReceipt).toHaveBeenCalledOnce();
  expect(d.createReceipt.mock.calls[0]![1]).toMatchObject({manifest_digest:expect.stringMatching(/^[a-f0-9]{64}$/),workspace_ids:[WORKSPACE]});
  expect((await d.data.deleteData(['task-folders'])).ok).toBe(true);expect(fs.existsSync(d.file)).toBe(false);
  const restored=await d.data.importData();if(!restored.ok)throw new Error(restored.reason);
  expect(fs.readFileSync(d.file)).toEqual(d.bytes);expect(d.validateReceipt).toHaveBeenCalled();
  const checks=d.routeCheck.mock.calls.map(call=>call[2]);
  expect(checks.some(r=>r.binding.action==='export')).toBe(true);expect(checks.some(r=>r.binding.action==='read')).toBe(true);
  expect(new Set(checks.map(r=>r.binding.operation_id)).size).toBe(checks.length);
  for(const r of checks){expect(r.identity).toEqual(d.route);expect(r.report_digest).toBe(d.task.report_digest);expect(r.binding).toMatchObject({principal_id:PRINCIPAL,task_id:TASK,workspace_id:WORKSPACE});}
  expect(d.events).toEqual(['stop','start','stop','start','stop','start']);
 });
 it('withdrawal while export receipt is pending prevents publication without deleting source bytes',async()=>{
  const d=await realContentFiles();let release!:(r:Awaited<ReturnType<typeof d.createReceipt>>)=>void;
  d.createReceipt.mockImplementationOnce(async()=>new Promise(resolve=>{release=resolve;}));
  const pending=d.data.exportData();await vi.waitFor(()=>expect(d.createReceipt).toHaveBeenCalledOnce());
  const request=d.createReceipt.mock.calls[0]![1];d.routeCheck.mockRejectedValue(new Error('Organization approval withdrawn'));
  release(parseExportProvenanceReceipt({receipt_id:randomUUID(),principal_id:PRINCIPAL,manifest_digest:request.manifest_digest,workspace_ids:[WORKSPACE]},'body'));
  expect((await pending).ok).toBe(false);expect(fs.existsSync(d.destination)).toBe(false);expect(fs.readFileSync(d.file)).toEqual(d.bytes);
 });
 it('withdrawal after recovery receipt wait cannot publish any restored family',async()=>{
  const d=await realContentFiles();const exported=await d.data.exportData();if(!exported.ok)throw new Error(exported.reason);
  expect((await d.data.deleteData(['task-folders'])).ok).toBe(true);
  const receipt=d.createReceipt.mock.results[0]!.value;let release!:(r:Awaited<typeof receipt>)=>void;
  d.validateReceipt.mockImplementationOnce(async()=>new Promise(resolve=>{release=resolve;}));
  const pending=d.data.importData();await vi.waitFor(()=>expect(d.validateReceipt).toHaveBeenCalledOnce());
  d.routeCheck.mockRejectedValue(new Error('Organization approval withdrawn'));release(await receipt);
  expect((await pending).ok).toBe(false);expect(fs.existsSync(d.file)).toBe(false);expect(fs.existsSync(d.destination)).toBe(true);
 });
});
