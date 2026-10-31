import {describe,it,expect,vi} from 'vitest';
import {OrganiseService,searchPayload,reopenPayload,navigationPayload} from '../src/main/organise';
import {searchView,reopenView} from '../src/main/organise/navigation';
import {TaskService,INBOX_OBSERVATION_TIMEOUT_MS} from '../src/main/tasks/service';
const workspace='11111111-1111-4111-8111-111111111111',taskId='22222222-2222-4222-8222-222222222222',principal='33333333-3333-4333-8333-333333333333',engagement='44444444-4444-4444-8444-444444444444';
const task={taskId,workspaceId:workspace,title:'Procurement January–June',runtimeThreadId:'thread',engagementId:null,folderId:null,sourceRefs:[],artifactRefs:[],visibility:'private',revision:2,pinned:true,archived:true};
const hit={turnId:'old-turn',itemId:'invoice-104',text:'INV-104 is a potential duplicate.',truncated:false};
const search={workspaceId:workspace,query:'INV-104',items:[{kind:'conversation',taskId,engagementId:null,title:task.title,snippet:hit.text,turnId:hit.turnId,itemId:hit.itemId,archived:true}],nextCursor:null,unavailable:false,coverage:['Retained conversations']};
function harness(){let user:string|null=principal,instance=1;let members=[{workspace_id:workspace,name:'Fictional Audit',authorization_epoch:'1',membership:{status:'active'},engagements:[{engagement_id:engagement}]}];const request=vi.fn(async(method:string)=>method==='inquello/workspace/search'?search:method==='inquello/task/reopen'?{task,hit}:method==='inquello/task/setNavigation'?{task}:{principalId:principal});const service=new OrganiseService({runtime:{ready:()=>true,instance:()=>instance,request:request as never},identity:{principalId:()=>user,snapshot:()=>({sharedService:'available'}),withAccess:async fn=>fn('fixture')},service:{workspaces:async()=>({principal_id:principal,workspaces:structuredClone(members)})} as never,logger:{warn:vi.fn()} as never});return{service,request,revoke:()=>{members=[];},changeIdentity:()=>{user=null;},restart:()=>{instance++;}};}
describe('saved-work named boundary and fresh scope',()=>{
 it('rejects injected authority, oversized/empty search and incomplete hit identity',()=>{const input={workspaceId:workspace,query:'INV-104',includeArchived:true,cursor:null};expect(searchPayload([input])).toEqual(input);for(const extra of [{principalId:principal},{threadId:'peer'},{includeArchived:'true'},{query:'é'.repeat(129)},{query:' '},{query:'invoice\u0001'},{query:'invoice\n'}])expect(()=>searchPayload([{...input,...extra}])).toThrow();expect(()=>reopenPayload([{workspaceId:workspace,taskId,query:null,turnId:'old',itemId:'x'}])).toThrow();expect(()=>navigationPayload([{operationId:principal,workspaceId:workspace,taskId,expectedRevision:0,pinned:true,archived:1}])).toThrow();});
 it('projects inert bounded snippets and exact hit IDs without opaque native fields',()=>{expect(searchView({...search,secret:'never-forward'})).toEqual(search);expect(JSON.stringify(reopenView({task,hit,credential:'never-forward'}))).not.toContain('never-forward');expect(()=>searchView({...search,items:Array(51).fill(search.items[0])})).toThrow();});
 it('search/reopen/preferences require no provider call and preserve exact old item',async()=>{const x=harness();expect(await x.service.search({workspaceId:workspace,query:'INV-104',includeArchived:true,cursor:null})).toMatchObject({ok:true,value:search});expect(await x.service.reopen({workspaceId:workspace,taskId,query:'INV-104',turnId:hit.turnId,itemId:hit.itemId})).toMatchObject({ok:true,value:{hit}});expect(await x.service.setNavigation({workspaceId:workspace,taskId,operationId:principal,expectedRevision:1,pinned:true,archived:true})).toMatchObject({ok:true,value:{archived:true}});expect(x.request.mock.calls.every(([name])=>!name.includes('provider')&&!name.includes('resume'))).toBe(true);});
 it.each(['revoke','changeIdentity','restart'] as const)('suppresses late search after %s',async change=>{const x=harness();x.request.mockImplementation(async(method:string)=>{if(method==='inquello/workspace/search'){x[change]();return search;}return{} as never;});expect(await x.service.search({workspaceId:workspace,query:'INV-104',includeArchived:true,cursor:null})).toMatchObject({ok:false});});
 it('observes one bounded scoped inventory and rejects a stale snapshot without renderer grants',async()=>{
  const x=harness();const first=await x.service.authorizeContext({workspaceId:workspace,expectedSnapshot:null});
  expect(first).toMatchObject({available:true,serviceEngagementIds:[engagement]});expect(first.snapshot).toMatch(/^[0-9a-f]{64}$/);
  expect(await x.service.authorizeContext({workspaceId:workspace,expectedSnapshot:first.snapshot})).toEqual(first);
  expect(await x.service.authorizeContext({workspaceId:workspace,expectedSnapshot:'0'.repeat(64)})).toEqual({available:false,snapshot:null,serviceEngagementIds:[]});
  expect(await x.service.authorizeContext({workspaceId:workspace,serviceEngagementId:engagement,taskId})).toEqual({available:false,snapshot:null,serviceEngagementIds:[]});
  x.revoke();expect(await x.service.authorizeContext({workspaceId:workspace,expectedSnapshot:first.snapshot})).toEqual({available:false,snapshot:null,serviceEngagementIds:[]});
 });
});
function attention(){let policy:unknown={workspaceId:workspace,authorizationEpoch:1};let status='running';const prepare=vi.fn(async()=>({ok:false}));const question={threadId:'thread',turnId:'turn',itemId:'vendor-question',questions:[{id:'vendor',header:'Evidence',question:'Which vendor evidence should I inspect?',isOther:true,isSecret:false,options:null}]};const request=vi.fn(async(method:string)=>method==='inquello/workspace/tree'?{workspaceId:workspace,tasks:[task]}:method==='inquello/task/reopen'?{task,hit:null}:method==='inquello/tasks/forThread'?{taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status}: {version:1,taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status,historyIncomplete:false,items:[],plan:[],results:[],artifact:'absent'});const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal},syncPrincipal:async()=>{},freshPolicy:async()=>policy as never,prepareRoutes:prepare});return{service,question,prepare,request,setPolicy:(next:unknown)=>{policy=next;},revoke:()=>{policy=null;},finish:()=>{status='completed';}};}
describe('real current input Inbox',()=>{
 it('includes archived Tasks, reaches actual request identity and removes resolved input',async()=>{const x=attention();const pending=x.service.question('request-1',x.question);await new Promise(r=>setTimeout(r,0));expect(await x.service.inbox({workspaceId:workspace})).toMatchObject({ok:true,value:{unavailable:false,items:[{taskId,itemId:'vendor-question',requestId:'request-1'}]}});expect(x.prepare).not.toHaveBeenCalled();x.service.notification('serverRequest/resolved',{threadId:'thread',requestId:'request-1'});expect(await pending).toEqual({answers:{}});expect(await x.service.inbox({workspaceId:workspace})).toMatchObject({ok:true,value:{items:[]}});});
 it('terminal input disappears and authority loss is unavailable, not zero',async()=>{const x=attention();const pending=x.service.question(7,x.question);await new Promise(r=>setTimeout(r,0));x.finish();expect(await x.service.inbox({workspaceId:workspace})).toMatchObject({ok:true,value:{items:[]}});await pending;x.revoke();expect(await x.service.inbox({workspaceId:workspace})).toMatchObject({ok:false});});
 it('clears pending disclosure on exact context denial',async()=>{const x=attention();const pending=x.service.question(8,x.question);await new Promise(r=>setTimeout(r,0));x.request.mockImplementation(async()=>{throw new Error('revoked Engagement');});expect(await x.service.inbox({workspaceId:workspace})).toMatchObject({ok:false});x.service.invalidate();await pending;});
});

