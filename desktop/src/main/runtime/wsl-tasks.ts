/** Task ownership, recoverable transfers and OS transitions. This module is
 * main-process-only; renderer requests never choose broker paths or scopes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { ensurePrivateDirectory, isPrivatePath } from './private-paths';
import { preflightWsl, wslHostEnvironment, wslScope, WSL_STORAGE } from './wsl';

const MAX_BYTES = 256 * 1024 ** 2;
const MAX_ENTRIES = 10_000;
export interface Entry { path: string; kind: 'directory' | 'file'; data?: string; sha256?: string }
export interface WslScopeSnapshot { tasks: Record<string, Entry[]>; transfers: Record<string, Entry[]> }
interface BrokerResult { entries?: Entry[]; transaction?: string; tasks?: Record<string, Entry[]>; transfers?: Record<string, Entry[]>; erased?: boolean }
export interface WslBinding { version: 1; scope: string; taskId: string; backend: 'linux' | 'windows'; state: 'ready' | 'transferring'; transaction: string }
const queues = new Map<string, Promise<unknown>>();

export async function withTaskTransferLock<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}

export function validateTransferName(name: string): void {
  if (!name || Buffer.byteLength(name) > 1024 || name.normalize('NFC') !== name) throw new Error('Unsupported transfer name');
  for (const part of name.split('/')) {
    if (!part || part === '.' || part === '..' || /[. ]$/.test(part) || /[\\<>:"|?*\x00-\x1f\x7f]/.test(part)
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) || Buffer.byteLength(part) > 240) throw new Error('Unsupported transfer name');
  }
}

export function validateTransfer(entries: Entry[]): void {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) throw new Error('Transfer entry quota exceeded');
  const seen = new Map<string, string>();
  let total = 0;
  for (const entry of entries) {
    validateTransferName(entry.path);
    const key = entry.path.toLowerCase();
    if (seen.has(key)) throw new Error('Duplicate or case-colliding transfer name');
    seen.set(key, entry.kind);
    if (entry.kind === 'file') {
      // Canonical base64 check without a regular expression: a pattern over a
      // multi-megabyte string overflows V8's regex stack and refused large files.
      if (typeof entry.data !== 'string' || entry.data.length % 4 !== 0) throw new Error('Invalid transfer encoding');
      const data = Buffer.from(entry.data, 'base64');
      if (data.toString('base64') !== entry.data) throw new Error('Invalid transfer encoding');
      total += data.length;
      if (total > MAX_BYTES || crypto.createHash('sha256').update(data).digest('hex') !== entry.sha256) throw new Error('Transfer digest or quota failure');
    } else if (entry.kind !== 'directory') throw new Error('Unsupported transfer entry');
  }
  for (const entry of entries) {
    let parent = path.posix.dirname(entry.path);
    while (parent !== '.') {
      if (seen.get(parent.toLowerCase()) !== 'directory') throw new Error('Missing or colliding transfer parent');
      parent = path.posix.dirname(parent);
    }
  }
}

export function snapshotTask(root: string): Entry[] {
  const entries: Entry[] = [];
  let total = 0;
  const walk = (folder: string, prefix: string) => {
    const before = fs.lstatSync(folder);
    if (!before.isDirectory() || before.isSymbolicLink() || fs.realpathSync.native(folder).toLowerCase() !== path.resolve(folder).toLowerCase()) throw new Error('Links cannot be transferred');
    for (const name of fs.readdirSync(folder).sort()) {
      const relative = `${prefix}${name}`;
      validateTransferName(relative);
      const target = path.join(folder, name);
      const info = fs.lstatSync(target);
      if (info.isSymbolicLink()) throw new Error('Links cannot be transferred');
      if (info.isDirectory()) { entries.push({ path: relative, kind: 'directory' }); walk(target, `${relative}/`); }
      else if (info.isFile() && info.nlink === 1) {
        total += info.size;
        if (total > MAX_BYTES) throw new Error('Transfer byte quota exceeded');
        const fd = fs.openSync(target, 'r');
        try {
          const opened = fs.fstatSync(fd);
          if (opened.ino !== info.ino || opened.dev !== info.dev || !opened.isFile() || opened.nlink !== 1) throw new Error('Transfer source changed');
          const data = fs.readFileSync(fd);
          const after = fs.fstatSync(fd);
          if (after.mtimeMs !== info.mtimeMs || data.length !== info.size) throw new Error('Transfer source changed');
          entries.push({ path: relative, kind: 'file', data: data.toString('base64'), sha256: crypto.createHash('sha256').update(data).digest('hex') });
        } finally { fs.closeSync(fd); }
      } else throw new Error('Special files cannot be transferred');
      if (entries.length > MAX_ENTRIES) throw new Error('Transfer entry quota exceeded');
    }
    if (fs.statSync(folder).mtimeMs !== before.mtimeMs) throw new Error('Transfer source changed');
  };
  walk(root, '');
  validateTransfer(entries);
  return entries;
}

function atomicJson(target: string, value: unknown): void {
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, target);
}

const MAX_PROFILE_LOCATOR_BYTES = 8 * 1024;
interface ProfileLocator { version: 1; scope: string; taskParentKey: string }
/** Read-only locator inspection. The root is checked before entering this helper. */
function readProfileLocator(folder: string, scope: string, discoveryKey?: string): ProfileLocator {
  const directory = fs.lstatSync(folder);
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Unsafe execution profile directory');
  const locator = path.join(folder, 'profile.json');
  const before = fs.lstatSync(locator);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > MAX_PROFILE_LOCATOR_BYTES) throw new Error('Unsafe profile locator');
  const fd = fs.openSync(locator, 'r');
  try {
    const opened = fs.fstatSync(fd);
    if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== before.ino || opened.dev !== before.dev
      || opened.size !== before.size || opened.size > MAX_PROFILE_LOCATOR_BYTES) throw new Error('Profile locator changed');
    // The locator may grow after fstat. Never let a peer-controlled size choose
    // our allocation or make readFileSync consume an unbounded stream.
    const buffer = Buffer.alloc(MAX_PROFILE_LOCATOR_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const count = fs.readSync(fd, buffer, bytes, buffer.length - bytes, bytes);
      if (count === 0) break;
      bytes += count;
    }
    if (bytes > MAX_PROFILE_LOCATOR_BYTES || bytes !== opened.size) throw new Error('Profile locator size changed');
    const metadata: unknown = JSON.parse(buffer.subarray(0, bytes).toString('utf8'));
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new Error('Invalid profile locator');
    const value = metadata as Partial<ProfileLocator>;
    if (value.version !== 1 || value.scope !== scope || typeof value.taskParentKey !== 'string' || !/^[0-9a-f]{64}$/.test(value.taskParentKey)) throw new Error('Invalid profile locator');
    let after: fs.Stats, current: fs.Stats, currentDirectory: fs.Stats;
    try { after = fs.fstatSync(fd); current = fs.lstatSync(locator); currentDirectory = fs.lstatSync(folder); }
    catch (error) {
      if (discoveryKey !== undefined && value.taskParentKey !== discoveryKey
        && (error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      throw new Error('Profile locator changed during read');
    }
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.nlink !== 1
      || !current.isFile() || current.isSymbolicLink() || current.nlink !== 1 || current.ino !== opened.ino || current.dev !== opened.dev
      || !currentDirectory.isDirectory() || currentDirectory.isSymbolicLink() || currentDirectory.ino !== directory.ino || currentDirectory.dev !== directory.dev) throw new Error('Profile locator changed');
    return value as ProfileLocator;
  } finally { fs.closeSync(fd); }
}

