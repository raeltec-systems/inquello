// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {ProcessingRoutes} from '../src/renderer/ProcessingRoutes';
import {modelCatalog,modelBindingId,taskRouteView} from './model-fixtures';
import type {RouteView,ResolveModelInput,BindingStateInput,SelectModelInput} from '../src/main/routes/types';
const taskId='22222222-2222-4222-8222-222222222222';
const route:RouteView={routeId:'claude-api-key',provider:'Anthropic',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:taskId,region:null},endpoint:'https://api.anthropic.com/v1/messages',revision:1,credentialPresent:false,adapterSupported:true,verification:'not_verified',enabled:false,gate:'Qualification pending',limits:[],evidence:[],executionFlow:'This device',inferenceFlow:'Selected provider',connectorFlow:'Separate'};
function setup(){
 const data=modelCatalog([route]);const pendingModel=vi.fn(async()=>({ok:true,value:{operation:null as unknown}}));const catalog=vi.fn(async()=>({ok:true,value:data})),resolve=vi.fn(async(_input:ResolveModelInput)=>({ok:true,value:data.bindings[0]!})),bindingState=vi.fn(async(_input:BindingStateInput)=>({ok:true,value:data.bindings[0]!}));
 const forTask=vi.fn(async()=>({ok:true,value:taskRouteView({taskId,workspaceId:taskId,revision:3,configurationRevision:1,staleConfiguration:false,selected:route})})),selectModel=vi.fn(async(_input:SelectModelInput)=>({ok:true,value:taskRouteView({taskId,workspaceId:taskId,revision:4,configurationRevision:1,staleConfiguration:false,selected:route})}));
 let changed:(()=>void)|undefined;
 Object.assign(globalThis,{inquello:{routes:{pendingModel,catalog,resolve,bindingState,forTask,selectModel,onChanged:(fn:()=>void)=>{changed=fn;return()=>{};}}}});
 return{data,pendingModel,catalog,resolve,bindingState,forTask,selectModel,changed:()=>changed?.()};
}
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;});
it('requires only a supported model name and performs no action on mount',async()=>{
 const h=setup();render(<ProcessingRoutes/>);await screen.findByRole('combobox',{name:'Model'});
 await screen.findByText(/Qualification pending/);expect(h.resolve).not.toHaveBeenCalled();expect(h.bindingState).not.toHaveBeenCalled();expect(h.selectModel).not.toHaveBeenCalled();
 for(const label of ['Deployment','Endpoint','API version','Region','Account reference','Exact model identifier'])expect(screen.queryByLabelText(label)).toBeNull();
 expect(document.querySelector('details')).toBeNull();expect(document.body.textContent).not.toContain('https://api.anthropic.com');
 fireEvent.change(screen.getByLabelText('Model'),{target:{value:'a'.repeat(64)}});await userEvent.click(screen.getByRole('button',{name:'Save model'}));
 expect(h.resolve).toHaveBeenCalledWith({operationId:expect.any(String),catalogVersion:'c'.repeat(64),choiceId:'a'.repeat(64)});
});
it.each([
 ['synthetic-only','Qualified for fictional work only.'],
 ['requires-fresh-policy','Model qualification verified. Current workspace approval and account access are checked before use.'],
 ['unqualified','Current availability must be checked before use.'],
])('presents %s qualification without asserting current authority',async(qualification,message)=>{
 const h=setup();Object.assign(h.data.bindings[0]!,{qualification,available:false,reason:null});
 render(<ProcessingRoutes/>);await screen.findByText(new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 expect(h.resolve).not.toHaveBeenCalled();expect(h.bindingState).not.toHaveBeenCalled();
});
it('retains its exact choice and operation after an ambiguous response and retries the same payload',async()=>{
 const h=setup();h.resolve.mockRejectedValueOnce(new Error('Response lost'));render(<ProcessingRoutes/>);await screen.findByText(/Qualification pending/);
 fireEvent.change(screen.getByLabelText('Model'),{target:{value:'a'.repeat(64)}});await userEvent.click(screen.getByRole('button',{name:'Save model'}));await screen.findByText(/Response lost/);
 const original=h.resolve.mock.calls[0]?.[0];act(()=>h.changed());await waitFor(()=>expect(h.catalog).toHaveBeenCalledTimes(2));
 expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('a'.repeat(64));await userEvent.click(screen.getByRole('button',{name:'Retry same model operation'}));expect(h.resolve.mock.calls[1]?.[0]).toEqual(original);
});
it('keeps a model draft under offline catalog failure',async()=>{
 const h=setup();render(<ProcessingRoutes/>);await screen.findByText(/Qualification pending/);fireEvent.change(screen.getByLabelText('Model'),{target:{value:'a'.repeat(64)}});
 h.catalog.mockRejectedValueOnce(new Error('Offline'));await userEvent.click(screen.getByRole('button',{name:'Refresh models'}));await screen.findByText(/Your choice and any unconfirmed operation are retained/);
 expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('a'.repeat(64));expect(h.resolve).not.toHaveBeenCalled();
});
it('selects a saved opaque binding using the actual conversation CAS revision',async()=>{
 const h=setup();render(<ProcessingRoutes taskId={taskId}/>);await screen.findByRole('option',{name:/Anthropic · claude/});fireEvent.change(screen.getByLabelText('Model'),{target:{value:modelBindingId(1)}});
 await userEvent.click(screen.getByRole('button',{name:'Change conversation model'}));expect(h.selectModel).toHaveBeenCalledWith({operationId:expect.any(String),taskId,expectedRevision:3,bindingId:modelBindingId(1)});
});
it('retains an unavailable saved model name without selecting another',async()=>{
 const h=setup();h.forTask.mockResolvedValue({ok:true,value:taskRouteView({taskId,workspaceId:taskId,revision:3,configurationRevision:1,staleConfiguration:true,selected:route})});
 h.data.bindings[0]!.state='revoked';h.data.bindings[0]!.reason='This saved model was revoked.';render(<ProcessingRoutes taskId={taskId}/>);
 await screen.findByText('This saved model was revoked.');expect(screen.getByText('claude-sonnet-5-5')).toBeTruthy();expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('');expect(h.selectModel).not.toHaveBeenCalled();
});
it.each([['claude-api-key','anthropic-direct','provider-claude-key'],['codex-responses','openai-api','provider-codex-key'],['codex-responses','chatgpt-codex','codex-chatgpt']])('reconnects the saved %s account through its existing secure destination',async(routeId,deployment,destination)=>{
 const h=setup(),onReconnect=vi.fn();const selected={...route,routeId,provider:routeId==='claude-api-key'?'Anthropic':'OpenAI',configuration:{...route.configuration!,routeId,deployment}};
 h.forTask.mockResolvedValue({ok:true,value:taskRouteView({taskId,workspaceId:taskId,revision:3,configurationRevision:1,staleConfiguration:false,selected: selected as never})} as never);
 render(<ProcessingRoutes taskId={taskId} onReconnect={onReconnect}/>);await userEvent.click(await screen.findByRole('button',{name:`Connect ${selected.provider}`}));expect(onReconnect).toHaveBeenCalledWith(destination);expect(h.resolve).not.toHaveBeenCalled();expect(h.selectModel).not.toHaveBeenCalled();
});
it('deliberately revalidates the exact unavailable legacy model with independent state CAS',async()=>{
 const h=setup();h.data.bindings[0]!.state='legacy-superseded';h.data.bindings[0]!.stateRevision=7;h.bindingState.mockRejectedValueOnce(new Error('Reply lost'));
 render(<ProcessingRoutes/>);const label='Revalidate saved claude-sonnet-5-5';await userEvent.click(await screen.findByRole('button',{name:label}));await screen.findByText(/Reply lost/);const command=h.bindingState.mock.calls[0]?.[0];
 await userEvent.click(screen.getByRole('button',{name:label}));expect(h.bindingState.mock.calls[1]?.[0]).toEqual(command);expect(command).toEqual({operationId:expect.any(String),bindingId:modelBindingId(1),expectedRevision:7,state:'active'});expect(h.resolve).not.toHaveBeenCalled();
});
it('revokes only the chosen exact binding using its state revision',async()=>{
 const h=setup();render(<ProcessingRoutes/>);await userEvent.click(await screen.findByRole('button',{name:'Revoke claude-sonnet-5-5'}));expect(h.bindingState).toHaveBeenCalledWith({operationId:expect.any(String),bindingId:modelBindingId(1),expectedRevision:1,state:'revoked'});expect(h.selectModel).not.toHaveBeenCalled();
});
it('restores an ambiguous resolve across navigation and retries the identical command even when the catalog is lost',async()=>{
 const h=setup();h.resolve.mockRejectedValueOnce(new Error('Response lost'));const view=render(<ProcessingRoutes/>);await screen.findByText(/Qualification pending/);
 fireEvent.change(screen.getByLabelText('Model'),{target:{value:'a'.repeat(64)}});await userEvent.click(screen.getByRole('button',{name:'Save model'}));await screen.findByText(/Response lost/);
 const input=h.resolve.mock.calls[0]![0];h.pendingModel.mockResolvedValue({ok:true,value:{operation:{kind:'resolve',input}}});view.unmount();
 h.catalog.mockRejectedValue(new Error('Catalog unavailable'));render(<ProcessingRoutes/>);await screen.findByText(/any unconfirmed operation are retained/);
 await userEvent.click(screen.getByRole('button',{name:'Retry same model operation'}));expect(h.resolve.mock.calls[1]![0]).toEqual(input);
});
it('restores an ambiguous saved conversation selection after remount with the original CAS',async()=>{
 const h=setup();h.selectModel.mockRejectedValueOnce(new Error('Response lost'));const view=render(<ProcessingRoutes taskId={taskId}/>);await screen.findByRole('option',{name:/Anthropic · claude/});
 fireEvent.change(screen.getByLabelText('Model'),{target:{value:modelBindingId(1)}});await userEvent.click(screen.getByRole('button',{name:'Change conversation model'}));await screen.findByText(/Response lost/);
 const input=h.selectModel.mock.calls[0]![0];h.pendingModel.mockResolvedValue({ok:true,value:{operation:{kind:'select',input}}});view.unmount();render(<ProcessingRoutes taskId={taskId}/>);
 await userEvent.click(await screen.findByRole('button',{name:'Retry same model operation'}));expect(h.selectModel.mock.calls[1]![0]).toEqual(input);expect(input.expectedRevision).toBe(3);
});

it('drops late owner results and restores only the newly signed-in principal journal',async()=>{
 const h=setup();let session!: (identityChanged:boolean)=>void;let release!:(value:Awaited<ReturnType<typeof h.resolve>>)=>void;
 Object.assign((globalThis as unknown as {inquello:Record<string,unknown>}).inquello,{tasks:{onSessionChanged:(fn:typeof session)=>{session=fn;return()=>{};}}});
 h.resolve.mockImplementationOnce(()=>new Promise(r=>{release=r;}));const view=render(<ProcessingRoutes/>);await screen.findByText(/Qualification pending/);
 fireEvent.change(screen.getByLabelText('Model'),{target:{value:'a'.repeat(64)}});await userEvent.click(screen.getByRole('button',{name:'Save model'}));
 act(()=>session(true));await act(async()=>release({ok:true,value:h.data.bindings[0]!}));expect(screen.queryByRole('button',{name:'Retry same model operation'})).toBeNull();expect(screen.queryByText(/Qualification pending/)).toBeNull();
 view.unmount();render(<ProcessingRoutes/>);await screen.findByText(/Qualification pending/);expect(screen.getByRole('button',{name:'Save model'})).toBeTruthy();expect((screen.getByLabelText('Model') as HTMLSelectElement).value).toBe('');
});

it('restores exact legacy revalidation across Settings remount without a new operation ID',async()=>{
 const h=setup();h.data.bindings[0]!.state='legacy-superseded';h.data.bindings[0]!.stateRevision=7;h.bindingState.mockRejectedValueOnce(new Error('Reply lost'));
 const view=render(<ProcessingRoutes/>);await userEvent.click(await screen.findByRole('button',{name:'Revalidate saved claude-sonnet-5-5'}));await screen.findByText(/Reply lost/);
 const input=h.bindingState.mock.calls[0]![0];h.pendingModel.mockResolvedValue({ok:true,value:{operation:{kind:'state',input}}});view.unmount();render(<ProcessingRoutes/>);
 await userEvent.click(await screen.findByRole('button',{name:'Retry same model operation'}));expect(h.bindingState.mock.calls[1]![0]).toEqual(input);expect(h.resolve).not.toHaveBeenCalled();
});
