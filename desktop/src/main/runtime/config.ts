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
  '',
  '[features]',
  '# Keep the login itself in the keyring, not in an encrypted file in this directory.',
  'secret_auth_storage = false',
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
