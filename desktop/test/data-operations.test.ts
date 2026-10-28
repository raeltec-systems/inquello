/**
 * Story 1.12: export, reimport and delete over temp roots, and the main-side
 * data service with fake runtime and identity controls. Covers the "Export",
 * "Round trip" (digest mismatch), "Import into non-empty", "Delete" and
 * "Delete identity" matrix rows; `data-integration.test.ts` runs the round
 * trip against a runtime home the real app-server produced.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import {
  DataService,
  deleteCategories,
  ExportJournal,
  exportData,
  exportedFilePath,
  governedRoots,
  importData,
  loadShippedPolicy,
  MANIFEST_FILE,
  readManifest,
  type DataPolicy,
  type DataServiceOptions,
  type ExportManifest,
  type GovernedRoots,
} from '../src/main/data';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());
afterEach(() => vi.restoreAllMocks());

const policy: DataPolicy = (() => {
  const load = loadShippedPolicy();
  if (!load.ok) throw new Error(load.error);
  return load.policy;
})();

const ATTRIBUTION = { principal: { displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' }, appVersion: '0.0.0-test', runtimeVersion: '0.165.0' };
const SESSION_SECRET = 'iqa_SESSION_SECRET_never_exported';

function write(root: string, rel: string, content: string | Buffer): string {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

/** A device with sessions, logs, state, an identity and a Chromium profile. */
function device(): { userData: string; roots: GovernedRoots; journal: ExportJournal } {
  const userData = tempDir('data-device');
  const roots = governedRoots(userData, path.join(userData, 'logs'));
  write(roots['runtime-home'], 'sessions/2026/10/28/rollout-2026-10-28-a.jsonl', '{"type":"session_meta"}\n{"type":"message","text":"hello"}\n');
  write(roots['runtime-home'], 'archived_sessions/rollout-2026-10-27-b.jsonl', Buffer.from([0, 1, 2, 255, 10]));
  write(roots['runtime-home'], 'session_index.jsonl', '{"id":"a"}\n');
  write(roots['runtime-home'], 'state_5.sqlite', 'SQLite format 3\0');
  write(roots['runtime-home'], 'logs_2.sqlite', 'SQLite format 3\0logs');
  write(roots['runtime-home'], 'skills/.system/imagegen/SKILL.md', '# skill');
  write(roots.logs, 'app-server-stderr.log', '\n--- app-server stderr ---\nINFO started\n');
  write(userData, 'identity/session.bin', `encrypted:${SESSION_SECRET}`);
  write(userData, 'identity/device-id', '6f1c1d1e-0000-4000-8000-000000000001');
  write(userData, 'Cookies', 'cookie-db');
  write(userData, 'Local Storage/leveldb/000003.log', 'ls');
  return { userData, roots, journal: new ExportJournal(userData) };
}

function allFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile()) out.push(path.join(entry.parentPath, entry.name));
  }
  return out;
}

