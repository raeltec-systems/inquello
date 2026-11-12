/**
 * Story 2.1, main process without the sandbox: the policy gate, attaching to
 * an idle Task, the Task-start path (staged before the first turn), the
 * per-Task view that checks an answer's references, retention, deletion and
 * the IPC payloads. The sandbox is a fake that answers like the skill's
 * `inventory` and `verify-batch`; the reading itself is covered in
 * `sources-sandbox.test.ts`.
 *
 * I/O matrix rows covered here:
 * - No attachment: `view` has no attachments and no Coverage; references in an answer stay unverified.
 * - Attach single files / Attach and start: `startTask` writes one bounded manifest the runtime stages before the first turn; a retried start never stages twice; a failed start keeps the material held; the view names the material.
 * - Verified reference: a quote found at the location is verified, retained and carries file, location, time and hash.
 * - Unverifiable reference: a different quote or an unknown file is unverified and nothing is retained.
 * - Computed figure: the computed marker keeps its command and inputs.
 * - Inaccessible / Unsupported / Bounds hit (presentation facts): Coverage carries Not searched, Inaccessible and the incomplete flag.
 * - Deletion: after the Task's extracts are deleted the view re-reads and nothing is verified or retained again.
 * - Policy unknown: attach and staging are unavailable with the blocking reason.
 * Also: attaching to a running Task is refused, a Task that cannot be read is refused, payloads never carry a path.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { loadShippedPolicy, type DataPolicy } from '../src/main/data';
import { createOperations, OperationError } from '../src/main/security/operations';
import { SOURCES_REASONS, SourcesService, hostStagingTarget, removeStartManifests, sourcesPolicyGate, type StagingTarget, type TaskTurnState } from '../src/main/sources';
import { validateTransfer, type Entry } from '../src/main/runtime/wsl-tasks';
import { sourcesAttachPayload, sourcesStagePayload, sourcesViewPayload, taskStartPayload } from '../src/main/tasks/validators';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());
const desktop = path.resolve(__dirname, '..');
const skillRoot = path.join(desktop, 'resources', 'skills', 'inquello-evidence');
const TASK = '6f1c1d1e-0000-4000-8000-0000000000aa';
const WORKSPACE = '6f1c1d1e-0000-4000-8000-0000000000bb';
const OPERATION = '6f1c1d1e-0000-4000-8000-0000000000cc';
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };
const ok = <T,>(result: { ok: true; value: T } | { ok: false; reason: string }): T => { if (!result.ok) throw new Error(result.reason); return result.value; };

/** A sandbox that answers the skill's commands from a table of located lines. */
function fakeSandbox(lines: Record<string, Array<{ label: string; text: string }>>) {
  const calls: string[] = [];
  const runTool = vi.fn(async (_taskId: string, argv: string[]) => {
    const command = argv[5]!;
    calls.push(command);
    if (command === 'inventory') return { ok: true as const, value: { exitCode: 0, stderr: '', stdout: JSON.stringify({ files: [
      { path: 'attached/Engagement/ledger.csv', status: 'readable', kind: 'csv', counts: { rows: 2 } },
      { path: 'attached/Engagement/notes.txt', status: 'readable', kind: 'text', counts: { lines: 2 } },
    ] }) } };
    if (command === 'verify-batch') {
      const items = JSON.parse(argv[6]!) as Array<[string, string, string]>;
      return { ok: true as const, value: { exitCode: 0, stderr: '', stdout: JSON.stringify(items.map(([id, at, sha]) => lines[`${id}#${at}`] ? { ok: true, sha256: sha, lines: lines[`${id}#${at}`] } : { ok: false, reason: 'Nothing at that location' })) } };
    }
    return { ok: false as const, reason: 'unexpected command' };
  });
  return { runTool, calls };
}

