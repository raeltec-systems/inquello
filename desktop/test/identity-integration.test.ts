/**
 * Story 1.10b end to end: spawns the built `inquello-dev-topology` (the shared
 * service and the synthetic OIDC provider on HTTPS with an ephemeral CA, on a
 * fresh PostgreSQL 18 database) and drives the real desktop identity session
 * with the headless opener: sign-in, refresh, logout, PKCE mismatch, an
 * untrusted certificate, refresh reuse and the topology going down.
 *
 * Needs `INQUELLO_TEST_DATABASE_URL` (skipped without it) and the binary built
 * with `cargo build -p inquello-service --features test-issuer --bin
 * inquello-dev-topology` (or `INQUELLO_DEV_TOPOLOGY_BIN`).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import tls from 'node:tls';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadServiceConfig, SERVICE_CONFIG_ENV, type ServiceConfig } from '../src/main/identity/config';
import { headlessOpener } from '../src/main/identity/headless-opener';
import { startLoopbackListener } from '../src/main/identity/loopback';
import { createPkce, createState } from '../src/main/identity/pkce';
import { IssuerClient, IssuerError, ServiceError, SharedServiceClient, httpsTransport } from '../src/main/identity/service-client';
import { IdentitySession } from '../src/main/identity/session';
import { CredentialVault } from '../src/main/identity/vault';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const binary =
  process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(desktop, '..', 'engine', 'codex-rs', 'target', 'debug', process.platform === 'win32' ? 'inquello-dev-topology.exe' : 'inquello-dev-topology');
const databaseConfigured = Boolean(process.env.INQUELLO_TEST_DATABASE_URL || process.env.INQUELLO_DEV_DATABASE_URL);

let topology: ChildProcess | undefined;
let config: ServiceConfig;

async function startTopology(): Promise<ServiceConfig> {
  if (!fs.existsSync(binary)) throw new Error(`build the dev topology first: ${binary} is missing`);
  topology = spawn(binary, ['--exit-on-stdin-eof'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const lines = readline.createInterface({ input: topology.stdout! });
  const line = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('the topology printed nothing')), 60_000);
    lines.once('line', (text) => {
      clearTimeout(timer);
      resolve(text);
    });
    topology!.once('exit', (code) => reject(new Error(`the topology exited (${code})`)));
  });
  const file = path.join(tempDir('topology-config'), 'config.json');
  fs.writeFileSync(file, line);
  const loaded = loadServiceConfig({ [SERVICE_CONFIG_ENV]: file });
  if (loaded.kind !== 'configured') throw new Error(`the topology line is not a valid config: ${JSON.stringify(loaded)}`);
  return loaded.config;
}

async function stopTopology(): Promise<number | null> {
  const child = topology;
  topology = undefined;
  if (!child || child.exitCode !== null) return child?.exitCode ?? null;
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  child.stdin!.end();
  return exited;
}

function session(dir = tempDir('identity-int')) {
  const logger = recordingLogger();
  const transport = httpsTransport(config.ca);
  const identity = new IdentitySession({
    config: { kind: 'configured', config },
    vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir }),
    service: new SharedServiceClient(config.serviceUrl, transport),
    issuer: new IssuerClient(config.issuerUrl, transport),
    openBrowser: headlessOpener(transport),
    logger,
    recordSecrets: true,
  });
  return { identity, logger, dir, service: new SharedServiceClient(config.serviceUrl, transport) };
}

/** Reads the current credentials straight from the vault file (as main could). */
function stored(dir: string) {
  return new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir }).load();
}

