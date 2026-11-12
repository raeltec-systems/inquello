/**
 * Story 2.1 in the real sandbox: the reading scripts of the evidence skill run
 * inside a Task's tool profile (the same `inquello/tools/exec` path a model's
 * command and the app's citation check use), against the synthetic engagement
 * folder and its answer key. Needs `INQUELLO_TEST_DATABASE_URL`, the built
 * `codex-app-server` and the dev topology, like the tool-bounds suite.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { loadServiceConfig, SERVICE_CONFIG_ENV, type ServiceConfig } from '../src/main/identity/config';
import { headlessOpener } from '../src/main/identity/headless-opener';
import { IssuerClient, SharedServiceClient, httpsTransport } from '../src/main/identity/service-client';
import { IdentitySession } from '../src/main/identity/session';
import { CredentialVault } from '../src/main/identity/vault';
import { OrganiseService } from '../src/main/organise';
import { PermissionMediator, PolicyService, type ToolRunView } from '../src/main/policy';
import { WslTasks } from '../src/main/runtime/wsl-tasks';
import { SourcesService, VERIFY_BOOT, hostStagingTarget, normaliseQuote, readerDigests, wslStagingTarget } from '../src/main/sources';
import type { Entry } from '../src/main/runtime/wsl-tasks';
import { AppServerRuntime, resolveAppServerBinary, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, removeGuestTaskStorage, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const topologyBinary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const appServer = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);

let topology: ChildProcess | undefined;
let config: ServiceConfig;
let seed: { workspace_id: string; invite_id: string };
let runtime: AppServerRuntime;
let identity: IdentitySession;
let organise: OrganiseService;
let policy: PolicyService;

async function startTopology(dir: string): Promise<void> {
  if (!fs.existsSync(topologyBinary)) throw new Error(`build the dev topology first: ${topologyBinary} is missing`);
  const seedFile = path.join(dir, 'seed.json');
  topology = spawn(topologyBinary, ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic Evidence Co', '--seed-out', seedFile], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: topology.stdout! });
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the topology printed nothing')), 60_000);
    lines.once('line', (text) => { clearTimeout(timer); resolve(text); });
    topology!.once('exit', (code) => reject(new Error(`the topology exited (${code})`)));
  });
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, line);
  const loaded = loadServiceConfig({ [SERVICE_CONFIG_ENV]: file });
  if (loaded.kind !== 'configured') throw new Error('the topology line is not a valid config');
  config = loaded.config;
  seed = JSON.parse(fs.readFileSync(seedFile, 'utf8')) as typeof seed;
}

async function stopTopology(): Promise<void> {
  const child = topology;
  topology = undefined;
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.stdin!.end();
  await exited;
}

const ok = <T,>(result: { ok: true; value: T } | { ok: false; reason: string }): T => {
  if (!result.ok) throw new Error(`expected success, got: ${result.reason}`);
  return result.value;
};
const newTask = async (title: string): Promise<string> =>
  ok(await organise.createTask({ operationId: randomUUID(), workspaceId: seed.workspace_id, engagementId: null, folderId: null, title })).taskId;
const run = async (taskId: string, command: string[], timeoutMs = 60_000): Promise<ToolRunView> => ok(await policy.runTool(taskId, command, { timeoutMs }));

describe.skipIf(!databaseConfigured)('evidence reading in the real Task sandbox', () => {
  beforeAll(async () => {
    const dir = tempDir('sources-sandbox');
    await startTopology(dir);
    const runtimeHome = path.join(dir, 'runtime-home');
    const workingStore = path.join(dir, 'working', 'working.sqlite');
    fs.mkdirSync(path.dirname(workingStore), { recursive: true, mode: 0o700 });
    writeRuntimeConfig(runtimeHome);
    runtime = new AppServerRuntime({
      command: appServer.path,
      commandArgsPrefix: ['--disable-plugin-startup-tasks-for-tests'],
      env: runtimeChildEnv(process.env, { serviceConfigEnv: SERVICE_CONFIG_ENV, codexHome: runtimeHome, workingStore }),
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(dir, 'logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
      onServerRequest: async (method, params) => {
        if (method === 'inquello/context/authorize') return organise?.authorizeContext(params) ?? { available: false, snapshot: null, serviceEngagementIds: [] };
        if (method === 'inquello/tasks/authority') return { workspacePolicy: await policy?.startPolicy((params as { workspaceId: string }).workspaceId) ?? null };
        return undefined;
      },
    });
    await runtime.start();
    const transport = httpsTransport(config.ca);
    const service = new SharedServiceClient(config.serviceUrl, transport);
    identity = new IdentitySession({
      config: { kind: 'configured', config },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: path.join(dir, 'identity') }),
      service,
      issuer: new IssuerClient(config.issuerUrl, transport),
      openBrowser: headlessOpener(transport),
      logger: recordingLogger(),
    });
    expect((await identity.signIn()).ok).toBe(true);
    expect((await identity.withAccess((access) => service.acceptInvite(access, seed.invite_id)))?.workspace_id).toBe(seed.workspace_id);
    const organiseRuntime = { ready: () => runtime.state === 'ready', instance: () => runtime, request: <T,>(method: string, params?: unknown) => runtime.request<T>(method, params) };
    organise = new OrganiseService({ runtime: organiseRuntime, identity, service, logger: recordingLogger() });
    policy = new PolicyService({ runtime: organiseRuntime, identity, organise, service, logger: recordingLogger(), taskFolders: path.join(dir, 'tasks'), sandboxProbeTarget: path.dirname(workingStore), permissions: new PermissionMediator({ runtime: organiseRuntime, logger: recordingLogger(), newId: randomUUID }) });
  }, 180_000);

  afterAll(async () => {
    await runtime?.stop();
    await stopTopology();
    await removeGuestTaskStorage();
    removeTempDirs();
  });

  const fixtures = path.join(desktop, 'test', 'fixtures', 'engagement');
  const skillRoot = path.join(desktop, 'resources', 'skills', 'inquello-evidence');
  const key = JSON.parse(fs.readFileSync(path.join(fixtures, 'answer-key.json'), 'utf8')) as { files: Record<string, { format: string; keys: Array<{ at: string; text: string }> }>; unreadable: Record<string, string> };
  const digests = readerDigests(skillRoot);
  // The socket check shared with `scripts/wsl/probe-sandbox.sh` (one text, two runners).
  const probe = fs.readFileSync(path.join(desktop, 'scripts', 'wsl', 'probe-sandbox.sh'), 'utf8');
  const SOCKET_CHECK = probe.slice(probe.indexOf("SOCKET_CHECK = r'''") + "SOCKET_CHECK = r'''".length, probe.indexOf("'''", probe.indexOf("SOCKET_CHECK = r'''") + 20));
  const boot = (...args: string[]) => ['/usr/bin/python3', '-I', '-c', VERIFY_BOOT, JSON.stringify(digests), ...args];

  /** A Task whose guest folder exists, with a SourcesService bound to that Task's real broker. */
  async function preparedTask(title: string, chosen: { files: string[]; folders: string[] }) {
    const task = await newTask(title);
    const settings = ok(await policy.effectiveThreadSettings(task));
    const service = new SourcesService({
      userData: tempDir('sources-userdata'), skillRoot, principalId: () => identity.principalId(), choose: async () => chosen,
      runTool: async (taskId, argv, options) => { const result = await policy.runTool(taskId, argv, options); return result.ok ? { ok: true, value: result.value } : { ok: false, reason: result.reason }; },
      stagingTarget: () => process.platform === 'win32' ? wslStagingTarget(new WslTasks(path.dirname(settings.folders.working), identity.principalId()!)) : hostStagingTarget(() => settings.folders.working),
      policyGate: () => ({ ok: true }), logger: recordingLogger(),
    });
    return { task, service };
  }

  it('runs Python in the Task profile, in the guest Task folder, with the declared document tools', async () => {
    const task = await newTask('Sandbox probe');
    ok(await policy.effectiveThreadSettings(task));
    const probe = await run(task, ['/usr/bin/python3', '-I', '-c', 'import os,sys,pypdf,pdfminer,openpyxl,docx,xlrd,PIL;print(os.getcwd())']);
    expect(probe.exitCode).toBe(0);
    if (process.platform === 'win32') expect(probe.stdout.trim()).toMatch(/^\/var\/lib\/inquello\/tasks\/[0-9a-f]{64}\/[0-9a-f-]{36}$/);
    const tools = await run(task, ['/bin/sh', '-c', 'for p in pdftotext pdftoppm pdfinfo tesseract soffice; do command -v $p >/dev/null || echo "missing $p"; done']);
    expect([tools.exitCode, tools.stdout]).toEqual([0, '']);
  }, 180_000);

  it('stages a folder and reads every keyed location in every format, recording the pass rate per format', async () => {
    const { task, service } = await preparedTask('Engagement folder', { files: [], folders: [path.join(fixtures, 'folder')] });
    const attached = await service.attach('folder');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    expect(attached.value.files.length).toBe(17);
    expect(attached.value.notSearched).toEqual([{ relative: 'folder/system-dump.bin', reason: 'Unsupported file type' }]);
    const staged = await service.stage(task, attached.value.attachmentId);
    if (!staged.ok) throw new Error(staged.reason);
    const cover = staged.value.coverage;
    expect(cover.filesAttached).toBe(18);
    expect(cover.incomplete).toBe(true);
    expect(cover.unreadable.map(item => item.relative).sort()).toEqual(['folder/broken-budget.xlsx', 'folder/escaping-entry.pptx', 'folder/expanding-report.docx', 'folder/protected-statement.pdf']);
    expect(cover.rows).toMatchObject({ unknown: 1 });
    // Every keyed location, through the same boot path the app's citation check uses.
    const items: Array<[string, string, string]> = [];
    const expected: Array<{ name: string; format: string; text: string; unreadable?: boolean }> = [];
    const shaOf = (name: string) => attached.value!.files.find(file => file.name === name)?.sha256 ?? '';
    for (const [name, spec] of Object.entries(key.files)) for (const item of spec.keys) { items.push([`attached/folder/${name}`, item.at, shaOf(name)]); expected.push({ name, format: spec.format, text: item.text }); }
    for (const [name, reason] of Object.entries(key.unreadable)) if (name !== 'system-dump.bin') { items.push([`attached/folder/${name}`, 'L1', shaOf(name)]); expected.push({ name, format: 'unreadable', text: reason, unreadable: true }); }
    const result = await run(task, boot('verify-batch', JSON.stringify(items)), 120_000);
    expect(result.exitCode).toBe(0);
    const results = JSON.parse(result.stdout) as Array<{ ok: boolean; reason?: string; lines?: Array<{ text: string }> }>;
    const rates = new Map<string, { pass: number; total: number }>();
    const failures: string[] = [];
    results.forEach((item, index) => {
      const want = expected[index]!;
      const pass = want.unreadable ? !item.ok && item.reason === want.text : item.ok && normaliseQuote((item.lines ?? []).map(line => line.text).join(' ')).toLowerCase().includes(normaliseQuote(want.text).toLowerCase());
      const rate = rates.get(want.format) ?? { pass: 0, total: 0 };
      rate.total++; if (pass) rate.pass++; else failures.push(`${want.name} ${items[index]![1]}: ${JSON.stringify(item).slice(0, 300)}`);
      rates.set(want.format, rate);
    });
    if (process.env.SOURCES_RATES_OUT) fs.writeFileSync(process.env.SOURCES_RATES_OUT, JSON.stringify(Object.fromEntries(rates), null, 2));
    // Every keyed location passes, legacy .doc/.ppt included (converted by LibreOffice inside the sandbox).
    expect(failures).toEqual([]);
    expect([...rates.keys()].sort()).toEqual(['csv', 'doc', 'docx', 'image', 'pdf', 'ppt', 'pptx', 'text', 'unreadable', 'xls', 'xlsx']);
  }, 600_000);

  it('verifies quoted references, marks the rest unverified, retains only verified extracts and refuses changed scripts', async () => {
    const { task, service } = await preparedTask('References', { files: [path.join(fixtures, 'folder', 'ap-ledger.xlsx'), path.join(fixtures, 'folder', 'purchasing-policy.docx')], folders: [] });
    const attached = await service.attach('files');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    ok(await service.stage(task, attached.value.attachmentId));
    const answer = [
      'The ledger total is 12346 :inquello-source{id="attached/ap-ledger.xlsx" at="Ledger!C8" quote="12346"}',
      'Contoso was paid :inquello-source{id="attached/ap-ledger.xlsx" at="Ledger!B4" quote="Northwind"}',
      'Invoices are matched within three working days :inquello-source{id="attached/purchasing-policy.docx" at="P10" quote="within three working days of receipt"}',
      'A missing file :inquello-source{id="attached/nothing.xlsx" at="Sheet1!A1" quote="x"}',
      'Total of five invoices :inquello-computed{command="python3 -c \'print(5)\'" from="attached/ap-ledger.xlsx Ledger!B3:B7"}',
      'The control likely operates weekly :inquello-inference{}',
    ].join('\n');
    const first = ok(await service.references(task, answer));
    expect(first.references.map(view => [view.status, view.reason])).toEqual([
      ['verified', null], ['unverified', 'The quoted text is not at that location'], ['verified', null], ['unverified', 'The cited file is not in this Task’s attached material'],
    ]);
    expect(first.references[0]!.file).toMatchObject({ name: 'ap-ledger.xlsx', relative: 'ap-ledger.xlsx', sha256: attached.value.files[0]!.sha256 });
    expect(first.references[0]!.extract!.text).toContain('formula =SUM(C3:C7)');
    expect(first.computed).toEqual([expect.objectContaining({ command: "python3 -c 'print(5)'", from: 'attached/ap-ledger.xlsx Ledger!B3:B7' })]);
    expect(first.inferences).toHaveLength(1);
    expect(first.retained).toBe(2);
    expect(ok(service.extracts(task)).map(item => item.reference.at).sort()).toEqual(['Ledger!C8', 'P10']);
    // An agent that edits the staged reader cannot make a reference verify.
    await run(task, ['/bin/sh', '-c', 'printf "\\n# changed\\n" >> skills/inquello-evidence/scripts/readers/read_xlsx.py']);
    const after = ok(await service.references(task, answer));
    expect(after.references[0]).toMatchObject({ status: 'unverified', reason: 'The reading scripts in the Task folder were changed; references cannot be checked' });
    // Deleting the Task's sources removes every retained extract.
    expect(ok(service.deleteTask(task)).remaining).toBe(0);
    expect(ok(service.extracts(task))).toEqual([]);
  }, 300_000);

  it('reports formats as unreadable with "reading tool unavailable" when a tool is missing, and still reads the rest', async () => {
    const { task, service } = await preparedTask('Missing tool', { files: [path.join(fixtures, 'folder', 'sample-report.pdf'), path.join(fixtures, 'folder', 'ap-ledger.xlsx'), path.join(fixtures, 'folder', 'payables-export.csv')], folders: [] });
    const attached = await service.attach('files');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    ok(await service.stage(task, attached.value.attachmentId));
    const script = [
      'import sys', "sys.path.insert(0, 'skills/inquello-evidence/scripts')", "sys.modules['openpyxl'] = None", 'import readers',
      'for module in list(sys.modules.values()):', "    if getattr(module, '__name__', '').startswith('readers') and hasattr(module, 'tool'): module.tool = lambda name: None",
      "if hasattr(readers, 'module_available'): readers.module_available = lambda name: name not in ('openpyxl', 'pdfminer')",
      'import evidence', "sys.exit(evidence.main(['inventory', 'attached', '--json']))",
    ].join('\n');
    const result = await run(task, ['/usr/bin/python3', '-I', '-c', script]);
    const files = (JSON.parse(result.stdout) as { files: Array<{ path: string; status: string; reason?: string }> }).files;
    expect(files.find(file => file.path.endsWith('.pdf'))).toMatchObject({ status: 'unreadable', reason: 'reading tool unavailable' });
    expect(files.find(file => file.path.endsWith('.xlsx'))).toMatchObject({ status: 'unreadable', reason: 'reading tool unavailable' });
    expect(files.find(file => file.path.endsWith('.csv'))).toMatchObject({ status: 'readable' });
  }, 300_000);

  it('shows Word tracked changes with author when asked, and converts a legacy file in the sandbox without changing the original or leaving a copy', async () => {
    const { task, service } = await preparedTask('Changes', { files: [path.join(fixtures, 'folder', 'purchasing-policy.docx'), path.join(fixtures, 'folder', 'count-memo.doc')], folders: [] });
    const attached = await service.attach('files');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    ok(await service.stage(task, attached.value.attachmentId));
    const changes = await run(task, ['/usr/bin/python3', 'skills/inquello-evidence/scripts/evidence.py', 'read', 'attached/purchasing-policy.docx', 'P10', '--changes']);
    expect(changes.stdout).toContain('[-before payment]{deleted by A. Auditor');
    expect(changes.stdout).toContain('[+within three working days of receipt]{inserted by A. Auditor');
    const current = await run(task, ['/usr/bin/python3', 'skills/inquello-evidence/scripts/evidence.py', 'read', 'attached/purchasing-policy.docx']);
    expect(current.stdout).toContain('NOTE 2 pending tracked changes, 1 comments');
    expect(current.stdout).not.toContain('before payment');
    const legacy = await run(task, ['/bin/sh', '-c', 'sha256sum attached/count-memo.doc; python3 skills/inquello-evidence/scripts/evidence.py read attached/count-memo.doc P2; sha256sum attached/count-memo.doc; ls .inquello-work/converted | wc -l']);
    const sums = legacy.stdout.split('\n').filter(line => line.endsWith('attached/count-memo.doc'));
    expect(sums).toHaveLength(2);
    expect(sums[0]).toBe(sums[1]);
    // Converted in the Task sandbox and read with paragraph locations; the original is unchanged and no converted copy or profile is left.
    expect(legacy.stdout).toContain('observed at the Leeds warehouse on 31 December 2025');
    expect(legacy.stdout).toMatch(/converted from legacy format/);
    expect(legacy.stdout.trim().split('\n').at(-1)).toBe('0');
    const leftovers = await run(task, ['/bin/sh', '-c', 'ls -a .inquello-work | grep -c ^lo- || true']);
    expect(leftovers.stdout.trim()).toBe('0');
  }, 300_000);

  it('Task commands can create and use their own local socket, and no socket they did not create is reachable', async () => {
    const task = await newTask('Socket isolation');
    ok(await policy.effectiveThreadSettings(task));
    expect(SOCKET_CHECK).toContain('own-socket-check');
    const result = await run(task, ['/usr/bin/python3', '-I', '-c', SOCKET_CHECK], 120_000);
    const report = JSON.parse(result.stdout) as { foreign: string[]; connectable: string[]; hidden: string[]; own: boolean };
    expect(report).toEqual({ foreign: [], connectable: [], hidden: [], own: true });
    expect(result.exitCode).toBe(0);
  }, 300_000);

  it.skipIf(process.platform !== 'win32')('stages the start manifest the way a Task start does, so a Task command reads the material before any turn', async () => {
    const task = await newTask('Start staging');
    const settings = ok(await policy.effectiveThreadSettings(task));
    const guest = new WslTasks(path.dirname(settings.folders.working), identity.principalId()!);
    const operationId = randomUUID();
    const service = new SourcesService({
      userData: tempDir('sources-userdata'), skillRoot, principalId: () => identity.principalId(), choose: async () => ({ files: [path.join(fixtures, 'folder', 'count-memo.doc'), path.join(fixtures, 'folder', 'payables-export.csv')], folders: [] }),
      runTool: async (taskId, argv, options) => { const result = await policy.runTool(taskId, argv, options); return result.ok ? { ok: true, value: result.value } : { ok: false, reason: result.reason }; },
      stagingTarget: () => wslStagingTarget(guest), policyGate: () => ({ ok: true }), logger: recordingLogger(),
      startMaterial: id => path.join(tempDir('sources-material'), `${id}.json`),
    });
    const attached = await service.attach('files');
    if (!attached.ok || !attached.value) throw new Error('attach failed');
    // The runtime's part of a start (inquello_wsl.rs): read the manifest by digest and publish it with the broker's `replace`.
    const started = await service.startTask(operationId, [attached.value.attachmentId], async material => {
      const prepared = ok(service.stageBeforeFirstTurn(operationId, [attached.value!.attachmentId]));
      expect(prepared.sha256).toBe(material.sha256);
      await guest.broker(task, { action: 'replace', entries: JSON.parse(fs.readFileSync(prepared.file, 'utf8')) as Entry[] });
      return { ok: true, value: { operationId, taskId: task, runId: task, threadId: null, status: 'running', request: 'r', accepted: false } };
    });
    expect(started.ok).toBe(true);
    const listing = await run(task, ['/bin/sh', '-c', 'ls attached; test -f skills/inquello-evidence/SKILL.md && echo skill']);
    expect(listing.stdout.split('\n').filter(Boolean).sort()).toEqual(['count-memo.doc', 'payables-export.csv', 'skill']);
    // Once idle, the view examines the material in the sandbox for Coverage.
    const coverage = ok(service.coverage(task));
    expect(coverage?.unreadable.every(item => item.reason === 'Not yet examined in the sandbox')).toBe(true);
  }, 300_000);
});