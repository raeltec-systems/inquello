/**
 * The renderer's typed view of `window.inquello.state` (Story 1.15), and the
 * truthful text for every state.
 *
 * Seven separate dimensions, each with its own vocabulary. None of them is a
 * StatusChip source state: each value is shown through StatusChip's custom
 * `label` path with its own text, never coerced into suggested,
 * investigating, open, evidence, accepted or explained. The approval and
 * delivery markers are local working markers and always say so.
 */

export const STATE_DIMENSIONS = ['task', 'run', 'output', 'checks', 'review', 'approval_marker', 'delivery_marker'] as const;
export type StateDimension = (typeof STATE_DIMENSIONS)[number];

/** The heading of each dimension in the States section. */
export const DIMENSION_LABEL: Record<StateDimension, string> = {
  task: 'Task',
  run: 'Run',
  output: 'Output',
  checks: 'Checks',
  review: 'Review',
  approval_marker: 'Professional Approval',
  delivery_marker: 'Delivery',
};

/** Each dimension's exact vocabulary and the text each value shows. */
export const STATE_TEXT: { [D in StateDimension]: Record<string, string> } = {
  task: { planned: 'Planned', running: 'Running', blocked: 'Blocked', interrupted: 'Interrupted' },
  run: { running: 'Running', blocked: 'Blocked', interrupted: 'Interrupted', execution_finished: 'Execution finished', failed: 'Failed' },
  output: { produced: 'Produced' },
  checks: { incomplete: 'Checks incomplete', complete: 'Checks complete' },
  review: { requested: 'Review requested', revision_requested: 'Revision requested', decision_recorded: 'Review decision recorded' },
  approval_marker: { noted_locally: 'Approval noted locally — not an authoritative record' },
  delivery_marker: {
    attempted: 'Delivery attempted — local marker',
    confirmed: 'Delivery confirmed — local marker',
    uncertain: 'Delivery uncertain — local marker',
  },
};

export const NOT_RECORDED = 'Not recorded';

/** Who recorded a state, in words. */
export const ACTOR_TEXT = { human: 'a person', runtime: 'the runtime', system: 'Inquello on this device' } as const;
export type ActorKind = keyof typeof ACTOR_TEXT;

export interface StateRecordItem {
  dimension: StateDimension;
  scopeKind: 'task' | 'run' | 'output';
  scopeId: string;
  value: string;
  version: number;
  actorKind: ActorKind;
  recordedAt: number;
  revision: number;
}

export interface TaskStatesItem {
  taskId: string;
  revision: number;
  /** All seven dimensions in display order; records latest first, empty when not recorded. */
  dimensions: Array<{ dimension: StateDimension; records: StateRecordItem[] }>;
}

export interface StateBridge {
  list(request: { taskId: string }): Promise<unknown>;
  recordTaskState(request: { operationId: string; taskId: string; expectedRevision: number; dimension: 'task' | 'run'; value: string; runId: string | null }): Promise<unknown>;
}

/** The state operations, or null outside the desktop. */
export function stateBridge(): StateBridge | null {
  const bridge = (globalThis as { inquello?: { state?: StateBridge } }).inquello;
  return bridge?.state ?? null;
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null);
const isDimension = (value: unknown): value is StateDimension => (STATE_DIMENSIONS as readonly unknown[]).includes(value);

/** The truthful text for one value, or null when it is not in its dimension's vocabulary. */
export function stateText(dimension: StateDimension, value: string): string | null {
  return Object.hasOwn(STATE_TEXT[dimension], value) ? STATE_TEXT[dimension][value]! : null;
}

export function parseStateRecord(value: unknown): StateRecordItem | null {
  const r = record(value);
  if (!r || !isDimension(r.dimension) || typeof r.value !== 'string' || stateText(r.dimension, r.value) === null) return null;
  if (r.scopeKind !== 'task' && r.scopeKind !== 'run' && r.scopeKind !== 'output') return null;
  if (typeof r.scopeId !== 'string' || typeof r.actorKind !== 'string' || !Object.hasOwn(ACTOR_TEXT, r.actorKind)) return null;
  const version = count(r.version);
  const revision = count(r.revision);
  const recordedAt = typeof r.recordedAt === 'number' && Number.isFinite(r.recordedAt) ? r.recordedAt : null;
  if (version === null || revision === null || recordedAt === null) return null;
  return {
    dimension: r.dimension,
    scopeKind: r.scopeKind,
    scopeId: r.scopeId,
    value: r.value,
    version,
    actorKind: r.actorKind as ActorKind,
    recordedAt,
    revision,
  };
}

/** Parses a listing; a malformed one is a failed read, never shown half-read. */
export function parseTaskStates(value: unknown): TaskStatesItem | null {
  const r = record(value);
  const revision = count(r?.revision);
  if (!r || typeof r.taskId !== 'string' || revision === null || !Array.isArray(r.dimensions)) return null;
  const byDimension = new Map<StateDimension, StateRecordItem[]>();
  for (const entry of r.dimensions) {
    const e = record(entry);
    if (!e || !isDimension(e.dimension) || !Array.isArray(e.records) || byDimension.has(e.dimension)) return null;
    const records: StateRecordItem[] = [];
    for (const item of e.records) {
      const parsed = parseStateRecord(item);
      if (!parsed || parsed.dimension !== e.dimension) return null;
      records.push(parsed);
    }
    byDimension.set(e.dimension, records);
  }
  return { taskId: r.taskId, revision, dimensions: STATE_DIMENSIONS.map((dimension) => ({ dimension, records: byDimension.get(dimension) ?? [] })) };
}
