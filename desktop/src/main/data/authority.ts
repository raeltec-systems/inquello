/** Native ownership + live HTTPS authorization. Neither filenames nor exports grant rights. */
import {inspectNative} from '../runtime/data-inspector';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {OrganiseIdentity} from '../organise';
import type {SharedService} from '../identity/service-client';
import {parseRouteEvidenceIdentity,type RouteEvidenceIdentity,type SessionView,type ExportProvenanceReceipt} from '../identity/wire';
import {isInside,type GovernedRoots} from './inventory';

export const DATA_AUTHORITY_UNAVAILABLE='Current ownership, Workspace authority or reviewed route evidence is unavailable. Unproven data remains quarantined; no permission is restored from an export.';
export class DataAuthorityError extends Error { constructor(){super(DATA_AUTHORITY_UNAVAILABLE);} }
export interface ProvenFile {path:string;sha256:string;size:number;category:string}
export interface ProvenTask {task_id:string;provenance_kind:'draft_metadata'|'task_content';data_tier:'synthetic'|'real'|'not-applicable';route_identity:RouteEvidenceIdentity|null;report_digest:string|null;processing_scope:string|null;data_policy_digest:string|null}
export interface DataProvenance {principalId:string;session:SessionView;files:ProvenFile[];workspaces:Array<{workspace_id:string;tasks:ProvenTask[]}>}
export interface DataAuthority {
 inspect(roots:GovernedRoots):Promise<DataProvenance>;
 check(provenance:DataProvenance,action:'export'|'recover'):Promise<void>;
 createReceipt(provenance:DataProvenance,digest:string):Promise<ExportProvenanceReceipt>;
 validateReceipt(provenance:DataProvenance,receiptId:string,digest:string):Promise<void>;
}
const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new DataAuthorityError();return value as Record<string,unknown>;};
const uuid=(value:unknown):string=>{if(typeof value!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value))throw new DataAuthorityError();return value;};
const digest=(value:unknown):string=>{if(typeof value!=='string'||! /^[0-9a-f]{64}$/.test(value))throw new DataAuthorityError();return value;};
function parseInventory(value:unknown,roots:GovernedRoots):Pick<DataProvenance,'files'|'workspaces'>{
 const r=record(value);if(r.version!==1||r.available!==true||!Array.isArray(r.files)||!Array.isArray(r.workspaces)||r.files.length>10000||r.workspaces.length>10000)throw new DataAuthorityError();
 const seen=new Set<string>();
 const files=r.files.map(raw=>{const f=record(raw);if(typeof f.path!=='string'||!path.isAbsolute(f.path)||!Object.values(roots).some(root=>isInside(root,f.path as string))||typeof f.size!=='number'||!Number.isSafeInteger(f.size)||f.size<0||!['working-store','task-history','task-folders'].includes(String(f.category))||seen.has(f.path))throw new DataAuthorityError();seen.add(f.path);return{path:f.path,sha256:digest(f.sha256),size:f.size,category:String(f.category)};});
 const workspaces=r.workspaces.map(raw=>{const w=record(raw);if(!Array.isArray(w.tasks)||w.tasks.length>100000)throw new DataAuthorityError();return{workspace_id:uuid(w.workspace_id),tasks:w.tasks.map(raw=>{const t=record(raw);const draft=t.provenance_kind==='draft_metadata';if(draft?(t.data_tier!=='not-applicable'||[t.route_identity,t.report_digest,t.processing_scope,t.data_policy_digest].some(v=>v!==null)):(t.provenance_kind!=='task_content'||(t.data_tier!=='synthetic'&&t.data_tier!=='real')))throw new DataAuthorityError();return{task_id:uuid(t.task_id),provenance_kind:t.provenance_kind,data_tier:t.data_tier,route_identity:t.route_identity===null?null:parseRouteEvidenceIdentity(t.route_identity,''),report_digest:t.report_digest===null?null:digest(t.report_digest),processing_scope:t.processing_scope===null?null:String(t.processing_scope),data_policy_digest:t.data_policy_digest===null?null:digest(t.data_policy_digest)} as ProvenTask;})};});
 return{files,workspaces};
}
export function createDataAuthority(options:{identity:OrganiseIdentity;service:SharedService|null;binary():string;env():NodeJS.ProcessEnv;storeName:string}):DataAuthority{
 let generation=0;const inspections=new WeakMap<DataProvenance,number>();const highest=new Map<string,bigint>();
 async function current(expected?:DataProvenance):Promise<SessionView>{
  const principal=options.identity.principalId(),fence=generation;if(!principal||!options.service)throw new DataAuthorityError();
  const session=await options.identity.withAccess(access=>options.service!.session(access));
  if(!session||session.principal.principal_id!==principal||principal!==options.identity.principalId()||fence!==generation||(expected&&(expected.principalId!==principal||expected.session.session_id!==session.session_id||expected.session.revision!==session.revision||expected.session.principal.revision!==session.principal.revision)))throw new DataAuthorityError();return session;
 }
 const scopeMatches=(p:DataProvenance,r:ExportProvenanceReceipt,d:string)=>r.principal_id===p.principalId&&r.manifest_digest===d&&JSON.stringify([...r.workspace_ids].sort())===JSON.stringify(p.workspaces.map(w=>w.workspace_id).sort());
 const authority:DataAuthority={
  async createReceipt(provenance,manifestDigest){
   try{await authority.check(provenance,'export');const service=options.service!,capabilities=await service.capabilities();const receipt=await options.identity.withAccess(access=>service.createExportReceipt(access,{command_epoch:capabilities.command_epoch,operation_id:randomUUID(),manifest_digest:manifestDigest,workspace_ids:provenance.workspaces.map(w=>w.workspace_id).sort()}));if(!receipt||!scopeMatches(provenance,receipt,manifestDigest))throw new DataAuthorityError();await authority.check(provenance,'export');return receipt;}catch{generation++;throw new DataAuthorityError();}
  },
  async validateReceipt(provenance,receiptId,manifestDigest){
   try{await authority.check(provenance,'recover');const receipt=await options.identity.withAccess(access=>options.service!.validateExportReceipt(access,receiptId,manifestDigest));if(!receipt||receipt.receipt_id!==receiptId||!scopeMatches(provenance,receipt,manifestDigest))throw new DataAuthorityError();await authority.check(provenance,'recover');}catch{generation++;throw new DataAuthorityError();}
  },
  async inspect(roots){const fence=generation;try{const session=await current();const value=await inspectNative(options.binary(),options.env(),{version:1,store_path:path.join(roots['user-data'],'working',options.storeName),principal_id:session.principal.principal_id,task_root:path.join(roots['user-data'],'tasks'),runtime_home:roots['runtime-home']});const result={principalId:session.principal.principal_id,session,...parseInventory(value,roots)};await current(result);if(fence!==generation)throw new DataAuthorityError();inspections.set(result,fence);return result;}catch{generation++;throw new DataAuthorityError();}},
  async check(provenance,action){const fence=generation;const observed=new Map<string,bigint>();try{
   if(inspections.get(provenance)!==fence)throw new DataAuthorityError();
   const session=await current(provenance),service=options.service!;
   for(const workspace of provenance.workspaces){
    const policy=await options.identity.withAccess(access=>service.executionPolicy(access,workspace.workspace_id));
    if(!policy||policy.workspace_id!==workspace.workspace_id||fence!==generation)throw new DataAuthorityError();
    const epoch=BigInt(policy.authorization_epoch),key=`${provenance.principalId}:${workspace.workspace_id}`;if(epoch<1n||epoch<(highest.get(key)??0n))throw new DataAuthorityError();highest.set(key,epoch);observed.set(key,epoch);
    const access=await options.identity.withAccess(credential=>service.workspaceAccess(credential,workspace.workspace_id,action==='export'?'export':'read'));
    if(!access||access.authorization_epoch!==policy.authorization_epoch)throw new DataAuthorityError();
    for(const task of workspace.tasks){if(task.provenance_kind==='draft_metadata'){if(task.data_tier!=='not-applicable'||[task.route_identity,task.report_digest,task.processing_scope,task.data_policy_digest].some(v=>v!==null))throw new DataAuthorityError();continue;}if(task.provenance_kind!=='task_content')throw new DataAuthorityError();if(task.data_tier==='synthetic')continue;
     if(!task.route_identity||!task.report_digest||!task.processing_scope||!task.data_policy_digest)throw new DataAuthorityError();
     const view=await options.identity.withAccess(credential=>service.routeApproval(credential,workspace.workspace_id,task.route_identity!.route_id));
     if(!view?.approval||view.authorization_epoch!==policy.authorization_epoch||view.policy_revision!==policy.policy_revision)throw new DataAuthorityError();
     const binding={action:action==='export'?'export' as const:'read' as const,principal_id:provenance.principalId,session_id:session.session_id,task_id:task.task_id,workspace_id:workspace.workspace_id,operation_id:randomUUID(),generation:fence+1,principal_revision:session.principal.revision,session_revision:session.revision,authorization_epoch:policy.authorization_epoch,policy_revision:policy.policy_revision,approval_revision:view.approval.revision,processing_scope:task.processing_scope,data_policy_digest:task.data_policy_digest};
     const response=await options.identity.withAccess(credential=>service.routeEligibilityCheck(credential,workspace.workspace_id,{identity:task.route_identity!,report_digest:task.report_digest!,binding}));
     if(!response||JSON.stringify(response.authority.binding)!==JSON.stringify(binding))throw new DataAuthorityError();
    }
   }
   await current(provenance);if(fence!==generation||[...observed].some(([key,epoch])=>highest.get(key)!==epoch))throw new DataAuthorityError();
  }catch{generation++;throw new DataAuthorityError();}}
 };
 return authority;
}
