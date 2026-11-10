import type {OnboardingState,Team,Draft,Pending,Mutation,Applied,Result,CreateInput,AcceptInput,InviteInput,ChangeRolesInput,RemoveMemberInput,RevokeInvitationInput,TeamInput,DeliveryState} from '../main/onboarding/types';
export type {OnboardingState,Team,Draft,Pending,Applied,Result};
export interface OnboardingBridge {
 getState():Promise<unknown>;saveDraft(input:Draft):Promise<unknown>;members(input:TeamInput):Promise<unknown>;
 createWorkspace(input:CreateInput):Promise<unknown>;acceptInvitation(input:AcceptInput):Promise<unknown>;invite(input:InviteInput):Promise<unknown>;changeRoles(input:ChangeRolesInput):Promise<unknown>;removeMember(input:RemoveMemberInput):Promise<unknown>;revokeInvitation(input:RevokeInvitationInput):Promise<unknown>;reconcile():Promise<unknown>;retry():Promise<unknown>;discardPending():Promise<unknown>;
}
export const onboardingBridge=():OnboardingBridge|null=>(globalThis as {inquello?:{onboarding?:OnboardingBridge}}).inquello?.onboarding??null;
function obj(v:unknown,keys:string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw Error('view');const r=v as Record<string,unknown>;if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error('fields');return r;}
function text(v:unknown,max=200,empty=false):string{if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\u0000-\u001f\u007f]/.test(v))throw Error('text');return v;}
function id(v:unknown):string{const s=text(v,36);if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s))throw Error('id');return s;}
function rev(v:unknown):string{const s=text(v,20);if(!/^(0|[1-9][0-9]*)$/.test(s)||BigInt(s)>18446744073709551615n)throw Error('revision');return s;}
function bool(v:unknown):boolean{if(typeof v!=='boolean')throw Error('flag');return v;}
function list<T>(v:unknown,p:(x:unknown)=>T,max:number):T[]{if(!Array.isArray(v)||v.length>max||Reflect.ownKeys(v).length!==v.length+1)throw Error('list');return Array.from(v,p);}
function roles(v:unknown):string[]{const r=list(v,x=>text(x,128),32);if(!r.length||new Set(r).size!==r.length)throw Error('roles');return r;}
function one<T extends string>(v:unknown,values:readonly T[]):T{if(typeof v!=='string'||!values.includes(v as T))throw Error('enum');return v as T;}
function date(v:unknown):string{const s=text(v,64);if(!/^\d{4}-\d{2}-\d{2}T/.test(s)||!Number.isFinite(Date.parse(s)))throw Error('time');return s;}
function nullable<T>(v:unknown,p:(x:unknown)=>T):T|null{return v===null?null:p(v);}
function draft(v:unknown):Draft{const r=obj(v,['name','email','workspaceId']);return {name:text(r.name,200,true),email:text(r.email,254,true),workspaceId:r.workspaceId===''?'':id(r.workspaceId)};}
function mutation(kind:unknown,v:unknown):Mutation{
 switch(kind){
 case 'createWorkspace':{const r=obj(v,['name']);return {kind,input:{name:text(r.name)}};}
 case 'acceptInvitation':{const r=obj(v,['inviteId','expectedRevision']);return {kind,input:{inviteId:id(r.inviteId),expectedRevision:rev(r.expectedRevision)}};}
 case 'invite':{const r=obj(v,['workspaceId','email','roles']);return {kind,input:{workspaceId:id(r.workspaceId),email:text(r.email,254),roles:roles(r.roles)}};}
 case 'changeRoles':{const r=obj(v,['workspaceId','principalId','expectedRevision','roles']);return {kind,input:{workspaceId:id(r.workspaceId),principalId:id(r.principalId),expectedRevision:rev(r.expectedRevision),roles:roles(r.roles)}};}
 case 'removeMember':{const r=obj(v,['workspaceId','principalId','expectedRevision']);return {kind,input:{workspaceId:id(r.workspaceId),principalId:id(r.principalId),expectedRevision:rev(r.expectedRevision)}};}
 case 'revokeInvitation':{const r=obj(v,['workspaceId','inviteId','expectedRevision']);return {kind,input:{workspaceId:id(r.workspaceId),inviteId:id(r.inviteId),expectedRevision:rev(r.expectedRevision)}};}
 default:throw Error('operation');
 }
}
function pending(v:unknown):Pending{const r=obj(v,['kind','input','operationId','state','canDiscard']);return {...mutation(r.kind,r.input),operationId:id(r.operationId),state:one(r.state,['prepared','retryable','uncertain']),canDiscard:bool(r.canDiscard)};}
function applied(v:unknown):Applied{const r=obj(v,['resourceId','revision','authorizationEpoch']);return {resourceId:id(r.resourceId),revision:rev(r.revision),authorizationEpoch:nullable(r.authorizationEpoch,rev)};}
const deliveryStates=['not_configured','pending','sending','provider_accepted','retry_pending','manual_reconciliation_required','cancelled','failed'] as const;
function state(v:unknown):OnboardingState{const r=obj(v,['invitations','pending','draft','discoveryReason']);return {draft:draft(r.draft),pending:nullable(r.pending,pending),discoveryReason:nullable(r.discoveryReason,x=>text(x,1024)),invitations:list(r.invitations,x=>{const i=obj(x,['inviteId','workspaceId','workspaceName','roles','revision','expiresAt']);return {inviteId:id(i.inviteId),workspaceId:id(i.workspaceId),workspaceName:text(i.workspaceName),roles:roles(i.roles),revision:rev(i.revision),expiresAt:date(i.expiresAt)};},100)};}
function team(v:unknown):Team{const r=obj(v,['workspaceId','members','roles','deliveries','invitations','nextCursor']);return {workspaceId:id(r.workspaceId),nextCursor:nullable(r.nextCursor,id),
 members:list(r.members,x=>{const i=obj(x,['principalId','displayName','roles','revision']);return {principalId:id(i.principalId),displayName:text(i.displayName,200,true),roles:roles(i.roles),revision:rev(i.revision)};},10000),
 roles:list(r.roles,x=>{const i=obj(x,['id','label']);return {id:text(i.id,128),label:text(i.label)};},128),
 deliveries:list(r.deliveries,x=>{const i=obj(x,['inviteId','state']);return {inviteId:id(i.inviteId),state:one(i.state,deliveryStates)};},1000),
 invitations:list(r.invitations,x=>{const i=obj(x,['inviteId','revision','state','expiresAt','roles','recipientEmail']);return {inviteId:id(i.inviteId),revision:rev(i.revision),state:one(i.state,['pending','accepted','revoked','expired']),expiresAt:date(i.expiresAt),roles:roles(i.roles),recipientEmail:text(i.recipientEmail,254)};},25)};}