function harness(options: { startMaterial?: (operationId: string) => string | null; state?: () => TaskTurnState | null; gate?: () => { ok: true } | { ok: false; reason: string }; lines?: Record<string, Array<{ label: string; text: string }>> } = {}) {
  const root = tempDir('sources-service');
  const folder = path.join(root, 'Engagement');
  write(path.join(folder, 'ledger.csv'), 'Vendor,Amount\nNorthwind,10\n');
  write(path.join(folder, 'notes.txt'), 'Bank confirmation received\nSigned by the controller\n');
  write(path.join(folder, 'tool.exe'), 'MZ');
  const staged: Entry[][] = [];
  const target: StagingTarget = { snapshot: async () => [], replace: async (_taskId, entries) => { staged.push(entries); } };
  const sandbox = fakeSandbox(options.lines ?? { 'attached/Engagement/ledger.csv#R2': [{ label: 'R1', text: 'Vendor | Amount' }, { label: 'R2', text: 'Northwind | 10' }] });
  const changed: string[] = [];
  let state: TaskTurnState | null = { status: 'completed', messages: [] };
  const service = new SourcesService({
    userData: path.join(root, 'userData'), skillRoot, principalId: () => 'alice',
    choose: async () => ({ files: [], folders: [folder] }),
    runTool: sandbox.runTool, stagingTarget: () => target,
    policyGate: options.gate ?? (() => ({ ok: true })),
    taskState: async () => options.state ? options.state() : state,
    onChanged: (taskId) => changed.push(taskId),
    startMaterial: options.startMaterial ?? (operationId => path.join(root, 'profile', 'material', `${operationId}.json`)),
    logger: recordingLogger(),
  });
  return { service, staged, sandbox, changed, folder, manifest: (operationId: string) => path.join(root, 'profile', 'material', `${operationId}.json`), setState: (next: TaskTurnState | null) => { state = next; } };
}

const answer = [
  'Northwind was paid 10 :inquello-source{id="attached/Engagement/ledger.csv" at="R2" quote="Northwind"}.',
  'The controller signed it :inquello-source{id="attached/Engagement/notes.txt" at="L2" quote="Signed by the auditor"}.',
  'Total 10 :inquello-computed{command="python3 -c \'print(10)\'" from="attached/Engagement/ledger.csv R2"} and probably a single payment :inquello-inference{}.',
].join(' ');

describe('the source-extracts policy gate', () => {
  const policy: DataPolicy = (() => { const load = loadShippedPolicy(); if (!load.ok) throw new Error(load.error); return load.policy; })();
  const withCategory = (change: Record<string, unknown> | null) => ({ ok: true as const, policy: { ...policy, categories: policy.categories.flatMap(c => c.id !== 'source-extracts' ? [c] : change === null ? [] : [{ ...c, ...change }]) } as DataPolicy });

  it('is open for the shipped register and closed, with the reason, for a missing, disabled or unknown rule', () => {
    expect(sourcesPolicyGate({ ok: true, policy })).toEqual({ ok: true });
    expect(sourcesPolicyGate({ ok: false, error: 'bad json' })).toEqual({ ok: false, reason: 'Attaching is unavailable: the local data policy did not load.' });
    expect(sourcesPolicyGate(withCategory(null))).toEqual({ ok: false, reason: 'Attaching is unavailable: the local data policy has no rule for source references and extracts.' });
    expect(sourcesPolicyGate(withCategory({ enabled: false }))).toEqual({ ok: false, reason: 'Attaching is unavailable: Source references and extracts is not enabled in the local data policy.' });
    expect(sourcesPolicyGate(withCategory({ retention: 'unknown' }))).toEqual({ ok: false, reason: 'Attaching is unavailable: Source references and extracts is enabled with an unknown retention.' });
  });

  it('blocks attaching and staging, and reports it in the view, when the rule is unknown', async () => {
    let open = true;
    const x = harness({ gate: () => open ? { ok: true } : { ok: false, reason: 'Attaching is unavailable: Source references and extracts is enabled with an unknown retention.' } });
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    open = false;
    expect(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId)).toEqual({ ok: false, reason: 'Attaching is unavailable: Source references and extracts is enabled with an unknown retention.' });
    expect(x.staged).toEqual([]);
    expect(await x.service.attach('files')).toMatchObject({ ok: false });
    const view = await x.service.view(TASK, WORKSPACE);
    expect(view).toMatchObject({ ok: true, value: { available: false, reason: 'Attaching is unavailable: Source references and extracts is enabled with an unknown retention.' } });
  });
});

