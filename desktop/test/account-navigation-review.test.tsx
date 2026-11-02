// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {App} from '../src/renderer/App';
const first='00000000-0000-4000-8000-000000000001',second='00000000-0000-4000-8000-000000000002';
const status={identity:{state:'signed-in',displayName:'Fictional Person',issuerLabel:'Fictional issuer'},sharedService:'available',credentialStorage:'os-backed',privateWork:'local'};
function install(two=false){
 const signOut=vi.fn(async()=>({ok:false,reason:'Sign out refused.',status}));
 const getTree=vi.fn(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:[]}}));
 Object.assign(globalThis,{inquello:{identity:{getStatus:async()=>status,signOut},organise:{getWorkspaces:async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:first,name:'Fictional First',source:'service'},...(two?[{workspaceId:second,name:'Fictional Second',source:'service'}]:[])],engagementCreation:{enabled:true}}),getTree},routes:{list:async()=>({ok:true,value:[]}),catalog:async()=>({ok:true,value:{catalogVersion:'c'.repeat(64),choices:[],bindings:[]}})}}});
 return{signOut,getTree};
}
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;location.hash='';localStorage.clear();});
it.each(['refused','throws'])('preserves the same owner draft and mounted chat when sign out %s',async outcome=>{
 const api=install(),user=userEvent.setup();if(outcome==='throws')api.signOut.mockRejectedValueOnce(new Error('Unavailable'));
 location.hash='#shell';render(<App/>);const draft=await screen.findByRole('textbox');await user.type(draft,'Retain this fictional draft');
 await user.click(screen.getByRole('button',{name:'Organization and team'}));await user.click(screen.getByRole('menuitem',{name:'Sign out…'}));
 const confirm=await screen.findByRole('button',{name:'Sign out'});await waitFor(()=>expect(confirm.getAttribute('aria-disabled')).not.toBe('true'));await user.click(confirm);await screen.findByRole('status');
 await user.click(screen.getByRole('button',{name:'Cancel · back to chat'}));await waitFor(()=>expect(screen.getByRole('textbox')).toBe(draft));expect((draft as HTMLTextAreaElement).value).toBe('Retain this fictional draft');expect(api.signOut).toHaveBeenCalledTimes(1);
});
it('exposes current authorized workspace choices separately from organization and team setup',async()=>{
 const api=install(true),user=userEvent.setup();location.hash='#shell';render(<App/>);await screen.findByRole('textbox');await user.click(screen.getByRole('button',{name:'Organization and team'}));
 expect(screen.getByRole('menuitem',{name:'Switch to Fictional First'})).toBeTruthy();await user.click(screen.getByRole('menuitem',{name:'Switch to Fictional Second'}));
 await waitFor(()=>expect(api.getTree).toHaveBeenCalledWith({workspaceId:second}));expect(location.hash).toBe('#shell');
 await user.click(screen.getByRole('button',{name:'Organization and team'}));await user.click(screen.getByRole('menuitem',{name:'Fictional Second'}));expect(location.hash).toBe('#onboarding');expect(api.signOut).not.toHaveBeenCalled();
});
