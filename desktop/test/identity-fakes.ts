/**
 * Fakes for the identity tests: an in-memory shared service and issuer that
 * follow the SC-1/SC-2 contract closely enough to drive every I/O-matrix row,
 * a fake `safeStorage`, and an opener that plays the browser against the real
 * loopback listener.
 */
import { createHash } from 'node:crypto';
import http from 'node:http';

import type { BrowserOpener } from '../src/main/identity/browser';
import type { ServiceConfig } from '../src/main/identity/config';
import { IssuerError, ServiceError, type CodeExchange, type Issuer, type IssuerEndpoints, type SharedService } from '../src/main/identity/service-client';
import type { SafeStorageLike } from '../src/main/identity/vault';
import type {
  AbandonLoginRequest,
  AbandonLoginResponse,
  BootstrapRequest,
  Capabilities,
  CommandResponse,
  CreateLoginTransactionRequest,
  LoginTransaction,
  RevokeFamilyResponse,
  SessionCommandEnvelope,
  SessionCredentials,
  SessionView,
  AcceptInviteResponse,
  CreateEngagementEnvelope,
  WorkspacesView,
} from '../src/main/identity/wire';

export const ISSUER = 'https://issuer.synthetic.test';
export const SERVICE = 'https://service.synthetic.test';
export const CLIENT_ID = 'inquello-desktop-synthetic';

export const CONFIG: ServiceConfig = {
  serviceUrl: SERVICE,
  issuerUrl: ISSUER,
  issuerLabel: 'Synthetic test issuer',
  ca: '-----BEGIN CERTIFICATE-----\nFAKE\n-----END CERTIFICATE-----\n',
  clientId: CLIENT_ID,
};

let counter = 0;
const uuid = () => {
  counter += 1;
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
};
const secret = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
const iso = (ms: number) => new Date(ms).toISOString();

/** A reversible fake of OS encryption: the output never contains the input text. */
export function fakeSafeStorage(backend: string | null, available = true): SafeStorageLike & { encrypted: number } {
  const storage = {
    encrypted: 0,
    isEncryptionAvailable: () => available,
    encryptString: (text: string) => {
      storage.encrypted += 1;
      return Buffer.from(Buffer.from(text, 'utf8').map((byte) => byte ^ 0x5a));
    },
    decryptString: (data: Buffer) => Buffer.from(data.map((byte) => byte ^ 0x5a)).toString('utf8'),
    ...(backend === null ? {} : { getSelectedStorageBackend: () => backend }),
  };
  return storage;
}

interface FakeSession {
  sessionId: string;
  principalId: string;
  revision: number;
  revoked: boolean;
  access: string;
  refresh: string;
  rotated: Set<string>;
  accessExpiresAt: number;
}

export class FakeService implements SharedService {
  /** No answer at all (topology stopped, or an untrusted certificate). */
  down = false;
  /** The next bootstrap commits but its response is lost. */
  loseBootstrapResponse = false;
  /** The next logout commits but its response is lost. */
  loseLogoutResponse = false;
  /** How the next refresh ends. */
  refreshOutcome: 'ok' | 'reuse' | 'lost' | 'dependency' = 'ok';
  /** Access lifetime for issued credentials. */
  accessLifetimeMs = 15 * 60_000;
  displayName: string | null = 'Alice Synthetic';
  epoch = '1';

