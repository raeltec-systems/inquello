// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Settings} from '../src/renderer/Settings';
import {viewFor} from '../src/renderer/App';
const policyView={signedIn:true,environmentLabel:'Local device',capabilities:[],reason:null,workspaces:[
 {workspaceId:'first',name:'First Workspace',policy:null,reason:'Policy unavailable'},
 {workspaceId:'second',name:'Second Workspace',policy:null,reason:'Policy unavailable'},
]};
function fixture(){
 const getSettings=vi.fn().mockResolvedValue(policyView);
 const getInventory=vi.fn(async({workspaceId}:{workspaceId:string})=>({workspaceId,available:true,stale:false,refreshedAt:'2026-11-06T16:00:00Z',reason:null,entries:[],provider:{provider:'Codex',accountType:'Not signed in',effectiveRoute:'Selected per Task; see Models',limits:[]}}));
 const manage=vi.fn(),catalog=vi.fn();
 Object.assign(globalThis,{inquello:{policy:{getSettings},capabilities:{getInventory,manage},routes:{catalog}}});
 return {getSettings,getInventory,manage,catalog};
}
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');location.hash='';});
it('ordinary Settings exposes scoped tools, focuses its heading and never mounts model selection',async()=>{
 const f=fixture();location.hash='#settings-tools';expect(viewFor(location.hash)).toBe('settings');
 const back=vi.fn();render(<Settings workspaceId="first" onBack={back} onIdentityChanged={vi.fn()}/>);
 expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Tools and connections',level:2}));
 expect(screen.getByRole('link',{name:'Tools and connections'}).getAttribute('aria-current')).toBe('page');
 await screen.findByRole('region',{name:'Tools and connections for First Workspace'});
 await waitFor(()=>expect(f.getInventory).toHaveBeenCalledWith({workspaceId:'first'}));
 expect(f.getInventory.mock.calls.every(([arg])=>arg.workspaceId==='first')).toBe(true);
 expect(screen.queryByText('Second Workspace')).toBeNull();
 expect(screen.getByText(/Private Tasks currently keep configured MCP servers, apps and plugins disabled/)).toBeTruthy();
 expect(f.manage).not.toHaveBeenCalled();expect(f.catalog).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Back to chat'}));expect(back).toHaveBeenCalledOnce();
});
it('no Workspace or a removed Workspace cannot silently select another one',async()=>{
 const f=fixture();location.hash='#settings-tools';
 const ui=render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 await screen.findByText('Select a Workspace in chat to manage its tools and connections.');
 await waitFor(()=>expect(f.getSettings).toHaveBeenCalled());
 expect(f.getInventory).not.toHaveBeenCalled();
 ui.rerender(<Settings workspaceId="removed" onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 expect(screen.getByText(/selected Workspace is unavailable/)).toBeTruthy();expect(f.getInventory).not.toHaveBeenCalled();
});
it('switching Workspace clears the previous inventory and form; section navigation removes management',async()=>{
 const f=fixture();location.hash='#settings-tools';const props={onBack:vi.fn(),onIdentityChanged:vi.fn()};
 const ui=render(<Settings {...props} workspaceId="first"/>);
 await screen.findByRole('region',{name:'Tools and connections for First Workspace'});
 fireEvent.change(screen.getByRole('textbox',{name:'MCP server name'}),{target:{value:'old-server'}});
 ui.rerender(<Settings {...props} workspaceId="second"/>);
 await screen.findByRole('region',{name:'Tools and connections for Second Workspace'});
 expect(screen.queryByRole('region',{name:'Tools and connections for First Workspace'})).toBeNull();
 expect((screen.getByRole('textbox',{name:'MCP server name'}) as HTMLInputElement).value).toBe('');
 act(()=>{location.hash='#settings-usage';window.dispatchEvent(new HashChangeEvent('hashchange'));});
 expect(screen.queryByRole('form',{name:'Add MCP server'})).toBeNull();expect(f.manage).not.toHaveBeenCalled();
 act(()=>{location.hash='#settings-tools';window.dispatchEvent(new HashChangeEvent('hashchange'));});
 await screen.findByRole('region',{name:'Tools and connections for Second Workspace'});
 expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Tools and connections',level:2}));
});

it('pending policy read shows loading, not a false missing-Workspace error',async()=>{
 const f=fixture();let resolve!:(value:unknown)=>void;
 f.getSettings.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 location.hash='#settings-tools';render(<Settings workspaceId="first" onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 expect(screen.getByText('Loading tools and connections for the selected Workspace.')).toBeTruthy();
 expect(screen.queryByText(/selected Workspace is unavailable/)).toBeNull();
 await act(async()=>resolve(policyView));
 await screen.findByRole('region',{name:'Tools and connections for First Workspace'});
 expect(screen.queryByText(/Loading tools and connections/)).toBeNull();
});
it('missing desktop bridge is explicit rather than a missing-Workspace claim',()=>{
 location.hash='#settings-tools';render(<Settings workspaceId="first" onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 expect(screen.getByText('Tools and connections are available in the desktop app only.')).toBeTruthy();
 expect(screen.queryByText(/selected Workspace is unavailable/)).toBeNull();
});

it('account transition removes current management before the replacement policy read resolves',async()=>{
 const f=fixture();let changed!:(ready:boolean)=>void;
 const bridge=(globalThis as unknown as {inquello:{policy:{onSettingsChanged?:(fn:(ready:boolean)=>void)=>()=>void}}}).inquello.policy;
 bridge.onSettingsChanged=fn=>{changed=fn;return vi.fn();};
 location.hash='#settings-tools';render(<Settings workspaceId="first" onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 await screen.findByRole('region',{name:'Tools and connections for First Workspace'});
 act(()=>changed(false));
 expect(screen.queryByRole('form',{name:'Add MCP server'})).toBeNull();
 expect(screen.getByText('Account or runtime is changing. Current policy is unavailable.')).toBeTruthy();
 let resolve!:(value:unknown)=>void;f.getSettings.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 act(()=>changed(true));
 expect(screen.queryByRole('form',{name:'Add MCP server'})).toBeNull();
 await act(async()=>resolve({...policyView,signedIn:false,workspaces:[]}));
 expect(screen.queryByRole('region',{name:'Tools and connections for First Workspace'})).toBeNull();
 expect(f.manage).not.toHaveBeenCalled();
});
