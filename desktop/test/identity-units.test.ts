/**
 * Story 1.10b building blocks: PKCE and state, the loopback listener, the
 * vault's fail-closed backend detection and file handling, and the dev config.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { httpsOrigin, loadServiceConfig, parseServiceConfig, SERVICE_CONFIG_ENV } from '../src/main/identity/config';
import { LoopbackError, startLoopbackListener } from '../src/main/identity/loopback';
import { createPkce, createState, isCodeVerifier, s256Challenge, secretEquals } from '../src/main/identity/pkce';
import { evaluateIdentity, type IdentityProbeRead } from '../src/main/smoke-probe';
import { CredentialVault, DEVICE_FILE, detectCredentialStorage, SESSION_FILE, type StoredSession } from '../src/main/identity/vault';
import { fakeSafeStorage, httpGet } from './identity-fakes';
import { removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());

describe('PKCE and state', () => {
  it('matches the RFC 7636 example', () => {
    expect(s256Challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('creates 43-character verifiers, S256 challenges and random states', () => {
    const a = createPkce();
    const b = createPkce();
    expect(a.verifier).toHaveLength(43);
    expect(isCodeVerifier(a.verifier)).toBe(true);
    expect(a.method).toBe('S256');
    expect(a.challenge).toBe(s256Challenge(a.verifier));
    expect(a.verifier).not.toBe(b.verifier);
    expect(createState()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createState()).not.toBe(createState());
  });

  it('bounds verifiers to 43–128 unreserved characters', () => {
    expect(isCodeVerifier('a'.repeat(42))).toBe(false);
    expect(isCodeVerifier('a'.repeat(128))).toBe(true);
    expect(isCodeVerifier('a'.repeat(129))).toBe(false);
    expect(isCodeVerifier(`${'a'.repeat(43)}+`)).toBe(false);
    expect(() => s256Challenge('short')).toThrow();
    expect(secretEquals('abc', 'abc')).toBe(true);
    expect(secretEquals('abc', 'abd')).toBe(false);
    expect(secretEquals('abc', 'abcd')).toBe(false);
  });
});

function request(url: string, options: { method?: string; host?: string } = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      { host: '127.0.0.1', port: target.port, path: `${target.pathname}${target.search}`, method: options.method ?? 'GET', headers: options.host ? { Host: options.host } : {} },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('loopback listener', () => {
  const ISSUER = 'https://issuer.synthetic.test';

  it('binds 127.0.0.1 on an ephemeral port at /callback and accepts exactly one matching callback', async () => {
    const listener = await startLoopbackListener({ state: 'the-state', issuer: ISSUER, timeoutMs: 5_000 });
    expect(listener.redirectUri).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
    const base = listener.redirectUri;
    // Everything that is not the matching callback is refused and the listener keeps waiting.
    expect(await httpGet(`${base}?code=c&state=wrong`)).toBe(400);
    expect(await httpGet(`${base}?code=c`)).toBe(400);
    expect(await httpGet(`${base.replace('/callback', '/other')}?code=c&state=the-state`)).toBe(400);
    expect(await request(`${base}?code=c&state=the-state`, { method: 'POST' })).toBe(400);
    expect(await request(`${base}?code=c&state=the-state`, { host: 'evil.example' })).toBe(400);
    expect(await httpGet(`${base}?code=c&state=the-state&state=the-state`)).toBe(400);

    expect(await httpGet(`${base}?code=the-code&state=the-state&iss=${encodeURIComponent(ISSUER)}`)).toBe(200);
    await expect(listener.callback).resolves.toEqual({ code: 'the-code' });
    // Closed after the one callback: a replay finds nothing listening.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(httpGet(`${base}?code=the-code&state=the-state`)).rejects.toThrow();
  });

  it.each([
    ['an issuer error', 'error=access_denied', 'denied'],
    ['another issuer', `code=c&iss=${encodeURIComponent('https://other.test')}`, 'issuer-mismatch'],
    ['no code', '', 'malformed'],
  ])('fails on %s with the matching state', async (_label, query, failure) => {
    const listener = await startLoopbackListener({ state: 's', issuer: ISSUER, timeoutMs: 5_000 });
    expect(await httpGet(`${listener.redirectUri}?state=s${query ? `&${query}` : ''}`)).toBe(200);
    const error = await listener.callback.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LoopbackError);
    expect((error as LoopbackError).failure).toBe(failure);
  });

  it('times out and closes', async () => {
    const listener = await startLoopbackListener({ state: 's', issuer: ISSUER, timeoutMs: 150 });
    const error = await listener.callback.catch((e: unknown) => e);
    expect((error as LoopbackError).failure).toBe('timeout');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(httpGet(`${listener.redirectUri}?code=c&state=s`)).rejects.toThrow();
  });

  it('close() rejects a pending callback', async () => {
    const listener = await startLoopbackListener({ state: 's', issuer: ISSUER, timeoutMs: 5_000 });
    listener.close();
    expect(((await listener.callback.catch((e: unknown) => e)) as LoopbackError).failure).toBe('closed');
  });
});

const record = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  version: 1,
  serviceUrl: 'https://service.synthetic.test',
  issuer: 'https://issuer.synthetic.test',
  deviceId: '6f1c2b9e-3d4a-4e5f-8a7b-1c2d3e4f5a6b',
  sessionId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  principalId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  displayName: 'Alice Synthetic',
  accessCredential: 'iqa_access-secret-value',
  accessExpiresAt: '2026-10-28T12:15:00.000Z',
  refreshCredential: 'iqr_refresh-secret-value',
  refreshExpiresAt: '2026-10-29T12:00:00.000Z',
  sessionExpiresAt: '2026-11-27T12:00:00.000Z',
  pendingLogout: null,
  ...overrides,
});

describe('vault', () => {
  it.each<[NodeJS.Platform, string | null, boolean, string]>([
    ['linux', 'gnome_libsecret', true, 'os-backed'],
    ['linux', 'kwallet5', true, 'os-backed'],
    ['linux', 'kwallet6', true, 'os-backed'],
    ['linux', 'basic_text', true, 'memory-only'],
    ['linux', 'unknown', true, 'memory-only'],
    ['linux', null, true, 'memory-only'],
    ['linux', 'gnome_libsecret', false, 'memory-only'],
    ['darwin', null, true, 'os-backed'],
    ['win32', null, true, 'os-backed'],
    ['darwin', null, false, 'memory-only'],
    ['freebsd', 'gnome_libsecret', true, 'memory-only'],
  ])('%s with backend %s (encryption %s) is %s', (platform, backend, available, expected) => {
    expect(detectCredentialStorage(fakeSafeStorage(backend, available), platform)).toBe(expected);
  });

  it('fails closed when backend detection throws', () => {
    const throwing = { ...fakeSafeStorage('gnome_libsecret'), getSelectedStorageBackend: () => { throw new Error('not ready'); } };
    expect(detectCredentialStorage(throwing, 'linux')).toBe('memory-only');
  });

  it('os-backed: writes an encrypted 0600 file in a 0700 directory and reads it back', () => {
    const dir = path.join(tempDir('vault'), 'identity');
    const safeStorage = fakeSafeStorage('gnome_libsecret');
    const vault = new CredentialVault({ safeStorage, platform: 'linux', dir });
    expect(vault.storage).toBe('os-backed');
    const deviceId = vault.deviceId();
    expect(vault.deviceId()).toBe(deviceId);
    vault.save(record());
    const file = path.join(dir, SESSION_FILE);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.join(dir, DEVICE_FILE)).mode & 0o777).toBe(0o600);
    expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
    const bytes = fs.readFileSync(file);
    expect(bytes.includes(Buffer.from('iqa_access-secret-value'))).toBe(false);
    expect(bytes.includes(Buffer.from('iqr_refresh-secret-value'))).toBe(false);
    expect(safeStorage.encrypted).toBe(1);
    expect(new CredentialVault({ safeStorage, platform: 'linux', dir }).load()).toEqual(record());
    expect(fs.readdirSync(dir).sort()).toEqual([DEVICE_FILE, SESSION_FILE].sort());
    vault.clear();
    expect(fs.existsSync(file)).toBe(false);
  });

  it('discards a file that does not decrypt to a session record', () => {
    const dir = tempDir('vault');
    const vault = new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir });
    fs.writeFileSync(path.join(dir, SESSION_FILE), 'garbage');
    expect(vault.load()).toBeNull();
    expect(fs.existsSync(path.join(dir, SESSION_FILE))).toBe(false);
  });

  it('memory-only: never touches the disk', () => {
    const dir = path.join(tempDir('vault'), 'identity');
    const vault = new CredentialVault({ safeStorage: fakeSafeStorage('basic_text'), platform: 'linux', dir });
    expect(vault.storage).toBe('memory-only');
    vault.deviceId();
    vault.save(record());
    expect(vault.load()).toEqual(record());
    expect(fs.existsSync(dir)).toBe(false);
    vault.clear();
    expect(vault.load()).toBeNull();
  });
});

describe('dev config', () => {
  const ca = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
  const valid = {
    service_url: 'https://127.0.0.1:4443',
    issuer_url: 'https://127.0.0.1:4444',
    issuer_label: 'Synthetic test issuer',
    ca_path: '/ca.pem',
    client_id: 'inquello-desktop-synthetic',
  };
  const parse = (value: unknown, file = ca) => parseServiceConfig(JSON.stringify(value), () => file);

  it('parses the topology line', () => {
    expect(parse(valid)).toEqual({
      kind: 'configured',
      config: {
        serviceUrl: 'https://127.0.0.1:4443',
        issuerUrl: 'https://127.0.0.1:4444',
        issuerLabel: 'Synthetic test issuer',
        ca,
        clientId: 'inquello-desktop-synthetic',
      },
    });
  });

  it.each([
    ['plain http', { ...valid, service_url: 'http://127.0.0.1:4443' }],
    ['a path', { ...valid, issuer_url: 'https://127.0.0.1:4444/tenant' }],
    ['user info', { ...valid, service_url: 'https://u:p@127.0.0.1:4443' }],
    ['an extra key', { ...valid, extra: true }],
    ['a missing key', { ...valid, client_id: undefined }],
    ['an empty label', { ...valid, issuer_label: ' ' }],
  ])('refuses %s', (_label, value) => {
    expect(parse(value).kind).toBe('invalid');
  });

  it('refuses a CA file that is not a certificate or holds a key', () => {
    expect(parse(valid, 'not a pem').kind).toBe('invalid');
    expect(parse(valid, `${ca}-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----\n`).kind).toBe('invalid');
    expect(parseServiceConfig(JSON.stringify(valid), () => { throw new Error('missing'); }).kind).toBe('invalid');
    expect(parseServiceConfig('{', () => ca).kind).toBe('invalid');
  });

  it('reads the file named by the environment, and nothing without it', () => {
    expect(loadServiceConfig({})).toEqual({ kind: 'not-configured' });
    expect(loadServiceConfig({ [SERVICE_CONFIG_ENV]: '' })).toEqual({ kind: 'not-configured' });
    const dir = tempDir('config');
    fs.writeFileSync(path.join(dir, 'ca.pem'), ca);
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({ ...valid, ca_path: path.join(dir, 'ca.pem') }));
    expect(loadServiceConfig({ [SERVICE_CONFIG_ENV]: path.join(dir, 'config.json') }).kind).toBe('configured');
    expect(loadServiceConfig({ [SERVICE_CONFIG_ENV]: path.join(dir, 'missing.json') }).kind).toBe('invalid');
  });

  it('httpsOrigin accepts only bare https origins', () => {
    expect(httpsOrigin('https://127.0.0.1:4443/')).toBe('https://127.0.0.1:4443');
    expect(httpsOrigin('https://127.0.0.1:4443?x')).toBeNull();
    expect(httpsOrigin('ftp://x')).toBeNull();
    expect(httpsOrigin(42)).toBeNull();
  });
});

describe('smoke identity evaluation', () => {
  const status = (state: string, extra: Record<string, unknown> = {}) => ({
    identity: { state, ...(state === 'signed-in' ? { displayName: 'Synthetic Developer', issuerLabel: 'Synthetic test issuer' } : {}) },
    sharedService: 'available',
    credentialStorage: 'os-backed',
    privateWork: 'local',
    ...extra,
  });
  const dom = (identity: string, sharedService = 'available') => ({ identity, sharedService, credentialStorage: 'os-backed', privateWork: 'local', text: '' });
  const clean: IdentityProbeRead = {
    configured: true,
    status: status('signed-out'),
    dom: dom('signed-out'),
    signIn: { pressed: true, reached: true },
    afterSignIn: status('signed-in'),
    domAfterSignIn: dom('signed-in'),
    vault: { exists: true, mode: 0o600, dirMode: 0o700, plaintextSecrets: 0 },
    signOut: { pressed: true, reached: true },
    afterSignOut: status('signed-out'),
    domAfterSignOut: dom('signed-out'),
    vaultAfterSignOut: { exists: false },
    secretsChecked: 8,
    rendererLeaks: 0,
  };

  it('passes a clean configured run', () => {
    expect(evaluateIdentity(clean)).toMatchObject({ ok: true, failures: [] });
  });

  it.each<[string, Partial<IdentityProbeRead>]>([
    ['memory-only storage', { afterSignIn: status('signed-in', { credentialStorage: 'memory-only' }) }],
    ['a plaintext secret in the file', { vault: { exists: true, mode: 0o600, dirMode: 0o700, plaintextSecrets: 1 } }],
    ['a world-readable file', { vault: { exists: true, mode: 0o644, dirMode: 0o700, plaintextSecrets: 0 } }],
    ['no file', { vault: { exists: false, mode: null, dirMode: null, plaintextSecrets: 0 } }],
    ['a renderer leak', { rendererLeaks: 1 }],
    ['too few secrets checked', { secretsChecked: 2 }],
    ['sign-in not reached', { signIn: { pressed: true, reached: false } }],
    ['the service unavailable after sign-in', { afterSignIn: status('signed-in', { sharedService: 'unavailable' }) }],
    ['the file left after sign-out', { vaultAfterSignOut: { exists: true } }],
    ['private work not local', { status: status('signed-out', { privateWork: 'shared' }) }],
  ])('fails on %s', (_label, change) => {
    expect(evaluateIdentity({ ...clean, ...change }).ok).toBe(false);
  });

  it('without a configuration requires not-configured and signed-out', () => {
    const unconfigured: IdentityProbeRead = {
      configured: false,
      status: status('signed-out', { sharedService: 'not-configured' }),
      dom: dom('signed-out', 'not-configured'),
      secretsChecked: 0,
      rendererLeaks: 0,
    };
    expect(evaluateIdentity(unconfigured).ok).toBe(true);
    expect(evaluateIdentity({ ...unconfigured, status: status('signed-out') }).ok).toBe(false);
  });
});