describe('export (matrix: Export)', () => {
  it('writes included categories with digests, declared omissions, attribution and the notice, and journals it', async () => {
    const { roots, journal, userData } = device();
    const destination = path.join(tempDir('data-export'), 'export');
    const { manifest, path: written } = await exportData({ policy, roots, destination, attribution: ATTRIBUTION, journal, now: () => new Date('2026-10-28T12:00:00Z') });
    expect(written).toBe(destination);
    expect(manifest.notice).toBe('This export is a copy of local data for its owner. It transfers no permissions and is not an accepted audit record.');
    expect(manifest.attribution).toEqual(ATTRIBUTION);
    expect(manifest.included.map((entry) => [entry.category, entry.files.length])).toEqual([
      ['task-history', 3],
      ['desktop-stderr-log', 1],
    ]);
    for (const entry of manifest.included) {
      for (const file of entry.files) {
        expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(fs.readFileSync(exportedFilePath(destination, file.root, file.path))).toEqual(fs.readFileSync(path.join(roots[file.root], file.path)));
      }
    }
    const omitted = Object.fromEntries(manifest.omissions.map((omission) => [omission.category, omission]));
    expect(omitted['identity-session']).toMatchObject({ files: 1, reason: expect.stringMatching(/never exported/) });
    expect(omitted['chromium-profile']).toMatchObject({ files: 2 });
    expect(omitted['runtime-state']).toMatchObject({ files: 2 });
    expect(omitted['runtime-logs']).toMatchObject({ files: 1 });
    expect(omitted['device-id']).toMatchObject({ files: 1 });
    expect(omitted['provider-credentials']).toMatchObject({ files: 0 });
    // No credential anywhere in the export.
    for (const file of allFiles(destination)) expect(fs.readFileSync(file, 'utf8')).not.toContain(SESSION_SECRET);
    expect(fs.existsSync(path.join(destination, MANIFEST_FILE))).toBe(true);
    expect(journal.read()).toEqual([{ path: destination, exportedAt: '2026-10-28T12:00:00.000Z', categories: ['task-history', 'desktop-stderr-log'] }]);
    expect(fs.statSync(journal.file).mode & 0o777).toBe(0o600);
    expect(journal.file).toBe(path.join(userData, 'data', 'export-journal.json'));
  });

  it('declares unclassified files as omissions without copying them', async () => {
    const { roots, journal } = device();
    write(roots['runtime-home'], 'config.toml', 'model = "x"');
    const destination = path.join(tempDir('data-export-unclassified'), 'export');
    const { manifest } = await exportData({ policy, roots, destination, attribution: ATTRIBUTION, journal });
    expect(manifest.omissions.at(-1)).toMatchObject({ category: null, label: 'Unclassified files', files: 1 });
    expect(fs.existsSync(exportedFilePath(destination, 'runtime-home', 'config.toml'))).toBe(false);
  });

  it('removes the partial export and journals nothing when a write fails', async () => {
    const { roots, journal } = device();
    const parent = tempDir('data-export-fail');
    const destination = path.join(parent, 'export');
    const realOpen = fs.promises.open;
    let opened = 0;
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args: Parameters<typeof realOpen>) => {
      opened += 1;
      if (opened === 4) throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      return realOpen(...args);
    });
    await expect(exportData({ policy, roots, destination, attribution: ATTRIBUTION, journal })).rejects.toThrow(/could not be written: ENOSPC/);
    expect(fs.existsSync(destination)).toBe(false);
    expect(journal.read()).toEqual([]);
  });

  it('removes the export when the journal cannot record it', async () => {
    const { roots, journal } = device();
    const destination = path.join(tempDir('data-export-journal-fail'), 'export');
    vi.spyOn(journal, 'append').mockImplementation(() => {
      throw new Error('EROFS');
    });
    await expect(exportData({ policy, roots, destination, attribution: ATTRIBUTION, journal })).rejects.toThrow(/EROFS/);
    expect(fs.existsSync(destination)).toBe(false);
  });

  it('refuses a non-empty destination or one inside Inquello’s own folders', async () => {
    const { roots, journal, userData } = device();
    const occupied = tempDir('data-export-occupied');
    write(occupied, 'keep.txt', 'mine');
    await expect(exportData({ policy, roots, destination: occupied, attribution: ATTRIBUTION, journal })).rejects.toThrow(/not empty/);
    expect(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8')).toBe('mine');
    await expect(exportData({ policy, roots, destination: path.join(userData, 'exports'), attribution: ATTRIBUTION, journal })).rejects.toThrow(/outside/);
    // An existing empty folder is accepted.
    const empty = tempDir('data-export-empty');
    await expect(exportData({ policy, roots, destination: empty, attribution: ATTRIBUTION, journal })).resolves.toMatchObject({ path: empty });
  });
});

async function exported(): Promise<{ roots: GovernedRoots; destination: string; manifest: ExportManifest; journal: ExportJournal }> {
  const { roots, journal } = device();
  const destination = path.join(tempDir('data-roundtrip'), 'export');
  const { manifest } = await exportData({ policy, roots, destination, attribution: ATTRIBUTION, journal });
  return { roots, destination, manifest, journal };
}

function emptyRoots(): GovernedRoots {
  const userData = tempDir('data-target');
  return governedRoots(userData, path.join(userData, 'logs'));
}

