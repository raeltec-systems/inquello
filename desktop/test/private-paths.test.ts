import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ensurePrivateDirectory, ensurePrivateDirectoryAsync, ensurePrivateDirectoriesAsync, isPrivatePath, restrictPrivateFile } from '../src/main/runtime/private-paths';
import { expectPrivatePath } from './private-paths';
import { removeTempDirs, tempDir } from './helpers';

afterAll(removeTempDirs);

describe('private filesystem paths on the current operating system', () => {
  it('refuses redirected ancestors and hard-linked files without changing their targets', () => {
    const base = tempDir('private-redirect');
    const outside = path.join(base, 'outside');
    fs.mkdirSync(outside);
    const link = path.join(base, 'redirect');
    fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => ensurePrivateDirectory(path.join(link, 'child'))).toThrow('redirected');
    expect(fs.existsSync(path.join(outside, 'child'))).toBe(false);
    const original = path.join(outside, 'original');
    fs.writeFileSync(original, 'preserve');
    const alias = path.join(base, 'alias');
    fs.linkSync(original, alias);
    expect(() => restrictPrivateFile(alias)).toThrow('unlinked regular file');
    expect(fs.readFileSync(original, 'utf8')).toBe('preserve');
  });
  it('restricts directories and files with spaces and apostrophes, without changing a sibling', () => {
    const base = tempDir('private-paths');
    const folder = path.join(base, "private user's folder");
    const sibling = path.join(base, 'sibling');
    fs.mkdirSync(sibling);
    const siblingMode = fs.statSync(sibling).mode;
    const readSiblingAcl = () => execFileSync(path.join(process.env.SystemRoot!, 'System32', 'icacls.exe'), [sibling], { encoding: 'utf8', windowsHide: true });
    const siblingAcl = process.platform === 'win32' ? readSiblingAcl() : null;
    ensurePrivateDirectory(folder);
    expectPrivatePath(folder, 0o700);
    const file = path.join(folder, "user's secret.txt");
    fs.writeFileSync(file, 'synthetic private content');
    restrictPrivateFile(file);
    expectPrivatePath(file, 0o600);
    expect(isPrivatePath(file, 'file')).toBe(true);
    expect(isPrivatePath(folder, 'directory')).toBe(true);
    expect(isPrivatePath(file, 'directory')).toBe(false);
    expect(isPrivatePath(path.join(folder, 'missing'), 'file')).toBe(false);
    expect(fs.statSync(sibling).mode).toBe(siblingMode);
    if (siblingAcl !== null) expect(readSiblingAcl()).toBe(siblingAcl);
    expect(fs.readFileSync(file, 'utf8')).toBe('synthetic private content');
  }, 30_000);

  it('detects and removes a broad read grant from the named file', () => {
    const folder = path.join(tempDir('private-grant'), 'private');
    ensurePrivateDirectory(folder);
    const file = path.join(folder, 'synthetic.txt');
    fs.writeFileSync(file, 'synthetic');
    restrictPrivateFile(file);
    if (process.platform === 'win32') {
      execFileSync(path.join(process.env.SystemRoot!, 'System32', 'icacls.exe'), [file, '/grant', '*S-1-1-0:(R)'], { windowsHide: true });
    } else fs.chmodSync(file, 0o644);
    expect(isPrivatePath(file, 'file')).toBe(false);
    restrictPrivateFile(file);
    expectPrivatePath(file, 0o600);
    expect(isPrivatePath(file, 'file')).toBe(true);
  }, 30_000);
});


describe('asynchronous private directory preparation', () => {
  it.runIf(process.platform === 'win32')('keeps the event loop responsive while Windows applies its protected DACL', async () => {
    const folder = path.join(tempDir('private-async-responsive'), 'private');
    let ticked = false;
    const tick = setTimeout(() => { ticked = true; }, 0);
    try {
      await ensurePrivateDirectoryAsync(folder);
      expect(ticked).toBe(true);
      expectPrivatePath(folder, 0o700);
    } finally { clearTimeout(tick); }
  }, 30_000);

  it('preserves the same private ACL and leaves siblings unchanged', async () => {
    const base = tempDir('private-async-paths');
    const folder = path.join(base, "private user's folder");
    const sibling = path.join(base, 'sibling');
    fs.mkdirSync(sibling);
    const mode = fs.statSync(sibling).mode;
    const readAcl = () => execFileSync(path.join(process.env.SystemRoot!, 'System32', 'icacls.exe'), [sibling], { encoding: 'utf8', windowsHide: true });
    const acl = process.platform === 'win32' ? readAcl() : null;
    await ensurePrivateDirectoryAsync(folder);
    expectPrivatePath(folder, 0o700);
    expect(isPrivatePath(folder, 'directory')).toBe(true);
    expect(fs.statSync(sibling).mode).toBe(mode);
    if (acl !== null) expect(readAcl()).toBe(acl);
  }, 30_000);

  it('rejects a redirected ancestor without creating children at its target', async () => {
    const base = tempDir('private-async-redirect');
    const outside = path.join(base, 'outside');
    fs.mkdirSync(outside);
    const link = path.join(base, 'redirect');
    fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(ensurePrivateDirectoryAsync(path.join(link, 'child'))).rejects.toThrow('redirected');
    expect(fs.existsSync(path.join(outside, 'child'))).toBe(false);
  });
  it('protects every parent and child in a batched preparation', async () => {
    const root = path.join(tempDir('private-async-batch'), "user's tasks");
    const working = path.join(root, 'task');
    const output = path.join(working, 'output');
    await ensurePrivateDirectoriesAsync([root, working, output]);
    for (const folder of [root, working, output]) expectPrivatePath(folder, 0o700);
  }, 30_000);

});
