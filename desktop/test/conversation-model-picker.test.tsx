// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {ConversationModelPicker} from '../src/renderer/Shell/ConversationModelPicker';
import {Composer} from '../src/renderer/Shell/Composer';
import {modelCatalog,taskRouteView} from './model-fixtures';
import type {RouteView} from '../src/main/routes/types';
const taskId='11111111-1111-4111-8111-111111111111',otherTask='22222222-2222-4222-8222-222222222222',workspaceId='33333333-3333-4333-8333-333333333333';
const route:RouteView={routeId:'codex-responses',provider:'OpenAI',configurable:true,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'gpt-6.1-terra',apiVersion:'responses-v1',accountRef:'account',region:null},endpoint:'https://api.openai.com/v1/responses',revision:3,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['synthetic fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
const catalog=modelCatalog([route]),binding=catalog.bindings[0]!;
const task=(id=taskId,revision=1)=>taskRouteView({taskId:id,workspaceId,revision,selected:route,configurationRevision:3,staleConfiguration:false});
const ok=(value:unknown)=>({ok:true,value});
function setup(){
 const onResolved=vi.fn();let changed:((identity:boolean)=>void)|undefined;
 const api={catalog:vi.fn(async()=>ok(catalog)),pendingModel:vi.fn(async(_input:{taskId:string|null})=>ok({operation:null})),resolve:vi.fn(async(_input:unknown)=>ok(binding)),selectModel:vi.fn(async(_input:unknown)=>ok(task(taskId,2))),bindingState:vi.fn(),forTask:vi.fn(async(input:{taskId:string})=>ok(task(input.taskId)))};
 Object.assign(globalThis,{inquello:{routes:api,tasks:{onSessionChanged:(fn:typeof changed)=>{changed=fn;return()=>{};}}}});
 return {api,onResolved,invalidate:()=>changed?.(true)};
}
function View({id,onResolved,disabled=false}:{id?:string;onResolved?:(resolved:typeof binding)=>void;disabled?:boolean}){
 return <Composer draft={{taskId:id??null,value:'Keep this draft',onChange:()=>{}}} routeLabel={<ConversationModelPicker workspaceId={workspaceId} taskId={id} selected={null} onResolved={onResolved} disabled={disabled}/>}/>;
}
async function choose(){fireEvent.click(screen.getByRole('button',{name:'Choose model'}));fireEvent.click(await screen.findByRole('menuitemradio',{name:'GPT-6.1 Terra'}));}
afterEach(()=>{cleanup();delete (globalThis as {inquello?:unknown}).inquello;});
it('chooses an unresolved model in one menu without Save, starts no work and focuses the composer',async()=>{
 const x=setup();render(<View onResolved={x.onResolved}/>);await waitFor(()=>expect(x.api.catalog).toHaveBeenCalled());await choose();
 await waitFor(()=>expect(x.onResolved).toHaveBeenCalledWith(binding));
 expect(x.api.resolve).toHaveBeenCalledTimes(1);expect(x.api.selectModel).not.toHaveBeenCalled();
 expect(screen.queryByRole('menu')).toBeNull();expect(screen.queryByText('Save model')).toBeNull();
 expect(document.activeElement).toBe(screen.getByRole('textbox'));expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Keep this draft');
});
it('resolves then selects only this conversation with its current revision',async()=>{
 const x=setup();x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));
 render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();
 await waitFor(()=>expect(x.api.selectModel).toHaveBeenCalledTimes(1));
 expect(x.api.selectModel.mock.calls[0]![0]).toMatchObject({taskId,expectedRevision:1,bindingId:binding.bindingId});
 expect(x.api.pendingModel).toHaveBeenCalledWith({taskId:null});expect(x.api.pendingModel).toHaveBeenCalledWith({taskId});
});
it('checks the current model and selecting it again is a no-op',async()=>{
 const x=setup();render(<View id={taskId}/>);await waitFor(()=>expect(screen.getByRole('button',{name:'Choose model'}).textContent).toContain('GPT-6.1 Terra'));
 fireEvent.click(screen.getByRole('button',{name:'Choose model'}));const choice=screen.getByRole('menuitemradio',{name:'GPT-6.1 Terra'});expect(choice.getAttribute('aria-checked')).toBe('true');fireEvent.click(choice);expect(x.api.resolve).not.toHaveBeenCalled();expect(x.api.selectModel).not.toHaveBeenCalled();
});
it('does not select a new conversation when a prior resolve completes late',async()=>{
 const x=setup();let finish!:(v:ReturnType<typeof ok>)=>void;x.api.resolve.mockImplementation(()=>new Promise(r=>{finish=r;}));x.api.forTask.mockImplementation(async input=>ok({...task(input.taskId),selected:null,configurationRevision:null,disclosureBindings:[]}));
 const v=render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();v.rerender(<View id={otherTask}/>);
 await act(async()=>finish(ok(binding)));expect(x.api.selectModel).not.toHaveBeenCalled();
});
it('preserves an uncertain resolve UUID and never silently applies a restored intent',async()=>{
 const x=setup();x.api.resolve.mockRejectedValueOnce(new Error('lost acknowledgement'));
 const v=render(<View onResolved={x.onResolved}/>);await waitFor(()=>expect(x.api.catalog).toHaveBeenCalled());await choose();
 await screen.findByText('lost acknowledgement');const original=x.api.resolve.mock.calls[0]![0];
 v.unmount();x.api.pendingModel.mockImplementation(async input=>ok({operation:input.taskId===null?{kind:'resolve',input:original}:null}));
 render(<View id={taskId}/>);fireEvent.click(await screen.findByRole('button',{name:'Confirm model change'}));
 await waitFor(()=>expect(x.api.resolve).toHaveBeenCalledTimes(2));expect(x.api.resolve.mock.calls[1]![0]).toEqual(original);expect(x.api.selectModel).not.toHaveBeenCalled();expect(x.onResolved).not.toHaveBeenCalled();
});
it('retains the exact select UUID after lost acknowledgement, without another resolve',async()=>{
 const x=setup();x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));
 x.api.selectModel.mockRejectedValueOnce(new Error('unknown selection'));
 render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();await screen.findByText('unknown selection');
 const original=x.api.selectModel.mock.calls[0]![0];fireEvent.click(screen.getByRole('button',{name:'Confirm model change'}));
 await waitFor(()=>expect(x.api.selectModel).toHaveBeenCalledTimes(2));expect(x.api.selectModel.mock.calls[1]![0]).toEqual(original);expect(x.api.resolve).toHaveBeenCalledTimes(1);
});
it('does not chain a select after identity loss',async()=>{
 const x=setup();let finish!:(v:ReturnType<typeof ok>)=>void;x.api.resolve.mockImplementation(()=>new Promise(r=>{finish=r;}));x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));
 render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();act(()=>x.invalidate());await act(async()=>finish(ok(binding)));expect(x.api.selectModel).not.toHaveBeenCalled();
});
it('keeps model choice unavailable during active work without adding a queue',async()=>{
 const x=setup();render(<View id={taskId} disabled/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());fireEvent.click(screen.getByRole('button',{name:'Choose model'}));const choice=screen.getByRole('menuitemradio',{name:'GPT-6.1 Terra'});expect(choice.getAttribute('aria-disabled')).toBe('true');fireEvent.click(choice);expect(x.api.resolve).not.toHaveBeenCalled();expect(x.api.selectModel).not.toHaveBeenCalled();
});
it('shows definitive active-work refusal without losing the draft or retrying',async()=>{
 const x=setup();x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));
 x.api.selectModel.mockResolvedValue({ok:false,code:'refused',reason:'Finish or stop pending work.'} as any);
 render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();await screen.findByText('Finish or stop pending work.');
 expect(screen.queryByRole('button',{name:'Confirm model change'})).toBeNull();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Keep this draft');expect(x.api.selectModel).toHaveBeenCalledTimes(1);
});

