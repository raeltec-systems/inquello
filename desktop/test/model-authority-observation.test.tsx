// @vitest-environment jsdom
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useTaskObservation} from '../src/renderer/Shell/task-observation';
import {rememberTaskModel,forgetTaskModels,type ModelAuthorityChange} from '../src/renderer/Shell/model-authority';
const workspace='workspace',a='task-a',b='task-b';
const snapshot=(taskId:string,text:string)=>({version:1,taskId,workspaceId:workspace,runId:'run',threadId:taskId,turnId:'turn',runtimeId:'runtime',status:'running',historyIncomplete:false,items:[{id:'message',kind:'message',status:'completed',text}],plan:[],results:[],artifact:'absent',questions:[],sessionGeneration:1});
function View({id}:{id:string}){const value=useTaskObservation(id,workspace,true,true);return <p aria-label={id}>{value?.items[0]?.text??'Waiting'}</p>;}
afterEach(()=>{cleanup();forgetTaskModels();Reflect.deleteProperty(globalThis,'inquello');});
it.each([false,true])('rejects queued A renderer disclosure on a bounded binding event while B remains visible (history=%s)',async history=>{
 rememberTaskModel({taskId:a,configurationRevision:history?2:1,selected:{routeId:'codex-responses'},disclosureBindings:(history?[1,2]:[1]).map(configurationRevision=>({routeId:'codex-responses',configurationRevision,active:true}))} as never);rememberTaskModel({taskId:b,configurationRevision:2,selected:{routeId:'codex-responses'},disclosureBindings:[{routeId:'codex-responses',configurationRevision:2,active:true}]} as never);
 let release!:(value:unknown)=>void,change!:(event:ModelAuthorityChange)=>void;let first=true;
 const progress=vi.fn(async({taskId}:{taskId:string})=>taskId===b?{ok:true,value:snapshot(b,'B retained')}:first?(first=false,new Promise(resolve=>{release=resolve;})):{ok:false});
 Object.assign(globalThis,{inquello:{tasks:{progress},routes:{onChanged:(fn:typeof change)=>{change=fn;return()=>{};}}}});render(<><View id={a}/><View id={b}/></>);await screen.findByText('B retained');await waitFor(()=>expect(release).toBeTypeOf('function'));
 act(()=>change({authority:true,binding:{routeId:'codex-responses',configurationRevision:1}}));expect(screen.getByText('B retained')).toBeTruthy();await act(async()=>release({ok:true,value:snapshot(a,'A stale private reply')}));expect(screen.queryByText('A stale private reply')).toBeNull();expect(screen.getByText('B retained')).toBeTruthy();
});
