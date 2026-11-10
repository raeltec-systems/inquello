// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Shell} from '../src/renderer/Shell/Shell';
const workspace='22222222-2222-4222-8222-222222222222';
afterEach(()=>{cleanup();delete(globalThis as {inquello?:unknown}).inquello;});
const permittedTask={taskId:'33333333-3333-4333-8333-333333333333',workspaceId:workspace,engagementId:null,folderId:null,title:'Permitted saved chat',runtimeThreadId:null,sourceRefs:[],artifactRefs:[],visibility:'private',pinned:false,archived:false,revision:1};
const withheldTaskId='44444444-4444-4444-8444-444444444444';
function setup(partial=false){
 const state={recovered:false,signedIn:true,workspace};const sessionChanged=new Set<(identity:boolean)=>void>(),usageChanged=new Set<(privateScope:boolean)=>void>();
 const mutations={createTask:vi.fn(),renameTask:vi.fn(),moveTask:vi.fn(),createEngagement:vi.fn(),createFolder:vi.fn(),updateEngagement:vi.fn()};
 const execution={start:vi.fn(),resume:vi.fn(),turn:vi.fn()};
 const getWorkspaces=vi.fn(async()=>({signedIn:state.signedIn,sharedService:'available',workspaces:state.signedIn?[{workspaceId:state.workspace,name:'Fictional Workspace',source:'service'}]:[],engagementCreation:{enabled:false,reason:'Not part of this test'}}));
 const getTree=vi.fn(async():Promise<unknown>=>partial?{ok:true,value:{workspaceId:state.workspace,engagements:[],folders:[],tasks:state.workspace===workspace?[permittedTask,...(state.recovered?[{...permittedTask,taskId:withheldTaskId,title:'Freshly permitted saved chat'}]:[])]:[],unavailableTasks:!state.recovered&&state.workspace===workspace?[{taskId:withheldTaskId,reason:'current_authority_unavailable',title:'WITHHELD PRIVATE TITLE'}]:[]}}:state.recovered?{ok:true,value:{workspaceId:workspace,engagements:[],folders:[],tasks:[]}}:{ok:false,code:'failed',reason:'Private work is unavailable until current access is checked.'});
 const recoverNavigation=vi.fn(async(_input:{workspaceId:string}):Promise<unknown>=>{state.recovered=true;return{ok:true,value:{accepted:true}};});
 (globalThis as {inquello?:unknown}).inquello={organise:{...mutations,getWorkspaces,getTree,recoverNavigation},tasks:{...execution,onSessionChanged:(listener:(identity:boolean)=>void)=>{sessionChanged.add(listener);return()=>{sessionChanged.delete(listener);};}},identity:{signIn:vi.fn()},usage:{onChanged:(listener:(privateScope:boolean)=>void)=>{usageChanged.add(listener);return()=>{usageChanged.delete(listener);};}}};
 render(<Shell onShowSpecimen={()=>{}}/>);
 return{state,getTree,getWorkspaces,recoverNavigation,mutations,execution,changed:(identity=true)=>{for(const listener of [...sessionChanged])listener(identity);},reread:()=>{for(const listener of [...usageChanged])listener(true);}};
}
function expectNoExecution(h:ReturnType<typeof setup>){for(const operation of [...Object.values(h.mutations),...Object.values(h.execution)])expect(operation).not.toHaveBeenCalled();}
describe('explicit recovery from a partial tree with no open Task',()=>{
 it('keeps permitted rows and the unsent draft, then keyboard recovery reads fresh work without execution',async()=>{
  const h=setup(true),user=userEvent.setup();
  expect(await screen.findByRole('link',{name:permittedTask.title})).toBeTruthy();
  expect(document.querySelector('[data-task-view]')).toBeNull();
  const button=await screen.findByRole('button',{name:'Refresh workspace'});
  expect(h.recoverNavigation).not.toHaveBeenCalled();expect(document.body.textContent).not.toContain('WITHHELD PRIVATE TITLE');
  const draft=await screen.findByRole('textbox');await user.type(draft,'Unsent inspection draft');
  button.focus();await user.keyboard('{Enter}');
  expect(await screen.findByRole('link',{name:'Freshly permitted saved chat'})).toBeTruthy();
  expect(h.recoverNavigation).toHaveBeenCalledExactlyOnceWith({workspaceId:workspace});
  expect(screen.getByRole('textbox')).toHaveProperty('value','Unsent inspection draft');
  expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull();expectNoExecution(h);
 });
 it('preserves refusal without claiming hidden work was restored or reading it again',async()=>{
  const h=setup(true),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  h.recoverNavigation.mockResolvedValueOnce({ok:false,code:'failed',reason:'Refused'});const reads=h.getTree.mock.calls.length;
  await user.click(button);await screen.findByText(/Workspace access could not be restored/);
  expect(h.getTree).toHaveBeenCalledTimes(reads);expect(screen.queryByRole('link',{name:'Freshly permitted saved chat'})).toBeNull();
  expect(document.body.textContent).not.toContain('WITHHELD PRIVATE TITLE');expectNoExecution(h);
 });
 it('suppresses repeated activation while the same explicit check is pending',async()=>{
  const h=setup(true),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  let resolve!:(value:unknown)=>void;h.recoverNavigation.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  await user.dblClick(button);expect(h.recoverNavigation).toHaveBeenCalledTimes(1);
  expect(button.getAttribute('aria-busy')).toBe('true');expect(screen.getByText('Checking Workspace access')).toBeTruthy();
  await user.click(button);expect(h.recoverNavigation).toHaveBeenCalledTimes(1);
  await act(async()=>{h.state.recovered=true;resolve({ok:true,value:{accepted:true}});});
  await screen.findByRole('link',{name:'Freshly permitted saved chat'});expectNoExecution(h);
 });
 it.each(['identity','workspace'] as const)('discards late partial-tree recovery after current %s changes',async change=>{
  const h=setup(true),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  let resolve!:(value:unknown)=>void;h.recoverNavigation.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  await user.click(button);await waitFor(()=>expect(h.recoverNavigation).toHaveBeenCalledTimes(1));
  await act(async()=>{if(change==='identity')h.state.signedIn=false;else h.state.workspace='55555555-5555-4555-8555-555555555555';h.changed(change==='identity');});
  await waitFor(()=>{if(change==='identity')expect(screen.getByText('Sign in to see your Workspaces and private Tasks.')).toBeTruthy();else expect(h.getTree).toHaveBeenCalledTimes(2);});
  const reads=h.getTree.mock.calls.length;await act(async()=>resolve({ok:true,value:{accepted:true}}));
  expect(h.getTree).toHaveBeenCalledTimes(reads);expect(screen.queryByRole('link',{name:'Freshly permitted saved chat'})).toBeNull();
  expect(document.body.textContent).not.toContain('WITHHELD PRIVATE TITLE');expectNoExecution(h);
 });
 it('withdraws the access-check notice when a later ordinary read returns every Task',async()=>{
  const h=setup(true);await screen.findByRole('button',{name:'Refresh workspace'});
  h.state.recovered=true;await act(async()=>{h.reread();});
  expect(await screen.findByRole('link',{name:'Freshly permitted saved chat'})).toBeTruthy();
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull());
  expect(screen.queryByText(/needs a current access check/)).toBeNull();expect(h.recoverNavigation).not.toHaveBeenCalled();expectNoExecution(h);
 });
 it('keeps a refused recovery visible when a later ordinary read is still partial',async()=>{
  const h=setup(true),user=userEvent.setup();const button=await screen.findByRole('button',{name:'Refresh workspace'});
  h.recoverNavigation.mockResolvedValueOnce({ok:false,code:'failed',reason:'Refused'});
  await user.click(button);await screen.findByText(/Workspace access could not be restored/);
  await act(async()=>{h.reread();});
  expect(await screen.findByRole('link',{name:permittedTask.title})).toBeTruthy();
  expect(screen.getByText(/Workspace access could not be restored/)).toBeTruthy();expect(screen.queryByText(/needs a current access check/)).toBeNull();
  expect(document.body.textContent).not.toContain('WITHHELD PRIVATE TITLE');expectNoExecution(h);
 });
});
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
 const user=userEvent.setup();await user.click(screen.getByRole('button',{name:/^Inbox(?: ·|$)/}));await user.click(await screen.findByRole('button',{name:/Which vendor/}));
 await act(async()=>resolve({ok:true,value:{task,hit:null}}));await screen.findByText(/selected question was resolved or replaced while opening/);
 expect(screen.queryByRole('button',{name:'Refresh workspace'})).toBeNull();expect(recoverNavigation).not.toHaveBeenCalled();expect(document.querySelector('[data-task-view]')).toBeNull();
});
