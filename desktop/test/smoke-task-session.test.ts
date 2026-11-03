import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {smokeTaskSession} from '../src/main/tasks/smoke-session';
import type {RouteView} from '../src/main/routes/types';
const principal='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const dirs:string[]=[];afterEach(()=>{for(const dir of dirs.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
function setup({packaged=false,enabled=true,allowQuotaRoute=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'inquello-smoke-session-'));dirs.push(root);
 const seedFile=path.join(root,'seed.json');fs.writeFileSync(seedFile,JSON.stringify({workspace_id:workspace,invite_id:other,workspace_name:'Synthetic'}));
 fs.writeFileSync(path.join(root,'.inquello-fictional-audit-session'),'explicit synthetic only');
 let owner:string|null=principal,runtimeInstance=1;
 const request=vi.fn(async(_method:string,_params?:unknown)=>({accepted:true}));
 const env:NodeJS.ProcessEnv={};
 const session=smokeTaskSession({env,packaged,enabled,allowQuotaRoute,userData:root,seedFile,runtime:{ready:()=>true,instance:()=>runtimeInstance,request:request as never},identity:{principalId:()=>owner},currentSession:async()=>{throw new Error('Must never fall back to real session');}});
 return{root,seedFile,request,env,session,setOwner:(value:string|null)=>{owner=value;},restartRuntime:()=>{runtimeInstance++;}};
}
describe('owned dedicated smoke bootstrap',()=>{
 it('refuses before explicit authenticated arm, then reuses exact synthetic tuple without global environment mutation',async()=>{
  const x=setup();await expect(x.session.bootstrap(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
  await x.session.arm(workspace);await x.session.bootstrap(workspace);await x.session.bootstrap(workspace,{recoveryOnly:true});
  expect(x.request).toHaveBeenCalledTimes(3);expect(x.request.mock.calls[0]?.[1]).toEqual({workspaceId:workspace,isolatedRoot:fs.realpathSync(x.root)});
  expect(x.request.mock.calls[2]?.[1]).toEqual({workspaceId:workspace,isolatedRoot:fs.realpathSync(x.root),recoveryOnly:true});
  expect(x.env.INQUELLO_FICTIONAL_AUDIT_SESSION).toBeUndefined();
 });
 it.each([{packaged:true},{enabled:false}])('cannot arm outside dedicated unpackaged smoke: %j',async config=>{
  const x=setup(config);await expect(x.session.arm(workspace)).rejects.toThrow();await expect(x.session.bootstrap(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
 });
 it('refuses malformed seed, foreign Workspace and absent identity',async()=>{
  const x=setup();await expect(x.session.arm(other)).rejects.toThrow();x.setOwner(null);await expect(x.session.arm(workspace)).rejects.toThrow();x.setOwner(principal);
  fs.writeFileSync(x.seedFile,JSON.stringify({workspace_id:workspace,invite_id:other,isolatedRoot:x.root}));await expect(x.session.arm(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
 });
 it('does not rearm or disclose after principal changes',async()=>{
  const x=setup();await x.session.arm(workspace);x.setOwner(other);await expect(x.session.bootstrap(workspace)).rejects.toThrow();await expect(x.session.arm(workspace)).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
 it('requires the marker at the actual owned profile, not a seed path',async()=>{
  const x=setup();fs.unlinkSync(path.join(x.root,'.inquello-fictional-audit-session'));await expect(x.session.arm(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
 });
 it('refuses an oversized seed before parsing or native dispatch',async()=>{
  const x=setup();fs.writeFileSync(x.seedFile,JSON.stringify({workspace_id:workspace,invite_id:other,workspace_name:'x'.repeat(8192)}));
  await expect(x.session.arm(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
 });
 it.each(['seed','marker'] as const)('refuses a symlink %s even when its target is a valid owned file',async kind=>{
  const x=setup(),file=kind==='seed'?x.seedFile:path.join(x.root,'.inquello-fictional-audit-session'),target=path.join(x.root,kind+'-target');
  fs.renameSync(file,target);fs.symlinkSync(target,file,'file');
  await expect(x.session.arm(workspace)).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
 });
 it.each(['identity','runtime'] as const)('rejects a successful native response after %s changed during arm',async kind=>{
  const x=setup();let resolve!:(value:{accepted:boolean})=>void;
  x.request.mockImplementationOnce(async()=>new Promise<{accepted:boolean}>(done=>{resolve=done;}));
  const pending=x.session.arm(workspace),rejected=expect(pending).rejects.toThrow();
  expect(x.request).toHaveBeenCalledTimes(1);
  if(kind==='identity')x.setOwner(other);else x.restartRuntime();
  resolve({accepted:true});await rejected;
  expect(x.request).toHaveBeenCalledTimes(1);
 });
 it.each(['identity','runtime'] as const)('rejects late successful %s changes during an already armed recovery read',async kind=>{
  const x=setup();await x.session.arm(workspace);let resolve!:(value:{accepted:boolean})=>void;
  x.request.mockImplementationOnce(async()=>new Promise<{accepted:boolean}>(done=>{resolve=done;}));
  const pending=x.session.bootstrap(workspace,{recoveryOnly:true}),rejected=expect(pending).rejects.toThrow();
  expect(x.request).toHaveBeenCalledTimes(2);
  if(kind==='identity')x.setOwner(other);else x.restartRuntime();
  resolve({accepted:true});await rejected;expect(x.request).toHaveBeenCalledTimes(2);
 });
 it('does not convert a refused native bootstrap into success',async()=>{
  const x=setup();x.request.mockResolvedValue({accepted:false});await expect(x.session.arm(workspace)).rejects.toThrow();
 });
});

describe('native verified smoke route binding',()=>{
 const route=():RouteView=>({routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:principal,region:null},endpoint:null,revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'local',inferenceFlow:'synthetic',connectorFlow:'none'});
 it('requires an armed session and sends only exact scope and configuration revision',async()=>{
  const x=setup();await expect(x.session.verifyRoute(route())).rejects.toThrow();expect(x.request).not.toHaveBeenCalled();
  await x.session.arm(workspace);await x.session.verifyRoute(route());
  expect(x.request).toHaveBeenLastCalledWith('inquello/fixture/taskTransportStatus',{workspaceId:workspace,routeId:'claude-api-key',configurationRevision:1});
 });
 it.each(['account','route','runtime','identity'] as const)('rejects changed %s ownership before native verification',async kind=>{
  const x=setup();await x.session.arm(workspace);const value=route();
  if(kind==='account')value.configuration!.accountRef=other;else if(kind==='route'){value.routeId='codex-responses';value.configuration!.routeId='codex-responses';}else if(kind==='runtime')x.restartRuntime();else x.setOwner(other);
  await expect(x.session.verifyRoute(value)).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
 it.each(['identity','runtime'] as const)('rejects stale native fixture acceptance after %s changes',async kind=>{
  const x=setup();await x.session.arm(workspace);let release!:(value:{accepted:boolean})=>void;
  x.request.mockImplementationOnce(async()=>new Promise<{accepted:boolean}>(done=>{release=done;}));
  const pending=x.session.verifyRoute(route()),rejected=expect(pending).rejects.toThrow();
  if(kind==='identity')x.setOwner(other);else x.restartRuntime();release({accepted:true});await rejected;
 });
 it('rejects a native acceptance carrying unexpected authority fields',async()=>{
  const x=setup();await x.session.arm(workspace);x.request.mockImplementationOnce(async()=>({accepted:true,unexpected:true}));
  await expect(x.session.verifyRoute(route())).rejects.toThrow();
 });
 it('refuses a native denial and never substitutes a main asserted verdict',async()=>{
  const x=setup();await x.session.arm(workspace);x.request.mockResolvedValue({accepted:false});
  await expect(x.session.verifyRoute(route())).rejects.toThrow();
 });
});

describe('dedicated quota-only ordinary reader proof',()=>{
 const quota=():RouteView=>({routeId:'codex-responses',provider:'Codex',configurable:true,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'fixture-model-20261030',apiVersion:'responses-v1',accountRef:principal,region:null},endpoint:null,revision:1,credentialPresent:true,adapterSupported:true,verification:'not_verified',enabled:false,gate:'Synthetic fixture only',limits:[],evidence:[],executionFlow:'local',inferenceFlow:'synthetic',connectorFlow:'none'});
 it('does not admit quota configuration in visual or ordinary profile',async()=>{
  const x=setup();await x.session.arm(workspace);await expect(x.session.verifyRoute(quota())).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
 it('leaves credential-absent disabled configurations unbound without native admission',async()=>{
  const x=setup({allowQuotaRoute:true});await x.session.arm(workspace);const route={...quota(),credentialPresent:false};await x.session.verifyRoute(route);expect(x.request).toHaveBeenCalledTimes(1);
  await expect(x.session.verifyRoute({...route,enabled:true})).rejects.toThrow();
 });
 it('requires current native proof for a present quota fixture credential',async()=>{
  const x=setup({allowQuotaRoute:true});await x.session.arm(workspace);await x.session.verifyRoute(quota());
  expect(x.request).toHaveBeenLastCalledWith('inquello/fixture/taskTransportStatus',{workspaceId:workspace,routeId:'codex-responses',configurationRevision:1});
  x.request.mockResolvedValueOnce({accepted:false});await expect(x.session.verifyRoute(quota())).rejects.toThrow();
 });
 it.each(['model','deployment','apiVersion','accountRef','region'] as const)('rejects another quota %s before native proof',async key=>{
  const x=setup({allowQuotaRoute:true});await x.session.arm(workspace);const route=quota();(route.configuration as unknown as Record<string,unknown>)[key]=key==='accountRef'?other:'other';
  await expect(x.session.verifyRoute(route)).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
 it.each(['identity','runtime'] as const)('rejects quota proof after %s changes during await',async kind=>{
  const x=setup({allowQuotaRoute:true});await x.session.arm(workspace);let done!:(value:{accepted:boolean})=>void;
  x.request.mockImplementationOnce(async()=>new Promise(resolve=>{done=resolve;}));const pending=x.session.verifyRoute(quota()),rejected=expect(pending).rejects.toThrow();
  if(kind==='identity')x.setOwner(other);else x.restartRuntime();done({accepted:true});await rejected;
 });
});

describe('owned same-provider Responses model witnesses',()=>{
 const responses=(model:string,revision:number):RouteView=>({routeId:'codex-responses',provider:'OpenAI',configurable:true,configuration:{routeId:'codex-responses',deployment:'openai-api',model,apiVersion:'responses-v1',accountRef:principal,region:null},endpoint:null,revision,credentialPresent:true,adapterSupported:true,verification:'not_verified',enabled:false,gate:'Owned native fixture proof required',limits:[],evidence:[],executionFlow:'local',inferenceFlow:'synthetic',connectorFlow:'none'});
 it('requires exact native proof for both bundled Terra and Sol choices',async()=>{
  const x=setup();await x.session.arm(workspace);await x.session.verifyRoute(responses('gpt-6.1-terra',1));await x.session.verifyRoute(responses('gpt-6.1-sol',2));
  expect(x.request).toHaveBeenLastCalledWith('inquello/fixture/taskTransportStatus',{workspaceId:workspace,routeId:'codex-responses',configurationRevision:2});
  x.request.mockResolvedValueOnce({accepted:false});await expect(x.session.verifyRoute(responses('gpt-6.1-terra',1))).rejects.toThrow();
 });
 it.each(['model','deployment','apiVersion','accountRef','region'] as const)('rejects a relabelled or mismatched Responses %s before native proof',async key=>{
  const x=setup();await x.session.arm(workspace);const route=responses('gpt-6.1-terra',1);(route.configuration as unknown as Record<string,unknown>)[key]=key==='accountRef'?other:'other';
  await expect(x.session.verifyRoute(route)).rejects.toThrow();expect(x.request).toHaveBeenCalledTimes(1);
 });
});
