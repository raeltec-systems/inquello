/**
 * Story 1.3 (AD-5): renderer isolation. Covers the I/O matrix on the pure
 * policy functions, the operation registry with a fake `ipcMain`, the preload
 * under a mocked `electron`, and a source scan of where host privilege lives.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAppPath, serveAppRequest } from '../src/main/security/app-protocol';
import {
  CHANNEL_PREFIX,
  OPERATION_NAMES,
  channelFor,
  createOperations,
  noPayload,
  objectPayload,
  registerOperations,
  type DataOperations,
  type IdentityOperations,
  type IpcMainLike,
  type Operation,
  type ProviderOperations,
} from '../src/main/security/operations';
import type { ProviderStatus } from '../src/main/providers/status';
import type { PolicyView } from '../src/main/data/service';
import type { IdentityStatus } from '../src/main/identity/session';
import {
  CONTENT_SECURITY_POLICY,
  applyContentsPolicy,
  applySessionPolicy,
  isAllowedRequestUrl,
  isAppUrl,
  secureWebPreferences,
} from '../src/main/security/policy';
import { describeSender, isTrustedSender, type FrameLike, type InvokeEventLike } from '../src/main/security/sender';
import { EXPECTED_BRIDGE_TREE, evaluatePrivileges, type RendererProbeResult } from '../src/main/smoke-probe';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const APP = 'inquello://app/index.html';

afterAll(() => removeTempDirs());

describe('isAppUrl', () => {
  it.each([APP, 'inquello://app/', 'inquello://app/sub/page.html?x=1#y'])('accepts %s', (url) => {
    expect(isAppUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/',
    'http://app/',
    'file:///etc/passwd',
    'inquello://evil/',
    'inquello://app.evil/',
    'inquello://app:8080/',
    'inquello://user:pw@app/',
    'devtools://devtools/',
    'about:blank',
    '',
    'not a url',
  ])('rejects %s', (url) => {
    expect(isAppUrl(url)).toBe(false);
  });
});

describe('isAllowedRequestUrl', () => {
  it.each([APP, 'devtools://devtools/bundled/inspector.html', 'INQUELLO://app/'])('allows %s', (url) => {
    expect(isAllowedRequestUrl(url)).toBe(true);
  });

  it.each(['https://example.com/', 'http://localhost/', 'file:///etc/passwd', 'ws://localhost/', 'wss://x/', 'data:text/plain,x', ''])(
    'cancels %s',
    (url) => {
      expect(isAllowedRequestUrl(url)).toBe(false);
    },
  );
});

describe('secureWebPreferences', () => {
  it('is sandboxed and isolated with no Node or webview', () => {
    const prefs = secureWebPreferences('/x/preload.js');
    expect(prefs).toMatchObject({
      preload: '/x/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      webSecurity: true,
    });
  });
});

describe('sender trust', () => {
  const trusted = new Set([7]);
  const frame = (url: string, id = 1, parent: unknown = null): FrameLike => ({ url, frameTreeNodeId: id, parent });

  function event(senderId: number, senderFrame: FrameLike | null, mainFrame: FrameLike): InvokeEventLike {
    return { sender: { id: senderId, mainFrame }, senderFrame };
  }

  it('trusts the main frame of a tracked webContents on the app origin', () => {
    const main = frame(APP);
    expect(isTrustedSender(describeSender(event(7, main, main)), trusted)).toBe(true);
  });

  it('rejects an untracked webContents', () => {
    const main = frame(APP);
    expect(isTrustedSender(describeSender(event(8, main, main)), trusted)).toBe(false);
  });

  it('rejects a subframe even on the app origin', () => {
    const main = frame(APP, 1);
    const sub = frame(APP, 2, main);
    expect(isTrustedSender(describeSender(event(7, sub, main)), trusted)).toBe(false);
  });

  it('rejects a tracked main frame that is off the app origin', () => {
    const main = frame('https://example.com/');
    expect(isTrustedSender(describeSender(event(7, main, main)), trusted)).toBe(false);
  });

  it('rejects a missing sender frame', () => {
    expect(isTrustedSender(describeSender(event(7, null, frame(APP))), trusted)).toBe(false);
  });
});

describe('payload validators', () => {
  it('noPayload accepts no arguments only', () => {
    expect(noPayload([])).toBeUndefined();
    expect(() => noPayload([undefined])).toThrow();
    expect(() => noPayload([{}])).toThrow();
  });

  const validate = objectPayload({ name: 'string', count: 'number' });

  it('objectPayload accepts exactly the declared shape', () => {
    expect(validate([{ name: 'a', count: 1 }])).toEqual({ name: 'a', count: 1 });
  });

  it.each([
    ['no argument', []],
    ['extra argument', [{ name: 'a', count: 1 }, 2]],
    ['unknown key', [{ name: 'a', count: 1, extra: true }]],
    ['missing key', [{ name: 'a' }]],
    ['wrong type', [{ name: 'a', count: '1' }]],
    ['non-finite number', [{ name: 'a', count: Number.NaN }]],
    ['array', [['a', 1]]],
    ['null', [null]],
    ['class instance', [new (class { name = 'a'; count = 1 })()]],
  ])('objectPayload rejects %s', (_label, args) => {
    expect(() => validate(args as unknown[])).toThrow();
  });
});

class FakeIpcMain implements IpcMainLike {
  readonly handlers = new Map<string, (event: InvokeEventLike, ...args: unknown[]) => unknown>();
  handle(channel: string, listener: (event: InvokeEventLike, ...args: unknown[]) => unknown): void {
    if (this.handlers.has(channel)) throw new Error(`duplicate handler for ${channel}`);
    this.handlers.set(channel, listener);
  }
  /** Mirrors Electron: a channel without a handler rejects and runs nothing. */
  async invoke(channel: string, event: InvokeEventLike, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) throw new Error(`No handler registered for '${channel}'`);
    return handler(event, ...args);
  }
}

