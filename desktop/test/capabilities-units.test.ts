import { describe, it, expect, vi } from 'vitest';
import { RpcResponseError } from '../src/main/runtime/errors';
import { CapabilityService } from '../src/main/capabilities/service';
import { capabilityPayload, LOCAL_MCP_CONFIRMATION } from '../src/main/capabilities/types';
import { entryFromFact, hostAllowed, type CapabilityFact } from '../src/main/capabilities/rules';
import type { PolicyView } from '../src/main/policy/views';
const policy = (allowed = true, local = false): PolicyView => ({ workspaceId: 'w', settings: [{ name: 'mcp_tools', value: allowed ? 'allowed' : 'denied', sourceLabel: 'Workspace policy revision 1' }, { name: 'extensions', value: allowed ? 'allowed' : 'denied', sourceLabel: 'Workspace policy revision 1' }, { name: 'allow_local_mcp_servers', value: local ? 'allowed' : 'denied' }], reach: { domains: ['api.example.com'], lines: [] } } as unknown as PolicyView);
function fixture(allowed = true, local = false) {
    const config: {
        mcp_servers: Record<string, any>;
    } = { mcp_servers: {} };
    let installed = false, enabled = true, ready = true;
    const calls: {
        method: string;
        params: any;
    }[] = [];
    const request = vi.fn(async (method: string, params: any = {}): Promise<any> => {
        calls.push({ method, params });
        const plugin = { id: 'linear@curated', name: 'linear', installed, enabled, version: '1', availability: 'AVAILABLE', installPolicy: 'AVAILABLE' };
        switch (method) {
            case 'config/read': return { config };
            case 'app/list': return { data: [] };
            case 'app/installed':
            case 'app/read': return { apps: [] };
            case 'plugin/list':
            case 'plugin/installed': return { marketplaces: [{ name: 'curated', path: '/runtime/market', plugins: [plugin] }] };
            case 'plugin/read': return { plugin: { apps: [{ id: 'github', name: 'GitHub' }], mcpServers: [], hooks: [] } };
            case 'skills/list': return { data: [] };
            case 'account/read': return { account: { type: 'apiKey', apiKey: 'SENTINEL' } };
            case 'plugin/install':
                installed = true; enabled = true;
                return {};
            case 'plugin/uninstall':
                installed = false;
                return {};
            case 'config/batchWrite':
                for (const e of params.edits) {
                    const m = /^mcp_servers\."([^"]+)"(\.enabled)?$/.exec(e.keyPath);
                    if (m) {
                        if (m[2])
                            config.mcp_servers[m[1]!].enabled = e.value;
                        else if (e.value === null)
                            delete config.mcp_servers[m[1]!];
                        else
                            config.mcp_servers[m[1]!] = e.value;
                    }
                    else
                        enabled = e.value;
                }
                return {};
            case 'config/mcpServer/reload': return {};
            case 'mcpServerStatus/list': return { data: [{ name: params.serverName, authStatus: 'unsupported', tools: { ping: {} }, serverInfo: { version: '2' } }] };
            case 'mcpServer/oauth/login': return { loginId: 'login1', authorizationUrl: 'https://auth.example.com' };
            case 'mcpServer/oauth/cancel': return { status: 'cancelled' };
            default: throw new Error('Unexpected ' + method);
        }
    });
    const browser = vi.fn(async () => { });
    const runtime = { ready: () => ready, request };
    const policyLink={ forWorkspace: vi.fn(async ():Promise<any> => ({ ok: true, value: policy(allowed, local) })), capabilitySandboxAvailable: async () => true };
    const service = new CapabilityService({ runtime, policy: policyLink, runtimeVersion: 'test', openBrowser: browser });
    return { service, calls, request, config, browser, policyLink, tighten: () => {allowed=false;}, stop: () => { ready = false; } };
}
describe('capabilities mediator', () => {
    it('reads actual inventory, provider and dependencies without credentials', async () => { const f = fixture(); const v = await f.service.getInventory('w'); expect(v.available).toBe(true); expect(v.entries.filter(x => x.kind === 'built_in')).toHaveLength(3); expect(v.entries.find(x => x.kind === 'plugin')?.dependencies).toContain('GitHub — Not connected'); expect(JSON.stringify(v)).not.toContain('SENTINEL'); });
    it('default policy refuses installation before runtime mutation', async () => { const f = fixture(false); const r = await f.service.manage({ workspaceId: 'w', kind: 'plugin', id: 'linear@curated', action: 'install' }); expect(r.reason).toContain('extensions not allowed'); expect(f.calls.some(x => x.method === 'plugin/install')).toBe(false); });
    it('installation rereads state without authenticating dependencies', async () => { const f = fixture(); const r = await f.service.manage({ workspaceId: 'w', kind: 'plugin', id: 'linear@curated', action: 'install' }); expect(r.ok).toBe(true); expect(r.inventory.entries.find(x => x.kind === 'plugin')?.reason_not_callable).toContain('Needs connection'); expect(f.calls.some(x => /oauth|login/.test(x.method))).toBe(false); expect(f.calls.filter(x => x.method === 'plugin/installed')).toHaveLength(2); expect(f.calls.find(x=>x.method==='plugin/install')?.params.skipAuthentication).toBe(true); });
    it('remote add/disable/enable/remove use verified state', async () => { const f = fixture(); expect((await f.service.manage({ workspaceId: 'w', kind: 'mcp_server', id: 'test', action: 'add', url: 'https://api.example.com/mcp' })).ok).toBe(true); for (const action of ['disable', 'enable', 'remove'] as const) {
        const r = await f.service.manage({ workspaceId: 'w', kind: 'mcp_server', id: 'test', action });
        expect(r.ok).toBe(true);
        if (action === 'disable')
            expect(r.inventory.entries.find(x => x.id === 'test')?.reason_not_callable).toBe('Disabled by you');
    } });
    it('never probes blocked endpoints or starts disallowed local servers', async () => { const f = fixture(); f.config.mcp_servers.bad = { url: 'https://blocked.example' }; f.config.mcp_servers.local = { command: 'bad' }; const v = await f.service.getInventory('w'); expect(v.entries.find(x => x.id === 'bad')?.reason_not_callable).toContain('blocked.example'); expect(f.calls.some(x => x.method === 'mcpServerStatus/list')).toBe(false); });
    it('local server requires policy and exact confirmation', async () => { for (const [allowed, confirmation, expected] of [[false, LOCAL_MCP_CONFIRMATION, false], [true, 'no', false], [true, LOCAL_MCP_CONFIRMATION, true]] as const) {
        const f = fixture(true, allowed);
        const r = await f.service.manage({ workspaceId: 'w', kind: 'mcp_server', id: 'local', action: 'add', command: 'fixture', confirmation });
        expect(r.ok).toBe(expected);
        if (!expected)
            expect(f.calls.some(x => x.method === 'config/batchWrite')).toBe(false);
    } });
    it('runtime down never shows old entries current', async () => { const f = fixture(); await f.service.getInventory('w'); f.stop(); const v = await f.service.getInventory('w'); expect(v.available).toBe(false); expect(v.reason).toContain('runtime not running'); expect(v.entries).toEqual([]); });
    it('notification during refresh marks snapshot stale', async () => { const f = fixture(); const original = f.request.getMockImplementation()!; f.request.mockImplementation(async (m, p) => { if (m === 'account/read')
        f.service.handleNotification('skills/changed'); return original(m, p); }); expect((await f.service.getInventory('w')).stale).toBe(true); });
    it('runtime errors are credential safe', async () => { const f = fixture(); f.request.mockRejectedValue(new Error('Bearer SENTINEL')); expect(JSON.stringify(await f.service.getInventory('w'))).not.toContain('SENTINEL'); });
    it('does not optimistically report installation', async () => { const f = fixture(); const original = f.request.getMockImplementation()!; f.request.mockImplementation((m, p) => m === 'plugin/install' ? Promise.resolve({}) : original(m, p)); expect((await f.service.manage({ workspaceId: 'w', kind: 'plugin', id: 'linear@curated', action: 'install' })).ok).toBe(false); });
    it('cancels the exact runtime login and rereads state', async () => { const f = fixture(); f.config.mcp_servers.oauth = { url: 'https://api.example.com' }; const r = await f.service.manage({ workspaceId: 'w', kind: 'mcp_server', id: 'oauth', action: 'connect' }); expect(r.ok).toBe(false); expect(f.browser).toHaveBeenCalledOnce(); const c = await f.service.manage({ workspaceId: 'w', kind: 'mcp_server', id: 'oauth', action: 'cancel' }); expect(c.ok).toBe(true); expect(f.calls.find(x => x.method === 'mcpServer/oauth/cancel')?.params).toEqual({ name: 'oauth', loginId: 'login1' }); });
});
describe('plugin dependency execution admission', () => {
  it.each(['install','enable'] as const)('refuses %s when plugin-owned MCP transport cannot be checked',async action=>{
    const f=fixture(true,false);const original=f.request.getMockImplementation()!;
    f.request.mockImplementation(async(m,p)=>{
      if(m==='plugin/read')return {plugin:{apps:[],mcpServers:['unresolved_stdio_or_remote'],mcpServerAdmissions:[{name:'unresolved_stdio_or_remote',transport:'unknown',httpOrigin:null}],hooks:[]}};
      const result=await original(m,p);
      if(action==='enable' && (m==='plugin/list'||m==='plugin/installed')) result.marketplaces[0].plugins[0]={...result.marketplaces[0].plugins[0],installed:true,enabled:false};
      return result;
    });
    const result=await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action});
    expect(result.ok).toBe(false);expect(result.reason).toContain('execution.allow_local_mcp_servers');
    expect(f.calls.some(x=>['plugin/install','config/batchWrite','mcpServerStatus/list'].includes(x.method))).toBe(false);
  });
});

