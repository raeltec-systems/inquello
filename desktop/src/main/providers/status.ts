/**
 * Provider status (Story 1.13): the two provider routes, kept apart from the
 * Inquello identity.
 *
 * - `claude`: the Claude API key held in the main-process vault. The renderer
 *   sees only its state and where it is stored, never the key or a fragment.
 * - `codex`: the inherited Codex login (API key or ChatGPT), held by the
 *   runtime in the OS keyring and read through `account/read`.
 *
 * This status is never merged into the identity status, and nothing here
 * reads or changes the Inquello session, membership or grants. Connecting,
 * expiring, revoking or removing a route changes only that route's state and
 * what `inferenceRoutes` derives from it.
 */
import type { CredentialStorage } from '../identity/vault';
import type { ClaudeKeyState } from './claude-vault';

export type CodexState = 'unavailable' | 'not-connected' | 'connecting' | 'connected';

export type CodexAccountView = { type: 'apiKey' } | { type: 'chatgpt'; planType: string | null } | { type: 'other' };

export interface ClaudeRouteStatus {
  state: ClaudeKeyState;
  storage: CredentialStorage;
}

export interface CodexRouteStatus {
  state: CodexState;
  /** The connected account kind; never an email, key or token. */
  account: CodexAccountView | null;
  /** Where the runtime keeps a Codex login: always the OS keyring. */
  credentialStore: 'os-keyring';
  /** Why the route is unavailable or the last action failed, as a fixed sentence. */
  reason?: string;
}

export interface ProviderStatus {
  claude: ClaudeRouteStatus;
  codex: CodexRouteStatus;
}

/** What the renderer receives: the status plus the route authorization derived from it. */
export interface ProviderStatusView extends ProviderStatus {
  routes: Record<RouteId, RouteAuthorization>;
}

export interface ProviderActionResult {
  ok: boolean;
  reason?: string;
  status: ProviderStatus;
}

export interface ProviderActionView {
  ok: boolean;
  reason?: string;
  status: ProviderStatusView;
}

export type RouteId = 'claude-api-key' | 'codex-inherited';

export interface RouteAuthorization {
  /** Whether a credential the user set through Inquello currently authorizes this route's inference. */
  authorized: boolean;
  reason: string;
}

/**
 * Inference-route authorization from provider status alone (pure). A route is
 * authorized when its credential is held and was not refused: a Claude key
 * that is stored (verified, unverified, or not checkable right now) or a
 * connected Codex login. Inquello identity plays no part, in either
 * direction. Authorization is not enablement: a route still needs its
 * adapter and capability register entry before any Task uses it.
 */
export function inferenceRoutes(status: ProviderStatus): Record<RouteId, RouteAuthorization> {
  const claude: RouteAuthorization = (() => {
    switch (status.claude.state) {
      case 'not-configured':
        return { authorized: false, reason: 'No Claude API key is set.' };
      case 'rejected':
        return { authorized: false, reason: 'Anthropic refused the stored Claude API key.' };
      case 'verified':
        return { authorized: true, reason: 'A Claude API key is stored and Anthropic accepted it.' };
      case 'unreachable':
        return { authorized: true, reason: 'A Claude API key is stored; Anthropic could not be reached to check it.' };
      case 'stored-unverified':
        return { authorized: true, reason: 'A Claude API key is stored and has not been checked.' };
    }
  })();
  const codex: RouteAuthorization =
    status.codex.state === 'connected'
      ? { authorized: true, reason: 'A Codex login is held in the OS keyring.' }
      : status.codex.state === 'unavailable'
        ? { authorized: false, reason: 'The runtime cannot report the Codex login.' }
        : { authorized: false, reason: 'No Codex login is connected.' };
  return { 'claude-api-key': claude, 'codex-inherited': codex };
}

const CLAUDE_STATES: readonly ClaudeKeyState[] = ['not-configured', 'stored-unverified', 'verified', 'rejected', 'unreachable'];
const CODEX_STATES: readonly CodexState[] = ['unavailable', 'not-connected', 'connecting', 'connected'];

/** Rebuilds a status field by field, so nothing beyond the published shape crosses IPC. */
export function toRendererProviderStatus(status: ProviderStatus): ProviderStatusView {
  const claudeState = CLAUDE_STATES.includes(status.claude.state) ? status.claude.state : 'not-configured';
  const codexState = CODEX_STATES.includes(status.codex.state) ? status.codex.state : 'unavailable';
  const account = status.codex.account;
  let accountView: CodexAccountView | null = null;
  if (account?.type === 'apiKey') accountView = { type: 'apiKey' };
  else if (account?.type === 'chatgpt') accountView = { type: 'chatgpt', planType: typeof account.planType === 'string' ? account.planType : null };
  else if (account?.type === 'other') accountView = { type: 'other' };
  const codex: CodexRouteStatus = { state: codexState, account: accountView, credentialStore: 'os-keyring' };
  if (typeof status.codex.reason === 'string') codex.reason = status.codex.reason;
  const clean: ProviderStatus = {
    claude: { state: claudeState, storage: status.claude.storage === 'os-backed' ? 'os-backed' : 'memory-only' },
    codex,
  };
  const routes = inferenceRoutes(clean);
  return {
    ...clean,
    routes: {
      'claude-api-key': { authorized: routes['claude-api-key'].authorized, reason: routes['claude-api-key'].reason },
      'codex-inherited': { authorized: routes['codex-inherited'].authorized, reason: routes['codex-inherited'].reason },
    },
  };
}

export function toRendererProviderResult(result: ProviderActionResult): ProviderActionView {
  const out: ProviderActionView = { ok: result.ok === true, status: toRendererProviderStatus(result.status) };
  if (typeof result.reason === 'string') out.reason = result.reason;
  return out;
}
