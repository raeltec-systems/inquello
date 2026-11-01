/** Dedicated owned smoke session. Never accepts renderer-supplied classification. */
import fs from 'node:fs';
import path from 'node:path';
import {taskBootstrap} from './bootstrap';
import {object,uuid} from '../usage/types';
import type {RouteView} from '../routes/types';
type BootstrapOptions=Parameters<typeof taskBootstrap>[0];
export function smokeTaskSession(options:BootstrapOptions & {enabled:boolean;seedFile:string}) {
 let bound:ReturnType<typeof taskBootstrap>|null=null;
 let owner:string|null=null,workspace:string|null=null;
 let instance:unknown;
 const unavailable=()=>new Error('Owned synthetic smoke session unavailable');
 const bootstrap:ReturnType<typeof taskBootstrap>=async(id,mode)=>{
  if(!options.enabled||options.packaged||!bound||options.identity.principalId()!==owner||id!==workspace)throw unavailable();
  await bound(id,mode);
 };
 return {bootstrap,verifyRoute:async(route:RouteView)=>{
  if(!options.enabled||options.packaged||!bound||!workspace||!owner||options.identity.principalId()!==owner||options.runtime.instance()!==instance||!options.runtime.ready())throw unavailable();
  const configuration=route.configuration;
  if(!configuration||configuration.routeId!=='claude-api-key'||route.routeId!==configuration.routeId||configuration.accountRef!==owner)throw unavailable();
  const result=object(await options.runtime.request('inquello/fixture/taskTransportStatus',{workspaceId:workspace,routeId:configuration.routeId,configurationRevision:route.revision}));
  if(Object.keys(result).join(',')!=='accepted'||result.accepted!==true||options.identity.principalId()!==owner||options.runtime.instance()!==instance||!options.runtime.ready())throw unavailable();
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
