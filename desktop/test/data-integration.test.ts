/**
 * Story 1.12 against the real `codex-app-server`:
 * - Isolation: with a personal `~/.codex` present, the runtime uses
 *   `<userData>/runtime-home` and leaves the personal home untouched.
 * - The register classifies every file a real runtime home holds after the
 *   handshake.
 * - Round trip: export, delete everything, reimport through the data service,
 *   with the real runtime stopped and restarted around delete and import.
 */
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { DataService, ExportJournal, governedRoots, loadShippedPolicy, runtimeHomeDir, takeInventory, type DataPolicy, type GovernedRoots } from '../src/main/data';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv } from '../src/main/runtime';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const binary = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });

const policy: DataPolicy = (() => {
  const load = loadShippedPolicy();
  if (!load.ok) throw new Error(load.error);
  return load.policy;
})();

const runtimes: AppServerRuntime[] = [];
afterAll(async () => {
  for (const runtime of runtimes) await runtime.stop();
  removeTempDirs();
});

/** Starts the real runtime the way main does: own runtime home, stderr log in the logs root. */
async function startRuntime(roots: GovernedRoots, base: NodeJS.ProcessEnv, workingStore?: string): Promise<AppServerRuntime> {
  fs.mkdirSync(roots['runtime-home'], { recursive: true, mode: 0o700 });
  if (workingStore) fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
  const runtime = new AppServerRuntime({
    command: binary.path,
    env: runtimeChildEnv(base, { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', codexHome: roots['runtime-home'], workingStore }),
    clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
    schemaStamp,
    stderrLogPath: path.join(roots.logs, 'app-server-stderr.log'),
    logger: recordingLogger(),
  });
  runtimes.push(runtime);
  await runtime.start();
  return runtime;
}

function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    const full = path.join(entry.parentPath, entry.name);
    const stat = fs.lstatSync(full);
    out[path.relative(dir, full)] = entry.isFile() ? `${stat.size}:${stat.mtimeMs}:${fs.readFileSync(full, 'utf8')}` : `dir:${stat.mtimeMs}`;
  }
  return out;
}

const SESSION_REL = 'sessions/2026/10/28/rollout-2026-10-28T12-00-00-0199a000-0000-7000-8000-000000000001.jsonl';
const SESSION_BYTES = `${JSON.stringify({ timestamp: '2026-10-28T12:00:00.000Z', type: 'session_meta', payload: { id: '0199a000-0000-7000-8000-000000000001', synthetic: true } })}\n`;
const ARCHIVED_REL = 'archived_sessions/rollout-2026-10-27T09-00-00-0199a000-0000-7000-8000-000000000002.jsonl';

describe('runtime home isolation (matrix: Isolation)', () => {
  it('uses <userData>/runtime-home and leaves a personal ~/.codex untouched', async () => {
    const home = tempDir('data-personal-home');
    const personal = path.join(home, '.codex');
    fs.mkdirSync(path.join(personal, 'sessions'), { recursive: true });
    fs.writeFileSync(path.join(personal, 'config.toml'), 'model = "personal"\n');
    fs.writeFileSync(path.join(personal, 'auth.json'), '{"personal":true}\n');
    const before = snapshot(personal);

    const userData = tempDir('data-isolation-ud');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    // Even an inherited CODEX_HOME pointing at the personal home is replaced.
    const runtime = await startRuntime(roots, { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: personal });
    expect(fs.realpathSync.native(runtime.handshake!.codexHome)).toBe(fs.realpathSync.native(runtimeHomeDir(userData)));
    await runtime.request('thread/list', {});
    await runtime.stop();
    expect(snapshot(personal)).toEqual(before);
    expect(fs.readdirSync(roots['runtime-home']).length).toBeGreaterThan(0);
  }, 90_000);
});

