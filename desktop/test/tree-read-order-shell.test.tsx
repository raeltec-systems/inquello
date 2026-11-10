// @vitest-environment jsdom
import {modelCatalog,modelBindingId} from './model-fixtures';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import {Shell} from '../src/renderer/Shell/Shell';
const workspace='22222222-2222-4222-8222-222222222222',taskId='33333333-3333-4333-8333-333333333333';
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;});
const task={taskId,workspaceId:workspace,engagementId:null,folderId:null,title:'Accepted fictional Task',runtimeThreadId:'thread',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};
const tree=(tasks:unknown[])=>({ok:true,value:{workspaceId:workspace,engagements:[],folders:[],tasks}});
async function acceptedWhileOldTreePending(newerFails=false){
 let finishOld!:(value:unknown)=>void;
 const getTree=vi.fn<()=>Promise<unknown>>().mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;})).mockImplementation(async()=>newerFails?{ok:false,code:'failed',reason:'Current private access refused.'}:tree([task]));
 const start=vi.fn(async(command:Record<string,unknown>)=>({ok:true,value:{operationId:command.operationId,taskId,runId:'run',threadId:'thread',status:'running',request:command.request,accepted:true}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:{getWorkspaces:async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:workspace,name:'Fictional Workspace',source:'service'}],engagementCreation:{enabled:false}}),getTree},routes:{catalog:async()=>({ok:true,value:modelCatalog([route as never])}),pendingModel:async()=>({ok:true,value:{operation:null}}),resolve:async()=>({ok:true,value:modelCatalog([route as never]).bindings[0]})},tasks:{preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start}}});
 render(<Shell onShowSpecimen={()=>{}}/>);const user=userEvent.setup();
 await waitFor(()=>expect(getTree).toHaveBeenCalledOnce());await user.click(await screen.findByRole('button',{name:'New chat'}));
 await user.click(await screen.findByRole('button',{name:'Choose model'}));await user.click(await screen.findByRole('menuitemradio',{name:'claude-sonnet-5-5'}));
 await user.type(screen.getByRole('textbox'),'Review fictional invoices.');await user.click(screen.getByLabelText('Send'));
 await waitFor(()=>expect(getTree.mock.calls.length).toBeGreaterThan(1));
 if(newerFails)await screen.findByText('Current private access refused.');else await screen.findByRole('link',{name:task.title});
 return{finishOld,start};
}
it('late pre-admission empty success cannot erase a newer admitted Task tree',async()=>{
 const h=await acceptedWhileOldTreePending();expect(document.querySelector('[data-task-view]')).not.toBeNull();
 await act(async()=>h.finishOld(tree([])));
 expect(screen.getByRole('link',{name:task.title})).toBeTruthy();expect(document.querySelector('[data-task-view]')).not.toBeNull();expect(h.start).toHaveBeenCalledOnce();
});
it('late success cannot restore private work after the newer inventory refused access',async()=>{
 const h=await acceptedWhileOldTreePending(true);await act(async()=>h.finishOld(tree([task])));
 expect(screen.queryByRole('link',{name:task.title})).toBeNull();expect(document.querySelector('[data-task-view]')).toBeNull();expect(screen.getByText('Current private access refused.')).toBeTruthy();expect(h.start).toHaveBeenCalledOnce();
});
it('even an older authority refusal clears the newer tree rather than preserving unauthorized content',async()=>{
 const h=await acceptedWhileOldTreePending();await act(async()=>h.finishOld({ok:false,code:'failed',reason:'Current private access refused.'}));
 expect(screen.queryByRole('link',{name:task.title})).toBeNull();expect(document.querySelector('[data-task-view]')).toBeNull();expect(screen.getByText('Current private access refused.')).toBeTruthy();expect(h.start).toHaveBeenCalledOnce();
});
