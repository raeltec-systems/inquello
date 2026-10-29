/**
 * The Claude API key vault (Story 1.13): where the main process keeps the
 * user's Claude API key.
 *
 * Same backend rules as the identity vault (`identity/vault.ts`): the key
 * persists only when Electron `safeStorage` is backed by an OS credential
 * store (Keychain, DPAPI, libsecret or KWallet). Then the record is encrypted
 * with `safeStorage` and written atomically to `<userData>/providers/claude.bin`
 * with mode 0600 (directory 0700). With any other backend, or any error while
 * detecting it, the vault is `memory-only`: nothing is written and the key
 * lasts for this run, which the status says.
 *
 * When OS-backed, the file is the only truth: every read decrypts it, so a
 * file removed by Local data deletion is a removed key. The record holds the
 * key and its last verification state. It never leaves the main process: the
 * renderer sees only the state and the storage kind.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { detectCredentialStorage, type CredentialStorage, type SafeStorageLike } from '../identity/vault';

export const PROVIDERS_DIR = 'providers';
export const CLAUDE_KEY_FILE = 'claude.bin';

/** The states a stored key can be in (`not-configured` means no record). */
export type StoredClaudeState = 'stored-unverified' | 'verified' | 'rejected' | 'unreachable';
export type ClaudeKeyState = 'not-configured' | StoredClaudeState;

const STORED_STATES: readonly StoredClaudeState[] = ['stored-unverified', 'verified', 'rejected', 'unreachable'];

export interface ClaudeKeyRecord {
  version: 1;
  key: string;
  state: StoredClaudeState;
}

export const CLAUDE_KEY_PREFIX = 'sk-ant-';
export const CLAUDE_KEY_MIN_LENGTH = 24;
export const CLAUDE_KEY_MAX_LENGTH = 256;

/**
 * Checks a submitted key's form: the `sk-ant-` prefix, a length bound and
 * printable ASCII without spaces. Returns why it is refused, or null. The
 * reason never quotes the key.
 */
export function claudeKeyProblem(key: string): string | null {
  if (!key.startsWith(CLAUDE_KEY_PREFIX)) return `A Claude API key starts with ${CLAUDE_KEY_PREFIX}.`;
  if (key.length < CLAUDE_KEY_MIN_LENGTH || key.length > CLAUDE_KEY_MAX_LENGTH) {
    return `A Claude API key is between ${CLAUDE_KEY_MIN_LENGTH} and ${CLAUDE_KEY_MAX_LENGTH} characters long.`;
  }
  if (!/^[\x21-\x7e]+$/.test(key)) return 'A Claude API key holds only printable characters, without spaces.';
  return null;
}

function isRecord(value: unknown): value is ClaudeKeyRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    typeof record.key === 'string' &&
    claudeKeyProblem(record.key) === null &&
    (STORED_STATES as readonly unknown[]).includes(record.state)
  );
}

export interface ClaudeVaultOptions {
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
  /** `<userData>/providers`. */
  dir: string;
}

export function providersDir(userDataDir: string): string {
  return path.join(userDataDir, PROVIDERS_DIR);
}

export class ClaudeKeyVault {
  readonly storage: CredentialStorage;
  readonly filePath: string;
  private memory: ClaudeKeyRecord | null = null;

  constructor(private readonly options: ClaudeVaultOptions) {
    this.storage = detectCredentialStorage(options.safeStorage, options.platform);
    this.filePath = path.join(options.dir, CLAUDE_KEY_FILE);
  }

  /** The stored record, or null when there is none or it cannot be read (an unreadable file is removed). */
  load(): ClaudeKeyRecord | null {
    if (this.storage !== 'os-backed') return this.memory ? { ...this.memory } : null;
    let encrypted: Buffer;
    try {
      encrypted = fs.readFileSync(this.filePath);
    } catch {
      return null;
    }
    try {
      const value: unknown = JSON.parse(this.options.safeStorage.decryptString(encrypted));
      if (isRecord(value)) return { version: 1, key: value.key, state: value.state };
    } catch {
      // Unreadable: discard below.
    }
    fs.rmSync(this.filePath, { force: true });
    return null;
  }

  save(record: ClaudeKeyRecord): void {
    const clean: ClaudeKeyRecord = { version: 1, key: record.key, state: record.state };
    if (this.storage !== 'os-backed') {
      this.memory = clean;
      return;
    }
    fs.mkdirSync(this.options.dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.options.dir, 0o700);
    const temp = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, this.options.safeStorage.encryptString(JSON.stringify(clean)), { mode: 0o600, flag: 'wx' });
      fs.chmodSync(temp, 0o600);
      fs.renameSync(temp, this.filePath);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  clear(): void {
    this.memory = null;
    if (this.storage === 'os-backed') fs.rmSync(this.filePath, { force: true });
  }
}
