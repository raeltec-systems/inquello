/**
 * Story 1.12: the local data-policy register, its classifier and the
 * real-data blockers. Covers the "Inspect", "Unknown rule" and "Unclassified
 * file" matrix rows; the engine's capability test covers the cross-check.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  classify,
  globToRegExp,
  governedRoots,
  loadShippedPolicy,
  parsePolicy,
  policyPath,
  PolicyError,
  realDataBlockers,
  ruleBlockers,
  takeInventory,
  type DataPolicy,
} from '../src/main/data';
import { removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const shippedJson = fs.readFileSync(path.join(desktop, 'data-policy.json'), 'utf8');

afterAll(() => removeTempDirs());

function shipped(): DataPolicy {
  const load = loadShippedPolicy();
  if (!load.ok) throw new Error(load.error);
  return load.policy;
}

/** The shipped register with one category changed. */
function variant(id: string, change: (category: Record<string, unknown>) => void): string {
  const raw = JSON.parse(shippedJson) as { categories: Array<Record<string, unknown>> };
  change(raw.categories.find((category) => category.id === id)!);
  return JSON.stringify(raw);
}

function write(root: string, rel: string, content = 'x'): string {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

describe('shipped register', () => {
  it('discloses the separately retained request and binding after Task history deletion', () => {
    const history = shipped().categories.find(category => category.id === 'task-history')!;
    expect(history.deletion).toContain('submitted request and Task/run/thread binding copy');
    expect(history.deletion).toContain('also delete Private work organisation in Local data');
    expect(history.deletion).toContain('entire working store');
  });
  it('discloses governed publications and memory-only authorized progress', () => {
    const history = shipped().categories.find(category => category.id === 'task-history')!;
    expect(history.recovery).toContain('plan/result publications and scoped question answers');
    expect(history.recovery).toContain('memory only');
    expect(history.recovery).toContain('no new persistent cache or database');
    expect(history.recovery).toContain('Hidden reasoning and opaque continuation blocks are never projected');
  });
  it('loads from desktop/data-policy.json and is frozen', () => {
    expect(policyPath()).toBe(path.join(desktop, 'data-policy.json'));
    const policy = shipped();
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.categories[0])).toBe(true);
    expect(policy.policy_owner).toBe('Organisation data-policy owner (OQ-2)');
    expect(policy.notice).toMatch(/transfers no permissions and is not an accepted audit record/);
  });

  it('lists every enabled category the spec names, and the disabled ones', () => {
    const policy = shipped();
    const enabled = policy.categories.filter((category) => category.enabled).map((category) => category.id);
    expect(enabled).toEqual([
      'task-history',
      'runtime-logs',
      'runtime-state',
      'desktop-stderr-log',
      'identity-session',
      'device-id',
      'chromium-profile',
      'export-journal',
      'claude-key-vault',
      'runtime-config',
      'codex-keyring-entry',
      'working-store',
      'task-folders',
      'recovery-quarantine',
      'runtime-lease',
    ]);
    const disabled = policy.categories.filter((category) => !category.enabled).map((category) => category.id);
    expect(disabled).toEqual(expect.arrayContaining(['source-extracts', 'artifacts', 'shared-caches', 'unattended-work']));
  });

  it('gives every enabled category a named owner, rule owner, retention and export rule, with no invented duration', () => {
    const policy = shipped();
    expect(ruleBlockers(policy)).toEqual([]);
    for (const category of policy.categories.filter((c) => c.enabled)) {
      expect(category.retention).toBe('until-owner-deletes');
      expect(category.rule_owner).toBe('Organisation data-policy owner (OQ-2)');
      if(['runtime-logs','desktop-stderr-log','recovery-quarantine'].includes(category.id)){expect(category.owner).toMatch(/original native owner/i);expect(category.export.mode).toBe('excluded');}else if(category.id==='runtime-lease'){expect(category.owner).toMatch(/local private runtime/);expect(category.export.mode).toBe('excluded');}else expect(category.owner).toMatch(/signed-in creator/);
      expect(category.export.mode).not.toBe('unknown');
      expect(category.deletion.length).toBeGreaterThan(0);
      expect(category.recovery.length).toBeGreaterThan(0);
    }
    expect(shippedJson).not.toMatch(/\b\d+\s*(day|week|month|year)s?\b/i);
  });

  it('never exports credentials, the identity session or the Chromium profile', () => {
    const policy = shipped();
    for (const category of policy.categories.filter((c) => c.credentials)) expect(category.export.mode).toBe('excluded');
    const byId = (id: string) => policy.categories.find((category) => category.id === id)!;
    expect(byId('identity-session').credentials).toBe(true);
    expect(byId('identity-session').export.mode).toBe('excluded');
    expect(byId('chromium-profile').export.mode).toBe('excluded');
    expect(byId('provider-credentials')).toMatchObject({ enabled: false, credentials: true });
    expect(byId('task-history').export.mode).toBe('included');
    expect(byId('working-store')).toMatchObject({ enabled: true, credentials: false, access: 'runtime', export: { mode: 'included' } });
    expect(byId('runtime-state').export).toMatchObject({ mode: 'excluded', reason: expect.stringMatching(/rebuil/i) });
  });

  it('reports no blockers for the shipped register and an empty device', () => {
    expect(realDataBlockers(loadShippedPolicy())).toEqual([]);
  });
});

