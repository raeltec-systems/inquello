/**
 * Inquello desktop main process.
 *
 * Owns the `codex-app-server` runtime as a stdio child: starts it once Electron
 * is ready and stops it (stdin EOF, bounded grace) before quitting.
 *
 * Renderer isolation (AD-5): every window is sandboxed and context-isolated
 * with no Node integration, loads only `inquello://app/` (served from the
 * Vite build in `dist/renderer/`), and reaches main only through the named operations of the
 * self-contained preload. Navigation, window, webview, permission and request
 * policies apply to every `webContents` through `web-contents-created`.
 *
 * `--smoke` runs headless: it prints the handshake as one JSON line on stdout,
 * then probes the live renderer and prints a `renderer-privileges` line and a
 * `design` line, quits, prints the runtime's exit as a final JSON line, and
 * exits 0 only if the handshake and version check passed, the renderer showed
 * no unexpected privilege, the design specimen loaded all five fonts with the
 * right icon semantics, every rendered primitive contrast pair met its
 * threshold, Tab showed the `:focus-visible` indicator on each focus hook, and
 * the runtime exited 0 on its own.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, BrowserWindow, ipcMain, protocol, session, type WebContents } from 'electron';

import schemaStamp from '../protocol/schema-stamp.json';
import { AppServerRuntime, consoleLogger, resolveAppServerBinary, type ExitInfo } from './runtime';
import { APP_SCHEME_PRIVILEGES, handleAppProtocol } from './security/app-protocol';
import { createOperations, registerOperations } from './security/operations';
import {
  APP_ENTRY_URL,
  applyContentsPolicy,
  applySessionPolicy,
  secureWebPreferences,
  type BlockedKind,
  type PolicyOptions,
} from './security/policy';
import { probeRenderer } from './smoke-probe';

const smoke = process.argv.includes('--smoke');
const logger = consoleLogger;

let runtime: AppServerRuntime | undefined;
let mainWindow: BrowserWindow | undefined;
let handshakeOk = false;
let privilegesOk = false;
let designOk = false;
/** `webContents` ids main created for app windows; the only trusted operation senders. */
const trustedWebContentsIds = new Set<number>();
const blocked: Array<{ kind: BlockedKind; url: string }> = [];
const policyOptions: PolicyOptions = { logger, onBlocked: (kind, url) => blocked.push({ kind, url }) };
let quitting = false;
let smokeCodexHome: string | undefined;

if (smoke) {
  // Keep the smoke run's Electron profile and Codex home out of the user's real ones.
  // Chromium holds the profile open until the process ends, so it lives at a fixed,
  // reused path; the Codex home is fresh per run and removed once the runtime exits.
  app.setPath('userData', path.join(os.tmpdir(), 'inquello-smoke-user-data'));
  smokeCodexHome = fs.mkdtempSync(path.join(os.tmpdir(), 'inquello-smoke-codex-home-'));
}

// Every renderer is sandboxed; must be called before `ready`.
app.enableSandbox();
// The app scheme must be privileged before `ready`.
protocol.registerSchemesAsPrivileged([APP_SCHEME_PRIVILEGES]);

// Every webContents, including ones created later, gets the boundary policy.
app.on('web-contents-created', (_event, contents) => {
  applyContentsPolicy(contents, policyOptions);
  applySessionPolicy(contents.session, policyOptions);
});

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !smoke,
    title: 'Inquello',
    webPreferences: secureWebPreferences(path.join(__dirname, '..', 'preload', 'preload.js')),
  });
  const id = window.webContents.id;
  trustedWebContentsIds.add(id);
  window.webContents.once('destroyed', () => trustedWebContentsIds.delete(id));
  void window.loadURL(APP_ENTRY_URL);
  return window;
}

function runtimeEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  if (smokeCodexHome) env.CODEX_HOME = smokeCodexHome;
  return env;
}

