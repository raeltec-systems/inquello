---
title: 'Story 1.3: Isolate desktop renderers from host privilege'
type: 'feature'
created: '2026-10-28'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'b4f76c9d8d2da381619392fc99d27de0a193bb0e'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Story 1.2 window is sandboxed but has no bridge at all, so later stories have no safe way to reach the host. Navigation is blocked only on one event, content loads from `file://`, and nothing proves the renderer lacks Node, shell or `child_process` authority (AD-5).

**Approach:** Add a self-contained sandboxed preload that exposes one frozen `window.inquello` object of named operations. The first operation is `runtime.getStatus`. Main registers each operation with a payload validator and accepts calls only from the trusted main frame on the app origin. Serve the renderer from a privileged `inquello://app/` scheme limited to `static/`, and enforce navigation, window, webview, permission and request boundaries in main for every `webContents`. `pnpm smoke` inspects the live renderer's privileges and reports them.

## Boundaries & Constraints

**Always:** `contextIsolation`, `sandbox`, no `nodeIntegration` on every window. Preload imports only `electron`. Every operation gets a validator, and unknown keys or wrong types reject it. Senders are checked by `webContents` identity and frame URL origin. Unknown or failing calls return a plain error and never a stack trace. Policies apply through `app.on('web-contents-created')` so future windows inherit them. Exact dependency pins.

**Never:** No `ipcRenderer`, `send`/`on`/`invoke` passthrough or channel parameter exposed to the renderer. No `shell`, `child_process`, `fs` or `process` reachable from the renderer. No remote origins, `webview` or new windows. No source or artifact preview context (Epics 2–3). No React or UI work (Story 1.5+). No Electron fuses or installer (packaging gate). No new dependencies. No edits under `fork/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Named op | Renderer calls `inquello.runtime.getStatus()` | `{state, runtimeVersion}` from main | N/A |
| Bad payload | Extra arg, wrong type or unknown key | Rejected before the handler runs | Error `invalid payload for <op>` |
| Foreign sender | Call from a subframe, another `webContents` or a non-app origin | Rejected | Error `untrusted sender`, logged |
| Unregistered channel | `invoke` on a name with no registration | No handler exists | Electron default rejection |
| Navigation | `location` change, redirect or link to any URL off `inquello://app/` | Prevented | Logged |
| New window / webview | `window.open`, `<webview>` attach | Denied | Logged |
| Permission | Camera, notifications, clipboard-read, etc. | Denied (request and check handlers) | N/A |
| Outbound request | `http(s)`, `file:` or `ws` from the renderer session | Cancelled | Logged |
| Path escape | `inquello://app/../package.json` or encoded `..` | 404 | Never served |

</frozen-after-approval>

## Code Map

- `desktop/src/main/main.ts` -- creates the window (`webPreferences` set, `setWindowOpenHandler` and `will-navigate` deny), `app.enableSandbox()`, `--smoke`; adds the preload, scheme, policies, registry and privilege probe.
- `desktop/src/main/runtime/process.ts` -- `AppServerRuntime.state`, sole legitimate `child_process` user; reuse it for `getStatus`, do not change.
- `desktop/src/protocol/schema-stamp.json` -- `runtimeVersion` for `getStatus`.
- `desktop/static/index.html` -- CSP meta `default-src 'none'`; keep it and mirror it as a response header.
- `desktop/tsconfig.build.json` -- CommonJS to `dist/`. The sandboxed preload cannot `require` relative files, so it stays one file.
- `desktop/test/helpers.ts` -- `recordingLogger`, `tempDir`; reuse.

## Tasks & Acceptance

**Execution:**
- [x] `desktop/src/main/security/operations.ts` -- operation registry (`name`, payload validator, handler) and `ipcMain.handle` wiring through a sender check; exports the operation-name list -- AC 1.3.1
- [x] `desktop/src/main/security/sender.ts` -- pure `isTrustedSender(frame, trustedWebContentsIds)`: main frame, `inquello://app` origin, tracked `webContents`
- [x] `desktop/src/main/security/policy.ts` -- per-`webContents` hooks (`will-navigate`, `will-redirect`, `will-frame-navigate`, `will-attach-webview`, window open) and session hooks (permission request/check deny, `webRequest` allowlist of `inquello:` and `devtools:`, CSP header); pure `isAppUrl`
- [x] `desktop/src/main/security/app-protocol.ts` -- `protocol.registerSchemesAsPrivileged` (standard, secure) before `ready`; `protocol.handle` serving `static/` only, with a pure `resolveAppPath` that rejects traversal
- [x] `desktop/src/preload/preload.ts` -- `contextBridge.exposeInMainWorld('inquello', frozen { runtime: { getStatus } })`, with fixed channel strings
- [x] `desktop/src/main/main.ts` -- wire the above; `--smoke` runs a renderer probe (typeof `require`/`process`/`module`, `inquello` key tree, `getStatus` result, blocked `window.open`, `fetch('https://example.com')` and navigation attempt) and prints a `renderer-privileges` JSON line; the smoke fails on any unexpected privilege
- [x] `desktop/test/security.test.ts` -- matrix tests on the pure functions and the registry with a fake `ipcMain`/event; the preload is loaded with a mocked `electron` to assert the exact exposed tree and the fixed channels; a source scan asserts that `child_process` appears only under `src/main/runtime/` and that `shell`/`ipcRenderer` never leave the preload
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- advance story 1-3

