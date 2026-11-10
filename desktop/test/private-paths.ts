import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect } from 'vitest';

/** Inspect the OS ACL independently of the production helper. */
export function expectPrivatePath(target: string, mode: 0o600 | 0o700): void {
  const stat = fs.statSync(target);
  expect(mode === 0o700 ? stat.isDirectory() : stat.isFile()).toBe(true);
  if (process.platform !== 'win32') { expect(stat.mode & 0o777).toBe(mode); return; }
  const script = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if ([IO.Directory]::Exists($env:INQUELLO_TEST_ACL_PATH)) {
  $acl = [IO.Directory]::GetAccessControl($env:INQUELLO_TEST_ACL_PATH, [System.Security.AccessControl.AccessControlSections]::Access)
} else {
  $acl = [IO.File]::GetAccessControl($env:INQUELLO_TEST_ACL_PATH, [System.Security.AccessControl.AccessControlSections]::Access)
}
$rules = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | ForEach-Object {
  @{ sid = $_.IdentityReference.Value; allow = ($_.AccessControlType -eq 'Allow'); rights = [int]$_.FileSystemRights }
})
@{ user = $user; rules = $rules } | ConvertTo-Json -Compress -Depth 4
`;
  const json = execFileSync(path.join(process.env.SystemRoot!, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PSModulePath: path.join(process.env.SystemRoot!, 'System32', 'WindowsPowerShell', 'v1.0', 'Modules'), INQUELLO_TEST_ACL_PATH: path.resolve(target) } });
  const acl = JSON.parse(json) as { user: string; rules: Array<{ sid: string; allow: boolean; rights: number }> };
  const grants = acl.rules.filter(rule => rule.allow);
  expect(grants.filter(rule => ![acl.user, 'S-1-5-18', 'S-1-5-32-544'].includes(rule.sid)), target).toEqual([]);
  expect(grants.some(rule => rule.sid === acl.user && (rule.rights & 0x1f01ff) === 0x1f01ff), target).toBe(true);
}
