import {randomUUID} from 'node:crypto';
import {ServiceError,type SharedService} from '../identity/service-client';
import {object,uuid,decimal,u32,str,oneOf,parseProviderConsentView,parseCommandResponse,
  type ProviderConsentView,type ProviderConsentCommand,type CommandResponse} from '../identity/wire';
import type {ConsentStorage} from './consent-store';
const digest=(v:unknown,p:string)=>{const s=str(v,p);if(!/^[0-9a-f]{64}$/.test(s))throw new Error('Invalid contract digest');return s;};
export const consentInput=object({workspaceId:uuid,expectedRevision:decimal,contractVersion:u32,contractDigest:digest,action:oneOf(['allow','revoke'] as const)});
export type ConsentInput=ReturnType<typeof consentInput>;
export interface ConsentState {view:ProviderConsentView;pending:{operationId:string;action:'allow'|'revoke'}|null}
export type ConsentResult={ok:true;value:ConsentState}|{ok:false;reason:string};
interface Identity {principalId():string|null;generation():number;withAccess<T>(work:(access:string)=>Promise<T>):Promise<T|null>}
const CHANGED='Your identity changed. Return with the intended account.';
const PENDING='The permission change is not confirmed. Check its result or retry the same request.';
export class ProviderConsentService {
  private queues=new Map<string,Promise<unknown>>();
  constructor(private readonly options:{identity:Identity;service:SharedService|null;store:ConsentStorage;onChanged?:(workspace:string)=>void}) {}
  private run(workspace:string,work:(principal:string,check:()=>void)=>Promise<ConsentState>):Promise<ConsentResult> {
    const principal=this.options.identity.principalId(),generation=this.options.identity.generation();
    const check=()=>{if(!principal||this.options.identity.principalId()!==principal||this.options.identity.generation()!==generation)throw new Error(CHANGED);};
    const key=JSON.stringify([principal,workspace]);
    const action=async():Promise<ConsentResult>=>{
      try{check();if(!this.options.service?.providerConsent||!this.options.service.setProviderConsent||!this.options.service.providerConsentReceipt)throw new Error('Provider permissions are unavailable.');
        return {ok:true,value:await work(principal!,check)};
      }catch(error){return {ok:false,reason:error instanceof ServiceError?
        error.kind==='denied'?'Ask your current workspace owner to allow OpenAI.':
        error.kind==='version_conflict'?'The workspace permission or processing terms changed. Read them again.':PENDING:
        error instanceof Error&&[CHANGED,'Provider permissions are unavailable.',PENDING].includes(error.message)?error.message:'Provider permissions could not be read safely.'};}
    };
    const next=(this.queues.get(key)??Promise.resolve()).then(action,action);
    this.queues.set(key,next);void next.finally(()=>{if(this.queues.get(key)===next)this.queues.delete(key);});
    return next;
  }
  private async access<T>(check:()=>void,work:(access:string)=>Promise<T>):Promise<T> {
    check();const result=await this.options.identity.withAccess(async access=>{check();return {value:await work(access)};});
    check();if(!result)throw new Error(CHANGED);return result.value;
  }
  private validateReceipt(command:ProviderConsentCommand,raw:CommandResponse):void {
    const receipt=parseCommandResponse(raw,'');
    if(receipt.operation_id!==command.operation_id||receipt.resource_id!==command.workspace_id||receipt.authorization_epoch===null||receipt.revision!==(BigInt(command.expected_revision)+1n).toString())throw new ServiceError('protocol',true);
  }
  private async state(principal:string,workspace:string,check:()=>void):Promise<ConsentState> {
    const view=parseProviderConsentView(await this.access(check,a=>this.options.service!.providerConsent!(a,workspace)),'');
    if(view.workspace_id!==workspace)throw new ServiceError('protocol');
    check();const pending=this.options.store.load(principal,workspace);
    return {view,pending:pending?{operationId:pending.operation_id,action:pending.action}:null};
  }
  get(workspace:string):Promise<ConsentResult>{return this.run(workspace,(p,c)=>this.state(p,workspace,c));}
  change(raw:ConsentInput):Promise<ConsentResult>{
    const input=consentInput(raw,'');
    return this.run(input.workspaceId,async(principal,check)=>{
      if(this.options.store.load(principal,input.workspaceId))throw new Error(PENDING);
      const current=await this.state(principal,input.workspaceId,check);
      if(!current.view.can_manage)throw new ServiceError('denied');
      if(current.view.revision!==input.expectedRevision||current.view.contract_digest!==input.contractDigest||current.view.contract_version!==input.contractVersion)throw new ServiceError('version_conflict');
      const capabilities=await this.options.service!.capabilities();check();
      if(capabilities.protocol_major!==1||capabilities.schema_version!==1)throw new ServiceError('protocol');
      const command:ProviderConsentCommand={schema_version:1,command_epoch:capabilities.command_epoch,
        workspace_id:input.workspaceId,operation_id:randomUUID(),expected_revision:input.expectedRevision,
        expected_contract_version:input.contractVersion,expected_contract_digest:input.contractDigest,action:input.action};
      check();this.options.store.save(principal,input.workspaceId,command);
      let attempts=0;
      try{
        const response=await this.access(check,a=>{attempts++;return this.options.service!.setProviderConsent!(a,command);});
        this.validateReceipt(command,response);check();
        this.options.store.save(principal,input.workspaceId,null);
        this.options.onChanged?.(input.workspaceId);
      }catch(error){
        // Only a definitive response to this first, non-replayed attempt proves
        // rejection. On crash, lost acknowledgement or identity loss retain it.
        if(attempts===1&&error instanceof ServiceError&&['denied','version_conflict','unsupported_contract','unauthenticated'].includes(error.kind)){
          check();this.options.store.save(principal,input.workspaceId,null);
        }
        throw error;
      }
      return this.state(principal,input.workspaceId,check);
    });
  }
  reconcile(workspace:string,retry=false):Promise<ConsentResult>{return this.run(workspace,async(principal,check)=>{
    const pending=this.options.store.load(principal,workspace);
    if(!pending)return this.state(principal,workspace,check);
    const receipt=await this.access(check,a=>this.options.service!.providerConsentReceipt!(a,workspace,pending.operation_id));
    if(receipt){
      this.validateReceipt(pending,receipt);check();this.options.store.save(principal,workspace,null);this.options.onChanged?.(workspace);
    }else if(retry){
      // Deliberate user retry only. Never replace the UUID, CAS or command epoch.
      const response=await this.access(check,a=>this.options.service!.setProviderConsent!(a,pending));
      this.validateReceipt(pending,response);check();this.options.store.save(principal,workspace,null);this.options.onChanged?.(workspace);
    }
    return this.state(principal,workspace,check);
  });}
}
