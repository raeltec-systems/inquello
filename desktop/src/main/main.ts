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
 *
 * Identity (Story 1.10b): main owns the Inquello sign-in (`identity/`). It
 * reads the dev config named by `INQUELLO_SERVICE_CONFIG` (without it the
 * shared service is `not-configured` and nothing is contacted), keeps
 * credentials in main only and persists them only through OS-backed
 * `safeStorage`. The renderer reaches it through the three named
 * `identity.*` operations. In `--smoke`, the identity probe signs in through
 * the headless opener when configured and prints an `identity` line; the run
 * also requires that line to pass.
 *
 * Local data (Story 1.12): the runtime has its own home,
 * `CODEX_HOME = <userData>/runtime-home`, so a personal `~/.codex` is never
 * read or written. Every category the desktop can hold is governed by the
 * shipped register (`data/policy.ts`); the renderer reaches inspect, export,
 * import and delete through the four `data.*` operations, and main shows every
 * folder dialog. Import and delete stop the runtime and restart it afterwards.
 * In `--smoke` the data probe prints a `data` line (policy loaded, every held
 * file classified, the runtime home under userData, and an export plus
 * reimport round trip in temp dirs); the run also requires it to pass.
 *
 * Provider credentials (Story 1.13): main owns two provider routes, separate
 * from the Inquello identity (`providers/`). The Claude API key lives in the
 * provider vault (`<userData>/providers/claude.bin`, OS-backed `safeStorage`
 * or memory-only); the inherited Codex login lives in the OS keyring, which
 * the runtime uses because main writes `config.toml` with
 * `cli_auth_credentials_store = "keyring"` before every start. The runtime
 * child gets no inherited provider credential variable. The renderer reaches
 * both routes through the six `provider.*` operations. In `--smoke` the
 * providers probe connects and disconnects both routes with a sentinel key
 * and prints a `providers` line; the run also requires it to pass.
 *
 * Private Workspace organisation (Story 1.14): the runtime hosts the Inquello
 * working store (`INQUELLO_WORKING_STORE = <userData>/working/working.sqlite`)
 * behind its `inquello/*` methods. Main binds the signed-in principal to the
 * runtime connection, creates Engagements at the shared service first, and is
 * the only caller (`organise/`); the renderer reaches it through the named
 * `organise.*` operations. The app opens on the Shell (Sidebar, Header, Task
 * placeholder); `--smoke` opens the design specimen (`#specimen`) for the
 * earlier probes, then the organise probe drives the Shell and prints an
 * `organise` line; the run also requires it to pass.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, session, type WebContents } from 'electron';

import schemaStamp from '../protocol/schema-stamp.json';
import { DataService, ExportJournal, governedRoots, JOURNAL_DIR, loadShippedPolicy, type GovernedRoots } from './data';
import { createIdentity, headlessOpener, identityDir, SERVICE_CONFIG_ENV, type IdentityWiring } from './identity';
import { openSystemBrowser } from './identity/browser';
import { AppServerRuntime, consoleLogger, isProviderCredentialVar, recordingConsoleLogger, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig, type ExitInfo } from './runtime';
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
import { OrganiseService } from './organise';
import { createProviders, loadProviderDevConfig, PROVIDER_DEV_CONFIG_ENV, providersDir, type ProviderService } from './providers';
import { probeData, probeIdentity, probeOrganise, probeProviders, probeRenderer } from './smoke-probe';

const smoke = process.argv.includes('--smoke');
// The smoke run keeps what main logs, so the providers probe can scan it for a leaked key.
const recordedLogger = smoke ? recordingConsoleLogger() : undefined;
const logger = recordedLogger ?? consoleLogger;

let runtime: AppServerRuntime | undefined;
let mainWindow: BrowserWindow | undefined;
let handshakeOk = false;
let privilegesOk = false;
let designOk = false;
let identityOk = false;
let dataOk = false;
let providersOk = false;
let organiseOk = false;
let organise: OrganiseService | undefined;
let identity: IdentityWiring | undefined;
let providers: ProviderService | undefined;
let dataService: DataService | undefined;
let roots: GovernedRoots | undefined;
/** `webContents` ids main created for app windows; the only trusted operation senders. */
const trustedWebContentsIds = new Set<number>();
const blocked: Array<{ kind: BlockedKind; url: string }> = [];
const policyOptions: PolicyOptions = { logger, onBlocked: (kind, url) => blocked.push({ kind, url }) };
let quitting = false;

