// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Sidebar,type SidebarProps} from '../src/renderer/Shell/Sidebar';
import {Header} from '../src/renderer/Shell/Header';
import {viewFor} from '../src/renderer/App';
const props=():SidebarProps=>({
 state:{signedIn:true,sharedService:'available',workspaces:[{workspaceId:'w',name:'Fictional Audit',source:'service'}],engagementCreation:{enabled:true}},workspaceId:'w',
 tree:{workspaceId:'w',engagements:[],folders:[],tasks:[{taskId:'t',workspaceId:'w',engagementId:null,folderId:null,title:'Existing private conversation',runtimeThreadId:null,sourceRefs:[],artifactRefs:[],visibility:'private',revision:1}]},openTaskId:'t',
 onSelectWorkspace:vi.fn(),onOpenTask:vi.fn(),onNewThread:vi.fn(),onNewTask:vi.fn(),onCreateEngagement:vi.fn(),onCreateFolder:vi.fn(),onSignIn:vi.fn(),onShowSpecimen:vi.fn(),newOperationId:()=> 'op',busy:false,person:{name:'Fictional Person',detail:'Signed in'},onCollapse:vi.fn(),onExpand:vi.fn(),onSearch:vi.fn(),onInbox:vi.fn(),
});
afterEach(()=>{cleanup();location.hash='';});
it('retains ungrouped private conversations under Chats and keeps Engagement creation',()=>{
 const p=props();render(<Sidebar {...p}/>);
 expect(screen.getByRole('heading',{name:'Chats'})).toBeTruthy();expect(screen.queryByText('Ad hoc Tasks')).toBeNull();expect(screen.queryByText('No ad hoc Tasks.')).toBeNull();
 fireEvent.click(screen.getByRole('link',{name:'Existing private conversation'}));expect(p.onOpenTask).toHaveBeenCalledWith(p.tree!.tasks[0]);
 expect(screen.getByRole('button',{name:'New Engagement'})).toBeTruthy();expect(screen.queryByRole('menuitemradio')).toBeNull();
});
it('opens actual account and organization menu at the rail footer without a workspace switcher',()=>{
 const p=props();render(<Sidebar {...p} presentation="rail"/>);
 fireEvent.click(screen.getByRole('button',{name:'Organization and team'}));const menu=screen.getByRole('menu');
 expect(within(menu).getByRole('menuitem',{name:'Fictional Audit'})).toBeTruthy();expect(within(menu).queryByRole('menuitemradio')).toBeNull();
 fireEvent.click(within(menu).getByRole('menuitem',{name:'Settings'}));expect(p.onShowSpecimen).toHaveBeenCalledOnce();expect(p.onSelectWorkspace).not.toHaveBeenCalled();
});
it('keeps one account trigger with expanded history and removes duplicate header organization',()=>{
 const p=props();render(<><Sidebar {...p}/><Header task={null} engagement={null} workspace={p.state!.workspaces[0]!}/></>);
 expect(screen.getAllByRole('button',{name:'Organization and team'})).toHaveLength(1);expect(document.querySelector('[data-header-workspace]')).toBeNull();
});
it('routes implemented settings independently of the internal specimen',()=>{
 for(const hash of ['#settings','#settings-account','#settings-providers','#settings-routes'])expect(viewFor(hash)).toBe('settings');expect(viewFor('#specimen')).toBe('specimen');
});

it('marks Engagement context nonempty so metadata is not compressed into the idle header',()=>{
 render(<Header task={null} workspace={null} engagement={{engagementId:'e',workspaceId:'w',name:'Annual review',objectives:'',scope:'',clientEntity:'Fictional entity',periodStart:'2026-01-01',periodEnd:'2026-12-31',revision:1}}/>);
 expect(document.querySelector('[data-header]')?.hasAttribute('data-header-empty')).toBe(false);expect(screen.getByText('Fictional entity')).toBeTruthy();
});
it('keeps current Inbox count and unavailable attention distinct',()=>{
 const p=props();const view=render(<Sidebar {...p} presentation="rail" inboxCount={3}/>);
 fireEvent.click(screen.getByRole('button',{name:'Inbox · 3 requests for input'}));expect(p.onInbox).toHaveBeenCalledOnce();
 view.rerender(<Sidebar {...p} presentation="rail" inboxCount={null}/>);expect(screen.getByRole('button',{name:'Inbox · attention unavailable'})).toBeTruthy();expect(screen.queryByText('3 requests for input')).toBeNull();
});
