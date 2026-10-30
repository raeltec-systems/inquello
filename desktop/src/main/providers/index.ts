/**
 * Provider credentials (Story 1.13): the main-process service behind the
 * `provider.*` operations.
 *
 * Two routes, each separate from the Inquello identity:
 * - the Claude API key, in the main-process vault (`claude-vault.ts`), with an
 *   optional free check against `/v1/models` (`claude-verify.ts`) run only
 *   when the user asks;
 * - the inherited Codex login (API key or ChatGPT), held by the runtime in the
 *   OS keyring (`codex-account.ts`).
 *
 * Nothing here reads or changes the identity session: Inquello sign-out leaves
 * provider credentials alone, and removing a provider credential never signs
 * out. Local data deletion of the Claude API key goes through
 * `forgetClaudeKey`, which also clears a memory-only key and stops a check in
 * flight from restoring it.
 *
 * A conclusive rejection is kept until a check verifies the key or the key is
 * replaced: a later check that cannot reach Anthropic leaves the key
 * `rejected`, so it never becomes an authorized route again by being offline. Every result carries the provider status only (`status.ts`), which the
 * operations rebuild field by field before it crosses IPC. Actions on a route
 * run one at a time.
 */
import type { Logger } from '../runtime/logger';
import type { SafeStorageLike } from '../identity/vault';
import { claudeKeyProblem, ClaudeKeyVault, providersDir } from './claude-vault';
import { verifyClaudeKey, type VerifyOutcome, type VerifyTarget } from './claude-verify';
import { CodexAccount, type CodexLoginRequest, type CodexRuntimeLink } from './codex-account';
import type { ProviderDevConfig } from './dev-config';
import type { ProviderActionResult, ProviderStatus } from './status';

export { ClaudeKeyVault, CLAUDE_KEY_FILE, claudeKeyProblem, PROVIDERS_DIR, providersDir, type ClaudeKeyState } from './claude-vault';
export { ANTHROPIC_BASE_URL, ANTHROPIC_VERSION, verifyClaudeKey, type VerifyOutcome, type VerifyTarget } from './claude-verify';
export { CODEX_REASONS, CodexAccount, codexApiKeyProblem, type CodexLoginRequest, type CodexRuntimeLink } from './codex-account';
export { loadProviderDevConfig, parseProviderDevConfig, PROVIDER_DEV_CONFIG_ENV, type ProviderDevConfig } from './dev-config';
export * from './status';

export const CLAUDE_REASONS = {
  noKey: 'No Claude API key is stored.',
  devConfig: 'The provider dev config is invalid, so the Claude API key cannot be checked.',
  busy: 'Another Claude API key action is in progress.',
  storeFailed: 'The Claude API key could not be stored.',
  rejected: 'Anthropic refused this Claude API key. It stays stored until you remove it.',
  unreachable: 'Anthropic could not be reached to check the Claude API key. Nothing was retried.',
  changed: 'The Claude API key changed while it was being checked; check it again.',
  unreachableRejected: 'Anthropic could not be reached to check the Claude API key. It stays refused, as Anthropic last answered.',
} as const;

export interface ProviderServiceOptions {
  vault: ClaudeKeyVault;
  codex: CodexAccount;
  /** Where the Claude check goes (the dev config may name a local fake). */
  devConfig: ProviderDevConfig;
  /** The check itself; tests may replace it. */
  verify?: (key: string, target: VerifyTarget) => Promise<VerifyOutcome>;
  logger: Logger;
  /** Smoke and tests only: remember every credential handled, for leak scans. */
  recordSecrets?: boolean;
}

export class ProviderService {
  private claudeBusy = false;
  /** Bumped whenever the key is removed, so a check in flight cannot restore or relabel it. */
  private claudeGeneration = 0;
  private codexBusy = false;
  private readonly secrets = new Set<string>();

  private routeInvalidator: ((route: 'claude-api-key' | 'codex-responses') => Promise<void>) | null = null;