describe('connection lifecycle projection', () => {
    it('completion notification clears only the matching login; reauthentication is explicit', async () => {
        const f = fixture(); f.config.mcp_servers.oauth = {url:'https://api.example.com'};
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});
        f.service.handleNotification('mcpServer/oauthLogin/completed',{name:'oauth',loginId:'old',success:false});
        expect((await f.service.getInventory('w')).entries.find(x=>x.id==='oauth')?.actions).toContain('cancel');
        f.service.handleNotification('mcpServer/oauthLogin/completed',{name:'oauth',loginId:'login1',success:true});
        expect((await f.service.getInventory('w')).entries.find(x=>x.id==='oauth')?.actions).not.toContain('cancel');
        f.service.handleNotification('mcpServer/startupStatus/updated',{name:'oauth',status:'failed',failureReason:'reauthentication_required'});
        expect((await f.service.getInventory('w')).entries.find(x=>x.id==='oauth')?.reason_not_callable).toBe('Connection expired — sign in again');
    });
    it('a cancellation that loses to persistence is not reported cancelled',async()=>{
        const f=fixture();f.config.mcp_servers.oauth={url:'https://api.example.com'};
        const original=f.request.getMockImplementation()!;
        f.request.mockImplementation((m,p)=>m==='mcpServer/oauth/cancel'?Promise.resolve({status:'completed'}):original(m,p));
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});
        const result=await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'cancel'});
        expect(result.ok).toBe(false);expect(result.reason).toContain('credentials were not revoked');
    });
    it('hosted app sign-in is an explicit browser handoff, never a connection claim', async()=>{
        const f=fixture();const original=f.request.getMockImplementation()!;
        f.request.mockImplementation((m,p)=>m==='app/list'?Promise.resolve({data:[{id:'github',name:'GitHub',isAccessible:false,isEnabled:true,installUrl:'https://provider.example/connect'}]}):original(m,p));
        const result=await f.service.manage({workspaceId:'w',kind:'app',id:'github',action:'connect'});
        expect(f.browser).toHaveBeenCalledWith('https://provider.example/connect');expect(result.ok).toBe(false);
        expect(result.reason).toContain('does not cancel provider authorization');
        expect(result.inventory.entries.find(x=>x.kind==='app')?.callable_now).toBe(false);
    });
});
describe('policy and identity transition races', () => {
 it('allows cancellation and disabling after policy tightens',async()=>{
   const f=fixture();f.config.mcp_servers.oauth={url:'https://api.example.com'};
   await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});f.tighten();
   expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'cancel'})).ok).toBe(true);
   expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'disable'})).ok).toBe(true);
 });
 it('completion before login reply never leaves a pending login or opens a browser',async()=>{
   const f=fixture();f.config.mcp_servers.oauth={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
   f.request.mockImplementation(async(m,p)=>{if(m==='mcpServer/oauth/login')f.service.handleNotification('mcpServer/oauthLogin/completed',{name:'oauth',loginId:'login1',success:true});return original(m,p);});
   const r=await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});
   expect(f.browser).not.toHaveBeenCalled();expect(r.inventory.entries.find(x=>x.id==='oauth')?.actions).not.toContain('cancel');
 });
 it('an old delayed policy read cannot act on a replacement runtime',async()=>{
   const f=fixture();let release!:(value:unknown)=>void;let entered!:()=>void;const started=new Promise<void>(r=>entered=r);
   f.policyLink.forWorkspace.mockImplementationOnce(()=>(entered(),new Promise(r=>release=r)));
   const old=f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});await started;
   f.service.runtimeUnavailable();f.service.runtimeReset();release({ok:true,value:policy()});
   expect((await old).ok).toBe(false);expect(f.calls).toEqual([]);expect(f.browser).not.toHaveBeenCalled();
   expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'})).ok).toBe(true);
 });
 it('unknown login startup outcome requires runtime termination during logout',async()=>{
   const f=fixture();f.config.mcp_servers.oauth={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
   f.request.mockImplementation((m,p)=>m==='mcpServer/oauth/login'?Promise.reject(new Error('request timed out')):original(m,p));
   await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});
   expect(await f.service.quiesce()).toBe(false);expect(f.browser).not.toHaveBeenCalled();
   f.service.runtimeReset();expect(await f.service.quiesce()).toBe(true);
 });
 it('delayed login reply during logout is cancelled without browser handoff',async()=>{
   const f=fixture();f.config.mcp_servers.oauth={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
   let entered!:()=>void,reply!:(v:unknown)=>void;const started=new Promise<void>(r=>entered=r);
   f.request.mockImplementation((m,p)=>m==='mcpServer/oauth/login'?(entered(),new Promise(r=>reply=r)):original(m,p));
   const login=f.service.manage({workspaceId:'w',kind:'mcp_server',id:'oauth',action:'connect'});await started;
   const cleanup=f.service.quiesce();reply({loginId:'login1',authorizationUrl:'https://auth.example.com'});
   await login;expect(await cleanup).toBe(true);expect(f.browser).not.toHaveBeenCalled();
   expect(f.calls.some(x=>x.method==='mcpServer/oauth/cancel')).toBe(true);
   expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'})).ok).toBe(false);
   f.service.runtimeReset();expect((await f.service.getInventory('w')).entries.find(x=>x.id==='oauth')?.actions).not.toContain('cancel');
   expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'})).ok).toBe(true);
 });
});
describe('safe plugin admission metadata',()=>{
 it.each([[false,undefined,false],[true,undefined,false],[true,LOCAL_MCP_CONFIRMATION,true]] as const)('local admission with policy %s and confirmation %s',async(local,confirmation,success)=>{
   const f=fixture(true,local);const original=f.request.getMockImplementation()!;
   f.request.mockImplementation((m,p)=>m==='plugin/read'?Promise.resolve({plugin:{apps:[],mcpServers:['local'],mcpServerAdmissions:[{name:'local',transport:'stdio',httpOrigin:null}],hooks:[]}}):original(m,p));
   const r=await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install',confirmation});expect(r.ok).toBe(success);
   const call=f.calls.find(x=>x.method==='plugin/install');if(success)expect(call?.params.mcpAdmission).toMatchObject({allowTools:true,allowLocalServers:true,localConfirmed:true});else expect(call).toBeUndefined();
 });
 it.each(['api.example.com','blocked.example'])('admits only allowed remote host %s',async hostname=>{
   const f=fixture();const original=f.request.getMockImplementation()!;
   f.request.mockImplementation((m,p)=>m==='plugin/read'?Promise.resolve({plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:[{name:'remote',transport:'http',httpOrigin:'https://'+hostname}],hooks:[]}}):original(m,p));
   expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'})).ok).toBe(hostname==='api.example.com');
 });
 it('uses remotePluginId, never the human name, for remote read/install',async()=>{
   const f=fixture();const original=f.request.getMockImplementation()!;
   f.request.mockImplementation(async(m,p)=>{const result=await original(m,p);if(m==='plugin/list'||m==='plugin/installed'){result.marketplaces[0].path=null;result.marketplaces[0].plugins[0].name='Human name';result.marketplaces[0].plugins[0].remotePluginId='backend-42';}return result;});
   expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'})).ok).toBe(true);
   for(const call of f.calls.filter(x=>['plugin/read','plugin/install'].includes(x.method)))expect(call.params.pluginName).toBe('backend-42');
 });
});
describe('guarded runtime plugin server routes',()=>{
 it('discovers and connects by raw name plus verified plugin identity and policy',async()=>{
  const f=fixture();const original=f.request.getMockImplementation()!;
  f.request.mockImplementation(async(m,p)=>{
   if(m==='plugin/read')return {plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:[{name:'remote',transport:'http',httpOrigin:'https://api.example.com'}],hooks:[]}};
   if(m==='mcpServerStatus/list'){const result=await original(m,p);result.data[0].pluginId='linear@curated';result.data[0].authStatus='notLoggedIn';return result;}
   return original(m,p);
  });
  await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
  const view=await f.service.getInventory('w');const entry=view.entries.find(x=>x.id==='linear@curated::remote');
  expect(entry?.actions).toContain('connect');
  await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'linear@curated::remote',action:'connect'});
  const login=f.calls.find(x=>x.method==='mcpServer/oauth/login')!;
  expect(login.params).toMatchObject({name:'remote',expectedPluginId:'linear@curated',mcpAdmission:{allowTools:true,allowLocalServers:false,allowedDomains:['api.example.com']}});
  expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'linear@curated::remote',action:'cancel'})).ok).toBe(true);
  expect(f.calls.find(x=>x.method==='mcpServer/oauth/cancel')?.params.name).toBe('remote');
 });
 it('guarded runtime can resolve installed remote dependencies without catalog transport metadata',async()=>{
  const f=fixture();const original=f.request.getMockImplementation()!;
  f.request.mockImplementation(async(m,p)=>{
   if(m==='plugin/read')return {plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:null,hooks:[]}};
   const result=await original(m,p);
   if(m==='mcpServerStatus/list'){result.data[0].pluginId='linear@curated';result.data[0].httpOrigin='https://api.example.com';result.data[0].authStatus='notLoggedIn';}
   return result;
  });
  await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install',confirmation:LOCAL_MCP_CONFIRMATION});
  const entry=(await f.service.getInventory('w')).entries.find(x=>x.id==='linear@curated::remote');
  expect(entry?.actions).toContain('connect');expect(entry?.source).toBe('https://api.example.com');
 });
 it('a losing plugin name collision leaves unrelated inventory current with no handoff',async()=>{
  const f=fixture();f.config.mcp_servers.remote={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
  f.request.mockImplementation(async(m,p)=>{
   if(m==='plugin/read')return {plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:[{name:'remote',transport:'http',httpOrigin:'https://api.example.com'}],hooks:[]}};
   if(m==='mcpServerStatus/list'&&p.expectedPluginId)throw new RpcResponseError(m,-32600,'SECRET',{inquelloCapabilityAdmission:{code:'source_mismatch'}});
   return original(m,p);
  });
  await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
  const view=await f.service.getInventory('w');expect(view.available).toBe(true);expect(view.entries.some(x=>x.kind==='built_in')).toBe(true);
  const losing=view.entries.find(x=>x.id==='linear@curated::remote');expect(losing?.callable_now).toBe(false);expect(losing?.reason_not_callable).toContain('no fallback');expect(losing?.actions).not.toContain('connect');
  await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'linear@curated::remote',action:'connect'});expect(f.browser).not.toHaveBeenCalled();
 });
 it('maps only structured admission errors and never raw runtime messages',async()=>{
  const f=fixture();const original=f.request.getMockImplementation()!;
  f.request.mockImplementation((m,p)=>m==='plugin/install'?Promise.reject(new RpcResponseError(m,-32600,'SECRET',{inquelloCapabilityAdmission:{code:'host_not_allowed',host:'blocked.example'}})):original(m,p));
  const r=await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
  expect(r.reason).toBe("Host blocked.example is not on this Workspace's allowed list");expect(JSON.stringify(r)).not.toContain('SECRET');
 });
 it('source collision refusal cannot fall back to another connection',async()=>{
  const f=fixture();f.config.mcp_servers.test={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
  f.request.mockImplementation((m,p)=>m==='mcpServerStatus/list'?Promise.reject(new RpcResponseError(m,-32600,'SECRET',{inquelloCapabilityAdmission:{code:'source_mismatch'}})):original(m,p));
  const entry=(await f.service.getInventory('w')).entries.find(x=>x.id==='test');
  expect(entry?.callable_now).toBe(false);expect(entry?.reason_not_callable).toContain('no fallback');
 });
});
describe('gates and payload validation', () => {
    const fact: CapabilityFact = { kind: 'mcp_server', id: 'g', display_name: 'GitHub', source: 'local', version: '1', dependencies: [], installed: true, enabled: true, actions: ['connect'] };
    it.each(['expired', 'revoked'] as const)('reports %s without fallback', connection => { const e = entryFromFact({ ...fact, connection }, [], policy()); expect(e.callable_now).toBe(false); expect(e.reason_not_callable).toContain(connection); });
    it('wildcards respect hostname boundaries', () => { expect(hostAllowed('evilexample.com', ['*.example.com'])).toBe(false); expect(hostAllowed('example.com', ['*.example.com'])).toBe(false); expect(hostAllowed('example.com', ['**.example.com'])).toBe(true); });
    it.each([{ workspaceId: 'w', kind: 'plugin', id: 'x', action: 'install', apiKey: 'secret' }, { workspaceId: 'w', kind: 'mcp_server', id: 'x', action: 'add', url: 'https://user:secret@example.com' }, { workspaceId: 'w', kind: 'mcp_server', id: 'x', action: 'add', url: 'https://example.com?token=secret' }, { workspaceId: 'w', kind: 'mcp_server', id: 'x.y', action: 'add', command: 'p' }])('refuses unsafe input %j', x => expect(() => capabilityPayload([x])).toThrow());
});