describe('register validation', () => {
  it('rejects unknown fields at every level', () => {
    const raw = JSON.parse(shippedJson);
    expect(() => parsePolicy(JSON.stringify({ ...raw, enable_all: true }))).toThrow(/unknown field enable_all/);
    expect(() => parsePolicy(variant('task-history', (c) => (c.override = true)))).toThrow(/unknown field override/);
    expect(() => parsePolicy(variant('task-history', (c) => ((c.location as Record<string, unknown>).extra = 1)))).toThrow(/unknown field extra/);
    expect(() => parsePolicy(variant('task-history', (c) => ((c.export as Record<string, unknown>).reason = 'x')))).toThrow(/reason belongs only/);
  });

  it('rejects a credential category that is exported', () => {
    expect(() => parsePolicy(variant('identity-session', (c) => (c.export = { mode: 'included' })))).toThrow(PolicyError);
  });

  it('rejects missing fields, invented retention values, bad roots and unsafe globs', () => {
    expect(() => parsePolicy(variant('task-history', (c) => delete c.owner))).toThrow(/missing field owner/);
    expect(() => parsePolicy(variant('task-history', (c) => (c.retention = '90 days')))).toThrow(/retention/);
    expect(() => parsePolicy(variant('task-history', (c) => ((c.location as Record<string, unknown>).root = 'home')))).toThrow(/root/);
    expect(() => parsePolicy(variant('task-history', (c) => ((c.location as Record<string, unknown>).globs = ['../.codex/**'])))).toThrow(/relative path/);
    expect(() => parsePolicy(variant('task-history', (c) => ((c.location as Record<string, unknown>).globs = ['/etc/**'])))).toThrow(/relative path/);
    expect(() => parsePolicy(variant('task-history', (c) => (c.export = { mode: 'excluded' })))).toThrow(/reason/);
    expect(() => parsePolicy(variant('runtime-logs', (c) => (c.id = 'task-history')))).toThrow(/duplicate/);
    expect(() => parsePolicy('{')).toThrow(/not JSON/);
  });
});

describe('unknown rules (matrix: Unknown rule)', () => {
  it('reports an enabled category with unknown retention, owner or export rule as a real-data blocker', () => {
    const policy = parsePolicy(
      variant('task-history', (c) => {
        c.retention = 'unknown';
        c.owner = 'unknown';
        c.export = { mode: 'unknown' };
      }),
    );
    const blockers = realDataBlockers({ ok: true, policy });
    expect(blockers).toEqual([
      { kind: 'unknown-rule', category: 'task-history', detail: 'Task history is enabled with an unknown owner, retention, export rule' },
    ]);
  });

  it('does not block on a disabled category with unknown retention', () => {
    const policy = shipped();
    expect(policy.categories.find((category) => category.id === 'artifacts')!.retention).toBe('unknown');
    expect(ruleBlockers(policy)).toEqual([]);
  });

  it('blocks everything when the register does not load', () => {
    expect(realDataBlockers({ ok: false, error: 'broken' })).toEqual([{ kind: 'policy-invalid', detail: 'The local data policy did not load: broken' }]);
  });
});

describe('globs and classification', () => {
  it.each([
    ['sessions/**', 'sessions/2026/10/28/rollout.jsonl', true],
    ['sessions/**', 'sessions', false],
    ['sessions/**', 'archived_sessions/a.jsonl', false],
    ['*.sqlite', 'state_5.sqlite', true],
    ['*.sqlite', 'sub/state_5.sqlite', false],
    ['*.sqlite-*', 'state_5.sqlite-wal', true],
    ['Cookies', 'Cookies-journal', false],
    ['Singleton*', 'SingletonLock', true],
    ['identity/session.bin.*.tmp', 'identity/session.bin.12.abc.tmp', true],
    ['a?c', 'a/c', false],
  ])('%s matches %s: %s', (glob, rel, expected) => {
    expect(globToRegExp(glob).test(rel)).toBe(expected);
  });

  it('classifies each root against its own categories, first match wins', () => {
    const policy = shipped();
    expect(classify(policy, 'user-data', 'working/working.runtime-lease')?.id).toBe('runtime-lease');
    expect(classify(policy, 'runtime-home', 'logs_2.sqlite')?.id).toBe('runtime-logs');
    expect(classify(policy, 'runtime-home', 'logs_2.sqlite-wal')?.id).toBe('runtime-logs');
    expect(classify(policy, 'runtime-home', 'state_5.sqlite')?.id).toBe('runtime-state');
    expect(classify(policy, 'runtime-home', 'sessions/2026/10/28/rollout-x.jsonl')?.id).toBe('task-history');
    expect(classify(policy, 'runtime-home', 'archived_sessions/rollout-x.jsonl')?.id).toBe('task-history');
    expect(classify(policy, 'runtime-home', 'auth.json')?.id).toBe('provider-credentials');
    expect(classify(policy, 'user-data', 'identity/session.bin')?.id).toBe('identity-session');
    expect(classify(policy, 'user-data', 'identity/device-id')?.id).toBe('device-id');
    expect(classify(policy, 'user-data', 'Local Storage/leveldb/000003.log')?.id).toBe('chromium-profile');
    expect(classify(policy, 'user-data', 'data/export-journal.json')?.id).toBe('export-journal');
    for (const file of ['working/working.sqlite', 'working/working.sqlite-wal', 'working/working.sqlite-shm']) {
      expect(classify(policy, 'user-data', file)?.id).toBe('working-store');
    }
    expect(classify(policy, 'user-data', 'working/notes.txt')).toBeUndefined();
    expect(classify(policy, 'logs', 'app-server-stderr.log')?.id).toBe('desktop-stderr-log');
    // A runtime-home name under userData is not the runtime home.
    expect(classify(policy, 'user-data', 'state_5.sqlite')).toBeUndefined();
    expect(classify(policy, 'runtime-home', 'notes.txt')).toBeUndefined();
  });
});

