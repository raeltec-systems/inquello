/** Main's native runtime helper: private paths use POSIX modes or a protected Windows DACL.
 * Only the current user, SYSTEM and Administrators receive access. Changes
 * apply to the named path, never recursively to unrelated descendants.
 */
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const WINDOWS_ACL = `
$ErrorActionPreference = 'Stop'
$target = $env:INQUELLO_PRIVATE_PATH
$kind = $env:INQUELLO_PRIVATE_KIND
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$allowed = @($user.Value, 'S-1-5-18', 'S-1-5-32-544')
if ($env:INQUELLO_PRIVATE_OPERATION -eq 'restrict') {
  if ($kind -eq 'directory') {
    $acl = [IO.Directory]::GetAccessControl($target, [System.Security.AccessControl.AccessControlSections]::Access)
    $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  } else {
    $acl = [IO.File]::GetAccessControl($target, [System.Security.AccessControl.AccessControlSections]::Access)
    $inherit = [System.Security.AccessControl.InheritanceFlags]::None
  }
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($rule in @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))) {
    $acl.RemoveAccessRuleSpecific($rule)
  }
  foreach ($id in $allowed) {
    $sid = New-Object System.Security.Principal.SecurityIdentifier($id)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', $inherit, 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  if ($kind -eq 'directory') { [IO.Directory]::SetAccessControl($target, $acl) }
  else { [IO.File]::SetAccessControl($target, $acl) }
} else {
  if ($kind -eq 'directory') { $acl = [IO.Directory]::GetAccessControl($target, [System.Security.AccessControl.AccessControlSections]::Access) }
  else { $acl = [IO.File]::GetAccessControl($target, [System.Security.AccessControl.AccessControlSections]::Access) }
  $rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
  $private = $true
  $ownerAccess = $false
  foreach ($rule in $rules) {
    if ($rule.AccessControlType -eq 'Allow') {
      if ($allowed -notcontains $rule.IdentityReference.Value) { $private = $false }
      if ($rule.IdentityReference.Value -eq $user.Value -and
          ($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl) { $ownerAccess = $true }
    }
  }
  [Console]::Write(($private -and $ownerAccess -and $acl.AreAccessRulesProtected).ToString().ToLowerInvariant())
}
`;

function windowsAcl(target: string, kind: 'file' | 'directory', operation: 'restrict' | 'inspect'): string {
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return execFileSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_ACL, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, timeout: 15_000,
    env: { ...process.env, PSModulePath: path.join(path.dirname(executable), 'Modules'), INQUELLO_PRIVATE_PATH: path.resolve(target), INQUELLO_PRIVATE_KIND: kind, INQUELLO_PRIVATE_OPERATION: operation },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

/** Refuse redirected ancestors before changing permissions or creating children. */
function assertUnredirected(target: string): void {
  let current = path.resolve(target);
  while (true) {
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('Private storage cannot use redirected paths');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

export function ensurePrivateDirectory(target: string): void {
  assertUnredirected(target);
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') windowsAcl(target, 'directory', 'restrict');
  else fs.chmodSync(target, 0o700);
}

/** Apply the same protected DACL without blocking main's IPC and navigation. */
export async function ensurePrivateDirectoryAsync(target: string): Promise<void> {
  await ensurePrivateDirectoriesAsync([target]);
}

/** Protect each parent before creating its child, in one asynchronous Windows process. */
export async function ensurePrivateDirectoriesAsync(targets: readonly string[]): Promise<void> {
  const resolved = targets.map(target => path.resolve(target));
  for (const target of resolved) assertUnredirected(target);
  if (process.platform !== 'win32') {
    for (const target of resolved) ensurePrivateDirectory(target);
    return;
  }
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = `
$ErrorActionPreference = 'Stop'
foreach ($privateTarget in (ConvertFrom-Json $env:INQUELLO_PRIVATE_PATHS)) {
  # Recheck every ancestor after the asynchronous process boundary, before mutation.
  $current = $privateTarget
  while ($current) {
    try {
      $attributes = [IO.File]::GetAttributes($current)
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Private storage cannot use redirected paths' }
    } catch [IO.FileNotFoundException] {} catch [IO.DirectoryNotFoundException] {}
    $parent = [IO.Path]::GetDirectoryName($current)
    if ($parent -eq $current) { break }
    $current = $parent
  }
  [IO.Directory]::CreateDirectory($privateTarget) | Out-Null
  $env:INQUELLO_PRIVATE_PATH = $privateTarget
  & {
${WINDOWS_ACL}
  }
}
`;
  await promisify(execFile)(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, timeout: 15_000,
    env: { ...process.env, PSModulePath: path.join(path.dirname(executable), 'Modules'), INQUELLO_PRIVATE_PATHS: JSON.stringify(resolved), INQUELLO_PRIVATE_KIND: 'directory', INQUELLO_PRIVATE_OPERATION: 'restrict' },
  });
}

export function restrictPrivateFile(target: string): void {
  assertUnredirected(target);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('Private storage requires an unlinked regular file');
  if (process.platform === 'win32') windowsAcl(target, 'file', 'restrict');
  else fs.chmodSync(target, 0o600);
}

export function isPrivatePath(target: string, kind: 'file' | 'directory'): boolean {
  try {
    assertUnredirected(target);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || (kind === 'file' ? !stat.isFile() : !stat.isDirectory())) return false;
    if (process.platform === 'win32') return windowsAcl(target, kind, 'inspect') === 'true';
    return (stat.mode & 0o777) === (kind === 'file' ? 0o600 : 0o700);
  } catch { return false; }
}