describe('a real runtime home', () => {
  it('holds only classified files after the handshake and a synthetic session', async () => {
    const userData = tempDir('data-real-home');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    const runtime = await startRuntime(roots, process.env);
    await runtime.request('thread/list', {});
    fs.mkdirSync(path.dirname(path.join(roots['runtime-home'], SESSION_REL)), { recursive: true });
    fs.writeFileSync(path.join(roots['runtime-home'], SESSION_REL), SESSION_BYTES);
    await runtime.stop();
    const inventory = takeInventory(policy, roots);
    expect(inventory.unclassified).toEqual([]);
    expect(inventory.disabledHeld).toEqual([]);
    expect(inventory.held['task-history']!.files).toBe(1);
    expect(inventory.held['runtime-state']!.files).toBeGreaterThan(0);
    expect(inventory.held['desktop-stderr-log']!.files).toBe(1);
  }, 90_000);

  it('round trip: export, delete all, reimport reproduces the included categories (matrix: Round trip)', async () => {
    const userData = tempDir('data-real-roundtrip');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    let runtime = await startRuntime(roots, process.env);
    await runtime.request('thread/list', {});
    for (const [rel, bytes] of [
      [SESSION_REL, SESSION_BYTES],
      [ARCHIVED_REL, SESSION_BYTES.replace('000000000001', '000000000002')],
    ] as const) {
      fs.mkdirSync(path.dirname(path.join(roots['runtime-home'], rel)), { recursive: true });
      fs.writeFileSync(path.join(roots['runtime-home'], rel), bytes);
    }
    const events: string[] = [];
    const exportParent = tempDir('data-real-export');
    let importSource: string | null = null;
    const service = new DataService({
      load: loadShippedPolicy(),
      roots,
      journal: new ExportJournal(userData),
      runtime: {
        stop: async () => {
          events.push('stop');
          await runtime.stop();
        },
        start: async () => {
          events.push('start');
          runtime = await startRuntime(roots, process.env);
        },
        activeTasks: () => 0,
      },
      identity: { principal: async () => null, holdsSession: () => false, signOut: async () => ({ ok: true }), forgetLocally: () => {} },
      providers: { forgetClaudeKey: () => undefined, holdsClaudeKey: () => false },
      chooseExportDestination: async () => path.join(exportParent, 'export'),
      chooseImportSource: async () => importSource,
      clearBrowserProfile: async () => {},
      appVersion: '0.0.0-test',
      runtimeVersion: schemaStamp.runtimeVersion,
      logger: recordingLogger(),
    });

    const exported = await service.exportData();
    if (!exported.ok) throw new Error(exported.reason);
    expect(exported.export.included).toEqual([
      { category: 'task-history', label: 'Task history', files: 2 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', files: 1 },
      { category: 'working-store', label: 'Private work organisation', files: 0 },
      { category: 'task-folders', label: 'Task working folders', files: 0 },
    ]);
    expect(exported.export.attribution).toEqual({ principal: null, appVersion: '0.0.0-test', runtimeVersion: schemaStamp.runtimeVersion });
    expect(exported.export.omissions.map((omission) => omission.category)).toEqual(expect.arrayContaining(['identity-session', 'chromium-profile', 'runtime-state']));

    expect(events).toEqual(['stop', 'start']);
    events.length = 0;
    const deleted = await service.deleteData(service.deletableCategories());
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(events).toEqual(['stop', 'start']);
    expect(runtime.state).toBe('ready');
    expect(deleted.delete.removed.find((entry) => entry.category === 'task-history')).toMatchObject({ filesRemoved: 2, filesRemaining: 0 });
    expect(deleted.delete.survivingExports).toEqual([expect.objectContaining({ path: exported.export.path, outsideInquelloControl: true })]);
    expect(fs.existsSync(path.join(roots['runtime-home'], 'sessions'))).toBe(false);

    events.length = 0;
    importSource = exported.export.path;
    const imported = await service.importData();
    if (!imported.ok) throw new Error(imported.reason);
    expect(events).toEqual(['stop', 'start']);
    expect(runtime.state).toBe('ready');
    expect(imported.import.restored).toEqual([
      { category: 'task-history', label: 'Task history', files: 2 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', files: 0 },
      { category: 'working-store', label: 'Private work organisation', files: 0 },
      { category: 'task-folders', label: 'Task working folders', files: 0 },
    ]);
    // The restarted runtime has already begun a new log; it is never overwritten, and the report says so.
    expect(imported.import.notRestored).toEqual([{ category: 'desktop-stderr-log', path: 'logs:app-server-stderr.log', reason: 'A file already exists there; it was not overwritten' }]);
    expect(fs.readFileSync(path.join(roots['runtime-home'], SESSION_REL), 'utf8')).toBe(SESSION_BYTES);
    expect(fs.readFileSync(path.join(roots['runtime-home'], ARCHIVED_REL), 'utf8')).toBe(SESSION_BYTES.replace('000000000001', '000000000002'));
    await runtime.stop();
    expect(takeInventory(policy, roots).unclassified).toEqual([]);
  }, 180_000);
});

// R9: the expected content comes from commands and bytes created before export,
// not from the export manifest. No shared-service topology is required: this
// test binds a synthetic principal through the trusted main-to-runtime API.
describe('populated working-store recovery (R2/R9)', () => {
  it('preserves Task identity, state history, receipts and output across export/delete/import/reopen', async () => {
    const userData = tempDir('data-populated-roundtrip');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    const workingStore = path.join(userData, 'working', 'working.sqlite');
    const principalId = randomUUID();
    const workspaceId = randomUUID();
    let runtime = await startRuntime(roots, process.env, workingStore);
    const bind = () => runtime.request('inquello/session/setPrincipal', { principalId });
    await bind();
    const remember = { operationId: randomUUID(), expectedRevision: 0, workspaceId, name: 'Recovery fixture Workspace' };
    const workspaceBefore = await runtime.request<{ receipt: { replayed: boolean } }>('inquello/workspace/remember', remember);
    const create = { operationId: randomUUID(), expectedRevision: 0, workspaceId, engagementId: null, folderId: null, title: 'Recover populated Task' };
    const taskBefore = await runtime.request<{ task: { taskId: string; revision: number }; receipt: { replayed: boolean } }>('inquello/task/create', create);
    const taskId = taskBefore.task.taskId;
    const firstState = { operationId: randomUUID(), expectedRevision: 0, taskId, dimension: 'task', scopeKind: 'task', scopeId: taskId, value: 'planned', actorKind: 'human', actorRef: null };
    const stateReceiptBefore = await runtime.request<{ receipt: { replayed: boolean }; record: unknown }>('inquello/state/record', firstState);
    await runtime.request('inquello/state/record', { ...firstState, operationId: randomUUID(), expectedRevision: 1, value: 'running' });
    const expectedTree = await runtime.request('inquello/workspace/tree', { workspaceId });
    const expectedStates = await runtime.request<{ revision: number; dimensions: Array<{ dimension: string; records: unknown[] }> }>('inquello/state/list', { taskId });
    expect(expectedStates.revision).toBe(2);
    expect(expectedStates.dimensions.find((entry) => entry.dimension === 'task')?.records).toHaveLength(2);
    const outputRel = path.join('tasks', taskId, 'output', 'evidence.txt');
    const expectedOutput = Buffer.from('Independent output fixture: task evidence\n');
    fs.mkdirSync(path.dirname(path.join(userData, outputRel)), { recursive: true });
    fs.writeFileSync(path.join(userData, outputRel), expectedOutput);
    const destination = path.join(tempDir('data-populated-export'), 'export');
    const events: string[] = [];
    const service = new DataService({
      load: loadShippedPolicy(), roots, journal: new ExportJournal(userData),
      runtime: {
        stop: async () => { events.push('stop'); await runtime.stop(); },
        // Main binds its principal on restart. Binding alone does not open a
        // fresh database, so reimport can restore the deleted working store.
        start: async () => { events.push('start'); runtime = await startRuntime(roots, process.env, workingStore); await bind(); },
        activeTasks: () => 0,
      },
      identity: { principal: async () => null, holdsSession: () => false, signOut: async () => ({ ok: true }), forgetLocally: () => {} },
      providers: { forgetClaudeKey: () => undefined, holdsClaudeKey: () => false },
      chooseExportDestination: async () => destination,
      chooseImportSource: async () => destination,
      clearBrowserProfile: async () => {},
      appVersion: '0.0.0-test', runtimeVersion: schemaStamp.runtimeVersion, logger: recordingLogger(),
    });
    const exported = await service.exportData();
    if (!exported.ok) throw new Error(exported.reason);
    expect(events).toEqual(['stop', 'start']);
    expect(exported.export.included.find((entry) => entry.category === 'working-store')?.files).toBeGreaterThan(0);
    expect(exported.export.included.find((entry) => entry.category === 'task-folders')?.files).toBe(1);
    // Only restore the owned categories, avoiding irrelevant Chromium/log changes.
    const deleted = await service.deleteData(['working-store', 'task-folders']);
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(fs.existsSync(workingStore)).toBe(false);
    expect(fs.existsSync(path.join(userData, outputRel))).toBe(false);
    const imported = await service.importData();
    if (!imported.ok) throw new Error(imported.reason);
    expect(imported.import.notRestored.filter((entry) => entry.category === 'working-store' || entry.category === 'task-folders')).toEqual([]);
    expect(events).toEqual(['stop', 'start', 'stop', 'start', 'stop', 'start']);
    expect(await runtime.request('inquello/workspace/tree', { workspaceId })).toEqual(expectedTree);
    expect(await runtime.request('inquello/state/list', { taskId })).toEqual(expectedStates);
    expect(fs.readFileSync(path.join(userData, outputRel))).toEqual(expectedOutput);
    // Original operation IDs must replay their durable receipts rather than
    // duplicate the Task/state or conflict against already advanced revisions.
    expect(await runtime.request('inquello/workspace/remember', remember)).toEqual({ ...workspaceBefore, receipt: { ...workspaceBefore.receipt, replayed: true } });
    expect(await runtime.request('inquello/task/create', create)).toEqual({ ...taskBefore, receipt: { ...taskBefore.receipt, replayed: true } });
    expect(await runtime.request('inquello/state/record', firstState)).toEqual({ ...stateReceiptBefore, receipt: { ...stateReceiptBefore.receipt, replayed: true } });
    await runtime.stop();
    runtime = await startRuntime(roots, process.env, workingStore);
    await bind();
    expect(await runtime.request('inquello/workspace/tree', { workspaceId })).toEqual(expectedTree);
    expect(await runtime.request('inquello/state/list', { taskId })).toEqual(expectedStates);
    expect(fs.readFileSync(path.join(userData, outputRel))).toEqual(expectedOutput);
  }, 180_000);
});
