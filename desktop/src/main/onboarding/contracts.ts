import { object, str, uuid, decimal, array, nullable, oneOf, parseCommandResponse, parseRolesView, parseCapabilities, SCHEMA_VERSION, type CommandResponse } from '../identity/wire';
import { DELIVERY_STATES, type Mutation, type Draft } from './types';
export { parseCommandResponse, parseRolesView, parseCapabilities };
export const bounded = (max: number, nonempty = true) => (v: unknown, p: string): string => {
  const s = str(v,p);
  if (s.length > max || (nonempty && !s.trim()) || /[\u0000-\u001f\u007f]/.test(s)) throw new Error('Invalid bounded text');
  return s;
};
export const roleList = (v: unknown, p: string): string[] => {
  // Bound before mapping; reject sparse, subclassed or decorated IPC arrays.
  if(!Array.isArray(v) || Object.getPrototypeOf(v)!==Array.prototype || v.length<1 || v.length>32 || Reflect.ownKeys(v).length!==v.length+1) throw new Error('Invalid roles');
  for(let i=0;i<v.length;i++) if(!Object.hasOwn(v,i)) throw new Error('Invalid roles');
  const roles = array(bounded(128))(v,p);
  if (new Set(roles).size !== roles.length) throw new Error('Invalid roles');
  return roles;
};
const list = <T>(parser: (v: unknown,p: string)=>T, max: number) => (v:unknown,p:string):T[] => {
  if (!Array.isArray(v) || v.length > max) throw new Error('Invalid list');
  return array(parser)(v,p);
};
export const createInput = object({name:bounded(200)});
export const acceptInput = object({inviteId:uuid,expectedRevision:decimal});
export const workspaceInput = object({workspaceId:uuid});
export const inviteInput = object({workspaceId:uuid,email:bounded(254),roles:roleList});
export const changeInput = object({workspaceId:uuid,principalId:uuid,expectedRevision:decimal,roles:roleList});
export const removeInput = object({workspaceId:uuid,principalId:uuid,expectedRevision:decimal});
export const revokeInput = object({workspaceId:uuid,inviteId:uuid,expectedRevision:decimal});
export const draftInput = object({name:bounded(200,false),email:bounded(254,false),workspaceId:(v:unknown,p:string)=>v===''?'':uuid(v,p)});
export const emptyDraft = (): Draft => ({name:'',email:'',workspaceId:''});
const timestamp = (v:unknown,p:string):string => {
  const text=bounded(64)(v,p);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(text) || !Number.isFinite(Date.parse(text))) throw new Error('Invalid timestamp');
  return text;
};
export const parseInvitations = object({invitations:list(object({invite_id:uuid,workspace_id:uuid,workspace_name:bounded(200),roles:roleList,revision:decimal,expires_at:timestamp}),100)});
export const parseMembers = object({workspace_id:uuid,members:list(object({principal_id:uuid,display_name:nullable(bounded(200,false)),roles:roleList,revision:decimal}),10000)});
export const parseDeliveries = object({workspace_id:uuid,deliveries:list(object({invite_id:uuid,state:oneOf(DELIVERY_STATES)}),1000)});
export type Envelope = {command_epoch:string;operation_id:string;expected_revision:string;schema_version:number;workspace_id?:string;payload:Record<string,unknown>};
export function mutation(kind: unknown, input: unknown): Mutation {
  switch (kind) {
    case 'createWorkspace': return {kind,input:createInput(input,'input')};
    case 'acceptInvitation': return {kind,input:acceptInput(input,'input')};
    case 'invite': return {kind,input:inviteInput(input,'input')};
    case 'changeRoles': return {kind,input:changeInput(input,'input')};
    case 'removeMember': return {kind,input:removeInput(input,'input')};
    case 'revokeInvitation': return {kind,input:revokeInput(input,'input')};
    default: throw new Error('Invalid onboarding operation');
  }
}
export function envelope(m:Mutation, operationId:string, epoch:string):Envelope {
  const base = {command_epoch:decimal(epoch,''),operation_id:uuid(operationId,''),schema_version:SCHEMA_VERSION,expected_revision:'0'};
  switch(m.kind) {
    case 'createWorkspace': return {...base,payload:{command:'create_workspace',name:m.input.name}};
    case 'acceptInvitation': return {...base,expected_revision:m.input.expectedRevision,payload:{command:'accept_invitation',invite_id:m.input.inviteId}};
    case 'invite': return {...base,workspace_id:m.input.workspaceId,payload:{command:'issue_email_invite',email:m.input.email,roles:m.input.roles}};
    case 'changeRoles': return {...base,workspace_id:m.input.workspaceId,expected_revision:m.input.expectedRevision,payload:{command:'change_roles',principal_id:m.input.principalId,roles:m.input.roles}};
    case 'removeMember': return {...base,workspace_id:m.input.workspaceId,expected_revision:m.input.expectedRevision,payload:{command:'remove_member',principal_id:m.input.principalId}};
    case 'revokeInvitation': return {...base,workspace_id:m.input.workspaceId,expected_revision:m.input.expectedRevision,payload:{command:'revoke_invite',invite_id:m.input.inviteId}};
  }
}
export function payload<T>(parse:(v:unknown,p:string)=>T):(args:readonly unknown[])=>T {
  return args => {
    if(args.length!==1 || !args[0] || typeof args[0]!=='object' || Array.isArray(args[0]) || ![Object.prototype,null].includes(Object.getPrototypeOf(args[0]))) throw new Error('Invalid onboarding payload');
    return parse(args[0],'');
  };
}
export function applied(r:CommandResponse) { return {resourceId:r.resource_id,revision:r.revision,authorizationEpoch:r.authorization_epoch}; }
