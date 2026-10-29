/**
 * The runtime's `config.toml` (Story 1.13), written by the desktop into the
 * runtime home before every runtime start.
 *
 * Inquello owns this file: it is rewritten in full each time, so nothing a
 * previous run (or a person) left in it survives. It holds only the
 * credential-store settings for the inherited Codex login:
 * - `cli_auth_credentials_store = "keyring"`: the runtime stores a Codex
 *   login (API key or ChatGPT) in the OS keyring and fails, with a stated
 *   reason, when no keyring is available. There is no `auth.json` fallback.
 * - `[features] secret_auth_storage = false`: the keyring holds the login
 *   itself on every platform, rather than an encrypted file under the runtime
 *   home whose key sits in the keyring (the Windows default).
 *
 * - `[features] network_proxy = true` (Story 1.19): a Task's tools reach the
 *   network only through the runtime's own proxy, which allows only the
 *   Workspace's listed domains and names every blocked destination.
 *
 * - `approvals_reviewer = "user"` (Story 1.20): the inherited automatic
 *   approval reviewer stays off. Every permission request comes to the
 *   person until a Workspace switches automated permission review on and a
 *   processing route exists (Story 1.22).
 *
 * While the runtime runs, `inquello/tools/exec` adds each Task's named
 * permissions profile (`[permissions.inquello-task-<id>]`) through the
 * runtime's own configuration writer; the next start drops them, and each
 * run writes its profile again.
 *
 * The file holds no credential. It is written atomically with mode 0600.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const RUNTIME_CONFIG_FILE = 'config.toml';

export const RUNTIME_CONFIG_TOML = [
  '# Written by Inquello before every runtime start; changes here are replaced.',
  '# Codex logins live in the OS keyring only: no auth.json fallback.',
  'cli_auth_credentials_store = "keyring"',
  '# Permission requests come to the person; the automatic reviewer stays off.',
  'approvals_reviewer = "user"',
  '',
  '[features]',
  '# Keep the login itself in the keyring, not in an encrypted file in this directory.',
  'secret_auth_storage = false',
  '# Task tools reach the network only through the runtime\'s proxy, with the Workspace\'s allowed domains.',
  'network_proxy = true',
  '',
].join('\n');

/** Writes the Inquello-owned `config.toml` into `runtimeHome`; returns its path. */
export function writeRuntimeConfig(runtimeHome: string): string {
  fs.mkdirSync(runtimeHome, { recursive: true, mode: 0o700 });
  const file = path.join(runtimeHome, RUNTIME_CONFIG_FILE);
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, RUNTIME_CONFIG_TOML, { mode: 0o600, flag: 'wx' });
    fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
  return file;
}
