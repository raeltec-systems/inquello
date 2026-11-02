// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/renderer/App';
import {SidebarResize} from '../src/renderer/Shell/SidebarResize';
import {clampSidebarWidth,readSidebarWidth,saveSidebarWidth,SIDEBAR_WIDTH_KEY} from '../src/renderer/Shell/sidebar-width';
import {Account} from '../src/renderer/Account';
const W='00000000-0000-4000-8000-000000000001';
const signedIn={identity:{state:'signed-in',displayName:'Fictional Person',issuerLabel:'INTERNAL ISSUER'},sharedService:'available',credentialStorage:'os-backed',privateWork:'local'};
const signedOut={...signedIn,identity:{state:'signed-out'}};
function fake(){let status=signedIn;let signed=true;const signOut=vi.fn(async()=>{signed=false;status=signedOut as typeof signedIn;return{ok:true,status};});const start=vi.fn(),preflight=vi.fn(),createTask=vi.fn();
 Object.assign(globalThis,{inquello:{identity:{getStatus:async()=>status,signOut},organise:{getWorkspaces:async()=>({signedIn:signed,sharedService:'available',workspaces:signed?[{workspaceId:W,name:'Fictional Partners',source:'service'}]:[],engagementCreation:{enabled:signed}}),getTree:async()=>({ok:true,value:{workspaceId:W,engagements:[],folders:[],tasks:[]}}),createTask},routes:{list:async()=>({ok:true,value:[]})},tasks:{start,preflight}}});return{signOut,start,preflight,createTask};}
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;localStorage.clear();location.hash='';});
it('validates persisted width and clamps out-of-range or nonfinite values',()=>{
 expect(readSidebarWidth()).toBe(320);for(const value of ['999','279','NaN','320.5','{}']){localStorage.setItem(SIDEBAR_WIDTH_KEY,value);expect(readSidebarWidth()).toBe(320);}
 saveSidebarWidth(900);expect(readSidebarWidth()).toBe(424);expect(clampSidebarWidth(424,300)).toBe(300);expect(clampSidebarWidth(NaN)).toBe(320);
});
it('supports keyboard bounds and explicit reset without affecting other shortcuts',()=>{
 const change=vi.fn();render(<SidebarResize width={320} maximum={400} onChange={change}/>);const handle=screen.getByRole('separator',{name:'Sidebar width'});
 for(const key of ['ArrowLeft','ArrowRight','Home','End','Enter'])fireEvent.keyDown(handle,{key});expect(change.mock.calls.map(x=>x[0])).toEqual([304,336,280,400,320]);
 fireEvent.keyDown(handle,{key:'x'});expect(change).toHaveBeenCalledTimes(5);
});
it('ignores pointer movement without an owned drag and persists keyboard width across remount',async()=>{
 const change=vi.fn();const mounted=render(<SidebarResize width={320} onChange={change}/>);fireEvent.pointerMove(screen.getByRole('separator'),{clientX:410});expect(change).not.toHaveBeenCalled();mounted.unmount();
 fake();location.hash='#shell';const app=render(<App/>);await screen.findByRole('textbox');const handle=screen.getByRole('separator');fireEvent.keyDown(handle,{key:'ArrowRight'});
 expect(localStorage.getItem(SIDEBAR_WIDTH_KEY)).toBe('336');expect(document.querySelector('[data-shell]')?.getAttribute('style')).toContain('336px');app.unmount();render(<App/>);await screen.findByRole('textbox');expect(screen.getByRole('separator').getAttribute('aria-valuenow')).toBe('336');
});
it('has one rail brand and simple footer; sign-out navigation and cancel preserve draft without auth action',async()=>{
 const api=fake(),user=userEvent.setup();location.hash='#shell';render(<App/>);const text=await screen.findByRole('textbox');await user.type(text,'Keep this fictional draft');
 expect(document.querySelector('.iq-sidebar-lockup')).toBeNull();expect(document.querySelectorAll('.iq-rail-logo')).toHaveLength(1);
 await user.click(screen.getByRole('button',{name:'Organization and team'}));expect(screen.queryByRole('menuitem',{name:'Account'})).toBeNull();expect(screen.queryByText('INTERNAL ISSUER')).toBeNull();
 await user.click(screen.getByRole('menuitem',{name:'Sign out…'}));await screen.findByRole('region',{name:'Confirm sign out'});expect(api.signOut).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Cancel · back to chat'}));await waitFor(()=>expect(screen.getByRole('textbox')).toBe(text));expect((text as HTMLTextAreaElement).value).toBe('Keep this fictional draft');
 expect(api.signOut).not.toHaveBeenCalled();expect(api.start).not.toHaveBeenCalled();expect(api.preflight).not.toHaveBeenCalled();
});
it('explicit sign-out confirmation uses existing identity action exactly once and invalidates owner draft',async()=>{
 const api=fake(),user=userEvent.setup();location.hash='#shell';render(<App/>);await user.type(await screen.findByRole('textbox'),'Private draft');
 await user.click(screen.getByRole('button',{name:'Organization and team'}));await user.click(screen.getByRole('menuitem',{name:'Sign out…'}));const confirm=await screen.findByRole('button',{name:'Sign out'});await waitFor(()=>expect(confirm.getAttribute('aria-disabled')).not.toBe('true'));await user.click(confirm);
 await waitFor(()=>expect(api.signOut).toHaveBeenCalledTimes(1));await user.click(screen.getByRole('button',{name:'Cancel · back to chat'}));await screen.findByRole('button',{name:'Sign in'});expect(screen.queryByDisplayValue('Private draft')).toBeNull();
});
it('confirmed signout remains available with pending effects, warns without replaying any request',async()=>{
 const api=fake();render(<Account signOutOnly/>);const button=await screen.findByRole('button',{name:'Sign out'});
 await waitFor(()=>expect(button.getAttribute('aria-disabled')).not.toBe('true'));
 expect(screen.getByText(/Pending requests may already have taken effect/)).toBeTruthy();
 fireEvent.click(button);await waitFor(()=>expect(api.signOut).toHaveBeenCalledTimes(1));
 expect(api.start).not.toHaveBeenCalled();expect(api.preflight).not.toHaveBeenCalled();expect(api.createTask).not.toHaveBeenCalled();
});

