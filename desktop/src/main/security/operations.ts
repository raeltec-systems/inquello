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
import type { DeleteActionResult, ExportActionResult, ImportActionResult, PolicyView } from '../data/service';
import { toRendererResult, toRendererStatus, type IdentityActionResult, type IdentityStatus } from '../identity/session';
import {
  engagementPayload,
  engagementUpdatePayload,
  folderPayload,
  recordTaskStatePayload,
  stateListPayload,
  taskMovePayload,
  taskPayload,
  taskRenamePayload,
  treePayload,
  type EngagementInput,
  type EngagementUpdateInput,
  type EngagementView,
  type FolderInput,
  type FolderView,
  type OrganiseResult,
  type RecordTaskStateInput,
  type StateRecordView,
  type TaskInput,
  type TaskMoveInput,
  type TaskRenameInput,
  type TaskStatesView,
  type TaskView,
  type WorkspacesView,
  type WorkspaceTreeView,
} from '../organise';
import type { CodexLoginRequest } from '../providers/codex-account';
import { toRendererProviderResult, toRendererProviderStatus, type ProviderActionResult, type ProviderActionView, type ProviderStatus, type ProviderStatusView } from '../providers/status';
import type { Logger } from '../runtime/logger';
import type { RuntimeState } from '../runtime/process';
import { describeSender, isTrustedSender, type InvokeEventLike } from './sender';

/** Every operation the preload exposes, in `<namespace>.<name>` form. */
export const OPERATION_NAMES = [
  'runtime.getStatus',
  'identity.getStatus',
  'identity.signIn',
  'identity.signOut',
  'data.getPolicy',
  'data.export',
  'data.import',
  'data.delete',
  'provider.getStatus',
  'provider.setClaudeKey',
  'provider.verifyClaudeKey',
  'provider.removeClaudeKey',
  'provider.codexLogin',
  'provider.codexLogout',
  'organise.getWorkspaces',
  'organise.getTree',
  'organise.createEngagement',
  'organise.updateEngagement',
  'organise.createFolder',
  'organise.createTask',
  'organise.renameTask',
  'organise.moveTask',
  'state.list',
  'state.recordTaskState',
] as const;
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

/**
 * Validator for one argument that is a non-empty list of distinct strings,
 * each one of `allowed()` (read on every call). Anything else rejects: a path,
 * an object, an unknown or repeated entry, or extra arguments.
 */
export function stringListPayload(allowed: () => readonly string[]): PayloadValidator<string[]> {
  return (args) => {
    if (args.length !== 1) throw new OperationError('expected one argument');
    const value = args[0];
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw new OperationError('expected a list');
    if (value.length === 0) throw new OperationError('expected at least one entry');
    const known = new Set(allowed());
    const out: string[] = [];
    for (let i = 0; i < value.length; i += 1) {
      if (!Object.hasOwn(value, i)) throw new OperationError('expected a dense list');
      const entry: unknown = value[i];
      if (typeof entry !== 'string' || !known.has(entry)) throw new OperationError('unknown entry');
      if (out.includes(entry)) throw new OperationError('repeated entry');
      out.push(entry);
    }
    if (Object.keys(value).length !== value.length) throw new OperationError('unexpected list properties');
    return out;
  };
}

/** The most characters a submitted credential may have before it is refused as a payload. */
export const MAX_CREDENTIAL_PAYLOAD = 4096;

/**
 * Validator for one string argument holding a credential. Only the type and
 * an outer size bound are checked here; main checks the form and answers
 * with a reason. No message names or quotes the value.
 */
export const credentialPayload: PayloadValidator<string> = (args) => {
  if (args.length !== 1) throw new OperationError('expected one argument');
  const value = args[0];
  if (typeof value !== 'string') throw new OperationError('expected a string');
  if (value.length > MAX_CREDENTIAL_PAYLOAD) throw new OperationError('value too long');
  return value;
};

/** Validator for `provider.codexLogin`: `{ type: 'apiKey', apiKey }` or `{ type: 'chatgpt' }`, exactly. */
export const codexLoginPayload: PayloadValidator<CodexLoginRequest> = (args) => {
  if (args.length !== 1) throw new OperationError('expected one argument');
  const value = args[0];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new OperationError('expected an object');
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new OperationError('expected a plain object');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (record.type === 'chatgpt' && keys.length === 1) return { type: 'chatgpt' };
  if (record.type === 'apiKey' && JSON.stringify(keys) === JSON.stringify(['apiKey', 'type'])) {
    return { type: 'apiKey', apiKey: credentialPayload([record.apiKey]) };
  }
  throw new OperationError('expected an apiKey or chatgpt login');
};

export interface RuntimeStatus {
  state: RuntimeState;
  runtimeVersion: string;
}

