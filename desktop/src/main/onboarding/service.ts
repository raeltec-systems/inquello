import {randomUUID} from 'node:crypto';
import {ServiceError} from '../identity/service-client';
import {PROTOCOL_MAJOR,SCHEMA_VERSION,type CommandResponse} from '../identity/wire';
import {applied,envelope,mutation,draftInput,teamInput} from './contracts';
import type {OnboardingClient} from './client';
import type {OnboardingStorage,RecordState,StoredPending} from './store';
import type {Draft,Mutation,OnboardingState,Applied,Result,Team,TeamInput,CreateInput,AcceptInput,InviteInput,ChangeRolesInput,RemoveMemberInput,RevokeInvitationInput,Pending} from './types';

export const ONBOARDING_REASONS = {
  signedOut:'Sign in to create or join a Workspace.',
  notConfigured:'Workspace onboarding is unavailable because the identity service is not configured.',
  storage:'Secure OS-backed storage is required to preserve onboarding drafts and safely reconcile requests.',
  verification:'Verify your email with your identity provider, then sign in again.',
  invitation:'This invitation is unavailable. Verify your email and sign in with the intended account, or ask the owner for a current invitation.',
  denied:'This membership change is unavailable. Refresh the team and check your current role. If your verified sign-in has expired, verify your email and sign in again.',
  conflict:'The team changed before this request. Reconcile, discard the unapplied request, and review the current team before confirming again.',
  uncertain:'The outcome is not confirmed. Reconcile before retrying; do not create a replacement request.',
  pending:'Finish or reconcile the existing request before starting another.',
  changed:'The signed-in identity changed. Return to onboarding with the intended account.',
  unavailable:'The service could not be reached. Your draft is preserved.',
  noPending:'There is no pending onboarding request.',
  discard:'This request may still complete. Only a definitively rejected request with no earlier uncertain attempt can be discarded. Reconcile or retry the same request.',
} as const;
const fail=<T>(reason:string):Result<T>=>({ok:false,reason});
interface Identity {principalId():string|null;generation():number;withAccess<T>(request:(access:string)=>Promise<T>):Promise<T|null>}
export class OnboardingService {
  private queue:Promise<unknown>=Promise.resolve();
  private activeGeneration:number|null=null;
  constructor(private readonly options:{identity:Identity;client:OnboardingClient|null;store:OnboardingStorage;onAuthorityChanged?:()=>void}) {}
  private exclusive<T>(work:()=>Promise<Result<T>>):Promise<Result<T>> {
    const caller=this.options.identity.principalId(),generation=this.options.identity.generation();
    const bound=async():Promise<Result<T>>=>{
      if(this.options.identity.principalId()!==caller || this.options.identity.generation()!==generation) return fail(ONBOARDING_REASONS.changed);
      this.activeGeneration=generation;
      try {return await work();} finally {this.activeGeneration=null;}
    };
    const next=this.queue.then(bound,bound);
    this.queue=next.catch(()=>undefined);return next;
  }
  private principal():string {
    if(!this.options.client) throw new Error(ONBOARDING_REASONS.notConfigured);
    const principal=this.options.identity.principalId();
    if(!principal) throw new Error(ONBOARDING_REASONS.signedOut);
    this.assert(principal);
    return principal;
  }
  private assert(principal:string) {if(this.options.identity.principalId()!==principal || this.options.identity.generation()!==this.activeGeneration) throw new Error(ONBOARDING_REASONS.changed);}
  private state(principal:string):RecordState {
    try {return this.options.store.load(principal);}catch {throw new Error(ONBOARDING_REASONS.storage);}
  }
  private save(principal:string,state:RecordState) {
    this.assert(principal);
    try {this.options.store.save(principal,state);}catch {throw new Error(ONBOARDING_REASONS.storage);}
  }
  private async access<T>(principal:string,work:(access:string)=>Promise<T>):Promise<T> {
    this.assert(principal);
    // Wrap null: the receipt endpoint's deliberate null differs from signed-out.
    const value=await this.options.identity.withAccess(async access=>{this.assert(principal);return {value:await work(access)};});
    this.assert(principal);
    if(value===null) throw new Error(ONBOARDING_REASONS.signedOut);
    return value.value;
  }
  private reason(error:unknown,kind?:Mutation['kind']):string {
    if(error instanceof ServiceError) {
      if(error.kind==='denied') return kind==='createWorkspace'?ONBOARDING_REASONS.verification:kind==='acceptInvitation'?ONBOARDING_REASONS.invitation:ONBOARDING_REASONS.denied;
      if(error.kind==='version_conflict') return ONBOARDING_REASONS.conflict;
      if(error.uncertain || error.kind==='protocol') return ONBOARDING_REASONS.uncertain;
      return ONBOARDING_REASONS.unavailable;
    }
    return error instanceof Error && Object.values(ONBOARDING_REASONS).some(v=>v===error.message)?error.message:ONBOARDING_REASONS.unavailable;
  }
  private pendingView(p:StoredPending|null):Pending|null {
    return p?{...mutation(p.kind,p.input),operationId:p.operationId,state:p.state,canDiscard:p.terminalRejection}:null;
  }
  private notifyAuthority(principal:string,pending:StoredPending):void {
    // Acceptance can upsert the caller's roles. Ordinary invitation/admin work
    // must not clear an unrelated still-authorized private conversation.
    const selfChange=pending.kind==='acceptInvitation'||((pending.kind==='changeRoles'||pending.kind==='removeMember')&&pending.input.principalId===principal);
    if(selfChange)try {this.options.onAuthorityChanged?.();}catch {/* Notification is not the committed result. */}
  }
  private validateReceipt(p:StoredPending,r:CommandResponse) {
    if(r.operation_id!==p.operationId) throw new ServiceError('protocol',true);
    if(p.kind==='revokeInvitation' && r.resource_id!==p.input.inviteId) throw new ServiceError('protocol',true);
    if(p.envelope.workspace_id && p.kind!=='invite' && p.kind!=='revokeInvitation' && r.resource_id!==('principalId' in p.input?p.input.principalId:'')) {
      // Membership commands use the affected principal as resource ID.
      throw new ServiceError('protocol',true);
    }
  }
  private async reconcileHeld(principal:string):Promise<Applied|null> {
    const state=this.state(principal),pending=state.pending;
    if(!pending) return null;
    this.save(principal,{...state,pending:{...pending,state:'uncertain'}});
    const receipt=await this.access(principal,access=>this.options.client!.receipt(access,pending.envelope));
    if(receipt) {
      this.validateReceipt(pending,receipt);
      this.save(principal,{...state,pending:null});
      this.notifyAuthority(principal,pending);
      return applied(receipt);
    }
    this.save(principal,{...state,pending:{...pending,state:'retryable'}});
    return null;
  }
  getState():Promise<Result<OnboardingState>> {return this.exclusive(async()=>{
    try {
      const principal=this.principal();let discoveryReason:string|null=null;
      const existing=this.state(principal);
      if(existing.pending) {
        try {await this.reconcileHeld(principal);}catch(error){discoveryReason=this.reason(error,existing.pending.kind);}
      }
      let invitations:OnboardingState['invitations']=[];
      try {
        const response=await this.access(principal,access=>this.options.client!.invitations(access));
        invitations=response.invitations.map(i=>({inviteId:i.invite_id,workspaceId:i.workspace_id,workspaceName:i.workspace_name,roles:[...i.roles],revision:i.revision,expiresAt:i.expires_at}));
      } catch(error) {discoveryReason=error instanceof ServiceError && error.kind==='denied'?ONBOARDING_REASONS.verification:this.reason(error);}
      this.assert(principal);
      const state=this.state(principal);
      return {ok:true,value:{invitations,pending:this.pendingView(state.pending),draft:{...state.draft},discoveryReason}};
    }catch(error){return fail(this.reason(error));}
  });}
  saveDraft(input:Draft):Promise<Result<Draft>> {return this.exclusive(async()=>{
    try {const principal=this.principal(),draft=draftInput(input,'');this.save(principal,{...this.state(principal),draft});return {ok:true,value:{...draft}};}catch(error){return fail(this.reason(error));}
  });}
  members(input:TeamInput):Promise<Result<Team>> {return this.exclusive(async()=>{
    try {
      const principal=this.principal(),{workspaceId,after}=teamInput(input,'');
      const members=await this.access(principal,a=>this.options.client!.members(a,workspaceId));
      const roles=await this.access(principal,a=>this.options.client!.roles(a,workspaceId));
      const deliveries=await this.access(principal,a=>this.options.client!.deliveries(a,workspaceId));
      const invitations=await this.access(principal,a=>this.options.client!.managedInvitations(a,workspaceId,after));
      if([members.workspace_id,roles.workspace_id,deliveries.workspace_id,invitations.workspace_id].some(id=>id!==workspaceId)) throw new ServiceError('protocol',true);
      return {ok:true,value:{workspaceId,invitations:invitations.invitations.map(i=>({inviteId:i.invite_id,revision:i.revision,state:i.state,expiresAt:i.expires_at,roles:[...i.roles],recipientEmail:i.recipient_email})),nextCursor:invitations.next_cursor,members:members.members.map(m=>({principalId:m.principal_id,displayName:m.display_name??'Workspace member',roles:[...m.roles],revision:m.revision})),roles:roles.roles.map(r=>({id:r.role_id,label:r.label})),deliveries:deliveries.deliveries.map(d=>({inviteId:d.invite_id,state:d.state}))}};
    }catch(error){return fail(this.reason(error));}
  });}
  private async send(principal:string,pending:StoredPending,knownUnapplied=false):Promise<Result<Applied>> {
    const state=this.state(principal);
    // Persist possibly-sent before any network write; a crash is never mistaken for not-sent.
    this.save(principal,{...state,pending:{...pending,state:'uncertain',terminalRejection:false}});
    try {
      const response=await this.access(principal,a=>this.options.client!.execute(a,pending.envelope));
      this.validateReceipt(pending,response);
      this.save(principal,{...this.state(principal),pending:null});
      this.notifyAuthority(principal,pending);
      return {ok:true,value:applied(response)};
    }catch(error){
      // Absence is NOT cancellation: a timed-out POST may still commit later.
      // Only a definitive rejection of a previously known-unapplied attempt permits discard.
      if(knownUnapplied && error instanceof ServiceError && error.status!==undefined && error.status>=400 && error.status<500 && ['denied','version_conflict','unauthenticated','unsupported_contract'].includes(error.kind)) {
        this.save(principal,{...this.state(principal),pending:{...pending,state:'retryable',terminalRejection:true}});
      }
      return fail(this.reason(error,pending.kind));
    }
  }
  private start(m:Mutation):Promise<Result<Applied>> {return this.exclusive(async()=>{
    try {
      const principal=this.principal(),state=this.state(principal);
      if(state.pending) return fail(ONBOARDING_REASONS.pending);
      const checked=mutation(m.kind,m.input);
      const capabilities=await this.options.client!.capabilities();this.assert(principal);
      if(capabilities.protocol_major!==PROTOCOL_MAJOR || capabilities.schema_version!==SCHEMA_VERSION) throw new ServiceError('unsupported_contract');
      const operationId=randomUUID();
      const pending:StoredPending={...checked,operationId,state:'prepared',terminalRejection:false,envelope:envelope(checked,operationId,capabilities.command_epoch)};
      const draft={...state.draft,...(checked.kind==='createWorkspace'?{name:checked.input.name}:checked.kind==='invite'?{email:checked.input.email,workspaceId:checked.input.workspaceId}:{})};
      this.save(principal,{draft,pending});
      return await this.send(principal,pending,true);
    }catch(error){return fail(this.reason(error,m.kind));}
  });}
  createWorkspace(input:CreateInput){return this.start({kind:'createWorkspace',input});}
  acceptInvitation(input:AcceptInput){return this.start({kind:'acceptInvitation',input});}
  invite(input:InviteInput){return this.start({kind:'invite',input});}
  changeRoles(input:ChangeRolesInput){return this.start({kind:'changeRoles',input});}
  removeMember(input:RemoveMemberInput){return this.start({kind:'removeMember',input});}
  revokeInvitation(input:RevokeInvitationInput){return this.start({kind:'revokeInvitation',input});}
  reconcile():Promise<Result<Applied|null>> {return this.exclusive(async()=>{
    try {const principal=this.principal();return {ok:true,value:await this.reconcileHeld(principal)};}catch(error){return fail(this.reason(error));}
  });}
  retry():Promise<Result<Applied>> {return this.exclusive(async()=>{
    try {
      const principal=this.principal();if(!this.state(principal).pending) return fail(ONBOARDING_REASONS.noPending);
      const receipt=await this.reconcileHeld(principal);
      if(receipt) return {ok:true,value:receipt};
      const pending=this.state(principal).pending;
      if(!pending || pending.state!=='retryable') return fail(ONBOARDING_REASONS.uncertain);
      return await this.send(principal,pending,pending.terminalRejection);
    }catch(error){return fail(this.reason(error));}
  });}
  discardPending():Promise<Result<null>> {return this.exclusive(async()=>{
    try {
      const principal=this.principal();
      if(!this.state(principal).pending) return {ok:true,value:null};
      if(!this.state(principal).pending!.terminalRejection) return fail(ONBOARDING_REASONS.discard);
      // This explicit action does a new receipt read; an old absence is insufficient.
      const receipt=await this.reconcileHeld(principal);
      if(receipt) return fail('The request was already applied. Refresh your Workspaces or team.');
      const state=this.state(principal);
      if(state.pending?.state!=='retryable' || !state.pending.terminalRejection) return fail(ONBOARDING_REASONS.discard);
      this.save(principal,{...state,pending:null});
      return {ok:true,value:null};
    }catch(error){return fail(this.reason(error));}
  });}
}