/** A fake identity session whose results carry extra fields the renderer must never see. */
function fakeIdentity(): IdentityOperations {
  const status = (): IdentityStatus =>
    ({
      identity: { state: 'signed-in', displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer', accessCredential: 'iqa_LEAK' },
      sharedService: 'available',
      credentialStorage: 'os-backed',
      privateWork: 'local',
      refreshCredential: 'iqr_LEAK',
    }) as unknown as IdentityStatus;
  return {
    getStatus: async () => status(),
    signIn: async () => ({ ok: false, reason: 'The identity provider did not complete the sign-in.', status: status(), code: 'LEAK' }) as never,
    signOut: async () => ({ ok: true, status: status() }),
  };
}

function fakeData(calls: string[] = []): DataOperations {
  const policy: PolicyView = { loaded: true, policyOwner: 'Owner', notice: 'Notice', categories: [], blockers: [] };
  return {
    getPolicy: () => (calls.push('getPolicy'), policy),
    exportData: async () => (calls.push('export'), { ok: false, reason: 'No folder was chosen.' }),
    importData: async () => (calls.push('import'), { ok: false, reason: 'No folder was chosen.' }),
    deleteData: async (categories) => (calls.push(`delete:${categories.join(',')}`), { ok: false, reason: 'test' }),
    deletableCategories: () => ['task-history', 'runtime-logs'],
  };
}

/** A provider service whose results carry extra fields (and a key) that must never cross IPC. */
function fakeProvider(calls: string[] = []): ProviderOperations {
  const status = (): ProviderStatus =>
    ({
      claude: { state: 'stored-unverified', storage: 'os-backed', key: 'sk-ant-LEAK' },
      codex: { state: 'connected', account: { type: 'chatgpt', planType: 'plus', email: 'leak@example.com' }, credentialStore: 'os-keyring', apiKey: 'LEAK' },
    }) as unknown as ProviderStatus;
  const result = (name: string, detail = '') => {
    calls.push(`${name}${detail}`);
    return { ok: true, status: status(), key: 'LEAK' } as never;
  };
  return {
    getStatus: async () => (calls.push('getStatus'), status()),
    setClaudeKey: async (key) => result('setClaudeKey', `:${key.length}`),
    verifyClaudeKey: async () => result('verifyClaudeKey'),
    removeClaudeKey: async () => result('removeClaudeKey'),
    codexLogin: async (request) => result('codexLogin', `:${request.type}`),
    codexLogout: async () => result('codexLogout'),
  };
}

describe('operation registry', () => {
  const mainFrame: FrameLike = { url: APP, frameTreeNodeId: 1, parent: null };
  const trustedEvent: InvokeEventLike = { sender: { id: 1, mainFrame }, senderFrame: mainFrame };
  let ipc: FakeIpcMain;
  let calls: number;
  let dataCalls: string[];
  let providerCalls: string[];
  let logger: ReturnType<typeof recordingLogger>;

  beforeEach(() => {
    ipc = new FakeIpcMain();
    calls = 0;
    dataCalls = [];
    providerCalls = [];
    logger = recordingLogger();
    const operations = createOperations({
      runtimeState: () => {
        calls += 1;
        return 'ready';
      },
      runtimeVersion: '0.165.0',
      identity: fakeIdentity(),
      data: fakeData(dataCalls),
      provider: fakeProvider(providerCalls),
    });
    registerOperations(ipc, operations, { trustedWebContentsIds: new Set([1]), logger });
  });

  it('registers exactly one fixed channel per named operation', () => {
    expect(OPERATION_NAMES).toEqual([
      'runtime.getStatus',
      'identity.getStatus',
      'identity.signIn',
      'identity.signOut',
      'data.getPolicy',
      'data.export',
      'data.import',
      'data.delete',
      'provider.getStatus',
      'provider.setClaudeKey',
      'provider.verifyClaudeKey',
      'provider.removeClaudeKey',
      'provider.codexLogin',
      'provider.codexLogout',
    ]);
    expect([...ipc.handlers.keys()]).toEqual(OPERATION_NAMES.map((name) => `${CHANNEL_PREFIX}${name}`));
  });

  it('runtime.getStatus returns state and runtime version', async () => {
    await expect(ipc.invoke(channelFor('runtime.getStatus'), trustedEvent)).resolves.toEqual({
      state: 'ready',
      runtimeVersion: '0.165.0',
    });
    expect(calls).toBe(1);
  });

  it.each([
    ['an extra argument', [1]],
    ['an object argument', [{ unknown: true }]],
    ['undefined', [undefined]],
  ])('rejects %s before the handler runs', async (_label, args) => {
    const error = await ipc.invoke(channelFor('runtime.getStatus'), trustedEvent, ...args).catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('invalid payload for runtime.getStatus');
    expect(calls).toBe(0);
  });

  it.each([
    ['another webContents', { sender: { id: 2, mainFrame }, senderFrame: mainFrame }],
    ['a subframe', { sender: { id: 1, mainFrame }, senderFrame: { url: APP, frameTreeNodeId: 2, parent: mainFrame } }],
    [
      'a non-app origin',
      {
        sender: { id: 1, mainFrame: { url: 'https://example.com/', frameTreeNodeId: 1, parent: null } },
        senderFrame: { url: 'https://example.com/', frameTreeNodeId: 1, parent: null },
      },
    ],
  ])('rejects a call from %s and logs it', async (_label, event) => {
    const error = await ipc.invoke(channelFor('runtime.getStatus'), event as InvokeEventLike).catch((e: Error) => e);
    expect((error as Error).message).toBe('untrusted sender');
    expect(calls).toBe(0);
    expect(logger.messages.some((m) => m.includes('untrusted sender'))).toBe(true);
  });

  it('identity operations return only the published status fields', async () => {
    const expected: IdentityStatus = {
      identity: { state: 'signed-in', displayName: 'Alice Synthetic', issuerLabel: 'Synthetic test issuer' },
      sharedService: 'available',
      credentialStorage: 'os-backed',
      privateWork: 'local',
    };
    await expect(ipc.invoke(channelFor('identity.getStatus'), trustedEvent)).resolves.toEqual(expected);
    const signIn = await ipc.invoke(channelFor('identity.signIn'), trustedEvent);
    expect(signIn).toEqual({ ok: false, reason: 'The identity provider did not complete the sign-in.', status: expected });
    await expect(ipc.invoke(channelFor('identity.signOut'), trustedEvent)).resolves.toEqual({ ok: true, status: expected });
    expect(JSON.stringify(signIn)).not.toContain('LEAK');
  });

  it.each(['identity.getStatus', 'identity.signIn', 'identity.signOut'] as const)('%s takes no arguments and checks the sender', async (name) => {
    const bad = await ipc.invoke(channelFor(name), trustedEvent, { force: true }).catch((e: Error) => e);
    expect((bad as Error).message).toBe(`invalid payload for ${name}`);
    const foreign = await ipc.invoke(channelFor(name), { sender: { id: 2, mainFrame }, senderFrame: mainFrame }).catch((e: Error) => e);
    expect((foreign as Error).message).toBe('untrusted sender');
  });

  it.each(['data.getPolicy', 'data.export', 'data.import'] as const)('%s takes no arguments, so a renderer path is an invalid payload', async (name) => {
    for (const args of [['/tmp/chosen-by-renderer'], [{ path: '/tmp/x' }], [undefined]]) {
      const bad = await ipc.invoke(channelFor(name), trustedEvent, ...args).catch((e: Error) => e);
      expect((bad as Error).message).toBe(`invalid payload for ${name}`);
    }
    const foreign = await ipc.invoke(channelFor(name), { sender: { id: 2, mainFrame }, senderFrame: mainFrame }).catch((e: Error) => e);
    expect((foreign as Error).message).toBe('untrusted sender');
    expect(dataCalls).toEqual([]);
    await ipc.invoke(channelFor(name), trustedEvent);
    expect(dataCalls).toHaveLength(1);
  });

  it.each([
    ['no argument', []],
    ['a path', ['/home/user/.codex']],
    ['an empty list', [[]]],
    ['an unknown category', [['task-history', 'everything']]],
    ['a disabled or credential category', [['provider-credentials']]],
    ['a repeated category', [['task-history', 'task-history']]],
    ['a non-string entry', [[1]]],
    ['a sparse list', [[, 'task-history']]],
    ['a list with extra properties', [Object.assign(['task-history'], { path: '/tmp' })]],
    ['extra arguments', [['task-history'], '/tmp']],
    ['an object', [{ categories: ['task-history'] }]],
  ])('data.delete rejects %s', async (_label, args) => {
    const bad = await ipc.invoke(channelFor('data.delete'), trustedEvent, ...(args as unknown[])).catch((e: Error) => e);
    expect((bad as Error).message).toBe('invalid payload for data.delete');
    expect(dataCalls).toEqual([]);
  });

  it('data.delete passes known category ids through', async () => {
    await ipc.invoke(channelFor('data.delete'), trustedEvent, ['runtime-logs', 'task-history']);
    expect(dataCalls).toEqual(['delete:runtime-logs,task-history']);
  });

  it('provider operations return only the published status fields, never a key', async () => {
    const expected = {
      claude: { state: 'stored-unverified', storage: 'os-backed' },
      codex: { state: 'connected', account: { type: 'chatgpt', planType: 'plus' }, credentialStore: 'os-keyring' },
      routes: {
        'claude-api-key': { authorized: true, reason: 'A Claude API key is stored and has not been checked.' },
        'codex-inherited': { authorized: true, reason: 'A Codex login is held in the OS keyring.' },
      },
    };
    await expect(ipc.invoke(channelFor('provider.getStatus'), trustedEvent)).resolves.toEqual(expected);
    const results = [
      await ipc.invoke(channelFor('provider.setClaudeKey'), trustedEvent, 'sk-ant-api03-SECRETSECRETSECRET'),
      await ipc.invoke(channelFor('provider.verifyClaudeKey'), trustedEvent),
      await ipc.invoke(channelFor('provider.removeClaudeKey'), trustedEvent),
      await ipc.invoke(channelFor('provider.codexLogin'), trustedEvent, { type: 'apiKey', apiKey: 'sk-SECRETSECRET' }),
      await ipc.invoke(channelFor('provider.codexLogin'), trustedEvent, { type: 'chatgpt' }),
      await ipc.invoke(channelFor('provider.codexLogout'), trustedEvent),
    ];
    for (const result of results) {
      expect(result).toEqual({ ok: true, status: expected });
      expect(JSON.stringify(result)).not.toMatch(/LEAK|SECRET|leak@/);
    }
    expect(providerCalls).toEqual(['getStatus', 'setClaudeKey:31', 'verifyClaudeKey', 'removeClaudeKey', 'codexLogin:apiKey', 'codexLogin:chatgpt', 'codexLogout']);
  });

  it.each(['provider.getStatus', 'provider.verifyClaudeKey', 'provider.removeClaudeKey', 'provider.codexLogout'] as const)('%s takes no arguments and checks the sender', async (name) => {
    const bad = await ipc.invoke(channelFor(name), trustedEvent, 'sk-ant-x').catch((e: Error) => e);
    expect((bad as Error).message).toBe(`invalid payload for ${name}`);
    const foreign = await ipc.invoke(channelFor(name), { sender: { id: 2, mainFrame }, senderFrame: mainFrame }).catch((e: Error) => e);
    expect((foreign as Error).message).toBe('untrusted sender');
    expect(providerCalls).toEqual([]);
  });

  it.each([
    ['no argument', []],
    ['a number', [42]],
    ['an object', [{ key: 'sk-ant-x' }]],
    ['two arguments', ['sk-ant-api03-SECRETSECRETSECRET', 'extra']],
    ['an oversized string', ['sk-ant-'.padEnd(5000, 'x')]],
  ])('provider.setClaudeKey rejects %s without logging the value', async (_label, args) => {
    const bad = await ipc.invoke(channelFor('provider.setClaudeKey'), trustedEvent, ...(args as unknown[])).catch((e: Error) => e);
    expect((bad as Error).message).toBe('invalid payload for provider.setClaudeKey');
    expect(providerCalls).toEqual([]);
    expect(logger.messages.join('\n')).not.toMatch(/SECRET|sk-ant/);
  });

  it.each([
    ['no argument', []],
    ['a string', ['sk-SECRET']],
    ['an unknown type', [{ type: 'chatgptAuthTokens', accessToken: 'SECRET' }]],
    ['an api key login without a key', [{ type: 'apiKey' }]],
    ['an api key that is not a string', [{ type: 'apiKey', apiKey: 7 }]],
    ['extra fields', [{ type: 'apiKey', apiKey: 'sk-SECRET', base: 'x' }]],
    ['a chatgpt login with extra fields', [{ type: 'chatgpt', useHostedLoginSuccessPage: true }]],
    ['two arguments', [{ type: 'chatgpt' }, 'x']],
  ])('provider.codexLogin rejects %s', async (_label, args) => {
    const bad = await ipc.invoke(channelFor('provider.codexLogin'), trustedEvent, ...(args as unknown[])).catch((e: Error) => e);
    expect((bad as Error).message).toBe('invalid payload for provider.codexLogin');
    expect(providerCalls).toEqual([]);
    expect(logger.messages.join('\n')).not.toContain('SECRET');
  });

  it('treats a sender whose frame accessors throw as untrusted', async () => {
    const disposed = {
      sender: { id: 1, mainFrame },
      get senderFrame(): FrameLike {
        throw new Error('Render frame was disposed');
      },
    };
    const error = await ipc.invoke(channelFor('runtime.getStatus'), disposed).catch((e: Error) => e);
    expect((error as Error).message).toBe('untrusted sender');
  });

  it('leaves unregistered channels without a handler', async () => {
    await expect(ipc.invoke('inquello:op:shell.openExternal', trustedEvent)).rejects.toThrow(/No handler registered/);
    await expect(ipc.invoke('runtime.getStatus', trustedEvent)).rejects.toThrow(/No handler registered/);
    expect(calls).toBe(0);
  });

  it('returns a plain error without internal detail when a handler fails', async () => {
    const failing = new FakeIpcMain();
    const op: Operation = {
      name: 'runtime.getStatus',
      validate: noPayload,
      handle: () => {
        throw new Error('secret internal path /home/x');
      },
    };
    const others = createOperations({ runtimeState: () => 'ready', runtimeVersion: '0.165.0', identity: fakeIdentity(), data: fakeData(), provider: fakeProvider() }).filter(
      (operation) => operation.name !== 'runtime.getStatus',
    );
    registerOperations(failing, [op, ...others], { trustedWebContentsIds: new Set([1]), logger });
    const error = (await failing.invoke(channelFor('runtime.getStatus'), trustedEvent).catch((e: Error) => e)) as Error;
    expect(error.message).toBe('operation failed: runtime.getStatus');
    expect(error.message).not.toContain('/home/x');
  });

  it('refuses an operation set that does not match the published names', () => {
    const op: Operation = { name: 'runtime.getStatus', validate: noPayload, handle: () => null };
    expect(() => registerOperations(new FakeIpcMain(), [], { trustedWebContentsIds: new Set(), logger })).toThrow();
    expect(() => registerOperations(new FakeIpcMain(), [op, op], { trustedWebContentsIds: new Set(), logger })).toThrow();
  });
});

describe('app protocol', () => {
  const root = tempDir('static');
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>t</title>');
  fs.mkdirSync(path.join(root, 'sub'));
  fs.writeFileSync(path.join(root, 'sub', 'a.js'), 'void 0;');
  fs.writeFileSync(path.join(path.dirname(root), `${path.basename(root)}-secret.json`), '{}');

  it('maps / to index.html and nested files under the root', () => {
    expect(resolveAppPath(root, '/')).toBe(path.join(root, 'index.html'));
    expect(resolveAppPath(root, '/index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveAppPath(root, '/sub/a.js')).toBe(path.join(root, 'sub', 'a.js'));
  });

  it.each([
    '/../package.json',
    '/sub/../../package.json',
    '/%2e%2e/package.json',
    '/%2E%2E/package.json',
    '/.%2e/package.json',
    '/sub%2f..%2f..%2fpackage.json',
    '/..%5cpackage.json',
    '/%00index.html',
    '/%zz',
    '/sub//a.js',
    '/sub/',
    '/./index.html',
    '/C:%5cWindows',
    'index.html',
  ])('rejects %s', (pathname) => {
    expect(resolveAppPath(root, pathname)).toBeUndefined();
  });

  it('never resolves outside the root', () => {
    const sibling = `/../${path.basename(root)}-secret.json`;
    expect(resolveAppPath(root, sibling)).toBeUndefined();
  });

  const logger = recordingLogger();
  const get = (url: string, method = 'GET') => serveAppRequest({ url, method }, root, logger);

  it('serves index.html with the CSP header', async () => {
    const response = await get('inquello://app/index.html');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toContain('<title>t</title>');
  });

  it.each([
    'inquello://app/../package.json',
    'inquello://app/%2e%2e/package.json',
    'inquello://app/missing.html',
    'inquello://app/sub',
    'inquello://other/index.html',
    'inquello://app:1/index.html',
    'not a url',
  ])('answers %s with 404', async (url) => {
    const response = await get(url);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('not found');
  });

  it('refuses non-GET methods', async () => {
    expect((await get('inquello://app/index.html', 'POST')).status).toBe(405);
  });

  it("mirrors the CSP meta in the renderer's index.html", () => {
    const html = fs.readFileSync(path.join(desktop, 'src', 'renderer', 'index.html'), 'utf8');
    expect(html).toContain(`content="${CONTENT_SECURITY_POLICY}"`);
  });

  it("widens the CSP only to 'self' for script, style, font and img sources", () => {
    const directives = Object.fromEntries(
      CONTENT_SECURITY_POLICY.split(';').map((directive) => {
        const [name, ...values] = directive.trim().split(/\s+/);
        return [name, values.join(' ')];
      }),
    );
    expect(directives).toEqual({
      'default-src': "'none'",
      'script-src': "'self'",
      'style-src': "'self'",
      'font-src': "'self'",
      'img-src': "'self'",
      'base-uri': "'none'",
      'form-action': "'none'",
    });
  });
});

type Listener = (...args: any[]) => void;

function fakeContents() {
  const listeners = new Map<string, Listener>();
  let windowOpenHandler: ((details: { url: string }) => { action: string }) | undefined;
  return {
    on(name: string, listener: Listener) {
      listeners.set(name, listener);
      return this;
    },
    setWindowOpenHandler(handler: (details: { url: string }) => { action: string }) {
      windowOpenHandler = handler;
    },
    emit(name: string, ...args: unknown[]) {
      listeners.get(name)!(...args);
    },
    open(url: string) {
      return windowOpenHandler!({ url });
    },
    listeners,
  };
}

function navEvent(url: string) {
  return { url, prevented: false, preventDefault() { this.prevented = true; } };
}

describe('webContents policy', () => {
  const logger = recordingLogger();
  const blocked: Array<[string, string]> = [];
  const contents = fakeContents();
  applyContentsPolicy(contents as never, { logger, onBlocked: (kind, url) => blocked.push([kind, url]) });

  it.each(['will-navigate', 'will-frame-navigate', 'will-redirect'])('%s prevents off-app URLs and allows app URLs', (name) => {
    const off = navEvent('https://example.com/');
    contents.emit(name, off);
    expect(off.prevented).toBe(true);
    const fileUrl = navEvent('file:///etc/passwd');
    contents.emit(name, fileUrl);
    expect(fileUrl.prevented).toBe(true);
    const on = navEvent('inquello://app/other.html');
    contents.emit(name, on);
    expect(on.prevented).toBe(false);
  });

  it('denies new windows and webviews, and logs them', () => {
    expect(contents.open('https://example.com/')).toEqual({ action: 'deny' });
    expect(contents.open(APP)).toEqual({ action: 'deny' });
    const attach = navEvent('');
    contents.emit('will-attach-webview', attach, {}, { src: 'https://example.com/' });
    expect(attach.prevented).toBe(true);
    expect(blocked).toContainEqual(['window-open', 'https://example.com/']);
    expect(blocked).toContainEqual(['webview', 'https://example.com/']);
    expect(logger.messages.some((m) => m.startsWith('warn: blocked navigation'))).toBe(true);
  });
});

describe('session policy', () => {
  function fakeSession() {
    const handlers: Record<string, any> = {};
    return {
      handlers,
      setPermissionRequestHandler: (h: unknown) => (handlers.request = h),
      setPermissionCheckHandler: (h: unknown) => (handlers.check = h),
      setDevicePermissionHandler: (h: unknown) => (handlers.device = h),
      webRequest: {
        onBeforeRequest: (h: unknown) => (handlers.beforeRequest = h),
        onHeadersReceived: (h: unknown) => (handlers.headers = h),
      },
    };
  }
  const logger = recordingLogger();
  const session = fakeSession();
  applySessionPolicy(session as never, { logger });

  it.each(['media', 'notifications', 'clipboard-read', 'geolocation', 'openExternal'])('denies the %s permission', (permission) => {
    const decisions: boolean[] = [];
    session.handlers.request(null, permission, (granted: boolean) => decisions.push(granted));
    expect(decisions).toEqual([false]);
    expect(session.handlers.check(null, permission, APP, {})).toBe(false);
  });

  it.each([
    ['https://example.com/', true],
    ['http://127.0.0.1:8080/', true],
    ['file:///etc/passwd', true],
    ['ws://localhost/', true],
    [APP, false],
    ['devtools://devtools/x', false],
  ])('request to %s cancelled=%s', (url, cancelled) => {
    const results: Array<{ cancel?: boolean }> = [];
    session.handlers.beforeRequest({ url }, (result: { cancel?: boolean }) => results.push(result));
    expect(results[0]?.cancel === true).toBe(cancelled);
  });

  it('replaces any response CSP with the app CSP', () => {
    const results: Array<{ responseHeaders: Record<string, string[]> }> = [];
    session.handlers.headers({ responseHeaders: { 'content-security-policy': ['default-src *'] } }, (r: never) => results.push(r));
    expect(results[0]?.responseHeaders).toEqual({ 'Content-Security-Policy': [CONTENT_SECURITY_POLICY] });
  });

  it('installs hooks once per session', () => {
    const before = session.handlers.beforeRequest;
    applySessionPolicy(session as never, { logger });
    expect(session.handlers.beforeRequest).toBe(before);
  });
});

describe('preload', () => {
  it('exposes exactly the frozen runtime, identity, data and provider operations over fixed channels', async () => {
    const exposed: Array<[string, unknown]> = [];
    const invoke = vi.fn(async (...args: unknown[]) => ({ args }));
    vi.resetModules();
    vi.doMock('electron', () => ({
      contextBridge: { exposeInMainWorld: (key: string, api: unknown) => exposed.push([key, api]) },
      ipcRenderer: { invoke, send: vi.fn(), on: vi.fn(), sendSync: vi.fn() },
    }));
    await import('../src/preload/preload');
    vi.doUnmock('electron');

    expect(exposed).toHaveLength(1);
    const [key, api] = exposed[0]!;
    expect(key).toBe('inquello');
    const describe = (value: unknown): unknown =>
      typeof value === 'function'
        ? 'function'
        : typeof value === 'object' && value !== null
          ? Object.fromEntries(Reflect.ownKeys(value).map((k) => [String(k), describe((value as any)[k])]))
          : typeof value;
    expect(describe(api)).toEqual(EXPECTED_BRIDGE_TREE);
    type Op = (...args: unknown[]) => Promise<unknown>;
    const typed = api as {
      runtime: { getStatus: Op };
      identity: { getStatus: Op; signIn: Op; signOut: Op };
      data: { getPolicy: Op; export: Op; import: Op; delete: Op };
      provider: { getStatus: Op; setClaudeKey: Op; verifyClaudeKey: Op; removeClaudeKey: Op; codexLogin: Op; codexLogout: Op };
    };
    expect(Object.isFrozen(typed)).toBe(true);
    expect(Object.isFrozen(typed.runtime)).toBe(true);
    expect(Object.isFrozen(typed.identity)).toBe(true);
    expect(Object.isFrozen(typed.data)).toBe(true);
    expect(Object.isFrozen(typed.provider)).toBe(true);

    // Arguments from the renderer are never forwarded; each channel is fixed.
    const calls: Array<[Op, string]> = [
      [typed.runtime.getStatus, channelFor('runtime.getStatus')],
      [typed.identity.getStatus, channelFor('identity.getStatus')],
      [typed.identity.signIn, channelFor('identity.signIn')],
      [typed.identity.signOut, channelFor('identity.signOut')],
      [typed.provider.getStatus, channelFor('provider.getStatus')],
      [typed.provider.verifyClaudeKey, channelFor('provider.verifyClaudeKey')],
      [typed.provider.removeClaudeKey, channelFor('provider.removeClaudeKey')],
      [typed.provider.codexLogout, channelFor('provider.codexLogout')],
    ];
    for (const [op, channel] of calls) {
      invoke.mockClear();
      await op('inquello:op:other', { extra: true });
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith(channel);
    }

    // Data operations forward the renderer's arguments to main's validators,
    // and only to their own fixed channel.
    const dataCalls: Array<[Op, string]> = [
      [typed.data.getPolicy, channelFor('data.getPolicy')],
      [typed.data.export, channelFor('data.export')],
      [typed.data.import, channelFor('data.import')],
      [typed.data.delete, channelFor('data.delete')],
      [typed.provider.setClaudeKey, channelFor('provider.setClaudeKey')],
      [typed.provider.codexLogin, channelFor('provider.codexLogin')],
    ];
    for (const [op, channel] of dataCalls) {
      invoke.mockClear();
      await op(['task-history']);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith(channel, ['task-history']);
      invoke.mockClear();
      await op();
      expect(invoke).toHaveBeenCalledWith(channel);
    }
  });

  it('uses channel literals that match the registered operation names', () => {
    const source = fs.readFileSync(path.join(desktop, 'src/preload/preload.ts'), 'utf8');
    const channels = [...source.matchAll(/'(inquello:op:[^']+)'/g)].map((m) => m[1]).sort();
    expect(channels).toEqual(OPERATION_NAMES.map((name) => channelFor(name)).sort());
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(desktop, 'src', 'protocol', 'generated')) continue;
      out.push(...sourceFiles(full));
    } else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('host privilege source scan', () => {
  const files = sourceFiles(path.join(desktop, 'src')).map((file) => ({
    rel: path.relative(desktop, file).split(path.sep).join('/'),
    text: fs.readFileSync(file, 'utf8'),
  }));

  it('uses child_process only under src/main/runtime/', () => {
    const users = files.filter((f) => f.text.includes('child_process')).map((f) => f.rel);
    expect(users.length).toBeGreaterThan(0);
    for (const rel of users) expect(rel.startsWith('src/main/runtime/')).toBe(true);
  });

  it('references Electron shell only in the system-browser module', () => {
    const users = files
      .filter(({ text }) => (/\bshell\s*[,}]/.test(text) && /from 'electron'/.test(text)) || /\bshell\.\w+/.test(text))
      .map((f) => f.rel);
    expect(users).toEqual(['src/main/identity/browser.ts']);
    const browser = files.find((f) => f.rel === 'src/main/identity/browser.ts')!.text;
    expect(browser).toMatch(/^import \{ shell \} from 'electron';$/m);
    expect([...new Set(browser.match(/shell\.\w+/g))]).toEqual(['shell.openExternal']);
    expect(browser).not.toMatch(/openPath|showItemInFolder|trashItem|writeShortcutLink/);
    // No embedded login window: identity code never creates a BrowserWindow or webview.
    for (const { rel, text } of files.filter((f) => f.rel.startsWith('src/main/identity/'))) {
      expect(text, rel).not.toMatch(/BrowserWindow|webview|loadURL/);
    }
  });

  it('keeps ipcRenderer inside the preload', () => {
    const users = files.filter((f) => f.text.includes('ipcRenderer')).map((f) => f.rel);
    // smoke-probe lists it as a forbidden renderer global.
    expect(users.sort()).toEqual(['src/main/smoke-probe.ts', 'src/preload/preload.ts']);
    const probe = files.find((f) => f.rel === 'src/main/smoke-probe.ts')!.text;
    expect(probe).not.toMatch(/from 'electron'.*ipcRenderer|ipcRenderer.*from 'electron'/);
  });

  it('preload imports only electron and exposes one bridge', () => {
    const preload = files.find((f) => f.rel === 'src/preload/preload.ts')!.text;
    const imports = [...preload.matchAll(/(?:from\s+|require\()\s*'([^']+)'/g)].map((m) => m[1]);
    expect(imports).toEqual(['electron']);
    expect(preload.match(/exposeInMainWorld\(/g)).toHaveLength(1);
    // Outside the import, ipcRenderer is used only to invoke a constant channel.
    const body = preload.replace(/^import .* from 'electron';$/m, '');
    const uses = body.match(/ipcRenderer[^\n]*/g) ?? [];
    expect(uses.length).toBeGreaterThan(0);
    for (const use of uses) expect(use).toMatch(/^ipcRenderer\.invoke\([A-Z_]+_CHANNEL(?:, \.\.\.args)?\)/);
    // Only the data operations and the two provider operations that take what the user entered forward arguments.
    expect((body.match(/_CHANNEL, \.\.\.args\)/g) ?? []).length).toBe(6);
    expect(
      body
        .match(/[A-Z_]+_CHANNEL, \.\.\.args\)/g)
        ?.every((use) => use.startsWith('DATA_') || use.startsWith('PROVIDER_SET_CLAUDE_KEY_') || use.startsWith('PROVIDER_CODEX_LOGIN_')),
    ).toBe(true);
    expect(preload).not.toMatch(/\.on\(|\.send\(|sendSync|postMessage/);
  });
});

describe('smoke privilege evaluation', () => {
  const clean: RendererProbeResult = {
    globals: Object.fromEntries(['require', 'process', 'module', 'exports', 'Buffer', 'global', 'ipcRenderer', 'electron'].map((n) => [n, 'undefined'])),
    bridge: EXPECTED_BRIDGE_TREE,
    bridgeFrozen: true,
    status: { state: 'ready', runtimeVersion: '0.165.0' },
    windowOpen: 'blocked',
    fetch: 'blocked',
  };

  it('passes a clean renderer', () => {
    expect(evaluatePrivileges(clean, 'blocked', APP, '0.165.0')).toMatchObject({ ok: true, failures: [] });
  });

  it.each<[string, Partial<RendererProbeResult>, 'blocked' | 'allowed']>([
    ['require present', { globals: { ...clean.globals, require: 'function' } }, 'blocked'],
    ['extra bridge key', { bridge: { runtime: { getStatus: 'function' }, ipc: 'object' } }, 'blocked'],
    ['runtime not ready', { status: { state: 'failed', runtimeVersion: '0.165.0' } }, 'blocked'],
    ['getStatus rejected', { status: undefined, statusError: 'untrusted sender' }, 'blocked'],
    ['window opened', { windowOpen: 'opened' }, 'blocked'],
    ['fetch allowed', { fetch: 'allowed' }, 'blocked'],
    ['navigation allowed', {}, 'allowed'],
  ])('fails when %s', (_label, change, navigation) => {
    expect(evaluatePrivileges({ ...clean, ...change }, navigation, APP, '0.165.0').ok).toBe(false);
  });
});
