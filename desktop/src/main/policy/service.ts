/**
 * The effective managed policy in the main process (Story 1.18).
 *
 * - **Workspace layer.** Main fetches the Workspace execution policy from the
 *   shared service (`GET /v1/workspaces/{id}/execution-policy`, members only)
 *   on every read, so a new policy revision or authorization epoch is picked
 *   up when a Task is opened or the policy is shown again. If the service
 *   cannot answer, nothing is computed: broader modes and thread settings are
 *   unavailable (fail closed).
 * - **Device and user layers.** The runtime reads its own managed
 *   requirements (`configRequirements/read`) and user configuration layer
 *   inside `inquello/policy/effective`, so a change on this device is picked
 *   up on the next read too.
 * - **Broader modes** are set per Task through `inquello/broadMode/set` as a
 *   `human` actor (the bound principal) with the reach the person confirmed.
 *   The runtime refuses a mode the effective policy does not permit and names
 *   the governing rule.
 * - **`effectiveThreadSettings(taskId)`** is the single source of a thread's
 *   sandbox and approval settings: derived only from the effective policy and
 *   the Task's broad mode. Story 1.25 starts threads only through it; no
 *   preload operation reaches it.
 * - **Tool profile (Story 1.19).** `effectiveThreadSettings` also creates the
 *   Task's private folder on first use and returns the Task's tool profile in
 *   the runtime's own form. `runTool(taskId, command)` is the only way a
 *   command runs for a Task (verification and the smoke in this story): it
 *   goes through `effectiveThreadSettings`, refuses to run when the local
 *   sandbox is unavailable on this device (never unsandboxed), runs through
 *   the runtime's `inquello/tools/exec`, and translates the runtime's own
 *   result into denials that name the boundary or destination.
 * - **Sandbox check.** Once per runtime process, a bounded probe command
 *   checks that a path outside the Task's profile (the working store's
 *   folder) is not visible. If it is visible, or the probe cannot run, the
 *   local sandbox is unavailable on this device and bounded commands are
 *   refused. The runtime builds the fixed probe itself
 *   (`sandboxProbeTarget`), so no command rule blocks it.
 * - **Permission to act (Story 1.20).** `inquello/tools/exec` applies the
 *   Workspace command rules and the person's own rules. A forbidden command
 *   is refused with its rule and source named. A command that asks waits on
 *   a pending request (`PermissionMediator`): only the person's "Run …"
 *   lets that exact command run, once, still inside the Task's profile; a
 *   denial, or no decision in time, runs nothing and the Task continues.
 */
import { RpcResponseError } from '../runtime/errors';
import type { Logger } from '../runtime/logger';
import { ServiceError } from '../identity/service-client';
import type { ExecutionPolicyView } from '../identity/wire';
import type { OrganiseIdentity, OrganiseRuntime, WorkspacesView } from '../organise';
import type { InquelloBroadModeReadResponse } from '../../protocol/generated/v2/InquelloBroadModeReadResponse';
import type { InquelloBroadModeSetResponse } from '../../protocol/generated/v2/InquelloBroadModeSetResponse';
import type { InquelloPolicyEffectiveResponse } from '../../protocol/generated/v2/InquelloPolicyEffectiveResponse';
import type { InquelloWorkspaceExecutionPolicy } from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import type { CommandExecResponse } from '../../protocol/generated/v2/CommandExecResponse';
import type { InquelloUserRulesReadResponse } from '../../protocol/generated/v2/InquelloUserRulesReadResponse';
import type { InquelloUserRulesSetResponse } from '../../protocol/generated/v2/InquelloUserRulesSetResponse';
import type { InquelloCommandEvaluation } from '../../protocol/generated/v2/InquelloCommandEvaluation';
import {
  ALLOWED_TEXT,
  DENIED_TEXT,
  EXPIRED_TEXT,
  NO_LONGER_PENDING,
  forbiddenText,
  ruleItemView,
  sourcedRuleView,
  reviewerView,
  type DecidePermissionInput,
  type PermissionCardView,
  type PermissionDecisionView,
  type PermissionMediator,
  type PermissionSettingsView,
  type RuleItemView,
  type SetUserRulesInput,
  type UserRulesView,
} from './permissions';
import { ensureTaskFolder, SANDBOX_UNAVAILABLE, translateDenials, type ToolDenial } from './tools';
import {
  BROAD_MODE_TITLE,
  DEFAULT_CAPABILITIES,
  ENVIRONMENT_LABEL,
  policyView,
  runtimeProfileView,
  taskPolicyView,
  unavailableReason,
  type BroadMode,
  type PolicyFailureCode,
  type PolicyResult,
  type EffectiveThreadSettings,
  type PolicyView,
  type SetBroadModeInput,
  type SettingsPolicyView,
  type SourceKind,
  type TaskPolicyView,
  type WorkspacePolicyEntry,
} from './views';

