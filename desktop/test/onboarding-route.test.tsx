// @vitest-environment jsdom
import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('../src/renderer/Shell/Shell',()=>({Shell:()=> <div data-testid="retained-conversation">Existing private conversation</div>}));
vi.mock('../src/renderer/Specimen',()=>({Specimen:()=> <div>Settings</div>}));
import {App,viewFor} from '../src/renderer/App';
afterEach(()=>{cleanup();globalThis.location.hash='';});
it('keeps the existing conversation Shell mounted while onboarding is open',async()=>{
 globalThis.location.hash='#shell';render(<App/>);const before=screen.getByTestId('retained-conversation');
 await act(async()=>{globalThis.location.hash='#onboarding';globalThis.dispatchEvent(new HashChangeEvent('hashchange'));});
 expect(screen.getByTestId('retained-conversation')).toBe(before);expect(before.parentElement?.hidden).toBe(true);
 expect(screen.getByRole('heading',{name:'Make room for private work.'})).toBeTruthy();
 expect(viewFor('#onboarding')).toBe('onboarding');expect(viewFor('#task-any')).toBe('shell');
});
