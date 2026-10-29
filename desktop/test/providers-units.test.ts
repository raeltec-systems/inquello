/**
 * Story 1.13 units: the Claude key vault and form check, the provider
 * service's Claude states, the free key check against a local fake HTTPS
 * endpoint that trusts only a CA made in this test, the provider dev config,
 * the pure `inferenceRoutes`, the renderer status rebuild, the runtime
 * environment stripping, the runtime `config.toml`, the Codex account against
 * a fake runtime link, and the provider categories of the data policy.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DataService, governedRoots, loadShippedPolicy, parsePolicy, takeInventory, validateDeletion, ExportJournal } from '../src/main/data';
import {
  ANTHROPIC_BASE_URL,
  ANTHROPIC_VERSION,
  CLAUDE_REASONS,
  CODEX_REASONS,
  ClaudeKeyVault,
  CodexAccount,
  claudeKeyProblem,
  inferenceRoutes,
  loadProviderDevConfig,
  parseProviderDevConfig,
  PROVIDER_DEV_CONFIG_ENV,
  ProviderService,
  providersDir,
  toRendererProviderStatus,
  verifyClaudeKey,
  type CodexRuntimeLink,
  type ProviderStatus,
  type VerifyOutcome,
} from '../src/main/providers';
import { isProviderCredentialVar, RpcResponseError, RUNTIME_CONFIG_TOML, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import { fakeSafeStorage } from './identity-fakes';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

afterAll(() => removeTempDirs());

const KEY = 'sk-ant-api03-unit-test-key-0123456789abcdef';
const OTHER_KEY = 'sk-ant-api03-unit-test-key-fedcba9876543210';

function vault(backend: string | null = 'gnome_libsecret', dir = providersDir(tempDir('providers-ud'))): ClaudeKeyVault {
  return new ClaudeKeyVault({ safeStorage: fakeSafeStorage(backend), platform: 'linux', dir });
}

/** A Codex runtime link that answers from a script. */
function fakeRuntime(handlers: Record<string, (params: unknown) => unknown>, ready = true): CodexRuntimeLink & { calls: Array<[string, unknown]>; ready: () => boolean; setReady(value: boolean): void } {
  let up = ready;
  const calls: Array<[string, unknown]> = [];
  return {
    calls,
    ready: () => up,
    setReady: (value) => {
      up = value;
    },
    request: async <T,>(method: string, params?: unknown): Promise<T> => {
      calls.push([method, params]);
      const handler = handlers[method];
      if (!handler) throw new RpcResponseError(method, -32601, 'not found', null);
      return handler(params) as T;
    },
  };
}

function service(options: { vault?: ClaudeKeyVault; verify?: (key: string) => Promise<VerifyOutcome>; runtime?: CodexRuntimeLink; logger?: ReturnType<typeof recordingLogger> } = {}) {
  const logger = options.logger ?? recordingLogger();
  const runtime = options.runtime ?? fakeRuntime({ 'account/read': () => ({ account: null, requiresOpenaiAuth: true }) });
  return {
    logger,
    service: new ProviderService({
      vault: options.vault ?? vault(),
      codex: new CodexAccount({ runtime, openBrowser: async () => undefined, logger }),
      devConfig: { kind: 'default', target: { baseUrl: ANTHROPIC_BASE_URL } },
      verify: options.verify ? (key) => options.verify!(key) : async () => 'verified',
      logger,
    }),
  };
}

describe('Claude API key form', () => {
  it.each([
    ['a valid key', KEY, null],
    ['no sk-ant- prefix', 'sk-proj-0123456789abcdef0123456789', /starts with sk-ant-/],
    ['too short', 'sk-ant-short', /between 24 and 256/],
    ['too long', `sk-ant-${'x'.repeat(260)}`, /between 24 and 256/],
    ['a space', 'sk-ant-api03-has a space-0123456789', /printable/],
    ['a newline', `${KEY}\n`, /printable/],
    ['a non-ASCII character', 'sk-ant-api03-unicodé-0123456789abcdef', /printable/],
  ])('%s', (_label, key, expected) => {
    const problem = claudeKeyProblem(key);
    if (expected === null) expect(problem).toBeNull();
    else {
      expect(problem).toMatch(expected);
      expect(problem).not.toContain(key.slice(7, 15));
    }
  });
});

