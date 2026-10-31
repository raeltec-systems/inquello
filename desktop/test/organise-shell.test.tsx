// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.14, renderer: the Sidebar, Header and Task placeholder through the
 * named `inquello.organise` operations, against an in-memory fake of main.
 */
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App, viewFor } from '../src/renderer/App';
import { periodText } from '../src/renderer/Shell/Header';
import type { EngagementItem, FolderItem, TaskItem } from '../src/renderer/Shell/organise-bridge';
import { Shell } from '../src/renderer/Shell/Shell';
import { engagementDraftErrors, EMPTY_ENGAGEMENT } from '../src/renderer/Shell/Sidebar';

const WORKSPACE = '5d6e7f80-91a2-4b3c-8d4e-5f6a7b8c9d0e';

interface FakeMain {
  engagements: EngagementItem[];
  folders: FolderItem[];
  tasks: TaskItem[];
  serviceUp: boolean;
  bridge: Record<string, ReturnType<typeof vi.fn>>;
}

let ids = 0;
const nextId = (prefix: string) => `${prefix}${String(++ids).padStart(12, '0')}`;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fakeMain(options: { serviceUp?: boolean; signedIn?: boolean } = {}): FakeMain {
  const main: FakeMain = { engagements: [], folders: [], tasks: [], serviceUp: options.serviceUp ?? true, bridge: {} };
  const ok = <T,>(value: T) => ({ ok: true, value });
  main.bridge = {
    getWorkspaces: vi.fn(async () => ({
      signedIn: options.signedIn ?? true,
      sharedService: main.serviceUp ? 'available' : 'unavailable',
      workspaces: options.signedIn === false ? [] : [{ workspaceId: WORKSPACE, name: 'Synthetic Audit Co', source: main.serviceUp ? 'service' : 'local' }],
      engagementCreation: main.serviceUp
        ? { enabled: true }
        : { enabled: false, reason: 'The shared service is unavailable, so new Engagements cannot be created. Your private Tasks stay available.' },
    })),
    getTree: vi.fn(async () => ok({ workspaceId: WORKSPACE, engagements: main.engagements, folders: main.folders, tasks: main.tasks })),
    createEngagement: vi.fn(async (request: Record<string, string | null>) => {
      const engagement: EngagementItem = {
        engagementId: uuid(++ids),
        workspaceId: WORKSPACE,
        name: String(request.name),
        objectives: String(request.objectives),
        scope: String(request.scope),
        clientEntity: request.clientEntity ?? null,
        periodStart: request.periodStart ?? null,
        periodEnd: request.periodEnd ?? null,
        revision: 1,
      };
      main.engagements.push(engagement);
      return ok(engagement);
    }),
    createFolder: vi.fn(async (request: { engagementId: string; name: string }) => {
      const folder: FolderItem = { folderId: uuid(++ids), engagementId: request.engagementId, name: request.name, revision: 1 };
      main.folders.push(folder);
      return ok(folder);
    }),
    createTask: vi.fn(async (request: { engagementId: string | null; folderId: string | null; title: string }) => {
      const task: TaskItem = {
        taskId: uuid(++ids),
        workspaceId: WORKSPACE,
        engagementId: request.engagementId,
        folderId: request.folderId,
        title: request.title,
        runtimeThreadId: null,
        sourceRefs: [],
        artifactRefs: [],
        visibility: 'private',
        revision: 1,
      };
      main.tasks.push(task);
      return ok(task);
    }),
    renameTask: vi.fn(async (request: { taskId: string; expectedRevision: number; title: string }) => {
      const task = main.tasks.find((item) => item.taskId === request.taskId)!;
      if (task.revision !== request.expectedRevision) return { ok: false, code: 'conflict', reason: 'Someone changed this first. Your draft is kept; review and try again.' };
      Object.assign(task, { title: request.title, revision: task.revision + 1 });
      return ok({ ...task });
    }),
    moveTask: vi.fn(async (request: { taskId: string; engagementId: string | null; folderId: string | null }) => {
      const task = main.tasks.find((item) => item.taskId === request.taskId)!;
      Object.assign(task, { engagementId: request.engagementId, folderId: request.folderId, revision: task.revision + 1 });
      return ok({ ...task });
    }),
    updateEngagement: vi.fn(),
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ organise: Object.freeze(main.bridge), identity: Object.freeze({ signIn: vi.fn(async () => ({ ok: true })) }) });
  return main;
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

