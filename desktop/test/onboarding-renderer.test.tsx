// @vitest-environment jsdom
import {act,cleanup,render,screen,within,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {Onboarding} from '../src/renderer/Onboarding';
import {readState,readTeam,readAction} from '../src/renderer/onboarding-bridge';
const A='11111111-1111-4111-8111-111111111111',W='33333333-3333-4333-8333-333333333333',W2='55555555-5555-4555-8555-555555555555',I='44444444-4444-4444-8444-444444444444';
const account={identity:{state:'signed-in',displayName:'Mara Finch',issuerLabel:'Synthetic identity'},sharedService:'available',credentialStorage:'os-backed',privateWork:'local'};
const initial={draft:{name:'',email:'',workspaceId:W},pending:null,invitations:[],discoveryReason:null};
const team={workspaceId:W,nextCursor:I,members:[{principalId:A,displayName:'Mara Finch',roles:['owner'],revision:'5'}],roles:[{id:'owner',label:'Owner'},{id:'member',label:'Member'}],deliveries:[{inviteId:I,state:'not_configured'}],invitations:[{inviteId:I,revision:'7',state:'pending',expiresAt:'2027-01-01T00:00:00+00:00',roles:['member'],recipientEmail:'Elias.Rowan@example.invalid'}]};
const ok={ok:true,value:{resourceId:W,revision:'1',authorizationEpoch:'2'}};
function world(state:unknown=initial,teamView:unknown=team){
 let changed:((v:boolean)=>void)|undefined;
 const api={getState:vi.fn(async()=>({ok:true,value:state})),saveDraft:vi.fn(async(input:unknown)=>({ok:true,value:input})),members:vi.fn(async()=>({ok:true,value:teamView})),createWorkspace:vi.fn(async()=>ok),acceptInvitation:vi.fn(async()=>ok),invite:vi.fn(async()=>ok),changeRoles:vi.fn(async()=>ok),removeMember:vi.fn(async()=>ok),revokeInvitation:vi.fn(async()=>ok),reconcile:vi.fn(async()=>({ok:true,value:null})),retry:vi.fn(async()=>ok),discardPending:vi.fn(async()=>({ok:true,value:null}))};
 const identity={getStatus:vi.fn(async()=>account),signIn:vi.fn(async()=>({ok:true,status:account})),signOut:vi.fn(async()=>({ok:true,status:{...account,identity:{state:'signed-out'}}})),reauthenticate:vi.fn(async()=>({ok:true,status:account}))};
 const organise={getWorkspaces:vi.fn(async()=>({signedIn:true,sharedService:'available',workspaces:[{workspaceId:W,name:'Alder & Finch',source:'service'}],engagementCreation:{enabled:true}}))};
 (globalThis as {inquello?:unknown}).inquello={onboarding:api,identity,organise,tasks:{onSessionChanged:(fn:(v:boolean)=>void)=>{changed=fn;return()=>{changed=undefined;};}}};
 return {api,identity,organise,change:()=>changed?.(true)};
}
afterEach(()=>{cleanup();delete (globalThis as {inquello?:unknown}).inquello;vi.restoreAllMocks();vi.useRealTimers();});
const ready=async()=>screen.findByText('Elias.Rowan@example.invalid');
describe('ordinary onboarding controls',()=>{
 it('requires deliberate creation confirmation and preserves input on cancel',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();const user=userEvent.setup();
  await user.type(screen.getByLabelText('Workspace name'),'Juniper Studio');
  await user.click(screen.getByRole('button',{name:'Review Workspace creation'}));expect(w.api.createWorkspace).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Cancel'}));
  expect((screen.getByLabelText('Workspace name') as HTMLInputElement).value).toBe('Juniper Studio');
  await user.click(screen.getByRole('button',{name:'Review Workspace creation'}));
  await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Create Workspace'}));
  await waitFor(()=>expect(w.api.createWorkspace).toHaveBeenCalledWith({name:'Juniper Studio'}));expect(w.api.createWorkspace).toHaveBeenCalledTimes(1);
 });
 it('accepts only the displayed invitation revision after confirmation',async()=>{
  const w=world({...initial,invitations:[{inviteId:I,workspaceId:W,workspaceName:'Alder & Finch',roles:['member'],revision:'8',expiresAt:'2027-01-01T00:00:00Z'}]});
  render(<Onboarding onBack={()=>{}}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Review invitation'}));expect(w.api.acceptInvitation).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Accept invitation'}));
  await waitFor(()=>expect(w.api.acceptInvitation).toHaveBeenCalledWith({inviteId:I,expectedRevision:'8'}));
 });
 it('revokes from manager metadata actual revision, never a guessed initial revision',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Revoke invitation'}));expect(w.api.revokeInvitation).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Revoke invitation'}));
  await waitFor(()=>expect(w.api.revokeInvitation).toHaveBeenCalledWith({workspaceId:W,inviteId:I,expectedRevision:'7'}));
 });
 it('submits member removal with observed revision and refreshes authority',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();const before=w.organise.getWorkspaces.mock.calls.length;
  await userEvent.click(screen.getByRole('button',{name:'Remove member'}));await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Remove member'}));
  await waitFor(()=>expect(w.api.removeMember).toHaveBeenCalledWith({workspaceId:W,principalId:A,expectedRevision:'5'}));
  await waitFor(()=>expect(w.organise.getWorkspaces.mock.calls.length).toBeGreaterThan(before));
 });
 it('uses the returned bounded pagination cursor and workspace',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Next invitations'}));
  await waitFor(()=>expect(w.api.members).toHaveBeenCalledWith({workspaceId:W,after:I}));
 });
 it('does not claim email delivery when unconfigured or merely provider accepted',async()=>{
  world();const v=render(<Onboarding onBack={()=>{}}/>);await ready();
  expect(screen.getByText(/Email delivery is not configured/)).toBeTruthy();v.unmount();
  world(initial,{...team,deliveries:[{inviteId:I,state:'provider_accepted'}]});render(<Onboarding onBack={()=>{}}/>);await ready();
  expect(screen.getByText(/Inbox delivery is not confirmed/)).toBeTruthy();
 });
 it('keeps an ambiguous pending request visible and never permits discard',async()=>{
  const w=world({...initial,pending:{kind:'createWorkspace',input:{name:'Alder'},operationId:I,state:'retryable',canDiscard:false},discoveryReason:'A recent sign-in with a verified email is required. Sign in again. If this persists, check email verification with your identity provider.'});
  render(<Onboarding onBack={()=>{}}/>);await ready();
  expect(screen.getByRole('button',{name:'Discard this change'}).getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(screen.getByRole('button',{name:'Discard this change'}));expect(w.api.discardPending).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Send it again'}));expect(w.api.retry).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Send again'}));await waitFor(()=>expect(w.api.retry).toHaveBeenCalledOnce());
 });
 it('requires confirmation for explicit reauthentication, without exposing passwords',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Sign in again'}));expect(w.identity.reauthenticate).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Sign out and sign in again'}));
  await waitFor(()=>expect(w.identity.reauthenticate).toHaveBeenCalledOnce());expect(document.querySelector('input[type=password]')).toBeNull();
 });
 it('shows missing identity configuration without claiming signup succeeded',async()=>{
  const w=world();w.identity.getStatus.mockResolvedValue({...account,identity:{state:'signed-out'} as typeof account.identity,sharedService:'not-configured'});
  render(<Onboarding onBack={()=>{}}/>);await screen.findByText(/Signup cannot continue/);
  expect(screen.getByRole('button',{name:'Sign in / Sign up / Recover account'}).getAttribute('aria-disabled')).toBe('true');expect(w.identity.signIn).not.toHaveBeenCalled();
 });
 it('suppresses late private metadata when the identity changes',async()=>{
  const w=world();let resolve!:(v:unknown)=>void;w.api.members.mockImplementation(()=>new Promise(r=>{resolve=r;}) as never);
  render(<Onboarding onBack={()=>{}}/>);await waitFor(()=>expect(w.api.members).toHaveBeenCalled());
  w.identity.getStatus.mockResolvedValue({...account,identity:{state:'signed-out'} as typeof account.identity});
  act(()=>w.change());await act(async()=>{resolve({ok:true,value:team});});
  expect(screen.queryByText('Elias.Rowan@example.invalid')).toBeNull();
 });
});
describe('strict safe renderer DTOs',()=>{
 it('rejects unexpected secrets, malformed revisions and missing invitation metadata',()=>{
  expect(readState({ok:true,value:{...initial,token:'secret'}})).toBeNull();
  expect(readTeam({ok:true,value:{...team,invitations:[{...team.invitations[0],revision:'01'}]}})).toBeNull();
  const {invitations,...missing}=team;expect(readTeam({ok:true,value:missing})).toBeNull();
  expect(readAction({...ok,accessCredential:'secret'})).toBeNull();
 });
});

