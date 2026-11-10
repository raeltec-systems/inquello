/**
 * Story 1.10b: the identity session against fakes, one block per I/O-matrix
 * row (sign-in, wrong state, PKCE mismatch, untrusted certificate, OS store,
 * no OS store, refresh reuse, service down, self-logout lost, renderer probe),
 * plus the lost bootstrap response, refresh serialization and configuration.
 * The loopback listener and the vault are the real ones.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import { DataService, ExportJournal, governedRoots, loadShippedPolicy } from '../src/main/data';
import { ServiceError } from '../src/main/identity/service-client';
import { SESSION_FILE, CredentialVault } from '../src/main/identity/vault';
import { IdentitySession, REASONS, toRendererResult, toRendererStatus, type IdentitySessionOptions } from '../src/main/identity/session';
import type { ConfigResult } from '../src/main/identity/config';
import { CONFIG, FakeIssuer, FakeService, fakeOpener, fakeSafeStorage, httpGet, type OpenerMode } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir, waitFor } from './helpers';

afterAll(() => removeTempDirs());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

interface World {
  service: FakeService;
  issuer: FakeIssuer;
  dir: string;
  mode: OpenerMode;
  opened: string[];
  callbacks: string[];
  logger: ReturnType<typeof recordingLogger>;
  make(overrides?: Partial<IdentitySessionOptions>): IdentitySession;
}

function world(backend: string | null = 'gnome_libsecret', options: { now?: () => number } = {}): World {
  const service = new FakeService(options.now);
  const issuer = new FakeIssuer();
  const dir = tempDir('identity');
  const logger = recordingLogger();
  const w = { service, issuer, dir, mode: 'follow' as OpenerMode, logger } as World;
  const { opener, opened, callbacks } = fakeOpener(issuer, () => w.mode);
  w.opened = opened;
  w.callbacks = callbacks;
  w.make = (overrides = {}) =>
    new IdentitySession({
      config: { kind: 'configured', config: CONFIG },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage(backend), platform: 'linux', dir }),
      service,
      issuer,
      openBrowser: opener,
      logger,
      callbackTimeoutMs: 2_000,
      recordSecrets: true,
      now: options.now,
      ...overrides,
    });
  return w;
}

function fileText(dir: string): string {
  const file = path.join(dir, SESSION_FILE);
  return fs.existsSync(file) ? fs.readFileSync(file).toString('latin1') : '';
}

/** A loopback port that was free a moment ago, for tests of the fixed callback port. */
function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

describe('sign-in', () => {
  it('signs in through the browser, loopback, token exchange and bootstrap', async () => {
    const w = world();
    const session = w.make();
    expect((await session.getStatus()).identity).toEqual({ state: 'signed-out' });

    const result = await session.signIn();
    expect(result).toEqual({
      ok: true,
      status: {
        identity: { state: 'signed-in', displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' },
        sharedService: 'available',
        credentialStorage: 'os-backed',
        privateWork: 'local',
      },
    });

    // The authorization request: S256 PKCE, the service's nonce, a loopback redirect.
    const url = new URL(w.opened[0]!);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    const transaction = [...w.service.transactions.values()][0]!;
    expect(url.searchParams.get('nonce')).toBe(transaction.nonce);
    expect(url.searchParams.get('redirect_uri')).toBe(transaction.redirect_uri);
    expect(transaction.redirect_uri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    // The verifier went to the issuer only, never into the authorization URL.
    const verifier = w.issuer.exchanges[0]!.codeVerifier;
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(w.opened[0]).not.toContain(verifier);

    // Stored encrypted with mode 0600; no secret in plaintext.
    const file = path.join(w.dir, SESSION_FILE);
    if (process.platform !== 'win32') {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      expect(fs.statSync(w.dir).mode & 0o777).toBe(0o700);
    }
    const stored = fileText(w.dir);
    for (const secret of session.knownSecrets()) expect(stored.includes(secret)).toBe(false);
    expect(session.knownSecrets().length).toBeGreaterThanOrEqual(6);

    // The listener closed after the one accepted callback: a replay finds nothing.
    await expect(httpGet(w.callbacks[0]!)).rejects.toThrow();
  });

  it('a second sign-in while one is running is refused, and a signed-in session stays', async () => {
    const w = world();
    w.mode = 'wrong-state';
    const session = w.make({ callbackTimeoutMs: 400 });
    const first = session.signIn();
    await waitFor(() => w.opened.length === 1);
    expect(await session.signIn()).toMatchObject({ ok: false, reason: REASONS.inProgress });
    await first;
    w.mode = 'follow';
    await session.signIn();
    expect(await session.signIn()).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' } } });
    expect(w.service.calls.filter((c) => c === 'bootstrap')).toHaveLength(1);
  });
});

describe('wrong state', () => {
  it('rejects a mismatched state, stays signing-in until the timeout, then signs out', async () => {
    const w = world();
    w.mode = 'wrong-state';
    // Keep real loopback HTTP, but advance its deadline deliberately after
    // observing rejection. A busy Windows runner must not race a 600 ms timer.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const session = w.make({ callbackTimeoutMs: 60_000 });
    const pending = session.signIn();
    await vi.waitFor(() => expect(w.callbacks).toHaveLength(1));
    // The mismatched callback was refused with 400 and the listener kept waiting.
    expect(await httpGet(w.callbacks[0]!)).toBe(400);
    expect(session.snapshot().identity).toEqual({ state: 'signing-in' });
    expect((await session.getStatus()).identity).toEqual({ state: 'signing-in' });

    await vi.advanceTimersByTimeAsync(60_000);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, reason: REASONS.timedOut, status: { identity: { state: 'signed-out' } } });
    expect(w.service.calls).not.toContain('bootstrap');
    expect(w.service.calls).toContain('abandon');
    // The listener is closed after the timeout.
    await expect(httpGet(w.callbacks[0]!)).rejects.toThrow();
  });

  it('an issuer error on the callback ends the sign-in without a token exchange', async () => {
    const w = world();
    w.mode = 'error';
    const result = await w.make().signIn();
    expect(result).toMatchObject({ ok: false, reason: REASONS.issuerRejected, status: { identity: { state: 'signed-out' } } });
    expect(w.issuer.exchanges).toHaveLength(0);
  });
});

