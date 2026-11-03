import {describe,expect,it,vi} from 'vitest';
import {RouteService,type RouteServiceOptions} from '../src/main/routes/service';
import type {RouteView} from '../src/main/routes/types';
import type {ProviderStatus} from '../src/main/providers';
const principal='11111111-1111-4111-8111-111111111111';
const row:RouteView={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:principal,region:null},endpoint:null,revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['synthetic fixture'],executionFlow:'local',inferenceFlow:'synthetic',connectorFlow:'none'};
function setup(){
 let owner=principal,instance=1;
 const status:ProviderStatus={claude:{state:'not-configured',storage:'memory-only'},codex:{state:'not-connected',account:null,credentialStore:'os-keyring'}};
 const snapshot=vi.fn(()=>status),getStatus=vi.fn(async()=>status),changing=vi.fn(()=>false),handoff=vi.fn();
 const privateRouteAuth=vi.fn(),verify=vi.fn(async(_route:RouteView)=>{});
 const request=vi.fn(async()=>({routes:[structuredClone(row)]}));
 const options:RouteServiceOptions={taskBinding:async()=>({routeId:row.routeId,configurationRevision:row.revision,disclosureBindings:[{routeId:row.routeId,configurationRevision:row.revision,active:true}]}),runtime:{ready:()=>true,instance:()=>instance,request:request as never,privateRouteAuth,stop:vi.fn()},identity:{principalId:()=>owner},syncPrincipal:async()=>{},providers:{snapshot,getStatus,routeCredentialChanging:changing,handoffClaude:handoff} as unknown as RouteServiceOptions['providers'],freshPolicy:async()=>null,syntheticFixtureBinding:verify};
 return{service:new RouteService(options),status,verify,request,privateRouteAuth,handoff,changing,setOwner:()=>{owner='22222222-2222-4222-8222-222222222222';},restart:()=>{instance++;}};
}
describe('dedicated synthetic route verification',()=>{
 it('verifies both catalog reads every time without a provider handoff or credential cache',async()=>{
  const x=setup();expect((await x.service.list()).ok).toBe(true);expect((await x.service.list()).ok).toBe(true);
  expect(x.verify).toHaveBeenCalledTimes(4);expect(x.privateRouteAuth).not.toHaveBeenCalled();expect(x.handoff).not.toHaveBeenCalled();
 });
 it.each(['claude','codex','changing'] as const)('refuses %s credential coexistence before native fixture verification',async kind=>{
  const x=setup();if(kind==='claude')x.status.claude.state='stored-unverified';else if(kind==='codex'){x.status.codex.state='connected';x.status.codex.account={type:'apiKey'};}else x.changing.mockReturnValue(true);
  expect((await x.service.list()).ok).toBe(false);expect(x.verify).not.toHaveBeenCalled();expect(x.privateRouteAuth).not.toHaveBeenCalled();
 });
 it('does not fall through when native fixture verification refuses',async()=>{
  const x=setup();x.verify.mockRejectedValue(new Error('refused'));expect((await x.service.list()).ok).toBe(false);expect(x.handoff).not.toHaveBeenCalled();expect(x.privateRouteAuth).not.toHaveBeenCalled();
 });
 it.each(['identity','runtime','credential'] as const)('rejects a late verification after %s changes',async kind=>{
  const x=setup();let release!:()=>void;x.verify.mockImplementationOnce(async()=>new Promise<void>(done=>{release=done;}));
  const pending=x.service.list();await vi.waitFor(()=>expect(x.verify).toHaveBeenCalledTimes(1));
  if(kind==='identity')x.setOwner();else if(kind==='runtime')x.restart();else x.status.claude.state='stored-unverified';
  release();expect((await pending).ok).toBe(false);expect(x.privateRouteAuth).not.toHaveBeenCalled();
 });
 it('verifies a changed final catalog revision instead of returning stale admission',async()=>{
  const x=setup();x.request.mockResolvedValueOnce({routes:[row]}).mockResolvedValueOnce({routes:[{...row,revision:2}]});
  x.verify.mockImplementation(async route=>{if(route.revision!==1)throw new Error('stale');});
  expect((await x.service.list()).ok).toBe(false);expect(x.verify).toHaveBeenCalledTimes(2);
 });
});
