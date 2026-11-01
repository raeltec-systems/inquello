/** Quiescent guest data is staged on D: for the existing native provenance gate.
 * A guest locator or migration journal never supplies export authority. */
import fs from 'node:fs';
import path from 'node:path';
import { copyWithDigest, type ManifestOmission } from '../data/export';
import { takeInventory, type GovernedRoots, type HeldFile } from '../data/inventory';
import type { DataPolicy } from '../data/policy';
import type { DataServiceOptions } from '../data/service';
import { ensurePrivateDirectory, restrictPrivateFile } from './private-paths';
import { WslTasks, validateTransfer } from './wsl-tasks';
import { assertDStorageLocation, WSL_STORAGE } from './wsl';

export function wslDataStorage(taskParent: string, principalId: () => string | null): NonNullable<DataServiceOptions['taskStorage']> {
  const scopes = () => fs.existsSync(taskParent) ? WslTasks.discoverScopes(taskParent) : [];
  const own = () => {
    const principal = principalId();
    if (!principal) throw new Error('Sign in before exporting Linux Task files');
    ensurePrivateDirectory(taskParent);
    return { principal, tasks: new WslTasks(taskParent, principal) };
  };
  function hostFiles(folder: string): Array<{ size: number }> {
    if (!fs.existsSync(folder)) return [];
    const result: Array<{ size: number }> = [];
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) throw new Error('Unsafe execution metadata');
      if (stat.isDirectory()) result.push(...hostFiles(full));
      else result.push({ size: stat.size });
    }
    return result;
  }
  async function observe() {
    const observations = [];
    for (const scope of scopes()) {
      const tasks = WslTasks.forScope(taskParent, scope);
      const snapshot = await tasks.snapshotScope();
      const files = [...Object.values(snapshot.tasks), ...Object.values(snapshot.transfers)].flat().filter(entry => entry.kind === 'file');
      const metadata = hostFiles(tasks.storage);
      observations.push({ tasks, snapshot, files: files.length + metadata.length,
        bytes: files.reduce((sum, entry) => sum + Buffer.byteLength(entry.data!, 'base64'), 0) + metadata.reduce((sum, file) => sum + file.size, 0) });
    }
    return observations;
  }
  return {
    async inspect() {
      const observations = await observe();
      return observations.reduce((sum, value) => ({ files: sum.files + value.files, bytes: sum.bytes + value.bytes }), { files: 0, bytes: 0 });
    },
    async snapshot(policy: DataPolicy, roots: GovernedRoots) {
      if (scopes().length === 0) return { roots, inventory: takeInventory(policy, roots), omissions: [], dispose: () => undefined };
      const owner = own();
      const snapshot = await owner.tasks.snapshotScope();
      if (owner.principal !== principalId()) throw new Error('Identity changed during guest snapshot');
      for (const name of fs.readdirSync(path.join(owner.tasks.storage, 'bindings'))) {
        if (!/^[a-f0-9-]{36}\.json$/.test(name)) throw new Error('Invalid Task execution binding');
        const task = name.slice(0, -5);
        const binding = owner.tasks.binding(task);
        if (!binding || binding.state !== 'ready') throw new Error('Task migration is incomplete');
        if (binding.backend === 'linux' && !Object.hasOwn(snapshot.tasks, task)) {
          throw new Error('Authoritative Linux Task files are unavailable; the retained Windows copy cannot replace them');
        }
      }
      assertDStorageLocation(WSL_STORAGE.temp);
      const staging = fs.mkdtempSync(path.join(WSL_STORAGE.temp, 'export-snapshot-'));
      ensurePrivateDirectory(staging);
      const staged: GovernedRoots = { 'user-data': path.join(staging, 'user-data'), 'runtime-home': path.join(staging, 'runtime-home'), logs: path.join(staging, 'logs') };
      const dispose = () => {
        if (path.dirname(path.resolve(staging)) !== path.resolve(WSL_STORAGE.temp) || !path.basename(staging).startsWith('export-snapshot-')) throw new Error('Unsafe snapshot cleanup');
        fs.rmSync(staging, { recursive: true, force: true, maxRetries: 3 });
      };
      try {
        for (const folder of Object.values(staged)) ensurePrivateDirectory(folder);
        const inventory = takeInventory(policy, roots);
        const copied: HeldFile[] = [];
        const linux = new Set(Object.keys(snapshot.tasks).filter(task => {
          const binding = owner.tasks.binding(task);
          if (!binding || binding.state !== 'ready') throw new Error('Task migration is incomplete');
          return binding.backend === 'linux';
        }));
        for (const file of inventory.files) {
          const category = policy.categories.find(value => value.id === file.category);
          if (!category?.enabled || category.credentials || category.export.mode !== 'included') { copied.push(file); continue; }
          if (file.category === 'task-folders' && linux.has(file.rel.split('/')[1]!)) continue;
          const target = path.join(staged[file.root], ...file.rel.split('/'));
          await copyWithDigest(file.abs, target, { within: roots[file.root] });
          restrictPrivateFile(target);
          copied.push({ ...file, abs: target });
        }
        for (const task of linux) {
          if (!/^[a-f0-9-]{36}$/.test(task)) throw new Error('Invalid guest Task');
          const entries = snapshot.tasks[task]!;
          validateTransfer(entries);
          for (const entry of entries) {
            const rel = `tasks/${task}/${entry.path}`;
            const target = path.join(staged['user-data'], ...rel.split('/'));
            if (entry.kind === 'directory') ensurePrivateDirectory(target);
            else {
              ensurePrivateDirectory(path.dirname(target));
              const data = Buffer.from(entry.data!, 'base64');
              fs.writeFileSync(target, data, { flag: 'wx', mode: 0o600 });
              restrictPrivateFile(target);
              copied.push({ root: 'user-data', rel, abs: target, size: data.length, category: 'task-folders' });
            }
          }
        }
        if (owner.principal !== principalId()) throw new Error('Identity changed during export staging');
        const recovery = Object.values(snapshot.transfers).flat().filter(entry => entry.kind === 'file').length
          + Object.entries(snapshot.tasks).filter(([task]) => !linux.has(task)).flatMap(([, entries]) => entries).filter(entry => entry.kind === 'file').length
          + hostFiles(owner.tasks.storage).length;
        const omissions: ManifestOmission[] = recovery ? [{ category: 'task-folders', label: 'Task migration recovery copies', reason: 'Execution bindings and recovery copies stay on this device and are not evidence of current Task content.', files: recovery }] : [];
        return { roots: staged, inventory: { ...inventory, files: copied }, omissions, dispose };
      } catch (error) { dispose(); throw error; }
    },
    async ensureEmpty() {
      for (const observation of await observe()) {
        if (Object.keys(observation.snapshot.tasks).length || Object.keys(observation.snapshot.transfers).length || observation.files > 1) {
          throw new Error('Delete existing Linux Task folders before recovery; their source files remain intact');
        }
      }
    },
    async erase() {
      const observations = await observe();
      let files = 0, bytes = 0;
      for (const observation of observations) {
        await observation.tasks.eraseScope();
        const target = path.resolve(observation.tasks.storage);
        if (path.dirname(target) !== path.resolve('D:\\Inquello\\profiles') || !/^[a-f0-9]{64}$/.test(path.basename(target))) throw new Error('Unsafe execution metadata cleanup');
        fs.rmSync(target, { recursive: true, force: true, maxRetries: 3 });
        files += observation.files; bytes += observation.bytes;
      }
      return { files, bytes };
    },
  };
}
