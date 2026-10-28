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

const api = Object.freeze({
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
});

contextBridge.exposeInMainWorld('inquello', api);
