import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { configureDesktopStorage, desktopStoragePaths } from '../src/main/runtime/desktop-storage';
import { expectPrivatePath } from './private-paths';
import { removeTempDirs, tempDir } from './helpers';

afterAll(removeTempDirs);

describe('desktop cache and temporary storage', () => {
  it('uses stable, distinct D-drive locations for each Windows profile', () => {
    const first = desktopStoragePaths('C:\\Users\\Alice\\Inquello');
    expect(desktopStoragePaths('c:\\users\\alice\\inquello')).toEqual(first);
    expect(desktopStoragePaths('C:\\Users\\Bob\\Inquello').cache).not.toBe(first.cache);
    for (const target of Object.values(first)) expect(target).toMatch(/^D:\\Inquello\\/);
    expect(() => desktopStoragePaths('relative')).toThrow('absolute');
  });

  it.skipIf(process.platform !== 'win32')('configures Electron and child temp paths with real private directories on D', () => {
    const profile = tempDir('desktop-storage-profile');
    const expected = desktopStoragePaths(profile);
    const previous = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
    const calls: Record<string, string> = {};
    try {
      expect(configureDesktopStorage({
        setPath: (name, value) => { calls[name] = value; },
        setAppLogsPath: value => { calls.logs = value; },
      }, profile)).toEqual(expected);
      expect(calls).toEqual({ sessionData: expected.session, temp: expected.temp, crashDumps: expected.crashDumps, logs: expected.logs });
      for (const key of ['TEMP', 'TMP', 'TMPDIR']) expect(process.env[key]).toBe(expected.temp);
      for (const target of Object.values(expected)) expectPrivatePath(target, 0o700);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      // These two fresh per-profile directories are the only paths this test owns.
      for (const [base, target] of [['D:\\Inquello\\cache\\desktop', expected.cache], ['D:\\Inquello\\logs\\desktop', expected.logs]]) {
        const relative = path.win32.relative(base, target);
        if (!/^[a-f0-9]{64}$/.test(relative)) throw new Error('Refusing unexpected test cleanup path');
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  }, 30_000);
});
