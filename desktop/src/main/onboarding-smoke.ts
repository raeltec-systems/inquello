/** Explicit owned test topology only. No renderer operation selects an identity. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {loadServiceConfig,SERVICE_CONFIG_ENV} from './identity/config';
import {headlessOpener} from './identity/headless-opener';
import {ServiceError,type HttpsTransport} from './identity/service-client';
import {isProviderCredentialVar} from './runtime/env';

export const ONBOARDING_FIXTURE_ENV='INQUELLO_ONBOARDING_FIXTURE';
export const ONBOARDING_RUN_ENV='INQUELLO_ONBOARDING_RUN';
/** Set by the launcher to this run's ID for the single relaunch only. */
export const ONBOARDING_RESUME_ENV='INQUELLO_ONBOARDING_RESUME';
/** Written by the gate into the empty profile: proves this run created it. */
export const ONBOARDING_SENTINEL='.inquello-onboarding-owner';
/** Written by the launcher beside the fixture marker after a clean first exit; consumed once. */
export const ONBOARDING_RESUME_MARKER='.inquello-onboarding-resume';
export type FixtureAccount='chanda'|'elias';
export type FixturePhase='first'|'resume';
const unavailable=()=>new Error('Owned onboarding fixture unavailable');
const modes=['--smoke','--smoke-navigation','--smoke-quota','--smoke-visual','--smoke-onboarding'];
const uuid=/^[0-9a-f-]{36}$/;
function regular(file:string):string {
 const resolved=path.resolve(file),stat=fs.lstatSync(resolved);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536||fs.realpathSync(resolved)!==resolved)throw unavailable();
 return fs.readFileSync(resolved,'utf8');
}
function ownedDirectory(dir:string):string {
 const resolved=path.resolve(dir),stat=fs.lstatSync(resolved);
 if(!stat.isDirectory()||stat.isSymbolicLink()||fs.realpathSync(resolved)!==resolved)throw unavailable();
 return resolved;
}
function record(file:string,keys:string):Record<string,unknown> {
 let value:unknown;
 try{value=JSON.parse(regular(file));}catch{throw unavailable();}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==keys)throw unavailable();
 return value as Record<string,unknown>;
}
function loopback(value:unknown):value is string {
 if(typeof value!=='string')return false;
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='127.0.0.1'&&!!u.port&&u.origin===value;}catch{return false;}
}
export function ownedOnboardingFixture(options:{packaged:boolean;argv:string[];env:NodeJS.ProcessEnv}) {
 const requested=options.argv.includes('--smoke-onboarding');
 if(!requested){if(options.env[ONBOARDING_FIXTURE_ENV]||options.env[ONBOARDING_RUN_ENV]||options.env[ONBOARDING_RESUME_ENV])throw unavailable();return null;}
 if(options.packaged||options.argv.filter(a=>modes.includes(a)).length!==1||options.argv.some(a=>a!=='--smoke-onboarding'&&/^--(?:smoke|seed|provider-fixture|visual-only|quota-only|navigation)/.test(a)))throw unavailable();
 if(Object.keys(options.env).some(k=>isProviderCredentialVar(k)||/^(INQUELLO_SMOKE_SEED|INQUELLO_QUOTA_FIXTURE|INQUELLO_VISUAL_FIXTURE|INQUELLO_FICTIONAL_AUDIT_SESSION|INQUELLO_PROVIDER_DEV_CONFIG|RESEND_API_KEY)$/.test(k.toUpperCase())))throw unavailable();
 const markerFile=options.env[ONBOARDING_FIXTURE_ENV],run=options.env[ONBOARDING_RUN_ENV],configFile=options.env[SERVICE_CONFIG_ENV];
 if(!markerFile||!configFile||!run||!uuid.test(run))throw unavailable();
 const root=ownedDirectory(path.dirname(markerFile));
 if(path.basename(markerFile)!=='.inquello-onboarding-fixture'||path.resolve(configFile)!==path.join(root,'config.json'))throw unavailable();
 const marker=JSON.parse(regular(markerFile)) as Record<string,unknown>;
 if(Object.keys(marker).sort().join(',')!=='configSha256,issuerUrl,profileRoot,runId,serviceUrl'||marker.runId!==run||!loopback(marker.issuerUrl)||!loopback(marker.serviceUrl))throw unavailable();
 if(marker.configSha256!==createHash('sha256').update(regular(configFile)).digest('hex'))throw unavailable();
 const profile=ownedDirectory(path.join(root,'profile'));
 const sentinelFile=path.join(profile,ONBOARDING_SENTINEL),resumeFile=path.join(root,ONBOARDING_RESUME_MARKER);
 const resumeRequested=options.env[ONBOARDING_RESUME_ENV]!==undefined;
 let phase:FixturePhase,sentinel:Record<string,unknown>|null=null;
 if(marker.profileRoot!==profile)throw unavailable();
 if(!resumeRequested){if(fs.readdirSync(profile).length!==0)throw unavailable();phase='first';}
 else {
  // The single owner-approved exception: this run's own sentinel plus the launcher's one-use marker.
  if(options.env[ONBOARDING_RESUME_ENV]!==run)throw unavailable();
  sentinel=record(sentinelFile,'nonce,resumed,runId');
  if(sentinel.runId!==run||sentinel.resumed!==false||typeof sentinel.nonce!=='string'||!uuid.test(sentinel.nonce))throw unavailable();
  const resume=record(resumeFile,'runId,sentinelNonce');
  if(resume.runId!==run||resume.sentinelNonce!==sentinel.nonce)throw unavailable();
  phase='resume';
 }
 const config=loadServiceConfig(options.env);
 if(config.kind!=='configured'||config.config.clientId!=='inquello-desktop-synthetic'||config.config.issuerLabel!=='Synthetic test issuer'||config.config.identityProfile!==undefined||config.config.issuerCa!==undefined||config.config.issuerUrl!==marker.issuerUrl||config.config.serviceUrl!==marker.serviceUrl)throw unavailable();
 // Every check passed; only now touch the profile.
 if(phase==='first')fs.writeFileSync(sentinelFile,JSON.stringify({runId:run,nonce:randomUUID(),resumed:false}),{flag:'wx',mode:0o600});
 else {fs.writeFileSync(sentinelFile,JSON.stringify({...sentinel,resumed:true}),{mode:0o600});fs.rmSync(resumeFile);}
 let account:FixtureAccount='chanda';
 // Deterministic interruption: reply lost, then the service unreachable until this process exits.
 let fault:'idle'|'armed'|'outage'='idle',armed=false;
 return {profile,captureDir:path.join(root,'captures'),runId:run,phase,
  select(value:FixtureAccount){if(phase!=='first'||(value!=='chanda'&&value!=='elias'))throw unavailable();account=value;},
  loseReplyThenOutage(){if(phase!=='first'||armed)throw unavailable();armed=true;fault='armed';},
  onboardingTransport(transport:HttpsTransport):HttpsTransport{return async request=>{
   if(fault==='outage')throw new ServiceError('transport',false);
   if(fault==='armed'&&request.method==='POST'){
    fault='outage';
    await transport(request);
    throw new ServiceError('transport',true);
   }
   return transport(request);
  };},
  opener(transport:HttpsTransport){return async(url:string)=>{
   // The relaunch proves the stored owner session; no account is selected or signed in.
   if(phase!=='first')throw unavailable();
   const target=new URL(url);
   if(target.origin+target.pathname!==marker.issuerUrl+'/authorize'||target.username||target.password||target.hash||target.searchParams.has('login_hint')||target.searchParams.get('client_id')!=='inquello-desktop-synthetic')throw unavailable();
   const redirect=new URL(target.searchParams.get('redirect_uri')??'');
   if(redirect.protocol!=='http:'||redirect.hostname!=='127.0.0.1'||!redirect.port||redirect.pathname!=='/callback'||redirect.username||redirect.password||redirect.search||redirect.hash)throw unavailable();
   const guarded:HttpsTransport=async request=>{
    const response=await transport(request);
    if(response.location){const callback=new URL(response.location);if(callback.origin!==redirect.origin||callback.pathname!==redirect.pathname||callback.username||callback.password||callback.hash)throw unavailable();}
    return response;
   };
   target.searchParams.set('login_hint',account);await headlessOpener(guarded)(target.toString());
  };},
 };
}