/** Deterministic transport/service witness, not a native latency benchmark.
 * The real-RPC native witness separately asserts this callback sequence. */
describe('populated fictional Workspace callback budget',()=>{
 it.each([1,51])('counts every authority and inventory callback for %i private Tasks',async count=>{
  const counters={inventory:0,policy:0,callbacks:0};
  const members={principal_id:principal,workspaces:[{workspace_id:workspace,name:'Fictional procurement',authorization_epoch:'1',membership:{status:'active'},engagements:[{engagement_id:engagement}]}]};
  let service:OrganiseService;
  const policy=async()=>{counters.policy++;return {workspaceId:workspace,authorizationEpoch:1};};
  const runtime={ready:()=>true,instance:()=>1,request:async(method:string)=>{
   if(method==='inquello/session/setPrincipal')return{};
   if(!['inquello/workspace/tree','inquello/workspace/search','inquello/task/reopen'].includes(method))throw new Error('Unexpected native request');
   // Native synthetic/draft sequence: generic pre + operation + generic post + final;
   // reopen has no additional operation policy callback. No per-Task callbacks.
   const policyCount=method==='inquello/task/reopen'?3:4;
   counters.callbacks++;await policy();
   counters.callbacks++;const before=await service.authorizeContext({workspaceId:workspace,expectedSnapshot:null});
   for(let i=1;i<policyCount;i++){counters.callbacks++;await policy();}
   counters.callbacks++;const after=await service.authorizeContext({workspaceId:workspace,expectedSnapshot:before.snapshot});
   if(!after.available)throw new Error('Stale inventory');
   if(method==='inquello/task/reopen')return{task,hit};
   if(method==='inquello/workspace/search')return{...search,items:Array.from({length:Math.min(count,50)},(_,i)=>({...search.items[0],itemId:`invoice-${i}`})),nextCursor:count>50?'page-2':null};
   return{workspaceId:workspace,engagements:[],folders:[],tasks:Array.from({length:count},(_,i)=>({...task,taskId:`22222222-2222-4222-8222-${String(i).padStart(12,'0')}`}))};
  }};
  service=new OrganiseService({runtime:runtime as never,identity:{principalId:()=>principal,snapshot:()=>({sharedService:'available'}),withAccess:async f=>f('fictional')},service:{workspaces:async()=>{counters.inventory++;return structuredClone(members);}} as never,logger:{warn:vi.fn()} as never});
  await service.getWorkspaces();counters.inventory=0;
  expect(await service.getTree(workspace)).toMatchObject({ok:true});expect(counters).toEqual({inventory:4,policy:4,callbacks:6});
  counters.inventory=0;counters.policy=0;counters.callbacks=0;
  expect(await service.search({workspaceId:workspace,query:'INV-104',includeArchived:true,cursor:null})).toMatchObject({ok:true});expect(counters).toEqual({inventory:4,policy:4,callbacks:6});
  counters.inventory=0;counters.policy=0;counters.callbacks=0;
  expect(await service.reopen({workspaceId:workspace,taskId,query:'INV-104',turnId:hit.turnId,itemId:hit.itemId})).toMatchObject({ok:true});expect(counters).toEqual({inventory:4,policy:3,callbacks:5});
 });
});

