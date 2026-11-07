/**
 * Renderer boundary policy (AD-5), applied by main to every `webContents` and
 * every session it uses, so windows created later inherit it.
 *
 * - Navigation, redirects and frame navigations off `inquello://app/` are prevented.
 * - New windows and `<webview>` attachment are denied.
 * - Every permission request and check is denied.
 * - Session requests other than `inquello:` and `devtools:` are cancelled.
 * - Responses carry the same CSP as the renderer's `index.html` (`src/renderer/`).
 *
 * Electron is used through `import type` only; callers pass the live objects in.
 */
import type { Session, WebContents, WebPreferences } from 'electron';

import type { Logger } from '../runtime/logger';

export const APP_SCHEME = 'inquello';
export const APP_HOST = 'app';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
export const APP_ENTRY_URL = `${APP_ORIGIN}/index.html`;

/**
 * Mirrors the CSP meta in `src/renderer/index.html`. Scripts, styles, fonts and
 * images may load only from the app origin; everything else stays `'none'`.
 */
export const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'";

/** URL schemes the renderer session may request; everything else is cancelled. */
export const ALLOWED_REQUEST_SCHEMES: readonly string[] = [`${APP_SCHEME}:`, 'devtools:'];

/** True only for URLs on exactly `inquello://app` (no credentials, no port). */
export function isAppUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === `${APP_SCHEME}:` &&
    parsed.hostname === APP_HOST &&
    parsed.host === APP_HOST &&
    parsed.username === '' &&
    parsed.password === ''
  );
}

export function isAllowedRequestUrl(url: string): boolean {
  const colon = url.indexOf(':');
  if (colon <= 0) return false;
  return ALLOWED_REQUEST_SCHEMES.includes(url.slice(0, colon + 1).toLowerCase());
}

export type BlockedKind = 'navigation' | 'redirect' | 'frame-navigation' | 'window-open' | 'webview' | 'request';

export interface PolicyOptions {
  logger: Logger;
  /** Called for each blocked action, after it is logged. */
  onBlocked?: (kind: BlockedKind, url: string) => void;
}

/** The only `webPreferences` main gives a window. */
export function secureWebPreferences(preloadPath: string): WebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    navigateOnDragDrop: false,
    spellcheck: false,
  };
}

function blocker(options: PolicyOptions) {
  return (kind: BlockedKind, url: string): void => {
    options.logger.warn(`blocked ${kind}: ${url}`);
    try {
      options.onBlocked?.(kind, url);
    } catch (error) {
      options.logger.error(`blocked-action listener threw: ${(error as Error).message}`);
    }
  };
}

/** Navigation, window and webview hooks for one `webContents`. */
export function applyContentsPolicy(contents: WebContents, options: PolicyOptions): void {
  const block = blocker(options);
  contents.on('will-navigate', (event) => {
    if (isAppUrl(event.url)) return;
    event.preventDefault();
    block('navigation', event.url);
  });
  contents.on('will-frame-navigate', (event) => {
    if (isAppUrl(event.url)) return;
    event.preventDefault();
    block('frame-navigation', event.url);
  });
  contents.on('will-redirect', (event) => {
    if (isAppUrl(event.url)) return;
    event.preventDefault();
    block('redirect', event.url);
  });
  contents.on('will-attach-webview', (event, _webPreferences, params) => {
    event.preventDefault();
    block('webview', params.src ?? '');
  });
  contents.setWindowOpenHandler(({ url }) => {
    block('window-open', url);
    return { action: 'deny' };
  });
}

const hardenedSessions = new WeakSet<Session>();

/** Permission, request and header hooks for one session; idempotent per session. */
export function applySessionPolicy(session: Session, options: PolicyOptions): void {
  if (hardenedSessions.has(session)) return;
  hardenedSessions.add(session);
  const block = blocker(options);
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
  session.webRequest.onBeforeRequest((details, callback) => {
    if (isAllowedRequestUrl(details.url)) {
      callback({});
      return;
    }
    block('request', details.url);
    callback({ cancel: true });
  });
  session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders ?? {}) };
    for (const key of Object.keys(responseHeaders)) {
      if (key.toLowerCase() === 'content-security-policy') delete responseHeaders[key];
    }
    responseHeaders['Content-Security-Policy'] = [CONTENT_SECURITY_POLICY];
    callback({ responseHeaders });
  });
}
