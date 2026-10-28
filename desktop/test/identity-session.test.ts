/**
 * Story 1.10b: the identity session against fakes, one block per I/O-matrix
 * row (sign-in, wrong state, PKCE mismatch, untrusted certificate, OS store,
 * no OS store, refresh reuse, service down, self-logout lost, renderer probe),
 * plus the lost bootstrap response, refresh serialization and configuration.
 * The loopback listener and the vault are the real ones.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { SESSION_FILE, CredentialVault } from '../src/main/identity/vault';
import { IdentitySession, REASONS, toRendererResult, toRendererStatus, type IdentitySessionOptions } from '../src/main/identity/session';
import type { ConfigResult } from '../src/main/identity/config';
import { CONFIG, FakeIssuer, FakeService, fakeOpener, fakeSafeStorage, httpGet, type OpenerMode } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir, waitFor } from './helpers';

afterAll(() => removeTempDirs());

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
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.statSync(w.dir).mode & 0o777).toBe(0o700);
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
    const session = w.make({ callbackTimeoutMs: 600 });
    const pending = session.signIn();
    await waitFor(() => w.callbacks.length === 1);
    // The mismatched callback was refused with 400 and the listener kept waiting.
    expect(await httpGet(w.callbacks[0]!)).toBe(400);
    expect(session.snapshot().identity).toEqual({ state: 'signing-in' });
    expect((await session.getStatus()).identity).toEqual({ state: 'signing-in' });

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
    expect(w.service.current()!.rotated.has(oldRefresh)).toBe(true);
    expect(await session.getStatus()).toMatchObject({ identity: { state: 'signed-in' } });
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
