/** Strict WSL setup preflight. This does not launch a distribution or authorize
 * execution: configuration on disk is not proof of the running VM's storage. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const WSL_DISTRIBUTION = 'Inquello-Engine';
export const WSL_STORAGE = Object.freeze({
  distribution: 'D:\\Inquello\\wsl\\Inquello-Engine',
  swap: 'D:\\Inquello\\wsl\\swap.vhdx',
  images: 'D:\\Inquello\\cache\\images',
  temp: 'D:\\Inquello\\tmp',
  backups: 'D:\\Inquello\\backups',
  logs: 'D:\\Inquello\\logs',
});
export const WSL_MINIMUM_FREE_BYTES = 32n * 1024n ** 3n;

const CONFIG_KEYS: Readonly<Record<string, string>> = Object.freeze({
  swap: '4GB',
  swapFile: 'D:\\\\Inquello\\\\wsl\\\\swap.vhdx',
  maxCrashDumpCount: '0',
  crashDumpFolder: 'D:\\\\Inquello\\\\logs\\\\wsl-crashes',
});

/** Preserve unrelated settings/comments, refuse ambiguous duplicate sections or
 * keys. Only the reviewed swap/crash settings are changed. */
export function previewWslConfig(current: string): string {
  if (current.includes('\0')) throw new Error('Invalid WSL configuration');
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const lines = current.replace(/^\uFEFF/, '').split(/\r?\n/);
  const sections = lines.map((line, index) => ({ name: /^\s*\[([^\]]+)\]\s*(?:[#;].*)?$/.exec(line)?.[1]?.toLowerCase(), index }));
  const matches = sections.filter(({ name }) => name === 'wsl2');
  if (matches.length > 1) throw new Error('Duplicate [wsl2] sections require manual reconciliation');
  if (matches.length === 0) {
    return `${current}${current && !current.endsWith('\n') ? newline : ''}[wsl2]${newline}${Object.entries(CONFIG_KEYS).map(([key, value]) => `${key}=${value}`).join(newline)}${newline}`;
  }
  const start = matches[0]!.index;
  const end = sections.find(({ name, index }) => name !== undefined && index > start)?.index ?? lines.length;
  const found = new Set<string>();
  for (let index = start + 1; index < end; index++) {
    const match = /^\s*([^#;=\s]+)\s*=/.exec(lines[index]!);
    const key = Object.keys(CONFIG_KEYS).find((candidate) => candidate.toLowerCase() === match?.[1]?.toLowerCase());
    if (!key) continue;
    if (found.has(key)) throw new Error(`Duplicate WSL setting: ${key}`);
    found.add(key);
    lines[index] = `${key}=${CONFIG_KEYS[key]}`;
  }
  lines.splice(end, 0, ...Object.entries(CONFIG_KEYS).filter(([key]) => !found.has(key)).map(([key, value]) => `${key}=${value}`));
  return lines.join(newline).replace(/(?:\r?\n)*$/, newline);
}

/** Reject device paths, drive-relative paths, alternate streams and traversal
 * before consulting the filesystem. Do not normalize an unsafe path into D:. */
export function assertDStoragePath(target: string): void {
  if (!/^D:[\\/]/i.test(target) || /[\0-\x1f]/.test(target) || target.slice(2).includes(':')) throw new Error('WSL storage must be on D:');
  if (target.slice(3).split(/[\\/]/).some((part) => part === '..' || part === '.' || /[. ]$/.test(part))) throw new Error('Unsafe WSL storage path');
}

/** Inspect every existing ancestor so a junction cannot redirect creation to
 * another drive. Missing descendants are allowed only after a safe ancestor. */
export function assertDStorageLocation(target: string): void {
  if (process.platform !== 'win32') throw new Error('Windows storage inspection required');
  assertDStoragePath(target);
  let candidate = path.win32.resolve(target);
  while (true) {
    try {
      const stat = fs.lstatSync(candidate);
      if (stat.isSymbolicLink()) throw new Error('WSL storage cannot use reparse points');
      const actual = fs.realpathSync.native(candidate);
      assertDStoragePath(actual);
      if (path.win32.normalize(actual).toLowerCase() !== candidate.toLowerCase()) throw new Error('WSL storage path was redirected');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (candidate === path.win32.parse(candidate).root) throw error;
    }
    const parent = path.win32.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  const volume = fs.statfsSync('D:\\', { bigint: true });
  if (volume.bavail * volume.bsize < WSL_MINIMUM_FREE_BYTES) throw new Error('WSL storage needs at least 32 GiB free on D:');
}

/** Explicit allowlist: WSLENV, proxy variables, provider keys and other host
 * secrets never flow through a spread of process.env into the future bridge. */
export function wslHostEnvironment(systemRoot: string): NodeJS.ProcessEnv {
  if (!/^[A-Za-z]:[\\/]/.test(systemRoot) || /[\0\r\n]/.test(systemRoot)) throw new Error('Invalid Windows system directory');
  return {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: path.win32.join(systemRoot, 'System32'),
    TEMP: WSL_STORAGE.temp,
    TMP: WSL_STORAGE.temp,
    TMPDIR: WSL_STORAGE.temp,
  };
}

export const WSL_UNAVAILABLE_REASON = 'Linux execution is unavailable until WSL storage and isolation checks pass.';

export interface WslStorageProof {
  version: 1;
  bootId: string;
  bootTime: number;
  configSha256: string;
  swapCreatedAt: string;
  distribution: string;
  diskVirtualBytes: number;
}

/** Host checks are repeated before every transfer/execution. A guest launch is
 * never used to repair missing or changed shared WSL settings. */
export function preflightWsl(): WslStorageProof {
  for (const target of Object.values(WSL_STORAGE)) assertDStorageLocation(target);
  const receipt = 'D:\\Inquello\\runtime\\storage-proof.json';
  assertDStorageLocation(receipt);
  const proof = JSON.parse(fs.readFileSync(receipt, 'utf8')) as WslStorageProof;
  if (proof.version !== 1 || !/^[0-9a-f-]{36}$/.test(proof.bootId)
    || proof.distribution !== WSL_STORAGE.distribution || proof.diskVirtualBytes !== 128 * 1024 ** 3) throw new Error(WSL_UNAVAILABLE_REASON);
  const profile = process.env.USERPROFILE;
  if (!profile) throw new Error(WSL_UNAVAILABLE_REASON);
  const config = fs.readFileSync(path.join(profile, '.wslconfig'));
  if (crypto.createHash('sha256').update(config).digest('hex') !== proof.configSha256) throw new Error('Shared WSL settings changed; storage proof must be renewed');
  if (fs.statSync(WSL_STORAGE.swap).birthtime.toISOString() !== proof.swapCreatedAt) throw new Error('Shared WSL swap changed; storage proof must be renewed');
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot) throw new Error(WSL_UNAVAILABLE_REASON);
  const registry = execFileSync(path.win32.join(systemRoot, 'System32', 'reg.exe'),
    ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss', '/s'],
    { env: wslHostEnvironment(systemRoot), cwd: WSL_STORAGE.temp, encoding: 'utf8', windowsHide: true, timeout: 10_000 });
  const blocks = registry.split(/(?=HKEY_CURRENT_USER\\)/);
  const registered = blocks.filter((block) => /DistributionName\s+REG_SZ\s+Inquello-Engine\s*$/m.test(block));
  if (registered.length !== 1 || !/Version\s+REG_DWORD\s+0x2\s*$/m.test(registered[0]!)
    || !/BasePath\s+REG_SZ\s+(?:\\\\\?\\)?D:\\Inquello\\wsl\\Inquello-Engine\\?\s*$/mi.test(registered[0]!)) throw new Error('Dedicated guest registration changed');
  return proof;
}

export function wslScope(taskParent: string, principal: string): string {
  const canonical = fs.realpathSync.native(taskParent).replaceAll('\\', '/').replace(/^\/\/\?\//, '').toLowerCase();
  return crypto.createHash('sha256').update(`${canonical}\0${principal}`).digest('hex');
}