const sidebar = () => document.querySelector<HTMLElement>('[data-sidebar]')!;
const header = () => document.querySelector<HTMLElement>('[data-header]')!;
const field = (form: HTMLElement, label: string) => within(form).getByLabelText(label);

function renderShell() {
  return render(<Shell onShowSpecimen={() => undefined} operationIds={() => uuid(900 + ++ids)} />);
}

describe('Shell', () => {
  it('opens on the Shell; #specimen shows the design specimen', () => {
    expect(viewFor('')).toBe('shell');
    expect(viewFor('#shell')).toBe('shell');
    expect(viewFor('#specimen')).toBe('specimen');
    fakeMain();
    render(<App />);
    expect(document.querySelector('[data-shell]')).not.toBeNull();
  });

  it('New thread opens a memory-only Start surface without creating a Task', async () => {
    const main = fakeMain();
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sidebarState).toBe('ready'));
    await user.click(screen.getByRole('button', { name: 'New thread' }));
    expect(screen.getByRole('heading', {name:'What should we work on?'})).toBeTruthy();
    expect(main.tasks).toHaveLength(0);
    expect(main.bridge.createTask).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
    expect(header().querySelector('[data-header-client]')).toBeNull();
    expect(header().querySelector('[data-header-period]')).toBeNull();
  });

  it('creates an Engagement and folder, then opens Start without an empty Task', async () => {
    const main = fakeMain();
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sidebarState).toBe('ready'));
    await user.click(screen.getByRole('button', { name: 'New Engagement' }));
    const form = document.querySelector<HTMLElement>('[data-engagement-form]')!;
    await user.type(field(form, 'Name'), 'FY26 audit');
    await user.type(field(form, 'Objectives'), 'Opinion on FY26');
    await user.type(field(form, 'Scope'), 'Group');
    await user.type(field(form, 'Client or entity'), 'Synthetic Client Ltd');
    await user.type(field(form, 'Period start'), '2026-01-01');
    await user.type(field(form, 'Period end'), '2026-12-31');
    await user.click(within(form).getByRole('button', { name: 'Create Engagement' }));
    await waitFor(() => expect(document.querySelector('[data-engagement-id]')).not.toBeNull());
    expect(main.bridge.createEngagement).toHaveBeenCalledWith(expect.objectContaining({ clientEntity: 'Synthetic Client Ltd', periodStart: '2026-01-01', periodEnd: '2026-12-31' }));

    await user.click(screen.getByRole('button', { name: 'New folder in FY26 audit' }));
    const folderForm = document.querySelector<HTMLElement>('[data-folder-form]')!;
    await user.type(field(folderForm, 'Folder name'), 'Planning');
    await user.click(within(folderForm).getByRole('button', { name: 'Create folder' }));
    await waitFor(() => expect(document.querySelector('[data-folder-id]')).not.toBeNull());

    await user.click(screen.getByRole('button', { name: 'New Task in Planning' }));
    expect(screen.getByRole('heading', {name:'What should we work on?'})).toBeTruthy();
    expect(main.bridge.createTask).not.toHaveBeenCalled();
    expect(document.querySelector('[data-folder-id] [data-task-id]')).toBeNull();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
  });

  it('keeps the Engagement draft and operation ID when creation fails, and retries with the same ID', async () => {
    const main = fakeMain();
    main.bridge.createEngagement!.mockResolvedValueOnce({ ok: false, code: 'incomplete', reason: 'The Engagement was created on the shared service but not saved on this device. Try again to finish; it will not be created twice.' });
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sidebarState).toBe('ready'));
    await user.click(screen.getByRole('button', { name: 'New Engagement' }));
    const form = document.querySelector<HTMLElement>('[data-engagement-form]')!;
    await user.type(field(form, 'Name'), 'FY26 audit');
    await user.click(within(form).getByRole('button', { name: 'Create Engagement' }));
    await screen.findByText(/not saved on this device/);
    expect((field(form, 'Name') as HTMLInputElement).value).toBe('FY26 audit');
    await user.click(within(form).getByRole('button', { name: 'Create Engagement' }));
    await waitFor(() => expect(main.engagements).toHaveLength(1));
    const [first, second] = main.bridge.createEngagement!.mock.calls.map(([request]) => (request as { operationId: string }).operationId);
    expect(second).toBe(first);
  });

  it('with the shared service down, existing Tasks still list and open, and Engagement creation says why it is disabled', async () => {
    const main = fakeMain({ serviceUp: false });
    main.tasks.push({ taskId: uuid(1), workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Bank confirmations', runtimeThreadId: null, sourceRefs: [], artifactRefs: [], visibility: 'private', revision: 1 });
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sharedService).toBe('unavailable'));
    const create = screen.getByRole('button', { name: 'New Engagement' });
    expect(create.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(/shared service is unavailable/)).toBeTruthy();
    await user.click(create);
    expect(document.querySelector('[data-engagement-form]')).toBeNull();
    await user.click(screen.getByRole('link', { name: 'Bank confirmations' }));
    expect(header().querySelector('[data-header-title]')!.textContent).toBe('Bank confirmations');
  });

  it('shows a stale rename as a conflict and keeps the typed draft', async () => {
    const main = fakeMain();
    main.tasks.push({ taskId: uuid(2), workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Original', runtimeThreadId: null, sourceRefs: [], artifactRefs: [], visibility: 'private', revision: 1 });
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sidebarState).toBe('ready'));
    await user.click(await screen.findByRole('link', { name: 'Original' }));
    // Someone else's change lands first.
    main.tasks[0]!.revision = 2;
    const title = screen.getByLabelText('Task title') as HTMLInputElement;
    await user.clear(title);
    await user.type(title, 'My draft');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    await screen.findByText(/Your draft is kept/);
    expect((screen.getByLabelText('Task title') as HTMLInputElement).value).toBe('My draft');
  });

  it('moves a Task through the Move menu and keeps its identity', async () => {
    const main = fakeMain();
    main.engagements.push({ engagementId: uuid(3), workspaceId: WORKSPACE, name: 'FY26 audit', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null, revision: 1 });
    main.tasks.push({ taskId: uuid(4), workspaceId: WORKSPACE, engagementId: null, folderId: null, title: 'Loose', runtimeThreadId: 'thread-1', sourceRefs: [], artifactRefs: [], visibility: 'private', revision: 1 });
    const user = userEvent.setup();
    renderShell();
    await user.click(await screen.findByRole('link', { name: 'Loose' }));
    await user.click(screen.getByRole('button', { name: 'Move' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'FY26 audit' }));
    await waitFor(() => expect(main.bridge.moveTask).toHaveBeenCalledWith(expect.objectContaining({ taskId: uuid(4), engagementId: uuid(3), folderId: null, expectedRevision: 1 })));
    await waitFor(() => expect(document.querySelector(`[data-engagement-id="${uuid(3)}"] [data-task-id="${uuid(4)}"]`)).not.toBeNull());
  });

  it('signed out: no Workspaces, a Sign in action, and nothing listed', async () => {
    fakeMain({ signedIn: false });
    renderShell();
    await waitFor(() => expect(sidebar().dataset.sidebarState).toBe('signed-out'));
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
    expect(document.querySelector('[data-task-id]')).toBeNull();
  });
});