describe('attaching to an existing Task', () => {
  it('stages into an idle Task, returns the Coverage and no message text, and never names an absolute path', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    expect(attached.value.notSearched).toEqual([{ relative: 'Engagement/tool.exe', reason: 'Unsupported file type' }]);
    const staged = await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId);
    if (!staged.ok) throw new Error(staged.reason);
    expect(staged.value).not.toHaveProperty('note');
    expect(staged.value.coverage).toMatchObject({ filesAttached: 3, filesRead: 2, incomplete: true, notSearched: [{ relative: 'Engagement/tool.exe', reason: 'Unsupported file type' }] });
    expect(x.staged[0]!.map(entry => entry.path)).toEqual(expect.arrayContaining(['attached/Engagement/ledger.csv', 'attached/Engagement/notes.txt', 'skills/inquello-evidence/SKILL.md']));
    expect(JSON.stringify(staged.value)).not.toContain(x.folder);
    expect(JSON.stringify(await x.service.view(TASK, WORKSPACE))).not.toContain(x.folder);
  });

  it('refuses while a turn runs and when the Task cannot be read, staging nothing', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    x.setState({ status: 'running', messages: [] });
    expect(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId)).toEqual({ ok: false, reason: SOURCES_REASONS.busy });
    x.setState(null);
    expect(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId)).toEqual({ ok: false, reason: SOURCES_REASONS.taskUnavailable });
    expect(x.staged).toEqual([]);
    expect(x.sandbox.calls).toEqual([]);
  });
});

