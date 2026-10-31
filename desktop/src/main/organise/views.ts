/**
 * What the renderer sees of private Workspace organisation (Story 1.14).
 *
 * Every view is rebuilt field by field from the runtime's `inquello/*`
 * answers, so nothing beyond these shapes crosses into the renderer. No view
 * holds a credential, a grant or a share control: every Task is private.
 */
import type { InquelloEngagement } from '../../protocol/generated/v2/InquelloEngagement';
import type { InquelloFolder } from '../../protocol/generated/v2/InquelloFolder';
import type { InquelloTask } from '../../protocol/generated/v2/InquelloTask';

export interface EngagementView {
  engagementId: string;
  workspaceId: string;
  serviceEngagementId: string;
  name: string;
  objectives: string;
  scope: string;
  clientEntity: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  revision: number;
}

export interface FolderView {
  folderId: string;
  engagementId: string;
  workspaceId: string;
  name: string;
  revision: number;
}

export interface TaskView {
  taskId: string;
  workspaceId: string;
  engagementId: string | null;
  folderId: string | null;
  title: string;
  /** Null until a runtime thread is attached (Story 1.25 and later). */
  runtimeThreadId: string | null;
  sourceRefs: string[];
  artifactRefs: string[];
  visibility: 'private';
  revision: number;
}

export interface WorkspaceTreeView {
  unavailableTasks?:Array<{taskId:string;reason:'current_authority_unavailable'}>;
  workspaceId: string;
  engagements: EngagementView[];
  folders: FolderView[];
  /** Only the signed-in principal's own Tasks. */
  tasks: TaskView[];
}

export interface WorkspaceEntryView {
  workspaceId: string;
  name: string;
  /** `service`: listed by the shared service now; `local`: remembered on this device. */
  source: 'service' | 'local';
}

export interface WorkspacesView {
  signedIn: boolean;
  sharedService: 'available' | 'unavailable' | 'not-configured';
  workspaces: WorkspaceEntryView[];
  /** Engagement creation needs the shared service; when disabled, `reason` says why. */
  engagementCreation: { enabled: boolean; reason?: string };
}

export type OrganiseFailureCode =
  | 'signed-out'
  | 'service-unavailable'
  | 'not-permitted'
  | 'not-found'
  | 'workspace-mismatch'
  | 'conflict'
  | 'invalid'
  | 'runtime-unavailable'
  | 'incomplete'
  | 'human-actor-required'
  | 'dimension-not-enabled'
  | 'invalid-value'
  | 'failed';

export type OrganiseResult<T> = { ok: true; value: T } | { ok: false; code: OrganiseFailureCode; reason: string; actualRevision?: number };

export function engagementView(value: InquelloEngagement): EngagementView {
  return {
    engagementId: String(value.engagementId),
    workspaceId: String(value.workspaceId),
    serviceEngagementId: String(value.serviceEngagementId),
    name: String(value.name),
    objectives: String(value.objectives),
    scope: String(value.scope),
    clientEntity: value.clientEntity === null ? null : String(value.clientEntity),
    periodStart: value.periodStart === null ? null : String(value.periodStart),
    periodEnd: value.periodEnd === null ? null : String(value.periodEnd),
    revision: Number(value.revision),
  };
}

export function folderView(value: InquelloFolder): FolderView {
  return {
    folderId: String(value.folderId),
    engagementId: String(value.engagementId),
    workspaceId: String(value.workspaceId),
    name: String(value.name),
    revision: Number(value.revision),
  };
}

export function taskView(value: InquelloTask): TaskView {
  return {
    taskId: String(value.taskId),
    workspaceId: String(value.workspaceId),
    engagementId: value.engagementId === null ? null : String(value.engagementId),
    folderId: value.folderId === null ? null : String(value.folderId),
    title: String(value.title),
    runtimeThreadId: value.runtimeThreadId === null ? null : String(value.runtimeThreadId),
    sourceRefs: value.sourceRefs.map(String),
    artifactRefs: value.artifactRefs.map(String),
    visibility: 'private',
    revision: Number(value.revision),
  };
}
