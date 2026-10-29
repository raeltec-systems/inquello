/**
 * Story 1.18 end to end, on the permitted path: the real `codex-app-server`
 * (`inquello/policy/effective`, `inquello/broadMode/*`, reading its own
 * managed requirements and user configuration), the real desktop policy and
 * organise services, and the dev topology seeded with a permissive Workspace
 * execution policy (`--seed-execution`). The default seed's refusal path is
 * covered by the keyring smoke.
 *
 * Needs `INQUELLO_TEST_DATABASE_URL` (skipped without it), the built
 * `codex-app-server`, and `inquello-dev-topology` built with
 * `cargo build -p inquello-service --features test-issuer --bin inquello-dev-topology`.
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
import { BROAD_MODE_REACH, PolicyService } from '../src/main/policy';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);
const OTHER_PRINCIPAL = '22222222-2222-4222-8222-222222222222';

/** A synthetic Workspace policy that allows both broader modes. */
const PERMISSIVE = {
  sandbox: 'full_access',
  approvals: ['untrusted', 'on_request', 'never'],
  network: 'allowed',
  mcp_tools: 'denied',
  extensions: 'denied',
  allow_full_access: true,
  allow_no_prompt: true,
};

let topology: ChildProcess | undefined;
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;

async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  const executionFile = path.join(dir, 'execution.json');
  fs.writeFileSync(executionFile, JSON.stringify(PERMISSIVE));
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Policy Co', '--seed-out', seedFile, '--seed-execution', executionFile], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });
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

describe.skipIf(!databaseConfigured)('the effective policy against the real runtime and a permissive seeded Workspace', () => {
  beforeAll(async () => {
    const dir = tempDir('policy-int');
    await startTopology(dir);
    const runtimeHome = path.join(dir, 'runtime-home');
    const workingStore = path.join(dir, 'working', 'working.sqlite');
    fs.mkdirSync(runtimeHome, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
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
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: path.dirname(workingStore) });
  }, 120_000);

  afterAll(async () => {
    await runtime?.stop();
    await stopTopology();
    removeTempDirs();
  });

  it('shows the seeded Workspace policy in S07 with its revision, no device requirements and the contract', async () => {
    const settings = await policy.settings();
    expect(settings.signedIn).toBe(true);
    const entry = settings.workspaces.find((workspace) => workspace.workspaceId === seed.workspace_id)!;
    const view = entry.policy!;
    const sandbox = view.settings.find((setting) => setting.name === 'sandbox')!;
    expect([sandbox.value, sandbox.sourceLabel]).toEqual(['full_access', 'Set by Workspace policy, revision 1']);
    expect(view.settings.find((setting) => setting.name === 'full_access')).toMatchObject({ value: 'permitted', sourceLabel: 'Set by Workspace policy, revision 1' });
    expect(view.settings.find((setting) => setting.name === 'mcp_tools')).toMatchObject({ value: 'denied', sourceLabel: 'Restricted by Workspace policy, revision 1' });
    expect(view.device).toEqual({ configured: false, label: 'None configured on this device' });
    expect(view.capabilities.map((capability) => capability.id)).toEqual(['prompt_inspection', 'specialist_cyber_access', 'execution_sandbox']);
  });

  it('turns Full access on for one Task only after its confirmation, and derives the thread settings from it', async () => {
    const task = ok(await organise.createTask({ operationId: randomUUID(), workspaceId: seed.workspace_id, engagementId: null, folderId: null, title: 'Untitled thread' }));
    const other = ok(await organise.createTask({ operationId: randomUUID(), workspaceId: seed.workspace_id, engagementId: null, folderId: null, title: 'Untitled thread' }));
    const before = ok(await policy.forTask(task.taskId));
    expect(before.broadMode).toMatchObject({ status: 'standard', recorded: 'standard', revision: 0 });
    expect(before.options.every((option) => option.available)).toBe(true);
    expect(ok(await policy.effectiveThreadSettings(task.taskId))).toMatchObject({ sandbox: 'workspace-write', approvalPolicy: 'on-request', networkAccess: true, mode: 'standard' });

    // Without its confirmation the runtime refuses it, even from main.
    await expect(
      runtime.request('inquello/broadMode/set', {
        operationId: randomUUID(),
        expectedRevision: 0,
        taskId: task.taskId,
        mode: 'full_access',
        confirmation: null,
        actorKind: 'human',
        actorRef: null,
        workspacePolicy: { workspaceId: seed.workspace_id, policyRevision: 1, authorizationEpoch: 1, execution: PERMISSIVE },
      }),
    ).rejects.toMatchObject({ data: { inquello: { kind: 'invalid' } } });

    const operationId = randomUUID();
    const set = ok(await policy.setBroadMode({ operationId, taskId: task.taskId, expectedRevision: 0, mode: 'full_access', confirmation: BROAD_MODE_REACH.full_access }));
    expect(set.broadMode).toMatchObject({ status: 'active', recorded: 'full_access', label: 'Broader execution mode', reach: BROAD_MODE_REACH.full_access, revision: 1 });
    expect(ok(await policy.effectiveThreadSettings(task.taskId))).toMatchObject({ sandbox: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, mode: 'full_access' });
    // A retry of the same operation replays; the other Task stays standard.
    expect(ok(await policy.setBroadMode({ operationId, taskId: task.taskId, expectedRevision: 0, mode: 'full_access', confirmation: BROAD_MODE_REACH.full_access })).broadMode.revision).toBe(1);
    expect(ok(await policy.effectiveThreadSettings(other.taskId)).mode).toBe('standard');
    // A stale revision is a conflict.
    expect(await policy.setBroadMode({ operationId: randomUUID(), taskId: task.taskId, expectedRevision: 0, mode: 'no_prompt', confirmation: BROAD_MODE_REACH.no_prompt })).toMatchObject({
      ok: false,
      code: 'conflict',
      actualRevision: 1,
    });

    // A later, stricter policy revision suspends it: the Task runs as standard.
    const stricter = await runtime.request<{ task: { broadMode: { status: string; effectiveMode: string; governing: unknown }; threadSettings: { sandbox: string } } }>('inquello/policy/effective', {
      workspacePolicy: { workspaceId: seed.workspace_id, policyRevision: 2, authorizationEpoch: 2, execution: { sandbox: 'read_only' } },
      taskId: task.taskId,
    });
    expect(stricter.task.broadMode).toEqual({ ...stricter.task.broadMode, status: 'suspended', effectiveMode: 'standard', governing: { kind: 'inquello_default', revision: null } });
    expect(stricter.task.threadSettings.sandbox).toBe('read-only');

    // Back to standard needs no confirmation.
    const standard = ok(await policy.setBroadMode({ operationId: randomUUID(), taskId: task.taskId, expectedRevision: 1, mode: 'standard', confirmation: null }));
    expect(standard.broadMode).toMatchObject({ status: 'standard', revision: 2 });

    // Another principal sees the Task as unknown.
    await runtime.request('inquello/session/setPrincipal', { principalId: OTHER_PRINCIPAL });
    try {
      await expect(runtime.request('inquello/broadMode/read', { taskId: task.taskId })).rejects.toMatchObject({ data: { inquello: { kind: 'not_found' } } });
    } finally {
      await runtime.request('inquello/session/setPrincipal', { principalId: identity.principalId() });
    }
  });
});