/** Fixed reasons; never a server message or a record value. */
export const POLICY_REASONS = {
  signedOut: 'Sign in to see the policy that governs your Tasks.',
  notConfigured: 'The shared service is not configured, so the Workspace policy cannot be read. Broader modes and runs are unavailable.',
  policyUnavailable: 'The Workspace policy could not be read from the shared service, so broader modes and runs are unavailable.',
  notAMember: 'You are not a member of this Workspace.',
  notFound: 'That Task is not available.',
  workspaceMismatch: 'That Task belongs to another Workspace.',
  conflict: 'The mode was changed first. Review the current mode and try again.',
  operationReused: 'This request was already used for different input. Start it again.',
  invalid: 'The request was not valid.',
  runtimeUnavailable: 'The local runtime is not running, so the policy cannot be computed right now.',
  storeUnavailable: 'Private work on this device could not be opened.',
  humanRequired: 'Only a person can choose a broader execution mode.',
  sandboxUnavailable: SANDBOX_UNAVAILABLE,
  noTaskFolders: 'Task folders are not set up on this device, so tools cannot run.',
  notPending: NO_LONGER_PENDING,
  userRuleCannotAllow: 'Your own rules can only ask first or forbid; they never allow a command.',
  rulesConflict: 'Your rules were changed first. Review them and try again.',
  failed: 'The request did not complete.',
} as const;

/** A tool run's outcome, main only (it holds the command's own output). */
export interface ToolRunView {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** The runtime's refusals translated; empty when nothing was blocked. */
  denials: ToolDenial[];
  /** The permission request the person allowed for this run, when its rules asked. */
  permissionRequestId: string | null;
}

/** The shared-service route the policy needs (Story 1.18). */
export interface ExecutionPolicyRoutes {
  executionPolicy(accessCredential: string, workspaceId: string): Promise<ExecutionPolicyView>;
}

/** What the policy service needs from the organise service. */
export interface PolicyOrganise {
  syncPrincipal(): Promise<void>;
  getWorkspaces(): Promise<WorkspacesView>;
}

export interface PolicyServiceOptions {
  runtime: OrganiseRuntime;
  identity: OrganiseIdentity;
  organise: PolicyOrganise;
  /** Absent when the shared service is not configured. */
  service: ExecutionPolicyRoutes | null;
  logger: Logger;
  /** Where Task folders live (`<userData>/tasks`); null when none may be created. */
  taskFolders: string | null;
  /** A path on this device that no Task profile reaches (the working store's folder), for the sandbox check. */
  sandboxProbeTarget: string | null;
  /** Pending permission requests and their decisions (Story 1.20). */
  permissions: PermissionMediator;
}

interface TaskContext {
  layer: InquelloWorkspaceExecutionPolicy;
  response: InquelloPolicyEffectiveResponse;
  folders: { working: string; output: string } | null;
}

const fail = <T>(code: PolicyFailureCode, reason: string, actualRevision?: number): PolicyResult<T> =>
  actualRevision === undefined ? { ok: false, code, reason } : { ok: false, code, reason, actualRevision };

interface Refusal {
  kind: string;
  actual?: number;
  rule?: SourceKind;
  revision?: number | null;
  evaluation?: InquelloCommandEvaluation;
}

function refusalOf(error: unknown): Refusal | null {
  if (!(error instanceof RpcResponseError)) return null;
  const data = (error.data as { inquello?: Record<string, unknown> } | null | undefined)?.inquello;
  if (!data || typeof data.kind !== 'string') return null;
  const refusal: Refusal = { kind: data.kind };
  if (typeof data.actual === 'number') refusal.actual = data.actual;
  if (typeof data.rule === 'string') refusal.rule = data.rule as SourceKind;
  if (typeof data.revision === 'number') refusal.revision = data.revision;
  if (typeof data.evaluation === 'object' && data.evaluation !== null) refusal.evaluation = data.evaluation as InquelloCommandEvaluation;
  return refusal;
}

