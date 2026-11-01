/** Dedicated owned smoke session. Never accepts renderer-supplied classification. */
import fs from 'node:fs';
import path from 'node:path';
import {taskBootstrap} from './bootstrap';
import {object,uuid} from '../usage/types';
import type {RouteView} from '../routes/types';
type BootstrapOptions=Parameters<typeof taskBootstrap>[0];
export function smokeTaskSession(options:BootstrapOptions & {enabled:boolean;allowQuotaRoute?:boolean;seedFile:string;diagnostic?:(stage:'scope'|'binding'|'native-proof'|'native-response'|'post-scope'|'accepted',kind:'none'|'transport-fence'|'fixture_unavailable'|'authority_unknown'|'stale'|'not_found'|'other')=>void}) {
 let bound:ReturnType<typeof taskBootstrap>|null=null;
 let owner:string|null=null,workspace:string|null=null;
 let instance:unknown;
 const unavailable=()=>new Error('Owned synthetic smoke session unavailable');
 const bootstrap:ReturnType<typeof taskBootstrap>=async(id,mode)=>{
  if(!options.enabled||options.packaged||!bound||options.identity.principalId()!==owner||id!==workspace)throw unavailable();
  await bound(id,mode);
 };
 return {bootstrap,verifyRoute:async(route:RouteView)=>{
  let stage:Parameters<NonNullable<typeof options.diagnostic>>[0]='scope';
  const report=(kind:Parameters<NonNullable<typeof options.diagnostic>>[1])=>{if(options.enabled&&!options.packaged){try{options.diagnostic?.(stage,kind);}catch{/* Diagnostics cannot affect authority. */}}};
  try {
  if(!options.enabled||options.packaged||!bound||!workspace||!owner||options.identity.principalId()!==owner||options.runtime.instance()!==instance||!options.runtime.ready())throw unavailable();
  stage='binding';
  const configuration=route.configuration;
  if(!configuration||route.routeId!==configuration.routeId||configuration.accountRef!==owner)throw unavailable();
  const quota=options.allowQuotaRoute===true&&configuration.routeId==='codex-responses'&&configuration.deployment==='openai-api'&&configuration.model==='fixture-model-20261030'&&configuration.apiVersion==='responses-v1'&&configuration.region===null;
  if(configuration.routeId!=='claude-api-key'&&!quota)throw unavailable();
  // A disabled, credential-absent row grants nothing and needs no provider handoff.
  // Only the dedicated quota profile has a staged/retired configuration.
  if(options.allowQuotaRoute===true&&!route.credentialPresent){if(route.enabled)throw unavailable();return;}
  stage='native-proof';
  const result=object(await options.runtime.request('inquello/fixture/taskTransportStatus',{workspaceId:workspace,routeId:configuration.routeId,configurationRevision:route.revision}));
  stage='native-response';
  if(Object.keys(result).join(',')!=='accepted'||result.accepted!==true)throw unavailable();
  stage='post-scope';
  if(options.identity.principalId()!==owner||options.runtime.instance()!==instance||!options.runtime.ready())throw unavailable();
  stage='accepted';report('none');
  } catch(error) {
   const native=error as {rpcCode?:unknown;data?:{inquello?:{kind?:unknown}}}|null;
   const kind=native?.data?.inquello?.kind;
   report(native?.rpcCode===-32001?'transport-fence':kind==='fixture_unavailable'||kind==='authority_unknown'||kind==='stale'||kind==='not_found'?kind:'other');
   throw error;
  }
 },arm:async(id:string)=>{
  if(!options.enabled||options.packaged)throw unavailable();
  const seedFile=fs.lstatSync(options.seedFile);
  if(!seedFile.isFile()||seedFile.isSymbolicLink()||seedFile.size>8192)throw unavailable();
  const seed=object(JSON.parse(fs.readFileSync(options.seedFile,'utf8')));
  if(Object.keys(seed).some(key=>!['workspace_id','invite_id','workspace_name'].includes(key)))throw unavailable();
  const expected=uuid(seed.workspace_id);uuid(seed.invite_id);
  const principal=uuid(options.identity.principalId());
  if(uuid(id)!==expected||(bound&&(owner!==principal||workspace!==id)))throw unavailable();
  const root=fs.realpathSync(options.userData);
  const marker=fs.lstatSync(path.join(root,'.inquello-fictional-audit-session'));
  if(!marker.isFile()||marker.isSymbolicLink())throw unavailable();
  if(!bound){
   owner=principal;workspace=id;instance=options.runtime.instance();
   bound=taskBootstrap({...options,env:{...options.env,INQUELLO_FICTIONAL_AUDIT_SESSION:JSON.stringify({principalId:principal,workspaceId:id,isolatedRoot:root})}});
  }
  await bootstrap(id);
 }};
}