describe.skipIf(!databaseConfigured)('identity against the dev topology', () => {
  beforeAll(async () => {
    config = await startTopology();
  }, 90_000);

  afterAll(async () => {
    await stopTopology();
    removeTempDirs();
  });

  it('signs in over HTTPS, refreshes with rotation and logs out', async () => {
    const { identity, logger, dir, service } = session();
    expect(await identity.getStatus()).toEqual({
      identity: { state: 'signed-out' },
      sharedService: 'available',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    });

    const signedIn = await identity.signIn();
    expect(signedIn).toEqual({
      ok: true,
      status: {
        identity: { state: 'signed-in', displayName: 'Synthetic Developer', issuerLabel: 'Synthetic test issuer' },
        sharedService: 'available',
        credentialStorage: 'os-backed',
        privateWork: 'local',
      },
    });
    const first = stored(dir)!;
    expect((await service.session(first.accessCredential)).principal.display_name).toBe('Synthetic Developer');

    // Rotation replaces both credentials and the old access credential stops working.
    expect(await identity.refreshNow()).toBe(true);
    const second = stored(dir)!;
    expect(second.accessCredential).not.toBe(first.accessCredential);
    expect(second.refreshCredential).not.toBe(first.refreshCredential);
    await expect(service.session(first.accessCredential)).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(await identity.getStatus()).toMatchObject({ identity: { state: 'signed-in' }, sharedService: 'available' });

    expect(await identity.signOut()).toMatchObject({ ok: true, status: { identity: { state: 'signed-out' } } });
    await expect(service.session(second.accessCredential)).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(stored(dir)).toBeNull();

    const logs = logger.messages.join('\n');
    for (const secret of identity.knownSecrets()) expect(logs.includes(secret)).toBe(false);
  }, 60_000);

  it('a reused refresh credential revokes the family and the desktop must sign in again', async () => {
    const { identity, dir, service } = session();
    await identity.signIn();
    const original = stored(dir)!;
    expect(await identity.refreshNow()).toBe(true);
    // Someone replays the rotated refresh credential: the service revokes the family.
    await expect(service.refresh(original.refreshCredential)).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect((await identity.getStatus()).identity).toEqual({ state: 'signed-out' });
    expect(stored(dir)).toBeNull();
  }, 60_000);

  it('the issuer rejects a wrong PKCE verifier, and a code works at most once', async () => {
    const transport = httpsTransport(config.ca);
    const issuer = new IssuerClient(config.issuerUrl, transport);
    const endpoints = await issuer.discover();
    const pkce = createPkce();
    const state = createState();
    const listener = await startLoopbackListener({ state, issuer: config.issuerUrl, timeoutMs: 10_000 });
    try {
      const url = new URL(endpoints.authorizationEndpoint);
      for (const [key, value] of Object.entries({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: listener.redirectUri,
        scope: 'openid',
        state,
        nonce: 'integration-nonce',
        code_challenge: pkce.challenge,
        code_challenge_method: 'S256',
      })) {
        url.searchParams.set(key, value);
      }
      await headlessOpener(transport)(url.toString());
      const { code } = await listener.callback;
      const exchange = { tokenEndpoint: endpoints.tokenEndpoint, code, redirectUri: listener.redirectUri, clientId: config.clientId };
      const wrong = await issuer.exchangeCode({ ...exchange, codeVerifier: createPkce().verifier }).catch((e: unknown) => e);
      expect(wrong).toBeInstanceOf(IssuerError);
      expect((wrong as IssuerError).code).toBe('invalid_grant');
      const replay = await issuer.exchangeCode({ ...exchange, codeVerifier: pkce.verifier }).catch((e: unknown) => e);
      expect((replay as IssuerError).code).toBe('invalid_grant');
    } finally {
      listener.close();
    }
  }, 60_000);

  it('a certificate from another CA is refused, so the shared service is unavailable', async () => {
    const otherCa = tls.rootCertificates[0]!;
    const untrusted = new SharedServiceClient(config.serviceUrl, httpsTransport(otherCa));
    const error = await untrusted.capabilities().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({ kind: 'transport', delivered: false });

    const transport = httpsTransport(otherCa);
    const identity = new IdentitySession({
      config: { kind: 'configured', config: { ...config, ca: otherCa } },
      vault: new CredentialVault({ safeStorage: fakeSafeStorage('gnome_libsecret'), platform: 'linux', dir: tempDir('identity-int') }),
      service: untrusted,
      issuer: new IssuerClient(config.issuerUrl, transport),
      openBrowser: headlessOpener(transport),
      logger: recordingLogger(),
    });
    expect(await identity.getStatus()).toMatchObject({ sharedService: 'unavailable', privateWork: 'local' });
    expect((await identity.signIn()).ok).toBe(false);
    // The process-wide setting was never touched.
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  }, 60_000);

  it('service down: still signed in, shared service unavailable, private work local', async () => {
    const { identity } = session();
    await identity.signIn();
    expect(await stopTopology()).toBe(0);
    expect(await identity.getStatus()).toEqual({
      identity: { state: 'signed-in', displayName: 'Synthetic Developer', issuerLabel: 'Synthetic test issuer' },
      sharedService: 'unavailable',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    });
  }, 60_000);
});