describe('PKCE mismatch', () => {
  it('the issuer rejects the verifier; signed out with a reason and no secret', async () => {
    const w = world();
    w.mode = 'tamper-verifier';
    const session = w.make();
    const result = await session.signIn();
    expect(result).toMatchObject({ ok: false, reason: REASONS.issuerRejected, status: { identity: { state: 'signed-out' } } });
    expect(w.service.calls).not.toContain('bootstrap');
    const text = JSON.stringify(result);
    for (const secret of session.knownSecrets()) expect(text.includes(secret)).toBe(false);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });
});

describe('untrusted certificate', () => {
  it('a failed TLS connection makes the shared service unavailable and sign-in fail', async () => {
    const w = world();
    w.service.down = true; // What an untrusted certificate looks like to the session: no answer.
    const session = w.make();
    expect(await session.getStatus()).toMatchObject({ identity: { state: 'signed-out' }, sharedService: 'unavailable', privateWork: 'local' });
    expect(await session.signIn()).toMatchObject({ ok: false, reason: REASONS.serviceUnavailable });
  });
});

describe('OS store', () => {
  it('persists an encrypted session that survives a restart', async () => {
    const w = world('gnome_libsecret');
    await w.make().signIn();
    const restarted = w.make();
    expect(restarted.snapshot()).toMatchObject({ identity: { state: 'signed-in', displayName: 'Alice Synthetic' }, credentialStorage: 'os-backed' });
    expect(await restarted.getStatus()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'available' });
  });

  it('a session for another service or issuer is discarded on load', async () => {
    const w = world();
    await w.make().signIn();
    const other = w.make({ config: { kind: 'configured', config: { ...CONFIG, serviceUrl: 'https://other.synthetic.test' } } });
    expect(other.snapshot().identity).toEqual({ state: 'signed-out' });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });
});

describe('no OS store', () => {
  it.each([['basic_text'], ['unknown'], [null]])('backend %s keeps the session in memory and writes nothing', async (backend) => {
    const w = world(backend);
    const session = w.make();
    const result = await session.signIn();
    expect(result).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' }, credentialStorage: 'memory-only' } });
    expect(fs.readdirSync(w.dir)).toEqual([]);
    // Not remembered: a restart is signed out.
    expect(w.make().snapshot().identity).toEqual({ state: 'signed-out' });
  });
});

describe('refresh', () => {
  it('rotation replaces both credentials, and concurrent refreshes are serialized', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    const before = w.service.current()!;
    const [oldAccess, oldRefresh] = [before.access, before.refresh];
    const [a, b] = await Promise.all([session.refreshNow(), session.refreshNow()]);
    expect([a, b]).toEqual([true, true]);
    expect(w.service.calls.filter((c) => c === 'refresh')).toHaveLength(2);
    const stored = fileText(w.dir);
    expect(stored.includes(oldAccess)).toBe(false);
    // The session uses the newest pair; the old refresh credential is rotated out.
    const current = w.service.current()!;
    expect(current.rotated.has(oldRefresh)).toBe(true);
    expect(await session.getStatus()).toMatchObject({ identity: { state: 'signed-in' } });
    // Review R09: the vault on disk, decrypted by a fresh vault, holds exactly the new pair.
    const saved = new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: w.dir }).load();
    expect(saved).toMatchObject({ accessCredential: current.access, refreshCredential: current.refresh, pendingLogout: null });
    // A fresh session (a restart) uses the saved record: the service accepts its
    // access credential, and its refresh is the current one, not a reused one.
    const restarted = w.make();
    const calls = w.service.calls.length;
    expect(await restarted.getStatus()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'available' });
    expect(w.service.calls.slice(calls)).toEqual(['session']);
    expect(await restarted.refreshNow()).toBe(true);
    expect(w.service.current()!.revoked).toBe(false);
    expect(await restarted.getStatus()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'available' });
  });

  it('refreshes before a protected request when the access credential is about to expire', async () => {
    let now = Date.now();
    const w = world('gnome_libsecret', { now: () => now });
    const session = w.make();
    await session.signIn();
    now += 15 * 60_000;
    expect(await session.getStatus()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'available' });
    expect(w.service.calls).toContain('refresh');
  });

  it('a reuse rejection discards the family, revokes it and requires sign-in', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    const family = w.service.current()!;
    const refresh = family.refresh;
    w.service.refreshOutcome = 'reuse';
    expect(await session.refreshNow()).toBe(false);
    expect(session.snapshot().identity).toEqual({ state: 'signed-out' });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
    expect(w.service.revokedWith).toEqual([refresh]);
  });

  it('a lost refresh response discards the family and revokes it with the old credential', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    const refresh = w.service.current()!.refresh;
    w.service.refreshOutcome = 'lost';
    expect(await session.refreshNow()).toBe(false);
    expect(session.snapshot().identity).toEqual({ state: 'signed-out' });
    expect(w.service.revokedWith).toEqual([refresh]);
    expect(w.service.current()!.revoked).toBe(true);
  });

  it('a refresh the service could not attempt keeps the family', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    w.service.refreshOutcome = 'dependency';
    expect(await session.refreshNow()).toBe(false);
    expect(session.snapshot()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'unavailable' });
  });
});