describe('attaching at Task start', () => {
  const started = (status: string, taskId = TASK) => ({ ok: true as const, value: { operationId: OPERATION, taskId, runId: TASK, threadId: 'thread-1', status, request: 'r', accepted: status === 'running' } });

  it('writes one bounded transfer manifest that the start stages before the first turn, then examines it once the turn ends', async () => {
    const x = harness();
    x.setState({ status: 'running', messages: [] });
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    let seen: { sha256: string; manifest: Entry[] } | null = null;
    const start = vi.fn(async (material: { sha256: string }) => {
      const bytes = fs.readFileSync(x.manifest(OPERATION));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(material.sha256);
      seen = { sha256: material.sha256, manifest: JSON.parse(bytes.toString('utf8')) as Entry[] };
      return started('running');
    });
    const result = await x.service.startTask(OPERATION, [attached.value.attachmentId], start);
    expect(result).toEqual(started('running'));
    expect(start).toHaveBeenCalledTimes(1);
    const manifest = seen!.manifest;
    expect(() => validateTransfer(manifest)).not.toThrow();
    expect(manifest.map(entry => entry.path)).toEqual(expect.arrayContaining(['attached', 'attached/Engagement', 'attached/Engagement/ledger.csv', 'attached/Engagement/notes.txt', 'skills/inquello-evidence/SKILL.md']));
    expect(manifest.some(entry => entry.path.endsWith('tool.exe'))).toBe(false);
    expect(JSON.stringify(manifest)).not.toContain(x.folder);
    // The manifest is removed once the runtime answered; nothing went through the between-turns staging.
    expect(fs.existsSync(x.manifest(OPERATION))).toBe(false);
    expect(x.staged).toEqual([]);
    expect(x.changed).toEqual([TASK]);
    // While the first turn runs the material is listed but not yet examined (the running turn holds the Task folder).
    const running = await x.service.view(TASK, WORKSPACE);
    if (!running.ok) throw new Error(running.reason);
    expect(running.value.attachments).toEqual([{ attachmentId: attached.value.attachmentId, label: 'Engagement', kind: 'folder', files: 2 }]);
    expect(running.value.coverage?.unreadable.map(item => item.reason)).toEqual(['Not yet examined in the sandbox', 'Not yet examined in the sandbox']);
    expect(running.value).not.toHaveProperty('note');
    expect(x.sandbox.calls).toEqual([]);
    x.setState({ status: 'completed', messages: [] });
    const done = await x.service.view(TASK, WORKSPACE);
    if (!done.ok) throw new Error(done.reason);
    expect(done.value.coverage).toMatchObject({ filesAttached: 3, filesRead: 2, incomplete: true });
    expect(done.value.problem).toBeNull();
    await x.service.view(TASK, WORKSPACE);
    expect(x.sandbox.calls).toEqual(['inventory']);
  });

  it('never stages twice for a retried start, and records an uncertain start only when reconciliation confirms it', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    const id = attached.value.attachmentId;
    expect(await x.service.startTask(OPERATION, [id], async () => started('running'))).toMatchObject({ ok: true });
    const again = vi.fn(async () => started('running'));
    // The attachment went with the first start; resending the same start cannot stage it again.
    expect(await x.service.startTask(OPERATION, [id], again)).toEqual({ ok: false, code: 'refused', reason: SOURCES_REASONS.unknown });
    expect(again).not.toHaveBeenCalled();

    const y = harness();
    const held = await y.service.attach('folder');
    if (!held.ok || !held.value) throw new Error('attach failed');
    const uncertain = { ok: false as const, code: 'uncertain' as const, reason: 'The submission outcome is uncertain.' };
    expect(await y.service.startTask(OPERATION, [held.value.attachmentId], async () => uncertain)).toEqual(uncertain);
    expect(fs.existsSync(y.manifest(OPERATION))).toBe(false);
    expect((await y.service.view(TASK, WORKSPACE)).ok && y.service.coverage(TASK)).toEqual({ ok: true, value: null });
    y.service.reconciled('6f1c1d1e-0000-4000-8000-0000000000ff', started('running'));
    expect(y.service.coverage(TASK)).toEqual({ ok: true, value: null });
    y.service.reconciled(OPERATION, started('running'));
    expect(y.service.coverage(TASK)).toMatchObject({ ok: true, value: { filesAttached: 3 } });
  });

  it('keeps the attachments held when staging fails, the start is refused or the manifest cannot be written', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    const id = attached.value.attachmentId;
    const failed = { ok: true as const, value: { ...started('setup-failed').value, accepted: false, reason: 'The attached material could not be placed in the Task folder, so the first request was not sent.' } };
    expect(await x.service.startTask(OPERATION, [id], async () => failed)).toEqual(failed);
    expect(x.service.coverage(TASK)).toEqual({ ok: true, value: null });
    expect(fs.existsSync(x.manifest(OPERATION))).toBe(false);
    const refused = { ok: false as const, code: 'refused' as const, reason: 'The attached material could not be placed in the Task folder, so nothing was sent.' };
    expect(await x.service.startTask(OPERATION, [id], async () => refused)).toEqual(refused);
    // A manifest that cannot be written refuses the start before anything is sent.
    fs.mkdirSync(x.manifest(OPERATION), { recursive: true });
    const never = vi.fn(async () => started('running'));
    expect(await x.service.startTask(OPERATION, [id], never)).toEqual({ ok: false, code: 'refused', reason: SOURCES_REASONS.startFailed });
    expect(never).not.toHaveBeenCalled();
    fs.rmSync(x.manifest(OPERATION), { recursive: true });
    // Still held: a deliberate new Send stages it.
    expect(await x.service.startTask(OPERATION, [id], async () => started('running'))).toMatchObject({ ok: true });
    expect(x.service.coverage(TASK)).toMatchObject({ ok: true, value: { filesAttached: 3 } });
  });

  it('refuses at start, before sending, where the device cannot stage at Task start; between turns still stages into the Task folder', async () => {
    const x = harness({ startMaterial: () => null });
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    const never = vi.fn(async () => started('running'));
    expect(await x.service.startTask(OPERATION, [attached.value.attachmentId], never)).toEqual({ ok: false, code: 'refused', reason: SOURCES_REASONS.startUnavailable });
    expect(never).not.toHaveBeenCalled();
    // A Task under Full access (its Windows folder) is staged between turns through the host target.
    const folder = tempDir('full-access-task');
    const target = hostStagingTarget(() => folder);
    await target.replace(TASK, [{ path: 'attached', kind: 'directory' }, { path: 'attached/a.txt', kind: 'file', data: Buffer.from('a').toString('base64'), sha256: createHash('sha256').update('a').digest('hex') }]);
    expect(fs.readFileSync(path.join(folder, 'attached', 'a.txt'), 'utf8')).toBe('a');
  });
});
describe('references in a Task’s answers', () => {
  it('without attachments: no Coverage, and citations stay unverified with nothing retained', async () => {
    const x = harness();
    x.setState({ status: 'completed', messages: [{ itemId: 'm1', text: answer }, { itemId: 'm0', text: 'No directives here.' }] });
    const view = await x.service.view(TASK, WORKSPACE);
    if (!view.ok) throw new Error(view.reason);
    expect(view.value).toMatchObject({ attachments: [], coverage: null, problem: null });
    expect(view.value.messages.map(m => m.itemId)).toEqual(['m1']);
    expect(view.value.messages[0]!.references.map(r => [r.status, r.reason])).toEqual([['unverified', 'The cited file is not in this Task’s attached material'], ['unverified', 'The cited file is not in this Task’s attached material']]);
    expect(x.sandbox.calls).toEqual([]);
    expect(x.service.extracts(TASK)).toEqual({ ok: true, value: [] });
  });

  it('verifies after the turn ends, retains only verified extracts, marks positions, keeps computed commands and checks once', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId);
    x.setState({ status: 'running', messages: [{ itemId: 'm1', text: answer }] });
    const running = await x.service.view(TASK, WORKSPACE);
    if (!running.ok) throw new Error(running.reason);
    expect(running.value.messages[0]!.state).toBe('waiting');
    expect(running.value.messages[0]!.references.every(r => r.status === 'unverified' && r.reason === 'Not yet checked: the turn is still running')).toBe(true);
    expect(x.sandbox.calls).toEqual(['inventory']);
    x.setState({ status: 'completed', messages: [{ itemId: 'm1', text: answer }] });
    const done = await x.service.view(TASK, WORKSPACE);
    if (!done.ok) throw new Error(done.reason);
    const message = done.value.messages[0]!;
    expect(message.state).toBe('checked');
    const [paid, signed] = message.references;
    expect(paid).toMatchObject({ status: 'verified', location: 'row 2', file: { name: 'ledger.csv', relative: 'Engagement/ledger.csv' }, extract: { text: 'R1: Vendor | Amount\nR2: Northwind | 10', ocr: false } });
    expect(answer.slice(paid!.start, paid!.end)).toBe(paid!.raw);
    expect(paid!.file!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(signed).toMatchObject({ status: 'unverified', reason: 'Nothing at that location', extract: null });
    expect(message.computed).toEqual([expect.objectContaining({ command: "python3 -c 'print(10)'", from: 'attached/Engagement/ledger.csv R2' })]);
    expect(message.inferences).toHaveLength(1);
    const kept = x.service.extracts(TASK);
    expect(kept.ok && kept.value.map(e => e.reference.quote)).toEqual(['Northwind']);
    await x.service.view(TASK, WORKSPACE);
    expect(x.sandbox.calls.filter(c => c === 'verify-batch')).toHaveLength(1);
  });

  it('after the Task’s extracts are deleted, nothing verifies or is retained again', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId);
    x.setState({ status: 'completed', messages: [{ itemId: 'm1', text: answer }] });
    await x.service.view(TASK, WORKSPACE);
    expect(x.service.deleteTask(TASK)).toMatchObject({ ok: true, value: { remaining: 0 } });
    const after = await x.service.view(TASK, WORKSPACE);
    if (!after.ok) throw new Error(after.reason);
    expect(after.value.coverage).toBeNull();
    expect(after.value.messages[0]!.references.every(r => r.status === 'unverified')).toBe(true);
    expect(x.service.extracts(TASK)).toEqual({ ok: true, value: [] });
    expect(fs.readFileSync(path.join(x.folder, 'ledger.csv'), 'utf8')).toBe('Vendor,Amount\nNorthwind,10\n');
  });
});

