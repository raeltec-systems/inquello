/** Test-only authority/native provenance stand-in. Never actual native/service evidence. */
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {takeInventory,type GovernedRoots} from '../src/main/data/inventory';
import {loadShippedPolicy} from '../src/main/data/policy';
import {DataAuthorityError,type DataAuthority,type DataProvenance} from '../src/main/data/authority';
import type {ExportProvenanceReceipt,SessionView} from '../src/main/identity/wire';
export const PRINCIPAL='11111111-1111-4111-8111-111111111111',WORKSPACE='22222222-2222-4222-8222-222222222222',TASK='33333333-3333-4333-8333-333333333333';
export function fixtureDataAuthority(options:{onCheck?():void;principal?:()=>string;allowed?:()=>boolean}={}):DataAuthority {
 const receipts=new Map<string,ExportProvenanceReceipt>();
 const principal=()=>options.principal?.()??PRINCIPAL;
 const session=():SessionView=>({session_id:'44444444-4444-4444-8444-444444444444',device_id:TASK,issuer:'https://fixture.invalid',subject:'fixture',created_at:'2026-10-31T00:00:00.000Z',last_authenticated_at:'2026-10-31T00:00:00.000Z',expires_at:'2026-11-01T00:00:00.000Z',revoked_at:null,revision:'1',principal:{principal_id:principal(),revision:'1',email:null,display_name:null}});
 const check=async(p:DataProvenance)=>{options.onCheck?.();if(options.allowed?.()===false||p.principalId!==principal())throw new DataAuthorityError();};
 return{
  async inspect(roots:GovernedRoots){const load=loadShippedPolicy();if(!load.ok)throw new Error();const inventory=takeInventory(load.policy,roots);return{principalId:principal(),session:session(),files:inventory.files.filter(f=>['working-store','task-history','task-folders'].includes(f.category??'')&&fs.lstatSync(f.abs).isFile()&&!fs.lstatSync(f.abs).isSymbolicLink()).map(f=>({path:f.abs,sha256:createHash('sha256').update(fs.readFileSync(f.abs)).digest('hex'),size:f.size,category:f.category!})),workspaces:[{workspace_id:WORKSPACE,tasks:[{task_id:TASK,provenance_kind:'task_content',data_tier:'synthetic',route_identity:null,report_digest:null,processing_scope:null,data_policy_digest:null}]}]};},
  check,
  async createReceipt(p,digest){await check(p);const receipt={receipt_id:randomUUID(),principal_id:p.principalId,manifest_digest:digest,workspace_ids:[WORKSPACE]};receipts.set(receipt.receipt_id,receipt);return receipt;},
  async validateReceipt(p,id,digest){await check(p);const receipt=receipts.get(id);if(!receipt||receipt.principal_id!==p.principalId||receipt.manifest_digest!==digest)throw new DataAuthorityError();}
 };
}