/** The Workspace layer as the runtime takes it. */
function workspaceLayer(view: ExecutionPolicyView): InquelloWorkspaceExecutionPolicy {
  return {
    workspaceId: view.workspace_id,
    policyRevision: Number(view.policy_revision),
    authorizationEpoch: Number(view.authorization_epoch),
    execution: view.execution === null ? null : { ...view.execution },
  };
}

export class PolicyService {
  /** The sandbox check per runtime process. */
  private sandboxCheck: { runtime: unknown; available: Promise<boolean> } | null = null;

  constructor(private readonly options: PolicyServiceOptions) {}

  private async prepare(): Promise<PolicyResult<string>> {
    const principal = this.options.identity.principalId();
    if (!principal) return fail('signed-out', POLICY_REASONS.signedOut);
    if (!this.options.runtime.ready()) return fail('runtime-unavailable', POLICY_REASONS.runtimeUnavailable);
    try {
      await this.options.organise.syncPrincipal();
    } catch (error) {
      this.options.logger.warn(`policy: the principal could not be bound (${(error as Error).message})`);
      return fail('runtime-unavailable', POLICY_REASONS.runtimeUnavailable);
    }
    return { ok: true, value: principal };
  }

  private runtimeFailure<T>(error: unknown, mode?: BroadMode): PolicyResult<T> {
    const refusal = refusalOf(error);
    switch (refusal?.kind) {
      case 'unauthenticated':
        return fail('signed-out', POLICY_REASONS.signedOut);
      case 'not_found':
        return fail('not-found', POLICY_REASONS.notFound);
      case 'workspace_mismatch':
        return fail('workspace-mismatch', POLICY_REASONS.workspaceMismatch);
      case 'revision_conflict':
        return fail('conflict', POLICY_REASONS.conflict, refusal.actual);
      case 'operation_conflict':
        return fail('conflict', POLICY_REASONS.operationReused);
      case 'invalid':
        return fail('invalid', POLICY_REASONS.invalid);
      case 'human_actor_required':
        return fail('human-actor-required', POLICY_REASONS.humanRequired);
      case 'broad_mode_not_permitted': {
        const rule = refusal.rule ?? 'inquello_default';
        const broad = mode === 'no_prompt' || mode === 'full_access' ? mode : 'full_access';
        return fail('broad-mode-not-permitted', unavailableReason(broad, { kind: rule, revision: refusal.revision ?? null }));
      }
      case 'store_not_configured':
      case 'store_unavailable':
        return fail('failed', POLICY_REASONS.storeUnavailable);
      case 'command_forbidden':
        return fail('command-forbidden', forbiddenText(refusal.evaluation ?? null));
      case 'request_not_pending':
        return fail('not-pending', POLICY_REASONS.notPending);
      case 'user_rule_cannot_allow':
        return fail('user-rule-cannot-allow', POLICY_REASONS.userRuleCannotAllow);
      default:
        this.options.logger.warn(`policy: runtime request failed (${(error as Error).message})`);
        return fail(refusal ? 'failed' : 'runtime-unavailable', refusal ? POLICY_REASONS.failed : POLICY_REASONS.runtimeUnavailable);
    }
  }

  /** The Workspace layer from the shared service; fails closed. */
  private async workspacePolicy(workspaceId: string): Promise<PolicyResult<InquelloWorkspaceExecutionPolicy>> {
    const service = this.options.service;
    if (!service) return fail('policy-unavailable', POLICY_REASONS.notConfigured);
    try {
      const view = await this.options.identity.withAccess((access) => service.executionPolicy(access, workspaceId));
      if (!view) return fail('signed-out', POLICY_REASONS.signedOut);
      if (view.workspace_id !== workspaceId) return fail('policy-unavailable', POLICY_REASONS.policyUnavailable);
      return { ok: true, value: workspaceLayer(view) };
    } catch (error) {
      if (error instanceof ServiceError) {
        if (error.kind === 'unauthenticated') return fail('signed-out', POLICY_REASONS.signedOut);
        if (error.kind === 'denied') return fail('policy-unavailable', POLICY_REASONS.notAMember);
      } else {
        this.options.logger.warn(`policy: the Workspace policy could not be read (${(error as Error).message})`);
      }
      return fail('policy-unavailable', POLICY_REASONS.policyUnavailable);
    }
  }