describe('service down', () => {
  it('shows the shared service unavailable while private work stays local', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    w.service.down = true;
    expect(await session.getStatus()).toEqual({
      identity: { state: 'signed-in', displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' },
      sharedService: 'unavailable',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    });
    w.service.down = false;
    expect(await session.getStatus()).toMatchObject({ sharedService: 'available' });
  });

  it('a revoked session on the service signs the desktop out', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    w.service.current()!.revoked = true;
    expect((await session.getStatus()).identity).toEqual({ state: 'signed-out' });
  });
});

describe('logout', () => {
  it('sends one SC-2 logout envelope and clears the credentials', async () => {
    const w = world();
    const session = w.make({ operationId: () => 'logout-op-1' });
    await session.signIn();
    const result = await session.signOut();
    expect(result).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.logoutEnvelopes).toEqual([
      {
        command_epoch: '1',
        operation_id: 'logout-op-1',
        expected_revision: '1',
        schema_version: 1,
        payload: { command: 'logout', session_id: w.service.current()!.sessionId },
      },
    ]);
    expect(w.service.current()!.revoked).toBe(true);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });

  it('self-logout lost: the retry reuses the operation ID and unauthenticated means logged out', async () => {
    const w = world();
    let n = 0;
    const session = w.make({ operationId: () => `logout-op-${(n += 1)}` });
    await session.signIn();
    w.service.loseLogoutResponse = true;

    const first = await session.signOut();
    expect(first).toMatchObject({ ok: false, reason: REASONS.logoutPending, status: { identity: { state: 'blocked', reason: REASONS.logoutPending } } });
    // The operation is persisted until it resolves, even across a restart.
    const restarted = w.make({ operationId: () => `logout-op-${(n += 1)}` });
    expect(restarted.snapshot().identity).toEqual({ state: 'blocked', reason: REASONS.logoutPending });

    const second = await restarted.signOut();
    expect(second).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.logoutEnvelopes.map((e) => e.operation_id)).toEqual(['logout-op-1', 'logout-op-1']);
    expect(w.service.logoutEnvelopes[1]).toEqual(w.service.logoutEnvelopes[0]);
    // The refused retry is settled by asking the service: the revoked family cannot refresh, so the sign-out is confirmed.
    expect(w.service.calls.filter((name) => name === 'refresh')).toHaveLength(1);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });

  it('a pending logout is retried by the next status check', async () => {
    const w = world();
    const session = w.make({ operationId: () => 'logout-op-x' });
    await session.signIn();
    w.service.down = true;
    await session.signOut();
    // Nothing reached the service: still signed in, no operation persisted.
    expect(session.snapshot().identity.state).toBe('signed-in');
    w.service.down = false;
    w.service.loseLogoutResponse = true;
    expect((await session.signOut()).status.identity.state).toBe('blocked');
    expect((await session.getStatus()).identity).toEqual({ state: 'signed-out' });
    expect(w.service.logoutEnvelopes.map((e) => e.operation_id)).toEqual(['logout-op-x', 'logout-op-x']);
  });

  it('a stale epoch is rejected without a mutation and a new operation is prepared once', async () => {
    const w = world();
    let n = 0;
    const session = w.make({ operationId: () => `logout-${(n += 1)}` });
    await session.signIn();
    // The epoch rotates between preparing and sending.
    const capabilities = w.service.capabilities.bind(w.service);
    w.service.capabilities = async () => {
      const result = await capabilities();
      w.service.epoch = String(Number(w.service.epoch) + 1);
      w.service.capabilities = capabilities;
      return result;
    };
    const result = await session.signOut();
    expect(result).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.logoutEnvelopes.map((e) => [e.operation_id, e.command_epoch])).toEqual([
      ['logout-1', '1'],
      ['logout-2', '2'],
    ]);
  });
});

