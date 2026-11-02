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
it('mounting Processing routes reads current catalog only, preserving explicit configuration',async()=>{
 const routes={list:vi.fn(async()=>({ok:true,value:[]})),configure:vi.fn(),select:vi.fn(),forTask:vi.fn()};Object.assign(globalThis,{inquello:{routes}});
 location.hash='#settings-routes';const back=vi.fn();render(<Settings onBack={back} onIdentityChanged={vi.fn()}/>);
 await waitFor(()=>expect(routes.list).toHaveBeenCalled());expect(routes.configure).not.toHaveBeenCalled();expect(routes.select).not.toHaveBeenCalled();expect(routes.forTask).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Back to chat'}));expect(back).toHaveBeenCalledOnce();
});