export class WslTasks {
  readonly scope: string;
  readonly storage: string;
  constructor(readonly taskParent: string, principal: string) {
    // The scope is keyed by the Task-folders root's real path. On a new profile no Task folder exists
    // yet (a first Send with attached material comes before any), so create the root privately, as
    // `ensureTaskFolder` would, instead of failing to resolve it.
    ensurePrivateDirectory(taskParent);
    this.scope = wslScope(taskParent, principal);
    this.storage = path.win32.join('D:\\Inquello\\profiles', this.scope);
    for (const dir of ['D:\\Inquello\\profiles', this.storage, path.join(this.storage, 'bindings'), path.join(this.storage, 'transactions')]) ensurePrivateDirectory(dir);
    const locator = path.join(this.storage, 'profile.json');
    const metadata = { version: 1, scope: this.scope, taskParentKey: wslScope(taskParent, '') };
    if (fs.existsSync(locator)) {
      const existing = JSON.parse(fs.readFileSync(locator, 'utf8'));
      if (existing.version !== 1 || existing.scope !== this.scope || existing.taskParentKey !== metadata.taskParentKey) throw new Error('Invalid desktop profile locator');
    } else atomicJson(locator, metadata);
  }
  /** Discovery metadata is only a locator for explicit local deletion. It never
   * establishes export/import account authority; the native inspector does. */
  static discoverScopes(taskParent: string): string[] {
    const parent = 'D:\\Inquello\\profiles';
    if (!fs.existsSync(parent)) return [];
    if (!isPrivatePath(parent, 'directory')) throw new Error('Unsafe execution profile root');
    const key = wslScope(taskParent, '');
    const result: string[] = [];
    for (const scope of fs.readdirSync(parent)) {
      if (!/^[0-9a-f]{64}$/.test(scope)) continue;
      const folder = path.join(parent, scope);
      let metadata: ProfileLocator;
      try { metadata = readProfileLocator(folder, scope, key); }
      catch (error) {
        // Another desktop may delete its own profile during enumeration. Only
        // absence before ownership is known is benign; corruption stays fatal.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
        throw error;
      }
      if (metadata.taskParentKey !== key) continue;
      if (!isPrivatePath(folder, 'directory')) throw new Error('Unsafe owned execution profile');
      result.push(scope);
    }
    return result.sort();
  }
  static forScope(taskParent: string, scope: string): Pick<WslTasks, 'scope' | 'storage' | 'snapshotScope' | 'eraseScope'> {
    const parent = 'D:\\Inquello\\profiles';
    if (!/^[0-9a-f]{64}$/.test(scope) || !isPrivatePath(parent, 'directory')) throw new Error('Unsafe execution profile scope');
    const folder = path.join(parent, scope);
    // Validate this exact selected scope, never re-enumerate or repair peers.
    const metadata = readProfileLocator(folder, scope);
    if (metadata.taskParentKey !== wslScope(taskParent, '')) throw new Error('Scope does not belong to this desktop profile');
    if (!isPrivatePath(folder, 'directory')) throw new Error('Unsafe owned execution profile');
    const instance: WslTasks = Object.create(WslTasks.prototype);
    Object.defineProperties(instance, { taskParent: { value: taskParent }, scope: { value: scope },
      storage: { value: path.win32.join('D:\\Inquello\\profiles', scope) } });
    return instance;
  }
  async snapshotScope(): Promise<WslScopeSnapshot> {
    // Inventory must observe a whole transition, never the gap between its
    // prepare/replace/complete broker calls. The guest lock also fences native
    // model executors and other desktop processes.
    return withTaskTransferLock(`scope:${this.scope}`, async () => {
      const result = await this.callBroker('scope', '00000000-0000-0000-0000-000000000000', { action: 'snapshot' });
      if (!result.tasks || !result.transfers) throw new Error('Incomplete scope snapshot');
      for (const collection of [result.tasks, result.transfers]) {
        if (typeof collection !== 'object' || Array.isArray(collection)) throw new Error('Invalid scope snapshot');
        for (const [id, entries] of Object.entries(collection)) { this.bindingPath(id); validateTransfer(entries); }
      }
      return { tasks: result.tasks, transfers: result.transfers };
    });
  }
  async eraseScope(): Promise<void> {
    return withTaskTransferLock(`scope:${this.scope}`, async () => {
      const result = await this.callBroker('scope', '00000000-0000-0000-0000-000000000000', { action: 'erase' });
      if (result.erased !== true) throw new Error('Guest scope deletion was not confirmed');
    });
  }
  private bindingPath(taskId: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(taskId)) throw new Error('Invalid Task id');
    return path.join(this.storage, 'bindings', `${taskId}.json`);
  }
  binding(taskId: string): WslBinding | null {
    const file = this.bindingPath(taskId);
    if (!fs.existsSync(file)) return null;
    const binding = JSON.parse(fs.readFileSync(file, 'utf8')) as WslBinding;
    if (binding.version !== 1 || binding.scope !== this.scope || binding.taskId !== taskId
      || !['linux', 'windows'].includes(binding.backend) || !['ready', 'transferring'].includes(binding.state)) throw new Error('Invalid Task execution binding');
    return binding;
  }
  /** A live transfer is not an interrupted transfer. Inspect only after the
   * main process's already queued transaction has settled; failures remain
   * visible as transferring and require the existing explicit recovery. */
  async settledBinding(taskId: string): Promise<WslBinding | null> {
    return withTaskTransferLock(`scope:${this.scope}`, async () => this.binding(taskId));
  }
  guestRoot(taskId: string): string { this.bindingPath(taskId); return `/var/lib/inquello/tasks/${this.scope}/${taskId}`; }
  async broker(taskId: string, request: unknown): Promise<BrokerResult> { return this.callBroker('transfer', taskId, request); }
  private async callBroker(operation: 'scope' | 'transfer', taskId: string, request: unknown): Promise<BrokerResult> {
    this.bindingPath(taskId);
    const proof = preflightWsl();
    const system = process.env.SystemRoot!;
    const input = JSON.stringify(request);
    if (Buffer.byteLength(input) > MAX_BYTES * 2) throw new Error('Transfer quota exceeded');
    return await new Promise((resolve, reject) => {
      const child = spawn(path.win32.join(system, 'System32', 'wsl.exe'),
        ['--distribution', 'Inquello-Engine', '--user', 'inquello', '--cd', '/', '--exec', '/usr/bin/env', '-i',
          'PATH=/usr/bin:/bin', 'LANG=C.UTF-8', '/usr/bin/python3', '-I', '/usr/local/libexec/inquello-broker.py',
          operation, this.scope, taskId, proof.bootId],
        { env: wslHostEnvironment(system), cwd: WSL_STORAGE.temp, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
      const output: Buffer[] = []; const errors: Buffer[] = []; let bytes = 0;
      const timer = setTimeout(() => { child.kill(); reject(new Error('Task transfer timed out; source retained')); }, 120_000);
      child.stdout.on('data', (data: Buffer) => { bytes += data.length; if (bytes > MAX_BYTES * 2) { child.kill(); reject(new Error('Transfer quota exceeded')); } else output.push(data); });
      child.stderr.on('data', (data: Buffer) => { if (errors.length < 32) errors.push(data.subarray(0, 4096)); });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.stdin.on('error', () => undefined);
      child.once('exit', (code) => { clearTimeout(timer); if (code !== 0) reject(new Error(`Linux Task transfer unavailable: ${Buffer.concat(errors).toString('utf8')}`)); else {
        try { resolve(JSON.parse(Buffer.concat(output).toString('utf8')) as BrokerResult); } catch (error) { reject(error); }
      } });
      child.stdin.end(input);
    });
  }
  /** Called only after effective policy chose Linux, or explicit OS-change
   * confirmation chose Windows. A failed transaction leaves its binding blocked. */
  async transition(taskId: string, backend: 'linux' | 'windows'): Promise<void> {
    await withTaskTransferLock(`scope:${this.scope}`, () => withTaskTransferLock(`${this.scope}/${taskId}`, async () => {
      const old = this.binding(taskId);
      if (old?.state === 'ready' && old.backend === backend) return;
      if (old?.state === 'transferring') throw new Error('Task transfer needs recovery; source and journal were retained');
      if (!old && backend === 'windows') return;
      const transaction = crypto.randomUUID();
      const transactionDir = path.join(this.storage, 'transactions', transaction);
      ensurePrivateDirectory(transactionDir);
      const root = path.join(this.taskParent, taskId);
      const journal = { version: 1, taskId, sourceBackend: old?.backend ?? 'windows', targetBackend: backend, previousBinding: old, phase: 'awaiting-source' };
      atomicJson(path.join(transactionDir, 'journal.json'), journal);
      const binding: WslBinding = { version: 1, scope: this.scope, taskId, backend, state: 'transferring', transaction };
      atomicJson(this.bindingPath(taskId), binding);
      await this.broker(taskId, { action: 'prepare', transition: transaction });
      const entries = old?.backend === 'linux'
        ? (await this.broker(taskId, { action: 'snapshot' })).entries
        : snapshotTask(root);
      if (!entries) throw new Error('Task snapshot missing');
      validateTransfer(entries);
      atomicJson(path.join(transactionDir, 'source.json'), entries);
      journal.phase = 'source-captured';
      atomicJson(path.join(transactionDir, 'journal.json'), journal);
      await this.publishTransition(taskId, binding, entries, transactionDir, root);
    }));
  }
  /** Explicit retry of the exact retained source; never chooses a newer/stale
   * copy implicitly. A missing verified source remains blocked for inspection. */
  async recover(taskId: string): Promise<void> {
    await withTaskTransferLock(`scope:${this.scope}`, () => withTaskTransferLock(`${this.scope}/${taskId}`, async () => {
      const binding = this.binding(taskId);
      if (!binding || binding.state !== 'transferring' || !/^[0-9a-f-]{36}$/.test(binding.transaction)) throw new Error('No recoverable Task transition');
      const transactionDir = path.join(this.storage, 'transactions', binding.transaction);
      ensurePrivateDirectory(transactionDir);
      const journal = JSON.parse(fs.readFileSync(path.join(transactionDir, 'journal.json'), 'utf8'));
      if (journal.version !== 1 || journal.taskId !== taskId || journal.targetBackend !== binding.backend) throw new Error('Invalid transition recovery journal');
      await this.broker(taskId, { action: 'prepare', transition: binding.transaction });
      const source = path.join(transactionDir, 'source.json');
      let entries: Entry[];
      if (fs.existsSync(source)) entries = JSON.parse(fs.readFileSync(source, 'utf8')) as Entry[];
      else {
        if (journal.phase !== 'awaiting-source' || !['linux', 'windows'].includes(journal.sourceBackend)) throw new Error('Verified recovery source missing');
        const snapshot = journal.sourceBackend === 'linux' ? (await this.broker(taskId, { action: 'snapshot' })).entries : snapshotTask(path.join(this.taskParent, taskId));
        if (!snapshot) throw new Error('Recovery source missing');
        entries = snapshot;
        validateTransfer(entries);
        atomicJson(source, entries);
        journal.phase = 'source-captured';
        atomicJson(path.join(transactionDir, 'journal.json'), journal);
      }
      validateTransfer(entries);
      await this.publishTransition(taskId, binding, entries, transactionDir, path.join(this.taskParent, taskId));
    }));
  }
  private async publishTransition(taskId: string, binding: WslBinding, entries: Entry[], transactionDir: string, root: string): Promise<void> {
      if (binding.backend === 'linux') await this.broker(taskId, { action: 'replace', entries, transition: binding.transaction });
      else {
        const staging = path.join(transactionDir, `staging-${crypto.randomUUID()}`);
        ensurePrivateDirectory(staging);
        for (const entry of [...entries].sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))) {
          const destination = path.join(staging, ...entry.path.split('/'));
          if (entry.kind === 'directory') ensurePrivateDirectory(destination);
          else fs.writeFileSync(destination, Buffer.from(entry.data!, 'base64'), { flag: 'wx', mode: 0o600 });
        }
        ensurePrivateDirectory(path.join(staging, 'output'));
        // Cross-volume publication is deliberately blocked. It cannot be an
        // atomic verified backend switch; the existing Windows source remains.
        if (path.parse(root).root.toLowerCase() !== path.parse(staging).root.toLowerCase()) throw new Error('Windows Task storage must be on D: for an atomic OS transition');
        if (fs.existsSync(root)) fs.renameSync(root, path.join(transactionDir, `previous-windows-${crypto.randomUUID()}`));
        fs.renameSync(staging, root);
      }
      binding.state = 'ready';
      atomicJson(this.bindingPath(taskId), binding);
      try { await this.broker(taskId, { action: 'complete', transition: binding.transaction }); }
      catch (error) {
        binding.state = 'transferring';
        atomicJson(this.bindingPath(taskId), binding);
        throw error;
      }
  }
}
