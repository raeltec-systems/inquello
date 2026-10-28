/**
 * Inquello desktop main process.
 *
 * Owns the `codex-app-server` runtime as a stdio child: starts it once Electron
 * is ready and stops it (stdin EOF, bounded grace) before quitting. Opens one
 * sandboxed, context-isolated window with no preload, IPC or Node access.
 *
 * `--smoke` runs headless: it prints the handshake as one JSON line on stdout,
 * quits, prints the runtime's exit as a second JSON line, and exits 0 only if
 * the handshake and version check passed and the runtime exited 0 on its own.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, BrowserWindow } from 'electron';

import schemaStamp from '../protocol/schema-stamp.json';
import { AppServerRuntime, consoleLogger, resolveAppServerBinary, type ExitInfo } from './runtime';

const smoke = process.argv.includes('--smoke');
const logger = consoleLogger;

let runtime: AppServerRuntime | undefined;
let mainWindow: BrowserWindow | undefined;
let handshakeOk = false;
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

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !smoke,
    title: 'Inquello',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webviewTag: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  void window.loadFile(path.join(app.getAppPath(), 'static', 'index.html'));
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

function exitCodeFor(exit: ExitInfo | undefined): number {
  if (!smoke) return 0;
  return handshakeOk && exit !== undefined && exit.exitCode === 0 && !exit.killed ? 0 : 1;
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
  mainWindow = createWindow();
  try {
    await startRuntime();
  } catch (error) {
    logger.error(`app-server runtime did not start: ${(error as Error).message}`);
    if (smoke) app.quit();
    return;
  }
  if (smoke) app.quit();
});
