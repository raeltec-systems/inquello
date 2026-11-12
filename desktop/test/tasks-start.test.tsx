import {modelCatalog,modelBindingId} from './model-fixtures';
import type {RouteView} from '../src/main/routes/types';
// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {useState} from 'react';
import type {ModelAuthorityChange} from '../src/renderer/Shell/model-authority';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {StartView} from '../src/renderer/Shell/StartView';
const route:RouteView={routeId:'claude-api-key',provider:'Claude',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'claude-sonnet-5-5',apiVersion:'2026-10-21',accountRef:'account',region:null},endpoint:'https://api.anthropic.com',revision:3,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
const candidate={routeId:route.routeId,configurationRevision:3,reasoning:['default'],speeds:['default'],available:true,reason:'Available',executionFlow:'Local sandbox',inferenceFlow:'Cloud inference'};
const result={operationId:'op-1',taskId:'task-1',runId:'run-1',threadId:'thread-1',status:'active',request:'Review R01 and R03 for duplicates.',accepted:true};
function setup(start=vi.fn<(...args:unknown[])=>Promise<unknown>>(async()=>({ok:true,value:result})),sources?:Record<string,unknown>) {const reconcile=vi.fn(async()=>({ok:true,value:result}));const preflight=vi.fn(async()=>({ok:true,value:candidate}));const accepted=vi.fn();Object.assign(globalThis,{inquello:{routes:{pendingModel:vi.fn(async()=>({ok:true,value:{operation:null}})),resolve:vi.fn(async()=>({ok:true,value:(await (globalThis as any).inquello.routes.catalog()).value.bindings[0]})),catalog:vi.fn(async()=>({ok:true,value:modelCatalog([route])}))},tasks:{preflight,start,reconcile},...(sources?{sources}:{})}});function Harness({epoch=0}:{epoch?:number}){const[value,setValue]=useState('');return <StartView runtimeEpoch={epoch} workspaceId="workspace-1" engagementId={null} folderId={null} active draft={{taskId:null,value,onChange:setValue}} operationIds={()=>'op-1'} onAccepted={accepted}/>;}const view=render(<Harness/>);return{start,reconcile,preflight,accepted,runtimeLoss:()=>view.rerender(<Harness epoch={1}/>)};}
async function choices(){fireEvent.click(screen.getByRole('button',{name:'Choose model'}));fireEvent.click(await screen.findByRole('menuitemradio',{name:'claude-sonnet-5-5'}));fireEvent.change(screen.getByRole('textbox'),{target:{value:result.request}});await waitFor(()=>expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).not.toBe('true'));}
afterEach(()=>{cleanup();delete (globalThis as {inquello?:unknown}).inquello;});
describe('Story 1.25 Start',()=>{
 it('clears failed preflight selection so the same model can be deliberately retried',async()=>{
  const api=setup();api.preflight.mockRejectedValueOnce(new Error('Availability could not be checked.'));
  await screen.findByRole('button',{name:'Choose model'});
  fireEvent.change(screen.getByRole('textbox'),{target:{value:result.request}});
  fireEvent.click(screen.getByRole('button',{name:'Choose model'}));
  fireEvent.click(await screen.findByRole('menuitemradio',{name:'claude-sonnet-5-5'}));
  await screen.findByText('Availability could not be checked.');
  expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model');
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);
  expect(api.start).not.toHaveBeenCalled();
  await choices();expect(api.preflight).toHaveBeenCalledTimes(2);expect(api.start).not.toHaveBeenCalled();
 });

 it('creates nothing on inspection and sends explicit provider defaults only with the request',async()=>{const api=setup();await screen.findByRole('button',{name:'Choose model'});expect(screen.getByRole('textbox')).toBe(document.activeElement);expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).toBe('true');expect(api.start).not.toHaveBeenCalled();await choices();expect(api.preflight).toHaveBeenCalledWith({workspaceId:'workspace-1',routeId:'claude-api-key',configurationRevision:3});expect(api.start).not.toHaveBeenCalled();fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',isComposing:true});expect(api.start).not.toHaveBeenCalled();fireEvent.keyDown(screen.getByRole('textbox'),{key:'Enter',shiftKey:true});expect(api.start).not.toHaveBeenCalled();fireEvent.click(screen.getByLabelText('Send'));await waitFor(()=>expect(api.accepted).toHaveBeenCalledWith(result));expect(api.start).toHaveBeenCalledWith({operationId:'op-1',workspaceId:'workspace-1',engagementId:null,folderId:null,request:result.request,routeId:'claude-api-key',configurationRevision:3,reasoning:'default',speed:'default'});expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');});
 it('preserves a lost acknowledgement and reconciles without another start',async()=>{const start=vi.fn(async()=>{throw new Error('lost');});const api=setup(start);await choices();fireEvent.click(screen.getByLabelText('Send'));await screen.findByText('Check operation outcome');expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);fireEvent.click(screen.getByLabelText('Send'));expect(start).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByText('Check operation outcome'));await waitFor(()=>expect(api.accepted).toHaveBeenCalled());expect(api.reconcile).toHaveBeenCalledWith({operationId:'op-1'});expect(start).toHaveBeenCalledTimes(1);});
 it('preserves the request on a refused preflight without creating work',async()=>{const api=setup();api.preflight.mockResolvedValue({ok:true,value:{...candidate,available:false,reason:'Workspace quota unknown'}});await screen.findByRole('button',{name:'Choose model'});fireEvent.change(screen.getByRole('textbox'),{target:{value:result.request}});fireEvent.click(screen.getByRole('button',{name:'Choose model'}));fireEvent.click(await screen.findByRole('menuitemradio',{name:'claude-sonnet-5-5'}));await screen.findAllByText('Workspace quota unknown');fireEvent.click(screen.getByLabelText('Send'));expect(api.start).not.toHaveBeenCalled();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);});
 it('releases a definitely refused operation but keeps the draft and requires route reconfirmation',async()=>{const start=vi.fn(async()=>({ok:false,code:'refused',reason:'Route changed before creation.'}));const api=setup(start);await choices();fireEvent.click(screen.getByLabelText('Send'));await screen.findByText('Route changed before creation.');expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model');expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model');expect(screen.queryByText('Check operation outcome')).toBeNull();expect(api.accepted).not.toHaveBeenCalled();await choices();expect(api.preflight).toHaveBeenCalledTimes(2);expect(start).toHaveBeenCalledTimes(1);});

 it('suppresses a delayed acceptance after runtime loss and reconciles the retained operation',async()=>{let finish!:(v:unknown)=>void;const start=vi.fn(()=>new Promise<unknown>(resolve=>{finish=resolve;}));const api=setup(start);await choices();fireEvent.click(screen.getByLabelText('Send'));api.runtimeLoss();finish({ok:true,value:result});await screen.findByText('Check operation outcome');await waitFor(()=>expect(screen.getByText(/Acceptance was not confirmed/)).toBeTruthy());expect(api.accepted).not.toHaveBeenCalled();expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);fireEvent.click(screen.getByText('Check operation outcome'));await waitFor(()=>expect(api.accepted).toHaveBeenCalledWith(result));expect(start).toHaveBeenCalledTimes(1);});

 it('never releases an irreversible retained binding whose first turn is uncertain',async()=>{const start=vi.fn(async()=>({ok:true,value:{...result,accepted:false,status:'uncertain',threadId:null}}));const api=setup(start);await choices();fireEvent.click(screen.getByLabelText('Send'));await screen.findByText('Check operation outcome');expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);expect(api.accepted).not.toHaveBeenCalled();fireEvent.click(screen.getByLabelText('Send'));expect(start).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByText('Check operation outcome'));await waitFor(()=>expect(api.accepted).toHaveBeenCalledWith(result));expect(start).toHaveBeenCalledTimes(1);});

});

