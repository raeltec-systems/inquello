/**
 * Task states as main mediates them (Story 1.15).
 *
 * Seven separate dimensions, each with its own vocabulary, so that "done"
 * never collapses execution, checks, review, approval and delivery into one
 * word. The renderer reads them through `state.list` and may record only Task
 * and run states through `state.recordTaskState`; main supplies the actor
 * (`system`, this desktop) and the scope, so no renderer payload names an
 * actor, a principal or another dimension. The runtime's domain checks the
 * vocabulary, the writer rules and the expected revision.
 */
import type { InquelloStateListResponse } from '../../protocol/generated/v2/InquelloStateListResponse';
import type { InquelloStateRecord } from '../../protocol/generated/v2/InquelloStateRecord';
import { OperationError, type PayloadValidator } from '../security/operations';

/** Every dimension, in display order. */
export const STATE_DIMENSIONS = ['task', 'run', 'output', 'checks', 'review', 'approval_marker', 'delivery_marker'] as const;
export type StateDimension = (typeof STATE_DIMENSIONS)[number];

/** The only dimensions the desktop may write in Story 1.15. */
export const DESKTOP_STATE_DIMENSIONS = ['task', 'run'] as const;
export type DesktopStateDimension = (typeof DESKTOP_STATE_DIMENSIONS)[number];

/** The actor reference main records for desktop-originated states (actor kind `system`). */
export const DESKTOP_STATE_ACTOR = 'inquello-desktop';

export interface StateRecordView {
  dimension: StateDimension;
  scopeKind: 'task' | 'run' | 'output';
  scopeId: string;
  value: string;
  version: number;
  actorKind: 'human' | 'runtime' | 'system';
  actorRef: string;
  recordedAt: number;
  revision: number;
}

export interface TaskStatesView {
  taskId: string;
  /** The Task's state revision: 0 before the first record. */
  revision: number;
  /** All seven dimensions in display order, each with its records latest first (empty: not recorded). */
  dimensions: Array<{ dimension: StateDimension; records: StateRecordView[] }>;
}

export interface RecordTaskStateInput {
  operationId: string;
  taskId: string;
  expectedRevision: number;
  dimension: DesktopStateDimension;
  value: string;
  /** The run reference for a `run` state; null for a `task` state (its scope is the Task). */
  runId: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Longer than any vocabulary value; the runtime's domain decides validity. */
const MAX_VALUE = 64;
const MAX_RUN_ID = 128;
const RUN_ID = /^[\x21-\x7e]+$/;

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

export const stateListPayload: PayloadValidator<{ taskId: string }> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['taskId']);
  return { taskId: uuid(record.taskId, 'taskId') };
};

/**
 * `{ operationId, taskId, expectedRevision, dimension, value, runId }`:
 * `task` or `run` only, a run ID exactly for `run`, and no actor or scope key.
 */
export const recordTaskStatePayload: PayloadValidator<RecordTaskStateInput> = (args) => {
  const record = plainObject(args);
  exactKeys(record, ['operationId', 'taskId', 'expectedRevision', 'dimension', 'value', 'runId']);
  const { expectedRevision, dimension, value, runId } = record;
  if (typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new OperationError('wrong type for expectedRevision');
  }
  if (!(DESKTOP_STATE_DIMENSIONS as readonly unknown[]).includes(dimension)) throw new OperationError('dimension must be task or run');
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_VALUE) throw new OperationError('wrong type for value');
  if (dimension === 'task' && runId !== null) throw new OperationError('a task state takes no runId');
  if (dimension === 'run' && (typeof runId !== 'string' || runId.length > MAX_RUN_ID || !RUN_ID.test(runId))) {
    throw new OperationError('a run state needs a printable runId');
  }
  return {
    operationId: uuid(record.operationId, 'operationId'),
    taskId: uuid(record.taskId, 'taskId'),
    expectedRevision,
    dimension: dimension as DesktopStateDimension,
    value,
    runId: runId as string | null,
  };
};

const SCOPE_KINDS = ['task', 'run', 'output'] as const;
const ACTOR_KINDS = ['human', 'runtime', 'system'] as const;

function oneOf<T extends string>(allowed: readonly T[], value: unknown, field: string): T {
  if (!(allowed as readonly unknown[]).includes(value)) throw new Error(`unexpected ${field} from the runtime`);
  return value as T;
}

export function stateRecordView(value: InquelloStateRecord): StateRecordView {
  return {
    dimension: oneOf(STATE_DIMENSIONS, value.dimension, 'dimension'),
    scopeKind: oneOf(SCOPE_KINDS, value.scopeKind, 'scope kind'),
    scopeId: String(value.scopeId),
    value: String(value.value),
    version: Number(value.version),
    actorKind: oneOf(ACTOR_KINDS, value.actorKind, 'actor kind'),
    actorRef: String(value.actorRef),
    recordedAt: Number(value.recordedAt),
    revision: Number(value.revision),
  };
}

/** Rebuilds the listing field by field, always with all seven dimensions in display order. */
export function taskStatesView(value: InquelloStateListResponse): TaskStatesView {
  const byDimension = new Map(value.dimensions.map((entry) => [String(entry.dimension), entry.records]));
  return {
    taskId: String(value.taskId),
    revision: Number(value.revision),
    dimensions: STATE_DIMENSIONS.map((dimension) => ({ dimension, records: (byDimension.get(dimension) ?? []).map(stateRecordView) })),
  };
}