describe('Claude key vault', () => {
  it('writes an encrypted 0600 file in a 0700 directory when OS-backed (matrix: Store Claude key)', () => {
    const v = vault();
    expect(v.storage).toBe('os-backed');
    v.save({ version: 1, key: KEY, state: 'stored-unverified' });
    expect(fs.statSync(v.filePath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(path.dirname(v.filePath)).mode & 0o777).toBe(0o700);
    expect(path.basename(v.filePath)).toBe('claude.bin');
    expect(path.basename(path.dirname(v.filePath))).toBe('providers');
    expect(fs.readFileSync(v.filePath).includes(Buffer.from(KEY))).toBe(false);
    expect(fs.readdirSync(path.dirname(v.filePath))).toEqual(['claude.bin']);
    expect(v.load()).toEqual({ version: 1, key: KEY, state: 'stored-unverified' });
  });

  it.each([['basic_text'], ['unknown'], [null]])('is memory-only with backend %s and writes nothing', (backend) => {
    const dir = providersDir(tempDir('providers-mem'));
    const v = vault(backend, dir);
    expect(v.storage).toBe('memory-only');
    v.save({ version: 1, key: KEY, state: 'verified' });
    expect(fs.existsSync(dir)).toBe(false);
    expect(v.load()).toEqual({ version: 1, key: KEY, state: 'verified' });
    v.clear();
    expect(v.load()).toBeNull();
  });

  it('treats the file as the truth: a removed file is a removed key, an unreadable one is discarded', () => {
    const v = vault();
    v.save({ version: 1, key: KEY, state: 'verified' });
    fs.rmSync(v.filePath);
    expect(v.load()).toBeNull();
    fs.mkdirSync(path.dirname(v.filePath), { recursive: true });
    fs.writeFileSync(v.filePath, 'not encrypted json');
    expect(v.load()).toBeNull();
    expect(fs.existsSync(v.filePath)).toBe(false);
  });
});

describe('provider service: Claude route', () => {
  it('stores a valid key as stored-unverified and never returns it', async () => {
    const { service: s, logger } = service();
    const result = await s.setClaudeKey(KEY);
    expect(result.ok).toBe(true);
    expect(result.status.claude).toEqual({ state: 'stored-unverified', storage: 'os-backed' });
    expect(JSON.stringify(result)).not.toContain(KEY.slice(7));
    expect(logger.messages.join('\n')).not.toContain(KEY.slice(7));
  });

  it('refuses an invalid key and stores nothing, keeping a key already stored (matrix: Store Claude key, invalid)', async () => {
    const v = vault();
    const { service: s } = service({ vault: v });
    const refused = await s.setClaudeKey('sk-proj-not-a-claude-key-0123456789');
    expect(refused).toMatchObject({ ok: false, reason: expect.stringMatching(/sk-ant-/), status: { claude: { state: 'not-configured' } } });
    expect(fs.existsSync(v.filePath)).toBe(false);
    await s.setClaudeKey(KEY);
    await s.setClaudeKey('sk-ant-x');
    expect(v.load()?.key).toBe(KEY);
  });

  it.each([
    ['verified', true, 'verified', undefined],
    ['rejected', false, 'rejected', CLAUDE_REASONS.rejected],
    ['unreachable', false, 'unreachable', CLAUDE_REASONS.unreachable],
  ] as const)('a %s check gives %s (matrix: Verify OK, rejected, offline)', async (outcome, ok, state, reason) => {
    const v = vault();
    const checked: string[] = [];
    const { service: s } = service({ vault: v, verify: async (key) => (checked.push(key), outcome) });
    await s.setClaudeKey(KEY);
    const result = await s.verifyClaudeKey();
    expect(result.ok).toBe(ok);
    expect(result.reason).toBe(reason);
    expect(result.status.claude.state).toBe(state);
    expect(checked).toEqual([KEY]);
    // A refused key is kept until the user removes it.
    expect(v.load()).toEqual({ version: 1, key: KEY, state });
  });

  it('does not check without a key, and does not relabel a key replaced during the check', async () => {
    const v = vault();
    let replace: (() => Promise<unknown>) | undefined;
    const { service: s } = service({
      vault: v,
      verify: async () => {
        await replace?.();
        return 'rejected';
      },
    });
    await expect(s.verifyClaudeKey()).resolves.toMatchObject({ ok: false, reason: CLAUDE_REASONS.noKey });
    await s.setClaudeKey(KEY);
    replace = async () => v.save({ version: 1, key: OTHER_KEY, state: 'stored-unverified' });
    await expect(s.verifyClaudeKey()).resolves.toMatchObject({ ok: false, reason: CLAUDE_REASONS.changed, status: { claude: { state: 'stored-unverified' } } });
    expect(v.load()?.key).toBe(OTHER_KEY);
  });

  it('removes the key and its file (matrix: Remove Claude key)', async () => {
    const v = vault();
    const { service: s } = service({ vault: v });
    await s.setClaudeKey(KEY);
    const result = await s.removeClaudeKey();
    expect(result).toMatchObject({ ok: true, status: { claude: { state: 'not-configured' } } });
    expect(fs.existsSync(v.filePath)).toBe(false);
  });

  it('refuses a check when the dev config is invalid', async () => {
    const logger = recordingLogger();
    const s = new ProviderService({
      vault: vault(),
      codex: new CodexAccount({ runtime: fakeRuntime({ 'account/read': () => ({ account: null }) }), openBrowser: async () => undefined, logger }),
      devConfig: { kind: 'invalid', reason: 'bad' },
      verify: async () => 'verified',
      logger,
    });
    await s.setClaudeKey(KEY);
    await expect(s.verifyClaudeKey()).resolves.toMatchObject({ ok: false, reason: CLAUDE_REASONS.devConfig });
  });
});

// ---- the free check against a local fake HTTPS endpoint ------------------------------

interface Fake {
  url: string;
  ca: string;
  requests: Array<{ method: string; path: string; headers: Record<string, unknown>; body: string }>;
  respond: (status: number | 'hang') => void;
  close(): Promise<void>;
}

/** A CA and a 127.0.0.1 server certificate it signed, made with the system openssl. */
function makeCa(dir: string): { ca: string; key: string; cert: string } {
  const run = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: 'pipe' });
  run('req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'ca.key', '-out', 'ca.pem', '-days', '1', '-subj', '/CN=Inquello test CA', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign');
  run('req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=127.0.0.1');
  fs.writeFileSync(path.join(dir, 'ext.cnf'), 'subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
  run('x509', '-req', '-in', 'server.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.pem', '-days', '1', '-extfile', 'ext.cnf');
  return { ca: fs.readFileSync(path.join(dir, 'ca.pem'), 'utf8'), key: fs.readFileSync(path.join(dir, 'server.key'), 'utf8'), cert: fs.readFileSync(path.join(dir, 'server.pem'), 'utf8') };
}

