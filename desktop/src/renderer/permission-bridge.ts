/**
 * The renderer's typed view of `window.inquello.permissions` (Story 1.20):
 * a Task's pending permission requests as ApprovalCards, the person's
 * decision on one, and the command rules (each with its source), the
 * automatic permission reviewer's state and the person's own rules for S07.
 *
 * Main supplies every text (the exact command, destination, consequences,
 * the controlling rule, button labels and reasons). These parsers keep only
 * the published fields and treat anything malformed as a failed read. A card
 * whose primary label is generic, or an "always allow" alternative, is
 * refused rather than shown.
 */

export type PermissionChoice = 'run' | 'deny' | 'deny-ask' | 'deny-forbid';
export type RuleDecision = 'allow' | 'prompt' | 'forbid';

export interface PermissionCardItem {
  requestId: string;
  taskId: string;
  label: string;
  action: string;
  quote: string;
  destination: string;
  consequence: string;
  rule: string;
  primaryLabel: string;
  alternatives: Array<{ choice: Exclude<PermissionChoice, 'run'>; label: string }>;
  expiresAt: number;
}

export interface RuleItem {
  prefix: string[];
  prefixText: string;
  decision: RuleDecision;
  decisionLabel: string;
  note: string | null;
  sourceLabel: string;
}

export interface ReviewerItem {
  enabled: boolean;
  state: 'off' | 'not_available' | 'active';
  label: string;
}

export interface PermissionSettingsItem {
  signedIn: boolean;
  userRules: { revision: number; rules: RuleItem[] } | null;
  workspaces: Array<{ workspaceId: string; name: string; rules: RuleItem[]; reviewer: ReviewerItem | null; reason: string | null }>;
  reason: string | null;
}

export interface PermissionDecisionItem {
  outcome: 'allowed' | 'denied';
  text: string;
}

export interface PermissionBridge {
  pending(request: { taskId: string }): Promise<unknown>;
  decide(request: { operationId: string; requestId: string; choice: PermissionChoice }): Promise<unknown>;
  getRules(): Promise<unknown>;
  setUserRules(request: { operationId: string; expectedRevision: number; rules: Array<{ prefix: string[]; decision: RuleDecision; note: string | null }> }): Promise<unknown>;
}

/** The permission operations, or null outside the desktop. */
export function permissionBridge(): PermissionBridge | null {
  const bridge = (globalThis as { inquello?: { permissions?: PermissionBridge } }).inquello;
  return bridge?.permissions ?? null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);

function list<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const parsed = parse(item);
    if (parsed === null) return null;
    out.push(parsed);
  }
  return out;
}

const ALTERNATIVES: readonly string[] = ['deny', 'deny-ask', 'deny-forbid'];
/** Labels a card may never use: they do not name the action, or widen it. */
const REFUSED_LABEL = /^\s*(approve|ok|yes|confirm|continue)\s*[.!?…]*\s*$|always allow/i;

export function parsePermissionCard(value: unknown): PermissionCardItem | null {
  const r = record(value);
  if (!r) return null;
  const fields = ['requestId', 'taskId', 'label', 'action', 'quote', 'destination', 'consequence', 'rule', 'primaryLabel'] as const;
  const out: Record<string, string> = {};
  for (const field of fields) {
    const v = text(r[field]);
    if (v === null) return null;
    out[field] = v;
  }
  if (REFUSED_LABEL.test(out.primaryLabel!)) return null;
  const alternatives = list(r.alternatives, (item) => {
    const a = record(item);
    const label = text(a?.label);
    if (!a || label === null || !ALTERNATIVES.includes(a.choice as string) || REFUSED_LABEL.test(label)) return null;
    return { choice: a.choice as Exclude<PermissionChoice, 'run'>, label };
  });
  const expiresAt = count(r.expiresAt);
  if (!alternatives || expiresAt === null) return null;
  return { ...(out as Omit<PermissionCardItem, 'alternatives' | 'expiresAt'>), alternatives, expiresAt };
}

export function parsePermissionCards(value: unknown): PermissionCardItem[] | null {
  return list(value, parsePermissionCard);
}

const DECISIONS: readonly string[] = ['allow', 'prompt', 'forbid'];

export function parseRule(value: unknown): RuleItem | null {
  const r = record(value);
  const prefix = list(r?.prefix, text);
  const prefixText = text(r?.prefixText);
  const decisionLabel = text(r?.decisionLabel);
  const sourceLabel = text(r?.sourceLabel);
  if (!r || !prefix || prefixText === null || decisionLabel === null || sourceLabel === null || !DECISIONS.includes(r.decision as string)) return null;
  const note = r.note === null ? null : text(r.note);
  return { prefix, prefixText, decision: r.decision as RuleDecision, decisionLabel, note, sourceLabel };
}

export function parseReviewer(value: unknown): ReviewerItem | null {
  const r = record(value);
  const label = text(r?.label);
  if (!r || typeof r.enabled !== 'boolean' || label === null || (r.state !== 'off' && r.state !== 'not_available' && r.state !== 'active')) return null;
  return { enabled: r.enabled, state: r.state, label };
}

export function parsePermissionSettings(value: unknown): PermissionSettingsItem | null {
  const r = record(value);
  if (!r || typeof r.signedIn !== 'boolean') return null;
  let userRules: PermissionSettingsItem['userRules'] = null;
  if (r.userRules !== null) {
    const u = record(r.userRules);
    const revision = count(u?.revision);
    const rules = list(u?.rules, parseRule);
    if (revision === null || !rules) return null;
    userRules = { revision, rules };
  }
  const workspaces = list(r.workspaces, (item) => {
    const w = record(item);
    const workspaceId = text(w?.workspaceId);
    const name = text(w?.name);
    const rules = list(w?.rules, parseRule);
    if (!w || workspaceId === null || name === null || !rules) return null;
    const reviewer = w.reviewer === null ? null : parseReviewer(w.reviewer);
    if (w.reviewer !== null && reviewer === null) return null;
    const reason = w.reason === null ? null : text(w.reason);
    return { workspaceId, name, rules, reviewer, reason };
  });
  if (!workspaces) return null;
  const reason = r.reason === null ? null : text(r.reason);
  return { signedIn: r.signedIn, userRules, workspaces, reason };
}

export function parsePermissionDecision(value: unknown): PermissionDecisionItem | null {
  const r = record(value);
  const t = text(r?.text);
  if (!r || t === null || (r.outcome !== 'allowed' && r.outcome !== 'denied')) return null;
  return { outcome: r.outcome, text: t };
}
