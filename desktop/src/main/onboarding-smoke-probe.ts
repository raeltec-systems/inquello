/** Actual Electron DOM actions and real input events; no service mutation or membership setup helpers. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {WebContents} from 'electron';
import type {IdentityWiring} from './identity';
import type {ownedOnboardingFixture,FixtureAccount} from './onboarding-smoke';
type Fixture=NonNullable<ReturnType<typeof ownedOnboardingFixture>>;
type Size={width:number;height:number};
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
const unavailableFor=(b,reason)=>!!b&&b.getAttribute('aria-disabled')==='true'&&!!b.closest('.iq-action')?.textContent.includes(reason);
const focusState=()=>{const a=document.activeElement,d=document.querySelector('dialog[open]'),s=a?getComputedStyle(a):null;return {label:a?.textContent.trim()??'',tag:a?.tagName??'',insideDialog:!!d&&!!a&&d.contains(a),focusVisible:!!a&&a.matches(':focus-visible'),outline:s?s.outlineStyle+' '+s.outlineWidth+' '+s.outlineColor:'',boxShadow:s?.boxShadow??''};};
const indicated=f=>f.focusVisible&&((!f.outline.startsWith('none')&&!/ 0px /.test(f.outline))||(f.boxShadow&&f.boxShadow!=='none'));
const inside=(e,w,h)=>{const r=e.getBoundingClientRect();return r.left>=-0.5&&r.right<=w+0.5&&(h===undefined||(r.top>=-0.5&&r.bottom<=h+0.5));};
`;
const SECOND_INVITEE='tamara.phiri@mupeta.invalid';
const UNCERTAIN='We couldn’t confirm whether your last change went through. Check its status below before trying again.';
const UNREACHABLE='The service could not be reached. Your draft is preserved.';
const RESOLVE_FIRST='Finish checking your last change first.';
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function probeOnboarding(contents:WebContents,options:{fixture:Fixture;identity:IdentityWiring;minimum:Size;resize:(width:number,height:number)=>void;restore:()=>Size}) {
 const captures:{name:string;path:string;width:number;height:number}[]=[],checks:string[]=[],failures:string[]=[];
 const evidence:Record<string,unknown>={};
 const resume=options.fixture.phase==='resume';
 let stage=resume?'relaunch-recovery':'first-run',ownerDigest:string|null=null;
 const run=async(code:string)=>contents.executeJavaScript(`(async()=>{${helpers}${code}})()`);
 const bounded=async<T>(work:Promise<T>):Promise<T>=>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Onboarding capture deadline')),5000);})]);}finally{clearTimeout(timer);}};
 const capture=async(name:string,least:Size={width:640,height:480})=>{
  await bounded(contents.executeJavaScript('(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()'));
  const image=await bounded(contents.capturePage()),size=image.getSize();if(image.isEmpty()||size.width<least.width||size.height<least.height)throw Error('Actual pixels unavailable');
  fs.mkdirSync(options.fixture.captureDir,{recursive:true});const file=path.join(options.fixture.captureDir,name+'.png');fs.writeFileSync(file,image.toPNG());captures.push({name,path:file,width:size.width,height:size.height});
 };
 // Real input events, the same pattern as the main smoke probe's pressKey.
 const key=async(keyCode:string)=>{
  contents.sendInputEvent({type:'keyDown',keyCode});
  if(keyCode==='Return')contents.sendInputEvent({type:'char',keyCode:'\r'});
  contents.sendInputEvent({type:'keyUp',keyCode});
  await delay(150);
 };
 const typeText=async(text:string)=>{
  for(const ch of text){const code=ch===' '?'Space':ch;contents.sendInputEvent({type:'keyDown',keyCode:code});contents.sendInputEvent({type:'char',keyCode:ch});contents.sendInputEvent({type:'keyUp',keyCode:code});await delay(25);}
  await delay(150);
 };
 const focused=async()=>await run('return focusState();') as {label:string;tag:string;insideDialog:boolean;focusVisible:boolean;outline:string;boxShadow:string};
 const reauthenticate=async(account:FixtureAccount,name:string)=>{
  options.fixture.select(account);
  await run(`await click('Sign in again');await confirm('Sign out and sign in again');await wait(()=>root().textContent.includes(${JSON.stringify(name+' · Synthetic test issuer')})&&button('Sign in again')&&!button('Sign in again').disabled);`);
 };
 const firstLaunch=async()=>{
  await run("await wait(()=>root()&&button('Sign in / Sign up / Recover account'));if(location.hash!=='#onboarding'||document.querySelector('.specimen'))throw Error('Wrong first-run surface');");
  await capture('01-signed-out');
  await run("await click('Sign in / Sign up / Recover account');await wait(()=>root().textContent.includes('Chanda Mwansa · Synthetic test issuer')&&button('Review Workspace creation')&&!button('Review Workspace creation').disabled);if(document.querySelector('#onboarding-workspace').options.length!==1)throw Error('Unexpected preexisting membership');");
  if(options.identity.vault.storage!=='os-backed')throw Error('Encrypted identity storage unavailable');
  const owner=options.identity.session.principalId();if(!owner)throw Error('Owner identity unavailable');
  ownerDigest=digest(owner);
  checks.push('signed-in-no-workspace','os-backed-identity');await capture('02-signed-in-empty');
  stage='create-workspace';
  // Keyboard only: reach the name field with Tab, type it, Tab to the review button, Return.
  contents.focus();
  let reached=false;
  for(let i=0;i<60&&!reached;i++){await key('Tab');reached=await run("return document.activeElement===field('Workspace name');") as boolean;}
  if(!reached)throw Error('Workspace name unreachable by keyboard');
  await typeText('Mupeta & Partners');
  if(await run("return field('Workspace name').value;")!=='Mupeta & Partners')throw Error('Typed Workspace name not entered');
  await key('Tab');
  if((await focused()).label!=='Review Workspace creation')throw Error('Review button not next in keyboard order');
  await key('Return');
  await run("await wait(()=>document.querySelector('dialog[open]'));");
  const initial=await focused();
  if(!initial.insideDialog||initial.label!=='Cancel'||!await run('return indicated(focusState());'))throw Error('Dialog focus did not start visibly inside');
  await capture('08-keyboard-dialog-focus');
  const sequence:string[]=[];
  for(let i=0;i<4;i++){await key('Tab');const now=await focused();if(!now.insideDialog)throw Error('Tab left the confirmation dialog');sequence.push(now.label);}
  await key('Escape');
  await run("await wait(()=>!document.querySelector('dialog[open]'));");
  const restored=await focused();
  if(restored.label!=='Review Workspace creation')throw Error('Escape did not return focus to the opener');
  evidence.focus={initial,tabSequence:sequence,escapeRestoredTo:restored.label,restoredFocusVisible:restored.focusVisible};
  checks.push('dialog-focus-contained-and-restored');
  await key('Return');
  await run("await wait(()=>document.querySelector('dialog[open]'));");
  if((await focused()).label!=='Cancel')throw Error('Reopened dialog focus not on Cancel');
  await key('Tab');
  if((await focused()).label!=='Create Workspace')throw Error('Confirm not reachable by keyboard');
  await key('Return');
  await run("await wait(()=>!document.querySelector('dialog[open]')&&member('Chanda Mwansa')&&document.querySelector('#onboarding-workspace').selectedOptions[0]?.textContent==='Mupeta & Partners');if(!member('Chanda Mwansa').querySelector('p').textContent.includes('Owner'))throw Error('Creator is not Owner');");
  checks.push('visible-create-workspace-owner','keyboard-create-workspace');await run("document.querySelector('#team-heading').scrollIntoView({block:'start'});");await capture('03-owner-workspace');
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
  stage='minimum-window';
  await run(`input('Recipient email',${JSON.stringify(SECOND_INVITEE)});const group=[...root().querySelectorAll('fieldset')].find(f=>f.querySelector('legend')?.textContent==='Invitation roles');role(group,'Member',true);`);
  const {width,height}=options.minimum;
  let restoredSize:Size|null=null;
  try {
   options.resize(width,height);
   await run(`await wait(()=>Math.abs(innerWidth-${width})<=2&&Math.abs(innerHeight-${height})<=2);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
   const team=await run("const w=innerWidth,h=innerHeight;return {width:w,height:h,pageScrollWidth:document.documentElement.scrollWidth,bodyScrollWidth:document.body.scrollWidth,outside:buttons().filter(b=>!inside(b,w)).map(b=>b.textContent.trim())};") as {width:number;height:number;pageScrollWidth:number;bodyScrollWidth:number;outside:string[]};
   if(team.pageScrollWidth>team.width+1||team.bodyScrollWidth>team.width+1||team.outside.length)throw Error('Minimum-size team view overflowed');
   await run("document.querySelector('#team-heading').scrollIntoView({block:'start'});");await capture('09-minimum-team',{width:400,height:300});
   await run("await click('Review invitation details');await wait(()=>document.querySelector('dialog[open]'));");
   const dialog=await run("const w=innerWidth,h=innerHeight,d=document.querySelector('dialog[open]');return {dialogInside:inside(d,w,h),dialogScrollWidth:d.scrollWidth,dialogClientWidth:d.clientWidth,pageScrollWidth:document.documentElement.scrollWidth,outside:buttons(d).filter(b=>!inside(b,w,h)).map(b=>b.textContent.trim()),buttons:buttons(d).map(b=>b.textContent.trim())};") as {dialogInside:boolean;dialogScrollWidth:number;dialogClientWidth:number;pageScrollWidth:number;outside:string[];buttons:string[]};
   await capture('10-minimum-dialog',{width:400,height:300});
   await run("const d=document.querySelector('dialog[open]');button('Cancel',d).click();await wait(()=>!document.querySelector('dialog[open]'));");
   if(!dialog.dialogInside||dialog.dialogScrollWidth>dialog.dialogClientWidth+1||dialog.pageScrollWidth>width+1||dialog.outside.length||dialog.buttons.length<2)throw Error('Minimum-size dialog clipped');
   evidence.minimumWindow={requested:{width,height},team,dialog};
  } finally {restoredSize=options.restore();}
  await run(`await wait(()=>Math.abs(innerWidth-${restoredSize.width})<=2&&Math.abs(innerHeight-${restoredSize.height})<=2);`);
  checks.push('minimum-window-layout');
  stage='interrupted-request';
  // Main-owned test fault: the next POST is applied, its reply lost, then the service is unreachable for this launch.
  options.fixture.loseReplyThenOutage();
  await run(`if(field('Recipient email').value!==${JSON.stringify(SECOND_INVITEE)})throw Error('Second invitation draft lost');await click('Review invitation details');await confirm('Create invitation');`);
  await run(`await wait(()=>document.getElementById('pending-heading')?.textContent==='Your last change needs checking'&&root().textContent.includes(${JSON.stringify(UNCERTAIN)})&&button('Check status'));
   const panel=document.getElementById('pending-heading').closest('section');if(!panel.textContent.includes('Waiting to confirm: your invitation'))throw Error('Pending panel does not name the action');
   // The panel appears while the failed request is still settling, when the control briefly shows the busy reason; wait for the settled reason.
   await wait(()=>unavailableFor(button('Review Workspace creation'),${JSON.stringify(RESOLVE_FIRST)})).catch(()=>{throw Error('Other changes not disabled with the resolve-first reason');});
   const notice=[...root().querySelectorAll('.iq-onboarding-notice')].find(e=>e.textContent===${JSON.stringify(UNCERTAIN)});notice.scrollIntoView({block:'start'});
   if(panel.getBoundingClientRect().bottom>innerHeight)panel.scrollIntoView({block:'end'});`);
  await capture('11-interrupted-request');
  await run(`await click('Check status');await wait(()=>{const b=button('Check status');return b&&b.getAttribute('aria-busy')!=='true'&&root().querySelector(':scope > .iq-onboarding-notice')?.textContent===${JSON.stringify(UNREACHABLE)};});
   if(!document.getElementById('pending-heading'))throw Error('Pending panel vanished without confirmation');
   if(root().textContent.includes('Your change went through'))throw Error('Unconfirmed request reported as applied');`);
  checks.push('interrupted-request-visible');
 };
 const relaunch=async()=>{
  const first=JSON.parse(fs.readFileSync(path.join(options.fixture.captureDir,'manifest.json'),'utf8')) as {ok?:unknown;ownerDigest?:unknown};
  if(first.ok!==true||typeof first.ownerDigest!=='string')throw Error('First launch report unavailable');
  await run("await wait(()=>root()&&root().textContent.includes('Chanda Mwansa · Synthetic test issuer'));");
  const owner=options.identity.session.principalId();if(!owner||digest(owner)!==first.ownerDigest)throw Error('Owner not identified after relaunch');
  await run(`await wait(()=>member('Chanda Mwansa')&&[...root().querySelectorAll('[data-managed-invitation]')].some(e=>e.textContent.includes(${JSON.stringify(SECOND_INVITEE)}))&&button('Review Workspace creation')&&button('Review Workspace creation').getAttribute('aria-disabled')!=='true');
   if(document.getElementById('pending-heading')||button('Check status'))throw Error('Pending request not reconciled');
   if([...root().querySelectorAll('[data-managed-invitation]')].filter(e=>e.textContent.includes(${JSON.stringify(SECOND_INVITEE)})).length!==1)throw Error('Interrupted invitation not exactly once');
   if(button('Review invitation details')?.getAttribute('aria-disabled')==='true')throw Error('Changes still disabled');
   [...root().querySelectorAll('[data-managed-invitation]')].find(e=>e.textContent.includes(${JSON.stringify(SECOND_INVITEE)})).scrollIntoView({block:'center'});`);
  ownerDigest=first.ownerDigest;
  await capture('12-recovered-after-relaunch');
  checks.push('interrupted-request-recovered-after-relaunch');
 };
 try {await (resume?relaunch():firstLaunch());}
 catch {failures.push('Owned onboarding journey failed at '+stage);try{await capture('failure-'+stage);}catch{failures.push('Failure capture unavailable');}}
 const report={ok:failures.length===0,synthetic:true,hostedAuth0Proven:false,phase:options.fixture.phase,ownerDigest,checks,failures,captures,...evidence};
 fs.mkdirSync(options.fixture.captureDir,{recursive:true});fs.writeFileSync(path.join(options.fixture.captureDir,resume?'manifest-resume.json':'manifest.json'),JSON.stringify(report,null,2));
 return report;
}