it('closes a hidden Start menu and never applies its late resolve or steals visible focus',async()=>{
 const x=setup();let finish!:(v:ReturnType<typeof ok>)=>void;x.api.resolve.mockImplementation(()=>new Promise(r=>{finish=r;}));
 const view=(active:boolean)=><><input aria-label="Visible conversation"/><ConversationModelPicker active={active} workspaceId={workspaceId} selected={null} onResolved={x.onResolved}/></>;
 const v=render(view(true));await waitFor(()=>expect(x.api.catalog).toHaveBeenCalled());await choose();v.rerender(view(false));screen.getByRole('textbox',{name:'Visible conversation'}).focus();
 await act(async()=>finish(ok(binding)));expect(x.onResolved).not.toHaveBeenCalled();expect(screen.queryByRole('menu')).toBeNull();expect(screen.queryByRole('button',{name:'Choose model'})).toBeNull();expect(document.activeElement).toBe(screen.getByRole('textbox',{name:'Visible conversation'}));
});
it('retains the exact pending select when a retry returns another binding',async()=>{
 const x=setup();x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));x.api.selectModel.mockRejectedValueOnce(new Error('unknown selection')).mockResolvedValueOnce(ok(taskRouteView({taskId,workspaceId,revision:2,selected:{...route,revision:99},configurationRevision:99,staleConfiguration:false})));
 render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();await screen.findByText('unknown selection');const original=x.api.selectModel.mock.calls[0]![0];fireEvent.click(screen.getByRole('button',{name:'Confirm model change'}));await screen.findByText('Model selection was not confirmed.');expect(screen.getByRole('button',{name:'Confirm model change'})).toBeTruthy();expect(x.api.selectModel.mock.calls[1]![0]).toEqual(original);expect(x.api.resolve).toHaveBeenCalledTimes(1);
});
it('accepts its exact result when normal catalog and task notifications arrive before acknowledgements',async()=>{
 const x=setup();let notify!:(change:unknown)=>void;(x.api as any).onChanged=(fn:typeof notify)=>{notify=fn;return()=>{};};x.api.forTask.mockResolvedValue(ok({...task(),selected:null,configurationRevision:null,disclosureBindings:[]}));
 x.api.resolve.mockImplementation(async()=>{notify({authority:false});return ok(binding);});x.api.selectModel.mockImplementation(async()=>{notify({taskId});return ok(task(taskId,2));});render(<View id={taskId}/>);await waitFor(()=>expect(x.api.forTask).toHaveBeenCalled());await choose();await waitFor(()=>expect(x.api.selectModel).toHaveBeenCalledTimes(1));await waitFor(()=>expect(screen.queryByRole('button',{name:'Confirm model change'})).toBeNull());expect(x.api.resolve).toHaveBeenCalledTimes(1);
});

it.each(['missing bridge','denied journal'] as const)('never reports an authoritative empty journal after %s',async mode=>{
 const x=setup(),pending=vi.fn();if(mode==='missing bridge')delete (globalThis as any).inquello.routes;else x.api.pendingModel.mockRejectedValue(new Error('Journal unavailable'));
 render(<ConversationModelPicker workspaceId={workspaceId} taskId={taskId} selected={null} onPendingChange={pending}/>);await screen.findByText('Models are unavailable. Try again.');expect(pending).toHaveBeenCalledWith(true,true);expect(pending.mock.calls.every(([blocked])=>blocked===true)).toBe(true);expect(x.api.resolve).not.toHaveBeenCalled();expect(x.api.selectModel).not.toHaveBeenCalled();
});
