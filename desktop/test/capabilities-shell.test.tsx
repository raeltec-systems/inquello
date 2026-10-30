// @vitest-environment jsdom
/// <reference lib="dom" />
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CapabilityInventory, LOCAL_MCP_CONFIRMATION } from '../src/renderer/CapabilityInventory';
import { parseInventory, type Inventory, type InventoryEntry } from '../src/renderer/capabilities-bridge';
const base: InventoryEntry = {kind:'plugin',id:'linear',display_name:'Linear',source:'Curated marketplace',version:'1',dependencies:['Linear app: Not connected'],installed:false,enabled:false,callable_now:false,reason_not_callable:'Blocked by Workspace policy (extensions not allowed)',effective_permission:'Workspace policy revision 1: extensions not allowed',next_action:'Install',actions:['install']};
function inventory(entry: Partial<InventoryEntry> = {}): Inventory { return {workspaceId:'workspace',refreshedAt:'2026-10-30T09:00:00Z',stale:false,available:true,reason:null,entries:[{...base,...entry}],provider:{provider:'Codex',accountType:'Not signed in',effectiveRoute:'No processing route',limits:['No model runs enabled.']}}; }
function setup(value = inventory()) {
 const getInventory = vi.fn().mockResolvedValue(value), manage = vi.fn().mockResolvedValue({ok:false,reason:'Blocked by Workspace policy (extensions not allowed)',inventory:value});
 Object.defineProperty(globalThis,'inquello',{configurable:true,value:{capabilities:{getInventory,manage}}});
 render(<CapabilityInventory workspaceId="workspace" workspaceName="Private" />);
 return {getInventory,manage};
}
afterEach(() => {cleanup();Reflect.deleteProperty(globalThis,'inquello');});
describe('S07 runtime inventory', () => {
 it('groups all kinds and refuses install without optimistic success',async () => {
  const {manage} = setup(); await screen.findByText('Linear');
  for(const kind of ['Built-in tools','Apps','MCP servers','Plugins','Skills']) expect(screen.getByRole('heading',{name:kind})).toBeTruthy();
  expect(screen.getByText('Linear app: Not connected')).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Install Linear plugin'}));
  expect(manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'install',kind:'plugin',id:'linear'});
  expect(screen.getByText(/Available — not installed/)).toBeTruthy();
 });
 it.each([
  ['Needs connection: GitHub (not signed in)','Connect'], ['Connection expired — sign in again','Sign in again'],
  ['Connection revoked — remove','Remove'], ["Host api.example.com is not on this Workspace's allowed list",'Add host'],
  ['Disabled by you','Enable'], ['Blocked by Workspace policy (execution.allow_local_mcp_servers is false)','Ask administrator'],
  ['Local sandbox unavailable on this device','Check sandbox'],
 ])('shows specific reason %s and next action',async (reason,next_action) => {
  setup(inventory({reason_not_callable:reason,next_action})); expect(await screen.findByText(reason)).toBeTruthy();
  expect(screen.getByText(`Next action: ${next_action}`)).toBeTruthy();
 });
 it('lists built-in reach and callable state from the sandbox probe',async () => {
  setup(inventory({kind:'built_in',display_name:'Shell',installed:true,enabled:true,callable_now:true,reason_not_callable:null,effective_permission:"This Task's working folder and Output folder only.",actions:[]}));
  expect(await screen.findByText(/Callable now/)).toBeTruthy(); expect(screen.getByText("This Task's working folder and Output folder only.")).toBeTruthy();
 });
 it('shows installed state only after reread with dependencies still disconnected',async () => {
  const {manage} = setup(); manage.mockResolvedValue({ok:true,reason:null,inventory:inventory({installed:true,enabled:true,reason_not_callable:'Needs connection: Linear (not signed in)',actions:['uninstall']})});
  await userEvent.click(await screen.findByRole('button',{name:'Install Linear plugin'}));
  expect(await screen.findByText('Needs connection: Linear (not signed in)')).toBeTruthy(); expect(screen.getByText('Linear app: Not connected')).toBeTruthy();
 });
 it('requires explicit outside-sandbox confirmation for stdio',async () => {
  const {manage} = setup(); await screen.findByText('Linear');
  await userEvent.type(screen.getByRole('textbox',{name:'MCP server name'}),'fixture');
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Connection type'}),'local');
  await userEvent.type(screen.getByRole('textbox',{name:'Program to run'}),'fixture-program');
  await userEvent.click(screen.getByRole('button',{name:'Add fixture MCP server'})); expect(manage).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('checkbox',{name:LOCAL_MCP_CONFIRMATION}));
  await userEvent.click(screen.getByRole('button',{name:'Add fixture MCP server'}));
  expect(manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'add',kind:'mcp_server',id:'fixture',command:'fixture-program',args:[],confirmation:LOCAL_MCP_CONFIRMATION});
 });
 it('adds remote MCP through the validated operation',async () => {
  const {manage} = setup(); await screen.findByText('Linear');
  await userEvent.type(screen.getByRole('textbox',{name:'MCP server name'}),'remote');
  await userEvent.type(screen.getByRole('textbox',{name:'MCP server URL'}),'https://api.example.com/mcp');
  await userEvent.click(screen.getByRole('button',{name:'Add remote MCP server'}));
  expect(manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'add',kind:'mcp_server',id:'remote',url:'https://api.example.com/mcp'});
 });
 it('cancel sign-in shows reread disconnected state',async () => {
  const {manage} = setup(inventory({kind:'mcp_server',actions:['cancel'],reason_not_callable:'Sign-in pending'}));
  manage.mockResolvedValue({ok:true,reason:'Sign-in cancelled',inventory:inventory({kind:'mcp_server',actions:['connect'],reason_not_callable:'Not connected'})});
  await userEvent.click(await screen.findByRole('button',{name:'Cancel sign-in for Linear'})); expect(await screen.findByText('Not connected')).toBeTruthy();
 });
 it('hosted app handoff is labelled and has no cancellation control',async()=>{
  const {manage}=setup(inventory({kind:'app',actions:['connect'],reason_not_callable:'Not connected'}));
  manage.mockResolvedValue({ok:false,reason:'Provider-hosted sign-in opened in your browser. Closing this view does not cancel provider authorization or remove credentials.',inventory:inventory({kind:'app',actions:['connect'],reason_not_callable:'Connection state unknown'})});
  await userEvent.click(await screen.findByRole('button',{name:'Connect Linear'}));
  expect(await screen.findByText(/Closing this view does not cancel provider authorization/)).toBeTruthy();
  expect(screen.queryByRole('button',{name:/Cancel sign-in/})).toBeNull();
 });
 it('local plugin install requires explicit outside-sandbox confirmation',async()=>{
  const {manage}=setup(inventory({requires_local_confirmation:true}));
  await userEvent.click(await screen.findByRole('button',{name:'Install Linear plugin'}));
  expect(manage).not.toHaveBeenCalled();expect(screen.getByRole('alertdialog')).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Confirm install Linear plugin'}));
  expect(manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'install',kind:'plugin',id:'linear',confirmation:LOCAL_MCP_CONFIRMATION});
 });
 it.each(['enable','disable','remove'] as const)('sends %s only for the named MCP server and displays reread',async action => {
  const {manage} = setup(inventory({kind:'mcp_server',installed:true,enabled:action !== 'enable',actions:[action]}));
  const after = inventory({kind:'mcp_server',installed:action !== 'remove',enabled:action === 'enable',actions:[],reason_not_callable:action === 'disable' ? 'Disabled by you' : 'Not connected'});
  manage.mockResolvedValue({ok:true,reason:null,inventory:after});
  const label = action.charAt(0).toUpperCase()+action.slice(1)+' Linear';
  await userEvent.click(await screen.findByRole('button',{name:label}));
  expect(manage).toHaveBeenCalledWith({workspaceId:'workspace',action,kind:'mcp_server',id:'linear'});
  expect(await screen.findByText(action === 'disable' ? 'Disabled by you' : 'Not connected')).toBeTruthy();
 });
 it('keeps provider session separate from Inquello identity',async () => {
  setup(); const provider = await screen.findByRole('region',{name:'Provider session'});
  expect(within(provider).getByText('Codex')).toBeTruthy(); expect(within(provider).getByText('No processing route')).toBeTruthy();
  expect(within(provider).getByText(/does not change your Workspaces/)).toBeTruthy();
 });
 it('runtime stopped never presents stale entries as callable',async () => {
  setup({...inventory({installed:true,enabled:true,callable_now:true,reason_not_callable:null}),available:false,stale:true,reason:'Unavailable — runtime not running'});
  expect(await screen.findByText('Unavailable — runtime not running')).toBeTruthy(); expect(screen.getByText(/Not callable now/)).toBeTruthy();
  expect(screen.getByText(/Stale inventory — last read: 2026/)).toBeTruthy(); expect(screen.getByRole('button',{name:'Install Linear plugin'}).getAttribute('aria-disabled')).toBe('true');
 });
 it('Refresh recovers failed reads without retaining current claims',async () => {
  const {getInventory} = setup(); await screen.findByText('Linear'); getInventory.mockRejectedValueOnce(new Error());
  await userEvent.click(screen.getByRole('button',{name:'Refresh tools and connections for Private'}));
  expect(await screen.findByText(/Previously read entries are not current/)).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Refresh tools and connections for Private'}));
  await waitFor(() => expect(screen.queryByText(/Previously read entries are not current/)).toBeNull());
 });
 it('drops unknown fields and rejects inconsistent callable states', () => {
  expect(JSON.stringify(parseInventory({...inventory(),secret:'sentinel'}))).not.toContain('sentinel'); expect(parseInventory(inventory({callable_now:true}))).toBeNull();
 });
});