describe('strict saved Task projection',()=>{
 it.each([
  {taskId:undefined},{workspaceId:'not-an-id'},{engagementId:undefined},{folderId:{}},{runtimeThreadId:{}},{runtimeThreadId:'é'.repeat(65)},
  {title:'x'.repeat(201)},{revision:-1},{revision:1.5},{revision:'1'},{pinned:'true'},{archived:1},{sourceRefs:[{}]},{artifactRefs:[null]},
  {sourceRefs:Array(257).fill('x')},{artifactRefs:['x'.repeat(1025)]},{visibility:'shared'}
 ])('rejects malformed Task fields without coercion: %j',patch=>{expect(()=>reopenView({task:{...task,...patch},hit})).toThrow();});
 it('preserves printable legacy thread references and 200 Unicode-character titles',()=>{expect(reopenView({task:{...task,title:'é'.repeat(200),runtimeThreadId:'legacy-thread:123'},hit}).task).toMatchObject({title:'é'.repeat(200),runtimeThreadId:'legacy-thread:123'});});
});

describe('bounded current Inbox observation',()=>{
 it('returns unavailable on a stalled observation and never schedules later work from it',async()=>{
  const x=attention();const pending=x.service.question('bounded-question',x.question);await new Promise(r=>setTimeout(r,0));
  let resolve!:(v:unknown)=>void;x.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  vi.useFakeTimers();try{
   const observation=x.service.inbox({workspaceId:workspace});await vi.advanceTimersByTimeAsync(0);
   const count=x.request.mock.calls.length;await vi.advanceTimersByTimeAsync(INBOX_OBSERVATION_TIMEOUT_MS);
   expect(await observation).toMatchObject({ok:false});resolve({task,hit:null});await vi.advanceTimersByTimeAsync(0);expect(x.request.mock.calls.length).toBe(count);
  }finally{vi.useRealTimers();x.service.invalidate();await pending;}
 });
 it('does not publish a Task deleted during the final policy await',async()=>{
  let policyCalls=0,deleted=false;const question={threadId:'thread',turnId:'turn',itemId:'question',questions:[{id:'q',header:'Evidence',question:'Which vendor?',isOther:true,isSecret:false,options:null}]};
  const request=vi.fn(async(method:string)=>method==='inquello/workspace/tree'?{workspaceId:workspace,tasks:deleted?[]:[task]}:method==='inquello/task/reopen'?{task,hit:null}:method==='inquello/tasks/forThread'?{taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status:'running'}:{version:1,taskId,workspaceId:workspace,runId:'run',threadId:'thread',turnId:'turn',runtimeId:'runtime',status:'running',historyIncomplete:false,items:[],plan:[],results:[],artifact:'absent'});
  const service=new TaskService({runtime:{ready:()=>true,instance:()=>1,request:request as never},identity:{principalId:()=>principal},syncPrincipal:async()=>{},freshPolicy:async()=>{policyCalls++;if(policyCalls===2)deleted=true;return{workspaceId:workspace,authorizationEpoch:1} as never;},prepareRoutes:vi.fn()});
  const pending=service.question('request',question);await new Promise(r=>setTimeout(r,0));policyCalls=0;
  expect(await service.inbox({workspaceId:workspace})).toMatchObject({ok:true,value:{items:[],unavailable:true}});
  expect(request.mock.calls.at(-1)?.[0]).toBe('inquello/workspace/tree');service.invalidate();await pending;
 });
 it('stops scheduling after scope invalidation while a read is in flight',async()=>{
  const x=attention(),pending=x.service.question('scope-question',x.question);await new Promise(r=>setTimeout(r,0));let resolve!:(v:unknown)=>void;
  x.request.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const observation=x.service.inbox({workspaceId:workspace});await new Promise(r=>setTimeout(r,0));const count=x.request.mock.calls.length;
  x.service.invalidate();resolve({task,hit:null});expect(await observation).toMatchObject({ok:false});expect(x.request.mock.calls.length).toBe(count);await pending;
 });
});

it('withholds a same-ID replacement arriving during final Inbox authorization',async()=>{
 const x=attention(),first=x.service.question('reused',x.question);await new Promise(r=>setTimeout(r,0));
 const original=x.request.getMockImplementation()!;let reached!:(v?:unknown)=>void,release!:(v:unknown)=>void;
 const atFinal=new Promise(r=>{reached=r;});x.request.mockImplementation(async(method:string)=>{if(method==='inquello/workspace/tree'){reached();return new Promise(r=>{release=r;});}return original(method);});
 const observation=x.service.inbox({workspaceId:workspace});await atFinal;
 x.service.notification('serverRequest/resolved',{threadId:'thread',requestId:'reused'});await first;
 const second=x.service.question('reused',x.question);await new Promise(r=>setTimeout(r,0));release({workspaceId:workspace,tasks:[task]});
 expect(await observation).toMatchObject({ok:true,value:{items:[],unavailable:true}});x.service.invalidate();await second;
});
