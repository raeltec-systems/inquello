/** Real dedicated guest boundary and OS transitions. No model/provider calls. */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { ensureTaskFolder } from '../src/main/policy/tools';
import { WslTasks } from '../src/main/runtime/wsl-tasks';
import { preflightWsl, wslHostEnvironment, WSL_STORAGE } from '../src/main/runtime/wsl';
import { wslDataStorage } from '../src/main/runtime/wsl-data';
import { tempDir, removeTempDirs } from './helpers';

const run = promisify(execFile);
const principal = '3b1edf18-205a-4e60-bf92-a01e2c4645b3';
const cleanup: Array<ReturnType<typeof wslDataStorage>> = [];
afterAll(async () => { for (const storage of cleanup) await storage.erase(); removeTempDirs(); });
const file = (value: string) => ({ path: 'result.txt', kind: 'file' as const, data: Buffer.from(value).toString('base64'), sha256: createHash('sha256').update(value).digest('hex') });

describe.skipIf(process.platform !== 'win32')('real WSL execution boundary', () => {
  it('enforces filesystem/network/descendant/transfer isolation through the real stdio executor', async () => {
    preflightWsl();
    const result = await run('python', [path.resolve('scripts/wsl/probe-runtime-matrix.py')], {
      cwd: process.cwd(), windowsHide: true, timeout: 180_000, maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, TEMP: WSL_STORAGE.temp, TMP: WSL_STORAGE.temp, TMPDIR: WSL_STORAGE.temp },
    });
    fs.writeFileSync(path.win32.join(WSL_STORAGE.logs, 'desktop-runtime-matrix.log'), result.stdout);
    const checks = result.stdout.trim().split(/\r?\n/).map(line => JSON.parse(line));
    expect(checks).toHaveLength(13);
    expect(checks.every(check => check.passed === true)).toBe(true);
  }, 190_000);

  it('round-trips current Linux/Windows files and resumes an interrupted publication without allowing execution', async () => {
    const profile = tempDir('wsl-os-transition'), parent = path.join(profile, 'tasks'), task = randomUUID();
    const folders = ensureTaskFolder(parent, task);
    fs.writeFileSync(path.join(folders.working, 'result.txt'), 'first Windows version');
    const guest = new WslTasks(parent, principal);
    cleanup.push(wslDataStorage(parent, () => principal));
    const [, inventory, settled] = await Promise.all([guest.transition(task, 'linux'), guest.snapshotScope(), guest.settledBinding(task)]);
    const initial = inventory.tasks[task]!.find(entry => entry.path === 'result.txt')!;
    expect(Buffer.from(initial.data!, 'base64').toString()).toBe('first Windows version');
    expect(guest.binding(task)?.state).toBe('ready');
    expect(settled?.state).toBe('ready');
    await guest.broker(task, { action: 'replace', entries: [file('authoritative Linux version')] });
    await guest.transition(task, 'windows');
    expect(fs.readFileSync(path.join(folders.working, 'result.txt'), 'utf8')).toBe('authoritative Linux version');
    expect(guest.binding(task)?.backend).toBe('windows');
    fs.writeFileSync(path.join(folders.working, 'result.txt'), 'second Windows version');
    const original = guest.broker.bind(guest);
    const interrupted = vi.spyOn(guest, 'broker').mockImplementation(async (id, request) => {
      if ((request as { action: string }).action === 'replace') throw new Error('simulated interruption before publication');
      return original(id, request);
    });
    await expect(guest.transition(task, 'linux')).rejects.toThrow('simulated interruption');
    interrupted.mockRestore();
    expect(guest.binding(task)?.state).toBe('transferring');
    await expect(guest.transition(task, 'linux')).rejects.toThrow('needs recovery');
    const proof = preflightWsl(), system = process.env.SystemRoot!;
    await expect(run(path.win32.join(system, 'System32/wsl.exe'), ['-d', 'Inquello-Engine', '--user', 'inquello', '--cd', '/', '--exec',
      '/usr/bin/env', '-i', 'PATH=/usr/bin:/bin', 'LANG=C.UTF-8', '/usr/local/libexec/inquello-executor', guest.scope, task, proof.bootId, 'write'],
    { cwd: WSL_STORAGE.temp, env: wslHostEnvironment(system), timeout: 30_000, windowsHide: true })).rejects.toMatchObject({ code: 70 });
    expect(fs.readFileSync(path.join(folders.working, 'result.txt'), 'utf8')).toBe('second Windows version');
    await guest.recover(task);
    expect(guest.binding(task)).toMatchObject({ backend: 'linux', state: 'ready' });
    const current = (await guest.broker(task, { action: 'snapshot' })).entries!.find(entry => entry.path === 'result.txt')!;
    expect(Buffer.from(current.data!, 'base64').toString()).toBe('second Windows version');
    expect(fs.readdirSync(path.join(guest.storage, 'transactions')).length).toBeGreaterThanOrEqual(3);
  }, 120_000);
});
