// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Providers} from '../src/renderer/Providers';
const workspace='20000000-0000-4000-8000-000000000001';
const key='sk-proj-owned-fictional-key-no-provider-call';
function setup(owner=true,connected=false){
 let status={claude:{state:'not-configured',storage:'os-backed'},codex:{state:connected?'connected':'not-connected',account:connected?{type:'apiKey'}:null,credentialStore:'os-keyring'},routes:{'claude-api-key':{authorized:false,reason:'Unavailable'},'codex-inherited':{authorized:connected,reason:'Personal account'}}};
 let view={workspace_id:workspace,workspace_name:'Fictional company',provider:'openai-api',contract_id:'openai-api-standard-v1',contract_version:1,contract_digest:'a'.repeat(64),consent_text:'Allow OpenAI to process permitted workspace messages. No guaranteed region.',revision:'0',state:'not_allowed',can_manage:owner,authorization_epoch:'1',policy_revision:'1'};
 const order:string[]=[];
 const bridge={
  getStatus:vi.fn(async()=>status),
  consent:vi.fn(async()=>({ok:true,value:{view,pending:null}})),
  changeConsent:vi.fn(async(input:{action:string})=>{order.push(input.action);view={...view,state:input.action==='allow'?'allowed':'revoked',revision:'1'};return{ok:true,value:{view,pending:null}};}),
  codexLogin:vi.fn(async()=>{order.push('key');status={...status,codex:{...status.codex,state:'connected',account:{type:'apiKey'}}};return{ok:true,status};}),
  codexLogout:vi.fn(async()=>{order.push('disconnect');status={...status,codex:{...status.codex,state:'not-connected',account:null}};return{ok:true,status};}),
 };
 Object.assign(globalThis,{inquello:{provider:bridge}});
 render(<Providers workspaceId={workspace}/>);
 return{bridge,order};
}
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;});
it('owner explicitly connects and allows once, with exact displayed terms and cleared key',async()=>{
 const h=setup();await screen.findByText('Fictional company');await screen.findByText(/Allow OpenAI to process permitted/);
 expect(h.bridge.changeConsent).not.toHaveBeenCalled();
 const field=screen.getByLabelText<HTMLInputElement>('OpenAI API key for Codex');fireEvent.change(field,{target:{value:key}});
 fireEvent.click(screen.getByRole('button',{name:'Connect and allow'}));
 await waitFor(()=>expect(h.bridge.changeConsent).toHaveBeenCalledTimes(1));
 expect(h.order).toEqual(['key','allow']);expect(field.value).toBe('');
 expect(h.bridge.changeConsent).toHaveBeenCalledWith({workspaceId:workspace,expectedRevision:'0',contractVersion:1,contractDigest:'a'.repeat(64),action:'allow'});
 expect(document.body.innerHTML).not.toContain(key);
});
it('owner with an existing key allows without credential reentry or dispatch',async()=>{
 const h=setup(true,true);fireEvent.click(await screen.findByRole('button',{name:'Allow OpenAI for this workspace'}));
 await waitFor(()=>expect(h.bridge.changeConsent).toHaveBeenCalledTimes(1));expect(h.bridge.codexLogin).not.toHaveBeenCalled();
});
it('nonowner can connect privately but cannot allow or revoke workspace processing',async()=>{
 const h=setup(false);await screen.findByText(/Ask your workspace owner to allow OpenAI/);
 fireEvent.change(screen.getByLabelText('OpenAI API key for Codex'),{target:{value:key}});
 fireEvent.click(screen.getByRole('button',{name:'Connect with API key'}));
 await waitFor(()=>expect(h.bridge.codexLogin).toHaveBeenCalledTimes(1));expect(h.bridge.changeConsent).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:/Allow OpenAI for this workspace|Revoke workspace/})).toBeNull();
});
it('personal disconnect never revokes workspace consent',async()=>{
 const h=setup(true,true);await screen.findByText('Fictional company');
 fireEvent.click(screen.getByRole('button',{name:'Disconnect'}));
 await waitFor(()=>expect(h.bridge.codexLogout).toHaveBeenCalledTimes(1));expect(h.bridge.changeConsent).not.toHaveBeenCalled();
});
it('failed personal connection does not grant workspace consent',async()=>{
 const h=setup();h.bridge.codexLogin.mockResolvedValueOnce({ok:false,status:await h.bridge.getStatus()});
 await screen.findByText('Fictional company');fireEvent.change(screen.getByLabelText('OpenAI API key for Codex'),{target:{value:key}});
 fireEvent.click(screen.getByRole('button',{name:'Connect and allow'}));
 await waitFor(()=>expect(h.bridge.codexLogin).toHaveBeenCalledTimes(1));expect(h.bridge.changeConsent).not.toHaveBeenCalled();
});
