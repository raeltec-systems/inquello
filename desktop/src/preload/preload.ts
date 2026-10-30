/**
 * Sandboxed preload: the renderer's only bridge to main (AD-5).
 *
 * Exposes one frozen `window.inquello` object of named operations. Each
 * operation invokes a fixed channel with validated-by-main arguments; nothing
 * here forwards a channel name, an IPC object or a listener to the renderer.
 *
 * The `data` operations forward the renderer's arguments unchanged so main's
 * validators judge them: `data.delete` needs its category list, and a path
 * passed to `data.export` or `data.import` must reach main to be rejected as
 * an invalid payload (main shows every folder dialog itself).
 *
 * Of the `provider` operations only `setClaudeKey` and `codexLogin` forward
 * the renderer's arguments: the key (or login choice) the user entered, which
 * main validates. Nothing main returns ever holds a key.
 *
 * The `organise` operations (Story 1.14) forward the renderer's arguments so
 * main's validators judge them; main binds the signed-in principal itself.
 * So do the `state` operations (Story 1.15); main supplies the actor of a
 * recorded state, and only Task and run states can be recorded. And so do
 * the `policy` operations (Story 1.18); main fetches the Workspace policy and
 * supplies the actor, and a broader mode needs the reach the person confirmed.
 * So do the `permissions` operations (Story 1.20): the renderer names a
 * request and the person's choice, or the person's own rules; main supplies
 * the actor and the runtime evaluates every rule.
 *
 * Self-contained by design: a sandboxed preload can `require` only `electron`,
 * so the channel strings are literals that a test checks against
 * `OPERATION_NAMES` in `src/main/security/operations.ts`.
 */
import { contextBridge, ipcRenderer } from 'electron';

const GET_STATUS_CHANNEL = 'inquello:op:runtime.getStatus';
const IDENTITY_STATUS_CHANNEL = 'inquello:op:identity.getStatus';
const IDENTITY_SIGN_IN_CHANNEL = 'inquello:op:identity.signIn';
const IDENTITY_SIGN_OUT_CHANNEL = 'inquello:op:identity.signOut';
const DATA_POLICY_CHANNEL = 'inquello:op:data.getPolicy';
const DATA_EXPORT_CHANNEL = 'inquello:op:data.export';
const DATA_IMPORT_CHANNEL = 'inquello:op:data.import';
const DATA_DELETE_CHANNEL = 'inquello:op:data.delete';
const PROVIDER_STATUS_CHANNEL = 'inquello:op:provider.getStatus';
const PROVIDER_SET_CLAUDE_KEY_CHANNEL = 'inquello:op:provider.setClaudeKey';
const PROVIDER_VERIFY_CLAUDE_KEY_CHANNEL = 'inquello:op:provider.verifyClaudeKey';
const PROVIDER_REMOVE_CLAUDE_KEY_CHANNEL = 'inquello:op:provider.removeClaudeKey';
const PROVIDER_CODEX_LOGIN_CHANNEL = 'inquello:op:provider.codexLogin';
const PROVIDER_CODEX_LOGOUT_CHANNEL = 'inquello:op:provider.codexLogout';
const ORGANISE_WORKSPACES_CHANNEL = 'inquello:op:organise.getWorkspaces';
const ORGANISE_TREE_CHANNEL = 'inquello:op:organise.getTree';
const ORGANISE_CREATE_ENGAGEMENT_CHANNEL = 'inquello:op:organise.createEngagement';
const ORGANISE_UPDATE_ENGAGEMENT_CHANNEL = 'inquello:op:organise.updateEngagement';
const ORGANISE_CREATE_FOLDER_CHANNEL = 'inquello:op:organise.createFolder';
const ORGANISE_CREATE_TASK_CHANNEL = 'inquello:op:organise.createTask';
const ORGANISE_RENAME_TASK_CHANNEL = 'inquello:op:organise.renameTask';
const ORGANISE_MOVE_TASK_CHANNEL = 'inquello:op:organise.moveTask';
const STATE_LIST_CHANNEL = 'inquello:op:state.list';
const STATE_RECORD_TASK_STATE_CHANNEL = 'inquello:op:state.recordTaskState';
const POLICY_SETTINGS_CHANNEL = 'inquello:op:policy.getSettings';
const POLICY_FOR_TASK_CHANNEL = 'inquello:op:policy.forTask';
const POLICY_SET_BROAD_MODE_CHANNEL = 'inquello:op:policy.setBroadMode';
const PERMISSIONS_PENDING_CHANNEL = 'inquello:op:permissions.pending';
const PERMISSIONS_DECIDE_CHANNEL = 'inquello:op:permissions.decide';
const PERMISSIONS_GET_RULES_CHANNEL = 'inquello:op:permissions.getRules';
const PERMISSIONS_SET_USER_RULES_CHANNEL = 'inquello:op:permissions.setUserRules';