function result<T>(v:unknown,p:(x:unknown)=>T):Result<T>|null{try{const ok=(v as {ok?:unknown})?.ok;if(ok===false){const r=obj(v,['ok','reason']);return {ok:false,reason:text(r.reason,1024)};}const r=obj(v,['ok','value']);if(r.ok!==true)return null;return {ok:true,value:p(r.value)};}catch{return null;}}
export const readState=(v:unknown)=>result(v,state),readTeam=(v:unknown)=>result(v,team),readDraft=(v:unknown)=>result(v,draft),readAction=(v:unknown)=>result(v,x=>nullable(x,applied));
export const DELIVERY_TEXT:Record<DeliveryState,string>={
 not_configured:'Email delivery is not configured. The invitation is available in-app after the recipient signs in.',
 pending:'Email is queued; provider acceptance is not yet confirmed.',
 sending:'The provider request is in progress; acceptance is not yet confirmed.',
 provider_accepted:'The email provider accepted the message. Inbox delivery is not confirmed.',
 retry_pending:'The provider outcome is unconfirmed. A safe retry is pending.',
 manual_reconciliation_required:'Delivery needs operator reconciliation; no automatic resend will occur.',
 cancelled:'Email delivery was cancelled. Refresh invitation status before taking action.',
 failed:'Email delivery failed. No delivery success is claimed.',
};
