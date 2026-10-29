/**
 * Story 1.13 against the real `codex-app-server`:
 * - Codex API-key login with the runtime inside its own D-Bus session with an
 *   unlocked gnome-keyring: the login lands in the OS keyring (read back with
 *   `secret-tool` from a second session), no `auth.json` or secrets file is
 *   written, and logout removes the keyring entry.
 * - Without a keyring the login fails with the stated reason and stores nothing.
 * - Provider variables in the desktop's environment never reach the runtime
 *   (`/proc/<pid>/environ`), and the route shows not connected.
 * - Identity independence: Inquello sign-out leaves both routes as they were,
 *   and removing both routes leaves the Inquello identity as it was.
 * - A sentinel key set through both routes (through the operations, as the
 *   renderer would) appears nowhere: not in the operation results, logs, the
 *   app-server stderr log, an export, any file under userData (the vault holds
 *   ciphertext), or the environment of any runtime process.
 *
 * The keyring rows need `dbus-run-session`, `gnome-keyring-daemon` and
 * `secret-tool` (skipped without them).
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { DataService, ExportJournal, governedRoots, loadShippedPolicy, type GovernedRoots } from '../src/main/data';
import { CredentialVault } from '../src/main/identity/vault';
import { IdentitySession } from '../src/main/identity/session';
import { ANTHROPIC_BASE_URL, ClaudeKeyVault, CODEX_REASONS, CodexAccount, ProviderService, providersDir } from '../src/main/providers';
import { AppServerRuntime, isProviderCredentialVar, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import { channelFor, createOperations, registerOperations, type IpcMainLike } from '../src/main/security/operations';
import type { InvokeEventLike } from '../src/main/security/sender';
import { sentinelNeedles } from '../src/main/smoke-probe';
import { CONFIG, FakeIssuer, FakeService, fakeOpener, fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const binary = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });

const onPath = (tool: string) => (process.env.PATH ?? '').split(path.delimiter).some((dir) => fs.existsSync(path.join(dir, tool)));
const keyringTools = process.platform === 'linux' && ['dbus-run-session', 'gnome-keyring-daemon', 'secret-tool'].every(onPath);

/** Runs `$0 "$@"` inside the D-Bus session after unlocking a gnome-keyring (password `testpw`). */
const UNLOCK = 'echo -n testpw | gnome-keyring-daemon --unlock --components=secrets >/dev/null; exec "$0" "$@"';

const runtimes: AppServerRuntime[] = [];
afterAll(async () => {
  for (const runtime of runtimes) await runtime.stop();
  // The runtime's background plugin sync may still be finishing in its home.
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  removeTempDirs();
});

/** An environment without the developer's own D-Bus, keyring or XDG locations, with HOME at `home`. */
function isolatedEnv(home: string, extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const base: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('DBUS_') || key.startsWith('XDG_') || key === 'GNOME_KEYRING_CONTROL') continue;
    base[key] = value;
  }
  return { ...base, HOME: home, ...extra };
}

interface Harness {
  roots: GovernedRoots;
  home: string;
  runtime: AppServerRuntime;
  logger: ReturnType<typeof recordingLogger>;
  stderrLogPath: string;
}