async function fakeAnthropic(): Promise<Fake> {
  const dir = tempDir('providers-ca');
  const { ca, key, cert } = makeCa(dir);
  let status: number | 'hang' = 200;
  const requests: Fake['requests'] = [];
  const server = https.createServer({ key, cert }, (req, res) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => {
      requests.push({ method: req.method ?? '', path: req.url ?? '', headers: { ...req.headers }, body });
      if (status === 'hang') return;
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(status === 200 ? '{"data":[{"id":"claude-test"}],"has_more":false}' : '{"type":"error","error":{"type":"authentication_error"}}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `https://127.0.0.1:${port}`,
    ca,
    requests,
    respond: (next) => {
      status = next;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

describe('free Claude key check (fake HTTPS endpoint, test CA)', () => {
  let fake: Fake;
  beforeAll(async () => {
    fake = await fakeAnthropic();
  });
  afterAll(async () => fake.close());

  it('sends one GET /v1/models with x-api-key and the pinned version, and gives verified on 200', async () => {
    fake.requests.length = 0;
    fake.respond(200);
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url, ca: fake.ca })).resolves.toBe('verified');
    expect(fake.requests).toHaveLength(1);
    const [request] = fake.requests;
    expect(request).toMatchObject({ method: 'GET', path: '/v1/models', body: '' });
    expect(request!.headers['x-api-key']).toBe(KEY);
    expect(request!.headers['anthropic-version']).toBe(ANTHROPIC_VERSION);
    expect(ANTHROPIC_VERSION).toBe('2023-06-01');
    // The key never travels in the URL.
    expect(request!.path).not.toContain(KEY);
  });

  it.each([
    [401, 'rejected'],
    [403, 'rejected'],
    [500, 'unreachable'],
    [429, 'unreachable'],
  ] as const)('answers %s with %s, once (matrix: Verify rejected)', async (status, outcome) => {
    fake.requests.length = 0;
    fake.respond(status);
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url, ca: fake.ca })).resolves.toBe(outcome);
    expect(fake.requests).toHaveLength(1);
  });

  it('gives unreachable on a timeout, without retrying (matrix: Verify offline)', async () => {
    fake.requests.length = 0;
    fake.respond('hang');
    const started = Date.now();
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url, ca: fake.ca, timeoutMs: 300 })).resolves.toBe('unreachable');
    expect(Date.now() - started).toBeLessThan(5_000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(fake.requests).toHaveLength(1);
    fake.respond(200);
  });

  it('gives unreachable when nothing listens, and when the certificate is not from the configured CA', async () => {
    const closed = await fakeAnthropic();
    const url = closed.url;
    await closed.close();
    await expect(verifyClaudeKey(KEY, { baseUrl: url, ca: fake.ca, timeoutMs: 2_000 })).resolves.toBe('unreachable');
    fake.requests.length = 0;
    const other = makeCa(tempDir('providers-other-ca'));
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url, ca: other.ca })).resolves.toBe('unreachable');
    // Without the dev CA the system store is used, which does not trust the test CA either.
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url })).resolves.toBe('unreachable');
    expect(fake.requests).toHaveLength(0);
  });

  it('refuses a non-https base URL without sending anything', async () => {
    await expect(verifyClaudeKey(KEY, { baseUrl: fake.url.replace('https:', 'http:'), ca: fake.ca })).resolves.toBe('unreachable');
  });

  it('runs through the provider service with the dev config, and the rejected key stays stored', async () => {
    const dir = tempDir('providers-devcfg');
    fs.writeFileSync(path.join(dir, 'ca.pem'), fake.ca);
    fs.writeFileSync(path.join(dir, 'dev.json'), JSON.stringify({ anthropic_base_url: fake.url, ca_path: path.join(dir, 'ca.pem') }));
    const devConfig = loadProviderDevConfig({ [PROVIDER_DEV_CONFIG_ENV]: path.join(dir, 'dev.json') }, true);
    expect(devConfig).toMatchObject({ kind: 'dev', target: { baseUrl: fake.url } });
    const logger = recordingLogger();
    const v = vault();
    const s = new ProviderService({
      vault: v,
      codex: new CodexAccount({ runtime: fakeRuntime({ 'account/read': () => ({ account: null }) }), openBrowser: async () => undefined, logger }),
      devConfig,
      logger,
    });
    await s.setClaudeKey(KEY);
    fake.respond(200);
    await expect(s.verifyClaudeKey()).resolves.toMatchObject({ ok: true, status: { claude: { state: 'verified' } } });
    fake.respond(401);
    await expect(s.verifyClaudeKey()).resolves.toMatchObject({ ok: false, status: { claude: { state: 'rejected' } } });
    expect(v.load()?.key).toBe(KEY);
    expect(logger.messages.join('\n')).not.toContain(KEY.slice(7));
    fake.respond(200);
  });
});

