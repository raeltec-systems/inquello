/** Production authority control with a fake native executable; not native provenance evidence. */
import fs from 'node:fs';
import path from 'node:path';
import {afterAll,describe,it,expect,vi} from 'vitest';
import {createDataAuthority,DataAuthorityError} from '../src/main/data/authority';
import type {SharedService} from '../src/main/identity/service-client';
import {governedRoots} from '../src/main/data';
import {fixtureDataAuthority,PRINCIPAL,WORKSPACE,TASK} from './authorization-fixtures';
import {tempDir,removeTempDirs} from './helpers';
afterAll(removeTempDirs);
async function setup(tier='not-applicable'){
 const root=tempDir('native-inspector-stand-in'),roots=governedRoots(root,path.join(root,'logs'));
 const session=(await fixtureDataAuthority().inspect(roots)).session;
 const inventory={version:1,available:true,files:[],workspaces:[{workspace_id:WORKSPACE,tasks:[{task_id:TASK,provenance_kind:'draft_metadata',data_tier:tier,route_identity:null,report_digest:null,processing_scope:null,data_policy_digest:null}]}]};
 const executable=path.join(root,'inspector');fs.writeFileSync(executable,`#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(inventory))});\n`,{mode:0o700});
 let allowed=true;
 const access=vi.fn(async()=>{if(!allowed)throw new Error('unavailable');return{decision:'allowed',authorization_epoch:'1'};});
 const service={session:async()=>session,executionPolicy:async()=>({workspace_id:WORKSPACE,authorization_epoch:'1',policy_revision:'1'}),workspaceAccess:access} as unknown as SharedService;
 const authority=createDataAuthority({identity:{principalId:()=>PRINCIPAL,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>fn('fictional-test-access')},service,binary:()=>executable,env:()=>process.env,storeName:'working.sqlite'});
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
 const route={route_id:'codex-responses' as const,deployment:'fixture',endpoint:'https://fixture.invalid/responses',model:'fixture-model',api_version:'v1',configuration_digest:'1'.repeat(64),implementation_digest:'2'.repeat(64),runtime_version:'fixture',contract_version:'1',platform:'linux'};
 const task={task_id:TASK,provenance_kind:'task_content',data_tier:'real',route_identity:route,report_digest:'3'.repeat(64),processing_scope:'fictional-scope',data_policy_digest:'4'.repeat(64)};
 const inventory={version:1,available:true,files:[],workspaces:[{workspace_id:WORKSPACE,tasks:[task]}]};
 const executable=path.join(root,'inspector');fs.writeFileSync(executable,`#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(inventory))});\n`,{mode:0o700});
 let epoch='1';const approval={workspace_id:WORKSPACE,route_id:route.route_id,evidence_digest:task.report_digest,processing_scope:task.processing_scope,data_policy_digest:task.data_policy_digest,issuer:'fixture',operator_reference:'fixture-only',valid_from:0,expires_at:9999999999,review_at:9999999999,revision:'1',policy_revision:'1',revoked:false};
 const access=vi.fn(async()=>({decision:'allowed',authorization_epoch:epoch}));
 const routeApproval=vi.fn(async()=>({approval,authorization_epoch:epoch,policy_revision:'1'}));
 const routeCheck=vi.fn(async(_credential:string,_workspace:string,request:import('../src/main/identity/wire').RouteEligibilityCheckRequest)=>({authority:{binding:request.binding,approval,checked_at:1}}));
 const service={session:async()=>session,executionPolicy:async()=>({workspace_id:WORKSPACE,authorization_epoch:epoch,policy_revision:'1'}),workspaceAccess:access,routeApproval,routeEligibilityCheck:routeCheck} as unknown as SharedService;
 const authority=createDataAuthority({identity:{principalId:()=>PRINCIPAL,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>fn('fixture-access')},service,binary:()=>executable,env:()=>process.env,storeName:'working.sqlite'});
 return{authority,roots,session,route,task,approval,access,routeApproval,routeCheck,epoch:(value:string)=>{epoch=value;}};
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
  if(mode==='approval-missing')d.routeApproval.mockResolvedValueOnce({approval:null} as never);
  if(mode==='approval-epoch-mismatch')d.routeApproval.mockResolvedValueOnce({approval:d.approval,authorization_epoch:'2',policy_revision:'1'});
  if(mode==='check-rejected')d.routeCheck.mockRejectedValueOnce(new Error('revoked'));
  if(mode==='binding-mismatch')d.routeCheck.mockImplementationOnce(async(_c,_w,r)=>({authority:{binding:{...r.binding,action:'read'},approval:d.approval,checked_at:1}}));
  await expect(d.authority.check(p,'export')).rejects.toBeInstanceOf(DataAuthorityError);
  if(mode.startsWith('approval-'))expect(d.routeCheck).not.toHaveBeenCalled();else expect(d.routeCheck).toHaveBeenCalledOnce();
  await expect(d.authority.check(p,'export')).rejects.toBeInstanceOf(DataAuthorityError);
 });
 it('a delayed real-route allowed response cannot revive an older Workspace epoch',async()=>{
  const d=await realContent(),p=await d.authority.inspect(d.roots);let release!:(value:Awaited<ReturnType<typeof d.routeCheck>>)=>void;
  d.routeCheck.mockImplementationOnce(async()=>new Promise(resolve=>{release=resolve;}));
  const older=d.authority.check(p,'export');await vi.waitFor(()=>expect(d.routeCheck).toHaveBeenCalledOnce());
  const request=d.routeCheck.mock.calls[0]![2];d.epoch('2');await d.authority.check(p,'export');
  release({authority:{binding:request.binding,approval:d.approval,checked_at:1}});
  await expect(older).rejects.toBeInstanceOf(DataAuthorityError);
 });
});
