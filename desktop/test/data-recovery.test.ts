import {fixtureDataAuthority} from './authorization-fixtures';
/**
 * R9 supplemental recovery witness using real SQLite, not the app-server.
 * Tables below are deliberately a minimal fixture schema, NOT domain migrations.
 * The maintained app-server test in data-integration.test.ts remains required
 * for domain commands/receipts. This test runs without a Rust binary or downloads.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, expect, it } from 'vitest';
import { DataService, ExportJournal, governedRoots, loadShippedPolicy } from '../src/main/data';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(removeTempDirs);

it('recovers populated SQLite Task/state/receipt fixtures and output through the actual data service (R9 supplemental)', async () => {
  const userData = tempDir('data-sqlite-recovery');
  const roots = governedRoots(userData, path.join(userData, 'logs'));
  const file = path.join(userData, 'working', 'working.sqlite');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(roots['runtime-home'], { recursive: true });
  let db: DatabaseSync | null = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA wal_autocheckpoint=0;
    CREATE TABLE fixture_tasks(id TEXT PRIMARY KEY, title TEXT NOT NULL, revision INTEGER NOT NULL);
    CREATE TABLE fixture_states(task_id TEXT NOT NULL, version INTEGER NOT NULL, value TEXT NOT NULL);
    CREATE TABLE fixture_receipts(operation_id TEXT PRIMARY KEY, task_id TEXT NOT NULL, revision INTEGER NOT NULL);
  `);
  const taskId = randomUUID();
  const operationId = randomUUID();
  const expectedTask = { id: taskId, title: 'Independent source fixture', revision: 1 };
  const expectedStates = [{ task_id: taskId, version: 1, value: 'planned' }, { task_id: taskId, version: 2, value: 'running' }];
  const expectedReceipt = { operation_id: operationId, task_id: taskId, revision: 1 };
  db.prepare('INSERT INTO fixture_tasks VALUES (?, ?, ?)').run(taskId, expectedTask.title, 1);
  for (const state of expectedStates) db.prepare('INSERT INTO fixture_states VALUES (?, ?, ?)').run(state.task_id, state.version, state.value);
  db.prepare('INSERT INTO fixture_receipts VALUES (?, ?, ?)').run(operationId, taskId, 1);
  // Export starts with actual committed SQLite pages still in the WAL.
  expect(fs.statSync(`${file}-wal`).size).toBeGreaterThan(0);
  const output = path.join(userData, 'tasks', taskId, 'output', 'evidence.txt');
  const expectedOutput = Buffer.from('Independent output bytes\n');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, expectedOutput);
  const destination = path.join(tempDir('data-sqlite-export'), 'export');
  const events: string[] = [];
  const service = new DataService({authority:fixtureDataAuthority(),
    load: loadShippedPolicy(), roots, journal: new ExportJournal(userData),
    runtime: {
      stop: async () => { events.push('stop'); db?.close(); db = null; },
      // The actual runtime opens its working store lazily. Do not manufacture
      // a new empty store between deletion and import.
      start: async () => { events.push('start'); if (fs.existsSync(file)) db = new DatabaseSync(file); },
      activeTasks: () => 0,
    },
    identity: { principal: async () => null, holdsSession: () => false, signOut: async () => ({ ok: true }), forgetLocally: () => {} },
    providers: { forgetClaudeKey: () => {}, holdsClaudeKey: () => false },
    chooseExportDestination: async () => destination, chooseImportSource: async () => destination,
    clearBrowserProfile: async () => {}, appVersion: 'test', runtimeVersion: 'test', logger: recordingLogger(),
  });
  try {
    const exported = await service.exportData();
    if (!exported.ok) throw new Error(exported.reason);
    expect(events).toEqual(['stop', 'start']);
    const deleted = await service.deleteData(['working-store', 'task-folders']);
    if (!deleted.ok) throw new Error(deleted.reason);
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(output)).toBe(false);
    const imported = await service.importData();
    if (!imported.ok) throw new Error(imported.reason);
    expect(imported.import.notRestored).toEqual([]);
    expect(events).toEqual(['stop', 'start', 'stop', 'start', 'stop', 'start']);
    const assertRecovered = () => {
      expect(db!.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(db!.prepare('SELECT * FROM fixture_tasks').all()).toEqual([expectedTask]);
      expect(db!.prepare('SELECT * FROM fixture_states ORDER BY version').all()).toEqual(expectedStates);
      expect(db!.prepare('SELECT * FROM fixture_receipts WHERE operation_id = ?').get(operationId)).toEqual(expectedReceipt);
      expect(fs.readFileSync(output)).toEqual(expectedOutput);
    };
    assertRecovered();
    db!.close();
    db = new DatabaseSync(file);
    assertRecovered();
  } finally {
    db?.close();
  }
}, 30_000);
