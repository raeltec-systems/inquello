/**
 * Permission to act (Story 1.20), in the main process.
 *
 * - **Mediation.** `PermissionMediator.ask` records a pending request through
 *   the runtime's `inquello/permissions/request` (which evaluates the command
 *   against the Workspace command rules and the person's own rules) and waits
 *   for its decision. `decide` records a person's decision through
 *   `inquello/permissions/decide` and wakes the waiter. A request no one
 *   decides in time is declined by default: main records it `expired` as the
 *   host, and nothing runs. The same path serves model-originated requests in
 *   Story 1.25 (`origin: 'runtime'`).
 * - **Cards.** Each pending request is shown as an ApprovalCard labelled
 *   "Permission to act": the exact command quoted, its destination and
 *   consequences, the controlling rule, a primary button that names the
 *   action ("Run `git push origin main`") and only the permitted
 *   alternatives (Deny; Deny and add a rule to always ask; Deny and forbid
 *   this prefix). There is no "always allow" and never a bare "Approve".
 * - **Rules.** A person's own rules only ask or forbid; the runtime refuses
 *   an allow rule (`user_rule_cannot_allow`). Every rule shown names its
 *   source: the Workspace policy at its revision, or "Your rule".
 * - A permission decision is never a review or approval state: nothing here
 *   records a Task state.
 */
import type { InquelloCommandEvaluation } from '../../protocol/generated/v2/InquelloCommandEvaluation';
import type { InquelloCommandRule } from '../../protocol/generated/v2/InquelloCommandRule';
import type { InquelloCommandRuleView } from '../../protocol/generated/v2/InquelloCommandRuleView';
import type { InquelloPermissionRequest } from '../../protocol/generated/v2/InquelloPermissionRequest';
import type { InquelloPermissionReviewer } from '../../protocol/generated/v2/InquelloPermissionReviewer';
import type { InquelloPermissionsDecideResponse } from '../../protocol/generated/v2/InquelloPermissionsDecideResponse';
import type { InquelloPermissionsPendingResponse } from '../../protocol/generated/v2/InquelloPermissionsPendingResponse';
import type { InquelloPermissionsRequestResponse } from '../../protocol/generated/v2/InquelloPermissionsRequestResponse';
import type { InquelloWorkspaceExecutionPolicy } from '../../protocol/generated/v2/InquelloWorkspaceExecutionPolicy';
import type { Logger } from '../runtime/logger';
import { OperationError, type PayloadValidator } from '../security/operations';

export const PERMISSION_LABEL = 'Permission to act';
export const NO_LONGER_PENDING = 'This request is no longer pending';
export const DENIED_TEXT = 'Denied: nothing ran.';
export const ALLOWED_TEXT = "Allowed for this one request. It runs inside this Task's sandbox.";
export const EXPIRED_TEXT = 'Not run: no one decided in time, so the request was declined.';
/** How long a request waits for a decision before it is declined. */
export const DEFAULT_REQUEST_TTL_MS = 10 * 60_000;
/** The host reference recorded for a decline-by-default. */
export const HOST_ACTOR_REF = 'inquello-desktop';

export const PERMISSION_CHOICES = ['run', 'deny', 'deny-ask', 'deny-forbid'] as const;
export type PermissionChoice = (typeof PERMISSION_CHOICES)[number];
export const RULE_DECISIONS = ['allow', 'prompt', 'forbid'] as const;
export type RuleDecision = (typeof RULE_DECISIONS)[number];

/** The permitted alternatives, never wider than the request. */
export const ALTERNATIVE_LABEL: Record<Exclude<PermissionChoice, 'run'>, string> = {
  deny: 'Deny',
  'deny-ask': 'Deny and add a rule to always ask',
  'deny-forbid': 'Deny and forbid this prefix',
};

export const DECISION_LABEL: Record<RuleDecision, string> = {
  allow: 'Runs without asking, inside the sandbox',
  prompt: 'Asks you first',
  forbid: 'Never runs',
};

/** The longest command shown inside a button label. */
const LABEL_COMMAND_CHARS = 160;

/** One pending request as an ApprovalCard shows it; no device path. */
export interface PermissionCardView {
  requestId: string;
  taskId: string;
  /** Always "Permission to act". */
  label: string;
  /** The action and its destination in plain words. */
  action: string;
  /** The exact command, quoted. */
  quote: string;
  destination: string;
  consequence: string;
  /** The controlling rule and its source. */
  rule: string;
  /** Names the action, for example "Run `git push origin main`". */
  primaryLabel: string;
  alternatives: Array<{ choice: Exclude<PermissionChoice, 'run'>; label: string }>;
  /** The prefix a "Deny and …" choice adds a rule for. */
  rulePrefix: string[];
  expiresAt: number;
}

