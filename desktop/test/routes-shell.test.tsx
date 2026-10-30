// @vitest-environment jsdom
/// <reference lib="dom" />
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessingRoutes } from '../src/renderer/ProcessingRoutes';
const taskId='22222222-2222-4222-8222-222222222222';
const route={routeId:'claude-api-key',provider:'Anthropic',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:taskId,region:null as string|null},endpoint:'https://api.anthropic.com/v1/messages',revision:1,credentialPresent:true,adapterSupported:true,verification:'not_verified',enabled:false,gate:'No passing route evidence',limits:['Text and runtime-owned tools only'],evidence:[],executionFlow:'This device',inferenceFlow:'Selected provider',connectorFlow:'Separate connection grants'};
function setup(){let change=()=>{};const list=vi.fn(async()=>({ok:true,value:[route]}));const forTask=vi.fn(async({taskId}:{taskId:string})=>({ok:true,value:{taskId,workspaceId:taskId,revision:0,configurationRevision:null,staleConfiguration:false,selected:null}}));const configure=vi.fn(async()=>({ok:true,value:[route]})),select=vi.fn(async()=>({ok:false,reason:'Route changed first. Refresh.'}));Object.defineProperty(globalThis,'inquello',{configurable:true,value:{routes:{list,forTask,configure,select,onChanged:(fn:()=>void)=>{change=fn;return()=>{};}}}});return{list,forTask,configure,select,change:()=>change()};}
afterEach(()=>{cleanup();Reflect.deleteProperty(globalThis,'inquello');});
describe('explicit route presentation',()=>{
 it('separates configuration, credential, adapter and evidence; unknown region',async()=>{setup();render(<ProcessingRoutes/>);await screen.findByText('No passing route evidence');expect(screen.getByText('Unknown')).toBeTruthy();expect(screen.getByText(/Present — not evidence/)).toBeTruthy();expect(screen.getByText(/Not verified — Not enabled/)).toBeTruthy();expect(screen.getByText('Execution: This device')).toBeTruthy();expect(screen.getByText('Connectors: Separate connection grants')).toBeTruthy();});
 it('shows no default and saves explicit Task selection at exact revisions',async()=>{const h=setup();render(<ProcessingRoutes taskId={taskId}/>);await screen.findByRole('button',{name:'Select Anthropic route for this Task'});expect(screen.getByText('No processing route explicitly selected')).toBeTruthy();await userEvent.click(screen.getByRole('button',{name:'Select Anthropic route for this Task'}));expect(h.select).toHaveBeenCalledWith(expect.objectContaining({taskId,expectedRevision:0,configurationRevision:1,routeId:'claude-api-key'}));expect(await screen.findByRole('status')).toHaveProperty('textContent','Route changed first. Refresh.');});
 it('configuration uses a keyboard form and never an eligibility toggle',async()=>{const h=setup();render(<ProcessingRoutes/>);const button=await screen.findByRole('button',{name:'Save Anthropic route configuration'});button.focus();await userEvent.keyboard('{Enter}');expect(h.configure).toHaveBeenCalledWith(expect.objectContaining({model:'claude-sonnet-5-5',apiVersion:'2026-10-21',region:null}));expect(screen.queryByRole('checkbox')).toBeNull();});
 it('old Task response cannot replace newly opened Task',async()=>{const h=setup();let release!:(v:unknown)=>void;h.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve as (v:unknown)=>void;}));const rendered=render(<ProcessingRoutes taskId={taskId}/>);await waitFor(()=>expect(release).toBeTypeOf('function'));rendered.rerender(<ProcessingRoutes taskId="other-task"/>);await waitFor(()=>expect(h.forTask).toHaveBeenCalledWith({taskId:'other-task'}));await act(async()=>release({ok:true,value:{taskId,workspaceId:taskId,revision:8,configurationRevision:1,staleConfiguration:false,selected:route}}));expect(screen.queryByText('Selected: Anthropic (claude-api-key)')).toBeNull();});
 it('invalidation makes old actions unavailable immediately',async()=>{const h=setup();render(<ProcessingRoutes taskId={taskId}/>);const button=await screen.findByRole('button',{name:'Select Anthropic route for this Task'});h.list.mockImplementationOnce(()=>new Promise(()=>{}));act(()=>h.change());await userEvent.click(button);expect(h.select).not.toHaveBeenCalled();});
});

