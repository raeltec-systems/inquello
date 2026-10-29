/**
 * HTTPS clients for the shared service and the OIDC issuer, used only by main.
 *
 * Every request goes over `https:` and trusts only the CA from the dev config,
 * passed as the per-request `ca` option with `rejectUnauthorized: true`. This
 * module never touches the system trust store or `NODE_TLS_REJECT_UNAUTHORIZED`
 * and never skips verification.
 *
 * Failures become a `ServiceError`:
 * - `transport` when no answer arrived. `delivered` says whether the request
 *   had been fully sent, so callers can tell a request that never left from a
 *   lost response (an uncertain outcome).
 * - an SC-2 error kind when the service answered with its fixed error body.
 * - `protocol` when an answer did not match the contract.
 * Issuer token errors become an `IssuerError` with the OAuth error code.
 *
 * Messages carry no request or response content: values may be credentials.
 */
import https from 'node:https';

import {
  ERROR_KINDS,
  PROTOCOL_MAJOR,
  parseAbandonLoginResponse,
  parseAcceptInviteResponse,
  parseCapabilities,
  parseCommandResponse,
  parseErrorBody,
  parseExecutionPolicyView,
  parseLoginTransaction,
  parseRevokeFamilyResponse,
  parseSessionCredentials,
  parseSessionView,
  parseWorkspacesView,
  type AbandonLoginRequest,
  type AbandonLoginResponse,
  type AcceptInviteResponse,
  type ExecutionPolicyView,
  type CreateEngagementEnvelope,
  type DenyReason,
  type BootstrapRequest,
  type Capabilities,
  type CommandResponse,
  type CreateLoginTransactionRequest,
  type ErrorKind,
  type LoginTransaction,
  type RevokeFamilyResponse,
  type SessionCommandEnvelope,
  type SessionCredentials,
  type SessionView,
  type WorkspacesView,
} from './wire';

export const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

export type ServiceErrorKind = ErrorKind | 'transport' | 'protocol';

export class ServiceError extends Error {
  override name = 'ServiceError';
  constructor(
    readonly kind: ServiceErrorKind,
    /** For `transport`: whether the whole request had been sent before it failed. */
    readonly delivered = false,
    readonly status?: number,
    /** For a refusal: the Story 1.11 deny reason, when the service gave one. */
    readonly reason?: DenyReason,
  ) {
    super(kind === 'transport' ? `shared-service request failed (${delivered ? 'response lost' : 'not sent'})` : `shared-service error: ${kind}`);
  }

  /** True when the request may have taken effect but no answer arrived. */
  get uncertain(): boolean {
    return (this.kind === 'transport' && this.delivered) || this.kind === 'uncertain_outcome';
  }
}

export class IssuerError extends Error {
  override name = 'IssuerError';
  constructor(
    /** The OAuth error code, `transport` or `protocol`. */
    readonly code: string,
  ) {
    super(`identity provider error: ${code}`);
  }
}

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  contentType: string;
  location: string | null;
  text: string;
}

/** One HTTPS exchange; rejects with a `transport` `ServiceError` when no answer arrived. */
export type HttpsTransport = (request: HttpRequest) => Promise<HttpResponse>;

/** The real transport: `node:https` with the configured CA as the only trust anchor. */
export function httpsTransport(ca: string, timeoutMs = REQUEST_TIMEOUT_MS): HttpsTransport {
  return (request) =>
    new Promise<HttpResponse>((resolve, reject) => {
      const url = new URL(request.url);
      if (url.protocol !== 'https:') {
        reject(new ServiceError('transport'));
        return;
      }
      let delivered = false;
      let done = false;
      const finish = (outcome: { response: HttpResponse } | { error: ServiceError }) => {
        if (done) return;
        done = true;
        if ('response' in outcome) resolve(outcome.response);
        else reject(outcome.error);
      };
      const headers: Record<string, string> = { Accept: 'application/json', ...request.headers };
      if (request.body !== undefined) headers['Content-Length'] = String(Buffer.byteLength(request.body));
      const req = https.request(url, {
        method: request.method,
        headers,
        ca,
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        agent: false,
        timeout: timeoutMs,
      });
      req.on('finish', () => {
        delivered = true;
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', () => finish({ error: new ServiceError('transport', delivered) }));
      req.on('response', (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            res.destroy();
            finish({ error: new ServiceError('protocol', true, res.statusCode) });
            return;
          }
          chunks.push(chunk);
        });
        res.on('error', () => finish({ error: new ServiceError('transport', true) }));
        res.on('end', () =>
          finish({
            response: {
              status: res.statusCode ?? 0,
              contentType: String(res.headers['content-type'] ?? ''),
              location: typeof res.headers.location === 'string' ? res.headers.location : null,
              text: Buffer.concat(chunks).toString('utf8'),
            },
          }),
        );
      });
      req.end(request.body);
    });
}