describe('review pass 1 (2026-11-12)', () => {
  const started = (status: string) => ({ ok: true as const, value: { operationId: OPERATION, taskId: TASK, runId: TASK, threadId: 'thread-1', status, request: 'r', accepted: status === 'running' } });
  const sandboxDown = async () => ({ ok: false as const, reason: 'Local sandbox unavailable on this device' });

  it('checks an answer again when the first check did not run, and keeps a check that ran (VG2)', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    ok(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId));
    x.setState({ status: 'completed', messages: [{ itemId: 'm1', text: answer }] });
    x.sandbox.runTool.mockImplementationOnce(sandboxDown);
    const first = ok(await x.service.view(TASK, WORKSPACE));
    expect(first.messages[0]!.references.map(r => [r.status, r.reason])).toEqual([['unverified', 'The reference could not be checked: Local sandbox unavailable on this device'], ['unverified', 'The reference could not be checked: Local sandbox unavailable on this device']]);
    // Same staged state, same answer: the check runs again instead of repeating the failure.
    const second = ok(await x.service.view(TASK, WORKSPACE));
    expect(second.messages[0]!.references.map(r => r.status)).toEqual(['verified', 'unverified']);
    await x.service.view(TASK, WORKSPACE);
    expect(x.sandbox.calls.filter(c => c === 'verify-batch')).toHaveLength(1);
  });

  it('examines start-time material again after a failed examination, once the status changes or a minute has passed', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    expect(await x.service.startTask(OPERATION, [attached.value.attachmentId], async () => started('running'))).toMatchObject({ ok: true });
    x.setState({ status: 'completed', messages: [] });
    x.sandbox.runTool.mockImplementationOnce(sandboxDown);
    expect(ok(await x.service.view(TASK, WORKSPACE)).problem).toBe(SOURCES_REASONS.notExamined);
    expect(ok(await x.service.view(TASK, WORKSPACE)).problem).toBe(SOURCES_REASONS.notExamined);
    expect(x.sandbox.calls).toEqual([]);
    // A minute later the same idle Task is examined again.
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 61_000);
    try {
      x.sandbox.runTool.mockImplementationOnce(sandboxDown);
      expect(ok(await x.service.view(TASK, WORKSPACE)).problem).toBe(SOURCES_REASONS.notExamined);
      // A new turn (the status changes) also clears the failure; once idle again it is examined and succeeds.
      x.setState({ status: 'running', messages: [] });
      expect(ok(await x.service.view(TASK, WORKSPACE)).problem).toBeNull();
      x.setState({ status: 'completed', messages: [] });
      const done = ok(await x.service.view(TASK, WORKSPACE));
      expect([done.problem, done.coverage?.filesRead]).toEqual([null, 2]);
    } finally { clock.mockRestore(); }
    expect(x.sandbox.calls).toEqual(['inventory']);
  });

  it('tells the Task view when material was attached between turns (EC18)', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    ok(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId));
    expect(x.changed).toEqual([TASK]);
  });

  it('refuses an attachment with no supported files (BH7)', async () => {
    const x = harness();
    fs.rmSync(path.join(x.folder, 'ledger.csv'));
    fs.rmSync(path.join(x.folder, 'notes.txt'));
    expect(await x.service.attach('folder')).toEqual({ ok: false, reason: SOURCES_REASONS.nothingStaged });
  });

  it('refuses a start, before sending, when the material folder cannot be prepared (EC16)', async () => {
    const x = harness({ startMaterial: () => { throw new Error('EPERM: operation not permitted'); } });
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    const never = vi.fn(async () => started('running'));
    expect(await x.service.startTask(OPERATION, [attached.value.attachmentId], never)).toEqual({ ok: false, code: 'refused', reason: SOURCES_REASONS.startFailed });
    expect(never).not.toHaveBeenCalled();
  });

  it('treats a Task whose outcome is uncertain as not idle: nothing staged, examined or checked (EC11)', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    x.setState({ status: 'uncertain', messages: [] });
    expect(await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId)).toEqual({ ok: false, reason: SOURCES_REASONS.uncertain });
    expect(x.staged).toEqual([]);
    expect(await x.service.startTask(OPERATION, [attached.value.attachmentId], async () => started('running'))).toMatchObject({ ok: true });
    x.setState({ status: 'uncertain', messages: [{ itemId: 'm1', text: answer }] });
    const view = ok(await x.service.view(TASK, WORKSPACE));
    expect(view.messages[0]!.state).toBe('waiting');
    expect(view.messages[0]!.references.every(r => r.reason === 'Not yet checked: the outcome of the turn is uncertain')).toBe(true);
    expect(x.sandbox.calls).toEqual([]);
  });

  it('removes every start-time manifest left in the material folder, whatever its age (BH8)', () => {
    const folder = tempDir('sources-material');
    write(path.join(folder, `${OPERATION}.json`), '[]');
    write(path.join(folder, `${OPERATION}.json.1.tmp`), '[');
    expect(removeStartManifests(folder)).toBe(2);
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(removeStartManifests(path.join(folder, 'missing'))).toBe(0);
  });
});

