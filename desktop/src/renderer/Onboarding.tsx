/** Story 1.31. Uses existing branded primitives; no imported third-party presentation code. */
import {useEffect,useRef,useState,type FormEvent,type ReactElement} from 'react';
import {Button,TextField,Checkbox,CheckboxGroup,StatusChip} from './primitives';
import {identityBridge,parseIdentityStatus,parseIdentityAction,type IdentityStatusView} from './bridge';
import {organiseBridge,parseWorkspaces,type WorkspaceEntry} from './Shell/organise-bridge';
import {onboardingBridge,readState,readTeam,readDraft,readAction,DELIVERY_TEXT,type OnboardingState,type Team,type Draft} from './onboarding-bridge';
import './onboarding.css';

const EMPTY:Draft={name:'',email:'',workspaceId:''};
const UNAVAILABLE='The current service response is unavailable. Refresh before taking action.';
type Confirmation={title:string;detail:string;label:string;run:()=>Promise<unknown>;success:string};
function Confirm({value,busy,onConfirm,onCancel}:{value:Confirmation;busy:boolean;onConfirm:()=>void;onCancel:()=>void}):ReactElement{
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null;const d=ref.current;d?.showModal();d?.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();return()=>{d?.close();if(prior?.isConnected)prior.focus();};},[]);
 return <dialog ref={ref} className="iq-onboarding-confirm" aria-labelledby="onboarding-confirm-title" aria-describedby="onboarding-confirm-detail" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}>
  <h2 id="onboarding-confirm-title">{value.title}</h2><p id="onboarding-confirm-detail">{value.detail}</p>
  <div className="iq-onboarding-actions"><Button variant="secondary" data-cancel="" disabledReason={busy?'Wait for this request to settle.':undefined} onPress={onCancel}>Cancel</Button><Button variant="primary" pending={busy} onPress={onConfirm}>{value.label}</Button></div>
 </dialog>;
}
function Roles({label,options,value,onChange,disabled}:{label:string;options:Team['roles'];value:string[];onChange:(v:string[])=>void;disabled?:string}):ReactElement{
 return <CheckboxGroup legend={label} disabledReason={disabled}>{options.map(r=><Checkbox key={r.id} label={r.label} checked={value.includes(r.id)} onChange={checked=>onChange(checked?[...value,r.id]:value.filter(id=>id!==r.id))}/>)}</CheckboxGroup>;
}
function MemberEditor({member,team,disabled,onChange,onRemove}:{member:Team['members'][number];team:Team;disabled?:string;onChange:(roles:string[])=>void;onRemove:()=>void}):ReactElement{
 const [editing,setEditing]=useState(false),[roles,setRoles]=useState(member.roles);
 return <li className="iq-onboarding-row" data-member-id={member.principalId}><div><strong>{member.displayName||'Workspace member'}</strong><p>{member.roles.map(id=>team.roles.find(r=>r.id===id)?.label??id).join(', ')}</p></div>
 {editing?<><Roles label={'Roles for '+(member.displayName||'Workspace member')} options={team.roles} value={roles} onChange={setRoles} disabled={disabled}/><Button size="sm" onPress={()=>onChange(roles)} disabledReason={disabled??(!roles.length?'Choose at least one role.':undefined)}>Review role change</Button><Button size="sm" variant="quiet" onPress={()=>setEditing(false)}>Cancel editing</Button></>:<Button size="sm" variant="secondary" onPress={()=>setEditing(true)} disabledReason={disabled}>Edit roles</Button>}
 <Button size="sm" variant="quiet" onPress={onRemove} disabledReason={disabled}>Remove member</Button></li>;
}
export interface OnboardingProps {onBack:()=>void;onIdentityChanged?:()=>void}
const PENDING_LABEL:Record<NonNullable<OnboardingState['pending']>['kind'],string>={createWorkspace:'your new Workspace',acceptInvitation:'your invitation acceptance',invite:'your invitation',changeRoles:'your role change',removeMember:'your member removal',revokeInvitation:'your invitation withdrawal'};
export function Onboarding({onBack,onIdentityChanged}:OnboardingProps):ReactElement{
 const api=onboardingBridge(),identity=identityBridge(),organise=organiseBridge();
 const [status,setStatus]=useState<IdentityStatusView|null>(null),[data,setData]=useState<OnboardingState|null>(null),[draft,setDraft]=useState<Draft>(EMPTY);
 const [workspaces,setWorkspaces]=useState<WorkspaceEntry[]>([]),[workspace,setWorkspace]=useState(''),[team,setTeam]=useState<Team|null>(null),[teamNotice,setTeamNotice]=useState<string|null>(null);
 const [inviteRoles,setInviteRoles]=useState<string[]>([]),[busy,setBusy]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[confirm,setConfirm]=useState<Confirmation|null>(null);
 // Read failures belong to a completed refresh, not to a mutation. A later
 // successful current-generation read resolves only this notice.
 const [readNotice,setReadNotice]=useState<string|null>(null);
 const flight=useRef<object|null>(null);
 const mounted=useRef(true),epoch=useRef(0),read=useRef(0),teamRead=useRef(0),workspaceRef=useRef(''),dirty=useRef(false),latestDraft=useRef(draft),refreshRef=useRef<()=>Promise<void>>(async()=>{});
 latestDraft.current=draft;
 const current=(token:number)=>mounted.current&&epoch.current===token;
 const clear=()=>{flight.current=null;setBusy(null);epoch.current++;read.current++;teamRead.current++;dirty.current=false;setData(null);setDraft(EMPTY);setTeam(null);setWorkspaces([]);setWorkspace('');workspaceRef.current='';setInviteRoles([]);setConfirm(null);};
 const selectWorkspace=(id:string)=>{teamRead.current++;workspaceRef.current=id;setWorkspace(id);setTeam(null);setTeamNotice(null);setInviteRoles([]);setConfirm(null);dirty.current=true;setDraft(d=>({...d,workspaceId:id}));};
 const loadTeam=async(id:string,after?:string)=>{
  if(!api||!id)return;const token=epoch.current,sequence=++teamRead.current;setTeamNotice(null);
  try {const r=readTeam(await api.members({workspaceId:id,...(after?{after}:{})}));if(!current(token)||sequence!==teamRead.current||workspaceRef.current!==id)return;
   if(!r?.ok||r.value.workspaceId!==id){setTeam(null);setTeamNotice(r&&!r.ok?r.reason:UNAVAILABLE);return;}
   setTeam(r.value);
  }catch{if(current(token)&&sequence===teamRead.current){setTeam(null);setTeamNotice(UNAVAILABLE);}}
 };
 const refresh=async()=>{
  if(!api||!identity){setReadNotice('Workspace onboarding is available in the desktop app only.');return;}
  const token=epoch.current,sequence=++read.current;
  try{
   const account=parseIdentityStatus(await identity.getStatus());if(!current(token)||sequence!==read.current)return;
   if(!account)throw Error();setStatus(account);
   if(account.identity.state!=='signed-in'){clear();return;}
   const next=readState(await api.getState());if(!current(token)||sequence!==read.current)return;
   if(!next?.ok){setData(null);setTeam(null);setReadNotice(next&&!next.ok?next.reason:UNAVAILABLE);return;}
   setReadNotice(null);setData(next.value);if(!dirty.current)setDraft(next.value.draft);
   const ws=organise?parseWorkspaces(await organise.getWorkspaces()):null;if(!current(token)||sequence!==read.current)return;
   const allowed=ws?.signedIn&&ws.sharedService==='available'?ws.workspaces.filter(w=>w.source==='service'):[];
   setWorkspaces(allowed);
   const selected=allowed.some(w=>w.workspaceId===workspaceRef.current)?workspaceRef.current:allowed.some(w=>w.workspaceId===next.value.draft.workspaceId)?next.value.draft.workspaceId:allowed[0]?.workspaceId??'';
   if(selected!==workspaceRef.current){workspaceRef.current=selected;setWorkspace(selected);setTeam(null);setInviteRoles([]);}
   if(selected)await loadTeam(selected);
   else setTeam(null);
  }catch{if(current(token)&&sequence===read.current){setData(null);setTeam(null);setWorkspaces([]);setReadNotice(UNAVAILABLE);}}
 };
 refreshRef.current=refresh;
 useEffect(()=>{mounted.current=true;void refreshRef.current();const events=(globalThis as {inquello?:{tasks?:{onSessionChanged?:(fn:(changed:boolean)=>void)=>()=>void}}}).inquello?.tasks;
  const off=events?.onSessionChanged?.(changed=>{if(changed){clear();setStatus(null);onIdentityChanged?.();}void refreshRef.current();});
  return()=>{mounted.current=false;epoch.current++;off?.();};},[]);
 useEffect(()=>{if(workspace)void loadTeam(workspace);},[workspace]);
 const persist=async(snapshot:Draft=latestDraft.current,scheduledEpoch=epoch.current)=>{
  if(!current(scheduledEpoch))return false;
  if(!api||!dirty.current)return true;const token=scheduledEpoch;
  try{const r=readDraft(await api.saveDraft(snapshot));if(!current(token))return false;if(!r?.ok){setNotice(r&&!r.ok?r.reason:'Your draft could not be saved. Keep this window open and retry.');return false;}if(JSON.stringify(latestDraft.current)===JSON.stringify(snapshot))dirty.current=false;return true;}
  catch{if(current(token))setNotice('Your draft could not be saved. Keep this window open and retry.');return false;}
 };
 useEffect(()=>{if(!data||!dirty.current)return;const scheduledEpoch=epoch.current;const timer=setTimeout(()=>{if(current(scheduledEpoch))void persist(draft,scheduledEpoch);},400);return()=>clearTimeout(timer);},[draft,data]);
 const changeDraft=(key:'name'|'email',value:string)=>{dirty.current=true;setDraft(d=>({...d,[key]:value.slice(0,key==='name'?200:254)}));};
 const auth=async(reauth=false)=>{
  if(!identity)return;const before=epoch.current;if(!(await persist(latestDraft.current,before))||!current(before))return;clear();onIdentityChanged?.();setBusy('identity');setNotice(null);
  try{const raw=reauth?await identity.reauthenticate?.():await identity.signIn();const r=parseIdentityAction(raw);if(mounted.current&&!r?.ok)setNotice(r?.reason??'Sign-in did not complete.');}
  catch{if(mounted.current)setNotice('Sign-in did not complete.');}
  finally{if(mounted.current){setBusy(null);await refreshRef.current();}}
 };
 const finish=async(value:Confirmation)=>{
  if(flight.current||busy)return;const action={};flight.current=action;const token=epoch.current,id=workspaceRef.current;setBusy('mutation');setNotice(null);
  try{const r=readAction(await value.run());if(!current(token)||id!==workspaceRef.current)return;
   if(!r?.ok)setNotice(r&&!r.ok?r.reason:UNAVAILABLE);else setNotice(value.success);
   setConfirm(null);await refreshRef.current();
  }catch{if(current(token)){setConfirm(null);setNotice('We couldn’t confirm whether your last change went through. Check its status below before trying again.');await refreshRef.current();}}
  finally{if(flight.current===action){flight.current=null;if(mounted.current)setBusy(null);}}
 };
 const reconcile=async()=>{if(!api||busy)return;setBusy('reconcile');const token=epoch.current;
  try{const r=readAction(await api.reconcile());if(!current(token))return;setNotice(!r?UNAVAILABLE:!r.ok?r.reason:r.value?'Your change went through. Refreshing your access.':'There’s no record of this change yet. It may still arrive, so don’t assume it failed. You can check again or send it again.');await refreshRef.current();}
  catch{if(current(token))setNotice(UNAVAILABLE);}finally{if(current(token))setBusy(null);}
 };
 const disabled=busy?'Wait for the current request.':!data?'Refresh your verified account and secure onboarding state first.':data.pending?'Finish checking your last change first.':undefined;
 const labels=(ids:string[])=>ids.map(id=>team?.roles.find(r=>r.id===id)?.label??id).join(', ');
 const create=(event:FormEvent)=>{event.preventDefault();if(!api||disabled)return;const name=draft.name.trim();if(!name){setNotice('Enter a Workspace name.');return;}setConfirm({title:'Create this Workspace?',detail:'Create '+name+' and become its first Owner. This does not grant access to anyone else’s private Tasks or provider credentials.',label:'Create Workspace',run:()=>api.createWorkspace({name}),success:'Workspace created. Current membership has been refreshed; choose it in the Workspace navigation to begin private work.'});};
 const invite=(event:FormEvent)=>{event.preventDefault();if(!api||!team||disabled)return;const email=draft.email.trim(),roles=[...inviteRoles],workspaceId=team.workspaceId;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!roles.length){setNotice('Enter a recipient email and choose at least one policy role.');return;}
  setConfirm({title:'Invite this colleague?',detail:'Invite '+email+' to this Workspace with '+labels(roles)+'. Only the intended verified identity can deliberately accept. Email delivery is reported separately.',label:'Create invitation',run:()=>api.invite({workspaceId,email,roles}),success:'Invitation created. Check its current status and email-delivery state below; creation alone does not mean email was sent.'});};
 const signedIn=status?.identity.state==='signed-in';
 return <main className="iq-onboarding" data-onboarding>
  <header className="iq-onboarding-header"><div><p className="iq-onboarding-eyebrow">Inquello / Account & workspace</p><h1>Make room for private work.</h1><p>Establish your identity, choose a Workspace, and invite your team. Your Tasks and provider credentials stay private.</p></div><Button variant="quiet" disabledReason={busy?'Wait for the current request.':undefined} onPress={()=>void persist().then(saved=>{if(saved)onBack();})}>Back to private work</Button></header>
  {notice&&<p className="iq-onboarding-notice" role="status">{notice}</p>}
  {readNotice&&<p className="iq-onboarding-notice" role="status">{readNotice}</p>}
  <section className="iq-onboarding-card" aria-labelledby="identity-heading"><h2 id="identity-heading">Your account</h2>
   <p>{status?.identity.state==='signed-in'?status.identity.displayName+' · '+status.identity.issuerLabel:'Sign in, create an account, or recover access using your identity provider’s hosted page.'}</p>
   <p>Inquello never stores your password. This account is separate from OpenAI or Anthropic credentials.</p>
   {status?.sharedService==='not-configured'&&<p role="status">The identity service is not configured. Signup cannot continue until your administrator configures it.</p>}
   <div className="iq-onboarding-actions">{!signedIn?<Button variant="primary" pending={busy==='identity'} disabledReason={status?.sharedService==='not-configured'?'Identity service configuration is required.':undefined} onPress={()=>void auth()}>Sign in / Sign up / Recover account</Button>:<Button variant="secondary" disabledReason={busy?'Wait for the current request.':!identity?.reauthenticate?'Reauthentication is unavailable in this app version.':undefined} onPress={()=>setConfirm({title:'Sign in again?',detail:'Sign out of this Inquello session, then open hosted sign-in for a recent verified identity. Your browser may reuse its current account. Pending operations remain bound to their original identity.',label:'Sign out and sign in again',run:async()=>{if(!(await persist(latestDraft.current)))return {ok:false,reason:'Your draft could not be saved. Keep this window open and retry before changing accounts.'};await auth(true);return {ok:true,value:null};},success:'Account status refreshed.'})}>Sign in again</Button>}
   <Button variant="quiet" disabledReason={busy?'Wait for the current request.':undefined} onPress={()=>void refresh()}>Refresh access</Button></div>
  </section>
  {signedIn&&<>
   {data?.discoveryReason&&<p className="iq-onboarding-notice" role="status">{data.discoveryReason}</p>}
   {data?.pending&&<section className="iq-onboarding-card" aria-labelledby="pending-heading"><h2 id="pending-heading">Your last change needs checking</h2><p>Waiting to confirm: {PENDING_LABEL[data.pending.kind]}. It was sent, but Inquello didn’t get a reply, so it may or may not have gone through. It won’t be applied twice. If the service can’t be reached right now, wait a moment and check again; Inquello also checks when you reopen the app.</p>
    <div className="iq-onboarding-actions"><Button onPress={()=>void reconcile()} pending={busy==='reconcile'}>Check status</Button><Button variant="secondary" disabledReason={busy?'Wait for the current request.':undefined} onPress={()=>api&&setConfirm({title:'Send this change again?',detail:'Inquello first checks whether the original went through. Only if it didn’t, it sends the same change again, exactly as you entered it. It won’t create a second copy.',label:'Send again',run:()=>api.retry(),success:'Your change went through. Your access has been refreshed.'})}>Send it again</Button>
    <Button variant="quiet" disabledReason={data.pending.canDiscard?busy?'Wait for the current request.':undefined:'This change may still go through, so it can’t be discarded yet.'} onPress={()=>api&&setConfirm({title:'Discard this change?',detail:'This is possible because the service rejected it. Inquello checks once more first. What you typed is kept.',label:'Discard this change',run:()=>api.discardPending(),success:'Change discarded. What you typed is still here; review it before trying again.'})}>Discard this change</Button></div></section>}
   <div className="iq-onboarding-grid">
    <section className="iq-onboarding-card"><h2>Create a Workspace</h2><p>Verified people may create a new Workspace and own only that Workspace.</p><form onSubmit={create} onBlur={()=>void persist()}><TextField label="Workspace name" value={draft.name} onChange={v=>changeDraft('name',v)} disabledReason={disabled} instruction="A company or team name. Up to 200 characters."/><Button variant="primary" type="submit" disabledReason={disabled}>Review Workspace creation</Button></form></section>
    <section className="iq-onboarding-card"><h2>Invitations for you</h2><p>Invitation discovery uses your current verified identity, not email text as an account-link key.</p>{data&&!data.discoveryReason&&!data.invitations.length&&<p>No invitations are waiting for this account.</p>}
     <ul className="iq-onboarding-list">{data?.invitations.map(i=><li key={i.inviteId} className="iq-onboarding-row"><div><strong>{i.workspaceName}</strong><p>Roles: {i.roles.join(', ')}</p><p>Expires {new Date(i.expiresAt).toLocaleString()}</p></div><Button variant="secondary" disabledReason={disabled} onPress={()=>api&&setConfirm({title:'Join '+i.workspaceName+'?',detail:'Accept this invitation with exactly these roles: '+i.roles.join(', ')+'. Tasks and provider secrets of other members remain private.',label:'Accept invitation',run:()=>api.acceptInvitation({inviteId:i.inviteId,expectedRevision:i.revision}),success:'Invitation accepted. Current membership has been refreshed.'})}>Review invitation</Button></li>)}</ul>
    </section>
   </div>
   <section className="iq-onboarding-card" aria-labelledby="team-heading"><h2 id="team-heading">Your Workspaces & team</h2><p>Only current managers may view or change this team. Server policy decides which roles can be assigned.</p>
    <label className="iq-field-label" htmlFor="onboarding-workspace">Workspace</label><select id="onboarding-workspace" className="iq-field-control" value={workspace} disabled={!!busy} onChange={e=>selectWorkspace(e.target.value)}><option value="">Choose a Workspace</option>{workspaces.map(w=><option key={w.workspaceId} value={w.workspaceId}>{w.name}</option>)}</select>
    {teamNotice&&<p role="status">{teamNotice}</p>}
    {team&&<><h3>Members</h3><ul className="iq-onboarding-list">{team.members.map(m=><MemberEditor key={team.workspaceId+':'+m.principalId+':'+m.revision} member={m} team={team} disabled={disabled}
     onChange={roles=>api&&setConfirm({title:'Change '+m.displayName+'’s roles?',detail:'Replace current roles with '+labels(roles)+'. The service will reject stale revisions, escalation or loss of the last eligible administrator.',label:'Change roles',run:()=>api.changeRoles({workspaceId:team.workspaceId,principalId:m.principalId,expectedRevision:m.revision,roles}),success:'Roles changed. Current team and access have been refreshed.'})}
     onRemove={()=>api&&setConfirm({title:'Remove '+m.displayName+'?',detail:'Remove this person from the Workspace. This does not expose or transfer their private Tasks. The last eligible administrator cannot be removed.',label:'Remove member',run:()=>api.removeMember({workspaceId:team.workspaceId,principalId:m.principalId,expectedRevision:m.revision}),success:'Membership removed. Current team and access have been refreshed.'})}/>)}</ul>
     <h3>Invite a colleague</h3><form onSubmit={invite} onBlur={()=>void persist()}><TextField label="Recipient email" type="email" value={draft.email} onChange={v=>changeDraft('email',v)} disabledReason={disabled}/><Roles label="Invitation roles" options={team.roles} value={inviteRoles} onChange={setInviteRoles} disabled={disabled}/><Button type="submit" variant="primary" disabledReason={disabled}>Review invitation details</Button></form>
     <h3>Workspace invitations</h3><ul className="iq-onboarding-list">{team.invitations.map(i=>{const delivery=team.deliveries.find(d=>d.inviteId===i.inviteId);return <li key={i.inviteId} className="iq-onboarding-row" data-managed-invitation={i.inviteId}><div><strong>{i.recipientEmail}</strong><p>{labels(i.roles)} · {i.state} · revision {i.revision}</p><p>Expires {new Date(i.expiresAt).toLocaleString()}</p><p>{delivery?DELIVERY_TEXT[delivery.state]:'Email delivery status is unavailable. No delivery success is claimed.'}</p></div>
      <Button variant="quiet" disabledReason={disabled??(!['pending','expired'].includes(i.state)?'This invitation is no longer pending.':undefined)} onPress={()=>api&&setConfirm({title:'Revoke this invitation?',detail:'Revoke the observed invitation for '+i.recipientEmail+' at revision '+i.revision+'. Already-sent notices cannot be recalled and do not themselves grant access.',label:'Revoke invitation',run:()=>api.revokeInvitation({workspaceId:team.workspaceId,inviteId:i.inviteId,expectedRevision:i.revision}),success:'Invitation revoked. Current invitation and delivery states have been refreshed.'})}>Revoke invitation</Button></li>;})}</ul>
     {!team.invitations.length&&<p>No invitations on this page.</p>}<div className="iq-onboarding-actions"><Button variant="quiet" disabledReason={busy?'Wait for the current request.':undefined} onPress={()=>void loadTeam(workspace)}>First invitation page</Button><Button variant="secondary" disabledReason={!team.nextCursor?'No further invitation page.':busy?'Wait for the current request.':undefined} onPress={()=>team.nextCursor&&void loadTeam(workspace,team.nextCursor)}>Next invitations</Button></div>
    </>}
   </section>
  </>}
  <footer className="iq-onboarding-footer"><StatusChip status="private-local" label="Private by default"/><p>Workspace membership does not share Tasks, export data, enable tools, or reveal provider credentials. Configure inference separately in Settings.</p></footer>
  {confirm&&<Confirm value={confirm} busy={busy==='mutation'||busy==='identity'} onCancel={()=>setConfirm(null)} onConfirm={()=>void finish(confirm)}/>}
 </main>;
}
