/**
 * Sandboxed preload: the renderer's only bridge to main (AD-5).
 *
 * Exposes one frozen `window.inquello` object of named operations. Each
 * operation invokes a fixed channel with validated-by-main arguments; nothing
 * here forwards a channel name, an IPC object or a listener to the renderer.
 *
 * Self-contained by design: a sandboxed preload can `require` only `electron`,
 * so the channel strings are literals that a test checks against
 * `OPERATION_NAMES` in `src/main/security/operations.ts`.
 */
import { contextBridge, ipcRenderer } from 'electron';

const GET_STATUS_CHANNEL = 'inquello:op:runtime.getStatus';

const api = Object.freeze({
  runtime: Object.freeze({
    /** Resolves with `{ state, runtimeVersion }` from main. Takes no arguments. */
    getStatus: (): Promise<unknown> => ipcRenderer.invoke(GET_STATUS_CHANNEL),
  }),
});

contextBridge.exposeInMainWorld('inquello', api);
