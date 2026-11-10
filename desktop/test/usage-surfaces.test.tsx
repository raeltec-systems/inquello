// @vitest-environment jsdom
/// <reference lib="dom" />
/**
 * Owner decision 2026-11-04 (Codex desktop pattern): reasoning and the
 * environment chip sit beside the model in the composer footer; usage and
 * limits live in Settings > Usage; a limit refusal is shown inline in the
 * conversation. Truthful labelling from Stories 1.23 and 1.24 is unchanged.
 */
import {act,cleanup,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {LOCAL_ENVIRONMENT,REMOTE_GATE,type TaskEnvironmentView} from '../src/main/environments/types';
import type {TaskUsageView} from '../src/main/usage/types';
import type {RouteView} from '../src/main/routes/types';
import {Settings} from '../src/renderer/Settings';
import {viewFor} from '../src/renderer/App';
import {ConversationModelPicker} from '../src/renderer/Shell/ConversationModelPicker';
import {Composer} from '../src/renderer/Shell/Composer';
import {EnvironmentChip} from '../src/renderer/Shell/TaskEnvironment';
import {reasoningLabel,TaskReasoningControl,UsageLimitNotices} from '../src/renderer/Shell/TaskUsage';
import {TaskView} from '../src/renderer/Shell/TaskView';
import type {TaskItem} from '../src/renderer/Shell/organise-bridge';
import {forgetTaskModels} from '../src/renderer/Shell/model-authority';
import {modelCatalog,taskRouteView} from './model-fixtures';
import {attempt,facts,taskId} from './usage-fixtures';

const workspaceId='33333333-3333-4333-8333-333333333333';
const refusedId='44444444-4444-4444-8444-444444444444';
const environment=(overrides:Partial<TaskEnvironmentView>={}):TaskEnvironmentView=>({taskId,executionLabel:LOCAL_ENVIRONMENT,readiness:'ready',sandbox:'not-checked',inference:{status:'none',provider:null,deployment:null,endpoint:null,model:null,apiVersion:null,region:'Unknown'},remoteGate:REMOTE_GATE,hostedSandboxGate:'V2 revisit (OQ-13)',...overrides});
function exhausted():TaskUsageView{
 const view=facts(),prior=attempt('completed'),refused=attempt('refused');
 prior.snapshot.operation_kind='local-tool';prior.usage.input_tokens=null;
 refused.snapshot.attempt_id=refusedId;refused.snapshot.started_at_ms=5000;refused.ended_at_ms=6000;refused.snapshot.model='fixture-model-20261030';refused.usage.input_tokens=null;
 view.usage.attempts=[prior,refused];
 view.limits={source:'Codex plan/Workspace',status:'exhausted',reason:'Codex plan/Workspace blocks ordinary usage',nextAction:'Use permitted human handling; recheck current-account usage. No provider dispatch or reset-credit spending.'};
 return view;
}
function install(usage:TaskUsageView=facts(),env:TaskEnvironmentView=environment()){
 let usageChange=(_privateScope:boolean)=>{};
 const usageApi={forTask:vi.fn(async()=>({ok:true,value:usage})),set:vi.fn(async()=>({ok:true,value:usage})),onChanged:(fn:(privateScope:boolean)=>void)=>{usageChange=fn;return()=>{};}};
 const envApi={forTask:vi.fn(async()=>({ok:true,value:env})),onChanged:()=>()=>{}};
 Object.defineProperty(globalThis,'inquello',{configurable:true,value:{usage:usageApi,environments:envApi}});
 return{usageApi,envApi,usageChange:(privateScope=false)=>usageChange(privateScope)};
}
afterEach(()=>{cleanup();forgetTaskModels();Reflect.deleteProperty(globalThis,'inquello');globalThis.location.hash='';});

describe('composer footer: reasoning beside the model',()=>{
 it('labels unsaved, saved, stale and unknown settings without inventing a value',()=>{
  expect(reasoningLabel(null)).toEqual({text:'Reasoning',state:'unknown'});
  const view=facts();expect(reasoningLabel(view)).toEqual({text:'Reasoning not saved',state:'unsaved'});
  view.usage.settings={revision:1,route_revision:1,choices:{reasoning:'default',speed:'default'}};expect(reasoningLabel(view)).toEqual({text:'Reasoning: Default',state:'saved'});
  view.usage.settings={revision:2,route_revision:1,choices:{reasoning:'high',speed:'priority'}};expect(reasoningLabel(view).text).toBe('Reasoning: high · priority');
  view.capabilities.routeRevision=2;expect(reasoningLabel(view)).toEqual({text:'Reasoning: review',state:'stale'});
 });
 it('opens the explicit settings, saves provider defaults and starts no work',async()=>{
  const h=install();render(<TaskReasoningControl taskId={taskId}/>);
  const trigger=await screen.findByRole('button',{name:'Reasoning not saved'});expect(trigger.getAttribute('data-reasoning-state')).toBe('unsaved');
  expect(h.usageApi.set).not.toHaveBeenCalled();
  await userEvent.click(trigger);
  const dialog=await screen.findByRole('dialog',{name:'Reasoning and speed'});
  await within(dialog).findByText(/Defaults are not saved yet/);expect(within(dialog).getByLabelText('Reasoning')).toHaveProperty('value','default');
  await userEvent.click(within(dialog).getByRole('button',{name:'Save Task settings'}));
  expect(h.usageApi.set).toHaveBeenCalledWith(expect.objectContaining({taskId,expectedRevision:0,routeRevision:1,reasoning:'default',speed:'default'}));
  expect(screen.queryByRole('button',{name:/start/i})).toBeNull();
 });
 it('follows private invalidation: the label clears before the new facts arrive',async()=>{
  const saved=facts();saved.usage.settings={revision:1,route_revision:1,choices:{reasoning:'default',speed:'default'}};
  const h=install(saved);render(<TaskReasoningControl taskId={taskId}/>);await screen.findByRole('button',{name:'Reasoning: Default'});
  let release!:(value:unknown)=>void;h.usageApi.forTask.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve as never;}));
  act(()=>h.usageChange(true));expect(screen.getByRole('button',{name:'Reasoning'})).toBeTruthy();
  await act(async()=>release({ok:true,value:facts()}));expect(screen.getByRole('button',{name:'Reasoning not saved'})).toBeTruthy();
 });
 it('sits with the environment chip inside the model control for a conversation, and not on Start',async()=>{
  const route:RouteView={routeId:'codex-responses',provider:'OpenAI',configurable:true,configuration:{routeId:'codex-responses',deployment:'openai-api',model:'gpt-6.1-terra',apiVersion:'responses-v1',accountRef:'account',region:null},endpoint:'https://api.openai.com/v1/responses',revision:3,credentialPresent:true,adapterSupported:true,verification:'verified_for_synthetic',enabled:true,gate:null,limits:[],evidence:['synthetic fixture'],executionFlow:'Local sandbox',inferenceFlow:'Cloud inference',connectorFlow:'Unavailable'};
  const routes={catalog:vi.fn(async()=>({ok:true,value:modelCatalog([route])})),pendingModel:vi.fn(async()=>({ok:true,value:{operation:null}})),resolve:vi.fn(),selectModel:vi.fn(),bindingState:vi.fn(),forTask:vi.fn(async()=>({ok:true,value:taskRouteView({taskId,workspaceId,revision:1,selected:route,configurationRevision:3,staleConfiguration:false})}))};
  install();Object.assign((globalThis as unknown as {inquello:Record<string,unknown>}).inquello,{routes});
  const view=render(<Composer draft={{taskId,value:'',onChange:()=>{}}} routeLabel={<ConversationModelPicker workspaceId={workspaceId} taskId={taskId} selected={null}/>}/>);
  const footer=await waitFor(()=>{const node=document.querySelector('[data-conversation-model]');if(!node)throw new Error('no footer');return node as HTMLElement;});
  await within(footer).findByRole('button',{name:'Reasoning not saved'});
  expect(within(footer).getByRole('button',{name:/^Environment: runs on This device \(local host\)/})).toBeTruthy();
  expect(within(footer).getByRole('button',{name:'Choose model'})).toBeTruthy();
  // In a conversation the footer reads before the field, so Send stays the next stop after the message.
  view.rerender(<Composer draft={{taskId,value:'',onChange:()=>{}}} routeBeforeField routeLabel={<ConversationModelPicker workspaceId={workspaceId} taskId={taskId} selected={null}/>}/>);
  await screen.findByRole('button',{name:'Reasoning not saved'});
  const composer=document.querySelector('[data-composer]')!;expect(composer.classList.contains('iq-composer--route')).toBe(true);
  const controls=[...composer.querySelectorAll<HTMLElement>('button, textarea')];
  expect(controls.slice(-2)).toEqual([screen.getByRole('textbox'),composer.querySelector('[data-composer-send]')]);
  expect(controls.slice(0,-2).every(control=>control.closest('[data-conversation-model]'))).toBe(true);
  view.rerender(<Composer draft={{taskId:null,value:'',onChange:()=>{}}} routeLabel={<ConversationModelPicker workspaceId={workspaceId} selected={null}/>}/>);
  expect(document.querySelector('[data-environment-chip]')).toBeNull();expect(document.querySelector('[data-conversation-reasoning]')).toBeNull();
 });
});

