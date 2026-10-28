/**
 * The `inquello://app/` scheme: the only origin renderer content loads from.
 *
 * It serves files under `static/` and nothing else. Paths are resolved by the
 * pure `resolveAppPath`, which rejects traversal (`..`, encoded `..`, encoded
 * separators, backslashes, NUL) and anything that resolves outside the root.
 * Files are read with `fs` in main rather than `net.fetch(file://)`, so no
 * `file:` request ever passes through the renderer session.
 *
 * Electron is used through `import type` only; callers pass the live objects in.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { Protocol } from 'electron';

import type { Logger } from '../runtime/logger';
import { APP_HOST, APP_SCHEME, CONTENT_SECURITY_POLICY } from './policy';

/** Must be passed to `protocol.registerSchemesAsPrivileged` before `ready`. */
export const APP_SCHEME_PRIVILEGES = {
  scheme: APP_SCHEME,
  privileges: { standard: true, secure: true },
} as const;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Maps a URL pathname (still percent-encoded) to a file under `root`, or
 * `undefined` when it must not be served. `/` maps to `index.html`.
 */
export function resolveAppPath(root: string, urlPathname: string): string | undefined {
  if (!urlPathname.startsWith('/')) return undefined;
  const rawSegments = urlPathname.slice(1).split('/');
  const segments: string[] = [];
  for (const raw of rawSegments) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      return undefined;
    }
    if (segment === '.' || segment === '..') return undefined;
    if (/[/\\\0:]/.test(segment)) return undefined;
    segments.push(segment);
  }
  // Empty segments come only from `//` or a trailing slash; the root alone is allowed.
  if (segments.length === 1 && segments[0] === '') segments[0] = 'index.html';
  if (segments.some((segment) => segment === '')) return undefined;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...segments);
  if (!resolved.startsWith(resolvedRoot + path.sep)) return undefined;
  return resolved;
}

function securityHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
}

function notFound(): Response {
  return new Response('not found', { status: 404, headers: securityHeaders('text/plain; charset=utf-8') });
}

/** Handles one `inquello:` request against `root`. Exported for tests. */
export async function serveAppRequest(
  request: { url: string; method: string },
  root: string,
  logger: Logger,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405, headers: securityHeaders('text/plain; charset=utf-8') });
  }
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return notFound();
  }
  if (url.protocol !== `${APP_SCHEME}:` || url.host !== APP_HOST || url.username !== '' || url.password !== '') {
    logger.warn(`app protocol: refused ${request.url}`);
    return notFound();
  }
  const filePath = resolveAppPath(root, url.pathname);
  if (!filePath) {
    logger.warn(`app protocol: refused path ${url.pathname}`);
    return notFound();
  }
  try {
    const body = await fs.readFile(filePath);
    return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: securityHeaders(contentTypeFor(filePath)) });
  } catch {
    return notFound();
  }
}

/** Installs the handler on a session's protocol; call after `ready`. */
export function handleAppProtocol(protocol: Pick<Protocol, 'handle'>, root: string, logger: Logger): void {
  protocol.handle(APP_SCHEME, (request) => serveAppRequest(request, root, logger));
}
