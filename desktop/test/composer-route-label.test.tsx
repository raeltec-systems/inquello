// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {forgetTaskModels,type ModelAuthorityChange} from '../src/renderer/Shell/model-authority';
import {taskRouteView} from './model-fixtures';
import {TaskRouteLabel} from '../src/renderer/Shell/TaskRouteLabel';
const task='task-a',workspace='workspace-a';
const route={routeId:'claude-api-key',provider:'Anthropic',configurable:true,configuration:{routeId:'claude-api-key',deployment:'anthropic-direct',model:'exact-synthetic-model',apiVersion:'fixture-api',accountRef:'account',region:null},endpoint:null,revision:2,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['synthetic'],executionFlow:'local',inferenceFlow:'fixture',connectorFlow:'none'};
const view=(taskId=task)=>taskRouteView({taskId,workspaceId:workspace,revision:1,configurationRevision:2,staleConfiguration:false,selected:route as never});
function setup(){
 let changed=(_event?:ModelAuthorityChange)=>{},session=()=>{};
 const forTask=vi.fn(async(_input:{taskId:string}):Promise<unknown>=>({ok:true,value:view()}));
 const list=vi.fn(),select=vi.fn(),configure=vi.fn();
 Object.assign(globalThis,{inquello:{routes:{forTask,list,select,configure,onChanged:(fn:(event?:ModelAuthorityChange)=>void)=>{changed=fn;return()=>{};}},tasks:{onSessionChanged:(fn:(event?:ModelAuthorityChange)=>void)=>{session=fn;return()=>{};}}}});
 return{forTask,list,select,configure,changed:(event?:ModelAuthorityChange)=>changed(event),session:()=>session()};
}
afterEach(()=>{forgetTaskModels();cleanup();Reflect.deleteProperty(globalThis,'inquello');});
describe('Composer current selected route label',()=>{
 it('shows only the exact selected model and provider from authorized forTask',async()=>{
  const x=setup();render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);
  await screen.findByText('exact-synthetic-model');expect(screen.getByText('· Anthropic')).toBeTruthy();
  expect(x.forTask).toHaveBeenCalledWith({taskId:task});expect(x.list).not.toHaveBeenCalled();expect(x.select).not.toHaveBeenCalled();expect(x.configure).not.toHaveBeenCalled();expect(screen.queryByRole('combobox')).toBeNull();
 });
 it('clears immediately when route changes and refuses a late prior result',async()=>{
  const x=setup();render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);await screen.findByText('exact-synthetic-model');
  let release!:(v:unknown)=>void;x.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  act(()=>x.changed());expect(screen.queryByText('exact-synthetic-model')).toBeNull();
  x.forTask.mockResolvedValueOnce({ok:false,reason:'Current scope unavailable'});act(()=>x.changed());
  await act(async()=>release({ok:true,value:view()}));expect(screen.queryByText('exact-synthetic-model')).toBeNull();
 });
 it.each(['identity','runtime'])('clears on %s/session invalidation without reading under the old scope',async()=>{
  const x=setup();render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);await screen.findByText('exact-synthetic-model');
  act(()=>x.session());expect(screen.queryByText('exact-synthetic-model')).toBeNull();expect(x.forTask).toHaveBeenCalledTimes(1);
  act(()=>x.changed());await screen.findByText('exact-synthetic-model');expect(x.forTask).toHaveBeenCalledTimes(2);
 });
 it('never publishes the previous Task after navigation',async()=>{
  const x=setup();let release!:(v:unknown)=>void;x.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
  const rendered=render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);
  await waitFor(()=>expect(x.forTask).toHaveBeenCalledTimes(1));
  x.forTask.mockResolvedValue({ok:true,value:{...view('task-b'),selected:null,configurationRevision:null}});
  rendered.rerender(<TaskRouteLabel taskId="task-b" workspaceId={workspace}/>);
  await act(async()=>release({ok:true,value:view()}));expect(screen.queryByText('exact-synthetic-model')).toBeNull();
 });
 it.each(['unselected','wrong-workspace','revision','refused'])('does not invent a fallback for %s route data',async kind=>{
  const x=setup(),value=view();
  const modified=kind==='unselected'?{...value,selected:null,configurationRevision:null}:kind==='stale'?{...value,staleConfiguration:true,selected:{...route,enabled:false}}:kind==='wrong-workspace'?{...value,workspaceId:'other'}:kind==='revision'?{...value,configurationRevision:9}:value;
  x.forTask.mockResolvedValue(kind==='refused'?{ok:false,reason:'Unavailable'}:{ok:true,value:modified});
  const rendered=render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);await act(async()=>{});
  expect(rendered.container.textContent).toBe('');expect(x.list).not.toHaveBeenCalled();
 });
 it('retains the exact unavailable saved model name with an actionable reason',async()=>{
  const x=setup();x.forTask.mockResolvedValue({ok:true,value:{...view(),staleConfiguration:true,selected:{...route,enabled:false}}});render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);
  await screen.findByText('exact-synthetic-model');expect(screen.getByText('· unavailable')).toBeTruthy();expect(document.querySelector('[data-composer-route]')?.getAttribute('title')).toContain('Revalidate');
 });
});

it('applies a bounded binding authority event only to its exact saved model',async()=>{
 const h=setup();render(<TaskRouteLabel taskId={task} workspaceId={workspace}/>);await screen.findByText('exact-synthetic-model');
 act(()=>h.changed({authority:true,binding:{routeId:'claude-api-key',configurationRevision:3}}));expect(h.forTask).toHaveBeenCalledTimes(1);expect(screen.getByText('exact-synthetic-model')).toBeTruthy();
 h.forTask.mockResolvedValue({ok:true,value:{...view(),staleConfiguration:true,selected:{...route,enabled:false,gate:'This saved model was revoked.'}}});act(()=>h.changed({authority:true,binding:{routeId:'claude-api-key',configurationRevision:2}}));await screen.findByText('· unavailable');expect(h.forTask).toHaveBeenCalledTimes(2);
});
