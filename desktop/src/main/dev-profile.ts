/** Explicit normal-development profile ownership; never an authentication bypass. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadServiceConfig,SERVICE_CONFIG_ENV} from './identity/config';
import {isProviderCredentialVar} from './runtime/env';
export const DEV_PROFILE_ENV='INQUELLO_DEV_PROFILE';
export const DEV_RUN_ENV='INQUELLO_DEV_RUN_ID';
const fail=()=>new Error('Owned development profile unavailable');
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
function directory(file:string):string {const absolute=path.resolve(file),stat=fs.lstatSync(absolute);if(!path.isAbsolute(file)||!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(absolute)!==absolute)throw fail();return absolute;}
function regular(file:string,max=65536):string {const absolute=path.resolve(file),stat=fs.lstatSync(absolute);if(!path.isAbsolute(file)||!stat.isFile()||stat.isSymbolicLink()||stat.size>max||fs.realpathSync(absolute)!==absolute)throw fail();return fs.readFileSync(absolute,'utf8');}
function record(text:string,keys:string[]):Record<string,unknown>{const value:unknown=JSON.parse(text);if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys.sort().join(','))throw fail();return value as Record<string,unknown>;}
function exclusiveWrite(file:string,text:string):void {fs.writeFileSync(file,text,{flag:'wx',mode:0o600});const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
export function ownedDevProfile(options:{packaged:boolean;paid:boolean;argv:string[];env:NodeJS.ProcessEnv}) {
 const profilePath=options.env[DEV_PROFILE_ENV],run=options.env[DEV_RUN_ENV],resume=options.argv.includes('--resume-owned-profile');
 if(!profilePath&&!run&&!resume)return null;
 if(!profilePath||!run||!uuid(run)||options.packaged||options.paid||options.argv.filter(a=>a==='--resume-owned-profile').length>1||options.argv.some(a=>/^--(?:smoke|seed|provider-fixture)/.test(a)))throw fail();
 if(Object.keys(options.env).some(k=>isProviderCredentialVar(k)||/DATABASE_URL$|^PGPASSWORD$|^INQUELLO_(?:PROVIDER_DEV_CONFIG|SMOKE_SEED|QUOTA_FIXTURE|VISUAL_FIXTURE|FICTIONAL_AUDIT_SESSION|ONBOARDING_FIXTURE|ONBOARDING_RUN)$|^RESEND_API_KEY$/i.test(k)))throw fail();
 const profile=directory(profilePath),root=directory(path.dirname(profile));
 if(path.basename(profile)!=='profile')throw fail();
 const markerFile=path.join(root,'.inquello-dev-profile'),markerText=regular(markerFile,16384);
 const marker=record(markerText,['version','runId','profileRoot','configFile','configSha256','state','profileNonce']);
 const configFile=path.join(root,'config.json');
 if(marker.version!==1||marker.runId!==run||marker.profileRoot!==profile||marker.configFile!==configFile||options.env[SERVICE_CONFIG_ENV]!==configFile||!uuid(marker.profileNonce)||!['new','initialized'].includes(marker.state as string))throw fail();
 const configText=regular(configFile),hash=createHash('sha256').update(configText).digest('hex');
 if(marker.configSha256!==hash)throw fail();
 const configuration=loadServiceConfig(options.env);
 if(configuration.kind!=='configured'||configuration.config.identityProfile!=='auth0'||configuration.config.issuerCa!==null||new URL(configuration.config.serviceUrl).hostname!=='127.0.0.1')throw fail();
 const proofFile=path.join(profile,'.inquello-owned-profile');
 const proof={version:1,runId:run,configSha256:hash,profileNonce:marker.profileNonce};
 if(resume){
  if(marker.state!=='initialized')throw fail();
  const saved=record(regular(proofFile,16384),Object.keys(proof));
  if(Object.keys(proof).some(key=>saved[key]!==proof[key as keyof typeof proof]))throw fail();
 }else{
  if(marker.state!=='new'||fs.readdirSync(profile).length!==0)throw fail();
  // Never adopt or delete a partial initialization. An interrupted proof/marker
  // transition requires explicit operator reconciliation, not a fresh identity.
  exclusiveWrite(proofFile,JSON.stringify(proof));
  if(regular(markerFile,16384)!==markerText)throw fail();
  const pending=path.join(root,'.inquello-dev-profile-'+marker.profileNonce+'.tmp');
  exclusiveWrite(pending,JSON.stringify({...marker,state:'initialized'}));
  fs.renameSync(pending,markerFile);
 }
 return {profile,runId:run,resumed:resume};
}