function json(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The shared service's `/v1` API. */
export interface SharedService {
  capabilities(): Promise<Capabilities>;
  createLoginTransaction(request: CreateLoginTransactionRequest): Promise<LoginTransaction>;
  bootstrap(request: BootstrapRequest): Promise<SessionCredentials>;
  abandon(request: AbandonLoginRequest): Promise<AbandonLoginResponse>;
  refresh(refreshCredential: string): Promise<SessionCredentials>;
  /** Revokes the family of `refreshCredential`, or of `accessCredential` when no refresh credential is given. */
  revokeFamily(credential: { refreshCredential: string } | { accessCredential: string }): Promise<RevokeFamilyResponse>;
  session(accessCredential: string): Promise<SessionView>;
  sessionCommand(accessCredential: string, envelope: SessionCommandEnvelope): Promise<CommandResponse>;
  /** `GET /v1/workspaces`: the caller's active `internal_company` memberships (Story 1.11). */
  workspaces(accessCredential: string): Promise<WorkspacesView>;
  /** `POST /v1/workspaces/{id}/commands` with a `create_engagement` envelope. */
  workspaceCommand(accessCredential: string, envelope: CreateEngagementEnvelope): Promise<CommandResponse>;
  /** `POST /v1/invites/{id}/accept`: accepts an invite bound to the caller. */
  acceptInvite(accessCredential: string, inviteId: string): Promise<AcceptInviteResponse>;
  /** `GET /v1/workspaces/{id}/execution-policy`: the Workspace execution policy (Story 1.18). */
  executionPolicy(accessCredential: string, workspaceId: string): Promise<ExecutionPolicyView>;
}

export class SharedServiceClient implements SharedService {
  constructor(
    private readonly baseUrl: string,
    private readonly transport: HttpsTransport,
  ) {}

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    parse: (value: unknown, path: string) => T,
    options: { body?: unknown; bearer?: string } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.bearer !== undefined) headers.Authorization = `Bearer ${options.bearer}`;
    const response = await this.transport({
      url: `${this.baseUrl}${path}`,
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const body = json(response.text);
    if (response.status >= 200 && response.status < 300) {
      try {
        return parse(body, '');
      } catch {
        throw new ServiceError('protocol', true, response.status);
      }
    }
    let kind: ServiceErrorKind = 'protocol';
    let reason: DenyReason | undefined;
    try {
      const parsed = parseErrorBody(body, '');
      if ((ERROR_KINDS as readonly string[]).includes(parsed.error.kind)) kind = parsed.error.kind;
      reason = parsed.error.reason;
    } catch {
      kind = 'protocol';
    }
    throw new ServiceError(kind, true, response.status, reason);
  }

  async capabilities(): Promise<Capabilities> {
    const capabilities = await this.call('GET', '/v1/capabilities', parseCapabilities);
    if (capabilities.protocol_major !== PROTOCOL_MAJOR) throw new ServiceError('unsupported_contract', true);
    return capabilities;
  }

  createLoginTransaction(request: CreateLoginTransactionRequest): Promise<LoginTransaction> {
    return this.call('POST', '/v1/login/transactions', parseLoginTransaction, { body: request });
  }

  bootstrap(request: BootstrapRequest): Promise<SessionCredentials> {
    return this.call('POST', '/v1/login/bootstrap', parseSessionCredentials, { body: request });
  }

  abandon(request: AbandonLoginRequest): Promise<AbandonLoginResponse> {
    return this.call('POST', '/v1/login/abandon', parseAbandonLoginResponse, { body: request });
  }

  refresh(refreshCredential: string): Promise<SessionCredentials> {
    return this.call('POST', '/v1/session/refresh', parseSessionCredentials, { body: { refresh_credential: refreshCredential } });
  }

  revokeFamily(credential: { refreshCredential: string } | { accessCredential: string }): Promise<RevokeFamilyResponse> {
    return 'refreshCredential' in credential
      ? this.call('POST', '/v1/session/refresh-family/revoke', parseRevokeFamilyResponse, { body: { refresh_credential: credential.refreshCredential } })
      : this.call('POST', '/v1/session/refresh-family/revoke', parseRevokeFamilyResponse, { body: {}, bearer: credential.accessCredential });
  }

  session(accessCredential: string): Promise<SessionView> {
    return this.call('GET', '/v1/session', parseSessionView, { bearer: accessCredential });
  }

  sessionCommand(accessCredential: string, envelope: SessionCommandEnvelope): Promise<CommandResponse> {
    return this.call('POST', '/v1/session/commands', parseCommandResponse, { body: envelope, bearer: accessCredential });
  }

  workspaces(accessCredential: string): Promise<WorkspacesView> {
    return this.call('GET', '/v1/workspaces', parseWorkspacesView, { bearer: accessCredential });
  }

  workspaceCommand(accessCredential: string, envelope: CreateEngagementEnvelope): Promise<CommandResponse> {
    return this.call('POST', `/v1/workspaces/${encodeURIComponent(envelope.workspace_id)}/commands`, parseCommandResponse, {
      body: envelope,
      bearer: accessCredential,
    });
  }

  acceptInvite(accessCredential: string, inviteId: string): Promise<AcceptInviteResponse> {
    return this.call('POST', `/v1/invites/${encodeURIComponent(inviteId)}/accept`, parseAcceptInviteResponse, { body: {}, bearer: accessCredential });
  }

  executionPolicy(accessCredential: string, workspaceId: string): Promise<ExecutionPolicyView> {
    return this.call('GET', `/v1/workspaces/${encodeURIComponent(workspaceId)}/execution-policy`, parseExecutionPolicyView, { bearer: accessCredential });
  }
}

/** The issuer endpoints the desktop uses, from discovery. */
export interface IssuerEndpoints {
  authorizationEndpoint: string;
  tokenEndpoint: string;
}

export interface CodeExchange {
  tokenEndpoint: string;
  code: string;
  redirectUri: string;
  clientId: string;
  codeVerifier: string;
}

/** The OIDC issuer: discovery and the authorization-code exchange. */
export interface Issuer {
  discover(): Promise<IssuerEndpoints>;
  /** Exchanges the code; resolves with the ID token exactly as received. */
  exchangeCode(exchange: CodeExchange): Promise<string>;
}

/** An `https:` URL on the same origin as `issuer`, or null. */
function endpointOn(issuer: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === new URL(issuer).origin && !url.hash ? url.toString() : null;
  } catch {
    return null;
  }
}