describe('the sources operations', () => {
  it('accept only a dialog kind and IDs; a path, a flag or an extra key is refused', () => {
    expect(sourcesAttachPayload([{ kind: 'folder' }])).toEqual({ kind: 'folder' });
    for (const bad of [[{ kind: 'C:\\Engagement' }], [{ kind: 'files', path: 'C:\\x' }], [{ kind: 'files' }, 'C:\\x'], []]) expect(() => sourcesAttachPayload(bad)).toThrow(OperationError);
    expect(sourcesStagePayload([{ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK }])).toEqual({ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK });
    expect(() => sourcesStagePayload([{ taskId: TASK, workspaceId: WORKSPACE, attachmentId: 'C:\\Engagement' }])).toThrow(OperationError);
    expect(() => sourcesStagePayload([{ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK, firstTurn: true }])).toThrow(OperationError);
    expect(() => sourcesViewPayload([{ taskId: TASK, workspaceId: WORKSPACE, answer: 'forged text' }])).toThrow(OperationError);
    const start = { operationId: OPERATION, workspaceId: WORKSPACE, routeId: 'codex-responses', configurationRevision: 1, engagementId: null, folderId: null, request: 'Read the ledger', reasoning: 'default', speed: 'default' };
    expect(taskStartPayload([start])).not.toHaveProperty('attachmentIds');
    expect(taskStartPayload([{ ...start, attachmentIds: [TASK] }])).toMatchObject({ attachmentIds: [TASK] });
    for (const ids of [[], ['C:\\Engagement'], [TASK, TASK], Array.from({ length: 9 }, (_, i) => `6f1c1d1e-0000-4000-8000-00000000000${i}`), 'C:\\Engagement']) expect(() => taskStartPayload([{ ...start, attachmentIds: ids }])).toThrow(OperationError);
  });

  it('send a start with material through the sources path, never forward the IDs to the runtime, and report reconciliation', async () => {
    const sources = { attach: vi.fn(), discard: vi.fn(), stageIdle: vi.fn(async () => ({ ok: true })), view: vi.fn(), reconciled: vi.fn(),
      startTask: vi.fn(async (_operationId: string, _ids: string[], start: (material: { sha256: string }) => Promise<unknown>) => start({ sha256: 'f'.repeat(64) })) };
    const tasks = { start: vi.fn(async () => ({ ok: true, value: {} })), reconcile: vi.fn(async () => ({ ok: true, value: {} })) };
    const operations = createOperations({ sources, tasks, runtimeState: () => 'ready', runtimeVersion: '0' } as never);
    const handle = (name: string, input: unknown) => operations.find(op => op.name === name)!.handle(input);
    const start = { operationId: OPERATION, workspaceId: WORKSPACE, routeId: 'codex-responses', configurationRevision: 1, engagementId: null, folderId: null, request: 'Read the ledger', reasoning: 'default', speed: 'default' };
    await handle('tasks.start', start);
    expect(tasks.start).toHaveBeenLastCalledWith(start);
    expect(sources.startTask).not.toHaveBeenCalled();
    await handle('tasks.start', { ...start, attachmentIds: [TASK] });
    expect(sources.startTask).toHaveBeenCalledWith(OPERATION, [TASK], expect.any(Function));
    expect(tasks.start).toHaveBeenLastCalledWith(start, { sha256: 'f'.repeat(64) });
    await handle('tasks.reconcile', { operationId: OPERATION });
    expect(sources.reconciled).toHaveBeenCalledWith(OPERATION, { ok: true, value: {} });
    await handle('sources.stage', { taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK });
    expect(sources.stageIdle).toHaveBeenCalledWith(TASK, WORKSPACE, TASK);
  });});