describe('corrected inventory isolation and OAuth ownership', () => {
    it.each(['app/list','app/installed','app/read','plugin/list','plugin/installed','skills/list','account/read','config/read'])('isolates %s outage without hiding successful sources', async failed => {
        const f=fixture(); f.config.mcp_servers.one={url:'https://api.example.com'};
        const original=f.request.getMockImplementation()!;
        f.request.mockImplementation((m,p)=>m===failed?Promise.reject(new Error('SECRET outage')):m==='app/list'?Promise.resolve({data:[{id:'app',name:'App'}]}):original(m,p));
        const view=await f.service.getInventory('w');
        expect(view.available).toBe(true);expect(view.entries.filter(x=>x.kind==='built_in')).toHaveLength(3);expect(view.reason).toContain('unavailable');expect(JSON.stringify(view)).not.toContain('SECRET');
        if(failed!=='config/read')expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'disable'})).ok).toBe(true);
        else expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'new',action:'add',url:'https://api.example.com'})).ok).toBe(false);
    });
    it('does not infer successful removal from an unavailable config reread',async()=>{
        const f=fixture();f.config.mcp_servers.one={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;let removed=false;
        f.request.mockImplementation(async(m,p)=>{if(m==='config/read'&&removed)throw Error('offline');const result=await original(m,p);if(m==='config/batchWrite')removed=true;return result;});
        expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'remove'})).ok).toBe(false);
    });
    it('exposes exact cancellation during policy failure without leaking it to another Workspace',async()=>{
        const f=fixture();f.config.mcp_servers.one={url:'https://api.example.com'};
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'connect'});
        f.policyLink.forWorkspace.mockResolvedValue({ok:false,reason:'Policy unavailable'});
        expect((await f.service.getInventory('w')).entries.find(x=>x.id==='one')?.actions).toEqual(['cancel']);
        expect((await f.service.getInventory('other')).entries).toEqual([]);
        expect((await f.service.manage({workspaceId:'other',kind:'mcp_server',id:'one',action:'cancel'})).ok).toBe(false);
        expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'cancel'})).ok).toBe(true);
    });
    it.each(['disable','remove'] as const)('resolves server OAuth before %s and refuses ambiguous cancellation',async action=>{
        const f=fixture();f.config.mcp_servers.one={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'connect'});
        f.request.mockImplementation((m,p)=>m==='mcpServer/oauth/cancel'?Promise.resolve({status:'notFound'}):original(m,p));
        expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action})).ok).toBe(false);
        expect(f.calls.some(x=>x.method==='config/batchWrite')).toBe(false);
        f.request.mockImplementation(original);
        expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action})).ok).toBe(true);
        expect(f.calls.findIndex(x=>x.method==='mcpServer/oauth/cancel')).toBeLessThan(f.calls.findIndex(x=>x.method==='config/batchWrite'));
    });
    it('definitive login refusal allows retry but a timeout remains unresolved',async()=>{
        const f=fixture();f.config.mcp_servers.one={url:'https://api.example.com'};const original=f.request.getMockImplementation()!;
        f.request.mockImplementation((m,p)=>m==='mcpServer/oauth/login'?Promise.reject(new RpcResponseError(m,-32600,'SECRET',{inquelloCapabilityAdmission:{code:'source_mismatch'}})):original(m,p));
        expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'connect'})).ok).toBe(false);
        f.request.mockImplementation(original);
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'connect'});expect(f.browser).toHaveBeenCalledOnce();
    });
    it.each(['disable','uninstall'] as const)('plugin %s resolves owned attempt even after policy/catalog loss',async action=>{
        const f=fixture();const original=f.request.getMockImplementation()!;let outage=false;
        f.request.mockImplementation(async(m,p)=>{
            if(m==='plugin/read'){if(outage)throw Error('catalog offline');return {plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:[{name:'remote',transport:'http',httpOrigin:'https://api.example.com'}],hooks:[]}};}
            if(m==='plugin/list'&&outage)throw Error('catalog offline');
            const result=await original(m,p);if(m==='mcpServerStatus/list')result.data[0].pluginId='linear@curated';return result;
        });
        await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
        await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'linear@curated::remote',action:'connect'});
        f.tighten();outage=true;
        expect((await f.service.getInventory('w')).entries.find(x=>x.id==='linear@curated::remote')?.actions).toEqual(['cancel']);
        expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action})).ok).toBe(true);
        const cancellation=f.calls.findIndex(x=>x.method==='mcpServer/oauth/cancel');expect(cancellation).toBeGreaterThan(-1);
        expect(cancellation).toBeLessThan(f.calls.findIndex(x=>x.method===(action==='disable'?'config/batchWrite':'plugin/uninstall')));
    });
});
describe('exact dependency and permission projection',()=>{
    const base:CapabilityFact={kind:'app',id:'same',display_name:'Same app',source:'catalog',version:'1',dependencies:[],installed:true,enabled:true,actions:[],connection:'connected'};
    it('declared MCP identity never falls back to a connected app or plugin-owned server',()=>{
        const skill:CapabilityFact={...base,kind:'skill',id:'skill',dependencyRefs:[{kind:'mcp_server',id:'same'}]};
        const pluginServer:CapabilityFact={...base,kind:'mcp_server',id:'plugin::same'};
        expect(entryFromFact(skill,[base,pluginServer],policy()).callable_now).toBe(false);
        const server:CapabilityFact={...base,kind:'mcp_server',connection:'not-connected'};
        expect(entryFromFact(skill,[base,server],policy()).reason_not_callable).toContain('Needs connection');
        expect(entryFromFact({...skill,dependencyRefs:[{kind:'mcp_server',id:'plugin::same'}]},[base,pluginServer],policy()).callable_now).toBe(true);
    });
    it.each([{host:'blocked.example'},{local:true}])('effective permission reflects endpoint/local restriction %j',restriction=>{
        const server:CapabilityFact={...base,kind:'mcp_server',...restriction};const entry=entryFromFact(server,[],policy());
        expect(entry.effective_permission).toBe(entry.reason_not_callable);expect(entry.next_action).toContain('administrator');
        const plugin:CapabilityFact={...base,kind:'plugin',id:'plugin',dependencyRefs:[{kind:'mcp_server',id:'same'}]};
        expect(entryFromFact(plugin,[server],policy()).effective_permission).toBe(entry.effective_permission);
    });
    it('unknown connection and sandbox states provide truthful next guidance',()=>{
        expect(entryFromFact({...base,connection:'unknown'},[],policy()).next_action).toContain('Refresh');
        expect(entryFromFact({...base,kind:'built_in',unavailable:'Local sandbox not yet checked'},[],policy()).next_action).toContain('Open a Task');
    });
});