export interface RuleItemView {
  prefix: string[];
  prefixText: string;
  decision: RuleDecision;
  decisionLabel: string;
  note: string | null;
  /** "Workspace policy, revision 4" or "Your rule". */
  sourceLabel: string;
}

export interface ReviewerView {
  enabled: boolean;
  state: 'off' | 'not_available' | 'active';
  label: string;
}

export interface PermissionDecisionView {
  outcome: 'allowed' | 'denied';
  text: string;
  /** The rule a "Deny and …" choice recorded. */
  rule: RuleItemView | null;
}

export interface UserRulesView {
  revision: number;
  rules: RuleItemView[];
}

export interface PermissionSettingsView {
  signedIn: boolean;
  userRules: UserRulesView | null;
  workspaces: Array<{ workspaceId: string; name: string; rules: RuleItemView[]; reviewer: ReviewerView | null; reason: string | null }>;
  reason: string | null;
}

/** The command as people read it (the runtime's own rendering when present). */
export function commandText(command: readonly string[]): string {
  return command.map((token) => (token === '' || /[\s'"]/.test(token) ? `'${token.replace(/'/g, "'\\''")}'` : token)).join(' ');
}

/** "Run `…`", shortened inside the label; the card quotes it in full. */
export function primaryLabelFor(text: string): string {
  const shown = text.length > LABEL_COMMAND_CHARS ? `${text.slice(0, LABEL_COMMAND_CHARS - 1)}…` : text;
  return `Run \`${shown}\``;
}

const oneOf = <T extends string>(allowed: readonly T[], value: unknown, field: string): T => {
  if (!(allowed as readonly unknown[]).includes(value)) throw new Error(`unexpected ${field} from the runtime`);
  return value as T;
};

export function ruleItemView(rule: InquelloCommandRule, sourceLabel: string): RuleItemView {
  const decision = oneOf(RULE_DECISIONS, rule.decision, 'rule decision');
  const prefix = rule.prefix.map(String);
  return { prefix, prefixText: commandText(prefix), decision, decisionLabel: DECISION_LABEL[decision], note: typeof rule.note === 'string' ? rule.note : null, sourceLabel };
}

/** A sourced rule, with "Your rule" for a person's own. */
export function sourcedRuleView(view: InquelloCommandRuleView): RuleItemView {
  const label = view.source.kind === 'user_rule' ? 'Your rule' : String(view.source.label);
  return ruleItemView(view.rule, label);
}

export function reviewerView(value: InquelloPermissionReviewer): ReviewerView {
  return { enabled: value.enabled === true, state: oneOf(['off', 'not_available', 'active'] as const, value.state, 'reviewer state'), label: String(value.label) };
}

/** The forbid refusal in words, naming the rule and its source. */
export function forbiddenText(evaluation: InquelloCommandEvaluation | null): string {
  if (!evaluation) return 'Refused: a command rule forbids this command.';
  const text = String(evaluation.commandText);
  if (evaluation.cannotAsk) return `Refused: \`${text}\` needs permission, and this Task's No prompt mode never asks. Rule: ${String(evaluation.ruleText)}.`;
  return `Refused: \`${text}\` is forbidden. Rule: ${String(evaluation.ruleText)}.`;
}

/** The prefix a "Deny and …" rule takes: the controlling rule's, else the exact command. */
export function rulePrefixOf(request: InquelloPermissionRequest): string[] {
  return (request.evaluation.controllingRule?.prefix ?? request.evaluation.command).map(String);
}

/** A pending request as its card. */
export function permissionCardView(request: InquelloPermissionRequest): PermissionCardView {
  const evaluation = request.evaluation;
  oneOf(['prompt', 'allow'] as const, evaluation.decision, 'request decision');
  const text = String(evaluation.commandText);
  const rulePrefix = rulePrefixOf(request);
  return {
    requestId: String(request.requestId),
    taskId: String(request.taskId),
    label: PERMISSION_LABEL,
    action: String(evaluation.analysis),
    quote: text,
    destination: String(evaluation.destination),
    consequence: String(evaluation.consequence),
    rule: String(evaluation.ruleText),
    primaryLabel: primaryLabelFor(text),
    alternatives: (['deny', 'deny-ask', 'deny-forbid'] as const).map((choice) => ({ choice, label: ALTERNATIVE_LABEL[choice] })),
    rulePrefix,
    expiresAt: Number(request.expiresAt),
  };
}

// ---- mediation ------------------------------------------------------------------

export interface PermissionRuntime {
  request<T>(method: string, params?: unknown): Promise<T>;
}

export type AskOutcome = { ok: true; requestId: string; outcome: 'allowed' | 'denied' | 'expired' } | { ok: false; error: unknown };

export interface AskInput {
  workspacePolicy: InquelloWorkspaceExecutionPolicy;
  taskId: string;
  command: readonly string[];
  origin: 'tools_exec' | 'runtime';
}

export interface PermissionMediatorOptions {
  runtime: PermissionRuntime;
  logger: Logger;
  newId: () => string;
  ttlMs?: number;
  /** Returns null for permitted human handling; no external verdict input exists. */
  automatedReview?: (taskId: string, requestId: string) => Promise<'allowed' | 'denied' | null>;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

interface Waiter {
  resolve: (outcome: 'allowed' | 'denied' | 'expired') => void;
  timer: unknown;
}

/** A refusal's `data.inquello` from the runtime, if it is one. */
export function inquelloRefusal(error: unknown): Record<string, unknown> | null {
  const data = (error as { data?: { inquello?: Record<string, unknown> } } | null)?.data?.inquello;
  return data && typeof data.kind === 'string' ? data : null;
}

/**
 * Holds the waiters of pending requests. A waiter is woken by the person's
 * decision or, when no one decides in time, by the decline-by-default.
 */
export class PermissionMediator {
  private readonly waiters = new Map<string, Waiter>();

  constructor(private readonly options: PermissionMediatorOptions) {}

  get ttlMs(): number {
    return this.options.ttlMs ?? DEFAULT_REQUEST_TTL_MS;
  }

  /** Records a pending request and waits for its decision; never performs the action itself. */
  async ask(input: AskInput): Promise<AskOutcome> {
    const requestId = this.options.newId();
    let response: InquelloPermissionsRequestResponse;
    try {
      response = await this.options.runtime.request<InquelloPermissionsRequestResponse>('inquello/permissions/request', {
        operationId: this.options.newId(),
        requestId,
        workspacePolicy: input.workspacePolicy,
        taskId: input.taskId,
        command: [...input.command],
        origin: input.origin,
        ttlMs: this.ttlMs,
      });
    } catch (error) {
      return { ok: false, error };
    }
    const id = String(response.request.requestId);
    const outcome = await new Promise<'allowed' | 'denied' | 'expired'>((resolve) => {
      const setTimer = this.options.setTimer ?? ((callback: () => void, ms: number) => setTimeout(callback, ms));
      const timer = setTimer(() => void this.expire(id), this.ttlMs);
      this.waiters.set(id, { resolve, timer });
      if (this.options.automatedReview) void this.options.automatedReview(input.taskId, id).then((decision) => {
        if (decision === 'denied') void this.declineByHost(id);
        else if (decision === 'allowed') this.wake(id, decision);
      }, () => { /* unavailable review leaves the existing human mediator pending */ });
    });
    return { ok: true, requestId: id, outcome };
  }

  /** Refused/stale authority must not leave a human-action card pending. */
  private async declineByHost(requestId: string): Promise<void> {
    if (!this.waiters.has(requestId)) return;
    try {
      await this.options.runtime.request('inquello/permissions/decide', {
        operationId: this.options.newId(), requestId, expectedRevision: 1, outcome: 'denied',
        actorKind: 'system', actorRef: HOST_ACTOR_REF,
      });
    } catch { /* A concurrent human/runtime decision may already have won. No action is authorized here. */ }
    this.wake(requestId, 'denied');
  }

  /** Whether a waiter holds this request. */
  waiting(requestId: string): boolean {
    return this.waiters.has(requestId);
  }

  private wake(requestId: string, outcome: 'allowed' | 'denied' | 'expired'): void {
    const waiter = this.waiters.get(requestId);
    if (!waiter) return;
    this.waiters.delete(requestId);
    (this.options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>)))(waiter.timer);
    waiter.resolve(outcome);
  }

  /** Decline by default: recorded `expired` by the host; nothing runs. */
  async expire(requestId: string): Promise<void> {
    if (!this.waiters.has(requestId)) return;
    try {
      await this.options.runtime.request<InquelloPermissionsDecideResponse>('inquello/permissions/decide', {
        operationId: this.options.newId(),
        requestId,
        expectedRevision: 1,
        outcome: 'expired',
        actorKind: 'system',
        actorRef: HOST_ACTOR_REF,
      });
    } catch (error) {
      // Already decided: the decision's own waiter wins; otherwise still declined.
      if (inquelloRefusal(error)?.kind !== 'request_not_pending') this.options.logger.warn(`permissions: an expiry could not be recorded (${(error as Error).message})`);
    }
    this.wake(requestId, 'expired');
  }

  /**
   * Records the person's decision and wakes the waiter. Resolves with the
   * recorded outcome, or the runtime's refusal (`request_not_pending` for a
   * stale or expired request).
   */
  async decide(
    requestId: string,
    outcome: 'allowed' | 'denied',
    operationId: string,
  ): Promise<{ ok: true; outcome: 'allowed' | 'denied'; rulePrefix: string[] } | { ok: false; error: unknown }> {
    let response: InquelloPermissionsDecideResponse;
    try {
      response = await this.options.runtime.request<InquelloPermissionsDecideResponse>('inquello/permissions/decide', {
        operationId,
        requestId,
        expectedRevision: 1,
        outcome,
        actorKind: 'human',
        actorRef: null,
      });
    } catch (error) {
      if (inquelloRefusal(error)?.kind === 'request_not_pending') this.wake(requestId, 'denied');
      return { ok: false, error };
    }
    const recorded = oneOf(['allowed', 'denied'] as const, response.request.decision?.outcome, 'decision');
    this.wake(requestId, recorded);
    return { ok: true, outcome: recorded, rulePrefix: rulePrefixOf(response.request) };
  }

  /** The person's pending requests for one Task, as cards. */
  async pending(taskId: string): Promise<PermissionCardView[]> {
    const response = await this.options.runtime.request<InquelloPermissionsPendingResponse>('inquello/permissions/pending', { taskId });
    return response.requests.filter((request) => request.status === 'pending').map(permissionCardView);
  }

  /** Declines every waiting request (the runtime stopped or the person signed out). */
  declineAll(): void {
    for (const id of [...this.waiters.keys()]) this.wake(id, 'denied');
  }
}

// ---- payload validators ------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function plainObject(args: readonly unknown[]): Record<string, unknown> {
  if (args.length !== 1) throw new OperationError('expected one argument');
  const value = args[0];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new OperationError('expected an object');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new OperationError('expected a plain object');
  return value as Record<string, unknown>;
}

function exactKeys(record: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(record)) if (!keys.includes(key)) throw new OperationError(`unknown key ${key}`);
  for (const key of keys) if (!Object.hasOwn(record, key)) throw new OperationError(`missing key ${key}`);
}

function uuid(value: unknown, key: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new OperationError(`${key} must be a UUID`);
  return value;
}

export interface DecidePermissionInput {
  operationId: string;
  requestId: string;
  choice: PermissionChoice;
}

export interface UserRuleInput {
  prefix: string[];
  decision: RuleDecision;
  note: string | null;
}

export interface SetUserRulesInput {
  operationId: string;
  expectedRevision: number;
  rules: UserRuleInput[];
}

export const pendingPermissionsPayload: PayloadValidator<{ taskId: string }> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['taskId']);
  return { taskId: uuid(record.taskId, 'taskId') };
};

