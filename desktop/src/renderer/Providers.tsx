/**
 * The Providers block (Story 1.13): the two provider routes, each shown apart
 * from the Inquello identity.
 *
 * - Claude API key: a password field whose key is handed to main once through
 *   `provider.setClaudeKey` and cleared from the field at once, whatever the
 *   outcome. After that the block sees only the key's state and where it is
 *   stored. "Check key" runs the free model-list check, only on request.
 * - Codex login: an API key (password field, cleared the same way) or a
 *   ChatGPT sign-in in the system browser; the runtime keeps either in the OS
 *   keyring.
 *
 * Built from the Story 1.6–1.8 primitives; talks to main only through the
 * named `inquello.provider` operations. Data attributes expose the rendered
 * state to the smoke probe.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { parseProviderAction, parseProviderStatus, providerBridge, type ProviderStatusView } from './bridge';
import { Button, StatusChip, TextField } from './primitives';

/** How often the block re-reads the status; faster while a ChatGPT sign-in waits. */
const STATUS_INTERVAL_MS = 30_000;
const CONNECTING_INTERVAL_MS = 2_000;

const CLAUDE_TEXT = {
  'not-configured': 'No key set',
  'stored-unverified': 'Key stored, not checked',
  verified: 'Key accepted by Anthropic',
  rejected: 'Key refused by Anthropic',
  unreachable: 'Key stored; Anthropic unreachable',
} as const;

const CODEX_TEXT = {
  unavailable: 'Runtime unavailable',
  'not-connected': 'Not connected',
  connecting: 'Waiting for the browser',
  connected: 'Connected',
} as const;

const STORAGE_TEXT = {
  'os-backed': "The key is kept encrypted with this computer's credential store.",
  'memory-only': 'The key is not remembered: no OS credential store is available, so it lasts until Inquello quits.',
} as const;

type Action = 'claude-store' | 'claude-verify' | 'claude-remove' | 'codex-api-key' | 'codex-chatgpt' | 'codex-logout';

function accountText(status: ProviderStatusView): string {
  const account = status.codex.account;
  if (!account) return 'No Codex login is held.';
  if (account.type === 'apiKey') return 'Signed in with an API key, held in the OS keyring.';
  if (account.type === 'chatgpt') return `Signed in with ChatGPT${account.planType ? ` (${account.planType} plan)` : ''}, held in the OS keyring.`;
  return 'Signed in by another method.';
}