describe('pre-effect draft validation and stale route refusal',()=>{
 it.each(['é'.repeat(65537),'R01\u0001'])('keeps invalid plain text editable without retaining an operation',async text=>{const api=setup();await choices();fireEvent.change(screen.getByRole('textbox'),{target:{value:text}});fireEvent.click(screen.getByLabelText('Send'));await screen.findByText(/Use plain text up to 128 KiB/);expect(api.start).not.toHaveBeenCalled();expect(screen.queryByText('Check operation outcome')).toBeNull();expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(false);});
 it('honors explicit no-effect refusal even after a runtime generation change',async()=>{let finish!:(v:unknown)=>void;const api=setup(vi.fn(()=>new Promise(resolve=>{finish=resolve;})));await choices();fireEvent.click(screen.getByLabelText('Send'));api.runtimeLoss();finish({ok:false,code:'refused',reason:'No work created.'});await screen.findByText('No work created.');expect(screen.queryByText('Check operation outcome')).toBeNull();expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(false);expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);});
});

it('keeps a proven setup failure draft editable, releases the operation, and never automatically retries',async()=>{
 const start=vi.fn(async()=>({ok:true,value:{...result,accepted:false,status:'setup-failed',reason:'Thread setup failed before submission.'}}));const api=setup(start);
 await choices();fireEvent.click(screen.getByLabelText('Send'));await screen.findByText('Thread setup failed before submission.');
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(false);
 expect(screen.queryByText('Check operation outcome')).toBeNull();expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model');expect(api.accepted).not.toHaveBeenCalled();expect(start).toHaveBeenCalledTimes(1);
 await choices();expect(start).toHaveBeenCalledTimes(1);fireEvent.click(screen.getByLabelText('Send'));await waitFor(()=>expect(start).toHaveBeenCalledTimes(2));
});
it('releases the pending operation only after reconciliation proves setup non-submission',async()=>{
 const start=vi.fn(async()=>{throw new Error('lost');});const api=setup(start);api.reconcile.mockResolvedValue({ok:true,value:{...result,accepted:false,status:'setup-failed'}});
 await choices();fireEvent.click(screen.getByLabelText('Send'));await screen.findByText('Check operation outcome');fireEvent.click(screen.getByText('Check operation outcome'));
 await screen.findByText(/Private Task setup failed before turn submission/);expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);expect((screen.getByRole('textbox') as HTMLTextAreaElement).readOnly).toBe(false);expect(start).toHaveBeenCalledTimes(1);expect(api.accepted).not.toHaveBeenCalled();
});