describe('draft/identity transition fences',()=>{
 it('saves immediately typed draft before explicit reauthentication, without waiting for debounce',async()=>{
  const w=world();let saved!:(value:unknown)=>void;
  w.api.saveDraft.mockImplementation(()=>new Promise(resolve=>{saved=resolve;}) as never);
  render(<Onboarding onBack={()=>{}}/>);await ready();
  fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Immediate draft'}});
  await userEvent.click(screen.getByRole('button',{name:'Sign in again'}));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Sign out and sign in again'}));
  await waitFor(()=>expect(w.api.saveDraft).toHaveBeenCalled());expect(w.identity.reauthenticate).not.toHaveBeenCalled();
  await act(async()=>saved({ok:true,value:{name:'Immediate draft',email:'',workspaceId:W}}));
  await waitFor(()=>expect(w.identity.reauthenticate).toHaveBeenCalledOnce());
 });
 it('preserves dirty draft and refuses account transition when saving fails',async()=>{
  const w=world();w.api.saveDraft.mockResolvedValue({ok:false,reason:'Secure storage unavailable.'} as never);
  render(<Onboarding onBack={()=>{}}/>);await ready();
  fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Keep unsaved draft'}});
  await userEvent.click(screen.getByRole('button',{name:'Sign in again'}));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Sign out and sign in again'}));
  await screen.findByText(/Keep this window open and retry before changing accounts/);
  expect(w.identity.reauthenticate).not.toHaveBeenCalled();expect((screen.getByLabelText('Workspace name') as HTMLInputElement).value).toBe('Keep unsaved draft');
 });
 it('never sends an old scheduled draft after an identity invalidation',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();vi.useFakeTimers();
  fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Old principal draft'}});
  w.identity.getStatus.mockResolvedValue({...account,identity:{state:'signed-out'} as typeof account.identity});
  await act(async()=>{w.change();await Promise.resolve();vi.advanceTimersByTime(500);});
  expect(w.api.saveDraft).not.toHaveBeenCalled();
 });
});

