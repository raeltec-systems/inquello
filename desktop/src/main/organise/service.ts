/**
 * Private Workspace organisation in the main process (Story 1.14).
 *
 * Main mediates every call: the renderer reaches this service only through the
 * named `organise.*` operations, and the service reaches the working store only
 * through the runtime's `inquello/*` methods. Nothing here gives the renderer
 * or an agent tool a write path to SQLite.
 *
 * - **Principal binding.** Before every runtime call the service makes sure
 *   the runtime connection is bound to the signed-in principal
 *   (`inquello/session/setPrincipal`), and rebinds after a sign-in change or a
 *   runtime restart. The principal comes from the identity session, never
 *   from a renderer payload.
 * - **Workspaces.** The shared service lists the principal's Workspaces;
 *   their names are remembered locally (`inquello/workspace/remember`) so that,
 *   while the service is down, private Tasks stay listable and openable under
 *   the remembered Workspaces.
 * - **Engagement creation** runs the Story 1.11 `create_engagement` command at
 *   the shared service first, then `inquello/engagement/create` with the
 *   returned service Engagement ID, both under the renderer's operation ID. A
 *   service failure creates nothing locally. A local failure after the service
 *   step is retried with the same operation ID: the service replays its
 *   receipt (same Engagement), so no duplicate is made.
 * - **Task states (Story 1.15)** are listed for the Task's creator only and
 *   recorded for the `task` and `run` dimensions only, with the actor kind
 *   `system` (this desktop) supplied here, never by the renderer.
 */
import { randomUUID } from 'node:crypto';

import { RpcResponseError } from '../runtime/errors';
import type { Logger } from '../runtime/logger';
import { ServiceError } from '../identity/service-client';
import { SCHEMA_VERSION, type AcceptInviteResponse, type Capabilities, type CommandResponse, type CreateEngagementEnvelope, type WorkspacesView as ServiceWorkspacesView } from '../identity/wire';
import type { InquelloEngagementResponse } from '../../protocol/generated/v2/InquelloEngagementResponse';
import type { InquelloFolderResponse } from '../../protocol/generated/v2/InquelloFolderResponse';
import type { InquelloStateListResponse } from '../../protocol/generated/v2/InquelloStateListResponse';
import type { InquelloStateRecordResponse } from '../../protocol/generated/v2/InquelloStateRecordResponse';
import type { InquelloTaskResponse } from '../../protocol/generated/v2/InquelloTaskResponse';
import type { InquelloWorkspaceListResponse } from '../../protocol/generated/v2/InquelloWorkspaceListResponse';
import type { InquelloWorkspaceTreeResponse } from '../../protocol/generated/v2/InquelloWorkspaceTreeResponse';
import {
  engagementView,
  folderView,
  taskView,
  type EngagementView,
  type FolderView,
  type OrganiseFailureCode,
  type OrganiseResult,
  type TaskView,
  type WorkspaceEntryView,
  type WorkspaceTreeView,
  type WorkspacesView,
} from './views';
import { DESKTOP_STATE_ACTOR, DESKTOP_STATE_DIMENSIONS, stateRecordView, taskStatesView, type RecordTaskStateInput, type StateRecordView, type TaskStatesView } from './states';

/** Every reason the renderer shows. Fixed text: never a server message or a record value. */
export const ORGANISE_REASONS = {
  signedOut: 'Sign in to see your Workspaces and private Tasks.',
  notConfigured: 'The shared service is not configured, so new Engagements cannot be created.',
  serviceDown: 'The shared service is unavailable, so new Engagements cannot be created. Your private Tasks stay available.',
  noWorkspace: 'Choose a Workspace first.',
  unknownWorkspace: 'That Workspace is not available to you.',
  serviceUnreachable: 'The shared service could not be reached. Nothing was created.',
  notAMember: 'You are not a member of this Workspace.',
  roleLacksAction: 'Your role in this Workspace does not allow creating Engagements.',
  serviceRefused: 'The shared service refused the request. Nothing was created.',
  incomplete: 'The Engagement was created on the shared service but not saved on this device. Try again to finish; it will not be created twice.',
  notFound: 'That item is not available.',
  workspaceMismatch: 'The target belongs to another Workspace.',
  conflict: 'Someone changed this first. Your draft is kept; review and try again.',
  operationReused: 'This request was already used for different input. Start it again.',
  invalid: 'Some of the details are not valid.',
  runtimeUnavailable: 'The local runtime is not running, so private work cannot be reached right now.',
  storeUnavailable: 'Private work on this device could not be opened.',
  humanActorRequired: 'Only a person can record this state.',
  dimensionNotEnabled: 'This state cannot be recorded yet.',
  invalidValue: 'That is not a state this item can have.',
  failed: 'The request did not complete.',
} as const;

