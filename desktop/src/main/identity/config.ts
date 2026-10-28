/**
 * Shared-service configuration for the desktop (SC-7 dev topology).
 *
 * `INQUELLO_SERVICE_CONFIG` names a JSON file with exactly
 * `{ service_url, issuer_url, issuer_label, ca_path, client_id }`, which is the
 * line `inquello-dev-topology` prints. Without the variable the shared service
 * is `not-configured` and nothing is contacted.
 *
 * Both URLs must be `https:` origins (no path, query, fragment or user info).
 * The CA certificate at `ca_path` is the only trust anchor for these requests:
 * it is passed as a per-request `ca` option and never added to the system
 * trust store. The issuer label shown in the UI comes from this file, never
 * from token claims.
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
  /** The PEM CA certificate(s) trusted for both origins. */
  ca: string;
  /** The public native client ID registered with the issuer. */
  clientId: string;
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
  const keys = Object.keys(record).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...KEYS].sort())) return { kind: 'invalid', reason: 'the configuration keys are not the expected ones' };
  const serviceUrl = httpsOrigin(record.service_url);
  const issuerUrl = httpsOrigin(record.issuer_url);
  if (!serviceUrl || !issuerUrl) return { kind: 'invalid', reason: 'service_url and issuer_url must be https origins' };
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
  return { kind: 'configured', config: { serviceUrl, issuerUrl, issuerLabel: issuerLabel.trim(), ca, clientId } };
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
