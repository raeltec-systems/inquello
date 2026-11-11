/**
 * Story 2.1 without the sandbox: citation parsing, attachment inventory on the
 * Windows side, staging entries, verification decisions over a fake sandbox,
 * the private extract store, Coverage, the data-policy gate and the
 * `source-extracts` category through export, import and delete.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { deleteCategories, exportData, governedRoots, importData, loadShippedPolicy, takeInventory, type DataPolicy } from '../src/main/data';
import {
  coverage, ExtractStore, formatOf, inventoryAttachment, locationLabel, mergeEntries, parseCitations, parseMarkers, readerDigests, SKILL_DIR, SourcesService,
  stagingEntries, validLocator, VERIFY_BOOT, verifyCitations, attachmentView, type ReferenceView, type RunInTask,
} from '../src/main/sources';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());
const desktop = path.resolve(__dirname, '..');
const skillRoot = path.join(desktop, 'resources', 'skills', 'inquello-evidence');
const policy: DataPolicy = (() => { const load = loadShippedPolicy(); if (!load.ok) throw new Error(load.error); return load.policy; })();
const write = (file: string, content: string | Buffer) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };
const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

describe('citation directives', () => {
  it('parses well-formed references in every format and rejects locations in the wrong terms', () => {
    const answer = [
      ':inquello-source{id="attached/a.txt" at="L10-L14" quote="x"}', ':inquello-source{id="attached/b.csv" at="R2-R9" quote="x"}',
      ':inquello-source{id="attached/c.xlsx" at="Sheet1!A1:C9" quote="x"}', ':inquello-source{id="attached/c.xlsx" at="\'Reviewer notes\'!A1" quote="x"}',
      ':inquello-source{id="attached/d.docx" at="P12-P15" quote="x"}', ':inquello-source{id="attached/e.pptx" at="S3" quote="x"}',
      ':inquello-source{id="attached/f.pdf" at="PG4:L3-L8" quote="x"}', ':inquello-source{id="attached/g.png" at="" quote=""}',
      ':inquello-source{id="attached/old.doc" at="P2" quote="x"}', ':inquello-source{id="attached/old.xls" at="Payments!B3" quote="x"}',
    ].join(' ');
    const { citations, problems } = parseCitations(answer);
    expect(problems).toEqual([]);
    expect(citations.map(c => c.at)).toEqual(['L10-L14', 'R2-R9', 'Sheet1!A1:C9', "'Reviewer notes'!A1", 'P12-P15', 'S3', 'PG4:L3-L8', '', 'P2', 'Payments!B3']);
    expect(validLocator('pdf', 'L3')).toBe(false);
    expect(validLocator('csv', 'L3')).toBe(false);
    expect(validLocator('xlsx', 'A1')).toBe(false);
  });

  it('refuses paths outside the attached material, malformed directives and empty quotes, and unescapes quotes', () => {
    const { citations, problems } = parseCitations([
      ':inquello-source{id="attached/../x.txt" at="L1" quote="a"}', ':inquello-source{id="/etc/passwd" at="L1" quote="a"}',
      ':inquello-source{id="attached/a.txt" at="L1" quote=""}', ':inquello-source{id="attached/a.txt" at="L1" quote="a" extra="b"}',
      ':inquello-source{id="attached/a.pdf" at="L1" quote="a"}', ':inquello-source{id="attached/a.txt" at="L1" quote="say \\"yes\\""}',
    ].join('\n'));
    expect(problems.map(p => p.reason)).toEqual(['The reference does not name an attached file', 'The reference does not name an attached file', 'The reference quotes no text', 'The reference is malformed', 'The location is not in this file’s own terms']);
    expect(citations.map(c => c.quote)).toEqual(['say "yes"']);
  });

  it('labels locations in plain words and keeps computed commands and inferences', () => {
    expect(locationLabel('pdf', 'PG4:L3-L8')).toBe('page 4, lines 3–8');
    expect(locationLabel('xlsx', "'Reviewer notes'!A1")).toBe('sheet Reviewer notes, cell A1');
    expect(locationLabel('csv', 'R2-R9')).toBe('rows 2–9');
    expect(locationLabel('image', '')).toBe('whole image');
    expect(formatOf('x.TIFF')).toBe('image');
    const markers = parseMarkers('Total 5 :inquello-computed{command="python3 -c \'print(5)\'" from="attached/a.csv R2-R6"} likely weekly :inquello-inference{} :inquello-computed{from="x"}');
    expect(markers.computed).toEqual([expect.objectContaining({ command: "python3 -c 'print(5)'", from: 'attached/a.csv R2-R6' })]);
    expect(markers.inferences).toHaveLength(1);
  });
});

describe('attachment inventory on the Windows side', () => {
  it('attaches a folder, lists unsupported, oversized-name and link entries as not searched, and keeps originals unchanged', () => {
    const root = tempDir('sources-folder');
    const folder = path.join(root, 'Engagement');
    write(path.join(folder, 'ledger.csv'), 'a,b\n1,2\n');
    write(path.join(folder, 'sub', 'notes.txt'), 'hello');
    write(path.join(folder, 'tool.exe'), Buffer.from([0, 1, 2]));
    try { fs.symlinkSync(path.join(folder, 'ledger.csv'), path.join(folder, 'link.csv'), 'file'); } catch { /* symlinks need a privilege on some Windows hosts */ }
    const before = sha(fs.readFileSync(path.join(folder, 'ledger.csv')));
    const attachment = inventoryAttachment({ files: [], folders: [folder] });
    expect(attachment.files.map(file => [file.id, file.format, file.relative])).toEqual([['attached/Engagement/ledger.csv', 'csv', 'Engagement/ledger.csv'], ['attached/Engagement/sub/notes.txt', 'text', 'Engagement/sub/notes.txt']]);
    expect(attachment.notSearched).toEqual(expect.arrayContaining([{ relative: 'Engagement/tool.exe', reason: 'Unsupported file type' }]));
    if (fs.existsSync(path.join(folder, 'link.csv'))) expect(attachment.notSearched).toEqual(expect.arrayContaining([{ relative: 'Engagement/link.csv', reason: 'Link or shortcut; not followed' }]));
    expect(attachment.incomplete.length).toBeGreaterThan(0);
    expect(JSON.stringify(attachmentView(attachment))).not.toContain(root);
    expect(sha(fs.readFileSync(path.join(folder, 'ledger.csv')))).toBe(before);
  });

  it('treats a single attached file like a one-file folder', () => {
    const root = tempDir('sources-single');
    const file = write(path.join(root, 'policy.txt'), 'line one\n');
    const attachment = inventoryAttachment({ files: [file], folders: [] });
    expect(attachment.files.map(item => [item.id, item.sha256])).toEqual([['attached/policy.txt', sha('line one\n')]]);
    expect(attachment.label).toBe('policy.txt');
    expect(attachment.incomplete).toEqual([]);
  });

  it.skipIf(process.platform !== 'win32')('lists a denied file as inaccessible, still attaches the rest, and refuses a denied folder', () => {
    const root = tempDir('sources-denied');
    const folder = path.join(root, 'Folder');
    write(path.join(folder, 'open.txt'), 'open');
    const denied = write(path.join(folder, 'denied.txt'), 'secret');
    const user = `${os.userInfo().username}`;
    execFileSync('icacls', [denied, '/deny', `${user}:(R)`], { stdio: 'ignore' });
    try {
      const attachment = inventoryAttachment({ files: [], folders: [folder] });
      expect(attachment.files.map(file => file.relative)).toEqual(['Folder/open.txt']);
      expect(attachment.inaccessible).toEqual([{ relative: 'Folder/denied.txt', reason: 'Permission denied by the operating system' }]);
    } finally { execFileSync('icacls', [denied, '/remove:d', user], { stdio: 'ignore' }); }
    const closed = path.join(root, 'Closed');
    fs.mkdirSync(closed);
    execFileSync('icacls', [closed, '/deny', `${user}:(RD)`], { stdio: 'ignore' });
    try { expect(() => inventoryAttachment({ files: [], folders: [closed] })).toThrow(/denied access/); }
    finally { execFileSync('icacls', [closed, '/remove:d', user], { stdio: 'ignore' }); }
  });

  it('stages the material and the skill, and refuses a file changed since it was attached', () => {
    const root = tempDir('sources-stage');
    const file = write(path.join(root, 'a.txt'), 'first');
    const other = write(path.join(root, 'b.txt'), 'second');
    const attachment = inventoryAttachment({ files: [file, other], folders: [] });
    fs.writeFileSync(other, 'changed');
    const { entries, changed } = stagingEntries(attachment, skillRoot);
    expect(changed).toEqual([{ relative: 'b.txt', reason: 'Changed since it was attached; attach it again' }]);
    expect(entries.filter(e => e.kind === 'file' && e.path.startsWith('attached/')).map(e => e.path)).toEqual(['attached/a.txt']);
    expect(entries.some(e => e.path === `${SKILL_DIR}/scripts/evidence.py`)).toBe(true);
    expect(entries.some(e => e.path.includes('__pycache__'))).toBe(false);
    const merged = mergeEntries([{ path: 'output', kind: 'directory' }, { path: `${SKILL_DIR}/scripts/stale.py`, kind: 'file', data: '', sha256: sha('') }, { path: 'attached', kind: 'directory' }], entries);
    expect(merged.some(e => e.path.endsWith('stale.py'))).toBe(false);
    expect(merged.filter(e => e.path === 'attached')).toHaveLength(1);
    expect(merged.some(e => e.path === 'output')).toBe(true);
  });
});