describe('unknown source state is never mutation evidence', () => {
  it('does not infer installation absence or successful disable from an app state outage', async () => {
    const f = fixture(); const original = f.request.getMockImplementation()!; let changed = false;
    f.request.mockImplementation(async (method, params) => {
      if (method === 'app/list') return {data:[{id:'app',name:'App',isEnabled:false}]};
      if (method === 'app/installed') { if (changed) throw Error('offline'); return {apps:[{id:'app',enabled:true}]}; }
      const result = await original(method, params);
      if (method === 'config/batchWrite') changed = true;
      return result;
    });
    const result = await f.service.manage({workspaceId:'w',kind:'app',id:'app',action:'disable'});
    expect(result.ok).toBe(false);
    expect(result.inventory.entries.find(x=>x.id==='app')).toMatchObject({state_known:false,callable_now:false});
  });
  it('attributes built-in write denial to the read-only policy', () => {
    const p = policy(); p.settings.push({name:'sandbox',value:'read_only'} as any);
    const entry = entryFromFact({kind:'built_in',id:'write',display_name:'Write',source:'local',version:'1',dependencies:[],installed:true,enabled:true,actions:[]},[],p);
    expect(entry.effective_permission).toContain('read-only sandbox'); expect(entry.callable_now).toBe(false);
  });
});