describe('reimport (matrix: Round trip, Import into non-empty)', () => {
  it('reproduces every included file byte for byte and lists the omissions', async () => {
    const { roots, destination, manifest } = await exported();
    const target = emptyRoots();
    const result = await importData({ policy, roots: target, source: destination });
    expect(result.restored).toEqual([
      { category: 'task-history', label: 'Task history', files: 3 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', files: 1 },
    ]);
    expect(result.notRestored).toEqual([]);
    expect(result.omissions.map((omission) => omission.category)).toEqual(expect.arrayContaining(['identity-session', 'chromium-profile']));
    for (const entry of manifest.included) {
      for (const file of entry.files) {
        expect(fs.readFileSync(path.join(target[file.root], file.path))).toEqual(fs.readFileSync(path.join(roots[file.root], file.path)));
      }
    }
    expect(fs.existsSync(path.join(target['user-data'], 'identity'))).toBe(false);
  });

  it('refuses the whole import on a digest mismatch and writes nothing', async () => {
    const { destination } = await exported();
    fs.appendFileSync(exportedFilePath(destination, 'runtime-home', 'session_index.jsonl'), 'tampered');
    const target = emptyRoots();
    await expect(importData({ policy, roots: target, source: destination })).rejects.toThrow(/does not match its digest/);
    expect(fs.existsSync(target['runtime-home'])).toBe(false);
    expect(fs.existsSync(target.logs)).toBe(false);
  });

  it('refuses a missing exported file', async () => {
    const { destination } = await exported();
    fs.rmSync(exportedFilePath(destination, 'runtime-home', 'session_index.jsonl'));
    await expect(importData({ policy, roots: emptyRoots(), source: destination })).rejects.toThrow(/missing from the export/);
  });

  it('refuses a runtime home that already holds task history or unclassified files, giving the reason', async () => {
    const { destination } = await exported();
    const target = emptyRoots();
    write(target['runtime-home'], 'sessions/2026/10/01/rollout-existing.jsonl', 'mine');
    await expect(importData({ policy, roots: target, source: destination })).rejects.toThrow(/already holds data .* only into an empty runtime home/);
    const other = emptyRoots();
    write(other['runtime-home'], 'notes.txt', 'mine');
    await expect(importData({ policy, roots: other, source: destination })).rejects.toThrow(/already holds data/);
  });

  it('accepts a runtime home that holds only rebuildable state and logs the runtime writes on start', async () => {
    const { destination } = await exported();
    const target = emptyRoots();
    write(target['runtime-home'], 'state_5.sqlite', 'fresh');
    write(target['runtime-home'], 'logs_2.sqlite', 'fresh');
    write(target.logs, 'app-server-stderr.log', 'current run\n');
    const result = await importData({ policy, roots: target, source: destination });
    expect(result.restored[0]).toMatchObject({ category: 'task-history', files: 3 });
    // The current log is never overwritten; it is listed instead.
    expect(result.notRestored).toEqual([{ category: 'desktop-stderr-log', path: 'logs:app-server-stderr.log', reason: 'A file already exists there; it was not overwritten' }]);
    expect(fs.readFileSync(path.join(target.logs, 'app-server-stderr.log'), 'utf8')).toBe('current run\n');
  });

  it.each([
    ['a path that escapes its root', (m: ExportManifest) => (m.included[0]!.files[0]!.path = '../../evil.jsonl')],
    ['an absolute path', (m: ExportManifest) => (m.included[0]!.files[0]!.path = '/etc/passwd')],
    ['a file outside its category', (m: ExportManifest) => (m.included[0]!.files[0]!.path = 'config.toml')],
    ['a credential category', (m: ExportManifest) => (m.included[0]!.category = 'identity-session')],
    ['an excluded category', (m: ExportManifest) => (m.included[0]!.category = 'runtime-state')],
    ['an unknown format', (m: ExportManifest) => ((m as { format: string }).format = 'zip')],
  ])('refuses a manifest with %s', async (_label, tamper) => {
    const { destination } = await exported();
    const manifest = readManifest(destination);
    tamper(manifest);
    fs.writeFileSync(path.join(destination, MANIFEST_FILE), JSON.stringify(manifest));
    const target = emptyRoots();
    await expect(importData({ policy, roots: target, source: destination })).rejects.toThrow();
    expect(fs.existsSync(target['user-data'])).toBe(true);
    expect(fs.readdirSync(target['user-data'])).toEqual([]);
  });

  it('refuses a folder without a manifest', async () => {
    await expect(importData({ policy, roots: emptyRoots(), source: tempDir('data-no-manifest') })).rejects.toThrow(/no readable Inquello export manifest/);
  });
});

describe('delete (matrix: Delete)', () => {
  it('removes the chosen categories, retains the others and lists surviving exports outside Inquello’s control', async () => {
    const { roots, destination, journal } = await exported();
    const clearBrowserProfile = vi.fn(async () => {});
    const report = await deleteCategories({ policy, roots, categories: ['task-history', 'runtime-logs', 'desktop-stderr-log'], journalEntries: journal.read(), clearBrowserProfile });
    expect(report.removed).toEqual([
      { category: 'task-history', label: 'Task history', filesRemoved: 3, filesRemaining: 0 },
      { category: 'runtime-logs', label: 'Runtime logs', filesRemoved: 1, filesRemaining: 0 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', filesRemoved: 1, filesRemaining: 0 },
    ]);
    expect(report.retained).toEqual(
      expect.arrayContaining([
        { category: 'runtime-state', label: 'Runtime state and indexes', files: 2 },
        { category: 'identity-session', label: 'Identity session', files: 1 },
        { category: 'chromium-profile', label: 'Chromium profile', files: 2 },
        { category: 'export-journal', label: 'Export journal', files: 1 },
      ]),
    );
    expect(report.survivingExports).toEqual([{ path: destination, exportedAt: expect.any(String), categories: ['task-history', 'desktop-stderr-log'], outsideInquelloControl: true }]);
    expect(clearBrowserProfile).not.toHaveBeenCalled();
    // Emptied directories are pruned; the export itself is untouched.
    expect(fs.existsSync(path.join(roots['runtime-home'], 'sessions'))).toBe(false);
    expect(fs.existsSync(path.join(roots['runtime-home'], 'state_5.sqlite'))).toBe(true);
    expect(fs.existsSync(path.join(destination, MANIFEST_FILE))).toBe(true);
  });

  it('clears the Chromium profile through Electron instead of unlinking it', async () => {
    const { roots, journal } = device();
    const clearBrowserProfile = vi.fn(async () => {
      fs.rmSync(path.join(roots['user-data'], 'Local Storage'), { recursive: true });
    });
    const report = await deleteCategories({ policy, roots, categories: ['chromium-profile'], journalEntries: journal.read(), clearBrowserProfile });
    expect(clearBrowserProfile).toHaveBeenCalledOnce();
    expect(report.removed).toEqual([
      { category: 'chromium-profile', label: 'Chromium profile', filesRemoved: 1, filesRemaining: 1, note: expect.stringMatching(/cleared through Electron/) },
    ]);
    expect(fs.existsSync(path.join(roots['user-data'], 'Cookies'))).toBe(true);
  });

  it('refuses unknown or disabled categories', async () => {
    const { roots } = device();
    await expect(deleteCategories({ policy, roots, categories: ['everything'], journalEntries: [] })).rejects.toThrow(/unknown category/);
    await expect(deleteCategories({ policy, roots, categories: ['artifacts'], journalEntries: [] })).rejects.toThrow(/disabled/);
    await expect(deleteCategories({ policy, roots, categories: [], journalEntries: [] })).rejects.toThrow(/no category/);
  });
});

// ---- the main-side service -------------------------------------------------------

interface Harness {
  service: DataService;
  events: string[];
  roots: GovernedRoots;
  journal: ExportJournal;
  identity: { held: boolean; signOutOk: boolean };
  setTasks(n: number): void;
  setExport(dest: string | null): void;
  setImport(source: string | null): void;
}

function harness(): Harness {
  const { roots, journal } = device();
  const events: string[] = [];
  const identity = { held: true, signOutOk: true };
  let tasks = 0;
  let exportDest: string | null = path.join(tempDir('data-service-export'), 'export');
  let importSource: string | null = null;
  const options: DataServiceOptions = {
    load: loadShippedPolicy(),
    roots,
    journal,
    runtime: {
      stop: async () => void events.push('runtime:stop'),
      start: async () => void events.push('runtime:start'),
      activeTasks: () => tasks,
    },
    identity: {
      principal: async () => (identity.held ? { displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' } : null),
      holdsSession: () => identity.held,
      signOut: async () => {
        events.push('identity:signOut');
        if (identity.signOutOk) {
          identity.held = false;
          fs.rmSync(path.join(roots['user-data'], 'identity', 'session.bin'), { force: true });
        }
        return { ok: identity.signOutOk };
      },
      forgetLocally: () => {
        events.push('identity:forgetLocally');
        identity.held = false;
        fs.rmSync(path.join(roots['user-data'], 'identity', 'session.bin'), { force: true });
      },
    },
    chooseExportDestination: async () => exportDest,
    chooseImportSource: async () => importSource,
    clearBrowserProfile: async () => void events.push('browser:clear'),
    appVersion: '0.0.0-test',
    runtimeVersion: '0.165.0',
    logger: recordingLogger(),
  };
  return {
    service: new DataService(options),
    events,
    roots,
    journal,
    identity,
    setTasks: (n) => (tasks = n),
    setExport: (dest) => (exportDest = dest),
    setImport: (source) => (importSource = source),
  };
}

describe('data service', () => {
  it('getPolicy lists every category with owner, rule, enabled flag and held counts, plus blockers (matrix: Inspect)', () => {
    const h = harness();
    write(h.roots['runtime-home'], 'unexpected.bin', 'x');
    const view = h.service.getPolicy();
    expect(view.loaded).toBe(true);
    expect(view.categories).toHaveLength(policy.categories.length);
    expect(view.categories[0]).toEqual({
      id: 'task-history',
      label: 'Task history',
      enabled: true,
      owner: 'The signed-in creator, on this device',
      ruleOwner: 'Organisation data-policy owner (OQ-2)',
      retention: 'until-owner-deletes',
      access: 'runtime',
      export: { mode: 'included' },
      deletion: expect.any(String),
      recovery: expect.any(String),
      held: { files: 3, bytes: expect.any(Number) },
    });
    expect(view.blockers).toEqual([{ kind: 'unclassified', path: 'runtime-home:unexpected.bin', detail: 'runtime-home:unexpected.bin matches no category in the local data policy' }]);
    // No absolute path reaches the renderer.
    expect(JSON.stringify(view)).not.toContain(h.roots['user-data']);
  });

  it('blocks every action when the register did not load', async () => {
    const h = harness();
    const broken = new DataService({ ...(h.service as unknown as { options: DataServiceOptions }).options, load: { ok: false, error: 'bad' } });
    expect(broken.getPolicy()).toMatchObject({ loaded: false, categories: [], blockers: [{ kind: 'policy-invalid' }] });
    await expect(broken.exportData()).resolves.toEqual({ ok: false, reason: 'The local data policy did not load, so local data actions are blocked.' });
  });

  it('exports through main’s chooser with attribution, and reports a cancelled dialog', async () => {
    const h = harness();
    const result = await h.service.exportData();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.export.attribution.principal).toEqual({ displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' });
    expect(result.export.included).toEqual([
      { category: 'task-history', label: 'Task history', files: 3 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', files: 1 },
    ]);
    expect(h.events).toEqual([]); // Export never stops the runtime.
    h.setExport(null);
    await expect(h.service.exportData()).resolves.toEqual({ ok: false, reason: 'No folder was chosen.' });
  });

  it('round trip: export, delete everything, reimport; restarts the runtime around delete and import (matrix: Round trip, Delete)', async () => {
    const h = harness();
    const before = fs.readFileSync(path.join(h.roots['runtime-home'], 'sessions/2026/10/28/rollout-2026-10-28-a.jsonl'));
    const exportedResult = await h.service.exportData();
    if (!exportedResult.ok) throw new Error(exportedResult.reason);
    const enabled = policy.categories.filter((category) => category.enabled).map((category) => category.id);
    const deleted = await h.service.deleteData(enabled);
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(h.events).toEqual(['identity:signOut', 'runtime:stop', 'browser:clear', 'runtime:start']);
    expect(deleted.delete.serverRevocation).toBe('confirmed');
    expect(deleted.delete.retained).toEqual([]);
    expect(deleted.delete.survivingExports).toEqual([expect.objectContaining({ path: exportedResult.export.path, outsideInquelloControl: true })]);
    expect(deleted.delete.removed.find((entry) => entry.category === 'identity-session')!.note).toMatch(/confirmed/);
    expect(fs.existsSync(h.journal.file)).toBe(false);

    h.events.length = 0;
    h.setImport(exportedResult.export.path);
    const imported = await h.service.importData();
    if (!imported.ok) throw new Error(imported.reason);
    expect(h.events).toEqual(['runtime:stop', 'runtime:start']);
    expect(imported.import.restored).toEqual([
      { category: 'task-history', label: 'Task history', files: 3 },
      { category: 'desktop-stderr-log', label: 'Desktop runtime error log', files: 1 },
    ]);
    expect(imported.import.notRestored).toEqual([]);
    expect(imported.import.omissions.map((omission) => omission.category)).toEqual(expect.arrayContaining(['identity-session', 'chromium-profile']));
    expect(fs.readFileSync(path.join(h.roots['runtime-home'], 'sessions/2026/10/28/rollout-2026-10-28-a.jsonl'))).toEqual(before);
  });

  it('import into a non-empty runtime home is refused with the reason, and the runtime restarts', async () => {
    const h = harness();
    const exportedResult = await h.service.exportData();
    if (!exportedResult.ok) throw new Error(exportedResult.reason);
    h.setImport(exportedResult.export.path);
    const result = await h.service.importData();
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/^The runtime home already holds data .*only into an empty runtime home\.$/) });
    expect(h.events).toEqual(['runtime:stop', 'runtime:start']);
  });

  it('refuses import and delete while a Task runs, without stopping the runtime', async () => {
    const h = harness();
    h.setTasks(1);
    h.setImport(tempDir('data-any'));
    await expect(h.service.importData()).resolves.toEqual({ ok: false, reason: 'A Task is running. Stop it before importing or deleting local data.' });
    await expect(h.service.deleteData(['task-history'])).resolves.toEqual({ ok: false, reason: 'A Task is running. Stop it before importing or deleting local data.' });
    expect(h.events).toEqual([]);
  });

  it('deleting the identity session while offline removes it locally and says revocation was not confirmed (matrix: Delete identity)', async () => {
    const h = harness();
    h.identity.signOutOk = false;
    const result = await h.service.deleteData(['identity-session']);
    if (!result.ok) throw new Error(result.reason);
    expect(h.events).toEqual(['identity:signOut', 'identity:forgetLocally', 'runtime:stop', 'runtime:start']);
    expect(result.delete.serverRevocation).toBe('not-confirmed');
    expect(result.delete.removed).toEqual([
      { category: 'identity-session', label: 'Identity session', filesRemoved: 0, filesRemaining: 0, note: expect.stringMatching(/could not confirm the revocation/) },
    ]);
    expect(fs.existsSync(path.join(h.roots['user-data'], 'identity', 'session.bin'))).toBe(false);
    // The device ID is a separate category and stays.
    expect(fs.existsSync(path.join(h.roots['user-data'], 'identity', 'device-id'))).toBe(true);
  });

  it('deleting the identity session when signed out needs no sign-out', async () => {
    const h = harness();
    h.identity.held = false;
    const result = await h.service.deleteData(['identity-session']);
    if (!result.ok) throw new Error(result.reason);
    expect(result.delete.serverRevocation).toBe('not-signed-in');
    expect(h.events).toEqual(['runtime:stop', 'runtime:start']);
    expect(result.delete.removed[0]!.filesRemoved).toBe(1);
  });

  it('runs one action at a time', async () => {
    const h = harness();
    let release!: () => void;
    h.setExport(null);
    const slow = new Promise<null>((resolve) => (release = () => resolve(null)));
    (h.service as unknown as { options: DataServiceOptions }).options.chooseExportDestination = () => slow;
    const first = h.service.exportData();
    await expect(h.service.deleteData(['task-history'])).resolves.toEqual({ ok: false, reason: 'Another local data action is in progress.' });
    release();
    await first;
  });

  it('reports a runtime that did not restart', async () => {
    const h = harness();
    (h.service as unknown as { options: DataServiceOptions }).options.runtime.start = async () => {
      throw new Error('spawn failed');
    };
    const result = await h.service.deleteData(['runtime-logs']);
    expect(result).toEqual({ ok: false, reason: 'The local data action ran, but the runtime did not restart afterwards. Restart Inquello.' });
  });
});