const CAPABILITIES_CHANGED_CHANNEL = 'inquello:capabilities-changed';
const CAPABILITIES_INVENTORY_CHANNEL = 'inquello:op:capabilities.getInventory';
const CAPABILITIES_MANAGE_CHANNEL = 'inquello:op:capabilities.manage';

const api = Object.freeze({
  capabilities: Object.freeze({
    onChanged: (listener: () => void): (() => void) => {
      if (typeof listener !== 'function') throw new Error('expected a listener');
      const handler = () => listener();
      ipcRenderer.on(CAPABILITIES_CHANGED_CHANNEL, handler);
      return () => { ipcRenderer.removeListener(CAPABILITIES_CHANGED_CHANNEL, handler); };
    },
    getInventory: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(CAPABILITIES_INVENTORY_CHANNEL, ...args),
    manage: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(CAPABILITIES_MANAGE_CHANNEL, ...args),
  }),
  runtime: Object.freeze({
    /** Resolves with `{ state, runtimeVersion }` from main. Takes no arguments. */
    getStatus: (): Promise<unknown> => ipcRenderer.invoke(GET_STATUS_CHANNEL),
  }),
  identity: Object.freeze({
    /** Resolves with `{ identity, sharedService, credentialStorage, privateWork }`. Never a credential. */
    getStatus: (): Promise<unknown> => ipcRenderer.invoke(IDENTITY_STATUS_CHANNEL),
    /** Signs in through the system browser; resolves with `{ ok, reason?, status }`. */
    signIn: (): Promise<unknown> => ipcRenderer.invoke(IDENTITY_SIGN_IN_CHANNEL),
    /** Signs out of the shared service; resolves with `{ ok, reason?, status }`. */
    signOut: (): Promise<unknown> => ipcRenderer.invoke(IDENTITY_SIGN_OUT_CHANNEL),
  }),
  data: Object.freeze({
    /** Resolves with every local data category, its owner and rule, held counts and real-data blockers. */
    getPolicy: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(DATA_POLICY_CHANNEL, ...args),
    /** Main asks where to save, then exports; resolves with `{ ok, reason?, export? }`. Takes no arguments. */
    export: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(DATA_EXPORT_CHANNEL, ...args),
    /** Main asks for an export folder, then reimports; resolves with `{ ok, reason?, import? }`. Takes no arguments. */
    import: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(DATA_IMPORT_CHANNEL, ...args),
    /** Deletes the given category ids; resolves with `{ ok, reason?, delete? }`. */
    delete: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(DATA_DELETE_CHANNEL, ...args),
  }),
  provider: Object.freeze({
    /** Resolves with `{ claude, codex, routes }`: states and storage kinds only, never a key. */
    getStatus: (): Promise<unknown> => ipcRenderer.invoke(PROVIDER_STATUS_CHANNEL),
    /** Hands the entered Claude API key to main once; resolves with `{ ok, reason?, status }`. */
    setClaudeKey: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PROVIDER_SET_CLAUDE_KEY_CHANNEL, ...args),
    /** Runs the free key check against Anthropic's model list; resolves with `{ ok, reason?, status }`. */
    verifyClaudeKey: (): Promise<unknown> => ipcRenderer.invoke(PROVIDER_VERIFY_CLAUDE_KEY_CHANNEL),
    /** Deletes the stored Claude API key; resolves with `{ ok, reason?, status }`. */
    removeClaudeKey: (): Promise<unknown> => ipcRenderer.invoke(PROVIDER_REMOVE_CLAUDE_KEY_CHANNEL),
    /** `{ type: 'apiKey', apiKey }` or `{ type: 'chatgpt' }`; resolves with `{ ok, reason?, status }`. */
    codexLogin: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PROVIDER_CODEX_LOGIN_CHANNEL, ...args),
    /** Removes the Codex login from the OS keyring; resolves with `{ ok, reason?, status }`. */
    codexLogout: (): Promise<unknown> => ipcRenderer.invoke(PROVIDER_CODEX_LOGOUT_CHANNEL),
  }),
  organise: Object.freeze({
    /** Resolves with `{ signedIn, sharedService, workspaces, engagementCreation }`. Takes no arguments. */
    getWorkspaces: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_WORKSPACES_CHANNEL, ...args),
    /** `{ workspaceId }`; resolves with `{ ok, value: { engagements, folders, tasks } }` (own Tasks only) or `{ ok: false, reason }`. */
    getTree: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_TREE_CHANNEL, ...args),
    /** Creates the shared-service Engagement, then the local record; resolves with `{ ok, value? , reason? }`. */
    createEngagement: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_CREATE_ENGAGEMENT_CHANNEL, ...args),
    /** Renames or edits an Engagement at an expected revision. */
    updateEngagement: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_UPDATE_ENGAGEMENT_CHANNEL, ...args),
    /** Creates a folder in an Engagement. */
    createFolder: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_CREATE_FOLDER_CHANNEL, ...args),
    /** Creates a private Task (ad hoc, in an Engagement or in a folder). */
    createTask: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_CREATE_TASK_CHANNEL, ...args),
    /** Renames a Task at an expected revision. */
    renameTask: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_RENAME_TASK_CHANNEL, ...args),
    /** Moves a Task to another Engagement and folder, or to none; it stays private. */
    moveTask: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(ORGANISE_MOVE_TASK_CHANNEL, ...args),
  }),
  state: Object.freeze({
    /** `{ taskId }`; resolves with `{ ok, value: { revision, dimensions } }` (all seven, latest first) or `{ ok: false, reason }`. */
    list: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(STATE_LIST_CHANNEL, ...args),
    /** `{ operationId, taskId, expectedRevision, dimension: 'task' | 'run', value, runId }`; main records it as this desktop. */
    recordTaskState: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(STATE_RECORD_TASK_STATE_CHANNEL, ...args),
  }),
  policy: Object.freeze({
    /** Resolves with each Workspace's effective policy on this device and the Capability Contract. Takes no arguments. */
    getSettings: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(POLICY_SETTINGS_CHANNEL, ...args),
    /** `{ taskId }`; resolves with `{ ok, value }` (the Task's policy and broader mode) or `{ ok: false, reason }`. */
    forTask: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(POLICY_FOR_TASK_CHANNEL, ...args),
    /** `{ operationId, taskId, expectedRevision, mode, confirmation }`; a broader mode needs the reach the person confirmed. */
    setBroadMode: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(POLICY_SET_BROAD_MODE_CHANNEL, ...args),
  }),
  permissions: Object.freeze({
    /** `{ taskId }`; resolves with `{ ok, value }` (the Task's pending permission requests as cards) or `{ ok: false, reason }`. */
    pending: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PERMISSIONS_PENDING_CHANNEL, ...args),
    /** `{ operationId, requestId, choice }` with choice `run`, `deny`, `deny-ask` or `deny-forbid`; main records it as the person. */
    decide: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PERMISSIONS_DECIDE_CHANNEL, ...args),
    /** Resolves with each Workspace's command rules and reviewer state, and the person's own rules. Takes no arguments. */
    getRules: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PERMISSIONS_GET_RULES_CHANNEL, ...args),
    /** `{ operationId, expectedRevision, rules }`; the runtime refuses an allow rule. */
    setUserRules: (...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(PERMISSIONS_SET_USER_RULES_CHANNEL, ...args),
  }),
});

contextBridge.exposeInMainWorld('inquello', api);