describe('verification decisions', () => {
  const view = attachmentView(inventoryAttachment({ files: [write(path.join(tempDir('sources-verify'), 'ledger.csv'), 'Vendor,Amount\nNorthwind,10\n')], folders: [] }));
  const file = view.files[0]!;
  const runner = (result: unknown, seen?: string[][]): RunInTask => async (argv) => { seen?.push(argv); return { ok: true, value: { exitCode: 0, stdout: JSON.stringify(result), stderr: '' } }; };

  it('verifies a quote found at the location and runs the pinned readers through the boot loader', async () => {
    const seen: string[][] = [];
    const { citations } = parseCitations(':inquello-source{id="attached/ledger.csv" at="R2" quote="Northwind"}');
    const [ref] = await verifyCitations(citations, view, readerDigests(skillRoot), runner([{ ok: true, sha256: file.sha256, lines: [{ label: 'R1', text: 'Vendor | Amount' }, { label: 'R2', text: 'Northwind | 10' }] }], seen));
    expect(ref).toMatchObject({ status: 'verified', location: 'row 2', file: { name: 'ledger.csv', sha256: file.sha256 } });
    expect(seen[0]!.slice(0, 3)).toEqual(['/usr/bin/python3', '-I', '-c']);
    expect(seen[0]![3]).toBe(VERIFY_BOOT);
    expect(Object.keys(JSON.parse(seen[0]![4]!))).toEqual(expect.arrayContaining(['evidence.py', 'readers/common.py', 'readers/read_pdf.py']));
  });

  it('never shows as verified a different quote, a changed staged copy, a changed skill, a failed run or an unknown file', async () => {
    const quote = ':inquello-source{id="attached/ledger.csv" at="R2" quote="Contoso"}';
    const ok = { ok: true, sha256: file.sha256, lines: [{ label: 'R2', text: 'Northwind | 10' }] };
    const cases: Array<[string, RunInTask, string]> = [
      [quote, runner([ok]), 'The quoted text is not at that location'],
      [quote.replace('Contoso', 'Northwind'), runner([{ ...ok, sha256: 'f'.repeat(64) }]), 'The staged copy changed since it was attached'],
      [quote, runner({ skillChanged: 'readers/read_csv.py' }), 'The reading scripts in the Task folder were changed; references cannot be checked'],
      [quote, async () => ({ ok: false, reason: 'Local sandbox unavailable on this device' }), 'The reference could not be checked: Local sandbox unavailable on this device'],
      [':inquello-source{id="attached/other.csv" at="R2" quote="x"}', runner([]), 'The cited file is not in this Task’s attached material'],
    ];
    for (const [answer, run, reason] of cases) {
      const [ref] = await verifyCitations(parseCitations(answer).citations, view, readerDigests(skillRoot), run);
      expect([ref!.status, ref!.reason, ref!.extract]).toEqual(['unverified', reason, null]);
    }
  });
});

