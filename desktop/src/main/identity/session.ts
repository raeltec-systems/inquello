/**
 * The desktop's Inquello identity: sign-in, refresh, logout and status, owned by
 * the main process (SC-1, SC-2, SC-7).
 *
 * Sign-in (Authorization Code + PKCE S256 through the system browser):
 * 1. discover the issuer's endpoints;
 * 2. create a fresh verifier/challenge and one-use `state`, and start the
 *    loopback listener (`127.0.0.1`, ephemeral port, `/callback`);
 * 3. open a login transaction at the service, which binds the issuer, client,
 *    exact redirect URI and the nonce the authorization request carries;
 * 4. open the authorization URL in the system browser and wait (5 minutes by
 *    default) for the one callback with the right `state`;
 * 5. exchange the code at the issuer's `/token` with the verifier;
 * 6. bootstrap at the service with the ID token and the transaction proof. The
 *    desktop never parses the token: the service validates it. If the bootstrap
 *    response is lost, the desktop abandons the transaction (which revokes any
 *    session it created) and asks for a new sign-in.
 *
 * Credentials stay in this process and persist only through the vault
 * (OS-backed `safeStorage`, otherwise memory-only). Refresh is serialized: one
 * refresh at a time, rotation replaces both credentials, and a reuse rejection
 * or an uncertain outcome discards the family, revokes it if still possible
 * and requires a new sign-in. Logout is an SC-2 envelope whose `operation_id`
 * is persisted (with the record) until it resolves; a retry reuses the same
 * envelope, and `unauthenticated` on a retried self-logout means logged out.
 *
 * Status keeps three things separate: the identity, the shared service's
 * availability, and private work, which is always local and never depends on
 * the shared service.
 */
import { randomUUID } from 'node:crypto';

import type { Logger } from '../runtime/logger';
import type { BrowserOpener } from './browser';
import type { ConfigResult, ServiceConfig } from './config';
import { LoopbackError, startLoopbackListener, type LoopbackListener, type LoopbackOptions } from './loopback';
import { createPkce, createState, type Pkce } from './pkce';
import { IssuerError, ServiceError, type Issuer, type SharedService } from './service-client';
import type { CredentialStorage, PendingLogout, StoredSession } from './vault';
import { SCHEMA_VERSION, type SessionCredentials, type SessionCommandEnvelope } from './wire';

export type IdentityState =
  | { state: 'signed-out' }
  | { state: 'signing-in' }
  | { state: 'signed-in'; displayName: string; issuerLabel: string }
  | { state: 'blocked'; reason: string };

export type SharedServiceState = 'available' | 'unavailable' | 'not-configured';

export interface IdentityStatus {
  identity: IdentityState;
  sharedService: SharedServiceState;
  credentialStorage: CredentialStorage;
  privateWork: 'local';
}

export interface IdentityActionResult {
  ok: boolean;
  /** Why the action did not complete; a fixed sentence without secrets. */
  reason?: string;
  status: IdentityStatus;
}

/** Every reason the desktop shows. Fixed text: never a server message or a value. */
export const REASONS = {
  notConfigured: 'The shared service is not configured.',
  configInvalid: 'The shared-service configuration could not be read.',
  inProgress: 'A sign-in is already in progress.',
  issuerUnavailable: 'The identity provider could not be reached.',
  serviceUnavailable: 'The shared service could not be reached.',
  browserFailed: 'The system browser could not be opened.',
  timedOut: 'Sign-in was not completed in time.',
  issuerRejected: 'The identity provider did not complete the sign-in.',
  serviceRejected: 'The shared service did not accept the sign-in.',
  interrupted: 'Sign-in was interrupted. Sign in again.',
  logoutPending: 'Sign-out is waiting for the shared service. Sign out again to retry.',
  signOutUnavailable: 'The shared service could not be reached, so you are still signed in.',
} as const;

