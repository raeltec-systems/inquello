/**
 * Shared-service configuration for the desktop (SC-7 dev topology).
 *
 * `INQUELLO_SERVICE_CONFIG` names a JSON file with exactly
 * `{ service_url, issuer_url, issuer_label, ca_path, client_id }`, which is the
 * line `inquello-dev-topology` prints. Without the variable the shared service
 * is `not-configured` and nothing is contacted.
 *
 * The service URL is an HTTPS origin. The issuer is an exact HTTPS URL, with
 * optional path/trailing slash, but no query, fragment or user info. An optional
 * callback_port selects an exactly registered fixed native callback.
 * ca_path always pins service trust. issuer_trust explicitly selects system,
 * service-ca (operator fixtures), or custom-ca with issuer_ca_path. An auth0
 * identity_profile requires explicit issuer trust and its registered fixed port.
 * No trust store is modified. The issuer label is configuration, not token claims.
 */
import fs from 'node:fs';

export const SERVICE_CONFIG_ENV = 'INQUELLO_SERVICE_CONFIG';

export interface ServiceConfig {
  /** `https://host:port` of the shared service, without a trailing slash. */
  serviceUrl: string;
  /** The exact OIDC issuer URL (`iss`). */
  issuerUrl: string;
  /** What the UI calls the issuer. */
  issuerLabel: string;
  /** The PEM CA certificate(s) pinned for the service; issuer trust is independent. */
  ca: string;
  /** The public native client ID registered with the issuer. */
  clientId: string;
  /** Explicitly registered Auth0 loopback port. No fallback if occupied. */
  callbackPort?: number;
  identityProfile?: 'auth0' | 'operator';
  /** null selects public/system roots; undefined retains operator compatibility. */
  issuerCa?: string | null;
}

export type ConfigResult = { kind: 'not-configured' } | { kind: 'invalid'; reason: string } | { kind: 'configured'; config: ServiceConfig };

const KEYS = ['service_url', 'issuer_url', 'issuer_label', 'ca_path', 'client_id'] as const;
const MAX_CONFIG_BYTES = 64 * 1024;
const MAX_CA_BYTES = 256 * 1024;

/** An `https:` origin with nothing after it; returns it without a trailing slash. */
export function httpsOrigin(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== '/' && url.pathname !== '') return null;
  if (value.replace(/\/$/, '') !== url.origin) return null;
  return url.origin;
}

