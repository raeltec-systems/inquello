// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Providers} from '../src/renderer/Providers';
import type {ProviderStatusView} from '../src/renderer/bridge';

const status:ProviderStatusView={
 claude:{state:'stored-unverified',storage:'os-backed'},
 codex:{state:'connected',account:{type:'apiKey'},credentialStore:'os-keyring'},
 routes:{'claude-api-key':{authorized:true,reason:'Synthetic stored key'},'codex-inherited':{authorized:true,reason:'Synthetic connection'}},
};
const SECRET='synthetic-provider-key-never-display';
const PRIVATE_ERROR='private bridge diagnostic never display';
const cases=[
 {label:'Claude store',method:'setClaudeKey',button:'Store key',field:'Claude API key'},
 {label:'Claude check',method:'verifyClaudeKey',button:'Check key'},
 {label:'Claude remove',method:'removeClaudeKey',button:'Remove key'},
 {label:'OpenAI connect',method:'codexLogin',button:'Connect with API key',field:'OpenAI API key'},
 {label:'OpenAI disconnect',method:'codexLogout',button:'Disconnect'},
] as const;
function fixture(){
 const provider={getStatus:vi.fn(async()=>status),setClaudeKey:vi.fn(async()=>({ok:true,status})),verifyClaudeKey:vi.fn(async()=>({ok:true,status})),removeClaudeKey:vi.fn(async()=>({ok:true,status})),codexLogin:vi.fn(async()=>({ok:true,status})),codexLogout:vi.fn(async()=>({ok:true,status}))};
 Object.assign(globalThis,{inquello:{provider}});return provider;
}
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');});

describe.each(['synchronous throw','rejected promise'] as const)('provider action recovery after %s',failure=>{
 it.each(cases)('$label releases pending controls, protects input and allows a deliberate retry',async testCase=>{
  const provider=fixture();
  const action=provider[testCase.method];
  action.mockImplementationOnce(()=>{if(failure==='synchronous throw')throw new Error(PRIVATE_ERROR);return Promise.reject(new Error(PRIVATE_ERROR));});
  render(<Providers/>);await screen.findByText('Connected');
  const field='field' in testCase?screen.getByLabelText<HTMLInputElement>(testCase.field):null;
  if(field)fireEvent.change(field,{target:{value:SECRET}});
  const button=screen.getByRole('button',{name:testCase.button});
  fireEvent.click(button);
  expect(await screen.findByText('The request did not complete.')).toBeTruthy();
  await waitFor(()=>expect(button.getAttribute('aria-busy')).toBeNull());
  expect(screen.getByRole('button',{name:'Refresh provider status'}).getAttribute('aria-disabled')).toBeNull();
  expect(action).toHaveBeenCalledTimes(1);
  if(field){expect(field.value).toBe('');fireEvent.change(field,{target:{value:SECRET}});}
  expect(document.body.textContent).not.toContain(PRIVATE_ERROR);
  expect(document.body.textContent).not.toContain(SECRET);
  expect(button.getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(button);
  await waitFor(()=>expect(action).toHaveBeenCalledTimes(2));
  await waitFor(()=>expect(button.getAttribute('aria-busy')).toBeNull());
  expect(screen.queryByText('The request did not complete.')).toBeNull();
  if(field)expect(field.value).toBe('');
 });
});