describe('provider dev config', () => {
  const read = (ca: string) => () => ca;
  const CA = '-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----\n';
  it('is ignored in a packaged build and without the variable', () => {
    expect(loadProviderDevConfig({ [PROVIDER_DEV_CONFIG_ENV]: '/nonexistent' }, false)).toEqual({ kind: 'default', target: { baseUrl: ANTHROPIC_BASE_URL } });
    expect(loadProviderDevConfig({}, true)).toEqual({ kind: 'default', target: { baseUrl: ANTHROPIC_BASE_URL } });
    expect(loadProviderDevConfig({ [PROVIDER_DEV_CONFIG_ENV]: '/nonexistent' }, true)).toMatchObject({ kind: 'invalid' });
  });
  it.each([
    ['not JSON', 'x', CA],
    ['extra keys', JSON.stringify({ anthropic_base_url: 'https://127.0.0.1:1', ca_path: '/ca', other: 1 }), CA],
    ['an http origin', JSON.stringify({ anthropic_base_url: 'http://127.0.0.1:1', ca_path: '/ca' }), CA],
    ['a URL with a path', JSON.stringify({ anthropic_base_url: 'https://127.0.0.1:1/v1', ca_path: '/ca' }), CA],
    ['a CA file with a key', JSON.stringify({ anthropic_base_url: 'https://127.0.0.1:1', ca_path: '/ca' }), `${CA}-----BEGIN PRIVATE KEY-----\n`],
    ['no certificate', JSON.stringify({ anthropic_base_url: 'https://127.0.0.1:1', ca_path: '/ca' }), 'nothing'],
  ])('refuses %s', (_label, text, ca) => {
    expect(parseProviderDevConfig(text, read(ca))).toMatchObject({ kind: 'invalid' });
  });
});