describe('Shell helpers', () => {
  it('formats the period and validates the Engagement draft', () => {
    const base: EngagementItem = { engagementId: 'e', workspaceId: WORKSPACE, name: 'n', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null, revision: 1 };
    expect(periodText(null)).toBeNull();
    expect(periodText(base)).toBeNull();
    expect(periodText({ ...base, periodStart: '2026-01-01' })).toBe('From 2026-01-01');
    expect(periodText({ ...base, periodEnd: '2026-12-31' })).toBe('Until 2026-12-31');
    expect(engagementDraftErrors(EMPTY_ENGAGEMENT)).toEqual({ name: 'A name is required.' });
    expect(engagementDraftErrors({ ...EMPTY_ENGAGEMENT, name: 'x', periodStart: '2026-12-31', periodEnd: '2026-01-01' })).toEqual({ periodEnd: 'The period cannot end before it starts.' });
    expect(engagementDraftErrors({ ...EMPTY_ENGAGEMENT, name: 'x', periodStart: '31/12/2026' })).toEqual({ periodStart: 'Use YYYY-MM-DD.' });
    expect(nextId('x')).toMatch(/^x/);
  });
});

it('keeps background acceptance without taking over unrelated navigation',async()=>{
 const main=fakeMain();const other=uuid(808);const user=userEvent.setup();let finish!:(value:unknown)=>void;let command:Record<string,unknown>={};
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'},{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 main.bridge.getTree!.mockImplementation(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:workspaceId===WORKSPACE?main.tasks:[]}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start:(input:Record<string,unknown>)=>{command=input;return new Promise(resolve=>{finish=resolve;});}}}});
 renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01.');await user.click(screen.getByLabelText('Send'));
 await user.click(screen.getByRole('button',{name:'Synthetic Audit Co'}));await user.click(screen.getByRole('menuitemradio',{name:'Other Workspace'}));
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 const task:TaskItem={taskId:uuid(809),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private task',runtimeThreadId:'thread-a',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};main.tasks.push(task);
 await act(async()=>{finish({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'Other Workspace'}));await user.click(screen.getByRole('menuitemradio',{name:'Synthetic Audit Co'}));
 await user.click(await screen.findByRole('link',{name:'Private task'}));
 expect(within(await screen.findByRole('region',{name:'Accepted request'})).getByText('Review fictional R01.')).toBeTruthy();
});

it('preserves newer shared no-Task draft when an older Start is accepted after navigation',async()=>{
 const main=fakeMain();const other=uuid(808);const user=userEvent.setup();let finish!:(value:unknown)=>void;let command:Record<string,unknown>={};
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'},{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 main.bridge.getTree!.mockImplementation(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:workspaceId===WORKSPACE?main.tasks:[]}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start:(input:Record<string,unknown>)=>{command=input;return new Promise(resolve=>{finish=resolve;});}}}});
 renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01.');await user.click(screen.getByLabelText('Send'));
 await user.click(screen.getByRole('button',{name:'Synthetic Audit Co'}));await user.click(screen.getByRole('menuitemradio',{name:'Other Workspace'}));
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 await user.clear(screen.getByRole('textbox'));await user.type(screen.getByRole('textbox'),'New unsent R99 question.');
 const task:TaskItem={taskId:uuid(809),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private task',runtimeThreadId:'thread-a',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};main.tasks.push(task);
 await act(async()=>{finish({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'New thread'}));
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('New unsent R99 question.');
});

it('removes cached private request and selection when Workspace membership disappears',async()=>{
 const main=fakeMain();const other=uuid(808);const user=userEvent.setup();let finish!:(value:unknown)=>void;let command:Record<string,unknown>={};
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'},{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 main.bridge.getTree!.mockImplementation(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:workspaceId===WORKSPACE?main.tasks:[]}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start:(input:Record<string,unknown>)=>{command=input;return new Promise(resolve=>{finish=resolve;});}}}});
 const mounted=renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01.');await user.click(screen.getByLabelText('Send'));
 const task:TaskItem={taskId:uuid(809),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private task',runtimeThreadId:'thread-a',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};main.tasks.push(task);
 await act(async()=>{finish({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});
 await screen.findByRole('region',{name:'Accepted request'});
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 mounted.rerender(<Shell active={false} onShowSpecimen={()=>undefined}/>);
 await waitFor(()=>expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other));
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
 expect(screen.queryByText('Review fictional R01.')).toBeNull();
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'}],engagementCreation:{enabled:true}});
 mounted.rerender(<Shell active onShowSpecimen={()=>undefined}/>);
 await waitFor(()=>expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(WORKSPACE));
 expect(screen.getByText('No Task open.')).toBeTruthy();
 await user.click(await screen.findByRole('link',{name:'Private task'}));
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
});

it('Story 1.26 suppresses selected private work after a passive Workspace refresh fails',async()=>{
 const main=fakeMain();const user=userEvent.setup();
 main.tasks.push({taskId:uuid(126),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private procurement review',runtimeThreadId:'thread-126',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1});
 const mounted=renderShell();await user.click(await screen.findByRole('link',{name:'Private procurement review'}));
 await screen.findByRole('region',{name:'Task'});
 main.bridge.getWorkspaces!.mockRejectedValue(new Error('membership refresh failed'));
 mounted.rerender(<Shell active={false} onShowSpecimen={()=>undefined}/>);
 await screen.findByText('Your Workspaces could not be read.');
 expect(screen.queryByRole('region',{name:'Task'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Private procurement review'})).toBeNull();
});

it('discovers the exact retained operation and answers a mediated question while Start ack is held, exactly once',async()=>{
 const {TaskService}=await import('../src/main/tasks/service');const main=fakeMain(),user=userEvent.setup();
 const task:TaskItem={taskId:uuid(926),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Fictional procurement review',runtimeThreadId:'thread-early',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};
 let finish!:(v:unknown)=>void,command:Record<string,unknown>={},changed=()=>{};
 const binding={taskId:task.taskId,workspaceId:WORKSPACE,runId:'run-early',threadId:'thread-early',turnId:'turn-early',runtimeId:'runtime-early',status:'running'};
 const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:async(method:string)=>method==='inquello/tasks/forThread'?binding:{version:1,...binding,historyIncomplete:false,items:[],plan:[],results:[],artifact:'absent'}} as never,identity:{principalId:()=>uuid(1)},syncPrincipal:async()=>{},prepareRoutes:async()=>({ok:true}),freshPolicy:async()=>({workspaceId:WORKSPACE,authorizationEpoch:1}) as never,onProgressChanged:()=>changed()});
 let response:Promise<unknown>|undefined;
 const accepted=()=>({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:binding.runId,threadId:binding.threadId,status:'running',request:command.request,accepted:true}});
 const start=vi.fn((input:Record<string,unknown>)=>{command=input;main.tasks.push(task);response=service.question('early-001',{threadId:binding.threadId,turnId:binding.turnId,itemId:'question-early',questions:[{id:'scope',header:'Audit scope',question:'Include fictional R02?',isOther:true,isSecret:false,options:[{label:'Include R02',description:'Inspect approval evidence'},{label:'Exclude R02',description:'Compare R01 and R03 only'}]}]});return new Promise(resolve=>{finish=resolve;});});
 const reconcile=vi.fn(async()=>accepted()),answer=vi.fn((v:never)=>service.answer(v));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start,reconcile,progress:(v:never)=>service.progress(v),answer,onProgressChanged:(fn:()=>void)=>{changed=fn;return()=>{changed=()=>{};};}}}});
 renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01 and R02.');await user.click(screen.getByLabelText('Send'));
 await user.click(await screen.findByRole('radio',{name:/Include R02/}));await user.click(screen.getByRole('button',{name:'Send answer'}));
 await expect(response).resolves.toEqual({answers:{scope:{answers:['Include R02']}}});expect(answer).toHaveBeenCalledOnce();expect(start).toHaveBeenCalledOnce();expect(reconcile).toHaveBeenCalledWith({operationId:command.operationId});
 await act(async()=>finish(accepted()));expect(screen.getAllByRole('region',{name:'Accepted request'})).toHaveLength(1);expect(screen.queryByRole('button',{name:'Send answer'})).toBeNull();expect(start).toHaveBeenCalledOnce();
});

it('keeps held-ack discovery background-only and ignores the later Start reply',async()=>{
 const main=fakeMain();const other=uuid(808);const user=userEvent.setup();let finish!:(value:unknown)=>void;let command:Record<string,unknown>={};let discover!:(value:unknown)=>void;
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'},{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 main.bridge.getTree!.mockImplementation(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:workspaceId===WORKSPACE?main.tasks:[]}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{reconcile:()=>new Promise(resolve=>{discover=resolve;}),preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start:(input:Record<string,unknown>)=>{command=input;return new Promise(resolve=>{finish=resolve;});}}}});
 renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01.');await user.click(screen.getByLabelText('Send'));
 await user.click(screen.getByRole('button',{name:'Synthetic Audit Co'}));await user.click(screen.getByRole('menuitemradio',{name:'Other Workspace'}));
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 const task:TaskItem={taskId:uuid(809),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private task',runtimeThreadId:'thread-a',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};main.tasks.push(task);
 await waitFor(()=>expect(discover).toBeTypeOf('function'));
 await act(async()=>{discover({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});
 expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other);
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
 await act(async()=>finish({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}}));
 await user.click(screen.getByRole('button',{name:'Other Workspace'}));await user.click(screen.getByRole('menuitemradio',{name:'Synthetic Audit Co'}));
 await user.click(await screen.findByRole('link',{name:'Private task'}));
 expect(within(await screen.findByRole('region',{name:'Accepted request'})).getByText('Review fictional R01.')).toBeTruthy();
});

it('suppresses delayed discovery and Start acknowledgement after Workspace revocation',async()=>{
 const main=fakeMain();const other=uuid(808);const user=userEvent.setup();let finish!:(value:unknown)=>void;let command:Record<string,unknown>={};let discover!:(value:unknown)=>void;
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'},{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 main.bridge.getTree!.mockImplementation(async({workspaceId}:{workspaceId:string})=>({ok:true,value:{workspaceId,engagements:[],folders:[],tasks:workspaceId===WORKSPACE?main.tasks:[]}}));
 const route={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:1,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
 Object.assign(globalThis,{inquello:{organise:main.bridge,routes:{list:async()=>({ok:true,value:[route]})},tasks:{reconcile:()=>new Promise(resolve=>{discover=resolve;}),preflight:async()=>({ok:true,value:{routeId:route.routeId,configurationRevision:1,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'}}),start:(input:Record<string,unknown>)=>{command=input;return new Promise(resolve=>{finish=resolve;});}}}});
 const mounted=renderShell();await waitFor(()=>expect(sidebar().dataset.sidebarState).toBe('ready'));await user.click(screen.getByRole('button',{name:'New thread'}));
 await screen.findByText(/Claude —/);await user.selectOptions(screen.getByLabelText('Processing route'),'claude-api-key');await screen.findByLabelText('Reasoning');await user.selectOptions(screen.getByLabelText('Reasoning'),'default');await user.selectOptions(screen.getByLabelText('Speed'),'default');await user.type(screen.getByRole('textbox'),'Review fictional R01.');await user.click(screen.getByLabelText('Send'));
 const task:TaskItem={taskId:uuid(809),workspaceId:WORKSPACE,engagementId:null,folderId:null,title:'Private task',runtimeThreadId:'thread-a',sourceRefs:[],artifactRefs:[],visibility:'private',revision:1};main.tasks.push(task);
 await waitFor(()=>expect(discover).toBeTypeOf('function'));
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:other,name:'Other Workspace',source:'service'}],engagementCreation:{enabled:true}});
 mounted.rerender(<Shell active={false} onShowSpecimen={()=>undefined}/>);
 await waitFor(()=>expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(other));
 await act(async()=>{discover({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});
 await act(async()=>{finish({ok:true,value:{operationId:command.operationId,taskId:task.taskId,runId:'run-a',threadId:'thread-a',status:'running',request:command.request,accepted:true}});});

 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
 // The user's own uncertain draft remains editable; no retained Task disclosure returns.
 expect(screen.queryByRole('region',{name:'Task progress'})).toBeNull();
 main.bridge.getWorkspaces!.mockResolvedValue({signedIn:true,sharedService:'available',workspaces:[{workspaceId:WORKSPACE,name:'Synthetic Audit Co',source:'service'}],engagementCreation:{enabled:true}});
 mounted.rerender(<Shell active onShowSpecimen={()=>undefined}/>);
 await waitFor(()=>expect(document.querySelector('[data-workspace-selector]')?.getAttribute('data-workspace-id')).toBe(WORKSPACE));
 expect(screen.getByText('No Task open.')).toBeTruthy();
 await user.click(await screen.findByRole('link',{name:'Private task'}));
 expect(screen.queryByRole('region',{name:'Accepted request'})).toBeNull();
});
