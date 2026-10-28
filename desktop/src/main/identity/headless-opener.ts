/**
 * A headless `BrowserOpener` for the smoke run and integration tests against
 * the synthetic topology: it plays the system browser's part without a UI.
 *
 * It GETs the authorization URL over HTTPS (trusting only the configured CA),
 * expects the synthetic issuer's auto-consent redirect, and follows it only
 * when the `Location` is a plain-HTTP loopback callback on `127.0.0.1`. It
 * never follows any other redirect and never logs a URL: the callback carries
 * the authorization code.
 */
import http from 'node:http';

import type { BrowserOpener } from './browser';
import type { HttpsTransport } from './service-client';

export function headlessOpener(transport: HttpsTransport): BrowserOpener {
  return async (url) => {
    const response = await transport({ url, method: 'GET', headers: { Accept: 'text/html' } });
    if (response.status !== 302 || !response.location) throw new Error(`the issuer answered ${response.status} without a redirect`);
    const callback = new URL(response.location);
    if (callback.protocol !== 'http:' || callback.hostname !== '127.0.0.1') throw new Error('the issuer redirected somewhere other than the loopback callback');
    await new Promise<void>((resolve, reject) => {
      const request = http.get(callback, (res) => {
        res.resume();
        res.on('end', () => (res.statusCode === 200 ? resolve() : reject(new Error(`the loopback callback answered ${res.statusCode}`))));
      });
      request.setTimeout(10_000, () => request.destroy(new Error('loopback callback timed out')));
      request.on('error', reject);
    });
  };
}