/** Refresh when the access credential has less than this left. */
export const REFRESH_MARGIN_MS = 30_000;
const FALLBACK_DISPLAY_NAME = 'Signed-in account';
const SCOPE = 'openid profile email';

/** What the session needs from the vault (`CredentialVault` or a test fake). */
export interface VaultLike {
  readonly storage: CredentialStorage;
  deviceId(): string;
  load(): StoredSession | null;
  save(record: StoredSession): void;
  clear(): void;
}

export interface IdentitySessionOptions {
  config: ConfigResult;
  vault: VaultLike;
  /** Required when configured. */
  service?: SharedService;
  /** Required when configured. */
  issuer?: Issuer;
  openBrowser: BrowserOpener;
  logger: Logger;
  startLoopback?: (options: LoopbackOptions) => Promise<LoopbackListener>;
  callbackTimeoutMs?: number;
  now?: () => number;
  pkce?: () => Pkce;
  state?: () => string;
  operationId?: () => string;
  /** Smoke and tests only: remember every secret seen so a leak check can look for it. */
  recordSecrets?: boolean;
}

/** Copies a status into a fresh object with only the fields the renderer may see. */
export function toRendererStatus(status: IdentityStatus): IdentityStatus {
  const identity: IdentityState =
    status.identity.state === 'signed-in'
      ? { state: 'signed-in', displayName: String(status.identity.displayName), issuerLabel: String(status.identity.issuerLabel) }
      : status.identity.state === 'blocked'
        ? { state: 'blocked', reason: String(status.identity.reason) }
        : { state: status.identity.state };
  return { identity, sharedService: status.sharedService, credentialStorage: status.credentialStorage, privateWork: 'local' };
}

export function toRendererResult(result: IdentityActionResult): IdentityActionResult {
  const out: IdentityActionResult = { ok: result.ok === true, status: toRendererStatus(result.status) };
  if (typeof result.reason === 'string') out.reason = result.reason;
  return out;
}

class SignInFailure extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export class IdentitySession {
  private readonly config: ServiceConfig | null;
  private readonly configInvalid: boolean;
  private record: StoredSession | null = null;
  private signingIn = false;
  private shared: SharedServiceState;
  private chain: Promise<unknown> = Promise.resolve();
  private refreshing: Promise<boolean> | null = null;
  private readonly seen = new Set<string>();
  private readonly now: () => number;

  constructor(private readonly options: IdentitySessionOptions) {
    this.now = options.now ?? Date.now;
    this.config = options.config.kind === 'configured' ? options.config.config : null;
    this.configInvalid = options.config.kind === 'invalid';
    this.shared = this.config ? 'unavailable' : 'not-configured';
    if (this.config && (!options.service || !options.issuer)) throw new Error('a configured identity session needs a service and an issuer client');
    if (this.config) {
      const stored = options.vault.load();
      if (stored && stored.serviceUrl === this.config.serviceUrl && stored.issuer === this.config.issuerUrl) this.record = stored;
      else if (stored) options.vault.clear();
    }
    if (this.record) this.remember(this.record.accessCredential, this.record.refreshCredential);
  }

  // ---- status --------------------------------------------------------------

  /** The current status without contacting anything. */
  snapshot(): IdentityStatus {
    return {
      identity: this.identityState(),
      sharedService: this.shared,
      credentialStorage: this.options.vault.storage,
      privateWork: 'local',
    };
  }

  private identityState(): IdentityState {
    if (this.configInvalid) return { state: 'blocked', reason: REASONS.configInvalid };
    if (this.signingIn) return { state: 'signing-in' };
    if (this.record?.pendingLogout) return { state: 'blocked', reason: REASONS.logoutPending };
    if (this.record && this.config) return { state: 'signed-in', displayName: this.record.displayName, issuerLabel: this.config.issuerLabel };
    return { state: 'signed-out' };
  }