export function Providers(): ReactElement {
  const bridge = providerBridge();
  const [status, setStatus] = useState<ProviderStatusView | null>(null);
  const [claudeKey, setClaudeKey] = useState('');
  const [codexKey, setCodexKey] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bridge) return;
    try {
      const next = parseProviderStatus(await bridge.getStatus());
      if (next) setStatus(next);
    } catch {
      setNotice('The provider status could not be read.');
    }
  }, [bridge]);

  const connecting = status?.codex.state === 'connecting';
  useEffect(() => {
    if (!bridge) return;
    void load();
    const timer = setInterval(() => void load(), connecting ? CONNECTING_INTERVAL_MS : STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [bridge, load, connecting]);

  const act = async (action: Action) => {
    if (!bridge) return;
    setBusy(action);
    setNotice(null);
    let call: Promise<unknown>;
    switch (action) {
      case 'claude-store': {
        const key = claudeKey.trim();
        // The field is cleared as the key leaves it, whatever main answers.
        setClaudeKey('');
        call = bridge.setClaudeKey(key);
        break;
      }
      case 'claude-verify':
        call = bridge.verifyClaudeKey();
        break;
      case 'claude-remove':
        call = bridge.removeClaudeKey();
        break;
      case 'codex-api-key': {
        const apiKey = codexKey.trim();
        setCodexKey('');
        call = bridge.codexLogin({ type: 'apiKey', apiKey });
        break;
      }
      case 'codex-chatgpt':
        call = bridge.codexLogin({ type: 'chatgpt' });
        break;
      case 'codex-logout':
        call = bridge.codexLogout();
        break;
    }
    try {
      const result = parseProviderAction(await call);
      if (result?.status) setStatus(result.status);
      if (!result) setNotice('The request did not complete.');
      else if (!result.ok) setNotice(result.reason ?? 'The request did not complete.');
    } catch {
      setNotice('The request did not complete.');
    } finally {
      setBusy(null);
    }
  };

  const loading = bridge ? 'The provider status is loading.' : 'Provider actions are available in the desktop app only.';
  const anyBusy = busy !== null ? 'Another provider action is in progress.' : undefined;
  const claude = status?.claude.state ?? null;
  const codex = status?.codex.state ?? null;
  const storeReason = !status ? loading : (anyBusy ?? (claudeKey.trim() === '' ? 'Enter a Claude API key first.' : undefined));
  const verifyReason = !status ? loading : (anyBusy ?? (claude === 'not-configured' ? 'No Claude API key is stored.' : undefined));
  const removeReason = verifyReason;
  const codexReady = !status ? loading : codex === 'unavailable' ? (status.codex.reason ?? 'The runtime is unavailable.') : anyBusy;
  const codexKeyReason = codexReady ?? (codex === 'connecting' ? 'A ChatGPT sign-in is waiting for the browser.' : codexKey.trim() === '' ? 'Enter an API key first.' : undefined);
  const chatgptReason = codexReady ?? (codex === 'connecting' ? 'A ChatGPT sign-in is already waiting for the browser.' : undefined);
  const logoutReason = codexReady ?? (codex === 'not-connected' ? 'No Codex login is connected.' : undefined);

  return (
    <div
      className="specimen-account specimen-providers"
      data-providers=""
      data-claude-state={claude ?? 'unknown'}
      data-claude-storage={status?.claude.storage ?? 'unknown'}
      data-codex-state={codex ?? 'unknown'}
      data-codex-account={status?.codex.account?.type ?? 'none'}
    >
      <p className="specimen-account-note">Provider credentials only authorize inference. They never change your Inquello identity, and signing out of Inquello keeps them.</p>
      <dl className="specimen-account-states">
        <div className="specimen-account-state">
          <dt>Claude API key</dt>
          <dd>
            <StatusChip status={`provider-claude-${claude ?? 'unknown'}`} label={claude ? CLAUDE_TEXT[claude] : 'Checking'} />
            {status ? <span className="specimen-account-note">{status.routes['claude-api-key'].reason}</span> : null}
          </dd>
        </div>
        <div className="specimen-account-state">
          <dt>Key storage</dt>
          <dd className="specimen-account-note">{status ? STORAGE_TEXT[status.claude.storage] : 'Checking'}</dd>
        </div>
        <div className="specimen-account-state">
          <dt>Codex login</dt>
          <dd>
            <StatusChip status={`provider-codex-${codex ?? 'unknown'}`} label={codex ? CODEX_TEXT[codex] : 'Checking'} />
            {status ? <span className="specimen-account-note">{accountText(status)}</span> : null}
            {status?.codex.reason ? <span className="specimen-account-note">{status.codex.reason}</span> : null}
          </dd>
        </div>
      </dl>
      <div className="specimen-provider-form" data-provider-claude="">
        <TextField
          id="provider-claude-key"
          type="password"
          autoComplete="off"
          label="Claude API key"
          instruction="Stored by Inquello's main process; never shown again."
          value={claudeKey}
          onChange={setClaudeKey}
        />
        <div className="specimen-account-actions">
          <Button variant="primary" data-provider-action="claude-store" pending={busy === 'claude-store'} disabledReason={busy === 'claude-store' ? undefined : storeReason} onPress={() => void act('claude-store')}>
            Store key
          </Button>
          <Button variant="secondary" data-provider-action="claude-verify" pending={busy === 'claude-verify'} pendingText="Checking" disabledReason={busy === 'claude-verify' ? undefined : verifyReason} onPress={() => void act('claude-verify')}>
            Check key
          </Button>
          <Button variant="quiet" data-provider-action="claude-remove" pending={busy === 'claude-remove'} disabledReason={busy === 'claude-remove' ? undefined : removeReason} onPress={() => void act('claude-remove')}>
            Remove key
          </Button>
        </div>
      </div>
      <div className="specimen-provider-form" data-provider-codex="">
        <TextField
          id="provider-codex-key"
          type="password"
          autoComplete="off"
          label="OpenAI API key for Codex"
          instruction="Handed to the runtime, which keeps it in the OS keyring."
          value={codexKey}
          onChange={setCodexKey}
        />
        <div className="specimen-account-actions">
          <Button variant="primary" data-provider-action="codex-api-key" pending={busy === 'codex-api-key'} disabledReason={busy === 'codex-api-key' ? undefined : codexKeyReason} onPress={() => void act('codex-api-key')}>
            Connect with API key
          </Button>
          <Button variant="secondary" data-provider-action="codex-chatgpt" pending={busy === 'codex-chatgpt'} pendingText="Opening the browser" disabledReason={busy === 'codex-chatgpt' ? undefined : chatgptReason} onPress={() => void act('codex-chatgpt')}>
            Sign in with ChatGPT
          </Button>
          <Button variant="quiet" data-provider-action="codex-logout" pending={busy === 'codex-logout'} disabledReason={busy === 'codex-logout' ? undefined : logoutReason} onPress={() => void act('codex-logout')}>
            Disconnect
          </Button>
        </div>
      </div>
      {notice ? (
        <p className="specimen-account-note" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
