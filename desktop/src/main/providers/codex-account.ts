/**
 * The inherited Codex login (Story 1.13), driven through the app-server
 * `account/*` methods.
 *
 * - `login({ type: 'apiKey', apiKey })` sends `account/login/start`; the
 *   runtime stores the key in the OS keyring (`config.toml` sets
 *   `cli_auth_credentials_store = "keyring"`). Without a usable keyring the
 *   runtime refuses and nothing is stored; the reason says so.
 * - `login({ type: 'chatgpt' })` starts the runtime's ChatGPT login and opens
 *   its authorization URL in the system browser through `identity/browser.ts`
 *   (the opener main passes in). The route shows `connecting` until the
 *   runtime's `account/login/completed` notification arrives.
 * - `logout()` sends `account/logout`, which removes the keyring entry.
 * - Status comes from `account/read`, refreshed on every `getStatus` and on
 *   `account/updated` and `account/login/completed`.
 *
 * The API key passes through here to the runtime's stdin only: it is never
 * kept, logged, put in a URL or environment, or returned. Runtime error
 * messages are mapped to fixed sentences rather than passed on.
 */
import type { Logger } from '../runtime/logger';
import type { CodexAccountView, CodexRouteStatus } from './status';

export type CodexLoginRequest = { type: 'apiKey'; apiKey: string } | { type: 'chatgpt' };

/** What the account needs from the current runtime (main swaps runtimes on restart). */
export interface CodexRuntimeLink {
  ready(): boolean;
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
}

export const CODEX_REASONS = {
  runtimeDown: 'The runtime is not running, so the Codex login cannot be read or changed.',
  keyringUnavailable: 'No OS keyring is available to the runtime, so the Codex login was not stored. Inquello never falls back to a file.',
  keyringLogout: 'The OS keyring could not be reached, so the Codex login could not be removed.',
  loginRefused: 'The runtime did not accept the Codex login.',
  invalidKey: 'Enter an API key of printable characters, without spaces.',
  browser: 'The system browser could not be opened for the ChatGPT sign-in.',
  chatgptIncomplete: 'The ChatGPT sign-in did not complete.',
  pending: 'A ChatGPT sign-in is already waiting for the browser.',
  logoutFailed: 'The runtime could not remove the Codex login.',
  readFailed: 'The runtime could not report the Codex login.',
} as const;

export const CODEX_API_KEY_MAX_LENGTH = 512;

export function codexApiKeyProblem(apiKey: string): string | null {
  if (apiKey.length === 0 || apiKey.length > CODEX_API_KEY_MAX_LENGTH || !/^[\x21-\x7e]+$/.test(apiKey)) return CODEX_REASONS.invalidKey;
  return null;
}

/** True when a runtime error is about the OS keyring (the runtime's messages name it). */
function isKeyringError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /keyring|secure storage|secret service|dbus/i.test(message);
}

function accountView(value: unknown): CodexAccountView | null {
  if (typeof value !== 'object' || value === null) return null;
  const account = value as Record<string, unknown>;
  if (account.type === 'apiKey') return { type: 'apiKey' };
  if (account.type === 'chatgpt') return { type: 'chatgpt', planType: typeof account.planType === 'string' ? account.planType : null };
  return { type: 'other' };
}

export interface CodexAccountOptions {
  runtime: CodexRuntimeLink;
  /** Opens the ChatGPT authorization URL; main passes the system-browser opener. */
  openBrowser: (url: string) => Promise<void>;
  logger: Logger;
}

export class CodexAccount {
  private account: CodexAccountView | null = null;
  private known = false;
  private readFailed = false;
  private pendingLogin: string | null = null;
  private lastReason: string | undefined;

  constructor(private readonly options: CodexAccountOptions) {}

  /** The last known status, without asking the runtime. */
  snapshot(): CodexRouteStatus {
    if (!this.options.runtime.ready()) return { state: 'unavailable', account: null, credentialStore: 'os-keyring', reason: CODEX_REASONS.runtimeDown };
    if (this.pendingLogin !== null) return { state: 'connecting', account: this.account, credentialStore: 'os-keyring' };
    if (this.readFailed) return { state: 'unavailable', account: null, credentialStore: 'os-keyring', reason: CODEX_REASONS.readFailed };
    const status: CodexRouteStatus = {
      state: this.known && this.account ? 'connected' : 'not-connected',
      account: this.known ? this.account : null,
      credentialStore: 'os-keyring',
    };
    if (this.lastReason) status.reason = this.lastReason;
    return status;
  }