describe('member edit scope',()=>{
 it('requires fresh role review when authoritative member revision changes during editing',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();
  await userEvent.click(screen.getByRole('button',{name:'Edit roles'}));
  const row=document.querySelector('[data-member-id="'+A+'"]') as HTMLElement;
  await userEvent.click(within(row).getByRole('checkbox',{name:'Member'}));
  w.api.members.mockResolvedValue({ok:true,value:{...team,members:[{...team.members[0],roles:['member'],revision:'6'}]}} as never);
  await userEvent.click(screen.getByRole('button',{name:'Next invitations'}));
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Review role change'})).toBeNull());
  expect(w.api.changeRoles).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button',{name:'Edit roles'}));
  expect((within(document.querySelector('[data-member-id="'+A+'"]') as HTMLElement).getByRole('checkbox',{name:'Member'}) as HTMLInputElement).checked).toBe(true);
  expect((within(document.querySelector('[data-member-id="'+A+'"]') as HTMLElement).getByRole('checkbox',{name:'Owner'}) as HTMLInputElement).checked).toBe(false);
 });
});


describe('current-generation refresh notices',()=>{
 const changed='The signed-in identity changed. Return to onboarding with the intended account.';
 for(const denied of [false,true])it(denied?'retains a genuine current authority denial after an intentional account switch':'clears a stale transition read warning only after fresh signed-in state succeeds',async()=>{
  const w=world();render(<Onboarding onBack={()=>{}}/>);await ready();
  let finish!:(v:unknown)=>void;w.identity.reauthenticate.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}) as never);
  await userEvent.click(screen.getByRole('button',{name:'Sign in again'}));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Sign out and sign in again'}));
  await waitFor(()=>expect(w.identity.reauthenticate).toHaveBeenCalled());
  w.api.getState.mockResolvedValue({ok:false,reason:changed} as never);
  act(()=>w.change());await screen.findByText(changed);
  const recipient={...account,identity:{...account.identity,displayName:'Elias Ndlovu'}};
  w.identity.getStatus.mockResolvedValue(recipient);
  w.api.getState.mockResolvedValue(denied?{ok:false,reason:'Current authority denied.'} as never:{ok:true,value:initial});
  await act(async()=>finish({ok:true,status:recipient}));
  await screen.findByText(/Elias Ndlovu/);
  if(denied)await screen.findByText('Current authority denied.');
  else await ready();
  await waitFor(()=>expect(screen.queryByText(changed)).toBeNull());
 });
 it('does not erase a current mutation rejection when its subsequent read succeeds',async()=>{
  const w=world();w.api.createWorkspace.mockResolvedValue({ok:false,reason:'This creation is denied.'} as never);
  render(<Onboarding onBack={()=>{}}/>);await ready();
  fireEvent.change(screen.getByLabelText('Workspace name'),{target:{value:'Denied workspace'}});
  await userEvent.click(screen.getByRole('button',{name:'Review Workspace creation'}));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Create Workspace'}));
  await screen.findByText('This creation is denied.');await ready();
  expect(screen.getByText('This creation is denied.')).toBeTruthy();
 });
});