  private async effective(workspacePolicy: InquelloWorkspaceExecutionPolicy, taskId: string | null, taskFolder: string | null = null): Promise<PolicyResult<InquelloPolicyEffectiveResponse>> {
    try {
      const params = taskFolder === null ? { workspacePolicy, taskId } : { workspacePolicy, taskId, taskFolder };
      return { ok: true, value: await this.options.runtime.request<InquelloPolicyEffectiveResponse>('inquello/policy/effective', params) };
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  /**
   * The Task's Workspace layer and effective policy, recomputed now. With
   * `withFolder`, the Task's folder is created on first use (only after the
   * runtime confirmed the caller created the Task) and the answer carries
   * the tool profile in the runtime's own form.
   */
  private async taskContext(taskId: string, withFolder: boolean): Promise<PolicyResult<TaskContext>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    const task = await this.taskWorkspace(taskId);
    if (!task.ok) return task;
    const layer = await this.workspacePolicy(task.value.workspaceId);
    if (!layer.ok) return layer;
    let folders: TaskContext['folders'] = null;
    if (withFolder) {
      if (!this.options.taskFolders) return fail('failed', POLICY_REASONS.noTaskFolders);
      try {
        folders = ensureTaskFolder(this.options.taskFolders, taskId);
      } catch (error) {
        this.options.logger.warn(`policy: the Task folder could not be created (${(error as Error).message})`);
        return fail('failed', POLICY_REASONS.failed);
      }
    }
    const response = await this.effective(layer.value, taskId, folders?.working ?? null);
    if (!response.ok) return response;
    if (!response.value.task) {
      this.options.logger.warn('policy: the runtime omitted the Task policy');
      return fail('failed', POLICY_REASONS.failed);
    }
    return { ok: true, value: { layer: layer.value, response: response.value, folders } };
  }

  /**
   * Whether the local sandbox applies on this device, checked once per
   * runtime process with a bounded probe through the Task's own profile: the
   * probe target must not be visible inside it. A probe that cannot run, or
   * sees the probe target, means the sandbox is unavailable.
   */
  private sandboxAvailable(context: TaskContext, taskId: string): Promise<boolean> {
    const runtime = this.options.runtime.instance();
    if (this.sandboxCheck && this.sandboxCheck.runtime === runtime) return this.sandboxCheck.available;
    const target = this.options.sandboxProbeTarget;
    const available = (async () => {
      if (!target || !context.folders) return false;
      try {
        const result = await this.options.runtime.request<CommandExecResponse>('inquello/tools/exec', {
          workspacePolicy: context.layer,
          taskId,
          taskFolder: context.folders.working,
          command: [],
          sandboxProbeTarget: target,
          timeoutMs: 20_000,
        });
        if (result.exitCode !== 0) this.options.logger.warn(`policy: the local sandbox check failed (exit ${result.exitCode})`);
        return result.exitCode === 0;
      } catch (error) {
        this.options.logger.warn(`policy: the local sandbox check could not run (${(error as Error).message})`);
        return false;
      }
    })();
    this.sandboxCheck = { runtime, available };
    return available;
  }

  /** One Workspace's effective policy on this device. */
  async forWorkspace(workspaceId: string): Promise<PolicyResult<PolicyView>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    const layer = await this.workspacePolicy(workspaceId);
    if (!layer.ok) return layer;
    const response = await this.effective(layer.value, null);
    if (!response.ok) return response;
    try {
      return { ok: true, value: policyView(response.value) };
    } catch (error) {
      this.options.logger.warn(`policy: the runtime answer was not understood (${(error as Error).message})`);
      return fail('failed', POLICY_REASONS.failed);
    }
  }

