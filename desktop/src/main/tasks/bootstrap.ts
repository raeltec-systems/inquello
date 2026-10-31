/** Internal owner-configured fictional-data environment, never a renderer/content assertion. */
import fs from 'node:fs';
import path from 'node:path';
import type {OrganiseRuntime,OrganiseIdentity} from '../organise';
import {object,uuid} from '../usage/types';
import type {SessionView} from '../identity/wire';
export function taskBootstrap(options:{env:NodeJS.ProcessEnv;packaged:boolean;userData:string;runtime:OrganiseRuntime;identity:Pick<OrganiseIdentity,'principalId'>;currentSession?():Promise<SessionView|null>}):(workspaceId:string)=>Promise<void>{
 // Explicit opt-in plus default-off native debug feature; production cannot enable this path.
 const raw=options.packaged?undefined:options.env.INQUELLO_FICTIONAL_AUDIT_SESSION;
 let generation=0,last='',sessionRead=0;
 return async workspaceId=>{
  if(!raw){
   if(!options.currentSession)return;
   const read=++sessionRead,principal=options.identity.principalId(),runtime=options.runtime.instance();
   const session=await options.currentSession();
   if(read!==sessionRead||!session||!principal||session.principal.principal_id!==principal||principal!==options.identity.principalId()||runtime!==options.runtime.instance())throw new Error('Current session unavailable');
   const key=JSON.stringify([principal,session.session_id,session.principal.revision,session.revision]);if(key!==last){last=key;generation++;}
   const root=fs.realpathSync(options.userData);
   const result=object(await options.runtime.request('inquello/tasks/bootstrap',{workspaceId,isolatedRoot:root,realSession:{sessionId:session.session_id,principalRevision:session.principal.revision,sessionRevision:session.revision,generation}}));
   if(read!==sessionRead||result.accepted!==true||principal!==options.identity.principalId()||runtime!==options.runtime.instance())throw new Error('Task session unavailable');
   return;
  }
  const config=object(JSON.parse(raw));
  if(Object.keys(config).sort().join(',')!=='isolatedRoot,principalId,workspaceId')throw new Error('Invalid internal Task session');
  if(uuid(config.workspaceId)!==workspaceId||uuid(config.principalId)!==options.identity.principalId())throw new Error('Task session does not match authority');
  if(typeof config.isolatedRoot!=='string')throw new Error('Invalid internal root');
  const root=fs.realpathSync(config.isolatedRoot),userData=fs.realpathSync(options.userData);
  if(root!==userData)throw new Error('Task session must use its isolated desktop profile');
  const marker=path.join(root,'.inquello-fictional-audit-session');
  const stat=fs.lstatSync(marker);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Task session marker unavailable');
  const principal=options.identity.principalId(),runtime=options.runtime.instance();
  const result=object(await options.runtime.request('inquello/tasks/bootstrap',{workspaceId,isolatedRoot:root}));
  if(result.accepted!==true||principal!==options.identity.principalId()||runtime!==options.runtime.instance())throw new Error('Task session unavailable');
 };
}