  routeCredentialChanging(route: 'claude-api-key' | 'codex-responses'): boolean { return route === 'claude-api-key' ? this.claudeBusy : this.codexBusy; }
  setRouteInvalidator(invalidate: (route: 'claude-api-key' | 'codex-responses') => Promise<void>): void { this.routeInvalidator = invalidate; }

  /** The vault and generation must both still identify the acquired credential. */
  private sameClaude(generation: number, key: string | undefined): boolean {
    return generation === this.claudeGeneration && this.options.vault.load()?.key === key;
  }

  /** Main-only secret handoff. No credential is returned, queued or persisted here. */
  async handoffClaude(send: (key: string) => Promise<unknown>): Promise<unknown> {
    const generation = this.claudeGeneration, record = this.options.vault.load();
    if (!record || record.state === 'rejected' || this.claudeBusy) throw new Error('Claude credential unavailable');
    const response = await send(record.key);
    if (!this.sameClaude(generation, record.key)) throw new Error('Claude credential changed');
    return response;
  }

  constructor(private readonly options: ProviderServiceOptions) {}

  get vault(): ClaudeKeyVault {
    return this.options.vault;
  }

  get codex(): CodexAccount {
    return this.options.codex;
  }

  private claudeStatus(): ProviderStatus['claude'] {
    return { state: this.options.vault.load()?.state ?? 'not-configured', storage: this.options.vault.storage };
  }

  /** The status without asking the runtime. */
  snapshot(): ProviderStatus {
    return { claude: this.claudeStatus(), codex: this.options.codex.snapshot() };
  }

  async getStatus(): Promise<ProviderStatus> {
    return { claude: this.claudeStatus(), codex: await this.options.codex.refresh() };
  }

  private remember(secret: string): void {
    if (this.options.recordSecrets) this.secrets.add(secret);
  }

  /** Smoke and tests only (`recordSecrets`): every provider credential this run handled. */
  knownSecrets(): string[] {
    return [...this.secrets];
  }

  private async result(ok: boolean, reason?: string): Promise<ProviderActionResult> {
    const status = await this.getStatus();
    return reason === undefined ? { ok, status } : { ok, reason, status };
  }

  private async claudeAction(fn: () => Promise<{ ok: boolean; reason?: string }>): Promise<ProviderActionResult> {
    if (this.claudeBusy) return this.result(false, CLAUDE_REASONS.busy);
    this.claudeBusy = true;
    let outcome: { ok: boolean; reason?: string };
    try {
      outcome = await fn();
    } finally {
      this.claudeBusy = false;
    }
    return this.result(outcome.ok, outcome.reason);
  }

  private async codexAction(fn: () => Promise<{ ok: boolean; reason?: string }>): Promise<ProviderActionResult> {
    if (this.codexBusy) return this.result(false, 'Another Codex login action is in progress.');
    this.codexBusy = true;
    let outcome: { ok: boolean; reason?: string };
    try {
      outcome = await fn();
    } finally {
      this.codexBusy = false;
    }
    return this.result(outcome.ok, outcome.reason);
  }

  /** Stores a Claude API key after checking its form; an invalid key stores nothing. */
  setClaudeKey(key: string): Promise<ProviderActionResult> {
    return this.claudeAction(async () => {
      this.remember(key);
      const problem = claudeKeyProblem(key);
      if (problem) return { ok: false, reason: problem };
      const generation = ++this.claudeGeneration, previousKey = this.options.vault.load()?.key;
      await this.routeInvalidator?.('claude-api-key');
      // Local data deletion is allowed while invalidation waits; it always wins.
      if (!this.sameClaude(generation, previousKey)) return { ok: false, reason: CLAUDE_REASONS.changed };
      try {
        this.options.vault.save({ version: 1, key, state: 'stored-unverified' });
      } catch (error) {
        this.options.logger.warn(`providers: the Claude API key was not stored (${(error as NodeJS.ErrnoException).code ?? 'error'})`);
        return { ok: false, reason: CLAUDE_REASONS.storeFailed };
      }
      this.options.logger.info(`providers: Claude API key stored (${this.options.vault.storage})`);
      return { ok: true };
    });
  }

