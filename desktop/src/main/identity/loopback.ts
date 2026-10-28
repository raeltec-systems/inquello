/**
 * The loopback redirect listener for the system-browser sign-in (RFC 8252 §7.3).
 *
 * It binds `127.0.0.1` on an ephemeral port and serves only `GET /callback`.
 * Exactly one callback is accepted: the first one whose `state` equals this
 * sign-in's one-use `state` (compared in constant time). Any other request,
 * including a callback with a mismatched or replayed `state`, gets a plain 400
 * and the listener keeps waiting. After the matching callback, or when the
 * timeout (5 minutes by default) passes, the listener closes, so a replayed
 * callback finds nothing listening.
 *
 * A matching callback that carries `error`, an `iss` other than the expected
 * issuer (RFC 9207), or no `code` fails the sign-in. The browser page never
 * echoes a parameter, and nothing here logs one.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { secretEquals } from './pkce';

export const CALLBACK_PATH = '/callback';
export const DEFAULT_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_CODE_LENGTH = 2048;

export type LoopbackFailure = 'timeout' | 'denied' | 'issuer-mismatch' | 'malformed' | 'closed';

export class LoopbackError extends Error {
  override name = 'LoopbackError';
  constructor(readonly failure: LoopbackFailure) {
    super(`loopback callback failed: ${failure}`);
  }
}

export interface LoopbackCallback {
  code: string;
}

export interface LoopbackListener {
  /** `http://127.0.0.1:<port>/callback`. */
  redirectUri: string;
  /** Resolves with the one accepted callback, or rejects with a `LoopbackError`. */
  callback: Promise<LoopbackCallback>;
  /** Stops listening; a pending `callback` rejects with `closed`. */
  close(): void;
}

export interface LoopbackOptions {
  state: string;
  /** When the callback carries `iss`, it must equal this issuer. */
  issuer: string;
  timeoutMs?: number;
}

const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function page(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${message}</p></body></html>`;
}

/** Reads one query parameter, refusing a parameter that appears more than once. */
function single(params: URLSearchParams, name: string): string | null | undefined {
  const values = params.getAll(name);
  if (values.length > 1) return undefined;
  return values[0] ?? null;
}

export async function startLoopbackListener(options: LoopbackOptions): Promise<LoopbackListener> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS;
  let settled = false;
  let resolveCallback!: (value: LoopbackCallback) => void;
  let rejectCallback!: (error: LoopbackError) => void;
  const callback = new Promise<LoopbackCallback>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  // A caller that never awaits must not produce an unhandled rejection.
  callback.catch(() => undefined);

  const server = http.createServer();
  let port = 0;
  let timer: NodeJS.Timeout | undefined;

  const shutdown = () => {
    if (timer) clearTimeout(timer);
    server.close();
    server.closeAllConnections();
  };
  const settle = (outcome: { ok: LoopbackCallback } | { error: LoopbackFailure }) => {
    if (settled) return;
    settled = true;
    if ('ok' in outcome) resolveCallback(outcome.ok);
    else rejectCallback(new LoopbackError(outcome.error));
    // Let the response to the accepted request flush before closing.
    setImmediate(shutdown);
  };

  server.on('request', (request, response) => {
    const refuse = () => {
      response.writeHead(400, PAGE_HEADERS);
      response.end(page('Sign-in link not valid', 'This sign-in link is not valid for the current sign-in. Return to Inquello.'));
    };
    if (settled || request.method !== 'GET' || request.headers.host !== `127.0.0.1:${port}`) return refuse();
    let url: URL;
    try {
      url = new URL(request.url ?? '', `http://127.0.0.1:${port}`);
    } catch {
      return refuse();
    }
    if (url.pathname !== CALLBACK_PATH) return refuse();
    const state = single(url.searchParams, 'state');
    if (typeof state !== 'string' || !secretEquals(state, options.state)) return refuse();

    // The state matches: this is the one callback for this sign-in.
    const error = single(url.searchParams, 'error');
    const issuer = single(url.searchParams, 'iss');
    const code = single(url.searchParams, 'code');
    let failure: LoopbackFailure | null = null;
    if (error !== null) failure = 'denied';
    else if (issuer === undefined || (issuer !== null && issuer !== options.issuer)) failure = 'issuer-mismatch';
    else if (typeof code !== 'string' || code === '' || code.length > MAX_CODE_LENGTH) failure = 'malformed';
    response.writeHead(200, PAGE_HEADERS);
    response.end(
      failure === null
        ? page('Sign-in received', 'You can close this tab and return to Inquello.')
        : page('Sign-in not completed', 'The sign-in did not complete. Return to Inquello to try again.'),
    );
    settle(failure === null ? { ok: { code: code as string } } : { error: failure });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  port = (server.address() as AddressInfo).port;
  timer = setTimeout(() => settle({ error: 'timeout' }), timeoutMs);
  timer.unref?.();

  return {
    redirectUri: `http://127.0.0.1:${port}${CALLBACK_PATH}`,
    callback,
    close: () => {
      if (!settled) {
        settled = true;
        rejectCallback(new LoopbackError('closed'));
      }
      shutdown();
    },
  };
}