/** What the service needs from the runtime (main's `AppServerRuntime`). */
export interface OrganiseRuntime {
  ready(): boolean;
  /** Changes whenever a new runtime process starts, so the binding is renewed. */
  instance(): unknown;
  request<T>(method: string, params?: unknown): Promise<T>;
}

/** What the service needs from the identity session. */
export interface OrganiseIdentity {
  principalId(): string | null;
  snapshot(): { sharedService: 'available' | 'unavailable' | 'not-configured' };
  withAccess<T>(request: (accessCredential: string) => Promise<T>): Promise<T | null>;
}

/** The shared-service routes the service uses (Story 1.11). */
export interface WorkspaceRoutes {
  capabilities(): Promise<Capabilities>;
  workspaces(accessCredential: string): Promise<ServiceWorkspacesView>;
  workspaceCommand(accessCredential: string, envelope: CreateEngagementEnvelope): Promise<CommandResponse>;
  acceptInvite(accessCredential: string, inviteId: string): Promise<AcceptInviteResponse>;
}

export interface OrganiseServiceOptions {
  runtime: OrganiseRuntime;
  identity: OrganiseIdentity;
  /** Absent when the shared service is not configured. */
  service: WorkspaceRoutes | null;
  logger: Logger;
}

export interface EngagementInput {
  operationId: string;
  workspaceId: string;
  name: string;
  objectives: string;
  scope: string;
  clientEntity: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface EngagementUpdateInput extends EngagementInput {
  engagementId: string;
  expectedRevision: number;
}

export interface FolderInput {
  operationId: string;
  workspaceId: string;
  engagementId: string;
  name: string;
}

export interface TaskInput {
  operationId: string;
  workspaceId: string;
  engagementId: string | null;
  folderId: string | null;
  title: string;
}

export interface TaskRenameInput {
  operationId: string;
  workspaceId: string;
  taskId: string;
  expectedRevision: number;
  title: string;
}

export interface TaskMoveInput {
  operationId: string;
  workspaceId: string;
  taskId: string;
  expectedRevision: number;
  engagementId: string | null;
  folderId: string | null;
}

export interface AttachThreadInput {
  operationId: string;
  workspaceId: string;
  taskId: string;
  expectedRevision: number;
  runtimeThreadId: string;
}

const fail = <T>(code: OrganiseFailureCode, reason: string, actualRevision?: number): OrganiseResult<T> =>
  actualRevision === undefined ? { ok: false, code, reason } : { ok: false, code, reason, actualRevision };

/** The `{ inquello: { kind, actual? } }` data of a runtime refusal. */
function refusalOf(error: unknown): { kind: string; actual?: number } | null {
  if (!(error instanceof RpcResponseError)) return null;
  const data = (error.data as { inquello?: { kind?: unknown; actual?: unknown } } | null | undefined)?.inquello;
  if (!data || typeof data.kind !== 'string') return null;
  return typeof data.actual === 'number' ? { kind: data.kind, actual: data.actual } : { kind: data.kind };
}

export class OrganiseService {
  private bound: { instance: unknown; principal: string | null } | null = null;
  /** Workspaces the principal may open, from the last listing. */
  private allowed: { principal: string; ids: Set<string> } | null = null;

  constructor(private readonly options: OrganiseServiceOptions) {}

  /** Binds the runtime connection to the current principal, if it changed. */
  async syncPrincipal(): Promise<void> {
    const { runtime, identity } = this.options;
    if (!runtime.ready()) return;
    const principal = identity.principalId();
    const instance = runtime.instance();
    if (this.bound && this.bound.instance === instance && this.bound.principal === principal) return;
    await runtime.request('inquello/session/setPrincipal', { principalId: principal });
    this.bound = { instance, principal };
    if (this.allowed && this.allowed.principal !== principal) this.allowed = null;
  }

  private async prepare(): Promise<OrganiseResult<string>> {
    const principal = this.options.identity.principalId();
    if (!principal) return fail('signed-out', ORGANISE_REASONS.signedOut);
    if (!this.options.runtime.ready()) return fail('runtime-unavailable', ORGANISE_REASONS.runtimeUnavailable);
    try {
      await this.syncPrincipal();
    } catch (error) {
      this.options.logger.warn(`organise: the principal could not be bound (${(error as Error).message})`);
      return fail('runtime-unavailable', ORGANISE_REASONS.runtimeUnavailable);
    }
    return { ok: true, value: principal };
  }