if (smoke) {
  // Keep the smoke run's Electron profile, and with it the runtime home, out of
  // the user's real ones. Chromium holds the profile open until the process
  // ends, so it lives at a fixed, reused path; the runtime home inside it is
  // cleared at the start of every smoke run.
  app.setPath('userData', path.join(os.tmpdir(), 'inquello-smoke-user-data'));
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
  // The smoke run's earlier probes read the design specimen; the app opens on the Shell.
  void window.loadURL(smoke ? `${APP_ENTRY_URL}#specimen` : APP_ENTRY_URL);
  return window;
}

/** The Inquello working store (Story 1.14): outside the runtime home, owner-only. */
function workingStorePath(userData: string): string {
  return path.join(userData, 'working', 'working.sqlite');
}

function runtimeEnv(runtimeHome: string, workingStore: string): NodeJS.ProcessEnv {
  return runtimeChildEnv(process.env, { serviceConfigEnv: SERVICE_CONFIG_ENV, codexHome: runtimeHome, workingStore, blocked: [PROVIDER_DEV_CONFIG_ENV, 'INQUELLO_SMOKE_SEED'] });
}

/** Starts a new runtime child in Inquello's own runtime home; also used to restart after import and delete. */
async function startRuntime(): Promise<void> {
  if (!roots) throw new Error('local data roots were not set up');
  const runtimeHome = roots['runtime-home'];
  fs.mkdirSync(runtimeHome, { recursive: true, mode: 0o700 });
  const workingStore = workingStorePath(app.getPath('userData'));
  fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
  // The Codex login lives in the OS keyring only; written before every start.
  writeRuntimeConfig(runtimeHome);
  providers?.codex.runtimeReset();
  const binary = resolveAppServerBinary({
    env: process.env,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
  logger.info(`starting app-server (${binary.source}): ${binary.path}`);
  runtime = new AppServerRuntime({
    command: binary.path,
    env: runtimeEnv(runtimeHome, workingStore),
    clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: app.getVersion() },
    schemaStamp,
    stderrLogPath: path.join(app.getPath('logs'), 'app-server-stderr.log'),
    logger,
    onNotification: ({ method, params }) => providers?.codex.handleNotification(method, params),
  });
  runtime.on('state', ({ state, error }) => {
    if (state === 'disconnected' && error) logger.error(`runtime disconnected; not restarting. ${error.message}`);
  });
  const handshake = await runtime.start();
  if (smoke && !handshakeOk) {
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
  handshakeOk = true;
  // A new runtime process has no principal bound yet.
  await organise?.syncPrincipal().catch((error: unknown) => logger.warn(`organise: principal not bound after start (${(error as Error).message})`));
}

async function stopRuntime(): Promise<void> {
  const current = runtime;
  if (!current) return;
  const exit = await current.stop();
  logger.info(`app-server stopped (code ${exit.exitCode}, signal ${exit.signal}, killed ${exit.killed})`);
}

function exportStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

async function chooseExportDestination(): Promise<string | null> {
  const options: Electron.SaveDialogOptions = {
    title: 'Export local data',
    buttonLabel: 'Export',
    defaultPath: path.join(app.getPath('documents'), `inquello-export-${exportStamp()}`),
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  };
  const result = mainWindow ? await dialog.showSaveDialog(mainWindow, options) : await dialog.showSaveDialog(options);
  return result.canceled || !result.filePath ? null : result.filePath;
}

async function chooseImportSource(): Promise<string | null> {
  const options: Electron.OpenDialogOptions = { title: 'Import local data', buttonLabel: 'Import', properties: ['openDirectory'] };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
  return result.canceled || result.filePaths.length !== 1 ? null : result.filePaths[0]!;
}

async function runSmokeProbe(contents: WebContents): Promise<void> {
  const { privileges, design } = await probeRenderer(contents, blocked, schemaStamp.runtimeVersion);
  privilegesOk = privileges.ok;
  designOk = design.ok;
  process.stdout.write(`${JSON.stringify({ event: 'renderer-privileges', ...privileges })}\n`);
  process.stdout.write(`${JSON.stringify({ event: 'design', ...design })}\n`);
  if (!privileges.ok) logger.error(`renderer privilege probe failed: ${privileges.failures.join('; ')}`);
  if (!design.ok) logger.error(`design probe failed: ${design.failures.join('; ')}`);
  if (!identity) throw new Error('identity was not wired');
  const report = await probeIdentity(contents, identity);
  identityOk = report.ok;
  process.stdout.write(`${JSON.stringify({ event: 'identity', ...report })}\n`);
  if (!report.ok) logger.error(`identity probe failed: ${report.failures.join('; ')}`);
  if (!dataService || !roots) throw new Error('local data was not wired');
  const data = await probeData(contents, { service: dataService, roots, codexHome: runtime?.handshake?.codexHome ?? null, tempBase: os.tmpdir() });
  dataOk = data.ok;
  process.stdout.write(`${JSON.stringify({ event: 'data', ...data })}\n`);
  if (!data.ok) logger.error(`data probe failed: ${data.failures.join('; ')}`);
  if (!providers) throw new Error('providers were not wired');
  const providerReport = await probeProviders(contents, {
    providers,
    identity,
    data: dataService,
    roots,
    runtimePid: () => runtime?.pid,
    stderrLogPath: path.join(app.getPath('logs'), 'app-server-stderr.log'),
    mainLog: () => recordedLogger?.messages() ?? [],
    tempBase: os.tmpdir(),
  });
  providersOk = providerReport.ok;
  process.stdout.write(`${JSON.stringify({ event: 'providers', ...providerReport })}\n`);
  if (!providerReport.ok) logger.error(`providers probe failed: ${providerReport.failures.join('; ')}`);
  if (!organise) throw new Error('organise was not wired');
  const organiseReport = await probeOrganise(contents, {
    identity,
    organise,
    seedFile: process.env.INQUELLO_SMOKE_SEED ?? null,
    runtimeRequest: <T,>(method: string, params?: unknown) => (runtime ? runtime.request<T>(method, params) : Promise.reject(new Error('the runtime is not running'))),
  });
  organiseOk = organiseReport.ok;
  process.stdout.write(`${JSON.stringify({ event: 'organise', ...organiseReport })}\n`);
  if (!organiseReport.ok) logger.error(`organise probe failed: ${organiseReport.failures.join('; ')}`);
}

function exitCodeFor(exit: ExitInfo | undefined): number {
  if (!smoke) return 0;
  return handshakeOk && privilegesOk && designOk && identityOk && dataOk && providersOk && organiseOk && exit !== undefined && exit.exitCode === 0 && !exit.killed ? 0 : 1;
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
  const userData = app.getPath('userData');
  roots = governedRoots(userData, app.getPath('logs'));
  if (smoke) {
    // The smoke run starts signed out, with an empty runtime home and no export journal.
    fs.rmSync(identityDir(userData), { recursive: true, force: true });
    fs.rmSync(roots['runtime-home'], { recursive: true, force: true, maxRetries: 3 });
    fs.rmSync(path.join(userData, JOURNAL_DIR), { recursive: true, force: true });
    // No working store from an earlier run: the organise probe starts empty.
    fs.rmSync(path.dirname(workingStorePath(userData)), { recursive: true, force: true });
    // No Claude API key from an earlier run.
    fs.rmSync(providersDir(userData), { recursive: true, force: true });
    // The providers probe checks that an inherited provider key never reaches the runtime.
    if (!Object.keys(process.env).some((name) => isProviderCredentialVar(name))) {
      process.env.OPENAI_API_KEY = `sk-inherited-smoke-${randomUUID()}`;
    }
  }
  identity = createIdentity({
    env: process.env,
    safeStorage,
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    logger,
    // The smoke run plays the browser's part headlessly; the app always uses the system browser.
    opener: (transport) => (smoke && transport ? headlessOpener(transport) : openSystemBrowser),
    recordSecrets: smoke,
  });
  const identitySession = identity.session;
  const organiseService = new OrganiseService({
    runtime: {
      ready: () => runtime?.state === 'ready',
      instance: () => runtime,
      request: <T,>(method: string, params?: unknown) => (runtime ? runtime.request<T>(method, params) : Promise.reject(new Error('the runtime is not running'))),
    },
    identity: identitySession,
    service: identity.service,
    logger,
  });
  organise = organiseService;
  /** Rebinds the runtime's principal after a sign-in change. */
  const afterIdentityChange = async <T,>(result: T): Promise<T> => {
    await organiseService.syncPrincipal().catch((error: unknown) => logger.warn(`organise: principal not rebound (${(error as Error).message})`));
    return result;
  };
  providers = createProviders({
    safeStorage,
    platform: process.platform,
    userDataDir: userData,
    runtime: {
      ready: () => runtime?.state === 'ready',
      request: <T,>(method: string, params?: unknown) => (runtime ? runtime.request<T>(method, params) : Promise.reject(new Error('the runtime is not running'))),
    },
    openBrowser: openSystemBrowser,
    devConfig: loadProviderDevConfig(process.env, !app.isPackaged),
    logger,
    recordSecrets: smoke,
  });
  const providerService = providers;
  const policyLoad = loadShippedPolicy();
  if (!policyLoad.ok) logger.error(`local data policy did not load; local data actions are blocked: ${policyLoad.error}`);
  const service = new DataService({
    load: policyLoad,
    roots,
    journal: new ExportJournal(userData),
    runtime: {
      stop: stopRuntime,
      start: startRuntime,
      // No Task can run before Story 1.25 adds them; this is where their count will come from.
      activeTasks: () => 0,
    },
    identity: {
      principal: async () => {
        const state = identitySession.snapshot().identity;
        return state.state === 'signed-in' ? { displayName: state.displayName, issuerLabel: state.issuerLabel } : null;
      },
      holdsSession: () => identitySession.holdsSession(),
      signOut: async () => ({ ok: (await identitySession.signOut()).ok }),
      forgetLocally: () => identitySession.forgetLocally(),
    },
    // The smoke run plays the user's part in the save dialog with a fresh temp folder.
    chooseExportDestination: smoke
      ? async () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inquello-smoke-export-')), 'export')
      : chooseExportDestination,
    chooseImportSource: smoke ? async () => null : chooseImportSource,
    clearBrowserProfile: async () => {
      await session.defaultSession.clearStorageData();
      await session.defaultSession.clearCache();
    },
    appVersion: app.getVersion(),
    runtimeVersion: schemaStamp.runtimeVersion,
    logger,
  });
  dataService = service;
  registerOperations(
    ipcMain,
    createOperations({
      runtimeState: () => runtime?.state ?? 'stopped',
      runtimeVersion: schemaStamp.runtimeVersion,
      identity: {
        getStatus: () => identitySession.getStatus(),
        signIn: async () => afterIdentityChange(await identitySession.signIn()),
        signOut: async () => afterIdentityChange(await identitySession.signOut()),
      },
      data: {
        getPolicy: () => service.getPolicy(),
        exportData: () => service.exportData(),
        importData: () => service.importData(),
        deleteData: (categories) => service.deleteData(categories),
        deletableCategories: () => service.deletableCategories(),
      },
      provider: {
        getStatus: () => providerService.getStatus(),
        setClaudeKey: (key) => providerService.setClaudeKey(key),
        verifyClaudeKey: () => providerService.verifyClaudeKey(),
        removeClaudeKey: () => providerService.removeClaudeKey(),
        codexLogin: (request) => providerService.codexLogin(request),
        codexLogout: () => providerService.codexLogout(),
      },
      organise: {
        getWorkspaces: () => organiseService.getWorkspaces(),
        getTree: (workspaceId) => organiseService.getTree(workspaceId),
        createEngagement: (input) => organiseService.createEngagement(input),
        updateEngagement: (input) => organiseService.updateEngagement(input),
        createFolder: (input) => organiseService.createFolder(input),
        createTask: (input) => organiseService.createTask(input),
        renameTask: (input) => organiseService.renameTask(input),
        moveTask: (input) => organiseService.moveTask(input),
      },
    }),
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