describe('logout when the refresh cannot be attempted (review R02)', () => {
  it('a logout retry refused with an expired credential is not confirmed until the family is refreshed or revoked', async () => {
    let now = Date.now();
    const w = world('gnome_libsecret', { now: () => now });
    const session = w.make({ operationId: () => 'logout-op-retry' });
    await session.signIn();
    const command = w.service.sessionCommand.bind(w.service);
    const refresh = w.service.refresh.bind(w.service);
    // The first attempt never reaches the service, so nothing is committed, but it is recorded as possibly sent.
    w.service.sessionCommand = async () => {
      throw new ServiceError('transport', false);
    };
    const first = await session.signOut();
    expect(first).toMatchObject({ ok: false, reason: REASONS.logoutPending });
    expect(w.service.current()!.revoked).toBe(false);
    // The access credential then expires and the refresh cannot be attempted, so the retry is refused as unauthenticated.
    w.service.sessionCommand = command;
    now = w.service.current()!.accessExpiresAt + 1;
    w.service.refresh = async () => {
      throw new ServiceError('dependency_unavailable', true, 503);
    };
    const second = await session.signOut();
    // That refusal is not proof that the earlier attempt committed: the server session is still alive.
    expect(second).toMatchObject({ ok: false, reason: REASONS.logoutPending, status: { identity: { state: 'blocked', reason: REASONS.logoutPending } } });
    expect(w.service.current()!.revoked).toBe(false);
    expect(session.holdsSession()).toBe(true);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(true);
    // Once the service answers, the same operation is sent with a fresh credential and the session is revoked.
    w.service.refresh = refresh;
    const third = await session.signOut();
    expect(third).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.current()!.revoked).toBe(true);
    expect(new Set(w.service.logoutEnvelopes.map((e) => e.operation_id))).toEqual(new Set(['logout-op-retry']));
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });

  it('a refreshed credential that is refused again leaves the sign-out pending after one refresh, without looping', async () => {
    const w = world();
    const session = w.make({ operationId: () => 'logout-op-refused' });
    await session.signIn();
    const command = w.service.sessionCommand.bind(w.service);
    let attempts = 0;
    w.service.sessionCommand = async () => {
      attempts += 1;
      throw new ServiceError('unauthenticated', true, 401);
    };
    const refreshesBefore = w.service.calls.filter((name) => name === 'refresh').length;
    const first = await session.signOut();
    expect(first).toMatchObject({ ok: false, reason: REASONS.logoutPending, status: { identity: { state: 'blocked', reason: REASONS.logoutPending }, sharedService: 'available' } });
    // One send, one refresh, one resend: bounded.
    expect(attempts).toBe(2);
    expect(w.service.calls.filter((name) => name === 'refresh').length - refreshesBefore).toBe(1);
    expect(session.holdsSession()).toBe(true);
    expect(w.service.current()!.revoked).toBe(false);
    // The operation and its ID survive, and the service confirms it once it accepts the credential.
    w.service.sessionCommand = command;
    const second = await session.signOut();
    expect(second).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.current()!.revoked).toBe(true);
    expect(w.service.logoutEnvelopes.map((e) => e.operation_id)).toEqual(['logout-op-refused']);
  });

  it('a first unauthorized attempt with an unavailable refresh stays pending with its operation ID, then the retry confirms it', async () => {
    let now = Date.now();
    const w = world('gnome_libsecret', { now: () => now });
    const session = w.make({ operationId: () => 'logout-op-r02' });
    await session.signIn();
    const command = w.service.sessionCommand.bind(w.service);
    w.service.sessionCommand = async (access, envelope) => {
      // The access credential expires after the logout was prepared, before the
      // command arrives, and the refresh that follows cannot be attempted.
      now = w.service.current()!.accessExpiresAt + 1;
      w.service.refreshOutcome = 'dependency';
      w.service.sessionCommand = command;
      return command(access, envelope);
    };
    const first = await session.signOut();
    expect(first).toMatchObject({ ok: false, reason: REASONS.logoutPending, status: { identity: { state: 'blocked', reason: REASONS.logoutPending }, sharedService: 'unavailable' } });
    // Nothing was revoked, and the service still accepts the family.
    expect(w.service.current()!.revoked).toBe(false);
    expect(w.service.revokedWith).toEqual([]);
    expect(session.holdsSession()).toBe(true);
    // The operation survives a restart with its ID.
    const restarted = w.make({ operationId: () => 'logout-op-other' });
    expect(restarted.snapshot().identity).toEqual({ state: 'blocked', reason: REASONS.logoutPending });
    // The retry refreshes, resends the same operation, and the service confirms it.
    const second = await restarted.signOut();
    expect(second).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.logoutEnvelopes.map((e) => e.operation_id)).toEqual(['logout-op-r02', 'logout-op-r02']);
    expect(w.service.current()!.revoked).toBe(true);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });

  it('an expired access credential with an unavailable refresh while preparing is not reported as signed out', async () => {
    let now = Date.now();
    const w = world('gnome_libsecret', { now: () => now });
    const session = w.make();
    await session.signIn();
    now = w.service.current()!.accessExpiresAt + 1;
    const refresh = w.service.refresh.bind(w.service);
    w.service.refresh = async () => {
      throw new ServiceError('dependency_unavailable', true, 503);
    };
    const result = await session.signOut();
    expect(result).toMatchObject({ ok: false, reason: REASONS.signOutUnavailable, status: { identity: { state: 'signed-in' } } });
    expect(w.service.current()!.revoked).toBe(false);
    expect(session.holdsSession()).toBe(true);
    // Once the refresh works again, sign-out completes normally.
    w.service.refresh = refresh;
    expect(await session.signOut()).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    expect(w.service.current()!.revoked).toBe(true);
  });

  it('local data deletion then says revocation was not confirmed', async () => {
    let now = Date.now();
    const w = world('gnome_libsecret', { now: () => now });
    const session = w.make();
    await session.signIn();
    const command = w.service.sessionCommand.bind(w.service);
    w.service.sessionCommand = async (access, envelope) => {
      now = w.service.current()!.accessExpiresAt + 1;
      w.service.refreshOutcome = 'dependency';
      w.service.sessionCommand = command;
      return command(access, envelope);
    };
    const userData = tempDir('identity-data');
    const load = loadShippedPolicy();
    const data = new DataService({
      load,
      roots: governedRoots(userData, path.join(userData, 'logs')),
      journal: new ExportJournal(userData),
      runtime: { stop: async () => undefined, start: async () => undefined, activeTasks: () => 0 },
      identity: {
        principal: async () => null,
        holdsSession: () => session.holdsSession(),
        signOut: async () => ({ ok: (await session.signOut()).ok }),
        forgetLocally: () => session.forgetLocally(),
      },
      providers: { forgetClaudeKey: () => undefined, holdsClaudeKey: () => false },
      chooseExportDestination: async () => null,
      chooseImportSource: async () => null,
      clearBrowserProfile: async () => undefined,
      appVersion: '0',
      runtimeVersion: '0',
      logger: recordingLogger(),
    });
    const result = await data.deleteData(['identity-session']);
    if (!result.ok) throw new Error(result.reason);
    expect(result.delete.serverRevocation).toBe('not-confirmed');
    expect(result.delete.removed[0]!.note).toMatch(/could not confirm the revocation/);
    expect(w.service.current()!.revoked).toBe(false);
    expect(session.holdsSession()).toBe(false);
  });
});

