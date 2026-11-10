// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {CapabilityInventory} from '../src/renderer/CapabilityInventory';
import type {Inventory,InventoryEntry} from '../src/renderer/capabilities-bridge';

const entry:InventoryEntry={kind:'mcp_server',id:'example',display_name:'Example connection',source:'Managed catalog',version:'1.2.3',dependencies:['Required connection'],installed:true,enabled:true,callable_now:false,reason_not_callable:'Host is not allowed by Workspace policy',effective_permission:'Workspace policy denies this host',next_action:'Ask your administrator',actions:['enable','disable','remove','connect']};
const inventory=(changes:Partial<InventoryEntry>={}):Inventory=>({workspaceId:'workspace',available:true,stale:false,refreshedAt:'2026-11-07T00:00:00Z',reason:null,entries:[{...entry,...changes}],provider:{provider:'Codex',accountType:'Not signed in',effectiveRoute:'Selected per Task',limits:[]}});
function setup(value=inventory()) {
 const getInventory=vi.fn().mockResolvedValue(value),manage=vi.fn().mockResolvedValue({ok:false,reason:'No change',inventory:value});
 let changed=()=>{};
 Object.defineProperty(globalThis,'inquello',{configurable:true,value:{capabilities:{getInventory,manage,onChanged:(listener:()=>void)=>{changed=listener;return()=>{};}}}});
 return {...render(<CapabilityInventory workspaceId="workspace" workspaceName="Example Workspace"/>),getInventory,manage,notify:()=>act(()=>changed())};
}
const details=()=>screen.getByText('Details for Example connection').closest('details')!;
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');});

it('keeps state, policy restrictions, recovery and actions outside collapsed reference details',async()=>{
 const f=setup();await screen.findByText('Example connection');
 expect(details().open).toBe(false);
 for(const text of ['Managed catalog','1.2.3','Required connection'])expect(details().contains(screen.getByText(text))).toBe(true);
 for(const text of ['Host is not allowed by Workspace policy','Workspace policy denies this host','Next action: Ask your administrator'])expect(details().contains(screen.getByText(text))).toBe(false);
 expect(details().contains(screen.getByText(/Installed; Enabled;/))).toBe(false);
 expect(details().contains(screen.getByRole('button',{name:'Disable Example connection'}))).toBe(false);
 await userEvent.click(screen.getByText('Details for Example connection'));expect(details().open).toBe(true);
 await userEvent.click(screen.getByText('Details for Example connection'));expect(details().open).toBe(false);
 expect(f.manage).not.toHaveBeenCalled();
});

it.each([true,false])('offers only the applicable paired enablement action when enabled=%s',async enabled=>{
 setup(inventory({enabled}));await screen.findByText('Example connection');
 expect(screen.getByRole('button',{name:`${enabled?'Disable':'Enable'} Example connection`})).toBeTruthy();
 expect(screen.queryByRole('button',{name:`${enabled?'Enable':'Disable'} Example connection`})).toBeNull();
 expect(screen.getByRole('button',{name:'Remove Example connection'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Connect Example connection'})).toBeTruthy();
});

it('does not infer enablement when the runtime says source state is unknown',async()=>{
 setup(inventory({state_known:false,enabled:false}));await screen.findByText('Example connection');
 expect(screen.getByText(/Installation state unavailable; Enablement state unavailable/)).toBeTruthy();
 expect(screen.getByRole('button',{name:'Enable Example connection'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Disable Example connection'})).toBeTruthy();
});

it.each(['enable','disable','connect','remove','cancel'] as const)('retains the runtime-provided sole %s action without inventing an opposite',async action=>{
 setup(inventory({actions:[action]}));await screen.findByText('Example connection');
 const row=screen.getByText('Example connection').closest('li')!;
 expect(within(row).getAllByRole('button')).toHaveLength(1);
 expect(within(row).getByRole('button',{name:`${action==='cancel'?'Cancel sign-in for':action[0]!.toUpperCase()+action.slice(1)} Example connection`})).toBeTruthy();
});

it('retains the focused enablement button across the authoritative reread, with no optimistic state change or repeated action',async()=>{
 const f=setup();await screen.findByText('Example connection');
 let resolve!:(value:unknown)=>void;
 f.manage.mockImplementationOnce(()=>new Promise(yes=>{resolve=yes;}));
 const disable=screen.getByRole('button',{name:'Disable Example connection'});disable.focus();
 await userEvent.click(disable);await userEvent.click(disable);
 expect(f.manage).toHaveBeenCalledTimes(1);expect(f.manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'disable',kind:'mcp_server',id:'example'});
 expect(screen.getByText(/Installed; Enabled;/)).toBeTruthy();expect(screen.queryByRole('button',{name:'Enable Example connection'})).toBeNull();
 await act(async()=>resolve({ok:true,reason:null,inventory:inventory({enabled:false,reason_not_callable:'Disabled by you'})}));
 const enable=await screen.findByRole('button',{name:'Enable Example connection'});
 expect(document.activeElement).toBe(enable);expect(enable).toBe(disable);expect(screen.queryByRole('button',{name:'Disable Example connection'})).toBeNull();
 f.manage.mockResolvedValueOnce({ok:true,reason:null,inventory:inventory()});
 await userEvent.click(enable);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('button',{name:'Disable Example connection'})));
 expect(f.manage).toHaveBeenCalledTimes(2);
});

it('retains open details through a refresh, but resets them when the Workspace changes',async()=>{
 const f=setup();await screen.findByText('Example connection');
 await userEvent.click(screen.getByText('Details for Example connection'));expect(details().open).toBe(true);
 f.notify();await waitFor(()=>expect(f.getInventory).toHaveBeenCalledTimes(2));
 expect(details().open).toBe(true);
 f.getInventory.mockResolvedValue({...inventory(),workspaceId:'other'});
 f.rerender(<CapabilityInventory workspaceId="other" workspaceName="Other Workspace"/>);
 await screen.findByText('Example connection');expect(details().open).toBe(false);
 expect(f.manage).not.toHaveBeenCalled();
});

it('keeps cancellation exposed during stale inventory while ordinary actions remain unavailable',async()=>{
 const f=setup({...inventory({actions:['enable','disable','cancel']}),available:false,stale:true,reason:'Runtime unavailable'});
 await screen.findByText('Example connection');
 expect(screen.getByRole('button',{name:'Disable Example connection'}).getAttribute('aria-disabled')).toBe('true');
 const cancel=screen.getByRole('button',{name:'Cancel sign-in for Example connection'});
 expect(cancel.getAttribute('aria-disabled')).not.toBe('true');expect(details().contains(cancel)).toBe(false);
 await userEvent.click(cancel);expect(f.manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'cancel',kind:'mcp_server',id:'example'});
});