  /**
   * Checks the shared service (and the session, when signed in) and returns
   * the status. Not configured: nothing is contacted. A pending logout is
   * retried with its original operation ID.
   */
  async getStatus(): Promise<IdentityStatus> {
    if (this.config && !this.signingIn) {
      await this.exclusive(async () => {
        if (this.record?.pendingLogout) await this.attemptLogout(false);
        else if (this.record) await this.verifySession();
        else await this.probeService();
      });
    }
    return this.snapshot();
  }

  private async probeService(): Promise<void> {
    try {
      await this.service.capabilities();
      this.shared = 'available';
    } catch {
      this.shared = 'unavailable';
    }
  }

  private async verifySession(): Promise<void> {
    const access = await this.freshAccess();
    if (!access) return;
    try {
      this.applyView(await this.service.session(access));
      this.shared = 'available';
    } catch (error) {
      if (error instanceof ServiceError && error.kind === 'unauthenticated') {
        // The access credential no longer works: try one refresh.
        if (!(await this.refresh()) || !this.record) return;
        try {
          this.applyView(await this.service.session(this.record.accessCredential));
          this.shared = 'available';
        } catch {
          this.shared = 'unavailable';
        }
        return;
      }
      this.shared = 'unavailable';
    }
  }

  private applyView(view: { principal: { display_name: string | null; email: string | null } }): void {
    if (!this.record) return;
    const displayName = view.principal.display_name ?? view.principal.email ?? FALLBACK_DISPLAY_NAME;
    if (displayName !== this.record.displayName) {
      this.record = { ...this.record, displayName };
      this.persist();
    }
  }

  // ---- sign-in -------------------------------------------------------------

  async signIn(): Promise<IdentityActionResult> {
    if (this.configInvalid) return this.result(false, REASONS.configInvalid);
    if (!this.config) return this.result(false, REASONS.notConfigured);
    if (this.signingIn) return this.result(false, REASONS.inProgress);
    if (this.record?.pendingLogout) return this.result(false, REASONS.logoutPending);
    if (this.record) return this.result(true);
    this.signingIn = true;
    let reason: string | undefined;
    try {
      await this.runSignIn(this.config);
    } catch (error) {
      reason = error instanceof SignInFailure ? error.reason : REASONS.interrupted;
      this.options.logger.warn(`identity: sign-in did not complete (${reason})`);
    } finally {
      this.signingIn = false;
    }
    return reason === undefined ? this.result(true) : this.result(false, reason);
  }