/** Starts the real runtime the way main does: own runtime home with the keyring config, stripped env. */
async function startRuntime(options: { keyring: boolean; base?: NodeJS.ProcessEnv; onNotification?: (method: string, params: unknown) => void }): Promise<Harness> {
  const userData = tempDir('providers-int-ud');
  const home = tempDir('providers-int-home');
  const roots = governedRoots(userData, path.join(userData, 'logs'));
  fs.mkdirSync(roots['runtime-home'], { recursive: true, mode: 0o700 });
  writeRuntimeConfig(roots['runtime-home']);
  const logger = recordingLogger();
  const stderrLogPath = path.join(roots.logs, 'app-server-stderr.log');
  const base = options.base ?? isolatedEnv(home, options.keyring ? {} : { DBUS_SESSION_BUS_ADDRESS: 'unix:path=/nonexistent/inquello-test-bus' });
  const runtime = new AppServerRuntime({
    command: options.keyring ? 'dbus-run-session' : binary.path,
    commandArgsPrefix: options.keyring ? ['--', 'sh', '-c', UNLOCK, binary.path] : [],
    env: runtimeChildEnv(base, { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', codexHome: roots['runtime-home'], blocked: ['INQUELLO_PROVIDER_DEV_CONFIG'] }),
    clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
    schemaStamp,
    stderrLogPath,
    handshakeTimeoutMs: 60_000,
    logger,
    onNotification: ({ method, params }) => options.onNotification?.(method, params),
  });
  runtimes.push(runtime);
  await runtime.start();
  return { roots, home, runtime, logger, stderrLogPath };
}

function providerService(h: Harness, backend = 'gnome_libsecret') {
  const codex = new CodexAccount({
    runtime: { ready: () => h.runtime.state === 'ready', request: (method, params) => h.runtime.request(method, params) },
    openBrowser: async () => undefined,
    logger: h.logger,
  });
  const vault = new ClaudeKeyVault({ safeStorage: fakeSafeStorage(backend), platform: 'linux', dir: providersDir(h.roots['user-data']) });
  return new ProviderService({ vault, codex, devConfig: { kind: 'default', target: { baseUrl: ANTHROPIC_BASE_URL } }, verify: async () => 'verified', logger: h.logger });
}

/** What a second D-Bus session sees in the keyring under HOME `home` for the runtime's service name. */
function keyringEntries(home: string): string {
  try {
    return execFileSync('dbus-run-session', ['--', 'sh', '-c', UNLOCK, 'secret-tool', 'search', '--all', 'service', 'Codex Auth'], {
      env: isolatedEnv(home),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
  } catch (error) {
    return String((error as { stdout?: string }).stdout ?? '');
  }
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** `pid` and every process below it (Linux `/proc`). */
function processTree(pid: number): number[] {
  const out = [pid];
  for (let i = 0; i < out.length; i += 1) {
    const current = out[i]!;
    let children = '';
    try {
      children = fs.readFileSync(`/proc/${current}/task/${current}/children`, 'utf8');
    } catch {
      continue;
    }
    for (const child of children.split(/\s+/).filter(Boolean)) out.push(Number(child));
  }
  return out;
}

class FakeIpc implements IpcMainLike {
  readonly handlers = new Map<string, (event: InvokeEventLike, ...args: unknown[]) => unknown>();
  handle(channel: string, listener: (event: InvokeEventLike, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener);
  }
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const frame = { url: 'inquello://app/index.html', frameTreeNodeId: 1, parent: null };
    return Promise.resolve(this.handlers.get(channel)!({ sender: { id: 1, mainFrame: frame }, senderFrame: frame }, ...args));
  }
}

describe.skipIf(!keyringTools)('Codex login in the OS keyring (real app-server, gnome-keyring)', () => {
  let h: Harness;
  let providers: ProviderService;
  beforeAll(async () => {
    h = await startRuntime({ keyring: true, onNotification: (method, params) => providers?.codex.handleNotification(method, params) });
    providers = providerService(h);
  }, 90_000);

  it('stores an API-key login in the keyring with no auth.json, and logout removes it (matrix: Codex API-key login, Codex logout)', async () => {
    const apiKey = `sk-proj-inquello-test-${randomUUID()}`;
    expect((await providers.getStatus()).codex).toEqual({ state: 'not-connected', account: null, credentialStore: 'os-keyring' });
    const login = await providers.codexLogin({ type: 'apiKey', apiKey });
    expect(login).toMatchObject({ ok: true, status: { codex: { state: 'connected', account: { type: 'apiKey' } } } });
    expect(await h.runtime.request('account/read', {})).toMatchObject({ account: { type: 'apiKey' } });
    const home = h.roots['runtime-home'];
    expect(fs.existsSync(path.join(home, 'auth.json'))).toBe(false);
    expect(fs.existsSync(path.join(home, 'secrets'))).toBe(false);
    expect(fs.readFileSync(path.join(home, 'config.toml'), 'utf8')).toMatch(/cli_auth_credentials_store = "keyring"/);
    const stored = keyringEntries(h.home);
    expect(stored).toMatch(/Codex Auth/);
    expect(stored).toContain(apiKey);

    const logout = await providers.codexLogout();
    expect(logout).toMatchObject({ ok: true, status: { codex: { state: 'not-connected', account: null } } });
    expect(keyringEntries(h.home)).not.toMatch(/Codex Auth/);
    expect(fs.existsSync(path.join(home, 'auth.json'))).toBe(false);
  }, 60_000);

  it('keeps provider routes through Inquello sign-out, and the identity through provider removal (matrix: Identity independence)', async () => {
    const service = new FakeService();
    const issuer = new FakeIssuer();
    const { opener } = fakeOpener(issuer);
    const identity = new IdentitySession({
      config: { kind: 'configured', config: CONFIG },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: path.join(h.roots['user-data'], 'identity') }),
      service,
      issuer,
      openBrowser: opener,
      logger: h.logger,
      callbackTimeoutMs: 2_000,
    });
    expect((await identity.signIn()).ok).toBe(true);
    await providers.setClaudeKey(`sk-ant-api03-inquello-test-${randomUUID()}`);
    await providers.codexLogin({ type: 'apiKey', apiKey: `sk-proj-inquello-test-${randomUUID()}` });
    const connected = await providers.getStatus();
    expect(connected.claude.state).toBe('stored-unverified');
    expect(connected.codex.state).toBe('connected');

    // Inquello sign-out: provider states unchanged, credentials kept.
    expect((await identity.signOut()).ok).toBe(true);
    expect((await identity.getStatus()).identity.state).toBe('signed-out');
    expect(await providers.getStatus()).toEqual(connected);
    expect(fs.existsSync(providers.vault.filePath)).toBe(true);
    expect(keyringEntries(h.home)).toMatch(/Codex Auth/);

    // Provider removal: the identity stays signed in.
    expect((await identity.signIn()).ok).toBe(true);
    const identityBefore = await identity.getStatus();
    expect((await providers.removeClaudeKey()).status.claude.state).toBe('not-configured');
    expect((await providers.codexLogout()).status.codex.state).toBe('not-connected');
    expect(await identity.getStatus()).toEqual(identityBefore);
    expect(identityBefore.identity.state).toBe('signed-in');
    expect(fs.existsSync(providers.vault.filePath)).toBe(false);
    expect(keyringEntries(h.home)).not.toMatch(/Codex Auth/);
  }, 60_000);

  it('finds a sentinel set through both routes nowhere outside the vault and the keyring (matrix: Sentinel leak scan, Renderer probe)', async () => {
    const random = randomUUID();
    const sentinel = `sk-ant-api03-inquello-sentinel-${random}`;
    const needles = sentinelNeedles(sentinel, random);
    const load = loadShippedPolicy();
    if (!load.ok) throw new Error(load.error);
    const exportBase = tempDir('providers-int-export');
    const data = new DataService({
      load,
      roots: h.roots,
      journal: new ExportJournal(h.roots['user-data']),
      runtime: { stop: async () => undefined, start: async () => undefined, activeTasks: () => 0 },
      identity: { principal: async () => null, holdsSession: () => false, signOut: async () => ({ ok: true }), forgetLocally: () => undefined },
      providers: { forgetClaudeKey: () => undefined, holdsClaudeKey: () => false },
      chooseExportDestination: async () => path.join(exportBase, 'export'),
      chooseImportSource: async () => null,
      clearBrowserProfile: async () => undefined,
      appVersion: '0.0.0-test',
      runtimeVersion: schemaStamp.runtimeVersion,
      logger: h.logger,
    });
    const ipc = new FakeIpc();
    registerOperations(
      ipc,
      createOperations({
        runtimeState: () => h.runtime.state,
        runtimeVersion: schemaStamp.runtimeVersion,
        identity: {
          getStatus: async () => ({ identity: { state: 'signed-out' }, sharedService: 'not-configured', credentialStorage: 'os-backed', privateWork: 'local' }),
          signIn: async () => ({ ok: false, status: { identity: { state: 'signed-out' }, sharedService: 'not-configured', credentialStorage: 'os-backed', privateWork: 'local' } }),
          signOut: async () => ({ ok: true, status: { identity: { state: 'signed-out' }, sharedService: 'not-configured', credentialStorage: 'os-backed', privateWork: 'local' } }),
        },
        data: {
          getPolicy: () => data.getPolicy(),
          exportData: () => data.exportData(),
          importData: () => data.importData(),
          deleteData: (categories) => data.deleteData(categories),
          deletableCategories: () => data.deletableCategories(),
        },
        provider: providers,
      }),
      { trustedWebContentsIds: new Set([1]), logger: h.logger },
    );

    // What the renderer would receive while the sentinel is set.
    const seen: unknown[] = [];
    seen.push(await ipc.invoke(channelFor('provider.setClaudeKey'), sentinel));
    seen.push(await ipc.invoke(channelFor('provider.codexLogin'), { type: 'apiKey', apiKey: sentinel }));
    seen.push(await ipc.invoke(channelFor('provider.verifyClaudeKey')));
    seen.push(await ipc.invoke(channelFor('provider.getStatus')));
    seen.push(await ipc.invoke(channelFor('data.getPolicy')));
    const exported = (await ipc.invoke(channelFor('data.export'))) as { ok: boolean; export: { path: string } };
    seen.push(exported);
    expect(exported.ok).toBe(true);
    expect(seen[1]).toMatchObject({ ok: true, status: { codex: { state: 'connected' } } });
    expect(keyringEntries(h.home)).toContain(sentinel);

    const found: string[] = [];
    const check = (where: string, haystack: string) => {
      if (needles.some((needle) => haystack.includes(needle))) found.push(where);
    };
    check('operation results', JSON.stringify(seen));
    for (const file of [...filesUnder(h.roots['user-data']), ...filesUnder(h.roots.logs), ...filesUnder(exported.export.path)]) {
      check(path.relative(h.roots['user-data'], file), fs.readFileSync(file).toString('latin1'));
    }
    check('app-server stderr log', fs.readFileSync(h.stderrLogPath, 'latin1'));
    check('desktop log', h.logger.messages.join('\n'));
    let environs = 0;
    for (const pid of processTree(h.runtime.pid!)) {
      try {
        check(`/proc/${pid}/environ`, fs.readFileSync(`/proc/${pid}/environ`, 'latin1'));
        environs += 1;
      } catch {
        // Exited.
      }
    }
    expect(environs).toBeGreaterThanOrEqual(2); // dbus-run-session and the app-server itself.
    expect(found).toEqual([]);
    // The vault file exists and holds only ciphertext.
    expect(fs.existsSync(providers.vault.filePath)).toBe(true);

    await providers.removeClaudeKey();
    await providers.codexLogout();
    for (const file of filesUnder(h.roots['user-data'])) check(`after removal: ${file}`, fs.readFileSync(file).toString('latin1'));
    expect(found).toEqual([]);
    expect(keyringEntries(h.home)).not.toContain(sentinel);
  }, 60_000);
});

describe('Codex login without an OS keyring (real app-server)', () => {
  it('fails with the stated reason and stores nothing, with no auth.json fallback (matrix: Codex API-key login, keyring missing)', async () => {
    const h = await startRuntime({ keyring: false });
    const providers = providerService(h);
    const apiKey = `sk-proj-inquello-test-${randomUUID()}`;
    const result = await providers.codexLogin({ type: 'apiKey', apiKey });
    expect(result).toMatchObject({ ok: false, reason: CODEX_REASONS.keyringUnavailable, status: { codex: { state: 'not-connected' } } });
    expect(await h.runtime.request('account/read', {})).toMatchObject({ account: null });
    expect(fs.existsSync(path.join(h.roots['runtime-home'], 'auth.json'))).toBe(false);
    for (const file of filesUnder(h.roots['user-data'])) expect(fs.readFileSync(file).toString('latin1'), file).not.toContain(apiKey);
    expect(h.logger.messages.join('\n')).not.toContain(apiKey);
    await h.runtime.stop();
  }, 60_000);
});

describe('inherited provider variables (real app-server)', () => {
  it.skipIf(process.platform !== 'linux')('never reach the runtime, and the Codex route shows not connected (matrix: Inherited env key)', async () => {
    const home = tempDir('providers-int-env-home');
    const inherited = {
      OPENAI_API_KEY: `sk-inherited-openai-${randomUUID()}`,
      ANTHROPIC_API_KEY: `sk-ant-inherited-${randomUUID()}`,
      CODEX_API_KEY: `sk-inherited-codex-${randomUUID()}`,
      AZURE_OPENAI_API_KEY: `inherited-azure-${randomUUID()}`,
      CODEX_ACCESS_TOKEN: `inherited-token-${randomUUID()}`,
    };
    const h = await startRuntime({ keyring: false, base: isolatedEnv(home, { ...inherited, DBUS_SESSION_BUS_ADDRESS: 'unix:path=/nonexistent/inquello-test-bus' }) });
    const environ = fs.readFileSync(`/proc/${h.runtime.pid}/environ`, 'latin1');
    const names = environ
      .split('\0')
      .filter(Boolean)
      .map((entry) => entry.slice(0, entry.indexOf('=')));
    expect(names).toContain('CODEX_HOME');
    // Names only: a failure must not print the values of the developer's own environment.
    expect(names.filter((name) => isProviderCredentialVar(name) || Object.hasOwn(inherited, name))).toEqual([]);
    expect(Object.values(inherited).filter((value) => environ.includes(value))).toEqual([]);
    const providers = providerService(h);
    expect((await providers.getStatus()).codex).toEqual({ state: 'not-connected', account: null, credentialStore: 'os-keyring' });
    await h.runtime.stop();
  }, 60_000);
});