describe('local removal during a sign-in (review R04)', () => {
  /** Holds the first bootstrap until released. */
  function gateBootstrap(w: World): { reached: Promise<void>; release(): void; restore(): void } {
    const bootstrap = w.service.bootstrap.bind(w.service);
    let entered!: () => void;
    const reached = new Promise<void>((resolve) => (entered = resolve));
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    w.service.bootstrap = async (request) => {
      w.service.bootstrap = bootstrap;
      entered();
      await gate;
      return bootstrap(request);
    };
    return { reached, release, restore: () => (w.service.bootstrap = bootstrap) };
  }

  it.each([
    ['local removal', (session: IdentitySession) => session.forgetLocally()],
    ['sign-out', (session: IdentitySession) => void session.signOut()],
  ])('%s: the late result is never installed or saved, and its server session is revoked', async (_label, remove) => {
    const w = world();
    const session = w.make();
    const gate = gateBootstrap(w);
    const pending = session.signIn();
    await gate.reached;
    expect(session.snapshot().identity).toEqual({ state: 'signing-in' });
    remove(session);
    expect(session.snapshot().identity).toEqual({ state: 'signed-out' });
    gate.release();
    expect(await pending).toMatchObject({ ok: false, reason: REASONS.cancelled, status: { identity: { state: 'signed-out' } } });
    expect(session.holdsSession()).toBe(false);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
    expect(w.make().snapshot().identity).toEqual({ state: 'signed-out' });
    expect(w.service.calls).toContain('abandon');
    expect(w.service.current()!.revoked).toBe(true);
    // A deliberately new sign-in afterwards works.
    expect(await session.signIn()).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' } } });
    expect(w.make().snapshot().identity).toMatchObject({ state: 'signed-in' });
    expect(w.service.current()!.revoked).toBe(false);
  });

  it('a new sign-in started after the removal wins over the old one finishing late', async () => {
    const w = world();
    const session = w.make();
    const gate = gateBootstrap(w);
    const old = session.signIn();
    await gate.reached;
    session.forgetLocally();
    const fresh = await session.signIn();
    expect(fresh).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' } } });
    const kept = w.service.current()!;
    gate.release();
    expect(await old).toMatchObject({ ok: false, reason: REASONS.cancelled, status: { identity: { state: 'signed-in' } } });
    // The old sign-in's session is revoked; the new one is kept and saved.
    expect(w.service.sessions).toHaveLength(2);
    expect(w.service.sessions.find((s) => s.sessionId !== kept.sessionId)!.revoked).toBe(true);
    expect(kept.revoked).toBe(false);
    const saved = new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: w.dir }).load();
    expect(saved).toMatchObject({ sessionId: kept.sessionId, accessCredential: kept.access });
  });

  it('cancelling a sign-in that waits for the browser releases the fixed callback port at once', async () => {
    const port = await freePort();
    const w = world();
    const { opener } = fakeOpener(w.issuer);
    let silent = true;
    let opened!: () => void;
    const reached = new Promise<void>((resolve) => (opened = resolve));
    const session = w.make({
      config: { kind: 'configured', config: { ...CONFIG, callbackPort: port } },
      callbackTimeoutMs: 60_000,
      // The first browser never returns to the callback; later ones follow the sign-in normally.
      openBrowser: async (url: string) => {
        if (silent) {
          opened();
          return;
        }
        return opener(url);
      },
    });
    const pending = session.signIn();
    await reached;
    expect(session.snapshot().identity).toEqual({ state: 'signing-in' });
    await session.signOut();
    // The cancelled attempt ends now, not when the callback timeout passes.
    expect(await pending).toMatchObject({ ok: false, reason: REASONS.cancelled, status: { identity: { state: 'signed-out' } } });
    // The fixed port is free again, so a new sign-in works immediately.
    silent = false;
    expect(await session.signIn()).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' } } });
  });

  it.each([
    ['issuer discovery', 'discover'],
    ['the login transaction', 'transaction'],
  ] as const)('a sign-in cancelled during %s never opens the browser or keeps the fixed callback port', async (_label, stage) => {
    const port = await freePort();
    const w = world();
    const { opener } = fakeOpener(w.issuer);
    let browsers = 0;
    let reached!: () => void;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (reached = resolve));
    const gate = new Promise<void>((resolve) => (release = resolve));
    const discover = w.issuer.discover.bind(w.issuer);
    const create = w.service.createLoginTransaction.bind(w.service);
    if (stage === 'discover') w.issuer.discover = async () => { reached(); await gate; return discover(); };
    else w.service.createLoginTransaction = async (request) => { const transaction = await create(request); reached(); await gate; return transaction; };
    const session = w.make({
      config: { kind: 'configured', config: { ...CONFIG, callbackPort: port } },
      callbackTimeoutMs: 60_000,
      openBrowser: async (url: string) => { browsers += 1; return opener(url); },
    });
    const pending = session.signIn();
    await held;
    await session.signOut();
    release();
    expect(await pending).toMatchObject({ ok: false, reason: REASONS.cancelled, status: { identity: { state: 'signed-out' } } });
    expect(browsers).toBe(0);
    if (stage === 'discover') expect(w.service.calls).not.toContain('createLoginTransaction');
    else expect(w.service.calls).toContain('abandon');
    // Nothing is left listening: a new sign-in on the same fixed port works at once.
    w.issuer.discover = discover;
    w.service.createLoginTransaction = create;
    expect(await session.signIn()).toMatchObject({ ok: true, status: { identity: { state: 'signed-in' } } });
    expect(browsers).toBe(1);
  });
});

