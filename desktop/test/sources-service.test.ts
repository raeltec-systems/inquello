/**
 * Story 2.1, main process without the sandbox: the policy gate, attaching to
 * an idle Task, the Task-start path (staging waits for the first turn), the
 * per-Task view that checks an answer's references, retention, deletion and
 * the IPC payloads. The sandbox is a fake that answers like the skill's
 * `inventory` and `verify-batch`; the reading itself is covered in
 * `sources-sandbox.test.ts`.
 *
 * I/O matrix rows covered here:
 * - No attachment: `view` has no attachments and no Coverage; references in an answer stay unverified.
 * - Attach single files / Attach and start: `attachToNewTask` defers, then stages once the turn ends; the view names the material.
 * - Verified reference: a quote found at the location is verified, retained and carries file, location, time and hash.
 * - Unverifiable reference: a different quote or an unknown file is unverified and nothing is retained.
 * - Computed figure: the computed marker keeps its command and inputs.
 * - Inaccessible / Unsupported / Bounds hit (presentation facts): Coverage carries Not searched, Inaccessible and the incomplete flag.
 * - Deletion: after the Task's extracts are deleted the view re-reads and nothing is verified or retained again.
 * - Policy unknown: attach and staging are unavailable with the blocking reason.
 * Also: attaching to a running Task is refused, a Task that cannot be read is refused, payloads never carry a path.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it, vi } from 'vitest';

import { loadShippedPolicy, type DataPolicy } from '../src/main/data';
import { createOperations, OperationError } from '../src/main/security/operations';
import { SOURCES_DEFERRED_NOTICE, SOURCES_REASONS, SourcesService, sourcesPolicyGate, type StagingTarget, type TaskTurnState } from '../src/main/sources';
import type { Entry } from '../src/main/runtime/wsl-tasks';
import { sourcesAttachPayload, sourcesStagePayload, sourcesViewPayload } from '../src/main/tasks/validators';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());
const desktop = path.resolve(__dirname, '..');
const skillRoot = path.join(desktop, 'resources', 'skills', 'inquello-evidence');
const TASK = '6f1c1d1e-0000-4000-8000-0000000000aa';
const WORKSPACE = '6f1c1d1e-0000-4000-8000-0000000000bb';
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); return file; };

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

function harness(options: { state?: () => TaskTurnState | null; gate?: () => { ok: true } | { ok: false; reason: string }; lines?: Record<string, Array<{ label: string; text: string }>> } = {}) {
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
    logger: recordingLogger(),
  });
  return { service, staged, sandbox, changed, folder, setState: (next: TaskTurnState | null) => { state = next; } };
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
  it('stages into an idle Task, returns the note for the agent and the Coverage, and never names an absolute path', async () => {
    const x = harness();
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    expect(attached.value.notSearched).toEqual([{ relative: 'Engagement/tool.exe', reason: 'Unsupported file type' }]);
    const staged = await x.service.stageIdle(TASK, WORKSPACE, attached.value.attachmentId);
    if (!staged.ok || staged.value.state !== 'staged') throw new Error(staged.ok ? 'deferred' : staged.reason);
    expect(staged.value.note).toBe('Attached material (Engagement) is in the Task folder under attached/. Read it with the evidence skill in skills/inquello-evidence/SKILL.md and cite what you rely on.');
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
  it('waits for the first turn to end, says so, then stages and tells the renderer', async () => {
    const x = harness();
    x.setState({ status: 'running', messages: [] });
    const attached = await x.service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    expect(x.service.stageBeforeFirstTurn(TASK, attached.value.attachmentId).supported).toBe(false);
    const deferred = await x.service.attachToNewTask(TASK, WORKSPACE, attached.value.attachmentId);
    expect(deferred).toEqual({ ok: true, value: { state: 'deferred', label: 'Engagement', notice: SOURCES_DEFERRED_NOTICE } });
    await x.service.flushDeferred();
    expect(x.staged).toEqual([]);
    const waiting = await x.service.view(TASK, WORKSPACE);
    expect(waiting).toMatchObject({ ok: true, value: { deferred: [{ attachmentId: attached.value.attachmentId, label: 'Engagement' }], attachments: [], coverage: null, note: null } });
    x.setState({ status: 'completed', messages: [] });
    await x.service.flushDeferred();
    expect(x.staged).toHaveLength(1);
    expect(x.changed).toEqual([TASK]);
    const ready = await x.service.view(TASK, WORKSPACE);
    if (!ready.ok) throw new Error(ready.reason);
    expect(ready.value.deferred).toEqual([]);
    expect(ready.value.attachments).toEqual([{ attachmentId: attached.value.attachmentId, label: 'Engagement', kind: 'folder', files: 2 }]);
    expect(ready.value.note).toContain('attached/');
  });
});

describe('references in a Task’s answers', () => {
  it('without attachments: no Coverage, and citations stay unverified with nothing retained', async () => {
    const x = harness();
    x.setState({ status: 'completed', messages: [{ itemId: 'm1', text: answer }, { itemId: 'm0', text: 'No directives here.' }] });
    const view = await x.service.view(TASK, WORKSPACE);
    if (!view.ok) throw new Error(view.reason);
    expect(view.value).toMatchObject({ attachments: [], coverage: null, deferred: [], note: null });
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

describe('the sources operations', () => {
  it('accept only a dialog kind, IDs and booleans; a path or an extra key is refused', () => {
    expect(sourcesAttachPayload([{ kind: 'folder' }])).toEqual({ kind: 'folder' });
    for (const bad of [[{ kind: 'C:\\Engagement' }], [{ kind: 'files', path: 'C:\\x' }], [{ kind: 'files' }, 'C:\\x'], []]) expect(() => sourcesAttachPayload(bad)).toThrow(OperationError);
    expect(() => sourcesStagePayload([{ taskId: TASK, workspaceId: WORKSPACE, attachmentId: 'C:\\Engagement', firstTurn: false }])).toThrow(OperationError);
    expect(() => sourcesStagePayload([{ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK, firstTurn: 'yes' }])).toThrow(OperationError);
    expect(() => sourcesViewPayload([{ taskId: TASK, workspaceId: WORKSPACE, answer: 'forged text' }])).toThrow(OperationError);
  });

  it('route first-turn staging to the start path and the rest to the idle path', async () => {
    const sources = { attach: vi.fn(), discard: vi.fn(), stageIdle: vi.fn(async () => ({ ok: true })), attachToNewTask: vi.fn(async () => ({ ok: true })), view: vi.fn() };
    const operations = createOperations({ sources, runtimeState: () => 'ready', runtimeVersion: '0' } as never);
    const stage = operations.find(op => op.name === 'sources.stage')!;
    await stage.handle({ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK, firstTurn: true });
    await stage.handle({ taskId: TASK, workspaceId: WORKSPACE, attachmentId: TASK, firstTurn: false });
    expect(sources.attachToNewTask).toHaveBeenCalledWith(TASK, WORKSPACE, TASK);
    expect(sources.stageIdle).toHaveBeenCalledWith(TASK, WORKSPACE, TASK);
  });
});