  /** Re-reads `account/read` from the runtime, then returns the status. */
  async refresh(): Promise<CodexRouteStatus> {
    if (!this.options.runtime.ready()) {
      this.pendingLogin = null;
      return this.snapshot();
    }
    try {
      const result = await this.options.runtime.request<{ account?: unknown }>('account/read', { refreshToken: false });
      this.account = accountView(result?.account ?? null);
      this.known = true;
      this.readFailed = false;
    } catch (error) {
      this.options.logger.warn(`providers: account/read failed (${isKeyringError(error) ? 'keyring' : 'runtime error'})`);
      this.readFailed = true;
    }
    return this.snapshot();
  }

  async login(request: CodexLoginRequest): Promise<{ ok: boolean; reason?: string }> {
    if (!this.options.runtime.ready()) return { ok: false, reason: CODEX_REASONS.runtimeDown };
    this.lastReason = undefined;
    if (request.type === 'apiKey') {
      const problem = codexApiKeyProblem(request.apiKey);
      if (problem) return { ok: false, reason: problem };
      try {
        await this.options.runtime.request('account/login/start', { type: 'apiKey', apiKey: request.apiKey });
      } catch (error) {
        const keyring = isKeyringError(error);
        this.options.logger.warn(`providers: Codex API key login refused (${keyring ? 'keyring unavailable' : 'runtime error'})`);
        await this.refresh();
        return { ok: false, reason: keyring ? CODEX_REASONS.keyringUnavailable : CODEX_REASONS.loginRefused };
      }
      this.options.logger.info('providers: Codex API key login stored by the runtime');
      await this.refresh();
      return { ok: true };
    }
    if (this.pendingLogin !== null) return { ok: false, reason: CODEX_REASONS.pending };
    let started: { loginId?: unknown; authUrl?: unknown };
    try {
      started = await this.options.runtime.request('account/login/start', { type: 'chatgpt' });
    } catch (error) {
      this.options.logger.warn(`providers: ChatGPT login did not start (${isKeyringError(error) ? 'keyring' : 'runtime error'})`);
      return { ok: false, reason: CODEX_REASONS.loginRefused };
    }
    const loginId = typeof started?.loginId === 'string' ? started.loginId : null;
    const authUrl = typeof started?.authUrl === 'string' ? started.authUrl : null;
    if (!loginId || !authUrl) return { ok: false, reason: CODEX_REASONS.loginRefused };
    this.pendingLogin = loginId;
    try {
      await this.options.openBrowser(authUrl);
    } catch {
      this.options.logger.warn('providers: the system browser did not open for the ChatGPT login');
      await this.cancelPending();
      return { ok: false, reason: CODEX_REASONS.browser };
    }
    return { ok: true };
  }

  /** Cancels a waiting ChatGPT login, if any. */
  async cancelPending(): Promise<void> {
    const loginId = this.pendingLogin;
    this.pendingLogin = null;
    if (loginId === null || !this.options.runtime.ready()) return;
    try {
      await this.options.runtime.request('account/login/cancel', { loginId });
    } catch {
      // Already finished or gone with the runtime.
    }
  }

  async logout(): Promise<{ ok: boolean; reason?: string }> {
    if (!this.options.runtime.ready()) return { ok: false, reason: CODEX_REASONS.runtimeDown };
    this.lastReason = undefined;
    await this.cancelPending();
    try {
      await this.options.runtime.request('account/logout');
    } catch (error) {
      const keyring = isKeyringError(error);
      this.options.logger.warn(`providers: Codex logout failed (${keyring ? 'keyring' : 'runtime error'})`);
      await this.refresh();
      return { ok: false, reason: keyring ? CODEX_REASONS.keyringLogout : CODEX_REASONS.logoutFailed };
    }
    this.options.logger.info('providers: Codex login removed by the runtime');
    await this.refresh();
    return { ok: true };
  }

  /** Runtime notifications: the login outcome and account changes. */
  handleNotification(method: string, params: unknown): void {
    if (method === 'account/login/completed') {
      const record = typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {};
      const loginId = typeof record.loginId === 'string' ? record.loginId : null;
      if (this.pendingLogin !== null && (loginId === null || loginId === this.pendingLogin)) {
        this.pendingLogin = null;
        if (record.success !== true) this.lastReason = CODEX_REASONS.chatgptIncomplete;
      }
      void this.refresh();
    } else if (method === 'account/updated') {
      void this.refresh();
    }
  }

  /** The runtime stopped or was replaced: a waiting login died with it. */
  runtimeReset(): void {
    this.pendingLogin = null;
    this.known = false;
    this.account = null;
    this.readFailed = false;
  }
}
