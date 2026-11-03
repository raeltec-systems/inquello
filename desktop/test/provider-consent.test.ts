import {describe,it,expect,vi} from 'vitest';
import {ProviderConsentService} from '../src/main/providers/consent-service';
import {ServiceError,type SharedService} from '../src/main/identity/service-client';
import {parseProviderConsentView,type ProviderConsentCommand,type ProviderConsentView,type CommandResponse,type ProviderConsentReceipt} from '../src/main/identity/wire';
const principal='10000000-0000-4000-8000-000000000001',workspace='20000000-0000-4000-8000-000000000001',other='20000000-0000-4000-8000-000000000002';
const base:ProviderConsentView={workspace_id:workspace,workspace_name:'Fictional company',provider:'openai-api',contract_id:'openai-api-standard-v1',contract_version:1,contract_digest:'a'.repeat(64),consent_text:'Allow OpenAI to process permitted context.',revision:'0',state:'not_allowed',can_manage:true,authorization_epoch:'1',policy_revision:'1'};
function harness(){
  let generation=1;
  const records=new Map<string,ProviderConsentCommand|null>();
  const store={load:(p:string,w:string)=>records.get(p+w)??null,save:(p:string,w:string,c:ProviderConsentCommand|null)=>{records.set(p+w,c?structuredClone(c):null);}};
  const receipt=(c:ProviderConsentCommand):CommandResponse=>({operation_id:c.operation_id,resource_id:c.workspace_id,revision:(BigInt(c.expected_revision)+1n).toString(),authorization_epoch:'2',status:'applied',receipt_id:'30000000-0000-4000-8000-000000000001'});
  const service={
    capabilities:vi.fn(async()=>({schema_version:1,protocol_major:1,command_epoch:'1'})),
    providerConsent:vi.fn(async(_a:string,w:string)=>({...base,workspace_id:w})),
    setProviderConsent:vi.fn(async(_a:string,c:ProviderConsentCommand)=>receipt(c)),
    providerConsentReceipt:vi.fn(async(_a:string,_w:string,_o:string):Promise<ProviderConsentReceipt|null>=>null),
  };
  const options={identity:{principalId:()=>principal,generation:()=>generation,withAccess:async<T>(call:(a:string)=>Promise<T>)=>call('private-test-access')},service:service as unknown as SharedService,store,onChanged:vi.fn()};
  const make=()=>new ProviderConsentService(options);
  return {service,store,records,options,make,receipt,changeIdentity:()=>{generation++;}};
}
const input={workspaceId:workspace,expectedRevision:'0',contractVersion:1,contractDigest:'a'.repeat(64),action:'allow' as const};
describe('durable owner consent mediation',()=>{
  it('reading never grants and current owner/terms are checked before journal or send',async()=>{
    const h=harness(),s=h.make();expect((await s.get(workspace)).ok).toBe(true);expect(h.service.setProviderConsent).not.toHaveBeenCalled();
    h.service.providerConsent.mockResolvedValue({...base,can_manage:false});
    expect((await s.change(input)).ok).toBe(false);expect(h.records.size).toBe(0);
    h.service.providerConsent.mockResolvedValue({...base,contract_digest:'b'.repeat(64)});
    expect((await s.change(input)).ok).toBe(false);expect(h.service.setProviderConsent).not.toHaveBeenCalled();
  });
  it('lost acknowledgement survives restart; missing receipt never clears or replaces UUID',async()=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    expect((await h.make().change(input)).ok).toBe(false);
    const pending=h.store.load(principal,workspace)!;expect(pending.operation_id).toBeTruthy();
    const restarted=h.make();const state=await restarted.reconcile(workspace);expect(state.ok&&state.value.pending?.operationId).toBe(pending.operation_id);
    expect((await restarted.change({...input,action:'revoke'})).ok).toBe(false);
    expect(h.service.setProviderConsent).toHaveBeenCalledTimes(1);
    expect((await restarted.reconcile(workspace,true)).ok).toBe(true);
    expect(h.service.setProviderConsent.mock.calls[1]![1]).toEqual(pending);
    expect(h.store.load(principal,workspace)).toBeNull();
  });
  it('delayed original receipt resolves without resending; unrelated workspace remains usable',async()=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    const s=h.make();await s.change(input);const pending=h.store.load(principal,workspace)!;
    expect((await s.change({...input,workspaceId:other})).ok).toBe(true);
    h.service.providerConsentReceipt.mockResolvedValue(h.receipt(pending));
    expect((await s.reconcile(workspace)).ok).toBe(true);
    expect(h.service.setProviderConsent).toHaveBeenCalledTimes(2);
  });
  it.each(['revision','status','epoch'] as const)('malformed %s receipt retains exact pending request',async(kind)=>{
    const h=harness();h.service.setProviderConsent.mockImplementation(async(_a,c)=>({...h.receipt(c),
      ...(kind==='revision'?{revision:'9'}:kind==='epoch'?{authorization_epoch:null}:{status:'unknown'})
    }) as CommandResponse);
    expect((await h.make().change(input)).ok).toBe(false);expect(h.store.load(principal,workspace)).not.toBeNull();
  });
  it('definitive first rejection clears but reconciliation denial never clears an uncertain request',async()=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('denied'));
    expect((await h.make().change(input)).ok).toBe(false);expect(h.store.load(principal,workspace)).toBeNull();
    h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));const s=h.make();await s.change(input);
    h.service.providerConsentReceipt.mockRejectedValue(new ServiceError('denied'));
    expect((await s.reconcile(workspace)).ok).toBe(false);expect(h.store.load(principal,workspace)).not.toBeNull();
  });
  it('a definitive denial after an uncertain repeated access callback retains the original pending command',async()=>{
    const h=harness();
    h.options.identity.withAccess=async<T>(call:(a:string)=>Promise<T>)=>{
      try{return await call('private-test-access');}
      catch{return call('refreshed-private-test-access');}
    };
    h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true))
      .mockRejectedValueOnce(new ServiceError('denied'));
    expect((await h.make().change(input)).ok).toBe(false);
    expect(h.service.setProviderConsent).toHaveBeenCalledTimes(2);
    const first=h.service.setProviderConsent.mock.calls[0]![1];
    expect(h.service.setProviderConsent.mock.calls[1]![1]).toEqual(first);
    expect(h.store.load(principal,workspace)).toEqual(first);
    const restarted=h.make();
    const state=await restarted.reconcile(workspace);
    expect(state.ok&&state.value.pending?.operationId).toBe(first.operation_id);
    expect((await restarted.change({...input,action:'revoke'})).ok).toBe(false);
    expect(h.service.setProviderConsent).toHaveBeenCalledTimes(2);
    expect(h.store.load(principal,workspace)).toEqual(first);
    expect(h.options.onChanged).not.toHaveBeenCalled();
  });
  it('identity change during committed response suppresses disclosure and retains reconciliation',async()=>{
    const h=harness();h.service.setProviderConsent.mockImplementation(async(_a,c)=>{h.changeIdentity();return h.receipt(c);});
    expect((await h.make().change(input)).ok).toBe(false);expect(h.store.load(principal,workspace)).not.toBeNull();expect(h.options.onChanged).not.toHaveBeenCalled();
  });
  it('an exact not-applied receipt clears uncertainty without claiming a grant and permits a new opposite operation',async()=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    const s=h.make();await s.change(input);const pending=h.store.load(principal,workspace)!;
    h.service.providerConsentReceipt.mockResolvedValue({
      status:'not_applied',principal_id:principal,provider:'openai-api',command:pending,
      reason:'processing_terms_changed',receipt_id:'30000000-0000-4000-8000-000000000002',
    });
    const resolved=await s.reconcile(workspace);
    expect(resolved.ok).toBe(false);expect(!resolved.ok&&resolved.reason).toContain('was not applied');
    expect(h.store.load(principal,workspace)).toBeNull();expect(h.options.onChanged).not.toHaveBeenCalled();
    expect((await s.change({...input,action:'revoke'})).ok).toBe(true);
    const next=h.service.setProviderConsent.mock.calls[1]![1];
    expect(next.action).toBe('revoke');expect(next.operation_id).not.toBe(pending.operation_id);
  });
  it('a retry rejection clears only after its exact recorded terminal result is read',async()=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    const s=h.make();await s.change(input);const pending=h.store.load(principal,workspace)!;
    h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('version_conflict'));
    h.service.providerConsentReceipt.mockResolvedValueOnce(null).mockResolvedValueOnce({
      status:'not_applied',principal_id:principal,provider:'openai-api',command:pending,
      reason:'revision_changed',receipt_id:'30000000-0000-4000-8000-000000000002',
    });
    const result=await s.reconcile(workspace,true);
    expect(result.ok).toBe(false);expect(!result.ok&&result.reason).toContain('was not applied');
    expect(h.service.setProviderConsent.mock.calls[1]![1]).toEqual(pending);
    expect(h.store.load(principal,workspace)).toBeNull();expect(h.options.onChanged).not.toHaveBeenCalled();
  });
  it.each(['missing','denied'] as const)('a retry conflict with %s final receipt retains uncertainty',async mode=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    const s=h.make();await s.change(input);const pending=h.store.load(principal,workspace)!;
    h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('unsupported_contract'));
    h.service.providerConsentReceipt.mockResolvedValueOnce(null);
    if(mode==='denied')h.service.providerConsentReceipt.mockRejectedValueOnce(new ServiceError('denied'));
    else h.service.providerConsentReceipt.mockResolvedValueOnce(null);
    expect((await s.reconcile(workspace,true)).ok).toBe(false);
    expect(h.store.load(principal,workspace)).toEqual(pending);
    expect(h.service.setProviderConsent).toHaveBeenCalledTimes(2);expect(h.options.onChanged).not.toHaveBeenCalled();
  });
  it.each(['principal','provider','workspace','action','contract','epoch','operation','extra'] as const)('a malformed or mismatched terminal %s cannot discard the journal',async kind=>{
    const h=harness();h.service.setProviderConsent.mockRejectedValueOnce(new ServiceError('transport',true));
    const s=h.make();await s.change(input);const pending=h.store.load(principal,workspace)!;
    const terminal:Record<string,unknown>={status:'not_applied',principal_id:principal,provider:'openai-api',command:structuredClone(pending),reason:'processing_terms_changed',receipt_id:'30000000-0000-4000-8000-000000000002'};
    const command=terminal.command as Record<string,unknown>;
    if(kind==='principal')terminal.principal_id=other;
    if(kind==='provider')terminal.provider='different-provider';
    if(kind==='workspace')command.workspace_id=other;
    if(kind==='action')command.action='revoke';
    if(kind==='contract')command.expected_contract_digest='b'.repeat(64);
    if(kind==='epoch')command.command_epoch='99';
    if(kind==='operation')command.operation_id='30000000-0000-4000-8000-000000000003';
    if(kind==='extra')terminal.approved=true;
    h.service.providerConsentReceipt.mockResolvedValue(terminal as unknown as ProviderConsentReceipt);
    expect((await s.reconcile(workspace)).ok).toBe(false);
    expect(h.store.load(principal,workspace)).toEqual(pending);expect(h.options.onChanged).not.toHaveBeenCalled();
  });
  it('wire rejects arbitrary authority fields and malformed digest',()=>{
    expect(()=>parseProviderConsentView({...base,approved:true},'')).toThrow();
    expect(()=>parseProviderConsentView({...base,contract_digest:'untrusted'},'')).toThrow();
  });
});