describe('vault save failure (review R05)', () => {
  /** Makes the real vault's writes into `dir` fail with ENOSPC while `failing()` holds. */
  function failWrites(dir: string, failing: () => boolean): void {
    const real = fs.writeFileSync;
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args: Parameters<typeof real>) => {
      if (failing() && String(args[0]).startsWith(dir)) throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
      return real(...args);
    });
  }

  it('a failed save after rotation removes the stale record, says memory-only, and a restart retries nothing stale', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    const old = w.service.current()!.refresh;
    let failing = true;
    failWrites(w.dir, () => failing);
    expect(await session.refreshNow()).toBe(true);
    expect(w.service.current()!.refresh).not.toBe(old);
    expect(session.snapshot()).toMatchObject({ identity: { state: 'signed-in' }, credentialStorage: 'memory-only' });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
    expect(w.logger.messages.join('\n')).toMatch(/could not be saved/);
    // A restart finds no stale credential to retry, so the family is not burnt by reuse detection.
    const restarted = w.make();
    expect(restarted.snapshot().identity).toEqual({ state: 'signed-out' });
    await restarted.getStatus();
    expect(w.service.current()!.revoked).toBe(false);
    // The running session keeps working; the next successful save is reported again.
    failing = false;
    expect(await session.refreshNow()).toBe(true);
    expect(session.snapshot().credentialStorage).toBe('os-backed');
    const saved = new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: w.dir }).load();
    expect(saved).toMatchObject({ refreshCredential: w.service.current()!.refresh });
  });

  it('a failed save of a pending logout leaves nothing a restart could resurrect, and the retry still finishes', async () => {
    const w = world();
    const session = w.make({ operationId: () => 'logout-op-save' });
    await session.signIn();
    w.service.loseLogoutResponse = true;
    let failing = true;
    failWrites(w.dir, () => failing);
    const result = await session.signOut();
    expect(result).toMatchObject({ ok: false, reason: REASONS.logoutPending, status: { identity: { state: 'blocked' }, credentialStorage: 'memory-only' } });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
    // A restart does not come back signed in with the session the user asked to end.
    expect(w.make().snapshot().identity).toEqual({ state: 'signed-out' });
    failing = false;
    // This run still retries the same operation and finishes.
    expect((await session.getStatus()).identity).toEqual({ state: 'signed-out' });
    expect(w.service.logoutEnvelopes.map((e) => e.operation_id)).toEqual(['logout-op-save', 'logout-op-save']);
    expect(w.service.current()!.revoked).toBe(true);
    expect(session.snapshot().credentialStorage).toBe('os-backed');
  });
});

describe('bootstrap response lost', () => {
  it('abandons the transaction (revoking the session it created) and asks for a new sign-in', async () => {
    const w = world();
    w.service.loseBootstrapResponse = true;
    const session = w.make();
    const result = await session.signIn();
    expect(result).toMatchObject({ ok: false, reason: REASONS.interrupted, status: { identity: { state: 'signed-out' } } });
    expect(w.service.calls.filter((c) => c === 'bootstrap')).toHaveLength(1);
    expect(w.service.calls).toContain('abandon');
    expect(w.service.current()!.revoked).toBe(true);
    // A fresh sign-in works.
    expect(await session.signIn()).toMatchObject({ ok: true });
  });
});

describe('renderer probe', () => {
  it('status and results carry no credential, proof, code or token', async () => {
    const w = world();
    const session = w.make();
    const results = [await session.signIn(), await session.getStatus(), await session.signOut()];
    const text = JSON.stringify(results.map((r) => ('ok' in r ? toRendererResult(r) : toRendererStatus(r))));
    const secrets = session.knownSecrets();
    expect(secrets.length).toBeGreaterThanOrEqual(6);
    for (const secret of secrets) expect(text.includes(secret)).toBe(false);
    // Logs carry none either.
    const logs = w.logger.messages.join('\n');
    for (const secret of secrets) expect(logs.includes(secret)).toBe(false);
  });
});

describe('configuration', () => {
  it('not configured: nothing is contacted', async () => {
    const config: ConfigResult = { kind: 'not-configured' };
    const session = new IdentitySession({
      config,
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: tempDir('identity') }),
      openBrowser: async () => {
        throw new Error('must not open');
      },
      logger: recordingLogger(),
    });
    expect(await session.getStatus()).toEqual({
      identity: { state: 'signed-out' },
      sharedService: 'not-configured',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    });
    expect(await session.signIn()).toMatchObject({ ok: false, reason: REASONS.notConfigured });
    expect(await session.signOut()).toMatchObject({ ok: true });
  });

  it('an invalid configuration blocks the identity', async () => {
    const session = new IdentitySession({
      config: { kind: 'invalid', reason: 'bad' },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage(null), platform: 'linux', dir: tempDir('identity') }),
      openBrowser: async () => undefined,
      logger: recordingLogger(),
    });
    expect(await session.getStatus()).toMatchObject({ identity: { state: 'blocked', reason: REASONS.configInvalid }, sharedService: 'not-configured' });
    expect(await session.signIn()).toMatchObject({ ok: false, reason: REASONS.configInvalid });
  });
});

