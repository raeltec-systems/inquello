/** Renderer-safe contracts. Tokens and service envelopes never cross IPC. */
export interface Draft { name: string; email: string; workspaceId: string }
export interface Invitation { inviteId: string; workspaceId: string; workspaceName: string; roles: string[]; revision: string; expiresAt: string }
export interface Member { principalId: string; displayName: string; roles: string[]; revision: string }
export const DELIVERY_STATES = ['not_configured','pending','sending','provider_accepted','retry_pending','manual_reconciliation_required','cancelled','failed'] as const;
export type DeliveryState = typeof DELIVERY_STATES[number];
export interface ManagedInvitation { inviteId:string; revision:string; state:'pending'|'accepted'|'revoked'|'expired'; expiresAt:string; roles:string[]; recipientEmail:string }
export interface TeamInput { workspaceId:string; after?:string }
export interface Team { invitations:ManagedInvitation[]; nextCursor:string|null; workspaceId: string; members: Member[]; roles: {id: string; label: string}[]; deliveries: {inviteId: string; state: DeliveryState}[] }
export interface CreateInput { name: string }
export interface AcceptInput { inviteId: string; expectedRevision: string }
export interface InviteInput { workspaceId: string; email: string; roles: string[] }
export interface ChangeRolesInput { workspaceId: string; principalId: string; expectedRevision: string; roles: string[] }
export interface RemoveMemberInput { workspaceId: string; principalId: string; expectedRevision: string }
export interface RevokeInvitationInput { workspaceId: string; inviteId: string; expectedRevision: string }
export type Mutation =
  | {kind: 'createWorkspace'; input: CreateInput}
  | {kind: 'acceptInvitation'; input: AcceptInput}
  | {kind: 'invite'; input: InviteInput}
  | {kind: 'changeRoles'; input: ChangeRolesInput}
  | {kind: 'removeMember'; input: RemoveMemberInput}
  | {kind: 'revokeInvitation'; input: RevokeInvitationInput};
export type Pending = Mutation & {operationId: string; state: 'uncertain' | 'retryable' | 'prepared'; canDiscard: boolean};
export interface OnboardingState { invitations: Invitation[]; pending: Pending | null; draft: Draft; discoveryReason: string | null }
export interface Applied { resourceId: string; revision: string; authorizationEpoch: string | null }
export type Result<T> = {ok: true; value: T} | {ok: false; reason: string};
