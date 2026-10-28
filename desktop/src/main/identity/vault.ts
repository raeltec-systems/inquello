/**
 * The credential vault: where the main process keeps the Inquello session.
 *
 * Credentials persist only when Electron `safeStorage` is backed by an OS
 * credential store: Keychain (macOS), DPAPI (Windows), or libsecret or KWallet
 * (Linux). Then the session record is encrypted with `safeStorage` and written
 * atomically to `<dir>/session.bin` with mode 0600 (directory 0700), and an
 * installation device ID is kept beside it. With `basic_text`, `unknown`, no
 * encryption, or any error while detecting the backend, the vault is
 * `memory-only`: nothing is written to disk and the sign-in lasts for this run.
 *
 * The record holds the access and refresh credentials, the display name, and
 * any pending logout operation (persisted until it resolves). It never leaves
 * the main process: the renderer, IPC, logs, URLs and the app-server
 * environment never see it.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type CredentialStorage = 'os-backed' | 'memory-only';

/** The parts of Electron `safeStorage` the vault uses. */
export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  /** Linux only. */
  getSelectedStorageBackend?(): string;
}

/** Linux `safeStorage` backends that use an OS credential store. */
export const OS_BACKED_LINUX_BACKENDS = ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'] as const;

/** Decides, failing closed, whether `safeStorage` is OS-backed on `platform`. */
export function detectCredentialStorage(safeStorage: SafeStorageLike, platform: NodeJS.Platform): CredentialStorage {
  try {
    if (!safeStorage.isEncryptionAvailable()) return 'memory-only';
    if (platform === 'darwin' || platform === 'win32') return 'os-backed';
    if (platform === 'linux') {
      const backend = safeStorage.getSelectedStorageBackend?.();
      return (OS_BACKED_LINUX_BACKENDS as readonly string[]).includes(backend ?? '') ? 'os-backed' : 'memory-only';
    }
    return 'memory-only';
  } catch {
    return 'memory-only';
  }
}

export interface PendingLogout {
  operationId: string;
  commandEpoch: string;
  expectedRevision: string;
  sessionId: string;
  /** Whether the envelope may already have reached the service. */
  sent: boolean;
}

export interface StoredSession {
  version: 1;
  serviceUrl: string;
  issuer: string;
  deviceId: string;
  sessionId: string;
  principalId: string;
  displayName: string;
  accessCredential: string;
  accessExpiresAt: string;
  refreshCredential: string;
  refreshExpiresAt: string;
  sessionExpiresAt: string;
  pendingLogout: PendingLogout | null;
}

const STRING_FIELDS = [
  'serviceUrl',
  'issuer',
  'deviceId',
  'sessionId',
  'principalId',
  'displayName',
  'accessCredential',
  'accessExpiresAt',
  'refreshCredential',
  'refreshExpiresAt',
  'sessionExpiresAt',
] as const;

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return false;
  if (!STRING_FIELDS.every((key) => typeof record[key] === 'string')) return false;
  const pending = record.pendingLogout;
  if (pending === null) return true;
  if (typeof pending !== 'object' || pending === undefined) return false;
  const p = pending as Record<string, unknown>;
  return (
    typeof p.operationId === 'string' &&
    typeof p.commandEpoch === 'string' &&
    typeof p.expectedRevision === 'string' &&
    typeof p.sessionId === 'string' &&
    typeof p.sent === 'boolean'
  );
}

export const SESSION_FILE = 'session.bin';
export const DEVICE_FILE = 'device-id';

export interface VaultOptions {
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
  /** Directory for the encrypted record, for example `<userData>/identity`. */
  dir: string;
}

export class CredentialVault {
  readonly storage: CredentialStorage;
  readonly filePath: string;
  private readonly deviceFile: string;
  private memory: StoredSession | null = null;
  private memoryDeviceId: string | null = null;

  constructor(private readonly options: VaultOptions) {
    this.storage = detectCredentialStorage(options.safeStorage, options.platform);
    this.filePath = path.join(options.dir, SESSION_FILE);
    this.deviceFile = path.join(options.dir, DEVICE_FILE);
  }

  private ensureDir(): void {
    fs.mkdirSync(this.options.dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(this.options.dir, 0o700);
  }

  private writePrivate(file: string, data: Buffer | string): void {
    this.ensureDir();
    const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, data, { mode: 0o600, flag: 'wx' });
      fs.chmodSync(temp, 0o600);
      fs.renameSync(temp, file);
    } finally {
      fs.rmSync(temp, { force: true });
    }
  }

  /** This installation's device ID: persisted beside the record when OS-backed, per run otherwise. */
  deviceId(): string {
    if (this.storage !== 'os-backed') {
      this.memoryDeviceId ??= randomUUID();
      return this.memoryDeviceId;
    }
    try {
      const existing = fs.readFileSync(this.deviceFile, 'utf8').trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(existing)) return existing;
    } catch {
      // Not written yet.
    }
    const id = randomUUID();
    this.writePrivate(this.deviceFile, id);
    return id;
  }

  /** The stored session, or null when there is none or it cannot be read. */
  load(): StoredSession | null {
    if (this.storage !== 'os-backed') return this.memory;
    let encrypted: Buffer;
    try {
      encrypted = fs.readFileSync(this.filePath);
    } catch {
      return null;
    }
    try {
      const value: unknown = JSON.parse(this.options.safeStorage.decryptString(encrypted));
      if (isStoredSession(value)) return value;
    } catch {
      // Unreadable: discard below.
    }
    fs.rmSync(this.filePath, { force: true });
    return null;
  }

  save(record: StoredSession): void {
    if (this.storage !== 'os-backed') {
      this.memory = structuredClone(record);
      return;
    }
    this.writePrivate(this.filePath, this.options.safeStorage.encryptString(JSON.stringify(record)));
  }

  clear(): void {
    this.memory = null;
    if (this.storage === 'os-backed') fs.rmSync(this.filePath, { force: true });
  }
}