describe('inference-route authorization (pure)', () => {
  const status = (claude: ProviderStatus['claude']['state'], codex: ProviderStatus['codex']['state']): ProviderStatus => ({
    claude: { state: claude, storage: 'os-backed' },
    codex: { state: codex, account: codex === 'connected' ? { type: 'apiKey' } : null, credentialStore: 'os-keyring' },
  });
  it.each([
    ['not-configured', false],
    ['stored-unverified', true],
    ['verified', true],
    ['rejected', false],
    ['unreachable', true],
  ] as const)('a Claude key %s authorizes the Claude route: %s', (state, authorized) => {
    const routes = inferenceRoutes(status(state, 'not-connected'));
    expect(routes['claude-api-key'].authorized).toBe(authorized);
    expect(routes['codex-inherited'].authorized).toBe(false);
  });
  it.each([
    ['connected', true],
    ['not-connected', false],
    ['connecting', false],
    ['unavailable', false],
  ] as const)('a Codex login %s authorizes the Codex route: %s', (state, authorized) => {
    const routes = inferenceRoutes(status('not-configured', state));
    expect(routes['codex-inherited'].authorized).toBe(authorized);
    expect(routes['claude-api-key'].authorized).toBe(false);
  });
  it('changing one route changes only that route', () => {
    const before = inferenceRoutes(status('verified', 'connected'));
    const after = inferenceRoutes(status('verified', 'not-connected'));
    expect(after['claude-api-key']).toEqual(before['claude-api-key']);
    expect(after['codex-inherited'].authorized).toBe(false);
  });
  it('the renderer status keeps only the published fields and adds the routes', () => {
    const dirty = {
      claude: { state: 'verified', storage: 'os-backed', key: KEY },
      codex: { state: 'connected', account: { type: 'chatgpt', planType: 'pro', email: 'a@b.c' }, credentialStore: 'os-keyring', token: 'x' },
      identity: { state: 'signed-in' },
    } as unknown as ProviderStatus;
    const view = toRendererProviderStatus(dirty);
    expect(view).toEqual({
      claude: { state: 'verified', storage: 'os-backed' },
      codex: { state: 'connected', account: { type: 'chatgpt', planType: 'pro' }, credentialStore: 'os-keyring' },
      routes: inferenceRoutes({ claude: { state: 'verified', storage: 'os-backed' }, codex: { state: 'connected', account: { type: 'apiKey' }, credentialStore: 'os-keyring' } }),
    });
    expect(JSON.stringify(view)).not.toMatch(/sk-ant|a@b\.c|identity/);
  });
});

