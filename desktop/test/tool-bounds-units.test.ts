/**
 * Story 1.19, main process: the Task folder and its data-register entry
 * (export and delete), the translation of the runtime's own results into
 * denials, the escalation gate and its RPC path, the plain-word reach and
 * the tool-bounds smoke evaluation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';

import { afterAll, describe, expect, it } from 'vitest';

import { deleteCategories, governedRoots, loadShippedPolicy, takeInventory } from '../src/main/data';
import {
  DENIAL_SANDBOX,
  ensureTaskFolder,
  EscalationGate,
  networkDenialText,
  outsideDenialText,
  reachView,
  taskFolderPaths,
  taskFoldersRoot,
  translateDenials,
  type ReachBoundary,
} from '../src/main/policy';
import { RpcConnection } from '../src/main/runtime';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const TASK = '3a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c3d';
const OTHER = '4b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const BOUNDED: ReachBoundary[] = [
  { kind: 'working_folder', access: 'write', label: 'working folder (read/write)' },
  { kind: 'output_folder', access: 'write', label: 'output folder' },
  { kind: 'system', access: 'read', label: 'system (read-only)' },
];
const READ_ONLY: ReachBoundary[] = [
  { kind: 'working_folder', access: 'read', label: 'working folder (read-only)' },
  { kind: 'output_folder', access: 'read', label: 'output folder (read-only)' },
  { kind: 'system', access: 'read', label: 'system (read-only)' },
];
const PERMITTED = 'working folder (read/write), output folder, system (read-only)';
const tick = () => new Promise((resolve) => setImmediate(resolve));

afterAll(() => removeTempDirs());

describe('the Task folder', () => {
  it('is created private on first use, inside the data area, and named after the Task', () => {
    const userData = tempDir('task-folder');
    const root = taskFoldersRoot(userData);
    expect(root).toBe(path.join(userData, 'tasks'));
    const folders = ensureTaskFolder(root, TASK);
    expect(folders).toEqual({ working: path.join(root, TASK), output: path.join(root, TASK, 'output') });
    expect(fs.statSync(folders.output).isDirectory()).toBe(true);
    if (process.platform !== 'win32') for (const dir of [root, folders.working, folders.output]) expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    // Again: nothing changes.
    expect(ensureTaskFolder(root, TASK)).toEqual(folders);
    expect(() => taskFolderPaths(root, '../escape')).toThrow();
  });

  it('is governed by the task-folders category: classified, exported and removed by delete', async () => {
    const load = loadShippedPolicy();
    if (!load.ok) throw new Error(load.error);
    const policy = load.policy;
    const category = policy.categories.find((entry) => entry.id === 'task-folders')!;
    expect(category).toMatchObject({ enabled: true, credentials: false, access: 'runtime', retention: 'until-owner-deletes', export: { mode: 'included' } });
    const userData = tempDir('task-folder-delete');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    const used = ensureTaskFolder(taskFoldersRoot(userData), TASK);
    fs.writeFileSync(path.join(used.output, 'a.txt'), 'synthetic');
    const unused = ensureTaskFolder(taskFoldersRoot(userData), OTHER);
    const inventory = takeInventory(policy, roots);
    expect(inventory.files.filter((file) => file.rel.startsWith('tasks/')).map((file) => file.category)).toEqual(['task-folders']);
    expect(inventory.unclassified ?? []).toEqual([]);
    const report = await deleteCategories({ policy, roots, categories: ['task-folders'], journalEntries: [] });
    expect(report.removed).toEqual([{ category: 'task-folders', label: 'Task working folders', filesRemoved: 1, filesRemaining: 0 }]);
    // Both folders are gone, including the one that held no file.
    expect(fs.existsSync(used.working)).toBe(false);
    expect(fs.existsSync(unused.working)).toBe(false);
  });
});

describe('denial translation', () => {
  const dir = tempDir('denials');
  const working = path.join(dir, 'tasks', TASK);
  const output = path.join(working, 'output');
  const other = path.join(dir, 'tasks', OTHER);
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'secret.txt'), 'x');
  const context = { working, output, bounded: true, boundaries: BOUNDED };
  const run = (stderr: string, stdout = '', exitCode = 1) => translateDenials({ exitCode, stdout, stderr }, context);

  it('names the destination from the proxy’s own blocked answer', () => {
    const body = '{"status":"blocked","host":"example.com","reason":"not_allowed","decision":"deny","source":"baseline_policy","protocol":"http","port":80,"message":"Domain not in allowlist."}';
    expect(run('', body, 0)).toEqual([{ kind: 'network', text: networkDenialText('example.com'), boundary: null, destination: 'example.com' }]);
    expect(networkDenialText('example.com')).toBe("Blocked: example.com is not on this Workspace's allowed list");
    const verbose = '* Connected to 127.0.0.1\n> CONNECT example.net:443 HTTP/1.1\n< HTTP/1.1 403 Forbidden\n< x-proxy-error: blocked-by-allowlist\ncurl: (56) CONNECT tunnel failed, response 403\n';
    expect(run(verbose).map((denial) => denial.text)).toEqual([networkDenialText('example.net')]);
    // A refusal that names nothing says only that the sandbox blocked it.
    expect(run('curl: (56) CONNECT tunnel failed, response 403\n').map((denial) => denial.text)).toEqual([DENIAL_SANDBOX]);
  });

  it('names the boundary for a read-only system location, a hidden path and a read-only folder', () => {
    expect(run('sh: 1: cannot create /etc/x: Read-only file system\n')).toEqual([
      { kind: 'filesystem', text: outsideDenialText('system (read-only)'), boundary: 'system (read-only)', destination: null },
    ]);
    expect(outsideDenialText('system (read-only)')).toBe("Blocked: outside this Task's permitted locations. Boundary: system (read-only).");
    // Another Task's folder exists on this device but not inside the sandbox.
    expect(run(`cat: ${path.join(other, 'secret.txt')}: No such file or directory\n`).map((denial) => denial.boundary)).toEqual([PERMITTED]);
    expect(run(`sh: 1: cannot create ${path.join(other, 'new.txt')}: Directory nonexistent\n`).map((denial) => denial.text)).toEqual([outsideDenialText(PERMITTED)]);
    expect(run("touch: cannot touch '/etc/hosts': Operation not permitted\n").map((denial) => denial.boundary)).toEqual([PERMITTED]);
    const readOnly = translateDenials({ exitCode: 2, stdout: '', stderr: 'sh: 1: cannot create notes.txt: Read-only file system\nsh: 1: cannot create output/a.txt: Read-only file system\n' }, { ...context, boundaries: READ_ONLY });
    expect(readOnly.map((denial) => denial.boundary)).toEqual(['working folder (read-only)', 'output folder (read-only)']);
  });

  it('reports nothing the sandbox did not cause, and nothing for an unbounded run', () => {
    // A file genuinely missing, inside or outside: not a denial.
    expect(run('cat: output/missing.txt: No such file or directory\n')).toEqual([]);
    expect(run(`cat: ${path.join(dir, 'nowhere', 'x')}: No such file or directory\n`)).toEqual([]);
    // Host permissions outside the Task folder are not the sandbox's.
    expect(run('cat: /etc/shadow: Permission denied\n')).toEqual([]);
    expect(run('', 'ok', 0)).toEqual([]);
    expect(translateDenials({ exitCode: 1, stdout: '', stderr: 'sh: 1: cannot create /etc/x: Read-only file system\n' }, { ...context, bounded: false, boundaries: [] })).toEqual([]);
    // A sandbox failure with nothing attributable.
    expect(run('bwrap: setting up uid map: Permission denied\n').map((denial) => denial.text)).toEqual([DENIAL_SANDBOX]);
  });
});

describe('the escalation gate', () => {
  it('records each escalation as a pending authorization request and declines it, naming the boundary', () => {
    let n = 0;
    const gate = new EscalationGate({ newId: () => `auth-${++n}`, now: () => new Date('2026-10-29T12:00:00Z'), boundaryFor: (thread) => (thread === 'thread-1' ? PERMITTED : null) });
    expect(gate.answer('item/commandExecution/requestApproval', { threadId: 'thread-1', turnId: 't', itemId: 'i', command: 'rm -rf /' })).toEqual({ decision: 'decline' });
    expect(gate.answer('item/commandExecution/requestApproval', { threadId: 'thread-2', networkApprovalContext: { host: 'example.com', protocol: 'https' } })).toEqual({ decision: 'decline' });
    expect(gate.answer('item/fileChange/requestApproval', { threadId: 'thread-2' })).toEqual({ decision: 'decline' });
    expect(gate.answer('item/permissions/requestApproval', { threadId: 'thread-1' })).toEqual({ permissions: {}, scope: 'turn' });
    expect(gate.answer('execCommandApproval', { conversationId: 'thread-1' })).toEqual({ decision: { denied: { rejection: outsideDenialText(PERMITTED) } } });
    expect(gate.answer('item/tool/requestUserInput', {})).toBeUndefined();
    expect(gate.pending().map((entry) => [entry.id, entry.status, entry.reason])).toEqual([
      ['auth-1', 'declined', outsideDenialText(PERMITTED)],
      ['auth-2', 'declined', networkDenialText('example.com')],
      ['auth-3', 'declined', DENIAL_SANDBOX],
      ['auth-4', 'declined', outsideDenialText(PERMITTED)],
      ['auth-5', 'declined', outsideDenialText(PERMITTED)],
    ]);
  });

  it('answers through the runtime connection and leaves other server requests unsupported', async () => {
    const input = new PassThrough();
    const written: string[] = [];
    const output = new Writable({
      write(chunk, _encoding, done) {
        written.push(String(chunk));
        done();
      },
    });
    const gate = new EscalationGate({ newId: () => 'auth' });
    new RpcConnection(input, output, { logger: recordingLogger(), onFatal: () => undefined, onServerRequest: (method, params) => gate.answer(method, params) });
    input.write(`${JSON.stringify({ id: 'srv-1', method: 'item/fileChange/requestApproval', params: { threadId: 't' } })}\n`);
    input.write(`${JSON.stringify({ id: 'srv-2', method: 'item/tool/call', params: {} })}\n`);
    await tick();
    expect(written.map((line) => JSON.parse(line))).toEqual([
      { id: 'srv-1', result: { decision: 'decline' } },
      { id: 'srv-2', error: { code: -32601, message: 'Inquello desktop does not handle server request item/tool/call' } },
    ]);
    expect(gate.pending()).toHaveLength(1);
  });
});

describe('the reach in plain words', () => {
  const source = { kind: 'inquello_default', revision: null };
  it('explains a bounded reach without paths or sandbox syntax', () => {
    const view = reachView({ bounded: true, boundaries: BOUNDED, network: 'listed', domains: ['example.org', '*.example.com'], networkSource: { kind: 'workspace_policy', revision: 4 } }, 'task');
    expect(view.lines).toEqual([
      { name: 'read', label: 'Can read', value: "This Task's working folder, Output folder and the system files tools need in order to run (read only). Nothing else on this device." },
      { name: 'write', label: 'Can write to', value: "This Task's working folder and Output folder only." },
      { name: 'contact', label: 'Can contact', value: 'Only example.org, *.example.com. Any other destination is blocked.' },
    ]);
    expect(view.networkSourceLabel).toBe('Restricted by Workspace policy, revision 4');
    const readOnly = reachView({ bounded: true, boundaries: READ_ONLY, network: 'listed', domains: [], networkSource: source }, 'workspace');
    expect(readOnly.lines.map((line) => line.value)).toEqual([
      "A Task's own working folder, its Output folder and the system files tools need in order to run (read only). Nothing else on this device.",
      'Nothing: the policy allows no writes, so these folders are read only.',
      'No network destinations. Every destination is blocked.',
    ]);
    const words = JSON.stringify([view.lines, readOnly.lines]);
    expect(words).not.toMatch(/approv|review|accept|permission|:minimal|bwrap|\//);
  });

  it('never shows a Full access reach as bounded', () => {
    const view = reachView({ bounded: false, boundaries: [], network: 'unrestricted', domains: [], networkSource: source }, 'task');
    expect(view.bounded).toBe(false);
    expect(view.lines.map((line) => line.value)).toEqual([
      'No filesystem limits: tools can read and change anything this account can on this device',
      'No network limits: tools can contact any destination',
    ]);
    expect(() => reachView({ bounded: false, boundaries: BOUNDED, network: 'unrestricted', domains: [], networkSource: source }, 'task')).toThrow();
    expect(() => reachView({ bounded: true, boundaries: [], network: 'listed', domains: [], networkSource: source }, 'task')).toThrow();
  });
});

describe('the tool-bounds smoke evaluation', () => {
  it('fails a run with no denials and passes none of the checks by default', async () => {
    const { evaluateToolBounds } = await import('../src/main/smoke-probe');
    const report = evaluateToolBounds({ configured: true, seedRead: true, signedIn: true, tasksCreated: true, signedOutAtEnd: true, writeOutside: { ok: true, exitCode: 0, denials: [], fileOnDevice: true } });
    expect(report.ok).toBe(false);
    expect(report.failures.some((failure) => failure.startsWith('a write outside was not denied'))).toBe(true);
    expect(report.failures.some((failure) => failure.startsWith('an unlisted destination was not blocked'))).toBe(true);
  });
});