describe('local data deletion support (Story 1.12)', () => {
  it('forgetLocally drops the session from memory and the vault without contacting the service', async () => {
    const w = world();
    const session = w.make();
    await session.signIn();
    expect(session.holdsSession()).toBe(true);
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(true);
    w.service.down = true;
    expect((await session.signOut()).ok).toBe(false);
    session.forgetLocally();
    expect(session.holdsSession()).toBe(false);
    expect(session.snapshot().identity).toEqual({ state: 'signed-out' });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
    // A later status check does not bring it back.
    w.service.down = false;
    expect((await session.getStatus()).identity).toEqual({ state: 'signed-out' });
    expect(fs.existsSync(path.join(w.dir, SESSION_FILE))).toBe(false);
  });
});


describe('bounded fresh execution-policy reads', () => {
  const workspace = '11111111-1111-4111-8111-111111111111';
  const policy = { workspace_id: workspace, authorization_epoch: '1', policy_revision: '1', execution: null };
  const gate = () => { let release!: () => void; const promise = new Promise<void>(resolve => { release = resolve; }); return {promise, release}; };

  it('allows four GETs, bounds the waiting queue, and recovers every permit', async () => {
    const w = world(), session = w.make(); await session.signIn(); const held = gate(); let active=0, peak=0;
    const read = vi.spyOn(w.service, 'executionPolicy').mockImplementation(async () => { active++; peak=Math.max(peak,active); await held.promise; active--; return policy; });
    const reads = Array.from({length:37}, () => session.readExecutionPolicy(workspace));
    await waitFor(() => read.mock.calls.length === 4); expect(await reads[36]).toBeNull(); expect(peak).toBe(4);
    held.release(); expect((await Promise.all(reads)).filter(Boolean)).toHaveLength(36); expect(peak).toBe(4);
    expect(await session.readExecutionPolicy(workspace)).toEqual(policy); expect(read).toHaveBeenCalledTimes(37);
  });

  it('releases permits after endpoint errors without retrying a denial', async () => {
    const w = world(), session = w.make(); await session.signIn();
    const read = vi.spyOn(w.service, 'executionPolicy').mockRejectedValue(new ServiceError('denied',true,403));
    const results = await Promise.allSettled(Array.from({length:36},()=>session.readExecutionPolicy(workspace)));
    expect(results.every(r=>r.status==='rejected')).toBe(true); expect(read).toHaveBeenCalledTimes(36);
    read.mockResolvedValue(policy); expect(await session.readExecutionPolicy(workspace)).toEqual(policy);
  });

  it('serializes one expiry rotation across concurrent fresh GETs', async () => {
    let now=Date.now(); const w=world('gnome_libsecret',{now:()=>now}), session=w.make(); await session.signIn(); now+=15*60_000;
    const read=vi.spyOn(w.service,'executionPolicy').mockResolvedValue(policy);
    expect(await Promise.all(Array.from({length:4},()=>session.readExecutionPolicy(workspace)))).toEqual(Array(4).fill(policy));
    expect(w.service.calls.filter(c=>c==='refresh')).toHaveLength(1);
    expect(read.mock.calls.every(([access])=>access===w.service.current()!.access)).toBe(true);
  });

  it('coalesces concurrent old-token 401s into one rotation, not four', async () => {
    const w=world(), session=w.make(); await session.signIn(); const old=w.service.current()!.access, held=gate();
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementation(async access=>{if(access===old){await held.promise;throw new ServiceError('unauthenticated',true,401);}return policy;});
    const reads=Array.from({length:4},()=>session.readExecutionPolicy(workspace));await waitFor(()=>read.mock.calls.length===4);held.release();
    expect(await Promise.all(reads)).toEqual(Array(4).fill(policy));expect(w.service.calls.filter(c=>c==='refresh')).toHaveLength(1);expect(read).toHaveBeenCalledTimes(8);
  });

  it('uses an already rotated token after a late 401 and stops after a second 401', async () => {
    const w=world(), session=w.make();await session.signIn();const old=w.service.current()!.access,held=gate();
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementation(async access=>{if(access===old)await held.promise;throw new ServiceError('unauthenticated',true,401);});
    const pending=session.readExecutionPolicy(workspace);const rejected=expect(pending).rejects.toBeInstanceOf(ServiceError);await waitFor(()=>read.mock.calls.length===1);
    expect(await session.refreshNow()).toBe(true);held.release();await rejected;
    expect(w.service.calls.filter(c=>c==='refresh')).toHaveLength(1);expect(read).toHaveBeenCalledTimes(2);
  });

  it.each(['dependency','lost','reuse'] as const)('does not dispatch a near-expiry read after %s refresh failure', async outcome=>{
    let now=Date.now();const w=world('gnome_libsecret',{now:()=>now}),session=w.make();await session.signIn();now+=15*60_000;w.service.refreshOutcome=outcome;
    const read=vi.spyOn(w.service,'executionPolicy').mockResolvedValue(policy);
    expect(await session.readExecutionPolicy(workspace)).toBeNull();expect(read).not.toHaveBeenCalled();
    expect(w.service.calls.filter(c=>c==='refresh')).toHaveLength(1);
  });

  it('suppresses queued reads and late success after logout, including same-principal sign-in', async () => {
    const w=world(),session=w.make();await session.signIn();const principal=session.principalId(),held=gate();
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementation(async()=>{await held.promise;return policy;});
    const pending=Array.from({length:8},()=>session.readExecutionPolicy(workspace));await waitFor(()=>read.mock.calls.length===4);
    expect((await session.signOut()).ok).toBe(true);
    // The default fake mints a different principal per login. Model a new
    // session for the same principal explicitly, including its service view.
    const bootstrap=w.service.bootstrap.bind(w.service);vi.spyOn(w.service,'bootstrap').mockImplementation(async request=>{const credentials=await bootstrap(request);w.service.current()!.principalId=principal!;return{...credentials,principal_id:principal!};});
    await session.signIn();expect(session.principalId()).toBe(principal);
    held.release();expect(await Promise.all(pending)).toEqual(Array(8).fill(null));expect(read).toHaveBeenCalledTimes(4);
    expect(await session.readExecutionPolicy(workspace)).toEqual(policy);
  });

  it('does not publish a late failure into a replacement session', async () => {
    const w=world(),session=w.make();await session.signIn();const held=gate();
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementation(async()=>{await held.promise;throw new ServiceError('transport',true);});
    const pending=session.readExecutionPolicy(workspace);await waitFor(()=>read.mock.calls.length===1);session.forgetLocally();await session.signIn();
    expect(session.snapshot().sharedService).toBe('available');held.release();expect(await pending).toBeNull();expect(session.snapshot().sharedService).toBe('available');
  });

  it('leaves general request and explicit refresh serialization unchanged', async () => {
    const w=world(),session=w.make();await session.signIn();const held=gate(),entered:string[]=[];
    const first=session.withAccess(async()=>{entered.push('first');await held.promise;return 1;});
    const second=session.withAccess(async()=>{entered.push('second');return 2;});await waitFor(()=>entered.length===1);expect(entered).toEqual(['first']);held.release();
    expect(await Promise.all([first,second])).toEqual([1,2]);expect(entered).toEqual(['first','second']);
  });
});