function deferred<T>() { let resolve!: (value:T) => void; let reject!: (reason:unknown) => void; const promise = new Promise<T>((yes,no) => {resolve=yes;reject=no;}); return {promise,resolve,reject}; }
function controlled(value = inventory()) {
 const getInventory = vi.fn().mockResolvedValue(value);
 const manage = vi.fn();
 let changed = () => {};
 Object.defineProperty(globalThis,'inquello',{configurable:true,value:{capabilities:{getInventory,manage,onChanged:(listener:()=>void)=>{changed=listener;return ()=>{};}}}});
 const result = render(<CapabilityInventory workspaceId="workspace" workspaceName="Private" />);
 return {...result,getInventory,manage,notify:()=>act(()=>changed())};
}
describe('inventory request scopes and queued invalidation',()=>{
 it('does not apply obsolete management results or notices to another Workspace',async()=>{
  const c=controlled();await screen.findByText('Linear');
  const mutation=deferred<unknown>();c.manage.mockReturnValueOnce(mutation.promise);
  await userEvent.click(screen.getByRole('button',{name:'Install Linear plugin'}));
  c.getInventory.mockResolvedValue({...inventory({display_name:'Other workspace tool'}),workspaceId:'other'});
  c.rerender(<CapabilityInventory workspaceId="other" workspaceName="Other" />);
  await screen.findByText('Other workspace tool');
  await act(async()=>mutation.resolve({ok:true,reason:'Old operation result',inventory:inventory()}));
  expect(screen.queryByText('Linear')).toBeNull();expect(screen.queryByText('Old operation result')).toBeNull();
  expect(screen.getByText('Other workspace tool')).toBeTruthy();
 });
 it('loads the new Workspace even while the old Workspace read is pending',async()=>{
  const c=controlled();await screen.findByText('Linear');
  const old=deferred<unknown>();c.getInventory.mockReturnValueOnce(old.promise);
  c.notify();
  c.getInventory.mockResolvedValue({...inventory({display_name:'New scope'}),workspaceId:'other'});
  c.rerender(<CapabilityInventory workspaceId="other" workspaceName="Other" />);
  await screen.findByText('New scope');
  await act(async()=>old.resolve(inventory({display_name:'Old scope'})));
  expect(screen.queryByText('Old scope')).toBeNull();expect(screen.getByText('New scope')).toBeTruthy();
 });
 it('clears plugin confirmation and all local form authority on Workspace change',async()=>{
  const c=controlled(inventory({requires_local_confirmation:true}));await screen.findByText('Linear');
  await userEvent.type(screen.getByRole('textbox',{name:'MCP server name'}),'old-server');
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Connection type'}),'local');
  await userEvent.type(screen.getByRole('textbox',{name:'Program to run'}),'old-program');
  await userEvent.click(screen.getByRole('checkbox',{name:LOCAL_MCP_CONFIRMATION}));
  await userEvent.click(screen.getByRole('button',{name:'Install Linear plugin'}));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  c.getInventory.mockResolvedValue({...inventory(),workspaceId:'other'});
  c.rerender(<CapabilityInventory workspaceId="other" workspaceName="Other" />);
  await waitFor(()=>expect(screen.queryByRole('alertdialog')).toBeNull());
  expect((screen.getByRole('textbox',{name:'MCP server name'}) as HTMLInputElement).value).toBe('');
  expect((screen.getByRole('textbox',{name:'MCP server URL'}) as HTMLInputElement).value).toBe('');
  expect(screen.queryByRole('checkbox')).toBeNull();expect(c.manage).not.toHaveBeenCalled();
 });
 it('queues changes during a read and never displays the invalidated result as current',async()=>{
  const c=controlled(inventory({installed:true,enabled:true,callable_now:true,reason_not_callable:null}));await screen.findByText('Linear');
  const first=deferred<unknown>(),second=deferred<unknown>();
  c.getInventory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  c.notify();c.notify();
  expect(screen.getByText(/Not callable now/)).toBeTruthy();
  expect(screen.getByText(/Stale inventory/)).toBeTruthy();
  await act(async()=>first.resolve(inventory({display_name:'Invalidated result'})));
  await waitFor(()=>expect(c.getInventory).toHaveBeenCalledTimes(3));
  expect(screen.queryByText('Invalidated result')).toBeNull();
  await act(async()=>second.resolve(inventory({display_name:'Reconciled'})));
  expect(await screen.findByText('Reconciled')).toBeTruthy();
 });
 it('queues changes during management and reconciles rather than displaying obsolete mutation state',async()=>{
  const c=controlled();await screen.findByText('Linear');
  const mutation=deferred<unknown>(),refresh=deferred<unknown>();c.manage.mockReturnValueOnce(mutation.promise);c.getInventory.mockReturnValueOnce(refresh.promise);
  await userEvent.click(screen.getByRole('button',{name:'Install Linear plugin'}));c.notify();
  await act(async()=>mutation.resolve({ok:true,reason:'Sign-in completed before cancellation; credentials were not revoked.',inventory:inventory({display_name:'Obsolete installed'})}));
  await waitFor(()=>expect(c.getInventory).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Obsolete installed')).toBeNull();expect(screen.getByText('Sign-in completed before cancellation; credentials were not revoked.')).toBeTruthy();
  await act(async()=>refresh.resolve(inventory({display_name:'Current runtime'})));
  expect(await screen.findByText('Current runtime')).toBeTruthy();
 });
 it.each(['policy loss','catalog unavailable','runtime unavailable'])('keeps exact cancellation reachable after %s without granting start actions',async reason=>{
  const value={...inventory({kind:'mcp_server',actions:['cancel','connect'],reason_not_callable:reason}),available:false,stale:true,reason};
  const c=controlled(value);c.manage.mockResolvedValue({ok:true,reason:'Sign-in cancelled',inventory:{...value,entries:[]}});
  const cancel=await screen.findByRole('button',{name:'Cancel sign-in for Linear'});
  expect(cancel.getAttribute('aria-disabled')).not.toBe('true');
  expect(screen.getByRole('button',{name:'Connect Linear'}).getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(cancel);
  expect(c.manage).toHaveBeenCalledWith({workspaceId:'workspace',action:'cancel',kind:'mcp_server',id:'linear'});
 });
 it('shows per-source unavailability without discarding a successful partial inventory',async()=>{
  controlled({...inventory({kind:'built_in',display_name:'Shell',actions:[]}),reason:'Apps unavailable; plugin catalog unavailable'});
  expect(await screen.findByText('Apps unavailable; plugin catalog unavailable')).toBeTruthy();expect(screen.getByText('Shell')).toBeTruthy();
 });
});


it('labels unreadable install and enablement state instead of inferring absence', async () => {
  setup(inventory({state_known:false,installed:false,enabled:false,actions:[],reason_not_callable:'Installed app state unavailable'}));
  expect(await screen.findByText(/Installation state unavailable; Enablement state unavailable/)).toBeTruthy();
  expect(screen.queryByText(/Available — not installed/)).toBeNull();
  expect(parseInventory(inventory({state_known:false,installed:true,enabled:true,callable_now:true,reason_not_callable:null}))).toBeNull();
});


it.each(['Program to run','Program arguments (JSON array)'])('invalidates local confirmation when %s changes',async label=>{
  const {manage}=setup();await screen.findByText('Linear');
  await userEvent.type(screen.getByRole('textbox',{name:'MCP server name'}),'local');
  await userEvent.selectOptions(screen.getByRole('combobox',{name:'Connection type'}),'local');
  await userEvent.type(screen.getByRole('textbox',{name:'Program to run'}),'fixture');
  await userEvent.click(screen.getByRole('checkbox',{name:LOCAL_MCP_CONFIRMATION}));
  await userEvent.type(screen.getByRole('textbox',{name:label}),label==='Program to run'?'-changed':'[["arg"]');
  expect((screen.getByRole('checkbox',{name:LOCAL_MCP_CONFIRMATION}) as HTMLInputElement).checked).toBe(false);
  await userEvent.click(screen.getByRole('button',{name:'Add local MCP server'}));expect(manage).not.toHaveBeenCalled();
});
