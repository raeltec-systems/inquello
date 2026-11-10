/** Corrective import regressions: SQLite-family isolation and destination links. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { importData } from '../src/main/data/import';
import { exportedFilePath, MANIFEST_FILE, MANIFEST_FORMAT } from '../src/main/data/export';
import { governedRoots } from '../src/main/data/inventory';
import { loadShippedPolicy, type DataRoot } from '../src/main/data/policy';

const loaded = loadShippedPolicy();
if (!loaded.ok) throw new Error(loaded.error);
const policy = loaded.policy;
const temporary: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture(files: Array<{ category: string; root: DataRoot; path: string; content: string }>) {
  // Canonicalize the system temp root (e.g. macOS /var -> /private/var), so
  // tests do not accidentally supply a linked ancestor themselves.
  const base = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'inquello-import-boundary-'));
  temporary.push(base);
  const userData = path.join(base, 'device');
  fs.mkdirSync(userData);
  const roots = governedRoots(userData, path.join(userData, 'logs'));
  const source = path.join(base, 'export');
  fs.mkdirSync(source);
  const included = files.map((file) => {
    write(exportedFilePath(source, file.root, file.path), file.content);
    return { category: file.category, label: file.category, files: [{ root: file.root, path: file.path, size: Buffer.byteLength(file.content), sha256: createHash('sha256').update(file.content).digest('hex') }] };
  });
  write(path.join(source, MANIFEST_FILE), JSON.stringify({ format: MANIFEST_FORMAT, version: 1, createdAt: '2026-10-30T00:00:00Z', included, omissions: [] }));
  return { base, roots, source, userData, run: () => importData({ policy, roots, source }) };
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
const database = { category: 'working-store', root: 'user-data' as const, path: 'working/working.sqlite', content: 'synthetic database bytes' };
const wal = { ...database, path: 'working/working.sqlite-wal', content: 'synthetic WAL bytes' };
const task = { category: 'task-folders', root: 'user-data' as const, path: 'tasks/task-a/output/note.txt', content: 'synthetic task output' };

// These fixtures test file-set isolation, not SQLite validity or WAL semantics.
describe('working-store import family isolation', () => {
  it.each(['working.sqlite', 'working.sqlite-wal', 'working.sqlite-shm', 'other.sqlite'])('rejects an existing %s before restoring any category', async (name) => {
    const f = fixture([task, wal, database]);
    const existing = path.join(f.userData, 'working', name);
    write(existing, 'existing bytes');
    await expect(f.run()).rejects.toThrow(/working store already holds data/);
    expect(fs.readFileSync(existing, 'utf8')).toBe('existing bytes');
    expect(fs.existsSync(path.join(f.userData, task.path))).toBe(false);
    expect(fs.readdirSync(path.join(f.userData, 'working'))).toEqual([name]);
  });

  it('leaves no partial family when the second file cannot be copied', async () => {
    const f = fixture([database, wal, task]);
    const open = fs.promises.open;
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args: Parameters<typeof fs.promises.open>) => {
      if (String(args[0]).includes('.import-working-') && String(args[0]).endsWith('working.sqlite-wal')) {
        throw Object.assign(new Error('synthetic copy failure'), { code: 'EIO' });
      }
      return open(...args);
    });
    const result = await f.run();
    expect(result.notRestored.filter((entry) => entry.category === 'working-store')).toHaveLength(2);
    expect(fs.existsSync(path.join(f.userData, database.path))).toBe(false);
    expect(fs.existsSync(path.join(f.userData, wal.path))).toBe(false);
    expect(fs.readdirSync(f.userData).some((name) => name.startsWith('.import-working-'))).toBe(false);
    expect(fs.readFileSync(path.join(f.userData, task.path), 'utf8')).toBe(task.content);
  });

  it('preserves a competing database created immediately before directory publication', async () => {
    const f = fixture([database, wal]);
    const rename = fs.renameSync;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (String(from).includes('.import-working-')) write(path.join(String(to), 'working.sqlite'), 'competing DB');
      return rename(from, to);
    });
    const result = await f.run();
    expect(result.notRestored).toHaveLength(2);
    expect(fs.readFileSync(path.join(f.userData, database.path), 'utf8')).toBe('competing DB');
    expect(fs.readdirSync(path.join(f.userData, 'working'))).toEqual(['working.sqlite']);
    expect(fs.readdirSync(f.userData)).toEqual(['working']);
  });

  it('preserves unclassified files in the working directory instead of replacing it', async () => {
    const f = fixture([database, wal]);
    write(path.join(f.userData, 'working/keep.txt'), 'keep');
    const result = await f.run();
    expect(result.notRestored).toHaveLength(2);
    expect(fs.readdirSync(path.join(f.userData, 'working'))).toEqual(['keep.txt']);
  });

  it.each(['EEXIST', 'EPERM'])('supports an empty working directory when rename first reports %s (Windows-style)', async (code) => {
    const f = fixture([database, wal]);
    fs.mkdirSync(path.join(f.userData, 'working'));
    const rename = fs.renameSync;
    let first = true;
    vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (first && String(from).includes('.import-working-')) {
        first = false;
        throw Object.assign(new Error('empty destination exists'), { code });
      }
      return rename(from, to);
    });
    const result = await f.run();
    expect(result.notRestored).toEqual([]);
    expect(fs.readFileSync(path.join(f.userData, database.path), 'utf8')).toBe(database.content);
    expect(fs.readFileSync(path.join(f.userData, wal.path), 'utf8')).toBe(wal.content);
  });

  it('refuses a database appearing before the Windows empty-directory removal', async () => {
    const f = fixture([database, wal]);
    fs.mkdirSync(path.join(f.userData, 'working'));
    vi.spyOn(fs, 'renameSync').mockImplementation(() => { throw Object.assign(new Error('exists'), { code: 'EPERM' }); });
    const remove = fs.rmdirSync;
    vi.spyOn(fs, 'rmdirSync').mockImplementation((target, options) => {
      if (path.basename(String(target)) === 'working') write(path.join(String(target), 'working.sqlite'), 'racing DB');
      return remove(target, options);
    });
    const result = await f.run();
    expect(result.notRestored).toHaveLength(2);
    expect(fs.readFileSync(path.join(f.userData, database.path), 'utf8')).toBe('racing DB');
    expect(fs.readdirSync(path.join(f.userData, 'working'))).toEqual(['working.sqlite']);
  });

  it('restores an empty working-store family byte-identically', async () => {
    const f = fixture([database, wal]);
    const result = await f.run();
    expect(result.notRestored).toEqual([]);
    expect(fs.readFileSync(path.join(f.userData, database.path), 'utf8')).toBe(database.content);
    expect(fs.readFileSync(path.join(f.userData, wal.path), 'utf8')).toBe(wal.content);
    expect(fs.readdirSync(path.join(f.userData, 'working')).sort()).toEqual(['working.sqlite', 'working.sqlite-wal']);
  });
});

describe('import destination boundaries', () => {
  it.each(['root', 'working', 'task-output'])('rejects a pre-existing linked %s directory before writing any category', async (kind) => {
    const f = fixture([task, database]);
    const outside = path.join(f.base, 'outside');
    fs.mkdirSync(outside);
    const link = kind === 'root' ? f.userData : kind === 'working' ? path.join(f.userData, 'working') : path.join(f.userData, 'tasks/task-a/output');
    if (kind === 'root') fs.rmdirSync(f.userData);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(f.run()).rejects.toThrow(/linked or non-directory ancestor/);
    expect(fs.readdirSync(outside)).toEqual([]);
    if (kind !== 'root') expect(fs.existsSync(path.join(f.userData, database.path))).toBe(false);
  });

  it('never overwrites an existing target and removes staging files', async () => {
    const f = fixture([task]);
    write(path.join(f.userData, task.path), 'keep this');
    const result = await f.run();
    expect(result.notRestored).toHaveLength(1);
    expect(result.notRestored[0]!.reason).toMatch(/already exists/);
    expect(fs.readFileSync(path.join(f.userData, task.path), 'utf8')).toBe('keep this');
    expect(fs.readdirSync(path.dirname(path.join(f.userData, task.path)))).toEqual(['note.txt']);
  });

  it('does not replace a file created immediately before publication', async () => {
    const f = fixture([task]);
    const link = fs.linkSync;
    vi.spyOn(fs, 'linkSync').mockImplementation((from, to) => {
      fs.writeFileSync(to, 'concurrent file', { flag: 'wx' });
      return link(from, to);
    });
    const result = await f.run();
    expect(result.notRestored[0]!.reason).toMatch(/already exists/);
    expect(fs.readFileSync(path.join(f.userData, task.path), 'utf8')).toBe('concurrent file');
    expect(fs.readdirSync(path.dirname(path.join(f.userData, task.path)))).toEqual(['note.txt']);
  });

  it('fails closed and cleans staging when the filesystem cannot publish a hard link', async () => {
    const f = fixture([task]);
    vi.spyOn(fs, 'linkSync').mockImplementation(() => { throw Object.assign(new Error('unsupported'), { code: 'ENOTSUP' }); });
    const result = await f.run();
    expect(result.notRestored[0]!.reason).toBe('It could not be written (ENOTSUP)');
    expect(fs.existsSync(path.join(f.userData, task.path))).toBe(false);
    expect(fs.readdirSync(path.dirname(path.join(f.userData, task.path)))).toEqual([]);
  });

  it.skipIf(process.platform !== 'linux')('pins Linux writes and cleanup when a destination ancestor is replaced during copying', async () => {
    const f = fixture([task]);
    const outside = path.join(f.base, 'outside');
    const moved = path.join(f.base, 'original-output');
    fs.mkdirSync(outside);
    const parent = path.dirname(path.join(f.userData, task.path));
    const open = fs.promises.open;
    let swapped = false;
    vi.spyOn(fs.promises, 'open').mockImplementation(async (...args: Parameters<typeof fs.promises.open>) => {
      if (!swapped && String(args[0]).startsWith('/proc/self/fd/') && String(args[0]).includes('/.import-')) {
        swapped = true;
        fs.renameSync(parent, moved);
        fs.symlinkSync(outside, parent, 'dir');
      }
      return open(...args);
    });
    const result = await f.run();
    expect(swapped).toBe(true);
    expect(result.notRestored).toHaveLength(1);
    expect(fs.readdirSync(outside)).toEqual([]);
    expect(fs.readdirSync(moved)).toEqual([]);
  });
});

describe('publication-owned rollback ledger',()=>{
 it.each(['ordinary','family'] as const)('never quarantines competing skipped %s data after later denial',async kind=>{
  const {quarantinePublications}=await import('../src/main/data/import');
  const f=fixture(kind==='family'?[database,wal,task]:[task,database]);const publications:import('../src/main/data/import').ImportPublication[]=[];
  const link=fs.linkSync,rename=fs.renameSync;
  if(kind==='ordinary')vi.spyOn(fs,'linkSync').mockImplementation((from,to)=>{write(String(to),'competitor');link(from,to);});
  else vi.spyOn(fs,'renameSync').mockImplementation((from,to)=>{if(String(from).includes('.import-working-'))write(path.join(String(to),'working.sqlite'),'competitor');rename(from,to);});
  const result=await importData({policy,roots:f.roots,source:f.source,onPublished:p=>publications.push(p)});
  expect(result.notRestored.length).toBeGreaterThan(0);
  quarantinePublications(publications,path.join(f.base,'quarantine'));
  expect(fs.readFileSync(path.join(f.userData,kind==='family'?database.path:task.path),'utf8')).toBe('competitor');
  expect(publications).toHaveLength(1);
  expect(fs.existsSync(path.join(f.userData,kind==='family'?task.path:database.path))).toBe(false);
 });
 it.each(['ordinary','family'] as const)('refuses cleanup of a replaced published %s identity',async kind=>{
  const {quarantinePublications}=await import('../src/main/data/import');const f=fixture(kind==='family'?[database,wal]:[task]);const publications:import('../src/main/data/import').ImportPublication[]=[];
  await importData({policy,roots:f.roots,source:f.source,onPublished:p=>publications.push(p)});
  const target=publications[0]!.target;fs.renameSync(target,`${target}.old`);if(kind==='family')write(path.join(target,'other.sqlite'),'competitor');else write(target,'competitor');
  expect(()=>quarantinePublications(publications,path.join(f.base,'quarantine'))).toThrow(/changed/);
  expect(fs.readFileSync(kind==='family'?path.join(target,'other.sqlite'):target,'utf8')).toBe('competitor');
 });
});

it.skipIf(process.platform!=='linux').each(['ordinary','family'] as const)('rejects a moved %s destination during final authority wait before publication',async kind=>{
 const f=fixture(kind==='family'?[database,wal]:[task]);const publications:unknown[]=[];let moved=false;
 const parent=kind==='family'?f.userData:path.dirname(path.join(f.userData,task.path));const displaced=path.join(f.base,'displaced');
 let copyClosed=false;const open=fs.promises.open;
 vi.spyOn(fs.promises,'open').mockImplementation(async(...args:Parameters<typeof fs.promises.open>)=>{
  const handle=await open(...args);const name=String(args[0]);
  if(name.includes('.import-')&&(kind==='ordinary'||name.endsWith('working.sqlite-wal'))){const close=handle.close.bind(handle);handle.close=async()=>{await close();copyClosed=true;};}
  return handle;
 });
 const result=await importData({policy,roots:f.roots,source:f.source,onPublished:p=>publications.push(p),authorize:async()=>{
  if(moved||!copyClosed||!fs.existsSync(parent))return;
  const stage=fs.readdirSync(parent).find(name=>kind==='family'?name.startsWith('.import-working-'):name.startsWith('.import-'));
  if(!stage)return;
  // The family has copied all members (ordinary file has all bytes): this is
  // the final pre-publication authority callback, not an earlier chunk check.
  if(kind==='family'&&(!fs.existsSync(path.join(parent,stage,'working.sqlite-wal'))||fs.statSync(path.join(parent,stage,'working.sqlite-wal')).size!==Buffer.byteLength(wal.content)))return;
  if(kind==='ordinary'&&fs.statSync(path.join(parent,stage)).size!==Buffer.byteLength(task.content))return;
  fs.renameSync(parent,displaced);fs.mkdirSync(parent);moved=true;
 }});
 expect(moved).toBe(true);expect(publications).toEqual([]);expect(result.notRestored.length).toBeGreaterThan(0);
 expect(fs.existsSync(path.join(displaced,kind==='family'?'working':path.basename(task.path)))).toBe(false);
 expect(fs.readdirSync(displaced)).toEqual([]);
});