it('a background two-window change cannot advance a dirty draft revision; explicit reload reconciles',async()=>{
 const h=setup();render(<ProcessingRoutes/>);
 const region=await screen.findByRole('textbox',{name:'Region (leave blank when unknown)'});
 await userEvent.type(region,'old-draft-region');
 h.list.mockResolvedValue({ok:true,value:[{...route,revision:2,configuration:{...route.configuration,region:'new-window-region'}}]});
 act(()=>h.change());
 await screen.findByRole('button',{name:'Reload current configuration and discard draft'});
 expect(region).toHaveProperty('value','old-draft-region');
 await userEvent.click(screen.getByRole('button',{name:'Save Anthropic route configuration'}));
 expect(h.configure).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Reload current configuration and discard draft'}));
 expect(region).toHaveProperty('value','new-window-region');
 await userEvent.click(screen.getByRole('button',{name:'Save Anthropic route configuration'}));
 expect(h.configure).toHaveBeenCalledWith(expect.objectContaining({expectedRevision:2,region:'new-window-region'}));
});

it('refreshing unchanged revision preserves draft values and original write revision',async()=>{
 const h=setup();render(<ProcessingRoutes/>);
 const region=await screen.findByRole('textbox',{name:'Region (leave blank when unknown)'});
 await userEvent.type(region,'draft-region');act(()=>h.change());
 await waitFor(()=>expect(h.list).toHaveBeenCalledTimes(2));
 await userEvent.click(screen.getByRole('button',{name:'Save Anthropic route configuration'}));
 expect(h.configure).toHaveBeenCalledWith(expect.objectContaining({expectedRevision:1,region:'draft-region'}));
});


it('shows candidate model, deployment, endpoint and evidence before Task selection',async()=>{
 const h=setup();render(<ProcessingRoutes taskId={taskId}/>);
 await screen.findByRole('button',{name:'Select Anthropic route for this Task'});
 expect(screen.getByText('No processing route explicitly selected')).toBeTruthy();
 expect(screen.getByText('claude-sonnet-5-5 / 2026-10-21')).toBeTruthy();
 expect(screen.getByText('anthropic-direct / https://api.anthropic.com/v1/messages')).toBeTruthy();
 expect(screen.getByText('Evidence: No passing evidence recorded')).toBeTruthy();
 expect(screen.getByText('Not verified — Not enabled')).toBeTruthy();
 expect(h.select).not.toHaveBeenCalled();
});

it('never labels a stale empty selection as no route and sanitizes read errors',async()=>{
 const h=setup();h.forTask.mockResolvedValueOnce({ok:true,value:{taskId,workspaceId:taskId,revision:1,configurationRevision:null,staleConfiguration:true,selected:null}});
 render(<ProcessingRoutes taskId={taskId}/>);
 await screen.findByText('Inference information stale — refresh and review the processing route');
 expect(screen.queryByText('No processing route explicitly selected')).toBeNull();
 h.list.mockRejectedValueOnce(new Error('secret transport credential'));act(()=>h.change());
 await screen.findByText('Processing routes unavailable. Refresh to review the current route.');
 expect(screen.queryByText(/secret transport credential/)).toBeNull();expect(screen.queryByText('No processing route explicitly selected')).toBeNull();
});

it('ordinary background refresh retains focused controls disabled until fresh facts arrive',async()=>{
 const timer = vi.spyOn(globalThis,'setInterval'); const h=setup();render(<ProcessingRoutes taskId={taskId}/>);
 const button=await screen.findByRole('button',{name:'Select Anthropic route for this Task'});button.focus();
 let release!: (value: Awaited<ReturnType<typeof h.list>>) => void;
 h.list.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const tick=timer.mock.calls.find(call=>call[1]===30000)![0] as ()=>void;
 act(()=>tick());expect(document.activeElement).toBe(button);expect(button.isConnected).toBe(true);expect(button.getAttribute('aria-disabled')).toBe('true');
 await act(async()=>release({ok:true,value:[route]}));await waitFor(()=>expect(button.getAttribute('aria-disabled')).not.toBe('true'));
 expect(document.activeElement).toBe(button);expect(screen.getByRole('button',{name:'Select Anthropic route for this Task'})).toBe(button);timer.mockRestore();
});