  private async runSignIn(config: ServiceConfig): Promise<void> {
    const issuer = this.options.issuer!;
    let endpoints;
    try {
      endpoints = await issuer.discover();
    } catch {
      throw new SignInFailure(REASONS.issuerUnavailable);
    }
    const pkce = (this.options.pkce ?? createPkce)();
    const state = (this.options.state ?? createState)();
    this.remember(pkce.verifier, state);
    const listener = await (this.options.startLoopback ?? startLoopbackListener)({
      state,
      issuer: config.issuerUrl,
      timeoutMs: this.options.callbackTimeoutMs,
    });
    try {
      let transaction;
      try {
        transaction = await this.service.createLoginTransaction({
          issuer: config.issuerUrl,
          client_id: config.clientId,
          redirect_uri: listener.redirectUri,
          device_id: this.options.vault.deviceId(),
        });
        this.shared = 'available';
      } catch (error) {
        this.noteServiceError(error);
        throw new SignInFailure(error instanceof ServiceError && error.kind === 'transport' ? REASONS.serviceUnavailable : REASONS.serviceRejected);
      }
      this.remember(transaction.transaction_proof, transaction.nonce);
      const abandon = async () => {
        try {
          await this.service.abandon({ login_transaction_id: transaction.login_transaction_id, transaction_proof: transaction.transaction_proof });
        } catch {
          this.options.logger.warn('identity: could not abandon the login transaction; it expires on its own');
        }
      };

      const authorize = new URL(endpoints.authorizationEndpoint);
      for (const [key, value] of [
        ['response_type', 'code'],
        ['client_id', config.clientId],
        ['redirect_uri', listener.redirectUri],
        ['scope', SCOPE],
        ['state', state],
        ['nonce', transaction.nonce],
        ['code_challenge', pkce.challenge],
        ['code_challenge_method', pkce.method],
      ] as const) {
        authorize.searchParams.set(key, value);
      }
      try {
        await this.options.openBrowser(authorize.toString());
      } catch {
        await abandon();
        throw new SignInFailure(REASONS.browserFailed);
      }

      let code: string;
      try {
        ({ code } = await listener.callback);
      } catch (error) {
        await abandon();
        throw new SignInFailure(error instanceof LoopbackError && error.failure === 'timeout' ? REASONS.timedOut : REASONS.issuerRejected);
      }
      this.remember(code);

      let idToken: string;
      try {
        idToken = await issuer.exchangeCode({
          tokenEndpoint: endpoints.tokenEndpoint,
          code,
          redirectUri: listener.redirectUri,
          clientId: config.clientId,
          codeVerifier: pkce.verifier,
        });
      } catch (error) {
        await abandon();
        throw new SignInFailure(error instanceof IssuerError && error.code === 'transport' ? REASONS.issuerUnavailable : REASONS.issuerRejected);
      }
      this.remember(idToken);

      let credentials: SessionCredentials;
      try {
        credentials = await this.service.bootstrap({
          login_transaction_id: transaction.login_transaction_id,
          transaction_proof: transaction.transaction_proof,
          redirect_uri: listener.redirectUri,
          id_token: idToken,
        });
      } catch (error) {
        // Never replay bootstrap: close the transaction (and revoke any session
        // a lost response created), then ask for a new sign-in.
        await abandon();
        this.noteServiceError(error);
        if (error instanceof ServiceError && (error.uncertain || error.kind === 'protocol')) throw new SignInFailure(REASONS.interrupted);
        if (error instanceof ServiceError && error.kind === 'transport') throw new SignInFailure(REASONS.serviceUnavailable);
        throw new SignInFailure(REASONS.serviceRejected);
      }
      this.remember(credentials.access_credential, credentials.refresh_credential);

      let displayName = FALLBACK_DISPLAY_NAME;
      try {
        const view = await this.service.session(credentials.access_credential);
        displayName = view.principal.display_name ?? view.principal.email ?? FALLBACK_DISPLAY_NAME;
        this.shared = 'available';
      } catch (error) {
        this.noteServiceError(error);
      }
      this.record = {
        version: 1,
        serviceUrl: config.serviceUrl,
        issuer: config.issuerUrl,
        deviceId: this.options.vault.deviceId(),
        sessionId: credentials.session_id,
        principalId: credentials.principal_id,
        displayName,
        accessCredential: credentials.access_credential,
        accessExpiresAt: credentials.access_expires_at,
        refreshCredential: credentials.refresh_credential,
        refreshExpiresAt: credentials.refresh_expires_at,
        sessionExpiresAt: credentials.session_expires_at,
        pendingLogout: null,
      };
      this.persist();
      this.options.logger.info('identity: signed in');
    } finally {
      listener.close();
    }
  }

  // ---- refresh -------------------------------------------------------------

  /** Refreshes now (serialized with every other session operation). */
  async refreshNow(): Promise<boolean> {
    return this.exclusive(() => this.refresh());
  }

  /** The current access credential, refreshed first when it is about to expire; null once signed out. */
  private async freshAccess(): Promise<string | null> {
    if (!this.record) return null;
    if (Date.parse(this.record.accessExpiresAt) - this.now() < REFRESH_MARGIN_MS) await this.refresh();
    return this.record?.accessCredential ?? null;
  }