/** The identity session as the operations see it (main-owned; see `identity/session.ts`). */
export interface IdentityOperations {
  getStatus(): Promise<IdentityStatus>;
  signIn(): Promise<IdentityActionResult>;
  signOut(): Promise<IdentityActionResult>;
}

/** The local data service as the operations see it (main-owned; see `data/service.ts`). */
export interface DataOperations {
  getPolicy(): PolicyView;
  exportData(): Promise<ExportActionResult>;
  importData(): Promise<ImportActionResult>;
  deleteData(categories: readonly string[]): Promise<DeleteActionResult>;
  /** Category ids `data.delete` accepts: the enabled categories of the register. */
  deletableCategories(): readonly string[];
}

/** The provider service as the operations see it (main-owned; see `providers/index.ts`). */
export interface ProviderOperations {
  getStatus(): Promise<ProviderStatus>;
  setClaudeKey(key: string): Promise<ProviderActionResult>;
  verifyClaudeKey(): Promise<ProviderActionResult>;
  removeClaudeKey(): Promise<ProviderActionResult>;
  codexLogin(request: CodexLoginRequest): Promise<ProviderActionResult>;
  codexLogout(): Promise<ProviderActionResult>;
}

/** Private Workspace organisation as the operations see it (main-owned; see `organise/service.ts`). */
export interface OrganiseOperations {
  getWorkspaces(): Promise<WorkspacesView>;
  getTree(workspaceId: string): Promise<OrganiseResult<WorkspaceTreeView>>;
  createEngagement(input: EngagementInput): Promise<OrganiseResult<EngagementView>>;
  updateEngagement(input: EngagementUpdateInput): Promise<OrganiseResult<EngagementView>>;
  createFolder(input: FolderInput): Promise<OrganiseResult<FolderView>>;
  createTask(input: TaskInput): Promise<OrganiseResult<TaskView>>;
  renameTask(input: TaskRenameInput): Promise<OrganiseResult<TaskView>>;
  moveTask(input: TaskMoveInput): Promise<OrganiseResult<TaskView>>;
  /** Story 1.15: a Task's states, for its creator only. */
  listStates(taskId: string): Promise<OrganiseResult<TaskStatesView>>;
  /** Story 1.15: a Task or run state, recorded by main as `system`. */
  recordTaskState(input: RecordTaskStateInput): Promise<OrganiseResult<StateRecordView>>;
}

export interface OperationDeps {
  runtimeState: () => RuntimeState;
  runtimeVersion: string;
  identity: IdentityOperations;
  data: DataOperations;
  provider: ProviderOperations;
  organise: OrganiseOperations;
}

/**
 * The full operation set; must cover `OPERATION_NAMES` exactly. Identity
 * results are rebuilt field by field (`toRendererStatus`), so nothing beyond
 * the published status shape, and never a credential, reaches the renderer.
 */
