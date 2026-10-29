/**
 * Story 1.19 end to end: every filesystem and network row of the I/O matrix
 * through the single path (`PolicyService.effectiveThreadSettings` and
 * `runTool`), the real `codex-app-server` (`inquello/policy/effective`,
 * `inquello/tools/exec` over the runtime's own command execution), the local
 * sandbox with the bundled bubblewrap and the runtime's network proxy.
 *
 * The Workspace membership and Tasks come from the dev topology; the
 * Workspace `execution` section is switched per case by wrapping the real
 * service's answer, so each policy is validated again by the runtime.
 *
 * Needs `INQUELLO_TEST_DATABASE_URL` (skipped without it), the built
 * `codex-app-server` with `bwrap` beside it, `curl`, and
 * `inquello-dev-topology` built with the `test-issuer` feature.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { loadServiceConfig, SERVICE_CONFIG_ENV, type ServiceConfig } from '../src/main/identity/config';
import { headlessOpener } from '../src/main/identity/headless-opener';
import { IssuerClient, SharedServiceClient, httpsTransport } from '../src/main/identity/service-client';
import { IdentitySession } from '../src/main/identity/session';
import { CredentialVault } from '../src/main/identity/vault';
import { OrganiseService } from '../src/main/organise';
import {
  BROAD_MODE_REACH,
  networkDenialText,
  PermissionMediator,
  outsideDenialText,
  PolicyService,
  POLICY_REASONS,
  type ExecutionPolicyRoutes,
  type ToolRunView,
} from '../src/main/policy';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);
const PERMITTED = 'working folder (read/write), output folder, system (read-only)';

let topology: ChildProcess | undefined;
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;
let runtimeHome: string;
let workingStoreDir: string;
/** The `execution` section the Workspace policy carries for the current case. */
let execution: Record<string, unknown> | null = null;
let revision = 1;

async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Bounds Co', '--seed-out', seedFile], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: topology.stdout! });
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the topology printed nothing')), 60_000);
    lines.once('line', (text) => {
      clearTimeout(timer);
      resolve(text);
    });
    topology!.once('exit', (code) => reject(new Error(`the topology exited (${code})`)));
  });
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, line);
  const loaded = loadServiceConfig({ [SERVICE_CONFIG_ENV]: file });
  if (loaded.kind !== 'configured') throw new Error('the topology line is not a valid config');
  config = loaded.config;
  seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as typeof seed;
}

async function stopTopology(): Promise<void> {
  const child = topology;
  topology = undefined;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin!.end();
  await exited;
}

const ok = <T,>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`expected success, got: ${result.reason}`);
  return result.value;
};

const newTask = async (title: string): Promise<string> =>
  ok(await organise.createTask({ operationId: randomUUID(), workspaceId: seed.workspace_id, engagementId: null, folderId: null, title })).taskId;

const run = async (taskId: string, command: string[]): Promise<ToolRunView> => ok(await policy.runTool(taskId, command, { timeoutMs: 30_000 }));
const texts = (view: ToolRunView): string[] => view.denials.map((denial) => denial.text);

function usePolicy(next: Record<string, unknown> | null): void {
  execution = next;
  revision += 1;
}