describe('inventory (matrix: Inspect, Unclassified file)', () => {
  it('lists and counts held files per category, each in its most specific root', () => {
    const userData = tempDir('data-inv');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    write(roots['runtime-home'], 'sessions/2026/10/28/rollout-a.jsonl', 'abc');
    write(roots['runtime-home'], 'state_5.sqlite', '12345');
    write(roots.logs, 'app-server-stderr.log', 'log');
    write(userData, 'identity/device-id', 'id');
    write(userData, 'Preferences', '{}');
    fs.mkdirSync(path.join(userData, 'blob_storage', 'empty'), { recursive: true });
    const inventory = takeInventory(shipped(), roots);
    expect(inventory.unclassified).toEqual([]);
    expect(inventory.held['task-history']).toEqual({ files: 1, bytes: 3 });
    expect(inventory.held['runtime-state']).toEqual({ files: 1, bytes: 5 });
    expect(inventory.held['desktop-stderr-log']).toEqual({ files: 1, bytes: 3 });
    expect(inventory.held['device-id']).toEqual({ files: 1, bytes: 2 });
    expect(inventory.held['chromium-profile']).toEqual({ files: 1, bytes: 2 });
    expect(inventory.files.map((file) => `${file.root}:${file.rel}`)).toEqual([
      'logs:app-server-stderr.log',
      'runtime-home:sessions/2026/10/28/rollout-a.jsonl',
      'runtime-home:state_5.sqlite',
      'user-data:identity/device-id',
      'user-data:Preferences',
    ]);
  });

  it('walks a logs directory outside userData as its own root', () => {
    const userData = tempDir('data-inv-ud');
    const logs = tempDir('data-inv-logs');
    write(logs, 'app-server-stderr.log');
    write(logs, 'other.log');
    const inventory = takeInventory(shipped(), governedRoots(userData, logs));
    expect(inventory.held['desktop-stderr-log']!.files).toBe(1);
    expect(inventory.unclassified).toEqual(['logs:other.log']);
  });

  it('reports an unexpected file in the runtime home as unclassified, and it blocks', () => {
    const userData = tempDir('data-unclassified');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    write(roots['runtime-home'], 'notes/unexpected.txt');
    write(roots['runtime-home'], 'profile.toml');
    const inventory = takeInventory(shipped(), roots);
    expect(inventory.unclassified).toEqual(['runtime-home:notes/unexpected.txt', 'runtime-home:profile.toml']);
    const blockers = realDataBlockers(loadShippedPolicy(), inventory);
    expect(blockers.map((blocker) => [blocker.kind, blocker.path])).toEqual([
      ['unclassified', 'runtime-home:notes/unexpected.txt'],
      ['unclassified', 'runtime-home:profile.toml'],
    ]);
  });

  it('reports a file held in a disabled category as a blocker', () => {
    const userData = tempDir('data-disabled');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    write(roots['runtime-home'], 'auth.json', '{"token":"x"}');
    write(userData, 'artifacts/a.xlsx');
    const inventory = takeInventory(shipped(), roots);
    expect(inventory.disabledHeld).toEqual([
      { category: 'provider-credentials', path: 'runtime-home:auth.json' },
      { category: 'artifacts', path: 'user-data:artifacts/a.xlsx' },
    ]);
    expect(realDataBlockers(loadShippedPolicy(), inventory).map((blocker) => blocker.kind)).toEqual(['disabled-held', 'disabled-held']);
  });

  it('treats missing roots as empty', () => {
    const inventory = takeInventory(shipped(), governedRoots(path.join(tempDir('data-missing'), 'nope'), path.join(tempDir('data-missing-logs'), 'nope')));
    expect(inventory.files).toEqual([]);
  });
});