describe('runtime environment (matrix: Inherited env key)', () => {
  it.each([
    ['OPENAI_API_KEY', true],
    ['ANTHROPIC_API_KEY', true],
    ['CODEX_API_KEY', true],
    ['AZURE_OPENAI_API_KEY', true],
    ['openai_api_key', true],
    ['OPENAI_ADMIN_API_KEY', true],
    ['ANTHROPIC_AUTH_TOKEN', true],
    ['CLAUDE_CODE_OAUTH_TOKEN', true],
    ['CODEX_ACCESS_TOKEN', true],
    ['CHATGPT_SESSION_TOKEN', true],
    ['OPENAI_CLIENT_SECRET', true],
    ['MY_OPENAI_API_KEY', true],
    ['TEAM_ANTHROPIC_API_KEY', true],
    ['AZURE_OPENAI_AD_TOKEN', true],
    ['OPENAIX_API_KEY', false],
    ['CLAUDE_SESSION_INGRESS_TOKEN_FILE', false],
    ['OPENAI_BASE_URL', false],
    ['GITHUB_TOKEN', false],
    ['NPM_TOKEN', false],
    ['HOME', false],
  ])('%s is a provider credential variable: %s', (name, expected) => {
    expect(isProviderCredentialVar(name)).toBe(expected);
  });

  it('strips every provider credential variable and the named main-only variables', () => {
    const env = runtimeChildEnv(
      {
        PATH: '/usr/bin',
        OPENAI_API_KEY: 'sk-1',
        Anthropic_Api_Key: 'sk-2',
        CODEX_API_KEY: 'sk-3',
        AZURE_OPENAI_API_KEY: 'sk-4',
        ANTHROPIC_AUTH_TOKEN: 'tok',
        INQUELLO_PROVIDER_DEV_CONFIG: '/dev.json',
        GITHUB_TOKEN: 'gh',
      },
      { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', codexHome: '/rh', blocked: [PROVIDER_DEV_CONFIG_ENV] },
    );
    expect(env).toEqual({ PATH: '/usr/bin', GITHUB_TOKEN: 'gh', CODEX_HOME: '/rh' });
  });
});

describe('runtime config.toml', () => {
  it('sets the keyring credential store and direct keyring storage, 0600, replacing what was there', () => {
    const home = path.join(tempDir('providers-rh'), 'runtime-home');
    fs.mkdirSync(home);
    fs.writeFileSync(path.join(home, 'config.toml'), 'cli_auth_credentials_store = "file"\nmodel = "x"\n');
    const file = writeRuntimeConfig(home);
    expect(file).toBe(path.join(home, 'config.toml'));
    const text = fs.readFileSync(file, 'utf8');
    expect(text).toBe(RUNTIME_CONFIG_TOML);
    expect(text).toMatch(/^cli_auth_credentials_store = "keyring"$/m);
    expect(text).toMatch(/^\[features\]\n(?:#.*\n)*secret_auth_storage = false$/m);
    expect(text).not.toMatch(/"file"|model/);
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(home)).toEqual(['config.toml']);
  });
});

describe('Codex account (fake runtime)', () => {
  const logger = () => recordingLogger();

  it('reads the account and maps it to a status without email', async () => {
    const runtime = fakeRuntime({ 'account/read': () => ({ account: { type: 'chatgpt', email: 'a@b.c', planType: 'plus' }, requiresOpenaiAuth: true }) });
    const account = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: logger() });
    await expect(account.refresh()).resolves.toEqual({ state: 'connected', account: { type: 'chatgpt', planType: 'plus' }, credentialStore: 'os-keyring' });
    expect(runtime.calls).toEqual([['account/read', { refreshToken: false }]]);
  });

  it('is unavailable while the runtime is down, and refuses actions', async () => {
    const runtime = fakeRuntime({}, false);
    const account = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: logger() });
    await expect(account.refresh()).resolves.toMatchObject({ state: 'unavailable', reason: CODEX_REASONS.runtimeDown });
    await expect(account.login({ type: 'apiKey', apiKey: 'sk-x' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.runtimeDown });
    expect(runtime.calls).toEqual([]);
  });

  it('maps a keyring failure to the stated reason without passing the runtime message on (matrix: Codex API-key login, keyring missing)', async () => {
    const log = logger();
    const runtime = fakeRuntime({
      'account/read': () => ({ account: null }),
      'account/login/start': () => {
        throw new RpcResponseError('account/login/start', -32603, 'failed to save api key: failed to write OAuth tokens to keyring: no secret service provider or dbus session found', null);
      },
    });
    const account = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: log });
    await expect(account.login({ type: 'apiKey', apiKey: 'sk-proj-SENTINEL' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.keyringUnavailable });
    expect(account.snapshot().state).toBe('not-connected');
    expect(log.messages.join('\n')).not.toContain('SENTINEL');
  });

  it('refuses an API key with spaces before asking the runtime', async () => {
    const runtime = fakeRuntime({ 'account/read': () => ({ account: null }) });
    const account = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: logger() });
    await expect(account.login({ type: 'apiKey', apiKey: 'sk has space' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.invalidKey });
    await expect(account.login({ type: 'apiKey', apiKey: '' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.invalidKey });
    expect(runtime.calls).toEqual([]);
  });

  it('ChatGPT: opens the authorization URL in the browser, shows connecting, and completes on account/login/completed', async () => {
    let account: unknown = null;
    const runtime = fakeRuntime({
      'account/read': () => ({ account }),
      'account/login/start': () => ({ type: 'chatgpt', loginId: 'login-1', authUrl: 'https://auth.openai.com/oauth/authorize?state=s' }),
    });
    const opened: string[] = [];
    const codex = new CodexAccount({ runtime, openBrowser: async (url) => void opened.push(url), logger: logger() });
    await expect(codex.login({ type: 'chatgpt' })).resolves.toEqual({ ok: true });
    expect(opened).toEqual(['https://auth.openai.com/oauth/authorize?state=s']);
    expect(codex.snapshot().state).toBe('connecting');
    await expect(codex.login({ type: 'chatgpt' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.pending });
    account = { type: 'chatgpt', email: 'x@y.z', planType: 'pro' };
    codex.handleNotification('account/login/completed', { loginId: 'login-1', success: true, error: null });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(codex.snapshot()).toEqual({ state: 'connected', account: { type: 'chatgpt', planType: 'pro' }, credentialStore: 'os-keyring' });
  });

  it('ChatGPT: a failed sign-in says so; a browser that does not open cancels the login', async () => {
    const runtime = fakeRuntime({
      'account/read': () => ({ account: null }),
      'account/login/start': () => ({ type: 'chatgpt', loginId: 'login-2', authUrl: 'https://auth.openai.com/x' }),
      'account/login/cancel': () => ({ status: 'canceled' }),
    });
    const codex = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: logger() });
    await codex.login({ type: 'chatgpt' });
    codex.handleNotification('account/login/completed', { loginId: 'login-2', success: false, error: 'denied' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(codex.snapshot()).toMatchObject({ state: 'not-connected', reason: CODEX_REASONS.chatgptIncomplete });

    const failing = new CodexAccount({
      runtime,
      openBrowser: async () => {
        throw new Error('no browser');
      },
      logger: logger(),
    });
    await expect(failing.login({ type: 'chatgpt' })).resolves.toEqual({ ok: false, reason: CODEX_REASONS.browser });
    expect(runtime.calls.at(-1)).toEqual(['account/login/cancel', { loginId: 'login-2' }]);
    expect(failing.snapshot().state).toBe('not-connected');
  });

  it('logout removes the login; a keyring failure on logout is stated', async () => {
    let account: unknown = { type: 'apiKey' };
    let fail = false;
    const runtime = fakeRuntime({
      'account/read': () => ({ account }),
      'account/logout': () => {
        if (fail) throw new RpcResponseError('account/logout', -32603, 'logout failed: failed to delete auth from keyring', null);
        account = null;
        return {};
      },
    });
    const codex = new CodexAccount({ runtime, openBrowser: async () => undefined, logger: logger() });
    await codex.refresh();
    fail = true;
    await expect(codex.logout()).resolves.toEqual({ ok: false, reason: CODEX_REASONS.keyringLogout });
    expect(codex.snapshot().state).toBe('connected');
    fail = false;
    await expect(codex.logout()).resolves.toEqual({ ok: true });
    expect(codex.snapshot().state).toBe('not-connected');
  });
});

