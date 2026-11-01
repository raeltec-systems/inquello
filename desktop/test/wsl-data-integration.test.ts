/** Real dedicated-guest file lifecycle; no model, provider or credential call. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { governedRoots, loadShippedPolicy, takeInventory } from '../src/main/data';
import { ensureTaskFolder } from '../src/main/policy/tools';
import { WslTasks } from '../src/main/runtime/wsl-tasks';
import { wslDataStorage } from '../src/main/runtime/wsl-data';
import { removeTempDirs, tempDir } from './helpers';

const principal = '74475eb0-727f-4a57-bc42-e7cfa4dbb2fe';
const cleanup: Array<ReturnType<typeof wslDataStorage>> = [];
afterAll(async () => { for (const storage of cleanup) await storage.erase(); removeTempDirs(); });
const file = (name: string, bytes: string) => ({ path: name, kind: 'file' as const, data: Buffer.from(bytes).toString('base64'), sha256: createHash('sha256').update(bytes).digest('hex') });

describe.skipIf(process.platform !== 'win32')('real WSL Task data governance', () => {
  it('stages current guest bytes, preserves the Windows source, refuses conflicting recovery, and erases the owned scope', async () => {
    const profile = tempDir('wsl-data');
    const roots = governedRoots(profile, path.join(profile, 'logs'));
    const parent = path.join(profile, 'tasks'), task = randomUUID();
    const folders = ensureTaskFolder(parent, task);
    fs.writeFileSync(path.join(folders.output, 'result.txt'), 'original Windows source');
    const guest = new WslTasks(parent, principal);
    const storage = wslDataStorage(parent, () => principal); cleanup.push(storage);
    await guest.transition(task, 'linux');
    await guest.broker(task, { action: 'replace', entries: [ { path: 'output', kind: 'directory' }, file('output/result.txt', 'current guest result') ] });
    expect((await storage.inspect()).files).toBeGreaterThan(0);
    await expect(storage.ensureEmpty()).rejects.toThrow('Delete existing Linux Task folders');
    const loaded = loadShippedPolicy(); if (!loaded.ok) throw new Error(loaded.error);
    const snapshot = await storage.snapshot(loaded.policy, roots);
    try {
      expect(snapshot.roots['user-data']).toMatch(/^D:[\\/]Inquello[\\/]tmp[\\/]export-snapshot-/i);
      expect(fs.readFileSync(path.join(snapshot.roots['user-data'], 'tasks', task, 'output', 'result.txt'), 'utf8')).toBe('current guest result');
      expect(fs.readFileSync(path.join(folders.output, 'result.txt'), 'utf8')).toBe('original Windows source');
      expect(snapshot.inventory.files.find(value => value.category === 'task-folders')!.abs).toContain('export-snapshot-');
      expect(takeInventory(loaded.policy, snapshot.roots).unclassified).toEqual([]);
      expect(snapshot.omissions.some(value => value.category === 'task-folders' && value.files > 0)).toBe(true);
    } finally { snapshot.dispose(); }
    expect(fs.existsSync(snapshot.roots['user-data'])).toBe(false);
    // A lost guest tree must not make the stale host recovery copy exportable.
    await guest.eraseScope();
    await expect(storage.snapshot(loaded.policy, roots)).rejects.toThrow('Authoritative Linux Task files are unavailable');
    const erased = await storage.erase();
    expect(erased.files).toBeGreaterThan(0);
    expect(WslTasks.discoverScopes(parent)).toEqual([]);
    await expect(storage.ensureEmpty()).resolves.toBeUndefined();
    expect(fs.readFileSync(path.join(folders.output, 'result.txt'), 'utf8')).toBe('original Windows source');
  }, 120_000);

  it('rejects unsafe publication without replacing guest bytes or deleting the host source', async () => {
    const profile = tempDir('wsl-transfer-reject'), parent = path.join(profile, 'tasks'), task = randomUUID();
    const folders = ensureTaskFolder(parent, task);
    fs.writeFileSync(path.join(folders.working, 'kept.txt'), 'kept');
    const guest = new WslTasks(parent, principal);
    cleanup.push(wslDataStorage(parent, () => principal));
    await guest.transition(task, 'linux');
    for (const entries of [[file('../escape', 'no')], [file('A', 'one'), file('a', 'two')], [{ ...file('bad', 'bytes'), sha256: '0'.repeat(64) }]]) {
      await expect(guest.broker(task, { action: 'replace', entries })).rejects.toThrow();
      const snapshot = await guest.broker(task, { action: 'snapshot' });
      expect(Buffer.from(snapshot.entries!.find(value => value.path === 'kept.txt')!.data!, 'base64').toString()).toBe('kept');
    }
    expect(fs.readFileSync(path.join(folders.working, 'kept.txt'), 'utf8')).toBe('kept');
    expect(fs.existsSync(path.join(parent, 'escape'))).toBe(false);
  }, 120_000);
});