describe.skipIf(!databaseConfigured)('bounded tool reads, writes and network against the real runtime and local sandbox', () => {
  beforeAll(async () => {
    const dir = tempDir('tool-bounds');
    await startTopology(dir);
    runtimeHome = path.join(dir, 'runtime-home');
    const workingStore = path.join(dir, 'working', 'working.sqlite');
    workingStoreDir = path.dirname(workingStore);
    fs.mkdirSync(workingStoreDir, { recursive: true, mode: 0o700 });
    writeRuntimeConfig(runtimeHome);
    runtime = new AppServerRuntime({
      command: appServer.path,
      env: runtimeChildEnv(process.env, { serviceConfigEnv: SERVICE_CONFIG_ENV, codexHome: runtimeHome, workingStore }),
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(dir, 'logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
    });
    await runtime.start();
    const transport = httpsTransport(config.ca);
    const service = new SharedServiceClient(config.serviceUrl, transport);
    identity = new IdentitySession({
      config: { kind: 'configured', config },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: path.join(dir, 'identity') }),
      service,
      issuer: new IssuerClient(config.issuerUrl, transport),
      openBrowser: headlessOpener(transport),
      logger: recordingLogger(),
    });
    expect((await identity.signIn()).ok).toBe(true);
    expect((await identity.withAccess((access) => service.acceptInvite(access, seed.invite_id)))?.workspace_id).toBe(seed.workspace_id);
    // The real membership check, with the case's execution section.
    const routes: ExecutionPolicyRoutes = {
      executionPolicy: async (access, workspaceId) => ({ ...(await service.executionPolicy(access, workspaceId)), policy_revision: String(revision), execution }),
    };
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service: routes, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: workingStoreDir, permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID }) });
  }, 120_000);

  afterAll(async () => {
    await runtime?.stop();
    await stopTopology();
    removeTempDirs();
  });

  it('keeps a standard Task inside its folder, read-only system locations and no destinations', async () => {
    usePolicy(null);
    const task = await newTask('Bounded');
    const other = await newTask('Another Task');
    const settings = ok(await policy.effectiveThreadSettings(task));
    expect(settings.profile).toMatchObject({ sandbox: 'permission-profile', permissionProfileId: `inquello-task-${task}`, networkAllowlist: [] });
    expect(settings.profile.writableRoots).toEqual([settings.folders.working, settings.folders.output]);
    expect(fs.statSync(settings.folders.working).mode & 0o777).toBe(0o700);
    const otherFolder = ok(await policy.effectiveThreadSettings(other)).folders.working;
    fs.writeFileSync(path.join(otherFolder, 'synthetic.txt'), 'synthetic secret');

    // Write inside: succeeds and the file exists on the device.
    const inside = await run(task, ['/bin/sh', '-c', 'printf bounded > output/a.txt && cat output/a.txt']);
    expect([inside.exitCode, inside.stdout, inside.denials]).toEqual([0, 'bounded', []]);
    expect(fs.readFileSync(path.join(settings.folders.output, 'a.txt'), 'utf8')).toBe('bounded');

    // Write outside, into another Task's folder: denied, boundary named, nothing written.
    const target = path.join(otherFolder, 'from-another-task.txt');
    const outside = await run(task, ['/bin/sh', '-c', 'printf x > "$1"', 'bounds', target]);
    expect(outside.exitCode).not.toBe(0);
    expect(texts(outside)).toEqual([outsideDenialText(PERMITTED)]);
    expect(outside.denials[0]).toMatchObject({ kind: 'filesystem', boundary: PERMITTED });
    expect(fs.existsSync(target)).toBe(false);

    // A system location is read only.
    const system = await run(task, ['/bin/sh', '-c', 'printf x > /etc/inquello-tool-bounds']);
    expect(system.exitCode).not.toBe(0);
    expect(texts(system)).toEqual([outsideDenialText('system (read-only)')]);
    // ...but readable: tools can run.
    expect((await run(task, ['/bin/sh', '-c', 'test -r /etc/passwd'])).exitCode).toBe(0);

    // Read outside: another Task's folder is not reachable.
    const read = await run(task, ['/bin/cat', path.join(otherFolder, 'synthetic.txt')]);
    expect(read.exitCode).not.toBe(0);
    expect(read.stdout).not.toContain('synthetic secret');
    expect(texts(read)).toEqual([outsideDenialText(PERMITTED)]);
    // Neither the working store nor the runtime's own configuration is reachable.
    expect((await run(task, ['/bin/sh', '-c', 'test -e "$1"', 'bounds', workingStoreDir])).exitCode).not.toBe(0);
    expect((await run(task, ['/bin/sh', '-c', 'test -e "$1"', 'bounds', path.join(runtimeHome, 'config.toml')])).exitCode).not.toBe(0);

    // No list: every destination is blocked and named.
    const network = await run(task, ['curl', '-sS', '-m', '20', 'http://example.com/']);
    expect(texts(network)).toEqual([networkDenialText('example.com')]);
    expect(network.denials[0]).toMatchObject({ kind: 'network', destination: 'example.com' });
    const tls = await run(task, ['curl', '-sS', '-v', '-m', '20', 'https://example.net/']);
    expect(texts(tls)).toEqual([networkDenialText('example.net')]);

    // Continue: a permitted command after the denials succeeds; the earlier output stays.
    const after = await run(task, ['/bin/sh', '-c', 'cat output/a.txt && printf more > output/b.txt']);
    expect([after.exitCode, after.stdout, after.denials]).toEqual([0, 'bounded', []]);
    expect(fs.readFileSync(path.join(settings.folders.output, 'b.txt'), 'utf8')).toBe('more');

    // The Task view shows the reach in plain words, never a path.
    const view = ok(await policy.forTask(task));
    expect(view.sandbox).toEqual({ status: 'available', label: 'Local OS sandbox on this device.' });
    expect(view.reach.lines.map((line) => line.label)).toEqual(['Can read', 'Can write to', 'Can contact']);
    expect(view.reach.lines.find((line) => line.name === 'contact')!.value).toBe('No network destinations. Every destination is blocked.');
    expect(JSON.stringify(view)).not.toContain(settings.folders.working);
  }, 180_000);

  it('reaches only the listed destinations through the proxy', async () => {
    usePolicy({ network: 'allowed', allowed_domains: ['example.org'] });
    const task = await newTask('Listed destinations');
    const settings = ok(await policy.effectiveThreadSettings(task));
    expect(settings.profile.networkAllowlist).toEqual(['example.org']);
    expect(settings.reach.lines.find((line) => line.name === 'contact')!.value).toBe('Only example.org. Any other destination is blocked.');
    // The listed destination passes the proxy (reachable, or the upstream answer: not a block).
    const allowed = await run(task, ['curl', '-sS', '-m', '20', '-o', '/dev/null', '-w', '%{http_code}', 'http://example.org/']);
    expect(allowed.denials).toEqual([]);
    expect(allowed.stdout).not.toContain('"status":"blocked"');
    // Any other destination is blocked and named.
    const blocked = await run(task, ['curl', '-sS', '-m', '20', 'http://example.com/']);
    expect(texts(blocked)).toEqual([networkDenialText('example.com')]);
  }, 120_000);

  it('makes the Task folder read only under a read_only ceiling', async () => {
    usePolicy({ sandbox: 'read_only' });
    const task = await newTask('Read only');
    const settings = ok(await policy.effectiveThreadSettings(task));
    expect(settings.profile.writableRoots).toEqual([]);
    const folder = await run(task, ['/bin/sh', '-c', 'printf x > notes.txt']);
    expect(folder.exitCode).not.toBe(0);
    expect(texts(folder)).toEqual([outsideDenialText('working folder (read-only)')]);
    const output = await run(task, ['/bin/sh', '-c', 'printf x > output/a.txt']);
    expect(texts(output)).toEqual([outsideDenialText('output folder (read-only)')]);
    expect(fs.existsSync(path.join(settings.folders.working, 'notes.txt'))).toBe(false);
    // Reading the folder still works.
    expect((await run(task, ['/bin/sh', '-c', 'ls output'])).exitCode).toBe(0);
  }, 120_000);

  it('states the true reach of a permitted Full access mode and runs it without the sandbox', async () => {
    usePolicy({ sandbox: 'full_access', approvals: ['untrusted', 'on_request', 'never'], network: 'allowed', allow_full_access: true, allow_no_prompt: true });
    const task = await newTask('Full access');
    ok(await policy.setBroadMode({ operationId: randomUUID(), taskId: task, expectedRevision: 0, mode: 'full_access', confirmation: BROAD_MODE_REACH.full_access }));
    const settings = ok(await policy.effectiveThreadSettings(task));
    expect(settings.profile).toEqual({ sandbox: 'danger-full-access', permissionProfileId: null, permissionProfile: null, readableRoots: [], writableRoots: [], networkAllowlist: null });
    expect(settings.reach.bounded).toBe(false);
    expect(settings.reach.lines[0]!.value).toContain('No filesystem limits');
    const view = ok(await policy.forTask(task));
    expect(view.sandbox.status).toBe('not-applicable');
    // The only unsandboxed path: the working store is visible.
    const visible = await run(task, ['/bin/sh', '-c', 'test -e "$1"', 'bounds', workingStoreDir]);
    expect([visible.exitCode, visible.denials]).toEqual([0, []]);
  }, 120_000);

  it('refuses to run, and says so, when the local sandbox cannot be applied', async () => {
    usePolicy(null);
    const task = await newTask('No sandbox');
    // A check whose target is inside every profile: the sandbox is treated as not applied.
    const routes: ExecutionPolicyRoutes = { executionPolicy: async () => ({ workspace_id: seed.workspace_id, policy_revision: String(revision), authorization_epoch: '1', execution: null }) };
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    const unchecked = new PolicyService({
      runtime: organiseRuntime,
      identity,
      organise,
      service: routes,
      logger: recordingLogger(),
      taskFolders: path.join(path.dirname(runtimeHome), 'tasks'),
      sandboxProbeTarget: '/usr',
      permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID }),
    });
    expect(await unchecked.runTool(task, ['/bin/sh', '-c', 'printf x > output/never.txt'])).toEqual({ ok: false, code: 'sandbox-unavailable', reason: POLICY_REASONS.sandboxUnavailable });
    expect(ok(await unchecked.forTask(task)).sandbox).toEqual({ status: 'unavailable', label: 'Local sandbox unavailable on this device' });
    expect(fs.existsSync(path.join(path.dirname(runtimeHome), 'tasks', task, 'output', 'never.txt'))).toBe(false);
  }, 120_000);
});