describe('data policy: provider categories', () => {
  const load = loadShippedPolicy();
  if (!load.ok) throw new Error(load.error);
  const policy = load.policy;
  const byId = (id: string) => policy.categories.find((category) => category.id === id)!;

  it('registers the provider vault, the runtime config and the keyring entry; auth.json stays disabled', () => {
    expect(byId('claude-key-vault')).toMatchObject({
      enabled: true,
      credentials: true,
      access: 'main-process-only',
      export: { mode: 'excluded' },
      location: { root: 'user-data', globs: ['providers/claude.bin', 'providers/claude.bin.*.tmp'] },
    });
    expect(byId('claude-key-vault').deletion).toMatch(/Remove the Claude API key/);
    expect(byId('runtime-config')).toMatchObject({ enabled: true, credentials: false, export: { mode: 'excluded' }, location: { root: 'runtime-home', globs: expect.arrayContaining(['config.toml']) } });
    expect(byId('runtime-config').deletion).toMatch(/rewrites/);
    expect(byId('codex-keyring-entry')).toMatchObject({ enabled: true, credentials: true, export: { mode: 'excluded' }, location: { store: 'os-credential-store' } });
    expect(byId('codex-keyring-entry').deletion).toMatch(/logout removes the keyring entry/);
    expect(byId('provider-credentials')).toMatchObject({ enabled: false, credentials: true, location: { root: 'runtime-home', globs: expect.arrayContaining(['auth.json']) } });
  });

  it('classifies the vault and config files, blocks on auth.json, and never lists the keyring entry as a file', () => {
    const userData = tempDir('providers-inventory');
    const roots = governedRoots(userData, path.join(userData, 'logs'));
    fs.mkdirSync(path.join(userData, 'providers'), { recursive: true });
    fs.writeFileSync(path.join(userData, 'providers', 'claude.bin'), 'x');
    writeRuntimeConfig(roots['runtime-home']);
    let inventory = takeInventory(policy, roots);
    expect(inventory.unclassified).toEqual([]);
    expect(inventory.held['claude-key-vault']).toMatchObject({ files: 1 });
    expect(inventory.held['runtime-config']).toMatchObject({ files: 1 });
    expect(inventory.held['codex-keyring-entry']).toEqual({ files: 0, bytes: 0 });
    fs.writeFileSync(path.join(roots['runtime-home'], 'auth.json'), '{}');
    inventory = takeInventory(policy, roots);
    expect(inventory.disabledHeld).toEqual([{ category: 'provider-credentials', path: 'runtime-home:auth.json' }]);
  });

  it('refuses to delete the keyring entry through Local data, and leaves it out of the deletable list', () => {
    expect(() => validateDeletion(policy, ['codex-keyring-entry'])).toThrow(/OS credential store; remove it in Providers/);
    expect(() => validateDeletion(policy, ['claude-key-vault', 'runtime-config'])).not.toThrow();
    const userData = tempDir('providers-deletable');
    const service = new DataService({
      load,
      roots: governedRoots(userData, path.join(userData, 'logs')),
      journal: new ExportJournal(userData),
      runtime: { stop: async () => undefined, start: async () => undefined, activeTasks: () => 0 },
      identity: { principal: async () => null, holdsSession: () => false, signOut: async () => ({ ok: true }), forgetLocally: () => undefined },
      chooseExportDestination: async () => null,
      chooseImportSource: async () => null,
      clearBrowserProfile: async () => undefined,
      appVersion: '0',
      runtimeVersion: '0',
      logger: recordingLogger(),
    });
    expect(service.deletableCategories()).toContain('claude-key-vault');
    expect(service.deletableCategories()).not.toContain('codex-keyring-entry');
    expect(service.getPolicy().categories.find((category) => category.id === 'codex-keyring-entry')).toMatchObject({ location: 'os-credential-store', held: { files: 0 } });
  });

  it('validates a store location strictly', () => {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data-policy.json'), 'utf8')) as { categories: Array<Record<string, unknown>> };
    const entry = raw.categories.find((category) => category.id === 'codex-keyring-entry')!;
    entry.location = { store: 'os-credential-store', entry: 'x', globs: ['a'] };
    expect(() => parsePolicy(JSON.stringify(raw))).toThrow(/unknown field globs/);
    entry.location = { store: 'cloud', entry: 'x' };
    expect(() => parsePolicy(JSON.stringify(raw))).toThrow(/store/);
  });
});