describe('composer footer: environment chip',()=>{
 it('opens where commands run, kept apart from where inference runs, with remote gates disabled',async()=>{
  const h=install();render(<EnvironmentChip taskId={taskId}/>);
  const chip=screen.getByRole('button',{name:/^Environment: runs on This device \(local host\)/});expect(chip.textContent).toBe('Runs on this device');
  expect(h.envApi.forTask).not.toHaveBeenCalled();
  await userEvent.click(chip);
  const dialog=await screen.findByRole('dialog',{name:'Environment'});
  const panel=await waitFor(()=>{const node=dialog.querySelector('[data-task-environment]');if(!node?.textContent?.includes('No conversation model selected'))throw new Error('not yet');return node as HTMLElement;});
  for(const text of ['This device (local host)','Ready — runtime-owned configuration verified','Not checked','No conversation model selected'])expect(within(panel).getByText(text)).toBeTruthy();
  expect(panel.textContent).toContain('Local execution does not mean local or offline inference.');
  expect([...panel.querySelectorAll('button[aria-disabled="true"]')].length).toBeGreaterThanOrEqual(2);
  expect(h.envApi.forTask).toHaveBeenCalledWith({taskId});
  await userEvent.click(within(dialog).getByRole('button',{name:'Close Environment'}));
  expect(screen.queryByRole('dialog',{name:'Environment'})).toBeNull();
 });
 it('shows an unread environment as unavailable, never as local inference',async()=>{
  install();Object.assign((globalThis as unknown as {inquello:{environments:{forTask:unknown}}}).inquello.environments,{forTask:vi.fn(async()=>({ok:false,reason:'secret transport detail'}))});
  render(<EnvironmentChip taskId={taskId}/>);await userEvent.click(screen.getByRole('button',{name:/^Environment:/}));
  const dialog=await screen.findByRole('dialog',{name:'Environment'});
  await within(dialog).findByText('Environment information unavailable. Refresh to check this Task.');
  expect(dialog.textContent).toContain('Model information unavailable');expect(dialog.textContent).not.toContain('secret transport detail');
 });
});