it('refreshes a retained hidden initial draft after a route-change notification without selecting or sending',async()=>{
 const listeners:Array<()=>void>=[];const changed=()=>listeners.forEach(fn=>fn());
 const list=vi.fn<()=>Promise<unknown>>(async()=>({ok:true,value:modelCatalog([{...route,configuration:null,revision:0,enabled:false}])}));
 const preflight=vi.fn(async()=>({ok:true,value:{...candidate,configurationRevision:4}})),start=vi.fn(),accepted=vi.fn();
 Object.assign(globalThis,{inquello:{routes:{pendingModel:vi.fn(async()=>({ok:true,value:{operation:null}})),resolve:vi.fn(async()=>({ok:true,value:(await (globalThis as any).inquello.routes.catalog()).value.bindings[0]})),catalog:list,onChanged:(fn:()=>void)=>{listeners.push(fn);return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};}},tasks:{preflight,start,reconcile:vi.fn()}}});
 function Harness({active}:{active:boolean}){const[value,setValue]=useState('Retain my unsent fictional draft.');return <StartView workspaceId="workspace-1" engagementId={null} folderId={null} active={active} draft={{taskId:null,value,onChange:setValue}} operationIds={()=>'op-retained'} onAccepted={accepted}/>;}
 const view=render(<Harness active/>);await waitFor(()=>expect(list).toHaveBeenCalled());
 expect(preflight).not.toHaveBeenCalled();view.rerender(<Harness active={false}/>);
 list.mockResolvedValue({ok:true,value:modelCatalog([{...route,revision:4}])});changed();
 await waitFor(()=>expect(list.mock.calls.length).toBeGreaterThanOrEqual(2));
 view.rerender(<Harness active/>);
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Retain my unsent fictional draft.');
 expect(preflight).not.toHaveBeenCalled();expect(start).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Choose model'}));
 expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model');
 expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).toBe('true');
 fireEvent.click(await screen.findByRole('menuitemradio',{name:'claude-sonnet-5-5'}));
 await waitFor(()=>expect(preflight).toHaveBeenCalledWith({workspaceId:'workspace-1',routeId:route.routeId,configurationRevision:4}));
 expect(start).not.toHaveBeenCalled();expect(accepted).not.toHaveBeenCalled();
});