  readonly calls: string[] = [];
  readonly transactions = new Map<string, LoginTransaction & { abandoned: boolean; consumed: boolean; sessionId?: string }>();
  readonly sessions: FakeSession[] = [];
  readonly receipts = new Map<string, { digest: string; response: CommandResponse }>();
  readonly logoutEnvelopes: SessionCommandEnvelope[] = [];
  readonly revokedWith: string[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  private enter(name: string): void {
    this.calls.push(name);
    if (this.down) throw new ServiceError('transport', false);
  }

  private issue(session: FakeSession): SessionCredentials {
    session.access = secret('iqa');
    session.refresh = secret('iqr');
    session.accessExpiresAt = this.now() + this.accessLifetimeMs;
    return {
      session_id: session.sessionId,
      principal_id: session.principalId,
      access_credential: session.access,
      access_expires_at: iso(session.accessExpiresAt),
      refresh_credential: session.refresh,
      refresh_expires_at: iso(this.now() + 86_400_000),
      session_expires_at: iso(this.now() + 30 * 86_400_000),
    };
  }

  private byAccess(access: string): FakeSession {
    const session = this.sessions.find((s) => s.access === access && !s.revoked && s.accessExpiresAt > this.now());
    if (!session) throw new ServiceError('unauthenticated', true, 401);
    return session;
  }

  async capabilities(): Promise<Capabilities> {
    this.enter('capabilities');
    return { protocol_major: 1, schema_version: 1, command_epoch: this.epoch };
  }

  async createLoginTransaction(request: CreateLoginTransactionRequest): Promise<LoginTransaction> {
    this.enter('createLoginTransaction');
    const transaction: LoginTransaction = {
      login_transaction_id: uuid(),
      transaction_proof: secret('iqp'),
      nonce: secret('nonce'),
      issuer: request.issuer,
      client_id: request.client_id,
      redirect_uri: request.redirect_uri,
      device_id: request.device_id,
      expires_at: iso(this.now() + 300_000),
    };
    this.transactions.set(transaction.login_transaction_id, { ...transaction, abandoned: false, consumed: false });
    return transaction;
  }

  async bootstrap(request: BootstrapRequest): Promise<SessionCredentials> {
    this.enter('bootstrap');
    const transaction = this.transactions.get(request.login_transaction_id);
    if (
      !transaction ||
      transaction.consumed ||
      transaction.abandoned ||
      transaction.transaction_proof !== request.transaction_proof ||
      transaction.redirect_uri !== request.redirect_uri ||
      request.id_token !== FakeIssuer.idTokenFor(transaction.nonce)
    ) {
      throw new ServiceError('unauthenticated', true, 401);
    }
    transaction.consumed = true;
    const session: FakeSession = {
      sessionId: uuid(),
      principalId: uuid(),
      revision: 1,
      revoked: false,
      access: '',
      refresh: '',
      rotated: new Set(),
      accessExpiresAt: 0,
    };
    this.sessions.push(session);
    transaction.sessionId = session.sessionId;
    const credentials = this.issue(session);
    if (this.loseBootstrapResponse) {
      this.loseBootstrapResponse = false;
      throw new ServiceError('transport', true);
    }
    return credentials;
  }

  async abandon(request: AbandonLoginRequest): Promise<AbandonLoginResponse> {
    this.enter('abandon');
    const transaction = this.transactions.get(request.login_transaction_id);
    if (!transaction || transaction.transaction_proof !== request.transaction_proof) throw new ServiceError('unauthenticated', true, 401);
    transaction.abandoned = true;
    const session = this.sessions.find((s) => s.sessionId === transaction.sessionId);
    if (session) session.revoked = true;
    return { login_transaction_id: request.login_transaction_id, status: 'abandoned' };
  }

  async refresh(refreshCredential: string): Promise<SessionCredentials> {
    this.enter('refresh');
    const outcome = this.refreshOutcome;
    this.refreshOutcome = 'ok';
    if (outcome === 'dependency') throw new ServiceError('dependency_unavailable', true, 503);
    const session = this.sessions.find((s) => s.refresh === refreshCredential || s.rotated.has(refreshCredential));
    if (!session || session.revoked) throw new ServiceError('unauthenticated', true, 401);
    if (outcome === 'reuse' || session.rotated.has(refreshCredential)) {
      session.revoked = true;
      throw new ServiceError('unauthenticated', true, 401);
    }
    session.rotated.add(session.refresh);
    const credentials = this.issue(session);
    if (outcome === 'lost') throw new ServiceError('transport', true);
    return credentials;
  }

  async revokeFamily(credential: { refreshCredential: string } | { accessCredential: string }): Promise<RevokeFamilyResponse> {
    this.enter('revokeFamily');
    const value = 'refreshCredential' in credential ? credential.refreshCredential : credential.accessCredential;
    this.revokedWith.push(value);
    const session = this.sessions.find((s) => s.refresh === value || s.rotated.has(value) || s.access === value);
    if (!session) throw new ServiceError('unauthenticated', true, 401);
    session.revoked = true;
    return { status: 'revoked' };
  }

  async session(accessCredential: string): Promise<SessionView> {
    this.enter('session');
    const session = this.byAccess(accessCredential);
    return {
      session_id: session.sessionId,
      device_id: uuid(),
      issuer: ISSUER,
      subject: 'synthetic-alice',
      created_at: iso(this.now()),
      last_authenticated_at: iso(this.now()),
      expires_at: iso(this.now() + 86_400_000),
      revoked_at: null,
      revision: String(session.revision),
      principal: { principal_id: session.principalId, revision: '1', email: 'alice@synthetic.invalid', display_name: this.displayName },
    };
  }

  // Story 1.14 Workspace routes: identity tests never call them.
  async workspaces(accessCredential: string): Promise<WorkspacesView> {
    this.enter('workspaces');
    return { principal_id: this.byAccess(accessCredential).principalId, workspaces: [] };
  }

  async workspaceCommand(_accessCredential: string, _envelope: CreateEngagementEnvelope): Promise<CommandResponse> {
    this.enter('workspaceCommand');
    throw new ServiceError('denied', true, 403, 'not_a_member');
  }

  async acceptInvite(_accessCredential: string, _inviteId: string): Promise<AcceptInviteResponse> {
    this.enter('acceptInvite');
    throw new ServiceError('denied', true, 403);
  }

  async sessionCommand(accessCredential: string, envelope: SessionCommandEnvelope): Promise<CommandResponse> {
    this.enter('sessionCommand');
    this.logoutEnvelopes.push(structuredClone(envelope));
    const session = this.byAccess(accessCredential);
    if (envelope.command_epoch !== this.epoch) throw new ServiceError('unsupported_contract', true, 400);
    const digest = JSON.stringify(envelope);
    const recorded = this.receipts.get(envelope.operation_id);
    if (recorded) {
      if (recorded.digest !== digest) throw new ServiceError('version_conflict', true, 409);
      return recorded.response;
    }
    const target = this.sessions.find((s) => s.sessionId === envelope.payload.session_id && s.principalId === session.principalId);
    if (!target) throw new ServiceError('denied', true, 403);
    if (String(target.revision) !== envelope.expected_revision) throw new ServiceError('version_conflict', true, 409);
    target.revision += 1;
    target.revoked = true;
    const response: CommandResponse = {
      operation_id: envelope.operation_id,
      resource_id: target.sessionId,
      revision: String(target.revision),
      authorization_epoch: null,
      status: 'applied',
      receipt_id: uuid(),
    };
    this.receipts.set(envelope.operation_id, { digest, response });
    if (this.loseLogoutResponse) {
      this.loseLogoutResponse = false;
      throw new ServiceError('transport', true);
    }
    return response;
  }

  current(): FakeSession | undefined {
    return this.sessions.at(-1);
  }
}

export class FakeIssuer implements Issuer {
  readonly codes = new Map<string, { challenge: string; redirectUri: string; nonce: string }>();
  readonly exchanges: CodeExchange[] = [];
  down = false;