  private runtimeFailure<T>(error: unknown): OrganiseResult<T> {
    const refusal = refusalOf(error);
    switch (refusal?.kind) {
      case 'unauthenticated':
        this.bound = null;
        return fail('signed-out', ORGANISE_REASONS.signedOut);
      case 'not_found':
        return fail('not-found', ORGANISE_REASONS.notFound);
      case 'workspace_mismatch':
        return fail('workspace-mismatch', ORGANISE_REASONS.workspaceMismatch);
      case 'revision_conflict':
        return fail('conflict', ORGANISE_REASONS.conflict, refusal.actual);
      case 'operation_conflict':
        return fail('conflict', ORGANISE_REASONS.operationReused);
      case 'invalid':
        return fail('invalid', ORGANISE_REASONS.invalid);
      case 'human_actor_required':
        return fail('human-actor-required', ORGANISE_REASONS.humanActorRequired);
      case 'dimension_not_enabled':
        return fail('dimension-not-enabled', ORGANISE_REASONS.dimensionNotEnabled);
      case 'invalid_value':
        return fail('invalid-value', ORGANISE_REASONS.invalidValue);
      case 'store_not_configured':
      case 'store_unavailable':
        return fail('failed', ORGANISE_REASONS.storeUnavailable);
      default:
        this.options.logger.warn(`organise: runtime request failed (${(error as Error).message})`);
        return fail(refusal ? 'failed' : 'runtime-unavailable', refusal ? ORGANISE_REASONS.failed : ORGANISE_REASONS.runtimeUnavailable);
    }
  }