it.each(['authority','catalog'] as const)('allows deliberate same-model reselection after %s invalidation without losing the draft',async kind=>{
 const listeners:Array<(change?:ModelAuthorityChange)=>void>=[];const changed=(change?:ModelAuthorityChange)=>listeners.forEach(fn=>fn(change));
 let catalog=modelCatalog([route]);
 const preflight=vi.fn(async()=>({ok:true,value:candidate})),start=vi.fn(),accepted=vi.fn();
 Object.assign(globalThis,{inquello:{routes:{pendingModel:vi.fn(async()=>({ok:true,value:{operation:null}})),resolve:vi.fn(async()=>({ok:true,value:(await (globalThis as any).inquello.routes.catalog()).value.bindings[0]})),catalog:vi.fn(async()=>({ok:true,value:catalog})),onChanged:(fn:typeof changed)=>{listeners.push(fn);return()=>{const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);};}},tasks:{preflight,start,reconcile:vi.fn()}}});
 function Harness(){const[value,setValue]=useState('');return <StartView workspaceId="workspace-1" engagementId={null} folderId={null} active draft={{taskId:null,value,onChange:setValue}} operationIds={()=>'op-reselect'} onAccepted={accepted}/>;}
 render(<Harness/>);await choices();expect(preflight).toHaveBeenCalledTimes(1);
 if(kind==='catalog'){catalog={...catalog,bindings:catalog.bindings.map(binding=>({...binding,stateRevision:binding.stateRevision+1}))};changed({authority:false});}else changed();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Choose model'}).textContent).toBe('Choose model'));
 expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request);
 expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).toBe('true');expect(start).not.toHaveBeenCalled();
 await choices();expect(preflight).toHaveBeenCalledTimes(2);expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).not.toBe('true');expect(start).not.toHaveBeenCalled();
});