  static idTokenFor(nonce: string): string {
    return `eyJ.fake-id-token.${nonce}`;
  }

  async discover(): Promise<IssuerEndpoints> {
    if (this.down) throw new IssuerError('transport');
    return { authorizationEndpoint: `${ISSUER}/authorize`, tokenEndpoint: `${ISSUER}/token` };
  }

  /** What `/authorize` does: checks the request and issues a one-use code. */
  authorize(url: string): { redirectUri: string; state: string; code: string } {
    const parsed = new URL(url);
    const p = (name: string) => parsed.searchParams.get(name) ?? '';
    if (parsed.origin + parsed.pathname !== `${ISSUER}/authorize`) throw new Error('wrong authorization endpoint');
    if (p('response_type') !== 'code' || p('client_id') !== CLIENT_ID || p('code_challenge_method') !== 'S256') throw new Error('bad authorization request');
    if (!/^http:\/\/127\.0\.0\.1:\d+\/callback$/.test(p('redirect_uri'))) throw new Error('bad redirect');
    const code = secret('code');
    this.codes.set(code, { challenge: p('code_challenge'), redirectUri: p('redirect_uri'), nonce: p('nonce') });
    return { redirectUri: p('redirect_uri'), state: p('state'), code };
  }

  async exchangeCode(exchange: CodeExchange): Promise<string> {
    this.exchanges.push(exchange);
    if (this.down) throw new IssuerError('transport');
    const pending = this.codes.get(exchange.code);
    this.codes.delete(exchange.code);
    if (!pending || pending.redirectUri !== exchange.redirectUri || exchange.clientId !== CLIENT_ID) throw new IssuerError('invalid_grant');
    const challenge = createHash('sha256').update(exchange.codeVerifier).digest('base64url');
    if (challenge !== pending.challenge) throw new IssuerError('invalid_grant');
    return FakeIssuer.idTokenFor(pending.nonce);
  }
}

export function httpGet(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode ?? 0));
      })
      .on('error', reject);
  });
}

export type OpenerMode = 'follow' | 'wrong-state' | 'error' | 'tamper-verifier';

/** Plays the system browser: asks the fake issuer to authorize, then calls the loopback callback. */
export function fakeOpener(issuer: FakeIssuer, mode: () => OpenerMode = () => 'follow') {
  const opened: string[] = [];
  const callbacks: string[] = [];
  const opener: BrowserOpener = async (url) => {
    opened.push(url);
    const { redirectUri, state, code } = issuer.authorize(url);
    const current = mode();
    if (current === 'tamper-verifier') {
      const pending = issuer.codes.get(code)!;
      pending.challenge = 'A'.repeat(43);
    }
    const query =
      current === 'wrong-state'
        ? new URLSearchParams({ code, state: `${state}x`, iss: ISSUER })
        : current === 'error'
          ? new URLSearchParams({ error: 'access_denied', state, iss: ISSUER })
          : new URLSearchParams({ code, state, iss: ISSUER });
    const callback = `${redirectUri}?${query.toString()}`;
    callbacks.push(callback);
    // Like a browser, do not wait for the page before returning.
    void httpGet(callback).catch(() => undefined);
  };
  return { opener, opened, callbacks };
}
