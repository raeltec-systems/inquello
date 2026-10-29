/**
 * The free Claude API key check (Story 1.13), run only when the user asks.
 *
 * One `GET <base>/v1/models` with `x-api-key` and `anthropic-version:
 * 2023-06-01`, a 10 s timeout and no retries; redirects are not followed and
 * the body is discarded. It lists models and never sends a Messages request.
 *
 * - 200: `verified`.
 * - 401 or 403: `rejected` (the key is kept until the user removes it).
 * - A network or TLS error, a timeout, or any other answer: `unreachable`
 *   (the service could not confirm the key either way).
 *
 * The base URL is `https://api.anthropic.com` unless the dev config names
 * another HTTPS origin and the CA that alone is trusted for it (tests point
 * it at a local fake). Errors are reduced to these states, so the key never
 * reaches a message or a log.
 */
import https from 'node:https';

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
export const ANTHROPIC_VERSION = '2023-06-01';
export const VERIFY_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 1024 * 1024;

export type VerifyOutcome = 'verified' | 'rejected' | 'unreachable';

export interface VerifyTarget {
  /** An `https:` origin. */
  baseUrl: string;
  /** PEM CA certificate(s) trusted for `baseUrl` instead of the system store (dev config only). */
  ca?: string;
  timeoutMs?: number;
}

export function verifyClaudeKey(key: string, target: VerifyTarget): Promise<VerifyOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: VerifyOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    let url: URL;
    try {
      url = new URL('/v1/models', target.baseUrl);
    } catch {
      finish('unreachable');
      return;
    }
    if (url.protocol !== 'https:') {
      finish('unreachable');
      return;
    }
    const options: https.RequestOptions = {
      method: 'GET',
      headers: { 'x-api-key': key, 'anthropic-version': ANTHROPIC_VERSION, accept: 'application/json' },
      agent: false,
      rejectUnauthorized: true,
      ...(target.ca ? { ca: target.ca } : {}),
    };
    const request = https.request(url, options, (response) => {
      const status = response.statusCode ?? 0;
      let received = 0;
      response.on('data', (chunk: Buffer) => {
        received += chunk.length;
        if (received > MAX_BODY_BYTES) response.destroy();
      });
      response.on('error', () => undefined);
      response.on('close', () => undefined);
      response.resume();
      if (status === 200) finish('verified');
      else if (status === 401 || status === 403) finish('rejected');
      else finish('unreachable');
    });
    request.setTimeout(target.timeoutMs ?? VERIFY_TIMEOUT_MS, () => {
      request.destroy();
      finish('unreachable');
    });
    request.on('error', () => finish('unreachable'));
    request.end();
  });
}