describe('Story 2.1 attached material at Task start',()=>{
 const note='Attached material (Engagement) is in the Task folder under attached/. Read it with the evidence skill in skills/inquello-evidence/SKILL.md and cite what you rely on.';
 const attachment={attachmentId:'6f1c1d1e-0000-4000-8000-0000000000a1',label:'Engagement',createdAt:'2026-11-12T00:00:00.000Z',bytes:3,files:[{id:'attached/Engagement/a.csv',name:'a.csv',relative:'Engagement/a.csv',bytes:3,modifiedAt:'2026-11-12T00:00:00.000Z',sha256:'0'.repeat(64),format:'csv'}],notSearched:[],inaccessible:[],incomplete:[]};
 const sources=()=>({attach:vi.fn(async()=>({ok:true,value:attachment})),discard:vi.fn(async()=>({ok:true,value:{discarded:true}})),stage:vi.fn(),view:vi.fn()});
 async function attachFolder(){const button=await screen.findByRole('button',{name:'Attach folder'});await waitFor(()=>expect(button.getAttribute('aria-disabled')).not.toBe('true'));fireEvent.click(button);await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(`${result.request}\n\n${note}`));}
 it('sends the attachment ID with the start, with the visible note in the request, and says the material is there before the request is sent',async()=>{
  const start=vi.fn(async(command:unknown)=>({ok:true,value:{...result,request:(command as {request:string}).request}}));const bridge=sources();const api=setup(start,bridge);
  await choices();await attachFolder();
  expect(document.querySelector('[data-attach-notice]')!.textContent).toContain('placed in the Task folder before your request is sent');
  fireEvent.click(screen.getByLabelText('Send'));await waitFor(()=>expect(api.accepted).toHaveBeenCalled());
  expect(start).toHaveBeenCalledWith(expect.objectContaining({request:`${result.request}\n\n${note}`,attachmentIds:[attachment.attachmentId]}));
  expect(JSON.stringify(start.mock.calls)).not.toMatch(/[A-Z]:\\/);
  expect(bridge.stage).not.toHaveBeenCalled();
  expect(document.querySelector('[data-attachment]')).toBeNull();
 });
 it('keeps the attachment held after a refused or setup-failed start, sends it again only on a deliberate Send, and removing it removes the note',async()=>{
  const start=vi.fn<(command:unknown)=>Promise<unknown>>(async(command)=>({ok:true,value:{...result,request:(command as {request:string}).request,accepted:false,status:'setup-failed',reason:'The attached material could not be placed in the Task folder, so the first request was not sent.'}}));const api=setup(start,sources());
  await choices();await attachFolder();fireEvent.click(screen.getByLabelText('Send'));
  await screen.findByText('The attached material could not be placed in the Task folder, so the first request was not sent.');
  expect(document.querySelector('[data-attachment]')).toBeTruthy();expect(api.accepted).not.toHaveBeenCalled();expect(start).toHaveBeenCalledTimes(1);
  start.mockResolvedValueOnce({ok:false,code:'refused',reason:'The attached material could not be placed in the Task folder, so nothing was sent. Your draft and attachments are preserved.'});
  await choices();fireEvent.change(screen.getByRole('textbox'),{target:{value:`${result.request}\n\n${note}`}});await waitFor(()=>expect(screen.getByLabelText('Send').getAttribute('aria-disabled')).not.toBe('true'));
  fireEvent.click(screen.getByLabelText('Send'));await screen.findByText(/so nothing was sent/);
  expect(start).toHaveBeenLastCalledWith(expect.objectContaining({attachmentIds:[attachment.attachmentId]}));
  fireEvent.click(screen.getByRole('button',{name:/^Remove/}));
  await waitFor(()=>expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe(result.request));
  await choices();fireEvent.click(screen.getByLabelText('Send'));await waitFor(()=>expect(start).toHaveBeenCalledTimes(3));
  expect(start.mock.calls[2]![0]).not.toHaveProperty('attachmentIds');
 });
 it('refuses a ninth attachment with a plain reason and never drops a held one silently (review pass 1)',async()=>{
  let n=0;const bridge={...sources(),attach:vi.fn(async()=>{n++;return{ok:true,value:{...attachment,attachmentId:`6f1c1d1e-0000-4000-8000-0000000000b${n}`,label:`Folder ${n}`}};})};setup(undefined,bridge);
  const button=await screen.findByRole('button',{name:'Attach folder'});
  for(let i=1;i<=8;i++){await waitFor(()=>expect(button.getAttribute('aria-disabled')).not.toBe('true'));fireEvent.click(button);await waitFor(()=>expect(document.querySelectorAll('[data-attachment]')).toHaveLength(i));}
  await waitFor(()=>expect(button.getAttribute('aria-disabled')).not.toBe('true'));fireEvent.click(button);
  await waitFor(()=>expect(document.querySelector('[data-attach-notice]')!.textContent).toBe('Eight attachments is the most one request can carry. Remove one before attaching more; nothing else was attached.'));
  expect(bridge.attach).toHaveBeenCalledTimes(8);expect(bridge.discard).not.toHaveBeenCalled();
  expect([...document.querySelectorAll('[data-attachment]')].map(item=>item.getAttribute('data-attachment'))).toEqual(Array.from({length:8},(_,i)=>`6f1c1d1e-0000-4000-8000-0000000000b${i+1}`));
 });
});