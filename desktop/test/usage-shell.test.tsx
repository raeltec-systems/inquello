// @vitest-environment jsdom
/// <reference lib="dom" />
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {notifySettledWork} from '../src/main/usage/notifications';
import {TaskUsage} from '../src/renderer/Shell/TaskUsage';
import {facts,attempt,taskId,principal} from './usage-fixtures';
function setup(view=facts()){let change=(_privateScope:boolean)=>{};const unsubscribe=vi.fn();const forTask=vi.fn(async()=>({ok:true,value:view}));const set=vi.fn(async()=>({ok:true,value:view}));Object.defineProperty(globalThis,'inquello',{configurable:true,value:{usage:{forTask,set,onChanged:(fn:(privateScope:boolean)=>void)=>{change=fn;return unsubscribe;}}}});return{forTask,set,change:(privateScope=false)=>change(privateScope),unsubscribe};}
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');});
describe('Task choices and attributable history',()=>{
 it('requires explicit defaults, presents source limitations, inspection starts no work',async()=>{const h=setup();render(<TaskUsage taskId={taskId}/>);await screen.findByText(/Defaults are not saved yet/);expect(screen.getByLabelText('Reasoning')).toHaveProperty('value','default');expect(screen.getByText(/Messages supports provider defaults only/)).toBeTruthy();expect(screen.queryByRole('button',{name:/start/i})).toBeNull();expect(h.set).not.toHaveBeenCalled();await userEvent.click(screen.getByRole('button',{name:'Save Task settings'}));expect(h.set).toHaveBeenCalledWith(expect.objectContaining({taskId,expectedRevision:0,routeRevision:1,reasoning:'default',speed:'default'}));});
 it('keeps distinct failed/repeated snapshots and unknown usage, with reviewer separately labelled',async()=>{const view=facts();const a=attempt(),b=attempt('uncertain');b.snapshot.attempt_id=principal;b.snapshot.requested.reasoning='high';b.snapshot.effective.reasoning='high';b.output_ref='retained-output';view.usage.attempts=[a,b];setup(view);render(<TaskUsage taskId={taskId}/>);await screen.findByText('Automated permission review — failed');expect(screen.getByText('Automated permission review — uncertain')).toBeTruthy();expect(screen.getByText('retained-output')).toBeTruthy();expect(screen.getAllByText('high / default')).toHaveLength(2);expect(screen.getAllByText('12 / Unknown')).toHaveLength(2);expect(screen.getByText(/Do not automatically repeat/)).toBeTruthy();});
 it('calls unfinished records pending rather than asserting active provider work',async()=>{const view=facts();view.usage.attempts=[attempt('running')];setup(view);render(<TaskUsage taskId={taskId}/>);await screen.findByText('Automated permission review — Unfinished / outcome pending');});
 it('preserves draft after conflict and explicit refresh',async()=>{const view=facts();view.capabilities.reasoning=['default','high'];const h=setup(view);h.set.mockResolvedValue({ok:false,code:'conflict'} as never);render(<TaskUsage taskId={taskId}/>);await screen.findByLabelText('Reasoning');await userEvent.selectOptions(screen.getByLabelText('Reasoning'),'high');await userEvent.click(screen.getByRole('button',{name:'Save Task settings'}));await screen.findByText(/Your draft is preserved/);await userEvent.click(screen.getByRole('button',{name:'Refresh usage'}));await waitFor(()=>expect(screen.getByLabelText('Reasoning')).toHaveProperty('value','high'));});
 it('clears facts and drafts on private invalidation and ignores old responses',async()=>{const view=facts();view.capabilities.reasoning=['default','high'];view.usage.attempts=[attempt()];const h=setup(view);render(<TaskUsage taskId={taskId}/>);await screen.findByText('Automated permission review — failed');await userEvent.selectOptions(screen.getByLabelText('Reasoning'),'high');let release!:(r:unknown)=>void;h.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve as never;}));act(()=>h.change(true));expect(screen.queryByText('Automated permission review — failed')).toBeNull();h.forTask.mockResolvedValueOnce({ok:true,value:facts()});act(()=>h.change());await screen.findByLabelText('Reasoning');await act(async()=>release({ok:true,value:view}));expect(screen.queryByText('Automated permission review — failed')).toBeNull();expect(screen.getByLabelText('Reasoning')).toHaveProperty('value','default');});

 it('preserves unsaved choices when native history changes',async()=>{const view=facts();view.capabilities.reasoning=['default','high'];const h=setup(view);render(<TaskUsage taskId={taskId}/>);await screen.findByLabelText('Reasoning');await userEvent.selectOptions(screen.getByLabelText('Reasoning'),'high');act(()=>h.change(false));await waitFor(()=>expect(screen.getByLabelText('Reasoning')).toHaveProperty('value','high'));});
 it('discards Task responses and sanitizes transport failures',async()=>{const h=setup();let release!:(r:unknown)=>void;h.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve as never;}));const mounted=render(<TaskUsage taskId={taskId}/>);h.forTask.mockRejectedValueOnce(new Error('credential sentinel'));mounted.rerender(<TaskUsage taskId={principal}/>);await screen.findByRole('status');await act(async()=>release({ok:true,value:facts()}));expect(screen.queryByText(/credential sentinel/)).toBeNull();expect(screen.queryByLabelText('Reasoning')).toBeNull();});
 it('displays inherited limit refusal without implying reset or fallback',async()=>{const view=facts();view.limits={source:'Codex plan',status:'exhausted',reason:'Ordinary usage is not allowed.',nextAction:'Use permitted human handling; recheck current account usage.'};setup(view);render(<TaskUsage taskId={taskId}/>);await screen.findByText(/Codex plan: exhausted/);expect(screen.getByText(/Use permitted human handling; recheck/)).toBeTruthy();});
 it('binds receipt identity to the complete command across ordinary refreshes',async()=>{
  const h=setup();h.set.mockResolvedValue({ok:false,code:'unavailable'} as never);render(<TaskUsage taskId={taskId}/>);await screen.findByLabelText('Reasoning');
  await userEvent.click(screen.getByRole('button',{name:'Save Task settings'}));await screen.findByText(/Settings were not confirmed/);
  await userEvent.click(screen.getByRole('button',{name:'Save Task settings'}));await screen.findByText(/Settings were not confirmed/);
  const calls=()=>h.set.mock.calls as unknown as [{operationId:string;expectedRevision:number;routeRevision:number}][];
  expect(calls()[1]![0]).toEqual(calls()[0]![0]);
  const next=facts();next.usage.settings={revision:1,route_revision:2,choices:{reasoning:'default',speed:'default'}};next.capabilities.routeRevision=2;
  h.forTask.mockResolvedValue({ok:true,value:next});act(()=>h.change(false));await waitFor(()=>expect(screen.queryByText(/Defaults are not saved yet/)).toBeNull());
  await userEvent.click(screen.getByRole('button',{name:'Save Task settings'}));await screen.findByText(/Settings were not confirmed/);
  expect(calls()[2]![0]).toMatchObject({expectedRevision:1,routeRevision:2});expect(calls()[2]![0].operationId).not.toBe(calls()[0]![0].operationId);
 });
 it.each([false,true])('production sandbox completion (failure=%s) preserves mounted focus and draft during refresh',async(failed)=>{
  const view=facts();view.capabilities.reasoning=['default','high'];const h=setup(view);render(<TaskUsage taskId={taskId}/>);
  const control=await screen.findByLabelText('Reasoning');await userEvent.selectOptions(control,'high');control.focus();
  let release!:(value:unknown)=>void;h.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve as never;}));
  const environmentChanged=vi.fn((privateScope:boolean)=>h.change(privateScope));
  await act(async()=>{notifySettledWork('inquello/tools/exec',{sandboxProbeTarget:'/fixture'},failed?Promise.reject(new Error('probe refused')):Promise.resolve({}),{usageChanged:h.change,environmentChanged},fn=>fn());});
  expect(environmentChanged).toHaveBeenCalledExactlyOnceWith(false);expect(screen.getByLabelText('Reasoning')).toBe(control);expect(document.activeElement).toBe(control);expect(control).toHaveProperty('value','high');expect(control).toHaveProperty('disabled',false);
  await act(async()=>release({ok:true,value:view}));expect(document.activeElement).toBe(control);expect(control).toHaveProperty('value','high');
  act(()=>h.change(true));expect(screen.queryByLabelText('Reasoning')).toBeNull();await screen.findByLabelText('Reasoning');expect(screen.getByLabelText('Reasoning')).toHaveProperty('value','default');
 });
 it('labels local-tool choices as Task context, not effective model settings',async()=>{
  const view=facts(),tool=attempt();tool.snapshot.operation_kind='local-tool';tool.snapshot.effective.reasoning='high';tool.usage.input_tokens=null;view.usage.attempts=[tool];setup(view);
  render(<TaskUsage taskId={taskId}/>);await screen.findByText('Local tool invocation — failed');expect(screen.getByText('Task context: route / model / API')).toBeTruthy();expect(screen.getByText('Task context: requested reasoning / speed')).toBeTruthy();expect(screen.getByText('Not applicable — local tools do not use model settings')).toBeTruthy();expect(screen.queryByText('high / default')).toBeNull();
 });

});
