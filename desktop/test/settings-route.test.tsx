// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Settings} from '../src/renderer/Settings';
afterEach(()=>{cleanup();delete (globalThis as {inquello?:unknown}).inquello;location.hash='';});
it('mounting Providers reads status only; never verifies, stores, logs in or starts inference',async()=>{
 const provider={getStatus:vi.fn(async()=>null),setClaudeKey:vi.fn(),verifyClaudeKey:vi.fn(),removeClaudeKey:vi.fn(),codexLogin:vi.fn(),codexLogout:vi.fn()};
 Object.assign(globalThis,{inquello:{provider}});location.hash='#settings-providers';render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 await waitFor(()=>expect(provider.getStatus).toHaveBeenCalled());
 for(const action of [provider.setClaudeKey,provider.verifyClaudeKey,provider.removeClaudeKey,provider.codexLogin,provider.codexLogout])expect(action).not.toHaveBeenCalled();
 expect(screen.queryByText('Typography')).toBeNull();expect(screen.getByRole('link',{name:'Workspace and team'}).getAttribute('href')).toBe('#onboarding');
});
it('mounting Models reads only cached metadata without connecting, checking or selecting',async()=>{
 const routes={pendingModel:vi.fn(async()=>({ok:true,value:{operation:null}})),catalog:vi.fn(async()=>({ok:true,value:{catalogVersion:'c'.repeat(64),choices:[],bindings:[]}})),resolve:vi.fn(),bindingState:vi.fn(),selectModel:vi.fn(),forTask:vi.fn()};Object.assign(globalThis,{inquello:{routes}});
 location.hash='#settings-routes';const back=vi.fn();render(<Settings onBack={back} onIdentityChanged={vi.fn()}/>);
 await waitFor(()=>expect(routes.catalog).toHaveBeenCalled());expect(routes.resolve).not.toHaveBeenCalled();expect(routes.bindingState).not.toHaveBeenCalled();expect(routes.selectModel).not.toHaveBeenCalled();expect(routes.forTask).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Back to chat'}));expect(back).toHaveBeenCalledOnce();
});

it.each([
 ['provider-claude-key','#settings-providers-claude','provider-claude-key'],
 ['provider-codex-key','#settings-providers-openai','provider-codex-key'],
 ['codex-chatgpt','#settings-providers-chatgpt',null],
])('reconnect %s mounts and focuses its actual provider control without actions',async(destination,hash,id)=>{
 const {providerSettingsHash}=await import('../src/renderer/provider-settings');
 const {viewFor}=await import('../src/renderer/App');
 expect(providerSettingsHash(destination)).toBe(hash);expect(viewFor(hash)).toBe('settings');
 const provider={getStatus:vi.fn(async()=>null),setClaudeKey:vi.fn(),verifyClaudeKey:vi.fn(),removeClaudeKey:vi.fn(),codexLogin:vi.fn(),codexLogout:vi.fn()};
 Object.assign(globalThis,{inquello:{provider}});location.hash=hash;render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 const target=id?document.getElementById(id):document.querySelector('[data-provider-action="codex-chatgpt"]');
 expect(target).not.toBeNull();expect(document.activeElement).toBe(target);
 await waitFor(()=>expect(provider.getStatus).toHaveBeenCalled());
 for(const action of [provider.setClaudeKey,provider.verifyClaudeKey,provider.removeClaudeKey,provider.codexLogin,provider.codexLogout])expect(action).not.toHaveBeenCalled();
});
it('switching provider destinations focuses the newly requested control after commit, unknown targets cannot select arbitrary DOM',async()=>{
 const {providerSettingsHash}=await import('../src/renderer/provider-settings');expect(providerSettingsHash('constructor')).toBe('#settings-providers');expect(providerSettingsHash('some-secret-field')).toBe('#settings-providers');
 location.hash='#settings-providers-claude';render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()}/>);
 expect(document.activeElement).toBe(document.getElementById('provider-claude-key'));
 act(()=>{location.hash='#settings-providers-openai';window.dispatchEvent(new HashChangeEvent('hashchange'));});
 expect(document.activeElement).toBe(document.getElementById('provider-codex-key'));
});
