import fs from 'node:fs';
import path from 'node:path';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WslTasks} from '../src/main/runtime/wsl-tasks';
import {ensurePrivateDirectory, isPrivatePath} from '../src/main/runtime/private-paths';

vi.mock('../src/main/runtime/private-paths', () => ({ensurePrivateDirectory: vi.fn(), isPrivatePath: vi.fn(() => true)}));
vi.mock('../src/main/runtime/wsl', () => ({wslScope: () => 'a'.repeat(64), WSL_STORAGE: {}, preflightWsl: vi.fn(), wslHostEnvironment: vi.fn()}));
vi.mock('node:fs', () => ({default: {existsSync: vi.fn(), readdirSync: vi.fn(), lstatSync: vi.fn(), openSync: vi.fn(), fstatSync: vi.fn(), readFileSync: vi.fn(), readSync: vi.fn(), closeSync: vi.fn(), mkdirSync: vi.fn(), chmodSync: vi.fn()}}));

const root = 'D:\\Inquello\\profiles', own = '1'.repeat(64), foreign = '2'.repeat(64);
const folder = (scope: string) => path.join(root, scope);
const locator = (scope: string) => path.join(folder(scope), 'profile.json');
const missing = () => Object.assign(new Error('missing fixture entry'), {code:'ENOENT'});
let contents: (fd: number) => string;
const locatorJson = (fd: number) => JSON.stringify({version:1,scope:fd === 11 ? own : foreign,taskParentKey:(fd === 11 ? 'a' : 'b').repeat(64)});
function stat(directory = false) {
  return {ino: directory ? 1 : 2, dev: 1, nlink: 1, size: Buffer.byteLength(locatorJson(11)), mtimeMs: 1,
    isDirectory: () => directory, isFile: () => !directory, isSymbolicLink: () => false};
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isPrivatePath).mockReturnValue(true);
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([own, foreign] as never);
  vi.mocked(fs.lstatSync).mockImplementation(((p: string) => stat(!p.endsWith('profile.json'))) as never);
  vi.mocked(fs.openSync).mockImplementation(((p: string) => p === locator(own) ? 11 : 22) as never);
  vi.mocked(fs.fstatSync).mockImplementation((() => stat()) as never);
  contents = locatorJson;
  vi.mocked(fs.readSync).mockImplementation(((fd: number, buffer: Buffer, offset: number, length: number, position: number) => {
    const source = Buffer.from(contents(fd));
    return source.copy(buffer, offset, position, Math.min(source.length, position + length));
  }) as never);
});
describe('read-only execution profile discovery', () => {
  it('rejects an oversized locator before reading or opening it', () => {
    vi.mocked(fs.lstatSync).mockImplementation(((p: string) => p.endsWith('profile.json') ? {...stat(),size:8193} : stat(true)) as never);
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('Unsafe profile locator');
    expect(fs.openSync).not.toHaveBeenCalled();
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.readSync).not.toHaveBeenCalled();
  });
  it('rejects a locator whose size changes on opening before reading it', () => {
    vi.mocked(fs.fstatSync).mockReturnValue({...stat(),size:8193} as never);
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('Profile locator changed');
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.readSync).not.toHaveBeenCalled();
    expect(fs.closeSync).toHaveBeenCalledWith(11);
  });
  it('bounds allocation and rejects growth after fstat', () => {
    contents = () => 'x'.repeat(8193);
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('size changed');
    expect(fs.readFileSync).not.toHaveBeenCalled();
    expect(fs.readSync).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fs.readSync).mock.calls[0]![1]).toHaveLength(8193);
    expect(fs.closeSync).toHaveBeenCalledWith(11);
  });
  it.each(['inode', 'hardlink', 'mtime'] as const)('rejects post-read %s changes', kind => {
    let fdInspections = 0;
    vi.mocked(fs.fstatSync).mockImplementation((() => {
      const info = stat();
      if (++fdInspections === 1) return info;
      return kind === 'hardlink' ? {...info, nlink:2} : kind === 'mtime' ? {...info, mtimeMs:2} : info;
    }) as never);
    let locatorInspections = 0;
    vi.mocked(fs.lstatSync).mockImplementation(((p: string) => {
      if (!p.endsWith('profile.json')) return stat(true);
      const info = stat();
      return kind === 'inode' && ++locatorInspections > 1 ? {...info, ino:99} : info;
    }) as never);
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('Profile locator changed');
    expect(fs.readSync).toHaveBeenCalled();
    expect(fs.closeSync).toHaveBeenCalledWith(11);
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
  });
  it('rejects a redirected or otherwise non-private root before enumeration', () => {
    // isPrivatePath performs the ancestor/reparse inspection; false is fail-closed.
    vi.mocked(isPrivatePath).mockImplementation(p => p !== root);
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('Unsafe execution profile root');
    expect(() => WslTasks.forScope('owned-tasks', own)).toThrow('Unsafe execution profile scope');
    expect(fs.readdirSync).not.toHaveBeenCalled();
    expect(fs.openSync).not.toHaveBeenCalled();
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
  });
  it('filters foreign profiles without creating directories or rewriting any ACL', () => {
    expect(WslTasks.discoverScopes('owned-tasks')).toEqual([own]);
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(fs.chmodSync).not.toHaveBeenCalled();
    expect(isPrivatePath).toHaveBeenCalledWith(root, 'directory');
    expect(isPrivatePath).toHaveBeenCalledWith(folder(own), 'directory');
    expect(isPrivatePath).not.toHaveBeenCalledWith(folder(foreign), 'directory');
  });
  it('tolerates a foreign candidate disappearing before its locator can be opened', () => {
    vi.mocked(fs.openSync).mockImplementation(((p: string) => {if(p === locator(foreign)) throw missing(); return 11;}) as never);
    expect(WslTasks.discoverScopes('owned-tasks')).toEqual([own]);
  });
  it('tolerates a validated foreign locator disappearing after its read', () => {
    contents = (fd: number) => {
      if (fd === 22) vi.mocked(fs.lstatSync).mockImplementation(((p: string) => {
        if (p === locator(foreign)) throw missing();
        return stat(!p.endsWith('profile.json'));
      }) as never);
      return JSON.stringify({version:1,scope:fd === 11 ? own : foreign,taskParentKey:(fd === 11 ? 'a' : 'b').repeat(64)});
    };
    expect(WslTasks.discoverScopes('owned-tasks')).toEqual([own]);
  });
  it('does not swallow disappearance after a locator was read', () => {
    contents = () => {
      vi.mocked(fs.lstatSync).mockImplementation((() => {throw missing();}) as never);
      return JSON.stringify({version:1,scope:own,taskParentKey:'a'.repeat(64)});
    };
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('changed during read');
  });
  it.each(['symlink', 'hardlink', 'malformed', 'replaced', 'access-denied'])('rejects %s locators without repair', kind => {
    if (kind === 'symlink') vi.mocked(fs.lstatSync).mockReturnValue({...stat(),isSymbolicLink:()=>true} as never);
    if (kind === 'hardlink') vi.mocked(fs.lstatSync).mockImplementation(((p: string) => p.endsWith('profile.json') ? {...stat(), nlink:2} : stat(true)) as never);
    if (kind === 'malformed') contents = () => 'x'.repeat(stat().size);
    if (kind === 'replaced') vi.mocked(fs.fstatSync).mockReturnValue({...stat(),ino:99} as never);
    if (kind === 'access-denied') vi.mocked(fs.openSync).mockImplementation(() => {throw Object.assign(new Error('denied'),{code:'EACCES'});});
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow();
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
  });
  it('fails closed on selected scope privacy instead of repairing it', () => {
    vi.mocked(isPrivatePath).mockImplementation(p => p !== folder(own));
    expect(() => WslTasks.discoverScopes('owned-tasks')).toThrow('Unsafe owned');
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
  });
  it('validates only the requested scope and refuses foreign ownership', () => {
    expect(WslTasks.forScope('owned-tasks', own).scope).toBe(own);
    expect(fs.readdirSync).not.toHaveBeenCalled();
    expect(fs.openSync).not.toHaveBeenCalledWith(locator(foreign), 'r');
    expect(() => WslTasks.forScope('owned-tasks', foreign)).toThrow('does not belong');
    expect(ensurePrivateDirectory).not.toHaveBeenCalled();
  });
  it('fails closed when the selected scope disappears or is not a valid identifier', () => {
    vi.mocked(fs.openSync).mockImplementation(() => {throw missing();});
    expect(() => WslTasks.forScope('owned-tasks', own)).toThrow('missing');
    expect(() => WslTasks.forScope('owned-tasks', '../elsewhere')).toThrow('Unsafe');
  });
});
