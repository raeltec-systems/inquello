// @vitest-environment jsdom
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {useProviderConsent} from '../src/renderer/provider-consent';
import type {ProviderBridge} from '../src/renderer/bridge';
const workspace='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const view={workspace_id:workspace,workspace_name:'Fictional workspace',provider:'openai-api',contract_id:'openai-api-standard-v1',contract_version:1,contract_digest:'a'.repeat(64),consent_text:'Allow permitted context.',revision:'1',state:'allowed',can_manage:true,authorization_epoch:'2',policy_revision:'1'};
const response=(changes:Record<string,unknown>={})=>({ok:true,value:{view:{...view,...changes},pending:null}});
function deferred(){let resolve!:(value:unknown)=>void;const promise=new Promise<unknown>(done=>{resolve=done;});return{promise,resolve};}
function setup(){
 const consent=vi.fn<(...args:unknown[])=>Promise<unknown>>(async()=>response());
 const changeConsent=vi.fn<(...args:unknown[])=>Promise<unknown>>(async()=>response({state:'revoked',revision:'2'}));
 let session!:()=>void;
 Object.assign(globalThis,{inquello:{tasks:{onSessionChanged:(fn:()=>void)=>{session=fn;return()=>{};}}}});
 const bridge={consent,changeConsent} as unknown as ProviderBridge;
 const hook=renderHook(({id})=>useProviderConsent(bridge,id),{initialProps:{id:workspace}});
 return {...hook,consent,changeConsent,session:()=>session()};
}
afterEach(()=>{cleanup();vi.useRealTimers();delete(globalThis as {inquello?:unknown}).inquello;});
describe('owner consent renderer observations',()=>{
 it.each(['allow','revoke'] as const)('older GET cannot overwrite completed %s',async action=>{
  vi.useFakeTimers();const h=setup();await act(async()=>{await Promise.resolve();});expect(h.result.current.state).not.toBeNull();
  const old=deferred();h.consent.mockReturnValueOnce(old.promise);
  await act(async()=>{await vi.advanceTimersByTimeAsync(30_000);});
  const state=action==='allow'?'allowed':'revoked';h.changeConsent.mockResolvedValueOnce(response({state,revision:'2'}));
  await act(async()=>{await h.result.current.act(action);});
  await act(async()=>{old.resolve(response({state:'changed',revision:'0'}));});
  expect(h.result.current.state?.view.state).toBe(state);expect(h.result.current.state?.view.revision).toBe('2');
  expect(h.changeConsent).toHaveBeenCalledTimes(1);
 });
 it('newer overlapping poll wins without any mutation',async()=>{
  vi.useFakeTimers();const h=setup();await act(async()=>{await Promise.resolve();});expect(h.result.current.state).not.toBeNull();
  const old=deferred(),latest=deferred();h.consent.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});expect(h.consent).toHaveBeenCalledTimes(3);
  await act(async()=>{latest.resolve(response({state:'revoked',revision:'3'}));});
  await act(async()=>{old.resolve(response({state:'allowed',revision:'2'}));});
  expect(h.result.current.state?.view.revision).toBe('3');expect(h.changeConsent).not.toHaveBeenCalled();
 });
 it('workspace switch suppresses a late grant and observes only the new workspace',async()=>{
  const h=setup();await waitFor(()=>expect(h.result.current.state).not.toBeNull());const pending=deferred();h.changeConsent.mockReturnValueOnce(pending.promise);
  let action!:Promise<void>;act(()=>{action=h.result.current.act('allow');});
  h.consent.mockResolvedValueOnce(response({workspace_id:other,state:'not_allowed',revision:'0'}));h.rerender({id:other});
  await waitFor(()=>expect(h.result.current.state?.view.workspace_id).toBe(other));
  await act(async()=>{pending.resolve(response({state:'allowed',revision:'2'}));await action;});
  expect(h.result.current.state?.view.workspace_id).toBe(other);expect(h.result.current.state?.view.state).toBe('not_allowed');
 });
 it('session loss fences a pending result and automatically rereads without resending',async()=>{
  const h=setup();await waitFor(()=>expect(h.result.current.state).not.toBeNull());const pending=deferred();h.changeConsent.mockReturnValueOnce(pending.promise);
  let action!:Promise<void>;act(()=>{action=h.result.current.act('allow');});
  h.consent.mockResolvedValueOnce({ok:false,reason:'Sign in again.'});act(()=>h.session());
  await waitFor(()=>expect(h.result.current.notice).toBe('Sign in again.'));
  await act(async()=>{pending.resolve(response({state:'allowed',revision:'2'}));await action;});
  expect(h.result.current.state).toBeNull();expect(h.changeConsent).toHaveBeenCalledTimes(1);
 });
 it('workspace change during personal connection never grants the old workspace',async()=>{
  const h=setup();await waitFor(()=>expect(h.result.current.state).not.toBeNull());let finish!:(ok:boolean)=>void;
  let action!:Promise<void>;act(()=>{action=h.result.current.act('allow',()=>new Promise(done=>{finish=done;}));});
  h.consent.mockResolvedValueOnce(response({workspace_id:other}));h.rerender({id:other});
  await act(async()=>{finish(true);await action;});expect(h.changeConsent).not.toHaveBeenCalled();
 });
});