describe('review fixes: honest discovery and exact targets', () => {
  it('preserves explicit failed plugin inspection with zero reported dependencies', async () => {
    const f=fixture(), original=f.request.getMockImplementation()!;
    f.request.mockImplementation(async(m,p)=>m==='plugin/read'?{plugin:{apps:[],mcpServers:[],mcpServerAdmissions:null,hooks:[]}}:original(m,p));
    await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
    const entry=(await f.service.getInventory('w')).entries.find(e=>e.kind==='plugin');
    expect(entry?.callable_now).toBe(false); expect(entry?.reason_not_callable).toContain('admission is unknown');
  });
  it('plugin-owned skill cannot resolve its MCP name to a config-owned collision',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!; f.config.mcp_servers.same={url:'https://api.example.com'};
    f.request.mockImplementation(async(m,p)=>m==='skills/list'?{data:[{skills:[{path:'/skill',name:'Skill',enabled:true,pluginId:'owner@market',dependencies:{tools:[{type:'mcp',value:'same'}]}}],errors:[]}]}:original(m,p));
    const entry=(await f.service.getInventory('w')).entries.find(e=>e.kind==='skill');
    expect(entry?.source).toBe('Plugin: owner@market'); expect(entry?.dependencies).toEqual(['mcp_server: owner@market::same']);
    expect(entry?.callable_now).toBe(false); expect(entry?.reason_not_callable).toContain('no fallback');
  });
  it.each([{url:'https://api.example.com',http_headers_helper:'never-run'}, {transport:'unknown'}])('does not enable unsupported actual registration %j',async registration=>{
    const f=fixture(); f.config.mcp_servers.bad={...registration,enabled:false};
    const result=await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'bad',action:'enable'});
    expect(result.ok).toBe(false); expect(result.reason).toContain('transport is unknown');
    expect(f.calls.some(c=>c.method==='config/batchWrite')).toBe(false);
  });
  it('ordinary disconnected HTTP server can still be enabled',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!;f.config.mcp_servers.good={url:'https://api.example.com',enabled:false};
    f.request.mockImplementation(async(m,p)=>m==='mcpServerStatus/list'?{data:[{name:'good',authStatus:'notLoggedIn',tools:{}}]}:original(m,p));
    expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'good',action:'enable'})).ok).toBe(true);
  });
  it.each([{}, {config:null}, {config:{mcp_servers:[]}}])('malformed config reread cannot confirm removal %j',async malformed=>{
    const f=fixture(), original=f.request.getMockImplementation()!; f.config.mcp_servers.one={url:'https://api.example.com'};let changed=false;
    f.request.mockImplementation(async(m,p)=>{if(m==='config/read'&&changed)return malformed;const r=await original(m,p);if(m==='config/batchWrite')changed=true;return r;});
    expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'one',action:'remove'})).ok).toBe(false);
  });
  it.each([{}, {marketplaces:null}, {marketplaces:[{plugins:null}]}, {marketplaces:[{plugins:[{}]}]}])('malformed installed plugin reread cannot confirm uninstall %j',async malformed=>{
    const f=fixture(), original=f.request.getMockImplementation()!;await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});let changed=false;
    f.request.mockImplementation(async(m,p)=>{if(m==='plugin/installed'&&changed)return malformed;const r=await original(m,p);if(m==='plugin/uninstall')changed=true;return r;});
    expect((await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'uninstall'})).ok).toBe(false);
  });
  it('malformed installed apps are unavailable, not known absent',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!;
    f.request.mockImplementation(async(m,p)=>m==='app/list'?{data:[{id:'one',name:'One'}]}:m==='app/installed'?{}:original(m,p));
    const view=await f.service.getInventory('w');expect(view.reason).toContain('installed apps unavailable');expect(view.entries.find(e=>e.id==='one')?.state_known).toBe(false);
  });
  it('surfaces sanitized skills group errors while retaining discovered skills',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!;
    f.request.mockImplementation(async(m,p)=>m==='skills/list'?{data:[{skills:[{path:'/skill',name:'Skill',enabled:true}],errors:[{message:'SECRET',path:'/SECRET'}]}]}:original(m,p));
    const view=await f.service.getInventory('w');expect(view.reason).toContain('Skill discovery incomplete');expect(JSON.stringify(view)).not.toContain('SECRET');expect(view.entries.some(e=>e.kind==='skill')).toBe(true);
  });
  it('keeps installed catalog-missing apps and can safely disable them',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!;let enabled=true;
    f.request.mockImplementation(async(m,p)=>{if(m==='app/installed')return {apps:[{id:'orphan',enabled}]};if(m==='config/batchWrite')enabled=false;return original(m,p);});
    const view=await f.service.getInventory('w');expect(view.entries.find(e=>e.id==='orphan')).toMatchObject({installed:true,enabled:true,callable_now:false,actions:['disable']});
    expect((await f.service.manage({workspaceId:'w',kind:'app',id:'orphan',action:'disable'})).ok).toBe(true);
  });
  it('rechecks extensions for plugin-owned login after discovery',async()=>{
    const f=fixture(), original=f.request.getMockImplementation()!;
    f.request.mockImplementation(async(m,p)=>{if(m==='plugin/read')return {plugin:{apps:[],mcpServers:['remote'],mcpServerAdmissions:[{name:'remote',transport:'http',httpOrigin:'https://api.example.com'}],hooks:[]}};const r=await original(m,p);if(m==='mcpServerStatus/list')r.data[0].pluginId='linear@curated';return r;});
    await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
    let reads=0;f.policyLink.forWorkspace.mockImplementation(async()=>{const value=policy();if(++reads>=3)value.settings.find(s=>s.name==='extensions')!.value='denied';return {ok:true,value};});
    const r=await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'linear@curated::remote',action:'connect'});
    expect(r.reason).toContain('extensions not allowed');expect(f.calls.some(c=>c.method==='mcpServer/oauth/login')).toBe(false);
  });
});


