import fs from 'node:fs';
import path from 'node:path';
import {afterAll,describe,expect,it,vi} from 'vitest';
import {OnboardingService,ONBOARDING_REASONS} from '../src/main/onboarding/service';
import {OnboardingClient} from '../src/main/onboarding/client';
import {OnboardingStore,type RecordState,type OnboardingStorage} from '../src/main/onboarding/store';
import {emptyDraft,envelope,payload,createInput,acceptInput,inviteInput,parseInvitations} from '../src/main/onboarding/contracts';
import {PROTOCOL_MAJOR,SCHEMA_VERSION} from '../src/main/identity/wire';
import {ServiceError,type HttpRequest} from '../src/main/identity/service-client';
import {fakeSafeStorage} from './identity-fakes';
import {removeTempDirs,tempDir,recordingLogger} from './helpers';
import {createOperations,registerOperations,type OperationDeps} from '../src/main/security/operations';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',W='33333333-3333-4333-8333-333333333333',I='44444444-4444-4444-8444-444444444444';
afterAll(()=>removeTempDirs());
class MemoryStore implements OnboardingStorage {
  records=new Map<string,RecordState>();
  load(p:string){return structuredClone(this.records.get(p)??{draft:emptyDraft(),pending:null});}
  save(p:string,s:RecordState){this.records.set(p,structuredClone(s));}
}
function world() {
  const store=new MemoryStore(),requests:HttpRequest[]=[];
  let principal:string|null=A,generation=1;
  const receipts=new Map<string,unknown>();
  let postFailure:'lost'|'denied'|'conflict'|'malformed'|null=null,receiptFailure=false,discoveryFailure=false,posts=0;
  const response=(value:unknown,status=200)=>({status,contentType:'application/json',location:null,text:JSON.stringify(value)});
  const client=new OnboardingClient('https://service.invalid',async req=>{
    requests.push(req);
    if(req.url.endsWith('/capabilities'))return response({protocol_major:PROTOCOL_MAJOR,schema_version:SCHEMA_VERSION,command_epoch:'1'});
    if(req.method==='POST') {
      posts++;const e=JSON.parse(req.body!);
      if(postFailure==='denied')return response({error:{kind:'denied',message:'SECRET server detail'}},403);
      if(postFailure==='conflict')return response({error:{kind:'version_conflict',message:'SECRET server detail'}},409);
      const r={operation_id:e.operation_id,resource_id:e.payload.command==='issue_email_invite'?I:e.payload.principal_id??W,revision:'1',authorization_epoch:'2',status:'applied',receipt_id:I};
      if(postFailure==='malformed')return response({...r,token:'SECRET'});
      receipts.set(e.operation_id,r);
      if(postFailure==='lost')throw new ServiceError('transport',true);
      return response(r);
    }
    if(req.url.includes('/receipts/')){
      if(receiptFailure)throw new ServiceError('transport');
      return response(receipts.get(req.url.split('/').at(-1)!)??null);
    }
    if(req.url.includes('/workspaces/') && req.url.includes('/invitations?'))return response({workspace_id:W,invitations:[{invite_id:I,revision:'7',state:'pending',expires_at:'2027-01-01T00:00:00+00:00',roles:['member'],recipient_email:'Finch@example.invalid'}],next_cursor:null});
    if(req.url.endsWith('/invitations')) {
      if(discoveryFailure)return response({error:{kind:'denied',message:'SECRET'}},403);
      return response({invitations:[]});
    }
    if(req.url.endsWith('/members'))return response({workspace_id:W,members:[{principal_id:A,display_name:null,roles:['owner'],revision:'1'}]});
    if(req.url.endsWith('/roles'))return response({workspace_id:W,policy_revision:'1',roles:[{role_id:'owner',kind:'audit_team',label:'Owner',actions:['manage_membership']},{role_id:'member',kind:'audit_team',label:'Member',actions:['read']}]});
    if(req.url.endsWith('/invitation-deliveries'))return response({workspace_id:W,deliveries:[{invite_id:I,state:'not_configured'}]});
    throw new Error('Unexpected fixture request');
  });
  const identity={principalId:()=>principal,generation:()=>generation,withAccess:async<T,>(work:(a:string)=>Promise<T>)=>principal?work('MAIN-ONLY-CREDENTIAL'):null};
  const make=()=>new OnboardingService({identity,client,store});
  return {store,requests,client,identity,make,receipts,get posts(){return posts;},replaceSession(){generation++;},set principal(v:string|null){principal=v;generation++;},set postFailure(v:typeof postFailure){postFailure=v;},set receiptFailure(v:boolean){receiptFailure=v;},set discoveryFailure(v:boolean){discoveryFailure=v;}};
}
describe('onboarding durable main flow',()=>{
  it('persists exact principal-scoped envelope before one create and exposes no credential/envelope',async()=>{
    const w=world(),s=w.make();const spy=vi.spyOn(w.store,'save');
    const r=await s.createWorkspace({name:'Alder & Finch'});
    expect(r).toEqual({ok:true,value:{resourceId:W,revision:'1',authorizationEpoch:'2'}});
    expect(w.posts).toBe(1);
    expect(spy.mock.calls[0][1].pending?.state).toBe('prepared');
    expect(spy.mock.calls[1][1].pending?.state).toBe('uncertain');
    expect(w.store.load(A).pending).toBeNull();
    expect(JSON.stringify(await s.getState())).not.toMatch(/MAIN-ONLY|command_epoch|envelope|receipt_id/);
  });
  it('lost response and restart reconcile by reading, never replaying the mutation',async()=>{
    const w=world();w.postFailure='lost';
    expect((await w.make().createWorkspace({name:'Alder & Finch'})).ok).toBe(false);
    expect(w.store.load(A).pending?.state).toBe('uncertain');
    const recovered=await w.make().getState();
    expect(recovered).toMatchObject({ok:true,value:{pending:null,draft:{name:'Alder & Finch'}}});
    expect(w.posts).toBe(1);
    expect(w.requests.some(r=>r.method==='GET'&&r.url.includes('/receipts/'))).toBe(true);
  });
  it('a missing receipt allows only deliberate same-envelope retry after another receipt read',async()=>{
    const w=world();w.postFailure='denied';
    const s=w.make();await s.createWorkspace({name:'Alder & Finch'});
    const original=w.store.load(A).pending!.envelope;
    await s.getState();expect(w.posts).toBe(1);
    w.postFailure=null;const before=w.requests.length;
    expect((await s.retry()).ok).toBe(true);
    expect(w.requests[before].url).toContain('/receipts/');
    expect(JSON.parse(w.requests.at(-1)!.body!)).toEqual(original);
    expect(w.posts).toBe(2);
  });
  it('uncertain receipt read failure prevents retry, discard and replacement create',async()=>{
    const w=world();w.postFailure='lost';const s=w.make();await s.createWorkspace({name:'Alder'});
    w.receiptFailure=true;
    expect((await s.retry()).ok).toBe(false);
    expect((await s.discardPending()).ok).toBe(false);
    expect((await s.createWorkspace({name:'Duplicate'})).ok).toBe(false);
    expect(w.posts).toBe(1);expect(w.store.load(A).pending).not.toBeNull();
  });
  it('keeps pending and draft visible when proof discovery is refused',async()=>{
    const w=world();w.postFailure='denied';w.discoveryFailure=true;const s=w.make();
    await s.createWorkspace({name:'Alder'});
    expect(await s.getState()).toMatchObject({ok:true,value:{pending:{kind:'createWorkspace',state:'retryable'},draft:{name:'Alder'},discoveryReason:ONBOARDING_REASONS.verification}});
    expect(w.posts).toBe(1);
  });
  it('never exposes or reuses another principal draft or operation',async()=>{
    const w=world();w.postFailure='lost';const s=w.make();await s.createWorkspace({name:'Private company'});
    w.principal=B;expect(await s.getState()).toMatchObject({ok:true,value:{pending:null,draft:emptyDraft()}});
    expect((await s.retry()).ok).toBe(false);expect(w.posts).toBe(1);
    w.principal=A;expect((await s.reconcile()).ok).toBe(true);
  });
  it('allows discarding a definitive rejection with a fresh absent receipt, preserving draft',async()=>{
    const w=world();w.postFailure='conflict';const s=w.make();await s.createWorkspace({name:'Alder'});
    expect((await s.discardPending()).ok).toBe(true);
    expect(w.store.load(A)).toEqual({pending:null,draft:{name:'Alder',email:'',workspaceId:''}});
  });
  it('cannot discard a committed operation as though it never occurred',async()=>{
    const w=world();w.postFailure='lost';const s=w.make();await s.createWorkspace({name:'Alder'});
    expect((await s.discardPending()).ok).toBe(false);
    expect(w.posts).toBe(1);expect(w.store.load(A).pending).not.toBeNull();
  });
  it('returns the same safe acceptance refusal for every unavailable invitation',async()=>{
    const w=world();w.postFailure='denied';
    expect(await w.make().acceptInvitation({inviteId:I,expectedRevision:'1'})).toEqual({ok:false,reason:ONBOARDING_REASONS.invitation});
  });
  it('rejects malformed successful responses without clearing uncertain operations or leaking details',async()=>{
    const w=world();w.postFailure='malformed';const result=await w.make().createWorkspace({name:'Alder'});
    expect(result).toEqual({ok:false,reason:ONBOARDING_REASONS.uncertain});
    expect(w.store.load(A).pending?.state).toBe('uncertain');expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('serializes double submissions into one mutation',async()=>{
    const w=world();w.postFailure='lost';const s=w.make();
    const results=await Promise.all([s.createWorkspace({name:'Alder'}),s.createWorkspace({name:'Alder'})]);
    expect(results.every(r=>!r.ok)).toBe(true);expect(w.posts).toBe(1);
  });
  it('reads server roles and truthful external delivery status, not caller grants',async()=>{
    const w=world(),r=await w.make().members({workspaceId:W});
    expect(r).toMatchObject({ok:true,value:{roles:[{id:'owner',label:'Owner'},{id:'member',label:'Member'}],deliveries:[{inviteId:I,state:'not_configured'}],members:[{displayName:'Workspace member'}]}});
  });
  it('refuses unavailable configuration, signed-out and non-durable storage before mutation',async()=>{
    const w=world();w.principal=null;expect((await w.make().createWorkspace({name:'Alder'})).ok).toBe(false);
    expect((await new OnboardingService({identity:w.identity,client:null,store:w.store}).getState()).ok).toBe(false);
    w.principal=A;
    const s=new OnboardingService({identity:w.identity,client:w.client,store:{load(){throw Error('secret disk path');},save(){throw Error('secret disk path');}}});
    expect(await s.createWorkspace({name:'Alder'})).toEqual({ok:false,reason:ONBOARDING_REASONS.storage});
    expect(w.posts).toBe(0);
  });
  it('suppresses data if the principal changes during a read',async()=>{
    const w=world(),old=w.client.invitations.bind(w.client);
    vi.spyOn(w.client,'invitations').mockImplementation(async a=>{const r=await old(a);w.principal=B;return r;});
    expect(await w.make().getState()).toEqual({ok:false,reason:ONBOARDING_REASONS.changed});
  });
  it('uses actual current disk/store state after deletion, not cached old mutations',async()=>{
    const w=world();w.postFailure='denied';const s=w.make();await s.createWorkspace({name:'Deleted draft'});
    w.store.records.delete(A);
    expect(await s.getState()).toMatchObject({ok:true,value:{pending:null,draft:emptyDraft()}});
  });
});
describe('strict onboarding boundaries',()=>{
  it('rejects unknown identity/grant/url fields, extra args, malformed revisions and oversized strings',()=>{
    for(const value of [{name:'Alder',principalId:A},{name:'Alder',grant:'owner'},{name:'Alder',url:'https://evil.invalid'},{name:'x'.repeat(201)},Object.assign(Object.create({}),{name:'Alder'})]) expect(()=>payload(createInput)([value])).toThrow();
    expect(()=>payload(createInput)([{name:'Alder'},'extra'])).toThrow();
    for(const expectedRevision of ['01','-1','18446744073709551616',1])expect(()=>acceptInput({inviteId:I,expectedRevision},'')).toThrow();
    expect(()=>inviteInput({workspaceId:W,email:'person@example.invalid',roles:['member','member']},'')).toThrow();
    expect(()=>parseInvitations({invitations:[],accessCredential:'SECRET'},'')).toThrow();
  });
  it('binds exact envelopes to main-generated operation and known schema',()=>{
    const e=envelope({kind:'invite',input:{workspaceId:W,email:'Finch@example.invalid',roles:['member']}},I,'1');
    expect(e).toEqual({command_epoch:'1',operation_id:I,schema_version:SCHEMA_VERSION,expected_revision:'0',workspace_id:W,payload:{command:'issue_email_invite',email:'Finch@example.invalid',roles:['member']}});
  });
});
describe('encrypted principal-scoped onboarding store',()=>{
  it('persists encrypted drafts and envelopes through restart without sharing another principal scope',()=>{
    const dir=tempDir('onboarding-store'),safeStorage=fakeSafeStorage('gnome_libsecret'),options={dir,scope:'service+issuer',safeStorage,platform:'linux' as const};
    const store=new OnboardingStore(options),m={kind:'createWorkspace' as const,input:{name:'Alder secret draft'}};
    const state={draft:{name:'Alder secret draft',email:'finch@example.invalid',workspaceId:''},pending:{...m,operationId:I,state:'uncertain' as const,terminalRejection:false,envelope:envelope(m,I,'1')}};
    store.save(A,state);
    const bytes=fs.readFileSync(path.join(dir,fs.readdirSync(dir)[0]!)).toString();
    expect(bytes).not.toContain('Alder secret draft');expect(bytes).not.toContain('finch@example.invalid');
    expect(new OnboardingStore(options).load(A)).toEqual(state);
    expect(new OnboardingStore(options).load(B)).toEqual({draft:emptyDraft(),pending:null});
    expect(new OnboardingStore({...options,scope:'another-issuer'}).load(A)).toEqual({draft:emptyDraft(),pending:null});
  });
  it('fails closed without OS-backed storage rather than pretending a draft is durable',()=>{
    const store=new OnboardingStore({dir:tempDir('onboarding-insecure'),scope:'s',safeStorage:fakeSafeStorage('basic_text'),platform:'linux'});
    expect(()=>store.load(A)).toThrow();expect(()=>store.save(A,{draft:emptyDraft(),pending:null})).toThrow();
  });
});

describe('named onboarding IPC and explicit reauthentication',()=>{
  const status={identity:{state:'signed-out' as const},sharedService:'available' as const,credentialStorage:'os-backed' as const,privateWork:'local' as const};
  it('never signs back in until sign-out is confirmed complete',async()=>{
    const signIn=vi.fn(async()=>({ok:true,status})),signOut=vi.fn(async()=>({ok:false,status,reason:'Sign-out pending'}));
    const deps={identity:{getStatus:async()=>status,signIn,signOut}} as unknown as OperationDeps;
    const op=createOperations(deps).find(o=>o.name==='identity.reauthenticate')!;
    expect(await op.handle(undefined)).toMatchObject({ok:false});expect(signIn).not.toHaveBeenCalled();
    signOut.mockResolvedValue({ok:true,status,reason:''});
    expect(await op.handle(undefined)).toMatchObject({ok:true});expect(signIn).toHaveBeenCalledOnce();
    expect(()=>op.validate([{}])).toThrow();
  });
  it('checks sender and payload before dispatching onboarding methods',async()=>{
    const w=world(),service=w.make(),create=vi.spyOn(service,'createWorkspace');
    const handlers=new Map<string,(e:unknown,...a:unknown[])=>unknown>();
    const logger=recordingLogger();
    registerOperations({handle:(name,fn)=>handlers.set(name,fn as (e:unknown,...a:unknown[])=>unknown)},createOperations({identity:{},onboarding:service} as unknown as OperationDeps),{trustedWebContentsIds:new Set([1]),logger});
    const frame={url:'inquello://app/index.html',frameTreeNodeId:1,parent:null};
    const trusted={sender:{id:1,mainFrame:frame},senderFrame:frame};
    const invoke=handlers.get('inquello:op:onboarding.createWorkspace')!;
    await expect(invoke({sender:{id:99,mainFrame:frame},senderFrame:frame},{name:'Alder'})).rejects.toThrow('untrusted sender');
    await expect(invoke(trusted,{name:'Alder',accessCredential:'SECRET'})).rejects.toThrow('invalid payload');
    expect(create).not.toHaveBeenCalled();
    expect(JSON.stringify(logger.messages)).not.toContain('SECRET');
    expect(handlers.has('inquello:op:onboarding.request')).toBe(false);
  });
});

describe('onboarding queued principal fence',()=>{
  it('does not rebind an already-queued action to a different account',async()=>{
    const w=world(),s=w.make();let release!:()=>void,entered!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{entered=resolve;});
    const original=w.client.capabilities.bind(w.client);
    vi.spyOn(w.client,'capabilities').mockImplementation(async()=>{entered();await gate;return original();});
    const first=s.createWorkspace({name:'Alder'});await started;
    const second=s.createWorkspace({name:'Do not bind to B'});w.principal=B;release();
    expect(await first).toEqual({ok:false,reason:ONBOARDING_REASONS.changed});
    expect(await second).toEqual({ok:false,reason:ONBOARDING_REASONS.changed});
    expect(w.posts).toBe(0);expect(w.store.load(B).pending).toBeNull();
  });
});

describe('late POST and same-principal session replacement fences',()=>{
  it('does not treat an absent receipt as cancellation of a delayed original POST',async()=>{
    const w=world(),s=w.make();w.postFailure='lost';await s.createWorkspace({name:'Alder'});
    const held=w.store.load(A).pending!,committed=w.receipts.get(held.operationId);w.receipts.delete(held.operationId);
    expect(await s.reconcile()).toEqual({ok:true,value:null});
    expect(await s.getState()).toMatchObject({ok:true,value:{pending:{state:'retryable',canDiscard:false}}});
    expect((await s.discardPending()).ok).toBe(false);
    expect((await s.createWorkspace({name:'Duplicate'})).ok).toBe(false);
    // The original request completes after the absence read.
    w.receipts.set(held.operationId,committed);
    expect((await s.reconcile()).ok).toBe(true);expect(w.posts).toBe(1);
  });
  it('does not turn later denial into cancellation of an earlier ambiguous attempt',async()=>{
    const w=world(),s=w.make();w.postFailure='lost';await s.createWorkspace({name:'Alder'});
    const id=w.store.load(A).pending!.operationId;w.receipts.delete(id);w.postFailure='denied';
    expect((await s.retry()).ok).toBe(false);
    expect((await s.discardPending()).ok).toBe(false);
    expect(w.store.load(A).pending?.terminalRejection).toBe(false);
  });
  it('cannot clear pending storage with a stale response after same-principal reauthentication',async()=>{
    const w=world(),s=w.make(),execute=w.client.execute.bind(w.client);
    vi.spyOn(w.client,'execute').mockImplementation(async(a,e)=>{const r=await execute(a,e);w.replaceSession();return r;});
    expect(await s.createWorkspace({name:'Alder'})).toEqual({ok:false,reason:ONBOARDING_REASONS.changed});
    expect(w.store.load(A).pending?.state).toBe('uncertain');
    expect(w.store.load(A).pending?.terminalRejection).toBe(false);
    // The new authentication may explicitly reconcile, never inherit a stale callback result.
    expect((await s.reconcile()).ok).toBe(true);expect(w.posts).toBe(1);
  });
  it('rejects already-queued same-principal actions after session replacement',async()=>{
    const w=world(),s=w.make();let release!:()=>void,entered!:()=>void;
    const gate=new Promise<void>(resolve=>release=resolve),started=new Promise<void>(resolve=>entered=resolve),original=w.client.capabilities.bind(w.client);
    vi.spyOn(w.client,'capabilities').mockImplementation(async()=>{entered();await gate;return original();});
    const first=s.createWorkspace({name:'Alder'});await started;
    const second=s.saveDraft({name:'Old authentication draft',email:'',workspaceId:''});w.replaceSession();release();
    expect((await first).ok).toBe(false);expect((await second).ok).toBe(false);
    expect(w.store.load(A).draft).toEqual(emptyDraft());expect(w.posts).toBe(0);
  });
});

it('rejects oversized, sparse, subclassed and decorated role arrays before dispatch',()=>{
  class ForeignRoles extends Array<string> {}
  const sparse=new Array(2);sparse[0]='member';
  const symbol=['member'];Object.defineProperty(symbol,Symbol('extra'),{value:true});
  const hidden=['member'];Object.defineProperty(hidden,'extra',{value:true});
  for(const roles of [new Array(1000000),sparse,new ForeignRoles('member'),Object.assign(['member'],{extra:true}),symbol,hidden]) {
    expect(()=>payload(inviteInput)([{workspaceId:W,email:'finch@example.invalid',roles}])).toThrow();
  }
  expect(payload(inviteInput)([{workspaceId:W,email:'finch@example.invalid',roles:['member']}]).roles).toEqual(['member']);
});

describe('current manager invitation metadata',()=>{
 it('projects actual revision and scopes the observed cursor to the current Workspace',async()=>{
  const w=world(),s=w.make();
  expect(await s.members({workspaceId:W,after:I})).toMatchObject({ok:true,value:{invitations:[{inviteId:I,revision:'7',recipientEmail:'Finch@example.invalid'}],nextCursor:null}});
  expect(w.requests.some(r=>r.url.endsWith('/workspaces/'+W+'/invitations?limit=25&after='+I))).toBe(true);
 });
 it('suppresses mismatched Workspace metadata and late same-principal session responses',async()=>{
  const w=world();vi.spyOn(w.client,'managedInvitations').mockResolvedValue({workspace_id:B,invitations:[],next_cursor:null});
  expect((await w.make().members({workspaceId:W})).ok).toBe(false);
  vi.spyOn(w.client,'managedInvitations').mockImplementation(async()=>{w.replaceSession();return {workspace_id:W,invitations:[],next_cursor:null};});
  expect(await w.make().members({workspaceId:W})).toEqual({ok:false,reason:ONBOARDING_REASONS.changed});
 });
 it('forwards the already-defined recovery operation in main instead of silently falling back',async()=>{
  const recover=vi.fn(async()=>({ok:true,value:{accepted:true}}));
  const op=createOperations({organise:{recoverNavigation:recover}} as unknown as OperationDeps).find(o=>o.name==='organise.recoverNavigation')!;
  await op.handle({workspaceId:W});expect(recover).toHaveBeenCalledWith(W);
  expect(fs.readFileSync(path.resolve(__dirname,'../src/main/main.ts'),'utf8')).toContain('recoverNavigation: workspaceId => organiseService.recoverNavigation(workspaceId)');
 });
});

describe('conversation-preserving authority notifications',()=>{
 it('does not emit conversation-clear events for creating or inviting, but invalidates own changed membership and acceptance',async()=>{
  for(const kind of ['createWorkspace','invite','changeOther','changeSelf','accept'] as const){
   const w=world(),notify=vi.fn(),s=new OnboardingService({identity:w.identity,client:w.client,store:w.store,onAuthorityChanged:notify});
   const r=kind==='createWorkspace'?await s.createWorkspace({name:'Alder'}):kind==='invite'?await s.invite({workspaceId:W,email:'Finch@example.invalid',roles:['member']}):kind==='accept'?await s.acceptInvitation({inviteId:I,expectedRevision:'1'}):await s.changeRoles({workspaceId:W,principalId:kind==='changeSelf'?A:B,expectedRevision:'1',roles:['member']});
   expect(r.ok).toBe(true);expect(notify).toHaveBeenCalledTimes(kind==='changeSelf'||kind==='accept'?1:0);
  }
 });
 it('notifies self-removal only once its original receipt is actually confirmed',async()=>{
  const w=world(),notify=vi.fn(),s=new OnboardingService({identity:w.identity,client:w.client,store:w.store,onAuthorityChanged:notify});w.postFailure='lost';
  expect((await s.removeMember({workspaceId:W,principalId:A,expectedRevision:'1'})).ok).toBe(false);expect(notify).not.toHaveBeenCalled();
  expect((await s.reconcile()).ok).toBe(true);expect(notify).toHaveBeenCalledOnce();
 });
});