  private async call<R, T>(method: string, params: unknown, map: (response: R) => T): Promise<OrganiseResult<T>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    try {
      return { ok: true, value: map(await this.options.runtime.request<R>(method, params)) };
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  // ---- Workspaces ------------------------------------------------------------

  /**
   * The principal's Workspaces: from the shared service when it answers (and
   * remembered locally), otherwise the ones remembered on this device.
   */
  async getWorkspaces(): Promise<WorkspacesView> {
    const sharedConfigured = this.options.service !== null;
    const signedOut: WorkspacesView = {
      signedIn: false,
      sharedService: this.options.identity.snapshot().sharedService,
      workspaces: [],
      engagementCreation: { enabled: false, reason: ORGANISE_REASONS.signedOut },
    };
    const prepared = await this.prepare();
    if (!prepared.ok && prepared.code === 'signed-out') return signedOut;
    const principal = prepared.ok ? prepared.value : this.options.identity.principalId();

    let local: InquelloWorkspaceListResponse | null = null;
    if (prepared.ok) {
      try {
        local = await this.options.runtime.request<InquelloWorkspaceListResponse>('inquello/workspace/list', {});
      } catch (error) {
        this.options.logger.warn(`organise: local Workspaces could not be listed (${(error as Error).message})`);
      }
    }

    let fromService: ServiceWorkspacesView | null = null;
    if (sharedConfigured) {
      try {
        fromService = await this.options.identity.withAccess((access) => this.options.service!.workspaces(access));
      } catch (error) {
        if (!(error instanceof ServiceError)) throw error;
        fromService = null;
      }
    }

    let workspaces: WorkspaceEntryView[];
    let engagementCreation: WorkspacesView['engagementCreation'];
    let sharedService: WorkspacesView['sharedService'];
    if (fromService) {
      sharedService = 'available';
      workspaces = fromService.workspaces.map((workspace) => ({ workspaceId: workspace.workspace_id, name: workspace.name, source: 'service' as const }));
      engagementCreation = workspaces.length > 0 ? { enabled: true } : { enabled: false, reason: ORGANISE_REASONS.notAMember };
      if (local) await this.rememberLabels(fromService, local);
    } else {
      sharedService = sharedConfigured ? 'unavailable' : 'not-configured';
      workspaces = (local?.workspaces ?? []).map((workspace) => ({
        workspaceId: workspace.workspaceId,
        name: workspace.name ?? 'Workspace (name not yet known)',
        source: 'local' as const,
      }));
      engagementCreation = { enabled: false, reason: sharedConfigured ? ORGANISE_REASONS.serviceDown : ORGANISE_REASONS.notConfigured };
    }
    if (principal) this.allowed = { principal, ids: new Set(workspaces.map((workspace) => workspace.workspaceId)) };
    if (!prepared.ok && prepared.code === 'runtime-unavailable') engagementCreation = { enabled: false, reason: ORGANISE_REASONS.runtimeUnavailable };
    return { signedIn: true, sharedService, workspaces, engagementCreation };
  }

  private async rememberLabels(fromService: ServiceWorkspacesView, local: InquelloWorkspaceListResponse): Promise<void> {
    const known = new Map(local.workspaces.map((workspace) => [workspace.workspaceId, workspace]));
    for (const workspace of fromService.workspaces) {
      const current = known.get(workspace.workspace_id);
      if (current?.name === workspace.name) continue;
      try {
        await this.options.runtime.request('inquello/workspace/remember', {
          operationId: `remember-${randomUUID()}`,
          expectedRevision: current?.labelRevision ?? 0,
          workspaceId: workspace.workspace_id,
          name: workspace.name,
        });
      } catch (error) {
        this.options.logger.warn(`organise: a Workspace name could not be remembered (${(error as Error).message})`);
      }
    }
  }

  private workspaceAllowed(workspaceId: string): boolean {
    const principal = this.options.identity.principalId();
    return this.allowed !== null && this.allowed.principal === principal && this.allowed.ids.has(workspaceId);
  }

  /** One Workspace's Engagements, folders and the principal's own Tasks. */
  async getTree(workspaceId: string): Promise<OrganiseResult<WorkspaceTreeView>> {
    if (!this.workspaceAllowed(workspaceId)) {
      await this.getWorkspaces();
      if (!this.options.identity.principalId()) return fail('signed-out', ORGANISE_REASONS.signedOut);
      if (!this.workspaceAllowed(workspaceId)) return fail('not-found', ORGANISE_REASONS.unknownWorkspace);
    }
    return this.call<InquelloWorkspaceTreeResponse, WorkspaceTreeView>('inquello/workspace/tree', { workspaceId }, (response) => ({
      workspaceId: String(response.workspaceId),
      engagements: response.engagements.map(engagementView),
      folders: response.folders.map(folderView),
      tasks: response.tasks.map(taskView),
    }));
  }

  // ---- commands --------------------------------------------------------------

  /** Shared service first, then the local record, under one operation ID. */
  async createEngagement(input: EngagementInput): Promise<OrganiseResult<EngagementView>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    const service = this.options.service;
    if (!service) return fail('service-unavailable', ORGANISE_REASONS.notConfigured);
    if (!this.workspaceAllowed(input.workspaceId)) return fail('not-found', ORGANISE_REASONS.unknownWorkspace);

    let serviceEngagementId: string;
    try {
      const capabilities = await service.capabilities();
      const envelope: CreateEngagementEnvelope = {
        command_epoch: capabilities.command_epoch,
        operation_id: input.operationId,
        workspace_id: input.workspaceId,
        expected_revision: '0',
        schema_version: SCHEMA_VERSION,
        payload: { command: 'create_engagement', name: input.name.trim() },
      };
      const response = await this.options.identity.withAccess((access) => service.workspaceCommand(access, envelope));
      if (!response) return fail('signed-out', ORGANISE_REASONS.signedOut);
      serviceEngagementId = response.resource_id;
    } catch (error) {
      return this.serviceFailure(error);
    }

    const local = await this.call<InquelloEngagementResponse, EngagementView>(
      'inquello/engagement/create',
      {
        operationId: input.operationId,
        expectedRevision: 0,
        workspaceId: input.workspaceId,
        serviceEngagementId,
        name: input.name,
        objectives: input.objectives,
        scope: input.scope,
        clientEntity: input.clientEntity,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      (response) => engagementView(response.engagement),
    );
    if (!local.ok && (local.code === 'runtime-unavailable' || local.code === 'failed')) {
      this.options.logger.warn('organise: the service Engagement exists but the local record was not saved; a retry finishes it');
      return fail('incomplete', ORGANISE_REASONS.incomplete);
    }
    return local;
  }

  private serviceFailure<T>(error: unknown): OrganiseResult<T> {
    if (!(error instanceof ServiceError)) {
      this.options.logger.warn(`organise: Engagement creation failed (${(error as Error).message})`);
      return fail('failed', ORGANISE_REASONS.failed);
    }
    if (error.kind === 'transport' || error.kind === 'dependency_unavailable' || error.uncertain) {
      return fail('service-unavailable', ORGANISE_REASONS.serviceUnreachable);
    }
    if (error.kind === 'unauthenticated') return fail('signed-out', ORGANISE_REASONS.signedOut);
    if (error.kind === 'denied') {
      if (error.reason === 'not_a_member') return fail('not-permitted', ORGANISE_REASONS.notAMember);
      if (error.reason === 'role_lacks_action') return fail('not-permitted', ORGANISE_REASONS.roleLacksAction);
      return fail('not-permitted', ORGANISE_REASONS.serviceRefused);
    }
    if (error.kind === 'unsupported_contract' || error.kind === 'incomplete_material') return fail('invalid', ORGANISE_REASONS.invalid);
    return fail('conflict', ORGANISE_REASONS.serviceRefused);
  }

  async updateEngagement(input: EngagementUpdateInput): Promise<OrganiseResult<EngagementView>> {
    return this.call<InquelloEngagementResponse, EngagementView>(
      'inquello/engagement/update',
      {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        workspaceId: input.workspaceId,
        engagementId: input.engagementId,
        name: input.name,
        objectives: input.objectives,
        scope: input.scope,
        clientEntity: input.clientEntity,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      (response) => engagementView(response.engagement),
    );
  }

  async createFolder(input: FolderInput): Promise<OrganiseResult<FolderView>> {
    return this.call<InquelloFolderResponse, FolderView>(
      'inquello/folder/create',
      { operationId: input.operationId, expectedRevision: 0, workspaceId: input.workspaceId, engagementId: input.engagementId, name: input.name },
      (response) => folderView(response.folder),
    );
  }

  async createTask(input: TaskInput): Promise<OrganiseResult<TaskView>> {
    return this.call<InquelloTaskResponse, TaskView>(
      'inquello/task/create',
      {
        operationId: input.operationId,
        expectedRevision: 0,
        workspaceId: input.workspaceId,
        engagementId: input.engagementId,
        folderId: input.folderId,
        title: input.title,
      },
      (response) => taskView(response.task),
    );
  }

  async renameTask(input: TaskRenameInput): Promise<OrganiseResult<TaskView>> {
    return this.call<InquelloTaskResponse, TaskView>(
      'inquello/task/rename',
      { operationId: input.operationId, expectedRevision: input.expectedRevision, workspaceId: input.workspaceId, taskId: input.taskId, title: input.title },
      (response) => taskView(response.task),
    );
  }

  async moveTask(input: TaskMoveInput): Promise<OrganiseResult<TaskView>> {
    return this.call<InquelloTaskResponse, TaskView>(
      'inquello/task/move',
      {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        engagementId: input.engagementId,
        folderId: input.folderId,
      },
      (response) => taskView(response.task),
    );
  }

  // ---- Task states (Story 1.15) ----------------------------------------------

  /** Every state of one of the principal's Tasks; another creator's Task is `not-found`. */
  async listStates(taskId: string): Promise<OrganiseResult<TaskStatesView>> {
    return this.call<InquelloStateListResponse, TaskStatesView>('inquello/state/list', { taskId }, taskStatesView);
  }

  /**
   * Records a Task or run state as this desktop (actor kind `system`). A Task
   * state is scoped to the Task itself, a run state to its run reference.
   * Every other dimension is refused here, before the runtime is reached.
   */
  async recordTaskState(input: RecordTaskStateInput): Promise<OrganiseResult<StateRecordView>> {
    if (!(DESKTOP_STATE_DIMENSIONS as readonly string[]).includes(input.dimension)) return fail('dimension-not-enabled', ORGANISE_REASONS.dimensionNotEnabled);
    const scope = input.dimension === 'task' ? { scopeKind: 'task', scopeId: input.taskId } : { scopeKind: 'run', scopeId: input.runId };
    if (scope.scopeId === null) return fail('invalid', ORGANISE_REASONS.invalid);
    return this.call<InquelloStateRecordResponse, StateRecordView>(
      'inquello/state/record',
      {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
        dimension: input.dimension,
        scopeKind: scope.scopeKind,
        scopeId: scope.scopeId,
        value: input.value,
        actorKind: 'system',
        actorRef: DESKTOP_STATE_ACTOR,
      },
      (response) => stateRecordView(response.record),
    );
  }

  /** Main only: records a runtime thread on a Task. No preload operation reaches it. */
  async attachThread(input: AttachThreadInput): Promise<OrganiseResult<TaskView>> {
    return this.call<InquelloTaskResponse, TaskView>(
      'inquello/task/attachThread',
      {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        workspaceId: input.workspaceId,
        taskId: input.taskId,
        runtimeThreadId: input.runtimeThreadId,
      },
      (response) => taskView(response.task),
    );
  }
}