export function createOperations(deps: OperationDeps): Operation[] {
  const getStatus: Operation<undefined, RuntimeStatus> = {
    name: 'runtime.getStatus',
    validate: noPayload,
    handle: () => ({ state: deps.runtimeState(), runtimeVersion: deps.runtimeVersion }),
  };
  const identityStatus: Operation<undefined, IdentityStatus> = {
    name: 'identity.getStatus',
    validate: noPayload,
    handle: async () => toRendererStatus(await deps.identity.getStatus()),
  };
  const signIn: Operation<undefined, IdentityActionResult> = {
    name: 'identity.signIn',
    validate: noPayload,
    handle: async () => toRendererResult(await deps.identity.signIn()),
  };
  const signOut: Operation<undefined, IdentityActionResult> = {
    name: 'identity.signOut',
    validate: noPayload,
    handle: async () => toRendererResult(await deps.identity.signOut()),
  };
  // Local data (Story 1.12): main shows every folder dialog, so no data
  // operation takes a path; `data.delete` takes only known category ids.
  const dataPolicy: Operation<undefined, PolicyView> = {
    name: 'data.getPolicy',
    validate: noPayload,
    handle: () => deps.data.getPolicy(),
  };
  const dataExport: Operation<undefined, ExportActionResult> = {
    name: 'data.export',
    validate: noPayload,
    handle: () => deps.data.exportData(),
  };
  const dataImport: Operation<undefined, ImportActionResult> = {
    name: 'data.import',
    validate: noPayload,
    handle: () => deps.data.importData(),
  };
  const dataDelete: Operation<string[], DeleteActionResult> = {
    name: 'data.delete',
    validate: stringListPayload(() => deps.data.deletableCategories()),
    handle: (categories) => deps.data.deleteData(categories),
  };
  // Provider credentials (Story 1.13): a key crosses IPC once, into main, on
  // `provider.setClaudeKey` or `provider.codexLogin`; every result is the
  // provider status rebuilt field by field, never a key or a fragment of one.
  const providerStatus: Operation<undefined, ProviderStatusView> = {
    name: 'provider.getStatus',
    validate: noPayload,
    handle: async () => toRendererProviderStatus(await deps.provider.getStatus()),
  };
  const setClaudeKey: Operation<string, ProviderActionView> = {
    name: 'provider.setClaudeKey',
    validate: credentialPayload,
    handle: async (key) => toRendererProviderResult(await deps.provider.setClaudeKey(key)),
  };
  const verifyClaudeKey: Operation<undefined, ProviderActionView> = {
    name: 'provider.verifyClaudeKey',
    validate: noPayload,
    handle: async () => toRendererProviderResult(await deps.provider.verifyClaudeKey()),
  };
  const removeClaudeKey: Operation<undefined, ProviderActionView> = {
    name: 'provider.removeClaudeKey',
    validate: noPayload,
    handle: async () => toRendererProviderResult(await deps.provider.removeClaudeKey()),
  };
  const codexLogin: Operation<CodexLoginRequest, ProviderActionView> = {
    name: 'provider.codexLogin',
    validate: codexLoginPayload,
    handle: async (request) => toRendererProviderResult(await deps.provider.codexLogin(request)),
  };
  const codexLogout: Operation<undefined, ProviderActionView> = {
    name: 'provider.codexLogout',
    validate: noPayload,
    handle: async () => toRendererProviderResult(await deps.provider.codexLogout()),
  };
  // Private Workspace organisation (Story 1.14): main binds the principal and
  // mediates every call; no payload names a principal, a path or a share.
  const organiseWorkspaces: Operation<undefined, WorkspacesView> = {
    name: 'organise.getWorkspaces',
    validate: noPayload,
    handle: () => deps.organise.getWorkspaces(),
  };
  const organiseTree: Operation<{ workspaceId: string }, OrganiseResult<WorkspaceTreeView>> = {
    name: 'organise.getTree',
    validate: treePayload,
    handle: ({ workspaceId }) => deps.organise.getTree(workspaceId),
  };
  const organiseCreateEngagement: Operation<EngagementInput, OrganiseResult<EngagementView>> = {
    name: 'organise.createEngagement',
    validate: engagementPayload,
    handle: (input) => deps.organise.createEngagement(input),
  };
  const organiseUpdateEngagement: Operation<EngagementUpdateInput, OrganiseResult<EngagementView>> = {
    name: 'organise.updateEngagement',
    validate: engagementUpdatePayload,
    handle: (input) => deps.organise.updateEngagement(input),
  };
  const organiseCreateFolder: Operation<FolderInput, OrganiseResult<FolderView>> = {
    name: 'organise.createFolder',
    validate: folderPayload,
    handle: (input) => deps.organise.createFolder(input),
  };
  const organiseCreateTask: Operation<TaskInput, OrganiseResult<TaskView>> = {
    name: 'organise.createTask',
    validate: taskPayload,
    handle: (input) => deps.organise.createTask(input),
  };
  const organiseRenameTask: Operation<TaskRenameInput, OrganiseResult<TaskView>> = {
    name: 'organise.renameTask',
    validate: taskRenamePayload,
    handle: (input) => deps.organise.renameTask(input),
  };
  const organiseMoveTask: Operation<TaskMoveInput, OrganiseResult<TaskView>> = {
    name: 'organise.moveTask',
    validate: taskMovePayload,
    handle: (input) => deps.organise.moveTask(input),
  };
  // Task states (Story 1.15): any Task state may be read by its creator; only
  // Task and run states may be recorded, and main supplies the actor.
  const stateList: Operation<{ taskId: string }, OrganiseResult<TaskStatesView>> = {
    name: 'state.list',
    validate: stateListPayload,
    handle: ({ taskId }) => deps.organise.listStates(taskId),
  };
  const stateRecordTaskState: Operation<RecordTaskStateInput, OrganiseResult<StateRecordView>> = {
    name: 'state.recordTaskState',
    validate: recordTaskStatePayload,
    handle: (input) => deps.organise.recordTaskState(input),
  };
  return [
    getStatus,
    identityStatus,
    signIn,
    signOut,
    dataPolicy,
    dataExport,
    dataImport,
    dataDelete,
    providerStatus,
    setClaudeKey,
    verifyClaudeKey,
    removeClaudeKey,
    codexLogin,
    codexLogout,
    organiseWorkspaces,
    organiseTree,
    organiseCreateEngagement,
    organiseUpdateEngagement,
    organiseCreateFolder,
    organiseCreateTask,
    organiseRenameTask,
    organiseMoveTask,
    stateList,
    stateRecordTaskState,
  ] as Operation[];
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