describe('inline limit notice in the conversation',()=>{
 it('shows the refused attempt with the exhausted-limit explanation and next action, not a toast',async()=>{
  install(exhausted());render(<UsageLimitNotices taskId={taskId}/>);
  const notice=await screen.findByRole('note',{name:'Usage limit'});
  expect(notice.getAttribute('data-usage-attempt')).toBe(refusedId);
  expect(notice.textContent).toContain('Automated permission review — refused at the usage-limit check');
  expect(notice.textContent).toContain('Current limit: Codex plan/Workspace: exhausted. Codex plan/Workspace blocks ordinary usage');
  expect(notice.textContent).toContain('Use permitted human handling; recheck current-account usage.');
  expect(notice.textContent).toContain(`Refused attempt ${refusedId}`);expect(notice.textContent).toContain('model fixture-model-20261030');
  expect(notice.textContent).toContain('Nothing is retried automatically');
  expect(screen.getByRole('link',{name:'Usage and limits'}).getAttribute('href')).toBe('#settings-usage');
  expect(screen.getAllByRole('note')).toHaveLength(1);
 });
 it('shows nothing when no attempt was refused, and an unknown model as Unknown',async()=>{
  const h=install(facts());const view=render(<UsageLimitNotices taskId={taskId}/>);await waitFor(()=>expect(h.usageApi.forTask).toHaveBeenCalled());expect(screen.queryByRole('note')).toBeNull();
  const unknown=exhausted();unknown.usage.attempts[1]!.snapshot.model=null;unknown.limits={source:'Codex plan/Workspace',status:'unknown',reason:'Required current-account quota check unavailable; affected model dispatch is refused',nextAction:'Refresh account usage or use permitted human handling.'};
  h.usageApi.forTask.mockResolvedValue({ok:true,value:unknown});act(()=>h.usageChange(false));
  const notice=await screen.findByRole('note',{name:'Usage limit'});expect(notice.textContent).toContain('model Unknown');expect(notice.textContent).toContain('Codex plan/Workspace: unknown.');expect(notice.textContent).not.toContain('exhausted');
  view.unmount();
 });
 it('is rendered in the open conversation transcript',async()=>{
  install(exhausted());
  const task={taskId,workspaceId,engagementId:null,folderId:null,title:'Quota check',revision:1,runtimeThreadId:null} as unknown as TaskItem;
  Object.assign((globalThis as unknown as {inquello:Record<string,unknown>}).inquello,{tasks:{progress:vi.fn(async()=>({ok:false,reason:'unavailable'})),onProgressChanged:()=>()=>{},onSessionChanged:()=>()=>{}}});
  render(<TaskView task={task} engagements={[]} folders={[]} onRename={vi.fn()} onMove={vi.fn()} newOperationId={()=>'x'}/>);
  const conversation=screen.getByRole('region',{name:'Conversation'});
  expect((await within(conversation).findByRole('note',{name:'Usage limit'})).getAttribute('data-usage-attempt')).toBe(refusedId);
 });
});