export class IssuerClient implements Issuer {
  constructor(
    private readonly issuerUrl: string,
    private readonly transport: HttpsTransport,
  ) {}

  async discover(): Promise<IssuerEndpoints> {
    let response: HttpResponse;
    try {
      response = await this.transport({ url: `${this.issuerUrl}/.well-known/openid-configuration`, method: 'GET' });
    } catch {
      throw new IssuerError('transport');
    }
    const body = json(response.text) as Record<string, unknown> | undefined;
    if (response.status !== 200 || typeof body !== 'object' || body === null) throw new IssuerError('protocol');
    const authorizationEndpoint = endpointOn(this.issuerUrl, body.authorization_endpoint);
    const tokenEndpoint = endpointOn(this.issuerUrl, body.token_endpoint);
    const methods = body.code_challenge_methods_supported;
    if (body.issuer !== this.issuerUrl || !authorizationEndpoint || !tokenEndpoint || !Array.isArray(methods) || !methods.includes('S256')) {
      throw new IssuerError('protocol');
    }
    return { authorizationEndpoint, tokenEndpoint };
  }

  async exchangeCode(exchange: CodeExchange): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: exchange.code,
      redirect_uri: exchange.redirectUri,
      client_id: exchange.clientId,
      code_verifier: exchange.codeVerifier,
    }).toString();
    let response: HttpResponse;
    try {
      response = await this.transport({
        url: exchange.tokenEndpoint,
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch {
      throw new IssuerError('transport');
    }
    const parsed = json(response.text) as Record<string, unknown> | undefined;
    if (response.status !== 200) {
      const code = typeof parsed?.error === 'string' && /^[a-z_]{1,64}$/.test(parsed.error) ? parsed.error : 'protocol';
      throw new IssuerError(code);
    }
    const idToken = parsed?.id_token;
    if (typeof idToken !== 'string' || idToken === '' || idToken.length > 16 * 1024) throw new IssuerError('protocol');
    return idToken;
  }
}
