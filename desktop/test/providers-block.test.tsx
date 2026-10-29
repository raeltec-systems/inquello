// @vitest-environment jsdom
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/**
 * Story 1.13: the Providers block on the specimen page. Both key fields are
 * password fields, cleared as soon as the key is submitted whatever main
 * answers; the block shows only route states, storage kinds and route
 * authorization, apart from the identity; and it reaches main only through
 * the named `inquello.provider` operations. Also covers the bridge parser and
 * the smoke's pure `evaluateProviders`.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Providers } from '../src/renderer/Providers';
import { parseProviderStatus, type ProviderStatusView } from '../src/renderer/bridge';
import { evaluateProviders, sentinelNeedles, type ProviderProbeRead } from '../src/main/smoke-probe';

const KEY = 'sk-ant-api03-block-test-0123456789abcdef';

function status(claude: ProviderStatusView['claude']['state'], codex: ProviderStatusView['codex']['state'], extra: Partial<ProviderStatusView['codex']> = {}): ProviderStatusView {
  return {
    claude: { state: claude, storage: 'os-backed' },
    codex: { state: codex, account: codex === 'connected' ? { type: 'apiKey' } : null, credentialStore: 'os-keyring', ...extra },
    routes: {
      'claude-api-key': { authorized: claude !== 'not-configured' && claude !== 'rejected', reason: `Claude route ${claude}.` },
      'codex-inherited': { authorized: codex === 'connected', reason: `Codex route ${codex}.` },
    },
  };
}

function installBridge(overrides: Partial<Record<string, (...args: unknown[]) => Promise<unknown>>> = {}) {
  let current = status('not-configured', 'not-connected');
  const answer = (next: ProviderStatusView, ok = true, reason?: string) => {
    current = next;
    return { ok, ...(reason ? { reason } : {}), status: next };
  };
  const bridge = {
    getStatus: vi.fn(async () => current),
    setClaudeKey: vi.fn(async (key: unknown) => (String(key).startsWith('sk-ant-') ? answer(status('stored-unverified', current.codex.state)) : answer(current, false, 'A Claude API key starts with sk-ant-.'))),
    verifyClaudeKey: vi.fn(async () => answer(status('rejected', current.codex.state), false, 'Anthropic refused this Claude API key. It stays stored until you remove it.')),
    removeClaudeKey: vi.fn(async () => answer(status('not-configured', current.codex.state))),
    codexLogin: vi.fn(async (request: unknown) =>
      (request as { type: string }).type === 'chatgpt' ? answer(status(current.claude.state, 'connecting')) : answer(status(current.claude.state, 'connected')),
    ),
    codexLogout: vi.fn(async () => answer(status(current.claude.state, 'not-connected'))),
    ...overrides,
  };
  (globalThis as { inquello?: unknown }).inquello = Object.freeze({ provider: Object.freeze(bridge) });
  return bridge;
}

afterEach(() => {
  cleanup();
  delete (globalThis as { inquello?: unknown }).inquello;
});

const button = (name: string) => screen.getByRole('button', { name });
const block = () => document.querySelector<HTMLElement>('[data-providers]')!;

describe('Providers block', () => {
  it('shows both routes apart from the identity, with password fields', async () => {
    installBridge();
    render(<Providers />);
    expect(await screen.findByText('No key set')).toBeTruthy();
    expect(screen.getByText('Not connected')).toBeTruthy();
    expect(screen.getByText(/never change your Inquello identity/)).toBeTruthy();
    expect(screen.getByLabelText('Claude API key').getAttribute('type')).toBe('password');
    expect(screen.getByLabelText('OpenAI API key for Codex').getAttribute('type')).toBe('password');
    expect(block().getAttribute('data-claude-state')).toBe('not-configured');
    expect(block().getAttribute('data-codex-state')).toBe('not-connected');
    expect(button('Store key').getAttribute('aria-disabled')).toBe('true');
    expect(button('Check key').getAttribute('aria-disabled')).toBe('true');
  });

  it('hands the Claude key to main once, clears the field, and never shows the key again (matrix: Store Claude key)', async () => {
    const bridge = installBridge();
    render(<Providers />);
    await screen.findByText('No key set');
    const field = screen.getByLabelText<HTMLInputElement>('Claude API key');
    await userEvent.type(field, `  ${KEY}  `);
    await userEvent.click(button('Store key'));
    expect(bridge.setClaudeKey).toHaveBeenCalledTimes(1);
    expect(bridge.setClaudeKey).toHaveBeenCalledWith(KEY);
    expect(field.value).toBe('');
    expect(await screen.findByText('Key stored, not checked')).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(KEY.slice(7));
  });

  it('clears the field even when main refuses the key, and shows the reason', async () => {
    installBridge();
    render(<Providers />);
    await screen.findByText('No key set');
    const field = screen.getByLabelText<HTMLInputElement>('Claude API key');
    await userEvent.type(field, 'sk-proj-not-claude-0123456789');
    await userEvent.click(button('Store key'));
    expect(field.value).toBe('');
    expect(await screen.findByText('A Claude API key starts with sk-ant-.')).toBeTruthy();
    expect(document.body.innerHTML).not.toContain('not-claude-0123456789');
  });

  it('checks the key only when asked, and removes it', async () => {
    const bridge = installBridge();
    render(<Providers />);
    await screen.findByText('No key set');
    await userEvent.type(screen.getByLabelText('Claude API key'), KEY);
    await userEvent.click(button('Store key'));
    await screen.findByText('Key stored, not checked');
    expect(bridge.verifyClaudeKey).not.toHaveBeenCalled();
    await userEvent.click(button('Check key'));
    expect(bridge.verifyClaudeKey).toHaveBeenCalledWith();
    expect(await screen.findByText('Key refused by Anthropic')).toBeTruthy();
    expect(screen.getByText(/stays stored until you remove it/)).toBeTruthy();
    await userEvent.click(button('Remove key'));
    expect(await screen.findByText('No key set')).toBeTruthy();
  });

  it('connects Codex with an API key (field cleared) or ChatGPT, and disconnects (matrix: Codex API-key login, Codex logout)', async () => {
    const bridge = installBridge();
    render(<Providers />);
    await screen.findByText('Not connected');
    const field = screen.getByLabelText<HTMLInputElement>('OpenAI API key for Codex');
    await userEvent.type(field, 'sk-proj-block-test');
    await userEvent.click(button('Connect with API key'));
    expect(bridge.codexLogin).toHaveBeenCalledWith({ type: 'apiKey', apiKey: 'sk-proj-block-test' });
    expect(field.value).toBe('');
    expect(await screen.findByText('Connected')).toBeTruthy();
    expect(screen.getByText(/API key, held in the OS keyring/)).toBeTruthy();
    await userEvent.click(button('Disconnect'));
    expect(await screen.findByText('Not connected')).toBeTruthy();
    await userEvent.click(button('Sign in with ChatGPT'));
    expect(bridge.codexLogin).toHaveBeenLastCalledWith({ type: 'chatgpt' });
    expect(await screen.findByText('Waiting for the browser')).toBeTruthy();
  });

  it('says why Codex actions are unavailable while the runtime is down', async () => {
    installBridge({ getStatus: async () => status('not-configured', 'unavailable', { reason: 'The runtime is not running, so the Codex login cannot be read or changed.' }) });
    render(<Providers />);
    expect(await screen.findByText('Runtime unavailable')).toBeTruthy();
    expect(button('Sign in with ChatGPT').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('provider status parser', () => {
  it('accepts the published shape and drops anything else', () => {
    const raw = { ...status('verified', 'connected'), key: KEY, identity: { state: 'signed-in' } };
    (raw.codex as Record<string, unknown>).email = 'a@b.c';
    const parsed = parseProviderStatus(raw);
    expect(parsed).toEqual(status('verified', 'connected'));
    expect(JSON.stringify(parsed)).not.toMatch(/sk-ant|a@b|identity/);
  });
  it('refuses unknown states', () => {
    expect(parseProviderStatus({ ...status('verified', 'connected'), claude: { state: 'leaked', storage: 'os-backed' } })).toBeNull();
    expect(parseProviderStatus(null)).toBeNull();
  });
});

describe('smoke providers evaluation', () => {
  const clean: ProviderProbeRead = {
    inheritedVars: ['OPENAI_API_KEY'],
    childEnvChecked: true,
    childEnvLeaks: [],
    preexistingCodexLogin: false,
    initial: { claude: 'not-configured', codex: 'not-connected' },
    connect: {
      before: null,
      claudePassword: true,
      claudeStore: { pressed: true, reached: true },
      claudeFieldCleared: true,
      codexPassword: true,
      codexLogin: { pressed: true, reached: true },
      codexFieldCleared: true,
      connected: null,
      extraRejected: true,
    },
    connectedStatus: { claude: 'stored-unverified', storage: 'os-backed', codex: 'connected', account: 'apiKey' },
    vault: { exists: true, mode: 0o600, dirMode: 0o700, plaintext: false },
    authJson: false,
    identitySignOut: { identityBefore: 'signed-in', identityAfter: 'signed-out', providersUnchanged: true },
    identityUnchanged: true,
    disconnect: { claudeRemove: { pressed: true, reached: true }, codexLogout: { pressed: true, reached: true }, disconnected: null },
    finalStatus: { claude: 'not-configured', codex: 'not-connected' },
    vaultAfterRemove: false,
    exportOk: true,
    leaks: [],
    searched: 40,
  };

  it('passes a clean run', () => {
    expect(evaluateProviders(clean)).toMatchObject({ ok: true, failures: [] });
  });

  it.each([
    ['a leak', { leaks: ['file:/x'] }, /sentinel was found in: file:\/x/],
    ['an inherited key in the runtime', { childEnvLeaks: ['OPENAI_API_KEY'] }, /reached the app-server/],
    ['auth.json', { authJson: true }, /auth\.json/],
    ['a sign-out that changed providers', { identitySignOut: { identityBefore: 'signed-in', identityAfter: 'signed-out', providersUnchanged: false } }, /sign-out changed a provider/],
    ['memory-only storage', { connectedStatus: { claude: 'stored-unverified', storage: 'memory-only', codex: 'connected', account: 'apiKey' } }, /not os-backed/],
    ['a plaintext vault', { vault: { exists: true, mode: 0o600, dirMode: 0o700, plaintext: true } }, /plaintext/],
    ['a vault left after removal', { vaultAfterRemove: true }, /still present/],
    ['no inherited variable', { inheritedVars: [] }, /environment check did not run/],
  ] as const)('fails on %s', (_label, change, message) => {
    const report = evaluateProviders({ ...clean, ...(change as Partial<ProviderProbeRead>) });
    expect(report.ok).toBe(false);
    expect(report.failures.join('; ')).toMatch(message);
  });

  it('searches for the sentinel and every 8-character fragment of its random part', () => {
    const random = '0123abcd-4567-89ef-0123-456789abcdef';
    const needles = sentinelNeedles(`sk-ant-x-${random}`, random);
    expect(needles).toContain(`sk-ant-x-${random}`);
    expect(needles).toContain('0123abcd');
    expect(needles).toContain('89abcdef');
    expect(needles.filter((needle) => needle.length === 8)).toHaveLength(25);
  });
});
