// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Shell} from '../src/renderer/Shell/Shell';
const workspace='22222222-2222-4222-8222-222222222222';
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;});
function setup(){
 const state={recovered:false,signedIn:true};let sessionChanged:((identity:boolean)=>void)|undefined;
 const mutations={createTask:vi.fn(),renameTask:vi.fn(),moveTask:vi.fn(),createEngagement:vi.fn(),createFolder:vi.fn(),updateEngagement:vi.fn()};
 const getWorkspaces=vi.fn(async()=>({signedIn:state.signedIn,sharedService:'available',workspaces:state.signedIn?[{workspaceId:workspace,name:'Fictional Workspace',source:'service'}]:[],engagementCreation:{enabled:false,reason:'Not part of this test'}}));
 const getTree=vi.fn(async()=>state.recovered?{ok:true,value:{workspaceId:workspace,engagements:[],folders:[],tasks:[]}}:{ok:false,code:'failed',reason:'Private work is unavailable until current access is checked.'});
 const recoverNavigation=vi.fn(async(_input:{workspaceId:string}):Promise<unknown>=>{state.recovered=true;return{ok:true,value:{accepted:true}};});
 (globalThis as {inquello?:unknown}).inquello={organise:{...mutations,getWorkspaces,getTree,recoverNavigation},tasks:{onSessionChanged:(listener:(identity:boolean)=>void)=>{sessionChanged=listener;return()=>{};}},identity:{signIn:vi.fn()}};
 render(<Shell onShowSpecimen={()=>{}}/>);
 return{state,getTree,getWorkspaces,recoverNavigation,mutations,changed:()=>sessionChanged?.(true)};
}
describe('explicit Refresh workspace action',()=>{
 it('does nothing automatically, then keyboard activation reauthorizes and reads without replaying mutations',async()=>{
  const h=setup(),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  expect(h.recoverNavigation).not.toHaveBeenCalled();const before=h.getTree.mock.calls.length;
  button.focus();await user.keyboard('{Enter}');
  await waitFor(()=>expect(h.getTree.mock.calls.length).toBeGreaterThan(before));
  expect(h.recoverNavigation).toHaveBeenCalledExactlyOnceWith({workspaceId:workspace});
  expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull();
  for(const mutation of Object.values(h.mutations))expect(mutation).not.toHaveBeenCalled();
 });
 it('does not read private tree after refused recovery and explains revoked access remains denied',async()=>{
  const h=setup(),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  h.recoverNavigation.mockResolvedValueOnce({ok:false,code:'failed',reason:'Refused'});const before=h.getTree.mock.calls.length;
  await user.click(button);await screen.findByText(/Workspace access could not be restored/);
  expect(h.getTree).toHaveBeenCalledTimes(before);expect(screen.getByText(/Revoked permissions remain denied/)).toBeTruthy();
  for(const mutation of Object.values(h.mutations))expect(mutation).not.toHaveBeenCalled();
 });
 it('ignores late recovery after identity change and cannot restore old private work',async()=>{
  const h=setup(),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  let resolve!:(value:unknown)=>void;
  h.recoverNavigation.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  await user.click(button);await waitFor(()=>expect(h.recoverNavigation).toHaveBeenCalledTimes(1));
  await act(async()=>{h.state.signedIn=false;h.changed();});
  const before=h.getTree.mock.calls.length;await act(async()=>resolve({ok:true,value:{accepted:true}}));
  expect(h.getTree).toHaveBeenCalledTimes(before);expect(document.querySelector('[data-task-view]')).toBeNull();expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull();
 });
});


it('does not offer workspace recovery for a resolved question notice',async()=>{
 const task={taskId:'33333333-3333-4333-8333-333333333333',workspaceId:workspace,engagementId:null,folderId:null,title:'Fictional question Task',runtimeThreadId:null,sourceRefs:[],artifactRefs:[],visibility:'private',pinned:false,archived:false,revision:1};
 const q={taskId:task.taskId,workspaceId:workspace,requestId:'old-request',turnId:'turn',itemId:'shared-item',question:'Which vendor?'};
 let resolve!:(value:unknown)=>void,reads=0;const recoverNavigation=vi.fn();
 const progress=()=>({ok:true,value:{version:1,taskId:task.taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status:'running',historyIncomplete:false,items:[],plan:[],results:[],artifact:'absent',questions:[{requestId:++reads===1?'old-request':'replacement',threadId:'thread',turnId:'turn',itemId:q.itemId,questions:[]}],sessionGeneration:1}});
 (globalThis as {inquello?:unknown}).inquello={organise:{recoverNavigation,getWorkspaces:async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:workspace,name:'Fictional Workspace',source:'service'}],engagementCreation:{enabled:false}}),getTree:async()=>({ok:true,value:{workspaceId:workspace,engagements:[],folders:[],tasks:[task]}}),reopen:()=>new Promise(r=>{resolve=r;})},tasks:{inbox:async()=>({ok:true,value:{workspaceId:workspace,items:[q],unavailable:false}}),progress:async()=>progress()}};
 render(<Shell onShowSpecimen={()=>{}}/>);await screen.findByRole('link',{name:task.title});
 const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Inbox'}));await user.click(await screen.findByRole('button',{name:/Which vendor/}));
 await act(async()=>resolve({ok:true,value:{task,hit:null}}));await screen.findByText(/selected question was resolved or replaced while opening/);
 expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull();expect(recoverNavigation).not.toHaveBeenCalled();expect(document.querySelector('[data-task-view]')).toBeNull();
});
