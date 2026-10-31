// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Search} from '../src/renderer/Shell/Search';
import {Inbox,attentionCounts} from '../src/renderer/Shell/Inbox';
import {TaskView} from '../src/renderer/Shell/TaskView';
const workspace='11111111-1111-4111-8111-111111111111',taskId='22222222-2222-4222-8222-222222222222';
const task={taskId,workspaceId:workspace,title:'Procurement January–June',runtimeThreadId:null,engagementId:null,folderId:null,sourceRefs:[],artifactRefs:[],visibility:'private' as const,revision:1,pinned:false,archived:true};
const hit={turnId:'older-turn',itemId:'invoice-104',text:'INV-104 is a potential duplicate. <script>not instructions</script>',truncated:false};
const result={workspaceId:workspace,query:'INV-104',items:[{kind:'conversation',taskId,engagementId:null,title:task.title,snippet:hit.text,turnId:hit.turnId,itemId:hit.itemId,archived:true}],nextCursor:null,unavailable:false,coverage:[]};
const ok=(value:unknown)=>({ok:true,value});
afterEach(()=>{cleanup();delete (globalThis as {inquello?:unknown}).inquello;});
function api(){const search=vi.fn(async()=>ok(result)),reopen=vi.fn(async()=>ok({task,hit}));let invalidate:()=>void=()=>{};Object.assign(globalThis,{inquello:{organise:{search,reopen},tasks:{onSessionChanged:(fn:()=>void)=>{invalidate=fn;return()=>{};}}}});return{search,reopen,invalidate:()=>invalidate()};}
describe('S05 saved-work interactions',()=>{
 it('searches archived conversation text and opens the exact inert old message without execution',async()=>{const x=api(),open=vi.fn(),close=vi.fn();render(<Search workspaceId={workspace} onClose={close} onOpen={open} onEngagement={vi.fn()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByLabelText('Include archived Tasks'));await user.click(screen.getByRole('button',{name:'Search',exact:true}));expect(await screen.findByText(hit.text)).toBeTruthy();expect(document.querySelector('script')).toBeNull();await user.click(screen.getByRole('button',{name:'Procurement January–June · Archived'}));expect(x.reopen).toHaveBeenCalledWith({workspaceId:workspace,taskId,query:'INV-104',turnId:hit.turnId,itemId:hit.itemId});expect(open).toHaveBeenCalledWith(expect.objectContaining({hit}));expect(close).toHaveBeenCalled();});
 it('retains query on failure and clears cached snippets on revoked activation',async()=>{const x=api();x.reopen.mockResolvedValue({ok:false,reason:'revoked'} as never);render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={vi.fn()} onEngagement={vi.fn()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByRole('button',{name:'Search',exact:true}));await user.click(await screen.findByRole('button',{name:'Procurement January–June · Archived'}));expect(screen.queryByText(hit.text)).toBeNull();expect(screen.getByLabelText('Search this Workspace')).toHaveProperty('value','INV-104');expect(screen.getByText(/No cached snippet was opened/)).toBeTruthy();});
 it('discards a response after query or session changes',async()=>{const x=api();let resolve!:(v:unknown)=>void;x.search.mockImplementation(()=>new Promise(r=>{resolve=r;}) as never);render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={vi.fn()} onEngagement={vi.fn()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByRole('button',{name:'Search',exact:true}));await user.type(screen.getByLabelText('Search this Workspace'),' changed');act(()=>x.invalidate());await act(async()=>resolve(ok(result)));expect(screen.queryByText(hit.text)).toBeNull();});
 it('Escape returns focus to the opener and keyboard trapping does not start work',async()=>{const button=document.createElement('button');document.body.append(button);button.focus();const close=vi.fn();const {unmount}=render(<Search workspaceId={null} onClose={close} onOpen={vi.fn()} onEngagement={vi.fn()}/>);expect(screen.getByText(/No Workspace is available or selected/)).toBeTruthy();await userEvent.setup().keyboard('{Escape}');expect(close).toHaveBeenCalled();unmount();expect(document.activeElement).toBe(button);button.remove();});
 it('keeps pin/archive operation identity and original revision after uncertain failure',async()=>{const nav=vi.fn().mockResolvedValueOnce({ok:false,code:'runtime-unavailable',reason:'Try again'}).mockResolvedValueOnce({ok:true,value:{...task,pinned:true,revision:2}});const props={task,engagements:[],folders:[],onRename:vi.fn(),onMove:vi.fn(),onNavigation:nav,newOperationId:()=> 'one-operation'};const {rerender}=render(<TaskView {...props}/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Organise Task'}));await user.click(screen.getByRole('menuitem',{name:'Pin'}));expect(await screen.findByRole('button',{name:'Retry navigation change'})).toBeTruthy();rerender(<TaskView {...props} task={{...task,revision:2}}/>);await user.click(screen.getByRole('button',{name:'Retry navigation change'}));expect(nav.mock.calls.map(call=>[call[2],call[3],call[4]])).toEqual([[true,'one-operation',1],[true,'one-operation',1]]);});
});
describe('Inbox current questions and category semantics',()=>{
 const request={taskId,workspaceId:workspace,requestId:'request',turnId:'turn',itemId:'vendor-question',question:'Which vendor evidence?'};
 const view={workspaceId:workspace,items:[request],unavailable:false};
 it('read-model later-category counts are separate and confer no approval',()=>{expect(attentionCounts({input:[{}],review:[{},{}],delivery:[{}]})).toEqual({input:1,review:2,delivery:1});});
 it('allows delayed activation across semantically unchanged poll refresh',async()=>{let resolve!:(v:unknown)=>void;Object.assign(globalThis,{inquello:{tasks:{progress:vi.fn(()=>new Promise(r=>{resolve=r;}))}}});const open=vi.fn(),close=vi.fn();const props={view,tasks:[task],onClose:close,onOpen:open};const {rerender}=render(<Inbox {...props}/>);await userEvent.setup().click(screen.getByRole('button',{name:/Which vendor evidence/}));rerender(<Inbox {...props} view={structuredClone(view)}/>);await act(async()=>resolve(ok({version:1,taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status:'running',historyIncomplete:false,items:[],plan:[],results:[],questions:[{...request,threadId:'thread',questions:[]}],artifact:'absent',sessionGeneration:1})));expect(open).toHaveBeenCalledWith(task,request);expect(close).toHaveBeenCalled();});
 it('unavailable is not shown as zero requests',()=>{render(<Inbox view={null} tasks={[]} onClose={vi.fn()} onOpen={vi.fn()}/>);expect(screen.getByText(/not zero/)).toBeTruthy();expect(screen.queryByText('No current requests for input.')).toBeNull();});
});

describe('review-loop navigation and modal regressions',()=>{
 it('uses native modal ownership, keeps IME Escape, and returns focus on close',()=>{
  const opener=document.createElement('button');document.body.append(opener);opener.focus();
  const modal=vi.spyOn(HTMLDialogElement.prototype,'showModal'),close=vi.fn();
  const {unmount}=render(<Search workspaceId={workspace} onClose={close} onOpen={vi.fn()} onEngagement={vi.fn()}/>);
  const dialog=screen.getByRole('dialog');expect(modal).toHaveBeenCalledOnce();expect(dialog).toHaveProperty('open',true);
  fireEvent.compositionStart(dialog);fireEvent.keyDown(dialog,{key:'Escape',isComposing:true});fireEvent(dialog,new Event('cancel',{cancelable:true}));expect(close).not.toHaveBeenCalled();
  fireEvent.compositionEnd(dialog);fireEvent.keyDown(dialog,{key:'Escape'});expect(close).toHaveBeenCalledOnce();unmount();expect(document.activeElement).toBe(opener);opener.remove();modal.mockRestore();
 });
 it.each(['é'.repeat(129),'invoice\u0001'])('explains invalid search before the bridge is called',async query=>{
  const x=api();render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={vi.fn()} onEngagement={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Search this Workspace'),{target:{value:query}});
  expect(screen.getByRole('alert').textContent).toMatch(/256 UTF-8 bytes|control characters/);
  fireEvent.submit(screen.getByLabelText('Search this Workspace').closest('form')!);expect(x.search).not.toHaveBeenCalled();expect(screen.getByLabelText('Search this Workspace')).toHaveProperty('value',query);
 });
 it('requests the real next cursor then opens the exact hit on that page',async()=>{
  const x=api();x.search.mockResolvedValueOnce(ok({...result,nextCursor:'scope-snapshot-offset-50'})).mockResolvedValueOnce(ok({...result,items:[{...result.items[0],itemId:'invoice-155',snippet:'INV-104 on message 51'}]}));
  x.reopen.mockResolvedValue(ok({task,hit:{...hit,itemId:'invoice-155'}}));const open=vi.fn();
  render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={open} onEngagement={vi.fn()}/>);const user=userEvent.setup();
  await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByRole('button',{name:'Search',exact:true}));
  await user.click(await screen.findByRole('button',{name:'Next matches'}));expect(x.search).toHaveBeenLastCalledWith({workspaceId:workspace,query:'INV-104',includeArchived:false,cursor:'scope-snapshot-offset-50'});
  expect(await screen.findByText('INV-104 on message 51')).toBeTruthy();await user.click(screen.getByRole('button',{name:'Procurement January–June · Archived'}));
  expect(x.reopen).toHaveBeenLastCalledWith(expect.objectContaining({itemId:'invoice-155'}));expect(open).toHaveBeenCalledWith(expect.objectContaining({hit:expect.objectContaining({itemId:'invoice-155'})}));
 });
 it.each([false,true])('ignores a late prior-Task navigation completion (success=%s)',async success=>{
  let resolve!:(v:unknown)=>void;const nav=vi.fn(()=>new Promise(r=>{resolve=r;}));
  const props={task,engagements:[],folders:[],onRename:vi.fn(),onMove:vi.fn(),onNavigation:nav as never,newOperationId:()=> 'origin-operation'};
  const {rerender}=render(<TaskView {...props}/>);const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Organise Task'}));await user.click(screen.getByRole('menuitem',{name:'Pin'}));
  rerender(<TaskView {...props} task={{...task,taskId:'different-task',title:'New selected Task'}}/>);
  await act(async()=>resolve(success?ok({...task,pinned:true}):{ok:false,code:'conflict',reason:'Old Task conflict'}));
  expect(screen.queryByText('Old Task conflict')).toBeNull();expect(screen.queryByRole('button',{name:'Retry navigation change'})).toBeNull();expect(screen.queryByText('Navigation preference saved.')).toBeNull();
  expect(screen.getByLabelText('Task title')).toHaveProperty('value','New selected Task');
 });
});

it('retries the same failed search page without stale snippets and deliberately focuses its live count',async()=>{
 const x=api();x.search.mockResolvedValueOnce(ok({...result,nextCursor:'page-two'})).mockRejectedValueOnce(new Error('temporary')).mockResolvedValueOnce(ok({...result,items:[{...result.items[0],snippet:'Second page permitted text'}]}));
 render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={vi.fn()} onEngagement={vi.fn()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByRole('button',{name:'Search',exact:true}));
 await user.click(await screen.findByRole('button',{name:'Next matches'}));expect(screen.queryByText(hit.text)).toBeNull();await user.click(screen.getByRole('button',{name:'Retry this page'}));
 expect(x.search.mock.calls.slice(1).map(call=>(call[0] as any).cursor)).toEqual(['page-two','page-two']);
 expect(await screen.findByText('Second page permitted text')).toBeTruthy();const count=screen.getByText('Page 2 · 1 matches on this page.');expect(count.getAttribute('aria-live')).toBe('polite');expect(document.activeElement).toBe(count);
});
it('discards a failed-page retry when query scope changes',async()=>{
 const x=api();x.search.mockResolvedValueOnce(ok({...result,nextCursor:'page-two'})).mockRejectedValueOnce(new Error());
 render(<Search workspaceId={workspace} onClose={vi.fn()} onOpen={vi.fn()} onEngagement={vi.fn()}/>);const user=userEvent.setup();await user.type(screen.getByLabelText('Search this Workspace'),'INV-104');await user.click(screen.getByRole('button',{name:'Search',exact:true}));await user.click(await screen.findByRole('button',{name:'Next matches'}));
 expect(screen.getByRole('button',{name:'Retry this page'})).toBeTruthy();await user.type(screen.getByLabelText('Search this Workspace'),' changed');expect(screen.queryByRole('button',{name:'Retry this page'})).toBeNull();
});