  /** The free check, only on request: one `/v1/models` call, no retries. */
  verifyClaudeKey(): Promise<ProviderActionResult> {
    return this.claudeAction(async () => {
      const record = this.options.vault.load();
      if (!record) return { ok: false, reason: CLAUDE_REASONS.noKey };
      const config = this.options.devConfig;
      if (config.kind === 'invalid') return { ok: false, reason: CLAUDE_REASONS.devConfig };
      const generation = this.claudeGeneration;
      const outcome = await (this.options.verify ?? verifyClaudeKey)(record.key, config.target);
      this.options.logger.info(`providers: Claude API key check: ${outcome}`);
      const current = this.options.vault.load();
      // Removed or replaced while the check ran: do not resurrect or relabel it.
      if (generation !== this.claudeGeneration || !current || current.key !== record.key) return { ok: false, reason: CLAUDE_REASONS.changed };
      // Not reaching Anthropic says nothing about the key: a known rejection stands.
      if (outcome === 'unreachable' && current.state === 'rejected') return { ok: false, reason: CLAUDE_REASONS.unreachableRejected };
      if (outcome === 'rejected') await this.routeInvalidator?.('claude-api-key');
      // Every asynchronous boundary before persistence requires a new vault check.
      if (!this.sameClaude(generation, record.key)) return { ok: false, reason: CLAUDE_REASONS.changed };
      this.options.vault.save({ version: 1, key: record.key, state: outcome });
      if (outcome === 'verified') return { ok: true };
      return { ok: false, reason: outcome === 'rejected' ? CLAUDE_REASONS.rejected : CLAUDE_REASONS.unreachable };
    });
  }

  removeClaudeKey(): Promise<ProviderActionResult> {
    return this.claudeAction(async () => {
      this.claudeGeneration += 1;
      this.options.vault.clear();
      await this.routeInvalidator?.('claude-api-key');
      this.options.logger.info('providers: Claude API key removed');
      return { ok: true };
    });
  }

  /**
   * Local data deletion (Story 1.12): removes the Claude API key wherever it
   * is held (memory-only or the encrypted file), even while another Claude
   * action runs; a check in flight then cannot restore or relabel it.
   */
  async forgetClaudeKey(): Promise<void> {
    this.claudeGeneration += 1;
    this.options.vault.clear();
    await this.routeInvalidator?.('claude-api-key');
    this.options.logger.info('providers: Claude API key removed by local data deletion');
  }

  /** Whether a Claude API key is still held (and so usable). */
  holdsClaudeKey(): boolean {
    return this.options.vault.load() !== null;
  }

  codexLogin(request: CodexLoginRequest): Promise<ProviderActionResult> {
    return this.codexAction(async () => {
      await this.routeInvalidator?.('codex-responses');
      if (request.type === 'apiKey') this.remember(request.apiKey);
      return this.options.codex.login(request);
    });
  }

  codexLogout(): Promise<ProviderActionResult> {
    return this.codexAction(async () => { await this.routeInvalidator?.('codex-responses'); return this.options.codex.logout(); });
  }
}

export interface ProviderWiringOptions {
  safeStorage: SafeStorageLike;
  platform: NodeJS.Platform;
  userDataDir: string;
  runtime: CodexRuntimeLink;
  openBrowser: (url: string) => Promise<void>;
  devConfig: ProviderDevConfig;
  logger: Logger;
  recordSecrets?: boolean;
}

export function createProviders(options: ProviderWiringOptions): ProviderService {
  const vault = new ClaudeKeyVault({ safeStorage: options.safeStorage, platform: options.platform, dir: providersDir(options.userDataDir) });
  const codex = new CodexAccount({ runtime: options.runtime, openBrowser: options.openBrowser, logger: options.logger });
  if (options.devConfig.kind === 'invalid') options.logger.error(`providers: ${options.devConfig.reason}`);
  options.logger.info(`providers: Claude API key storage ${vault.storage}; Claude check ${options.devConfig.kind === 'dev' ? 'dev endpoint' : 'Anthropic'}`);
  return new ProviderService({
    vault,
    codex,
    devConfig: options.devConfig,
    logger: options.logger,
    recordSecrets: options.recordSecrets,
  });
}
