/**
 * Story 1.20 end to end: command rules and permission to act through the
 * single path (`PolicyService.runTool`, the `PermissionMediator`, the real
 * `codex-app-server`'s `inquello/tools/exec` and `inquello/permissions/*`,
 * the runtime's own exec-policy prefix matching), the local sandbox with the
 * bundled bubblewrap, and the working store.
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
  NO_LONGER_PENDING,
  outsideDenialText,
  PermissionMediator,
  PolicyService,
  type ExecutionPolicyRoutes,
  type PermissionCardView,
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
let mediator: PermissionMediator;
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
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Permissions Co', '--seed-out', seedFile], { stdio: ['pipe', 'pipe', 'inherit'] });
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

const texts = (view: ToolRunView): string[] => view.denials.map((denial) => denial.text);

/** Waits until the Task has a pending card for `command` (text) and returns it. */
async function cardFor(taskId: string, command: string): Promise<PermissionCardView> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const cards = ok(await policy.pendingPermissions(taskId));
    const found = cards.find((card) => card.quote === command);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`no card for ${command}`);
}

function usePolicy(next: Record<string, unknown> | null): void {
  execution = next;
  revision += 1;
}

describe.skipIf(!databaseConfigured)('permission to act against the real runtime, its exec-policy matching and the local sandbox', () => {
  beforeAll(async () => {
    const dir = tempDir('permissions');
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
    const routes: ExecutionPolicyRoutes = {
      executionPolicy: async (access, workspaceId) => ({ ...(await service.executionPolicy(access, workspaceId)), policy_revision: String(revision), execution }),
    };
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    mediator = new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service: routes, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: workingStoreDir, permissions: mediator });
  }, 120_000);

  afterAll(async () => {
    await runtime?.stop();
    await stopTopology();
    removeTempDirs();
  });

  const setRules = async (rules: Array<{ prefix: string[]; decision: 'allow' | 'prompt' | 'forbid'; note: string | null }>) => {
    const current = await policy.permissionSettings();
    return policy.setUserRules({ operationId: randomUUID(), expectedRevision: current.userRules?.revision ?? 0, rules });
  };

  it('asks before a prompt-rule command; Deny runs nothing, Run runs it once inside the sandbox', async () => {
    usePolicy({ command_rules: [{ prefix: ['/usr/bin/touch'], decision: 'prompt', note: 'Creates files' }] });
    const task = await newTask('Prompt rule');
    const other = await newTask('Another Task');
    const settings = ok(await policy.effectiveThreadSettings(task));
    ok(await policy.effectiveThreadSettings(other));
    const before = ok(await organise.listStates(task));
    const argv = ['/usr/bin/touch', 'output/asked.txt', `../${other}/outside.txt`];
    const command = argv.join(' ');

    // Deny: nothing runs; the Task continues.
    const denied = policy.runTool(task, argv, { timeoutMs: 30_000 });
    const card = await cardFor(task, command);
    expect(card).toMatchObject({ label: 'Permission to act', primaryLabel: `Run \`${command}\``, rule: `\`/usr/bin/touch\` (prompt), from Workspace policy, revision ${revision}` });
    expect(card.destination).toContain("This Task's working folder");
    expect(card.alternatives.map((alternative) => alternative.label)).toEqual(['Deny', 'Deny and add a rule to always ask', 'Deny and forbid this prefix']);
    expect(ok(await policy.decidePermission({ operationId: randomUUID(), requestId: card.requestId, choice: 'deny' }))).toMatchObject({ outcome: 'denied', text: 'Denied: nothing ran.' });
    expect(await denied).toMatchObject({ ok: false, code: 'permission-denied' });
    expect(fs.existsSync(path.join(settings.folders.output, 'asked.txt'))).toBe(false);
    // A stale confirmation is refused and runs nothing.
    expect(await policy.decidePermission({ operationId: randomUUID(), requestId: card.requestId, choice: 'run' })).toMatchObject({ ok: false, code: 'not-pending', reason: NO_LONGER_PENDING });
    expect(fs.existsSync(path.join(settings.folders.output, 'asked.txt'))).toBe(false);

    // Run: this one request runs, still inside the Task's profile.
    const allowed = policy.runTool(task, argv, { timeoutMs: 30_000 });
    const second = await cardFor(task, command);
    expect(second.requestId).not.toBe(card.requestId);
    expect(ok(await policy.decidePermission({ operationId: randomUUID(), requestId: second.requestId, choice: 'run' })).outcome).toBe('allowed');
    const ran = ok(await allowed);
    expect(ran.permissionRequestId).toBe(second.requestId);
    expect(fs.existsSync(path.join(settings.folders.output, 'asked.txt'))).toBe(true);
    // Allow never lifts the sandbox: the write outside is denied with its boundary.
    expect(ran.exitCode).not.toBe(0);
    expect(texts(ran)).toEqual([outsideDenialText(PERMITTED)]);
    expect(fs.existsSync(path.join(path.dirname(settings.folders.working), other, 'outside.txt'))).toBe(false);
    // The permission was for that one request: the next run asks again.
    const again = policy.runTool(task, argv, { timeoutMs: 30_000 });
    const third = await cardFor(task, command);
    ok(await policy.decidePermission({ operationId: randomUUID(), requestId: third.requestId, choice: 'deny' }));
    expect(await again).toMatchObject({ ok: false, code: 'permission-denied' });

    // No state bleed into review or approval.
    expect(ok(await organise.listStates(task))).toEqual(before);
  }, 180_000);

  it('refuses a forbidden command without a card, naming the rule and its source', async () => {
    usePolicy({ command_rules: [{ prefix: ['/usr/bin/rm'], decision: 'forbid' }] });
    const task = await newTask('Forbid rule');
    const refused = await policy.runTool(task, ['/usr/bin/rm', '-f', 'output/x']);
    expect(refused).toEqual({ ok: false, code: 'command-forbidden', reason: `Refused: \`/usr/bin/rm -f output/x\` is forbidden. Rule: \`/usr/bin/rm\` (forbid), from Workspace policy, revision ${revision}.` });
    expect(ok(await policy.pendingPermissions(task))).toEqual([]);
  }, 60_000);

  it('lets the person\'s forbid win over a Workspace allow, refuses a person\'s allow, and records Deny and forbid', async () => {
    usePolicy({ command_rules: [{ prefix: ['/bin/echo'], decision: 'allow' }, { prefix: ['/bin/cat'], decision: 'prompt' }] });
    const task = await newTask('Conflict');
    expect(ok(await policy.runTool(task, ['/bin/echo', 'allowed'])).stdout.trim()).toBe('allowed');
    expect(await setRules([{ prefix: ['/bin/echo'], decision: 'allow', note: null }])).toMatchObject({ ok: false, code: 'user-rule-cannot-allow' });
    ok(await setRules([{ prefix: ['/bin/echo'], decision: 'forbid', note: null }]));
    const refused = await policy.runTool(task, ['/bin/echo', 'allowed']);
    expect(refused).toMatchObject({ ok: false, code: 'command-forbidden' });
    expect((refused as { reason: string }).reason).toContain('from your rule');

    // "Deny and forbid this prefix": denied, plus the person's forbid rule with its own receipt.
    const asked = policy.runTool(task, ['/bin/cat', 'output/none']);
    const card = await cardFor(task, '/bin/cat output/none');
    const decided = ok(await policy.decidePermission({ operationId: randomUUID(), requestId: card.requestId, choice: 'deny-forbid' }));
    expect(decided).toMatchObject({ outcome: 'denied', rule: { prefix: ['/bin/cat'], decision: 'forbid', sourceLabel: 'Your rule' } });
    expect(await asked).toMatchObject({ ok: false, code: 'permission-denied' });
    const rules = await policy.permissionSettings();
    expect(rules.userRules?.rules.map((rule) => `${rule.prefixText}:${rule.decision}`)).toEqual(['/bin/echo:forbid', '/bin/cat:forbid']);
    expect(rules.workspaces[0]!.rules.map((rule) => `${rule.prefixText}:${rule.decision}:${rule.sourceLabel}`)).toEqual([
      `/bin/echo:allow:Workspace policy, revision ${revision}`,
      `/bin/cat:prompt:Workspace policy, revision ${revision}`,
    ]);
    expect(await policy.runTool(task, ['/bin/cat', 'output/none'])).toMatchObject({ ok: false, code: 'command-forbidden' });
    ok(await setRules([]));
  }, 120_000);

  it('keeps the automatic reviewer off by default and not available without a processing route', async () => {
    usePolicy(null);
    const off = await policy.permissionSettings();
    expect(off.workspaces[0]!.reviewer).toEqual({ enabled: false, state: 'off', label: 'Automated permission review: off. Every request comes to you.' });
    usePolicy({ automatic_permission_review: true, command_rules: [{ prefix: ['/usr/bin/touch'], decision: 'prompt' }] });
    const on = await policy.permissionSettings();
    expect(on.workspaces[0]!.reviewer).toEqual({ enabled: true, state: 'not_available', label: 'Automated permission review: not available (no processing route)' });
    const task = await newTask('Reviewer on');
    expect(ok(await policy.forTask(task)).reviewer.state).toBe('not_available');
    // The request still comes to the person.
    const asked = policy.runTool(task, ['/usr/bin/touch', 'output/r.txt']);
    const card = await cardFor(task, '/usr/bin/touch output/r.txt');
    ok(await policy.decidePermission({ operationId: randomUUID(), requestId: card.requestId, choice: 'deny' }));
    expect(await asked).toMatchObject({ ok: false, code: 'permission-denied' });
    // The runtime's inherited reviewer setting stays with the person.
    expect(fs.readFileSync(path.join(runtimeHome, 'config.toml'), 'utf8')).toMatch(/^approvals_reviewer = "user"$/m);
  }, 120_000);

  it('declines a request no one decides in time and runs nothing', async () => {
    usePolicy({ command_rules: [{ prefix: ['/usr/bin/touch'], decision: 'prompt' }] });
    const task = await newTask('Expiry');
    const settings = ok(await policy.effectiveThreadSettings(task));
    const short = new PermissionMediator({ runtime: { request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) }, logger: recordingLogger(), newId: randomUUID, ttlMs: 1_500 });
    const expiring = new PolicyService({
      runtime: { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) },
      identity,
      organise,
      service: { executionPolicy: async () => ({ workspace_id: seed.workspace_id, policy_revision: String(revision), authorization_epoch: '1', execution }) },
      logger: recordingLogger(),
      taskFolders: path.dirname(settings.folders.working),
      sandboxProbeTarget: workingStoreDir,
      permissions: short,
    });
    const result = await expiring.runTool(task, ['/usr/bin/touch', 'output/late.txt']);
    expect(result).toMatchObject({ ok: false, code: 'permission-denied' });
    expect(fs.existsSync(path.join(settings.folders.output, 'late.txt'))).toBe(false);
    expect(ok(await policy.pendingPermissions(task))).toEqual([]);
  }, 60_000);
});