describe('the private extract store', () => {
  const verified: ReferenceView = { index: 0, id: 'attached/a.csv', at: 'R2', quote: 'Northwind', format: 'csv', location: 'row 2', status: 'verified', reason: null,
    file: { name: 'a.csv', relative: 'a.csv', modifiedAt: '2026-11-11T00:00:00.000Z', sha256: 'a'.repeat(64), bytes: 10 }, extract: { text: 'R2: Northwind | 10', ocr: false, converted: false, originalSha256: null, wholeFile: false } };
  const task = '6f1c1d1e-0000-4000-8000-000000000001';

  it('retains verified extracts per creator and Task, never unverified ones, and deletes them with the Task', () => {
    const store = new ExtractStore(tempDir('sources-store'));
    expect(store.retain('alice', task, { ...verified, status: 'unverified', extract: null })).toBeNull();
    const kept = store.retain('alice', task, verified)!;
    expect(store.retain('alice', task, verified)!.extractId).toBe(kept.extractId);
    expect(store.extracts('alice', task)).toHaveLength(1);
    expect(store.extracts('bob', task)).toEqual([]);
    expect(store.deleteTask('alice', task)).toEqual({ removed: 1, remaining: 0 });
    expect(store.extracts('alice', task)).toEqual([]);
  });

  it('discards an interrupted write on recovery and never resurrects a deleted extract', () => {
    const userData = tempDir('sources-recover');
    const store = new ExtractStore(userData);
    const kept = store.retain('alice', task, verified)!;
    const folder = path.dirname(fs.readdirSync(store.root, { recursive: true }).map(name => path.join(store.root, String(name))).find(name => name.endsWith(`${kept.extractId}.json`))!);
    write(path.join(folder, `${kept.extractId}.json.123.tmp`), '{"partial"');
    store.deleteTask('alice', task);
    write(path.join(folder, `${'b'.repeat(32)}.json.456.tmp`), '{"partial"');
    expect(store.recover()).toBe(1);
    expect(store.extracts('alice', task)).toEqual([]);
  });

  it('is governed by the enabled source-extracts category through export, import and delete', async () => {
    const userData = tempDir('sources-data');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    new ExtractStore(userData).retain('alice', task, verified);
    const inventory = takeInventory(policy, roots);
    expect(inventory.unclassified).toEqual([]);
    expect(inventory.files.filter(f => f.category === 'source-extracts')).toHaveLength(1);
    const destination = path.join(tempDir('sources-export'), 'out');
    const { manifest } = await exportData({ policy, roots, destination, journal: { append: () => {} }, attribution: { principal: { displayName: 'A', issuerLabel: 'B' }, appVersion: '0', runtimeVersion: '0' } });
    expect(manifest.included.find(entry => entry.category === 'source-extracts')!.files).toHaveLength(1);
    const target = governedRoots(path.join(tempDir('sources-import'), 'ud'), path.join(tempDir('sources-import-logs'), 'logs'));
    const imported = await importData({ policy, roots: target, source: destination });
    expect(imported.restored).toContainEqual({ category: 'source-extracts', label: 'Source references and extracts', files: 1 });
    expect(new ExtractStore(target['user-data']).extracts('alice', task).map(item => item.reference.quote)).toEqual(['Northwind']);
    const report = await deleteCategories({ policy, roots, categories: ['source-extracts'], journalEntries: [] });
    expect(report.removed).toContainEqual(expect.objectContaining({ category: 'source-extracts', filesRemoved: 1, filesRemaining: 0 }));
    expect(new ExtractStore(userData).extracts('alice', task)).toEqual([]);
  });
});

