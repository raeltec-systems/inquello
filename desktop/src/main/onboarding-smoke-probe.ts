/** Actual Electron DOM actions; no service mutation or membership setup helpers. */
import fs from 'node:fs';
import path from 'node:path';
import type {WebContents} from 'electron';
import type {IdentityWiring} from './identity';
import type {ownedOnboardingFixture,FixtureAccount} from './onboarding-smoke';
type Fixture=NonNullable<ReturnType<typeof ownedOnboardingFixture>>;
const helpers=`
const root=()=>document.querySelector('[data-onboarding]');
const visible=e=>!!e&&e.getClientRects().length>0&&!e.closest('[hidden]');
const buttons=(scope=root())=>[...scope.querySelectorAll('button')].filter(visible);
const button=(text,scope=root())=>buttons(scope).find(b=>b.textContent.trim()===text);
const field=label=>{const l=[...root().querySelectorAll('label')].find(l=>l.textContent.trim()===label);return l&&document.getElementById(l.htmlFor);};
const member=name=>[...root().querySelectorAll('[data-member-id]')].find(e=>e.querySelector('strong')?.textContent===name);
const wait=async test=>{const end=Date.now()+30000;while(Date.now()<end){if(test())return;await new Promise(r=>setTimeout(r,50));}throw Error('Visible onboarding state timed out');};
const click=async text=>{await wait(()=>button(text)&&!button(text).disabled);button(text).scrollIntoView({block:'center'});button(text).click();};
const confirm=async text=>{await wait(()=>document.querySelector('dialog[open]'));const d=document.querySelector('dialog[open]');const b=button(text,d);if(!b||b.disabled)throw Error('Confirmation unavailable');b.click();await wait(()=>!document.querySelector('dialog[open]'));};
const input=(label,value)=>{const e=field(label);if(!e||e.disabled)throw Error('Visible input unavailable');e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));};
const role=(scope,label,checked)=>{const l=[...scope.querySelectorAll('label')].find(e=>e.textContent.trim()===label),i=l?.querySelector('input[type=checkbox]');if(!i||i.disabled)throw Error('Policy role unavailable');if(i.checked!==checked)i.click();};
`;
export async function probeOnboarding(contents:WebContents,options:{fixture:Fixture;identity:IdentityWiring}) {
 const captures:{name:string;path:string;width:number;height:number}[]=[],checks:string[]=[],failures:string[]=[];
 let stage='first-run';
 const run=async(code:string)=>contents.executeJavaScript(`(async()=>{${helpers}${code}})()`);
 const bounded=async<T>(work:Promise<T>):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Onboarding capture deadline')),5000);})]);}finally{clearTimeout(timer);}};
 const capture=async(name:string)=>{
  await bounded(contents.executeJavaScript('(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()'));
  const image=await bounded(contents.capturePage()),size=image.getSize();if(image.isEmpty()||size.width<640||size.height<480)throw Error('Actual pixels unavailable');
  fs.mkdirSync(options.fixture.captureDir,{recursive:true});const file=path.join(options.fixture.captureDir,name+'.png');fs.writeFileSync(file,image.toPNG());captures.push({name,path:file,width:size.width,height:size.height});
 };
 const reauthenticate=async(account:FixtureAccount,name:string)=>{
  options.fixture.select(account);
  await run(`await click('Sign in again');await confirm('Sign out and sign in again');await wait(()=>root().textContent.includes(${JSON.stringify(name+' · Synthetic test issuer')})&&button('Sign in again')&&!button('Sign in again').disabled);`);
 };
 try {
  await run("await wait(()=>root()&&button('Sign in / Sign up / Recover account'));if(location.hash!=='#onboarding'||document.querySelector('.specimen'))throw Error('Wrong first-run surface');");
  await capture('01-signed-out');
  await run("await click('Sign in / Sign up / Recover account');await wait(()=>root().textContent.includes('Chanda Mwansa · Synthetic test issuer')&&button('Review Workspace creation')&&!button('Review Workspace creation').disabled);if(document.querySelector('#onboarding-workspace').options.length!==1)throw Error('Unexpected preexisting membership');");
  if(options.identity.vault.storage!=='os-backed')throw Error('Encrypted identity storage unavailable');
  const owner=options.identity.session.principalId();if(!owner)throw Error('Owner identity unavailable');
  checks.push('signed-in-no-workspace','os-backed-identity');await capture('02-signed-in-empty');
  stage='create-workspace';
  await run("input('Workspace name','Mupeta & Partners');");
  await run("await click('Review Workspace creation');await confirm('Create Workspace');await wait(()=>member('Chanda Mwansa')&&document.querySelector('#onboarding-workspace').selectedOptions[0]?.textContent==='Mupeta & Partners');");
  checks.push('visible-create-workspace-owner');await run("document.querySelector('#team-heading').scrollIntoView({block:'start'});");await capture('03-owner-workspace');
  stage='invite-colleague';
  await run("input('Recipient email','elias.ndlovu@mupeta.invalid');const group=[...root().querySelectorAll('fieldset')].find(f=>f.querySelector('legend')?.textContent==='Invitation roles');role(group,'Member',true);");
  await run("await click('Review invitation details');await confirm('Create invitation');await wait(()=>root().querySelector('[data-managed-invitation]')?.textContent.includes('elias.ndlovu@mupeta.invalid')&&root().textContent.includes('Email delivery is not configured.'));if(root().querySelectorAll('[data-managed-invitation]').length!==1)throw Error('Duplicate invitation');");
  checks.push('visible-invite-member','truthful-unconfigured-delivery');await run("root().querySelector('[data-managed-invitation]').scrollIntoView({block:'center'});");await capture('04-owner-invitation-unconfigured');
  stage='recipient-sign-in';await reauthenticate('elias','Elias Ndlovu');
  await run("await wait(()=>!root().textContent.includes('The signed-in identity changed. Return to onboarding with the intended account.'));");
  const recipient=options.identity.session.principalId();if(!recipient||recipient===owner)throw Error('Recipient identity not distinct');
  await run("await wait(()=>button('Review invitation'));if(document.querySelector('#onboarding-workspace').options.length!==1)throw Error('Recipient granted before acceptance');");
  checks.push('distinct-recipient-no-membership-before-accept');await run("button('Review invitation').scrollIntoView({block:'center'});");await capture('05-recipient-invitation');
  stage='accept-invitation';
  await run("await click('Review invitation');await confirm('Accept invitation');await wait(()=>document.querySelector('#onboarding-workspace').selectedOptions[0]?.textContent==='Mupeta & Partners'&&!button('Review invitation'));if(button('Review invitation details'))throw Error('Member acquired manager capability');");
  checks.push('visible-accept-invitation','member-manager-boundary');await run("document.querySelector('#team-heading').scrollIntoView({block:'start'});");await capture('06-recipient-accepted');
  stage='owner-role-change';await reauthenticate('chanda','Chanda Mwansa');
  if(options.identity.session.principalId()!==owner)throw Error('Owner identity changed');
  await run("await wait(()=>member('Elias Ndlovu'));const row=member('Elias Ndlovu');if(!row.querySelector('p').textContent.includes('Member'))throw Error('Initial member role wrong');button('Edit roles',row).click();");
  await run("const row=member('Elias Ndlovu');role(row,'Reviewer',true);role(row,'Member',false);");
  await run("const row=member('Elias Ndlovu');button('Review role change',row).click();await confirm('Change roles');await wait(()=>member('Elias Ndlovu')?.querySelector('p')?.textContent==='Reviewer');");
  await run("await click('Refresh access');await wait(()=>member('Elias Ndlovu')?.querySelector('p')?.textContent==='Reviewer'&&root().querySelector('[data-managed-invitation]')?.textContent.includes('accepted'));");
  checks.push('visible-role-change-observed-revision','refreshed-owner-team');await run("member('Elias Ndlovu').scrollIntoView({block:'center'});");await capture('07-owner-refreshed-reviewer');
  stage='secret-boundary';
  const exposed=await contents.executeJavaScript("JSON.stringify({dom:document.documentElement.outerHTML,url:location.href,local:Object.entries(localStorage),session:Object.entries(sessionStorage)})") as string;
  if(options.identity.session.knownSecrets().some(secret=>secret.length>=8&&exposed.includes(secret)))throw Error('Secret exposed to renderer');
  checks.push('renderer-secret-scan');
 } catch {failures.push('Owned onboarding journey failed at '+stage);try{await capture('failure-'+stage);}catch{failures.push('Failure capture unavailable');}}
 const report={ok:failures.length===0,synthetic:true,hostedAuth0Proven:false,checks,failures,captures};
 fs.mkdirSync(options.fixture.captureDir,{recursive:true});fs.writeFileSync(path.join(options.fixture.captureDir,'manifest.json'),JSON.stringify(report,null,2));
 return report;
}
