import {parseRoute,record} from '../main/routes/types';
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
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';

import {useProviderConsent} from './provider-consent';
import type {ProviderFocusTarget} from './provider-settings';
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
  if (!account) return 'No OpenAI connection is saved.';
  if (account.type === 'apiKey') return 'Signed in with an API key, held in the OS keyring.';
  if (account.type === 'chatgpt') return `Signed in with ChatGPT${account.planType ? ` (${account.planType} plan)` : ''}, held in the OS keyring.`;
  return 'A saved provider credential is available. Account details have not been checked.';
}

export function Providers({focusTarget,workspaceId=null}:{focusTarget?:ProviderFocusTarget;workspaceId?:string|null}={}): ReactElement {
  const panel=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!focusTarget)return;
    // Runs after the actual provider panel commits, never a guessed delay or action.
    const selector=focusTarget==='codex-chatgpt'?'[data-provider-action="codex-chatgpt"]':`#${focusTarget}`;
    const target=panel.current?.querySelector<HTMLElement>(selector);
    target?.focus();target?.scrollIntoView?.({block:'center'});
  },[focusTarget]);
  const bridge = providerBridge();
  const consent=useProviderConsent(bridge,workspaceId);
  const [status, setStatus] = useState<ProviderStatusView | null>(null);
  const [claudeKey, setClaudeKey] = useState('');
  const [codexKey, setCodexKey] = useState('');
  const [busy, setBusy] = useState<Action | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chatgptQualified,setChatgptQualified]=useState(false);
  useEffect(()=>{let live=true,sequence=0;const routes=(globalThis as {inquello?:{routes?:{list():Promise<unknown>;onChanged?(fn:()=>void):()=>void}}}).inquello?.routes;const check=async()=>{const n=++sequence;setChatgptQualified(false);try{if(!routes) return;const response=record(await routes.list());if(response.ok!==true||!Array.isArray(response.value))return;const rows=response.value.map(parseRoute);if(live&&n===sequence)setChatgptQualified(rows.some(row=>row.configuration?.deployment==='chatgpt-codex'&&row.adapterSupported&&row.verification==='verified_for_real_data'&&row.evidence.length>0));}catch{/* Unknown qualification never offers OAuth as working. */}};void check();const off=routes?.onChanged?.(()=>void check());return()=>{live=false;sequence++;off?.();};},[status?.codex.account?.type]);

  const load = useCallback(async (explicit=false) => {
    if (!bridge) return;
    try {
      const next = parseProviderStatus(await (explicit&&bridge.refreshStatus?bridge.refreshStatus():bridge.getStatus()));
      if (next) { setStatus(next); setNotice(current => current === 'The provider status could not be read.' ? null : current); }
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
    if (!bridge) return false;
    setBusy(action);
    setNotice(null);
    try {
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
          if(!chatgptQualified){setBusy(null);return false;}
          call = bridge.codexLogin({ type: 'chatgpt' });
          break;
        case 'codex-logout':
          call = bridge.codexLogout();
          break;
      }
      const result = parseProviderAction(await call);
      if (result?.status) setStatus(result.status);
      if (!result) setNotice('The request did not complete.');
      else if (!result.ok) setNotice(result.reason ?? 'The request did not complete.');
      return result?.ok===true;
    } catch {
      setNotice('The request did not complete.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const loading = bridge ? 'The provider status is loading.' : 'Provider actions are available in the desktop app only.';
  const anyBusy = busy !== null || consent.busy ? 'Another provider action is in progress.' : undefined;
  const claude = status?.claude.state ?? null;
  const codex = status?.codex.state ?? null;
  const storeReason = !status ? loading : (anyBusy ?? (claudeKey.trim() === '' ? 'Enter a Claude API key first.' : undefined));
  const verifyReason = !status ? loading : (anyBusy ?? (claude === 'not-configured' ? 'No Claude API key is stored.' : undefined));
  const removeReason = verifyReason;
  const codexReady = !status ? loading : codex === 'unavailable' ? (status.codex.reason ?? 'The runtime is unavailable.') : anyBusy;
  const codexKeyReason = codexReady ?? (codex === 'connecting' ? 'A ChatGPT sign-in is waiting for the browser.' : codexKey.trim() === '' ? 'Enter an API key first.' : undefined);
  const chatgptReason = !chatgptQualified?'ChatGPT sign-in is not available for a supported model in this build. Use an OpenAI API key.':codexReady ?? (codex === 'connecting' ? 'A ChatGPT sign-in is already waiting for the browser.' : undefined);
  const logoutReason = codexReady ?? (codex === 'not-connected' ? 'No OpenAI connection is saved.' : undefined);

  const needsOwnerConsent=!!consent.state?.view.can_manage&&consent.state.view.state!=='allowed'&&!consent.state.pending;
  return (
    <div
      ref={panel}
      className="specimen-account specimen-providers"
      data-providers=""
      data-claude-state={claude ?? 'unknown'}
      data-claude-storage={status?.claude.storage ?? 'unknown'}
      data-codex-state={codex ?? 'unknown'}
      data-codex-account={status?.codex.account?.type ?? 'none'}
    >
      <h3>Connect your AI providers</h3>
      <p className="specimen-account-note">Connect an account, then choose a model in your conversation. Provider credentials stay separate from your Inquello identity.</p>
      <p className="specimen-account-note">A stored key or connected account does not establish model access or qualification.</p>
      <Button variant="quiet" disabledReason={anyBusy} onPress={() => void load(true)}>Refresh provider status</Button>
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
          <dt>OpenAI connection</dt>
          <dd>
            <StatusChip status={`provider-codex-${codex ?? 'unknown'}`} label={codex ? CODEX_TEXT[codex] : 'Checking'} />
            {status ? <span className="specimen-account-note">{accountText(status)}</span> : null}
            {status?.codex.reason ? <span className="specimen-account-note">{status.codex.reason}</span> : null}
          </dd>
        </div>
      </dl>
      <div className="specimen-provider-form" data-provider-claude="">
        <h4>Anthropic API</h4>
        <p className="specimen-account-note">Use your Anthropic API credits. Store your key, then optionally check account access. Check key does not send a prompt or test the selected model.</p>
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
        <h4>OpenAI</h4>
        {!workspaceId?<p className="specimen-account-note">Choose your workspace in chat to manage its OpenAI permission. You can still connect your personal account.</p>:null}
        {workspaceId&&!consent.state?<p className="specimen-account-note">{consent.notice??'Checking workspace permission…'}</p>:null}
        {consent.state?<div data-provider-consent="">
          <p className="specimen-account-note"><strong>{consent.state.view.workspace_name}</strong>: {consent.state.view.state==='allowed'?'OpenAI is allowed for this workspace.':consent.state.view.can_manage?'OpenAI needs your workspace permission.':'Ask your workspace owner to allow OpenAI. You can still connect your personal account.'}</p>
          {consent.state.view.can_manage?<p className="specimen-account-note">{consent.state.view.consent_text}</p>:null}
          {consent.state.pending?<div className="specimen-account-actions">
            <p className="specimen-account-note">A permission change is not confirmed. Check its result before making another change.</p>
            <Button variant="secondary" disabledReason={anyBusy} onPress={()=>void consent.act('reconcile')}>Check permission result</Button>
            <Button variant="quiet" disabledReason={anyBusy} onPress={()=>void consent.act('retry')}>Retry same permission request</Button>
          </div>:consent.state.view.can_manage?<div className="specimen-account-actions">
            {needsOwnerConsent&&status?.codex.account?.type==='apiKey'?<Button variant="primary" disabledReason={anyBusy} onPress={()=>void consent.act('allow')}>Allow OpenAI for this workspace</Button>:null}
            {consent.state.view.state==='allowed'?<Button variant="quiet" disabledReason={anyBusy} onPress={()=>void consent.act('revoke')}>Revoke workspace OpenAI permission</Button>:null}
          </div>:null}
          {consent.notice?<p role="status" className="specimen-account-note">{consent.notice}</p>:null}
          <p className="specimen-account-note">Disconnect removes only your personal connection. Workspace permission is separate; it does not share your key or send a message.</p>
        </div>:null}
        <p className="specimen-account-note">Use your OpenAI API credits with an API key. A ChatGPT subscription is separate.</p>
        <TextField
          id="provider-codex-key"
          type="password"
          autoComplete="off"
          label="OpenAI API key"
          instruction="Stored securely in this computer’s credential store."
          value={codexKey}
          onChange={setCodexKey}
        />
        <div className="specimen-account-actions">
          <Button variant="primary" data-provider-action="codex-api-key" pending={busy === 'codex-api-key'} disabledReason={busy === 'codex-api-key' ? undefined : codexKeyReason} onPress={() => void (needsOwnerConsent?consent.act('allow',()=>act('codex-api-key')):act('codex-api-key'))}>
            {needsOwnerConsent?'Connect and allow':'Connect with API key'}
          </Button>
          <Button variant="secondary" data-provider-action="codex-chatgpt" pending={busy === 'codex-chatgpt'} pendingText="Opening the browser" disabledReason={busy === 'codex-chatgpt' ? undefined : chatgptReason} onPress={() => void act('codex-chatgpt')}>
            Sign in with ChatGPT
          </Button>
          <Button variant="quiet" data-provider-action="codex-logout" pending={busy === 'codex-logout'} disabledReason={busy === 'codex-logout' ? undefined : logoutReason} onPress={() => void act('codex-logout')}>
            {connecting ? 'Cancel sign-in and disconnect' : 'Disconnect'}
          </Button>
        </div>
      </div>
      {connecting ? <p className="specimen-account-note">Finish in your browser. Cancel sign-in and disconnect also removes any saved OpenAI connection; it does not sign you out of Inquello.</p> : null}
      {notice ? (
        <p className="specimen-account-note" role="status">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