describe('Coverage and the policy gate', () => {
  it('states files read against files attached, rows read against rows present, and an incomplete input set', () => {
    const view = attachmentView(inventoryAttachment({ files: [write(path.join(tempDir('sources-cov'), 'a.csv'), 'h\n1\n2\n'), write(path.join(tempDir('sources-cov2'), 'b.xlsx'), 'PK')], folders: [] }));
    const result = coverage([view], [{ path: 'attached/a.csv', status: 'readable', counts: { rows: 2 } }, { path: 'attached/b.xlsx', status: 'unreadable', reason: 'corrupt or not an Office file' }]);
    expect(result).toMatchObject({ filesAttached: 2, filesRead: 1, rows: { read: 2, present: 2, unknown: 1 }, incomplete: true, unreadable: [{ relative: 'b.xlsx', reason: 'corrupt or not an Office file' }] });
    expect(result.statement).toBe('1 of 2 attached files read; 2 of 2 rows read in the readable tables, rows of 1 unreadable table(s) not counted. The input set is incomplete.');
    expect(coverage([view], [{ path: 'attached/a.csv', status: 'readable', counts: { rows: 2 } }, { path: 'attached/b.xlsx', status: 'readable', counts: { sheets: { S: { rows: 3 } } } }]).incomplete).toBe(false);
  });

  it('makes attaching unavailable with the blocking reason when the category is not enabled', async () => {
    let chosen = false;
    const service = new SourcesService({ userData: tempDir('sources-gate'), skillRoot, principalId: () => 'alice', choose: async () => { chosen = true; return null; }, runTool: async () => ({ ok: false, reason: 'no' }),
      stagingTarget: () => { throw new Error('no'); }, policyGate: () => ({ ok: false, reason: 'Source references and extracts is enabled with an unknown retention' }), logger: recordingLogger() });
    expect(await service.attach('folder')).toEqual({ ok: false, reason: 'Source references and extracts is enabled with an unknown retention' });
    expect(chosen).toBe(false);
  });
});