/** Parses the config file's JSON text and reads its CA file. */
export function parseServiceConfig(text: string, readFile: (path: string) => string): ConfigResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'the configuration is not JSON' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: 'invalid', reason: 'the configuration is not an object' };
  const record = raw as Record<string, unknown>;
  const keys = Object.keys(record).filter(key => !['callback_port','identity_profile','issuer_trust','issuer_ca_path'].includes(key)).sort();
  const callbackPort = record.callback_port;
  if (callbackPort !== undefined && (typeof callbackPort !== 'number' || !Number.isInteger(callbackPort) || callbackPort < 1024 || callbackPort > 65535)) return { kind: 'invalid', reason: 'callback_port must be an explicit unprivileged port' };
  if (JSON.stringify(keys) !== JSON.stringify([...KEYS].sort())) return { kind: 'invalid', reason: 'the configuration keys are not the expected ones' };
  const profile = record.identity_profile;
  if(profile !== undefined && profile !== 'auth0' && profile !== 'operator') return {kind:'invalid',reason:'identity_profile must be auth0 or operator'};
  const trust = record.issuer_trust;
  if(trust !== undefined && trust !== 'system' && trust !== 'service-ca' && trust !== 'custom-ca') return {kind:'invalid',reason:'issuer_trust must explicitly select system, service-ca or custom-ca'};
  if(profile === 'auth0' && (callbackPort === undefined || trust === undefined)) return {kind:'invalid',reason:'Auth0 requires the registered fixed callback_port and explicit issuer_trust'};
  if(record.issuer_ca_path !== undefined && trust !== 'custom-ca') return {kind:'invalid',reason:'issuer_ca_path requires custom-ca issuer trust'};
  const serviceUrl = httpsOrigin(record.service_url);
  const issuerUrl = httpsIssuer(record.issuer_url);
  if (!serviceUrl || !issuerUrl) return { kind: 'invalid', reason: 'service_url must be an https origin and issuer_url an exact https issuer' };
  if(/(^|\.)auth0\.com$/i.test(new URL(issuerUrl).hostname) && profile !== 'auth0') return {kind:'invalid',reason:'Auth0 issuers require an explicit auth0 identity_profile'};
  const { issuer_label: issuerLabel, client_id: clientId, ca_path: caPath } = record;
  if (typeof issuerLabel !== 'string' || issuerLabel.trim() === '' || issuerLabel.length > 120) {
    return { kind: 'invalid', reason: 'issuer_label must be a short non-empty string' };
  }
  if (typeof clientId !== 'string' || clientId === '' || clientId.length > 256) return { kind: 'invalid', reason: 'client_id must be a non-empty string' };
  if (typeof caPath !== 'string' || caPath === '') return { kind: 'invalid', reason: 'ca_path must be a path' };
  let ca: string;
  try {
    ca = readFile(caPath);
  } catch {
    return { kind: 'invalid', reason: 'the CA certificate could not be read' };
  }
  if (ca.length > MAX_CA_BYTES || !ca.includes('-----BEGIN CERTIFICATE-----')) return { kind: 'invalid', reason: 'ca_path does not hold a PEM certificate' };
  if (ca.includes('PRIVATE KEY')) return { kind: 'invalid', reason: 'ca_path must hold only certificates' };
  let issuerCa: string | null | undefined;
  if(trust === 'system') issuerCa = null;
  if(trust === 'service-ca') issuerCa = ca;
  if(trust === 'custom-ca') {
    if(typeof record.issuer_ca_path !== 'string' || !record.issuer_ca_path) return {kind:'invalid',reason:'custom-ca issuer trust requires issuer_ca_path'};
    try {issuerCa=readFile(record.issuer_ca_path);}catch {return {kind:'invalid',reason:'the issuer CA certificate could not be read'};}
    if(issuerCa.length>MAX_CA_BYTES || !issuerCa.includes('-----BEGIN CERTIFICATE-----') || issuerCa.includes('PRIVATE KEY')) return {kind:'invalid',reason:'issuer_ca_path must hold only PEM certificates'};
  }
  return { kind: 'configured', config: { serviceUrl, issuerUrl, issuerLabel: issuerLabel.trim(), ca, clientId, ...(profile===undefined?{}:{identityProfile:profile as 'auth0'|'operator'}), ...(issuerCa===undefined?{}:{issuerCa}), ...(callbackPort === undefined ? {} : { callbackPort: callbackPort as number }) } };
}

/** Reads the configuration named by `INQUELLO_SERVICE_CONFIG`, if any. */
export function loadServiceConfig(env: NodeJS.ProcessEnv): ConfigResult {
  const file = env[SERVICE_CONFIG_ENV];
  if (file === undefined || file === '') return { kind: 'not-configured' };
  let text: string;
  try {
    if (fs.statSync(file).size > MAX_CONFIG_BYTES) return { kind: 'invalid', reason: 'the configuration file is too large' };
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { kind: 'invalid', reason: 'the configuration file could not be read' };
  }
  return parseServiceConfig(text, (path) => {
    if (fs.statSync(path).size > MAX_CA_BYTES) throw new Error('CA file too large');
    return fs.readFileSync(path, 'utf8');
  });
}

/** Preserve the exact issuer string, including path/trailing slash. */
export function httpsIssuer(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    if (url.toString() !== value && url.origin !== value) return null;
    return value;
  } catch { return null; }
}