  /** One refresh at a time; concurrent callers share it. */
  private refresh(): Promise<boolean> {
    this.refreshing ??= this.runRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async runRefresh(): Promise<boolean> {
    const record = this.record;
    if (!record) return false;
    try {
      const credentials = await this.service.refresh(record.refreshCredential);
      this.remember(credentials.access_credential, credentials.refresh_credential);
      if (this.record !== record) return false;
      this.record = {
        ...record,
        accessCredential: credentials.access_credential,
        accessExpiresAt: credentials.access_expires_at,
        refreshCredential: credentials.refresh_credential,
        refreshExpiresAt: credentials.refresh_expires_at,
        sessionExpiresAt: credentials.session_expires_at,
      };
      this.persist();
      this.shared = 'available';
      return true;
    } catch (error) {
      if (error instanceof ServiceError && (error.kind === 'dependency_unavailable' || (error.kind === 'transport' && !error.delivered))) {
        // The refresh did not happen: keep the family for a later attempt.
        this.shared = 'unavailable';
        return false;
      }
      // A reuse rejection, any other refusal, or an uncertain outcome: this
      // family is finished. Discard it, revoke it if still possible, and
      // require a new sign-in.
      this.options.logger.warn('identity: refresh failed; the session was discarded and sign-in is required');
      await this.discardFamily(record);
      return false;
    }
  }

  private async discardFamily(record: StoredSession): Promise<void> {
    if (this.record === record || this.record?.sessionId === record.sessionId) {
      this.record = null;
      this.options.vault.clear();
    }
    try {
      await this.service.revokeFamily({ refreshCredential: record.refreshCredential });
    } catch {
      // Best effort: the server's expiry and reuse detection still apply.
    }
  }

  // ---- logout --------------------------------------------------------------

  async signOut(): Promise<IdentityActionResult> {
    if (this.configInvalid) return this.result(false, REASONS.configInvalid);
    if (!this.config || !this.record) return this.result(true);
    return this.exclusive(async () => {
      if (!this.record) return this.result(true);
      if (!this.record.pendingLogout && !(await this.prepareLogout())) {
        return this.record ? this.result(false, REASONS.signOutUnavailable) : this.result(true);
      }
      return this.attemptLogout(true);
    });
  }

  /** Reads the epoch and the session revision and persists a new pending logout. */
  private async prepareLogout(): Promise<boolean> {
    const access = await this.freshAccess();
    if (!access || !this.record) return false;
    try {
      const capabilities = await this.service.capabilities();
      const view = await this.service.session(access);
      this.shared = 'available';
      const pending: PendingLogout = {
        operationId: (this.options.operationId ?? (() => `logout-${randomUUID()}`))(),
        commandEpoch: capabilities.command_epoch,
        expectedRevision: view.revision,
        sessionId: this.record.sessionId,
        sent: false,
      };
      this.record = { ...this.record, pendingLogout: pending };
      this.persist();
      return true;
    } catch (error) {
      if (error instanceof ServiceError && error.kind === 'unauthenticated') {
        // The session is already unusable on the service: finish locally.
        await this.discardFamily(this.record);
        return false;
      }
      this.noteServiceError(error);
      return false;
    }
  }

  /**
   * Sends the pending logout envelope. `interactive` is false for the
   * background retry that `getStatus` runs.
   */
  private async attemptLogout(interactive: boolean, rePrepared = false): Promise<IdentityActionResult> {
    let record = this.record;
    if (!record?.pendingLogout) return this.result(true);
    const retry = record.pendingLogout.sent;

    const access = await this.freshAccess();
    record = this.record;
    if (!access || !record?.pendingLogout) {
      // A failed refresh already discarded (and revoked) the family.
      return this.result(true);
    }
    const pending = record.pendingLogout;
    // Persist "possibly sent" before it can reach the service.
    if (!pending.sent) {
      this.record = { ...record, pendingLogout: { ...pending, sent: true } };
      this.persist();
    }
    const envelope: SessionCommandEnvelope = {
      command_epoch: pending.commandEpoch,
      operation_id: pending.operationId,
      expected_revision: pending.expectedRevision,
      schema_version: SCHEMA_VERSION,
      payload: { command: 'logout', session_id: pending.sessionId },
    };
    try {
      await this.service.sessionCommand(access, envelope);
      this.shared = 'available';
      this.finishLogout();
      return this.result(true);
    } catch (error) {
      if (!(error instanceof ServiceError)) {
        this.shared = 'unavailable';
        return this.result(false, REASONS.logoutPending);
      }
      switch (error.kind) {
        case 'unauthenticated':
          this.shared = 'available';
          if (retry) {
            // A retried self-logout: the first attempt committed and revoked
            // this session, so the service no longer knows these credentials.
            this.finishLogout();
            return this.result(true);
          }
          // First attempt: the access credential was refused. Refresh once and
          // retry the same envelope; a failed refresh discards the family.
          if (await this.refresh()) return this.attemptLogout(interactive, rePrepared);
          this.finishLogout();
          return this.result(true);
        case 'version_conflict':
        case 'unsupported_contract':
          // Rejected without a mutation (stale revision or epoch): prepare a new
          // operation once.
          this.shared = 'available';
          if (!rePrepared && this.record) {
            this.record = { ...this.record, pendingLogout: null };
            this.persist();
            if (await this.prepareLogout()) return this.attemptLogout(interactive, true);
            return this.record ? this.result(false, REASONS.signOutUnavailable) : this.result(true);
          }
          return this.result(false, REASONS.logoutPending);
        case 'denied':
          // The service no longer lets this principal act on the session.
          this.shared = 'available';
          if (this.record) await this.discardFamily(this.record);
          return this.result(true);
        default:
          // Transport, dependency or uncertain outcome: keep the pending
          // operation and retry it later with the same ID.
          this.shared = 'unavailable';
          if (!interactive) this.options.logger.info('identity: pending sign-out not yet confirmed');
          return this.result(false, REASONS.logoutPending);
      }
    }
  }

  /** Whether this device holds a session (signed in, or with a sign-out pending). */
  holdsSession(): boolean {
    return this.record !== null;
  }

  /**
   * Drops the session on this device only: memory and the vault file. Used by
   * the local data deletion (Story 1.12) after `signOut` could not get the
   * shared service to confirm; the server session then lapses on its own.
   */
  forgetLocally(): void {
    this.record = null;
    this.options.vault.clear();
    this.options.logger.info('identity: the session was removed locally without server confirmation');
  }

  private finishLogout(): void {
    this.record = null;
    this.options.vault.clear();
    this.options.logger.info('identity: signed out');
  }

  // ---- helpers -------------------------------------------------------------

  private get service(): SharedService {
    return this.options.service!;
  }

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.catch(() => undefined);
    return run;
  }

  private persist(): void {
    if (!this.record) return;
    try {
      this.options.vault.save(this.record);
    } catch {
      this.options.logger.error('identity: the session could not be saved; it lasts for this run only');
    }
  }

  private noteServiceError(error: unknown): void {
    if (error instanceof ServiceError && (error.kind === 'transport' || error.kind === 'dependency_unavailable')) this.shared = 'unavailable';
  }

  private remember(...secrets: string[]): void {
    if (!this.options.recordSecrets) return;
    for (const secret of secrets) if (secret) this.seen.add(secret);
  }

  /**
   * Smoke and tests only (`recordSecrets`): every credential, proof, code,
   * verifier, state, nonce and ID token this session has handled, for leak
   * checks that run in main. Empty otherwise.
   */
  knownSecrets(): string[] {
    return [...this.seen];
  }

  private result(ok: boolean, reason?: string): IdentityActionResult {
    return reason === undefined ? { ok, status: this.snapshot() } : { ok, reason, status: this.snapshot() };
  }
}