  /** S07: the effective policy of each of the principal's Workspaces, and the Capability Contract. */
  async settings(): Promise<SettingsPolicyView> {
    const base = { environmentLabel: ENVIRONMENT_LABEL, capabilities: [...DEFAULT_CAPABILITIES] };
    if (!this.options.identity.principalId()) return { ...base, signedIn: false, workspaces: [], reason: POLICY_REASONS.signedOut };
    const listing = await this.options.organise.getWorkspaces();
    if (!listing.signedIn) return { ...base, signedIn: false, workspaces: [], reason: POLICY_REASONS.signedOut };
    const workspaces: WorkspacePolicyEntry[] = [];
    let capabilities = base.capabilities;
    for (const workspace of listing.workspaces) {
      const result = await this.forWorkspace(workspace.workspaceId);
      if (result.ok) capabilities = result.value.capabilities;
      workspaces.push({ workspaceId: workspace.workspaceId, name: workspace.name, policy: result.ok ? result.value : null, reason: result.ok ? null : result.reason });
    }
    return { ...base, capabilities, signedIn: true, workspaces, reason: workspaces.length === 0 ? POLICY_REASONS.notAMember : null };
  }

  /** The Task's Workspace and recorded mode (creator only). */
  private async taskWorkspace(taskId: string): Promise<PolicyResult<InquelloBroadModeReadResponse>> {
    try {
      return { ok: true, value: await this.options.runtime.request<InquelloBroadModeReadResponse>('inquello/broadMode/read', { taskId }) };
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  /**
   * The Task's effective policy, broader mode, thread settings and tool
   * reach, recomputed now. A bounded Task also shows whether the local
   * sandbox applies on this device (the check creates the Task's folder).
   */
  async forTask(taskId: string): Promise<PolicyResult<TaskPolicyView>> {
    const context = await this.taskContext(taskId, this.options.taskFolders !== null);
    if (!context.ok) return context;
    const task = context.value.response.task!;
    try {
      const bounded = task.reach.bounded === true;
      const available = bounded ? await this.sandboxAvailable(context.value, taskId) : false;
      return { ok: true, value: taskPolicyView(context.value.response, task, available) };
    } catch (error) {
      this.options.logger.warn(`policy: the runtime answer was not understood (${(error as Error).message})`);
      return fail('failed', POLICY_REASONS.failed);
    }
  }

  /**
   * Sets the Task's broader mode as the signed-in person. The renderer's
   * confirmation is the reach statement it showed; the runtime checks it
   * against the mode and refuses a mode the policy does not permit.
   */
  async setBroadMode(input: SetBroadModeInput): Promise<PolicyResult<TaskPolicyView>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    const task = await this.taskWorkspace(input.taskId);
    if (!task.ok) return task;
    const layer = await this.workspacePolicy(task.value.workspaceId);
    if (!layer.ok) return layer;
    try {
      await this.options.runtime.request<InquelloBroadModeSetResponse>('inquello/broadMode/set', {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        taskId: input.taskId,
        mode: input.mode,
        confirmation: input.confirmation,
        actorKind: 'human',
        actorRef: null,
        workspacePolicy: layer.value,
      });
    } catch (error) {
      return this.runtimeFailure(error, input.mode);
    }
    this.options.logger.info(`policy: a Task's execution mode was set to ${BROAD_MODE_TITLE[input.mode]}`);
    return this.forTask(input.taskId);
  }

  /**
   * Main only: the sandbox and approval settings a thread of this Task gets
   * and the Task's tool profile in the runtime's own form, derived only from
   * the effective policy and the Task's broad mode. The Task's folder is
   * created on first use. Story 1.25 starts threads only through this; it
   * fails closed when the policy cannot be computed.
   */
  async effectiveThreadSettings(taskId: string): Promise<PolicyResult<EffectiveThreadSettings>> {
    const context = await this.taskContext(taskId, true);
    if (!context.ok) return context;
    return this.threadSettingsOf(context.value);
  }

  private threadSettingsOf(context: TaskContext): PolicyResult<EffectiveThreadSettings> {
    const task = context.response.task!;
    try {
      const view = taskPolicyView(context.response, task, false);
      return {
        ok: true,
        value: { ...view.threadSettings, profile: runtimeProfileView(task.runtimeProfile, view.reach.bounded), folders: context.folders!, reach: view.reach },
      };
    } catch (error) {
      this.options.logger.warn(`policy: the runtime answer was not understood (${(error as Error).message})`);
      return fail('failed', POLICY_REASONS.failed);
    }
  }

  /**
   * Main only: runs one command for the Task inside its tool profile, through
   * `effectiveThreadSettings` and the runtime's `inquello/tools/exec`. A
   * bounded command is refused when the local sandbox is unavailable on this
   * device; nothing ever runs unsandboxed except under a permitted Full
   * access mode. A denied command never ends the Task: later permitted
   * commands still run and earlier outputs stay.
   */
  async runTool(taskId: string, command: readonly string[], options: { timeoutMs?: number } = {}): Promise<PolicyResult<ToolRunView>> {
    if (command.length === 0 || command.some((part) => typeof part !== 'string')) return fail('invalid', POLICY_REASONS.invalid);
    const context = await this.taskContext(taskId, true);
    if (!context.ok) return context;
    const settings = this.threadSettingsOf(context.value);
    if (!settings.ok) return settings;
    const { reach, folders } = settings.value;
    if (reach.bounded && !(await this.sandboxAvailable(context.value, taskId))) return fail('sandbox-unavailable', POLICY_REASONS.sandboxUnavailable);
    const exec = (permissionRequestId: string | null) =>
      this.options.runtime.request<CommandExecResponse>('inquello/tools/exec', {
        workspacePolicy: context.value.layer,
        taskId,
        taskFolder: folders.working,
        command: [...command],
        timeoutMs: options.timeoutMs ?? 60_000,
        permissionRequestId,
      });
    let result: CommandExecResponse;
    let permissionRequestId: string | null = null;
    try {
      result = await exec(null);
    } catch (error) {
      if (refusalOf(error)?.kind !== 'permission_required') return this.runtimeFailure(error);
      // The rules ask: a pending request waits for the person (or declines by default).
      const asked = await this.options.permissions.ask({ workspacePolicy: context.value.layer, taskId, command, origin: 'tools_exec' });
      if (!asked.ok) return this.runtimeFailure(asked.error);
      if (asked.outcome !== 'allowed') {
        this.options.logger.info(`policy: a command was ${asked.outcome === 'expired' ? 'declined by default' : 'denied'}; nothing ran`);
        return fail('permission-denied', asked.outcome === 'expired' ? EXPIRED_TEXT : DENIED_TEXT);
      }
      permissionRequestId = asked.requestId;
      try {
        result = await exec(permissionRequestId);
      } catch (retry) {
        return this.runtimeFailure(retry);
      }
    }
    const run = { exitCode: Number(result.exitCode), stdout: String(result.stdout ?? ''), stderr: String(result.stderr ?? '') };
    return {
      ok: true,
      value: {
        ...run,
        denials: translateDenials(run, { working: folders.working, output: folders.output, bounded: reach.bounded, boundaries: reach.boundaries }),
        permissionRequestId,
      },
    };
  }

  // ---- permission to act (Story 1.20) ------------------------------------------------

  /** The open Task's pending requests as ApprovalCards (creator only). */
  async pendingPermissions(taskId: string): Promise<PolicyResult<PermissionCardView[]>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    try {
      return { ok: true, value: await this.options.permissions.pending(taskId) };
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  /**
   * Records the person's decision on one request. "Run …" allows that one
   * request; every other choice denies it, and "Deny and add a rule to always
   * ask" or "Deny and forbid this prefix" also records the person's own rule
   * (with its own receipt). A stale or expired request is "no longer pending".
   */
  async decidePermission(input: DecidePermissionInput): Promise<PolicyResult<PermissionDecisionView>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    const decided = await this.options.permissions.decide(input.requestId, input.choice === 'run' ? 'allowed' : 'denied', input.operationId);
    if (!decided.ok) return this.runtimeFailure(decided.error);
    if (decided.outcome === 'allowed') return { ok: true, value: { outcome: 'allowed', text: ALLOWED_TEXT, rule: null } };
    if (input.choice === 'deny') return { ok: true, value: { outcome: 'denied', text: DENIED_TEXT, rule: null } };
    const decision = input.choice === 'deny-ask' ? 'prompt' : 'forbid';
    const added = await this.addUserRule(decided.rulePrefix, decision, `${input.operationId}:rule`);
    if (!added.ok) return { ok: true, value: { outcome: 'denied', text: `${DENIED_TEXT} The rule was not added: ${added.reason}`, rule: null } };
    const rule = added.value;
    return {
      ok: true,
      value: { outcome: 'denied', text: `${DENIED_TEXT} Added your rule: \`${rule.prefixText}\` ${decision === 'prompt' ? 'always asks you first' : 'never runs'}.`, rule },
    };
  }

  /** Adds (or replaces) one of the person's own rules for `prefix`. */
  private async addUserRule(prefix: string[], decision: 'prompt' | 'forbid', operationId: string): Promise<PolicyResult<RuleItemView>> {
    let current: InquelloUserRulesReadResponse;
    try {
      current = await this.options.runtime.request<InquelloUserRulesReadResponse>('inquello/permissions/userRules/read', {});
    } catch (error) {
      return this.runtimeFailure(error);
    }
    const same = (rule: { prefix: string[] }) => rule.prefix.length === prefix.length && rule.prefix.every((token, index) => token === prefix[index]);
    const existing = current.rules.find(same);
    // Never loosen: an existing rule that already decides as strictly stays.
    if (existing && (existing.decision === decision || existing.decision === 'forbid')) return { ok: true, value: ruleItemView(existing, 'Your rule') };
    const rules = [...current.rules.filter((rule) => !same(rule)).map((rule) => ({ prefix: rule.prefix, decision: rule.decision, note: rule.note ?? null })), { prefix, decision, note: null }];
    try {
      const set = await this.options.runtime.request<InquelloUserRulesSetResponse>('inquello/permissions/userRules/set', { operationId, expectedRevision: Number(current.revision), rules });
      const added = set.rules.find(same);
      return added ? { ok: true, value: ruleItemView(added, 'Your rule') } : fail('failed', POLICY_REASONS.failed);
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  private async userRulesView(): Promise<PolicyResult<UserRulesView>> {
    try {
      const current = await this.options.runtime.request<InquelloUserRulesReadResponse>('inquello/permissions/userRules/read', {});
      return { ok: true, value: { revision: Number(current.revision), rules: current.rules.map((rule) => ruleItemView(rule, 'Your rule')) } };
    } catch (error) {
      return this.runtimeFailure(error);
    }
  }

  /** S07: each Workspace's command rules with their sources, the reviewer state, and the person's own rules. */
  async permissionSettings(): Promise<PermissionSettingsView> {
    if (!this.options.identity.principalId()) return { signedIn: false, userRules: null, workspaces: [], reason: POLICY_REASONS.signedOut };
    const listing = await this.options.organise.getWorkspaces();
    if (!listing.signedIn) return { signedIn: false, userRules: null, workspaces: [], reason: POLICY_REASONS.signedOut };
    const prepared = await this.prepare();
    if (!prepared.ok) return { signedIn: true, userRules: null, workspaces: [], reason: prepared.reason };
    const own = await this.userRulesView();
    const workspaces: PermissionSettingsView['workspaces'] = [];
    for (const workspace of listing.workspaces) {
      const layer = await this.workspacePolicy(workspace.workspaceId);
      const response = layer.ok ? await this.effective(layer.value, null) : layer;
      if (!response.ok) {
        workspaces.push({ workspaceId: workspace.workspaceId, name: workspace.name, rules: [], reviewer: null, reason: response.reason });
        continue;
      }
      try {
        workspaces.push({
          workspaceId: workspace.workspaceId,
          name: workspace.name,
          rules: response.value.commandRules.map(sourcedRuleView),
          reviewer: reviewerView(response.value.reviewer),
          reason: null,
        });
      } catch (error) {
        this.options.logger.warn(`policy: the runtime answer was not understood (${(error as Error).message})`);
        workspaces.push({ workspaceId: workspace.workspaceId, name: workspace.name, rules: [], reviewer: null, reason: POLICY_REASONS.failed });
      }
    }
    return { signedIn: true, userRules: own.ok ? own.value : null, workspaces, reason: own.ok ? null : own.reason };
  }

  /** Replaces the person's own rules at the revision they saw; the runtime refuses an allow rule. */
  async setUserRules(input: SetUserRulesInput): Promise<PolicyResult<PermissionSettingsView>> {
    const prepared = await this.prepare();
    if (!prepared.ok) return prepared;
    try {
      await this.options.runtime.request<InquelloUserRulesSetResponse>('inquello/permissions/userRules/set', {
        operationId: input.operationId,
        expectedRevision: input.expectedRevision,
        rules: input.rules,
      });
    } catch (error) {
      const refusal = refusalOf(error);
      if (refusal?.kind === 'revision_conflict') return fail('conflict', POLICY_REASONS.rulesConflict, refusal.actual);
      return this.runtimeFailure(error);
    }
    this.options.logger.info('policy: your command rules were changed');
    return { ok: true, value: await this.permissionSettings() };
  }
}
