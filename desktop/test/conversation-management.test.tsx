// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {SavedWorkDialog} from '../src/renderer/Shell/Search';
import {TaskDetails} from '../src/renderer/Shell/TaskView';
const task={taskId:'11111111-1111-4111-8111-111111111111',workspaceId:'22222222-2222-4222-8222-222222222222',title:'Private fictional title',engagementId:null,folderId:null,revision:1,visibility:'private' as const};
afterEach(cleanup);
it('preserves an ambiguous rename UUID and draft across closing and reopening the same authorized dialog',async()=>{
 const rename=vi.fn(async()=>({ok:false as const,code:'failed' as const,reason:'Rename outcome unknown'})),ids=vi.fn(()=> 'same-rename-operation');
 const view=(open:boolean)=><SavedWorkDialog open={open} label="Conversation options" onClose={()=>{}}><TaskDetails task={task} engagements={[]} folders={[]} onRename={rename} onMove={vi.fn()} newOperationId={ids}/></SavedWorkDialog>;
 const v=render(view(true));fireEvent.change(screen.getByRole('textbox',{name:'Conversation title'}),{target:{value:'My retained rename'}});fireEvent.click(screen.getByRole('button',{name:'Rename'}));await screen.findByText('Rename outcome unknown');
 v.rerender(view(false));expect(screen.queryByRole('dialog')).toBeNull();v.rerender(view(true));expect((screen.getByRole('textbox',{name:'Conversation title'}) as HTMLInputElement).value).toBe('My retained rename');fireEvent.click(screen.getByRole('button',{name:'Rename'}));await waitFor(()=>expect(rename).toHaveBeenCalledTimes(2));expect(ids).toHaveBeenCalledTimes(1);expect(rename.mock.calls[0]).toEqual(rename.mock.calls[1]);
 v.unmount();expect(screen.queryByText('Private fictional title')).toBeNull();expect(screen.queryByDisplayValue('My retained rename')).toBeNull();
});
it('returns focus to the deliberate opener on close without reopening a hidden dialog',()=>{
 const view=(open:boolean)=><><button>Conversation actions</button><SavedWorkDialog open={open} label="Conversation permissions" onClose={()=>{}}>Reach details</SavedWorkDialog></>;
 const v=render(view(false));const opener=screen.getByRole('button',{name:'Conversation actions'});opener.focus();v.rerender(view(true));expect(screen.getByRole('dialog')).toBeTruthy();v.rerender(view(false));expect(document.activeElement).toBe(opener);expect(screen.queryByRole('dialog')).toBeNull();
});