/** `{ operationId, requestId, choice }`: no actor, principal or command passes; main supplies those. */
export const decidePermissionPayload: PayloadValidator<DecidePermissionInput> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['operationId', 'requestId', 'choice']);
  if (!(PERMISSION_CHOICES as readonly unknown[]).includes(record.choice)) throw new OperationError('choice must be run, deny, deny-ask or deny-forbid');
  return { operationId: uuid(record.operationId, 'operationId'), requestId: uuid(record.requestId, 'requestId'), choice: record.choice as PermissionChoice };
};

const MAX_RULES = 100;
const MAX_TOKENS = 16;
const MAX_TOKEN_CHARS = 256;
const MAX_NOTE_CHARS = 500;

/**
 * `{ operationId, expectedRevision, rules }`. The shape is checked here; the
 * runtime judges each rule (an `allow` rule is refused there as
 * `user_rule_cannot_allow`, so the refusal is the runtime's own).
 */
export const setUserRulesPayload: PayloadValidator<SetUserRulesInput> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['operationId', 'expectedRevision', 'rules']);
  const { expectedRevision, rules } = record;
  if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new OperationError('wrong type for expectedRevision');
  if (!Array.isArray(rules) || rules.length > MAX_RULES) throw new OperationError('rules must be a list of at most 100 rules');
  return {
    operationId: uuid(record.operationId, 'operationId'),
    expectedRevision,
    rules: rules.map((rule) => {
      const r = plainObject([rule]);
      exactKeys(r, ['prefix', 'decision', 'note']);
      if (!Array.isArray(r.prefix) || r.prefix.length === 0 || r.prefix.length > MAX_TOKENS) throw new OperationError('a prefix must hold 1 to 16 tokens');
      const prefix = r.prefix.map((token) => {
        if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_CHARS) throw new OperationError('each prefix token must be a short string');
        return token;
      });
      if (!(RULE_DECISIONS as readonly unknown[]).includes(r.decision)) throw new OperationError('decision must be allow, prompt or forbid');
      if (r.note !== null && (typeof r.note !== 'string' || r.note.length > MAX_NOTE_CHARS)) throw new OperationError('note must be a short string or null');
      return { prefix, decision: r.decision as RuleDecision, note: r.note as string | null };
    }),
  };
};