describe('Settings > Usage',()=>{
 it('is a Settings section reachable by its own hash',()=>{expect(viewFor('#settings-usage')).toBe('settings');});
 it('shows attributable usage and inherited limits for the open conversation',async()=>{
  install(exhausted());globalThis.location.hash='#settings-usage';
  render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()} conversation={{taskId,title:'Quota check'}}/>);
  expect(screen.getByRole('link',{name:'Usage'}).getAttribute('aria-current')).toBe('page');
  const panel=await waitFor(()=>{const node=document.querySelector('[data-task-usage]');if(!node?.querySelector('[data-usage-attempt]'))throw new Error('not yet');return node as HTMLElement;});
  expect(screen.getByText('Quota check')).toBeTruthy();
  expect(panel.textContent).toContain('Codex plan/Workspace: exhausted.');expect(panel.textContent).toContain('Use permitted human handling');
  expect(within(panel).getByText('Automated permission review — refused')).toBeTruthy();expect(within(panel).getByText('Local tool invocation — completed')).toBeTruthy();
  expect(within(panel).getAllByText('Unknown / Unknown').length).toBeGreaterThan(0);
  expect(panel.textContent).toContain('Unknown consumption is not zero.');
  // Reasoning is chosen in the composer, not here.
  expect(within(panel).queryByLabelText('Reasoning')).toBeNull();
 });
 it('asks for an open conversation instead of inventing totals',()=>{
  const h=install();globalThis.location.hash='#settings-usage';
  render(<Settings onBack={vi.fn()} onIdentityChanged={vi.fn()} conversation={null}/>);
  expect(screen.getByText(/Open a conversation to see its attributable usage/)).toBeTruthy();expect(document.querySelector('[data-task-usage]')).toBeNull();expect(h.usageApi.forTask).not.toHaveBeenCalled();
 });
});