**Acceptance Criteria:**
- Given the built fork, when `pnpm smoke` runs, then the `renderer-privileges` line shows no `require`/`process`/`module`, `inquello` exposes exactly `runtime.getStatus`, `getStatus` returns `ready`, and window-open, fetch and navigation are all blocked, and the run exits 0.
- Given the renderer, when any channel other than a registered operation is invoked or a registered one gets an invalid payload, then no handler side effect occurs.

### Review Findings

Review pass 2026-10-29, HEAD `ace1ca2`, using `bmad-code-review`. Full evidence, ranking and limitations: [completed-story review](reviews/2026-10-29-epic-1/report.md). Owner selected “Leave as action items” on 2026-10-29. All patch findings remain open; no implementation fixes applied. Review status and sprint tracking synchronized.

No new actionable finding assigned to this story in this pass. This is not exhaustive correctness or platform certification.

#### Rejected

- #2 Blocked-navigation probe list grows in production — `low`; likelihood Low, impact Low. The array is uncapped, but ordinary UI does not repeatedly attempt forbidden navigations. No present memory failure shown; adding production tracking guards for this rare negligible case is not warranted.
- #3 Status reports expected runtime version — `low`; likelihood Low, impact Low. getStatus returns the stamp even after a mismatch, but VersionMismatchError includes the detected version in the failure/log path and the runtime is blocked. Adding another diagnostic state path has little present value.

## Implementation Notes

- **Cloud machine (Linux, root):** dependencies are already installed and the fork is built. Do not commit machine paths. `desktop/.npmrc` pins D: caches, so `pnpm install` needs `electron_config_cache=/home/user/.cache/inquello/electron-cache pnpm install --frozen-lockfile --store-dir /home/user/.cache/inquello/pnpm-store --config.cache-dir=/home/user/.cache/inquello/pnpm-cache`. Node is v22 (engines warns; ignore). Chromium refuses to run as root without `--no-sandbox`, and that flag must never be used. Build as root with `pnpm run build`, then run the smoke as the existing non-root user: `runuser -u smoke -- bash -c 'cd /home/user/inquello/desktop && xvfb-run -a ./node_modules/electron/dist/electron . --smoke'`. Baseline before this story: 43 tests pass and the smoke exits 0. The bubblewrap stderr line is expected.
- **Extra file:** `src/main/smoke-probe.ts` holds the renderer probe script and a pure `evaluatePrivileges`, so the pass/fail rule is unit-tested.
- **Files are read in main:** `inquello://app/` reads files with `fs` rather than `net.fetch(file://)`, so no `file:` request crosses the renderer session. The protocol handler is registered only on the default session, so a future window that uses another partition must register it too.
- **Live checks:** in the smoke, the page's CSP stops `fetch` before it reaches the `webRequest` filter, so the filter is covered by unit tests only. Navigation is caught by `will-frame-navigate`, and the probe accepts a block from either navigation hook. Path traversal, permissions and webview blocking are tested on pure functions and fakes.
- **Results (2026-10-28):** `tsc --noEmit` clean; 153 tests pass (43 from earlier stories, 110 new); the smoke prints `renderer-privileges` with `ok: true` and exits 0. Step-04 review was skipped by owner rule, because Codex reviews the epic PR.

## Design Notes

Sender trust uses both identity (the `webContents` ids main created) and origin (`senderFrame.url` on `inquello://app`, and `senderFrame === webContents.mainFrame`). Either check alone allows a navigated or embedded frame through.

## Verification

**Commands (in `desktop/`):**
- `pnpm install --frozen-lockfile` -- expected: success
- `pnpm exec tsc --noEmit` -- expected: no errors
- `pnpm test` -- expected: all tests pass, including the Story 1.2 suites
- `pnpm smoke` (under `xvfb-run` on Linux) -- expected: handshake and `renderer-privileges` lines, exit 0