describe('concurrent policy availability ordering', () => {
  const workspace='11111111-1111-4111-8111-111111111111';
  const policy={workspace_id:workspace,authorization_epoch:'1',policy_revision:'1',execution:null};
  it.each(['policy','serialized'] as const)('does not overwrite a later %s failure with an old GET success',async source=>{
    const w=world(),session=w.make();await session.signIn();let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementationOnce(async()=>{await gate;return policy;}).mockRejectedValue(new ServiceError('transport',true));
    const old=session.readExecutionPolicy(workspace);await waitFor(()=>read.mock.calls.length===1);
    const failed=source==='policy'?session.readExecutionPolicy(workspace):session.withAccess(async()=>{throw new ServiceError('transport',true);});
    await expect(failed).rejects.toBeInstanceOf(ServiceError);expect(session.snapshot().sharedService).toBe('unavailable');release();expect(await old).toEqual(policy);expect(session.snapshot().sharedService).toBe('unavailable');
    read.mockResolvedValue(policy);expect(await session.readExecutionPolicy(workspace)).toEqual(policy);expect(session.snapshot().sharedService).toBe('available');
  });
});


describe('policy retry lifecycle races',()=>{
  const workspace='11111111-1111-4111-8111-111111111111';
  it('does not refresh or retry when logout supersedes a queued 401 retry',async()=>{
    const w=world(),session=w.make();await session.signIn();let rejectRead!:()=>void,releaseBlock!:()=>void;
    const response=new Promise<void>(resolve=>{rejectRead=resolve;}),block=new Promise<void>(resolve=>{releaseBlock=resolve;});
    const read=vi.spyOn(w.service,'executionPolicy').mockImplementation(async()=>{await response;throw new ServiceError('unauthenticated',true,401);});
    const pending=session.readExecutionPolicy(workspace);await waitFor(()=>read.mock.calls.length===1);let blocking=false;
    const mutation=session.withAccess(async()=>{blocking=true;await block;return true;});await waitFor(()=>blocking);
    rejectRead();await new Promise<void>(resolve=>setImmediate(resolve));const logout=session.signOut();releaseBlock();
    expect(await pending).toBeNull();expect(await mutation).toBe(true);expect((await logout).ok).toBe(true);
    expect(read).toHaveBeenCalledTimes(1);expect(w.service.calls.filter(c=>c==='refresh')).toHaveLength(0);
  });
  it('keeps a rotated policy credential memory-only when vault persistence fails',async()=>{
    let now=Date.now();const w=world('gnome_libsecret',{now:()=>now});const vault=new CredentialVault({safeStorage:fakeSafeStorage('gnome_libsecret'),platform:'linux',dir:w.dir});const session=w.make({vault});await session.signIn();
    vi.spyOn(vault,'save').mockImplementation(()=>{throw new Error('fixture vault failure');});now+=15*60_000;
    const policy={workspace_id:workspace,authorization_epoch:'1',policy_revision:'1',execution:null};vi.spyOn(w.service,'executionPolicy').mockResolvedValue(policy);
    expect(await session.readExecutionPolicy(workspace)).toEqual(policy);expect(session.snapshot().credentialStorage).toBe('memory-only');expect(fs.existsSync(path.join(w.dir,SESSION_FILE))).toBe(false);
  });
});