async function startRuntime(): Promise<void> {
  const binary = resolveAppServerBinary({
    env: process.env,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
  logger.info(`starting app-server (${binary.source}): ${binary.path}`);
  runtime = new AppServerRuntime({
    command: binary.path,
    env: runtimeEnv(),
    clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: app.getVersion() },
    schemaStamp,
    stderrLogPath: path.join(app.getPath('logs'), 'app-server-stderr.log'),
    logger,
  });
  runtime.on('state', ({ state, error }) => {
    if (state === 'disconnected' && error) logger.error(`runtime disconnected; not restarting. ${error.message}`);
  });
  const handshake = await runtime.start();
  handshakeOk = true;
  if (smoke) {
    process.stdout.write(
      `${JSON.stringify({
        event: 'handshake',
        state: runtime.state,
        versionCheck: 'passed',
        schema: { runtimeVersion: schemaStamp.runtimeVersion, forkTreeHash: schemaStamp.forkTreeHash },
        initialize: handshake,
      })}\n`,
    );
  }
}

async function runSmokeProbe(contents: WebContents): Promise<void> {
  const { privileges, design } = await probeRenderer(contents, blocked, schemaStamp.runtimeVersion);
  privilegesOk = privileges.ok;
  designOk = design.ok;
  process.stdout.write(`${JSON.stringify({ event: 'renderer-privileges', ...privileges })}\n`);
  process.stdout.write(`${JSON.stringify({ event: 'design', ...design })}\n`);
  if (!privileges.ok) logger.error(`renderer privilege probe failed: ${privileges.failures.join('; ')}`);
  if (!design.ok) logger.error(`design probe failed: ${design.failures.join('; ')}`);
}

function exitCodeFor(exit: ExitInfo | undefined): number {
  if (!smoke) return 0;
  return handshakeOk && privilegesOk && designOk && exit !== undefined && exit.exitCode === 0 && !exit.killed ? 0 : 1;
}

app.on('before-quit', (event) => {
  if (quitting) return;
  quitting = true;
  event.preventDefault();
  const stopping = runtime ? runtime.stop() : Promise.resolve(undefined);
  void stopping
    .catch((error: unknown) => {
      logger.error(`runtime stop failed: ${(error as Error).message}`);
      return undefined;
    })
    .then((exit) => {
      try {
        if (smoke) {
          process.stdout.write(`${JSON.stringify({ event: 'runtime-exit', state: runtime?.state ?? 'stopped', exit })}\n`);
        } else if (exit) {
          logger.info(`app-server exited (code ${exit.exitCode}, signal ${exit.signal}, killed ${exit.killed})`);
        }
        mainWindow?.destroy();
        if (smokeCodexHome) fs.rmSync(smokeCodexHome, { recursive: true, force: true, maxRetries: 3 });
      } catch (error) {
        logger.warn(`cleanup after runtime stop failed: ${(error as Error).message}`);
      } finally {
        app.exit(exitCodeFor(exit));
      }
    });
});

app.on('window-all-closed', () => app.quit());

void app.whenReady().then(async () => {
  applySessionPolicy(session.defaultSession, policyOptions);
  handleAppProtocol(protocol, path.join(app.getAppPath(), 'dist', 'renderer'), logger);
  registerOperations(
    ipcMain,
    createOperations({ runtimeState: () => runtime?.state ?? 'stopped', runtimeVersion: schemaStamp.runtimeVersion }),
    { trustedWebContentsIds, logger },
  );
  mainWindow = createWindow();
  try {
    await startRuntime();
  } catch (error) {
    logger.error(`app-server runtime did not start: ${(error as Error).message}`);
    if (smoke) app.quit();
    return;
  }
  if (smoke) {
    try {
      await runSmokeProbe(mainWindow.webContents);
    } catch (error) {
      logger.error(`renderer privilege probe did not run: ${(error as Error).message}`);
    }
    app.quit();
  }
});