it('offers recent-sign-in recovery without asserting the signed-in email is unverified or dispatching a mutation',async()=>{
 const reason='A recent sign-in with a verified email is required. Sign in again. If this persists, check email verification with your identity provider.';
 const pending={kind:'createWorkspace',input:{name:'Preserved workspace'},operationId:I,state:'retryable',canDiscard:false};
 const w=world({...initial,pending,discoveryReason:reason});render(<Onboarding onBack={()=>{}}/>);await ready();
 expect(screen.getByText(reason)).toBeTruthy();expect(screen.queryByText('Verify your email with your identity provider, then sign in again.')).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Sign in again'}));
 expect(screen.getByText(/Your browser may reuse its current account/)).toBeTruthy();expect(w.identity.reauthenticate).not.toHaveBeenCalled();
 await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Sign out and sign in again'}));
 await waitFor(()=>expect(w.identity.reauthenticate).toHaveBeenCalledOnce());await screen.findByText(/Waiting to confirm: your new Workspace/);
 expect(w.api.createWorkspace).not.toHaveBeenCalled();expect(w.api.retry).not.toHaveBeenCalled();expect(w.api.discardPending).not.toHaveBeenCalled();
});

for(const denied of [false,true])it(denied?'keeps a discovery denial distinct from a successful empty invitation list':'shows plain empty invitations after successful discovery without verification instructions',async()=>{
 const reason='A recent sign-in with a verified email is required. Sign in again. If this persists, check email verification with your identity provider.';
 world({...initial,discoveryReason:denied?reason:null});render(<Onboarding onBack={()=>{}}/>);await ready();
 const section=screen.getByRole('heading',{name:'Invitations for you'}).closest('section')!;
 expect(section.textContent).not.toMatch(/Verify your email|sign in again/i);
 if(denied){expect(screen.queryByText('No invitations are waiting for this account.')).toBeNull();expect(screen.getByText(reason)).toBeTruthy();}
 else expect(within(section).getByText('No invitations are waiting for this account.')).toBeTruthy();
});