it('partial marketplace read errors cannot confirm uninstall by absence and never leak details',async()=>{
  const f=fixture(),original=f.request.getMockImplementation()!;
  await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});let changed=false;
  f.request.mockImplementation(async(m,p)=>{
    if(m==='plugin/installed'&&changed)return {marketplaces:[],marketplaceLoadErrors:[{message:'SECRET',path:'/SECRET'}]};
    const result=await original(m,p);if(m==='plugin/uninstall')changed=true;return result;
  });
  const result=await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'uninstall'});
  expect(result.ok).toBe(false);expect(result.inventory.reason).toContain('installed plugins incomplete');expect(JSON.stringify(result)).not.toContain('SECRET');
});
it('retains known installed plugin rows when another marketplace is incomplete',async()=>{
  const f=fixture(),original=f.request.getMockImplementation()!;await f.service.manage({workspaceId:'w',kind:'plugin',id:'linear@curated',action:'install'});
  f.request.mockImplementation(async(m,p)=>{const r=await original(m,p);if(m==='plugin/installed')r.marketplaceLoadErrors=[{message:'SECRET'}];return r;});
  const view=await f.service.getInventory('w');expect(view.entries.find(e=>e.kind==='plugin')).toMatchObject({installed:true,state_known:true,actions:['uninstall','disable']});expect(view.reason).toContain('incomplete');
});
it('structured target admission refusal prevents enable without blocking transient disconnected servers',async()=>{
  const f=fixture(),original=f.request.getMockImplementation()!;f.config.mcp_servers.server={url:'https://api.example.com',enabled:true};
  f.request.mockImplementation(async(m,p)=>{if(m==='mcpServerStatus/list')throw new RpcResponseError(m,-32600,'SECRET',{inquelloCapabilityAdmission:{code:'unknown_transport'}});return original(m,p);});
  const result=await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'server',action:'enable'});
  expect(result.ok).toBe(false);expect(result.reason).toContain('transport is unknown');expect(f.calls.some(c=>c.method==='config/batchWrite')).toBe(false);
});
it('non-HTTP configured endpoint cannot be enabled',async()=>{
  const f=fixture();f.config.mcp_servers.server={url:'ftp://api.example.com',enabled:false};
  expect((await f.service.manage({workspaceId:'w',kind:'mcp_server',id:'server',action:'enable'})).ok).toBe(false);expect(f.calls.some(c=>c.method==='config/batchWrite')).toBe(false);
});
