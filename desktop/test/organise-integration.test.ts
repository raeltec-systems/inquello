/**
 * Story 1.14 end to end: the real `codex-app-server` hosting the working store
 * behind `inquello/*`, the real desktop organise service, and the dev topology
 * (shared service and synthetic issuer on HTTPS, PostgreSQL 18) seeded with a
 * Workspace whose first-administrator invite the synthetic user accepts.
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
import { ORGANISE_REASONS, OrganiseService, type OrganiseRuntime } from '../src/main/organise';
import { AppServerRuntime, resolveAppServerBinary, RpcResponseError, runtimeChildEnv } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);
const OTHER_PRINCIPAL = '22222222-2222-4222-8222-222222222222';

let topology: ChildProcess | undefined;
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let service: SharedServiceClient;
let organise: OrganiseService;
/** Fails the next `inquello/engagement/create` once, as a crashed local step would. */
let failNextLocalEngagement = false;

async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Audit Co', '--seed-out', seedFile], { stdio: ['pipe', 'pipe', 'inherit'] });
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

describe.skipIf(!databaseConfigured)('organise against the real runtime and the dev topology', () => {
  beforeAll(async () => {
    const dir = tempDir('organise-int');
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
    service = new SharedServiceClient(config.serviceUrl, transport);
    identity = new IdentitySession({
      config: { kind: 'configured', config },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: path.join(dir, 'identity') }),
      service,
      issuer: new IssuerClient(config.issuerUrl, transport),
      openBrowser: headlessOpener(transport),
      logger: recordingLogger(),
    });
    expect((await identity.signIn()).ok).toBe(true);
    const accepted = await identity.withAccess((access) => service.acceptInvite(access, seed.invite_id));
    expect(accepted?.workspace_id).toBe(seed.workspace_id);

    const organiseRuntime: OrganiseRuntime = {
      ready: () => runtime.state === 'ready',
      instance: () => runtime,
      request: async <T,>(method: string, params?: unknown) => {
        if (method === 'inquello/engagement/create' && failNextLocalEngagement) {
          failNextLocalEngagement = false;
          throw new RpcResponseError(method, -32603, 'injected', { inquello: { kind: 'store_failure' } });
        }
        return runtime.request<T>(method, params);
      },
    };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
  }, 120_000);

  afterAll(async () => {
    await runtime?.stop();
    await stopTopology();
    removeTempDirs();
  });

  it('rejects inquello/* before a principal is bound', async () => {
    await runtime.request('inquello/session/setPrincipal', { principalId: null });
    try {
      await expect(runtime.request('inquello/workspace/list', {})).rejects.toMatchObject({ data: { inquello: { kind: 'unauthenticated' } } });
    } finally {
      await runtime.request('inquello/session/setPrincipal', { principalId: identity.principalId() });
    }
  });

  it('lists the seeded Workspace from the service with Engagement creation enabled', async () => {
    const view = await organise.getWorkspaces();
    expect(view).toEqual({
      signedIn: true,
      sharedService: 'available',
      workspaces: [{ workspaceId: seed.workspace_id, name: 'Synthetic Audit Co', source: 'service' }],
      engagementCreation: { enabled: true },
    });
  });

  it('creates Engagements, a folder and Tasks, and moves a Task keeping its ID, thread ref and references', async () => {
    const workspaceId = seed.workspace_id;
    const audit = ok(
      await organise.createEngagement({
        operationId: randomUUID(),
        workspaceId,
        name: 'FY26 audit',
        objectives: 'Opinion on FY26',
        scope: 'Group',
        clientEntity: 'Synthetic Client Ltd',
        periodStart: '2026-01-01',
        periodEnd: '2026-12-31',
      }),
    );
    expect(audit).toMatchObject({ clientEntity: 'Synthetic Client Ltd', periodStart: '2026-01-01', periodEnd: '2026-12-31', revision: 1 });
    const fromService = await identity.withAccess((access) => service.workspaces(access));
    expect(fromService!.workspaces[0]!.engagements.map((engagement) => engagement.engagement_id)).toContain(audit.serviceEngagementId);

    const review = ok(
      await organise.createEngagement({ operationId: randomUUID(), workspaceId, name: 'FY26 review', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null }),
    );
    const planning = ok(await organise.createFolder({ operationId: randomUUID(), workspaceId, engagementId: audit.engagementId, name: 'Planning' }));
    const inFolder = ok(await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: audit.engagementId, folderId: planning.folderId, title: 'Untitled thread' }));
    const adHoc = ok(await organise.createTask({ operationId: randomUUID(), workspaceId, engagementId: null, folderId: null, title: 'Untitled thread' }));
    expect(adHoc).toMatchObject({ engagementId: null, folderId: null, visibility: 'private' });

    const tree = ok(await organise.getTree(workspaceId));
    expect(tree.engagements.map((engagement) => engagement.name).sort()).toEqual(['FY26 audit', 'FY26 review']);
    expect(tree.folders).toEqual([planning]);
    expect(tree.tasks.find((task) => task.taskId === inFolder.taskId)).toMatchObject({ engagementId: audit.engagementId, folderId: planning.folderId });

    const attached = ok(await organise.attachThread({ operationId: randomUUID(), workspaceId, taskId: inFolder.taskId, expectedRevision: 1, runtimeThreadId: 'thread-synthetic-1' }));
    const moved = ok(
      await organise.moveTask({ operationId: randomUUID(), workspaceId, taskId: inFolder.taskId, expectedRevision: attached.revision, engagementId: review.engagementId, folderId: null }),
    );
    expect(moved).toMatchObject({
      taskId: inFolder.taskId,
      runtimeThreadId: 'thread-synthetic-1',
      sourceRefs: attached.sourceRefs,
      artifactRefs: attached.artifactRefs,
      visibility: 'private',
      engagementId: review.engagementId,
      folderId: null,
    });

    // A stale rename is rejected; nothing changes.
    expect(await organise.renameTask({ operationId: randomUUID(), workspaceId, taskId: inFolder.taskId, expectedRevision: 1, title: 'Stale' })).toMatchObject({
      ok: false,
      code: 'conflict',
      actualRevision: moved.revision,
    });
  });

  it('retries a failed local step with the same operation ID without a second service Engagement', async () => {
    const workspaceId = seed.workspace_id;
    const operationId = randomUUID();
    const input = { operationId, workspaceId, name: 'FY27 audit', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null };
    failNextLocalEngagement = true;
    expect(await organise.createEngagement(input)).toEqual({ ok: false, code: 'incomplete', reason: ORGANISE_REASONS.incomplete });
    const created = ok(await organise.createEngagement(input));
    const replayed = ok(await organise.createEngagement(input));
    expect(replayed.engagementId).toBe(created.engagementId);
    const fromService = await identity.withAccess((access) => service.workspaces(access));
    expect(fromService!.workspaces[0]!.engagements.filter((engagement) => engagement.name === 'FY27 audit')).toHaveLength(1);
  });

  it("never lists another principal's Tasks in the same Engagement", async () => {
    const workspaceId = seed.workspace_id;
    const mine = ok(await organise.getTree(workspaceId));
    expect(mine.tasks.length).toBeGreaterThan(0);
    await runtime.request('inquello/session/setPrincipal', { principalId: OTHER_PRINCIPAL });
    try {
      const theirs = (await runtime.request('inquello/workspace/tree', { workspaceId })) as { tasks: unknown[]; engagements: unknown[] };
      expect(theirs.tasks).toEqual([]);
      expect(theirs.engagements.length).toBe(mine.engagements.length);
    } finally {
      await runtime.request('inquello/session/setPrincipal', { principalId: identity.principalId() });
    }
  });

  it('with the shared service stopped, Tasks still list and Engagement creation is disabled with its reason', async () => {
    const before = ok(await organise.getTree(seed.workspace_id));
    await stopTopology();
    const view = await organise.getWorkspaces();
    expect(view).toEqual({
      signedIn: true,
      sharedService: 'unavailable',
      workspaces: [{ workspaceId: seed.workspace_id, name: 'Synthetic Audit Co', source: 'local' }],
      engagementCreation: { enabled: false, reason: ORGANISE_REASONS.serviceDown },
    });
    const after = ok(await organise.getTree(seed.workspace_id));
    expect(after.tasks.map((task) => task.taskId).sort()).toEqual(before.tasks.map((task) => task.taskId).sort());
    expect(await organise.createEngagement({ operationId: randomUUID(), workspaceId: seed.workspace_id, name: 'x', objectives: '', scope: '', clientEntity: null, periodStart: null, periodEnd: null })).toMatchObject({
      ok: false,
      code: 'service-unavailable',
    });
  });
});
