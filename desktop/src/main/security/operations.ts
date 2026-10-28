/**
 * Named renderer operations (AD-5).
 *
 * The renderer reaches main only through these operations. Each one has a
 * fixed channel, a payload validator and a handler. A call runs the handler
 * only when the sender is trusted and the arguments pass validation; anything
 * else rejects with a plain message and no stack. Channels without a
 * registration have no handler, so Electron rejects them itself.
 *
 * The preload repeats the channel strings below literally because a sandboxed
 * preload cannot `require` this file; a test keeps the two in step.
 */
import type { Logger } from '../runtime/logger';
import type { RuntimeState } from '../runtime/process';
import { describeSender, isTrustedSender, type InvokeEventLike } from './sender';

/** Every operation the preload exposes, in `<namespace>.<name>` form. */
export const OPERATION_NAMES = ['runtime.getStatus'] as const;
export type OperationName = (typeof OPERATION_NAMES)[number];

export const CHANNEL_PREFIX = 'inquello:op:';

export function channelFor(name: OperationName): string {
  return `${CHANNEL_PREFIX}${name}`;
}

export class OperationError extends Error {
  override name = 'OperationError';
}

/** Turns the raw invoke arguments into a typed payload, or throws. */
export type PayloadValidator<P> = (args: readonly unknown[]) => P;

export interface Operation<P = unknown, R = unknown> {
  name: OperationName;
  validate: PayloadValidator<P>;
  handle: (payload: P) => R | Promise<R>;
}

/** Validator for operations that take no arguments at all. */
export const noPayload: PayloadValidator<undefined> = (args) => {
  if (args.length !== 0) throw new OperationError('unexpected arguments');
  return undefined;
};

type FieldType = 'string' | 'number' | 'boolean';
type FieldValue<T extends FieldType> = T extends 'string' ? string : T extends 'number' ? number : boolean;

/**
 * Validator for one plain-object argument with exactly the given required
 * fields. Extra arguments, unknown keys, missing keys, non-plain objects and
 * wrong types all reject.
 */
export function objectPayload<S extends Record<string, FieldType>>(
  shape: S,
): PayloadValidator<{ [K in keyof S]: FieldValue<S[K]> }> {
  return (args) => {
    if (args.length !== 1) throw new OperationError('expected one argument');
    const value = args[0];
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new OperationError('expected an object');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new OperationError('expected a plain object');
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(shape, key)) throw new OperationError(`unknown key ${key}`);
    }
    const out: Record<string, unknown> = {};
    for (const [key, type] of Object.entries(shape)) {
      if (!Object.hasOwn(record, key)) throw new OperationError(`missing key ${key}`);
      const field = record[key];
      if (typeof field !== type || (type === 'number' && !Number.isFinite(field))) {
        throw new OperationError(`wrong type for ${key}`);
      }
      out[key] = field;
    }
    return out as { [K in keyof S]: FieldValue<S[K]> };
  };
}

export interface RuntimeStatus {
  state: RuntimeState;
  runtimeVersion: string;
}

export interface OperationDeps {
  runtimeState: () => RuntimeState;
  runtimeVersion: string;
}

/** The full operation set; must cover `OPERATION_NAMES` exactly. */
export function createOperations(deps: OperationDeps): Operation[] {
  const getStatus: Operation<undefined, RuntimeStatus> = {
    name: 'runtime.getStatus',
    validate: noPayload,
    handle: () => ({ state: deps.runtimeState(), runtimeVersion: deps.runtimeVersion }),
  };
  return [getStatus as Operation];
}

export interface IpcMainLike {
  handle(channel: string, listener: (event: InvokeEventLike, ...args: unknown[]) => unknown): void;
}

export interface RegisterOptions {
  /** `webContents` ids main created and still trusts; read on every call. */
  trustedWebContentsIds: ReadonlySet<number>;
  logger: Logger;
}

/**
 * Registers each operation on its channel. Throws if the set does not match
 * `OPERATION_NAMES` exactly, so the preload and main cannot drift apart.
 */
export function registerOperations(ipcMain: IpcMainLike, operations: readonly Operation[], options: RegisterOptions): void {
  const names = operations.map((operation) => operation.name);
  const expected = [...OPERATION_NAMES].sort();
  if (new Set(names).size !== names.length || JSON.stringify([...names].sort()) !== JSON.stringify(expected)) {
    throw new Error(`operation set ${JSON.stringify(names)} does not match ${JSON.stringify(expected)}`);
  }
  for (const operation of operations) {
    ipcMain.handle(channelFor(operation.name), (event, ...args) => invokeOperation(operation, event, args, options));
  }
}

async function invokeOperation(
  operation: Operation,
  event: InvokeEventLike,
  args: readonly unknown[],
  options: RegisterOptions,
): Promise<unknown> {
  const { logger } = options;
  let trusted = false;
  let senderUrl = '';
  try {
    const sender = describeSender(event);
    senderUrl = sender.url;
    trusted = isTrustedSender(sender, options.trustedWebContentsIds);
  } catch {
    trusted = false;
  }
  if (!trusted) {
    logger.warn(`operation ${operation.name}: untrusted sender ${senderUrl || '(unknown)'}`);
    throw new Error('untrusted sender');
  }
  let payload: unknown;
  try {
    payload = operation.validate(args);
  } catch (error) {
    logger.warn(`operation ${operation.name}: invalid payload (${(error as Error).message})`);
    throw new Error(`invalid payload for ${operation.name}`);
  }
  try {
    return await operation.handle(payload);
  } catch (error) {
    logger.error(`operation ${operation.name} failed: ${(error as Error).message}`);
    throw new Error(`operation failed: ${operation.name}`);
  }
}