it('owns only the captured resize pointer, clamps it, and stops on cancellation',()=>{
 const change=vi.fn();render(<SidebarResize width={320} maximum={400} onChange={change}/>);const handle=screen.getByRole('separator');
 const pointer=(name:string,id:number,x:number,button=0)=>{const event=new Event(name,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:id,clientX:x,button});fireEvent(handle,event);};
 pointer('pointerdown',1,320,2);pointer('pointermove',1,380);expect(change).not.toHaveBeenCalled();
 pointer('pointerdown',1,320);pointer('pointermove',2,380);expect(change).not.toHaveBeenCalled();
 pointer('pointerdown',2,320);pointer('pointermove',2,380);expect(change).not.toHaveBeenCalled();
 pointer('pointercancel',2,320);pointer('lostpointercapture',2,320);
 pointer('pointermove',1,900);expect(change).toHaveBeenLastCalledWith(400);pointer('pointermove',1,10);expect(change).toHaveBeenLastCalledWith(280);
 pointer('pointercancel',1,320);pointer('pointermove',1,350);expect(change).toHaveBeenCalledTimes(2);
});
it('lets an explicitly confirmed logout proceed during an actual pending start and ignores its late acceptance without replay',async()=>{
 const api=fake();let finish!:(value:unknown)=>void;api.start.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const bridge=(globalThis as unknown as {inquello:{routes:unknown;tasks:unknown}}).inquello;
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'fictional-account',region:null},endpoint:'https://api.anthropic.com/v1/messages',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 bridge.routes={list:async()=>({ok:true,value:[route]})};api.preflight.mockResolvedValue({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}});
 location.hash='#shell';render(<App/>);await screen.findByRole('textbox');fireEvent.click(document.querySelector('.iq-processing-settings summary')!);
 await screen.findByText(/Claude —/);fireEvent.change(screen.getByLabelText('Processing route'),{target:{value:route.routeId}});await screen.findByText('Inference: Cloud inference');
 fireEvent.change(screen.getByLabelText('Reasoning'),{target:{value:'default'}});fireEvent.change(screen.getByLabelText('Speed'),{target:{value:'default'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'Fictional pending request'}});fireEvent.click(screen.getByLabelText('Send'));
 await waitFor(()=>expect(api.start).toHaveBeenCalledTimes(1));const original=api.start.mock.calls[0][0] as {operationId:string};
 fireEvent.click(screen.getByRole('button',{name:'Organization and team'}));fireEvent.click(screen.getByRole('menuitem',{name:'Sign out…'}));
 const confirm=await screen.findByRole('button',{name:'Sign out'});await waitFor(()=>expect(confirm.getAttribute('aria-disabled')).not.toBe('true'));fireEvent.click(confirm);await waitFor(()=>expect(api.signOut).toHaveBeenCalledTimes(1));
 finish({ok:true,value:{operationId:original.operationId,taskId:'00000000-0000-4000-8000-000000000099',runId:'run-fictional',threadId:'thread-fictional',status:'active',request:'Fictional pending request',accepted:true}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Sign out'}).getAttribute('aria-disabled')).toBe('true'));
 expect(api.start).toHaveBeenCalledTimes(1);expect(document.querySelector('[data-task-view]')).toBeNull();expect(api.createTask).not.toHaveBeenCalled();
});
