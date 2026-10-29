/**
 * The provider dev config (Story 1.13): the only way to point the Claude key
 * check somewhere other than `https://api.anthropic.com`.
 *
 * `INQUELLO_PROVIDER_DEV_CONFIG` names a JSON file with exactly
 * `{ anthropic_base_url, ca_path }`: an `https:` origin and a PEM file of CA
 * certificates (no key) that alone is trusted for it. Tests use it for a local
 * fake endpoint. It is read only in an unpackaged (development) build, and
 * the variable never reaches the runtime.
 */
import fs from 'node:fs';

import { httpsOrigin } from '../identity/config';
import { ANTHROPIC_BASE_URL, type VerifyTarget } from './claude-verify';

export const PROVIDER_DEV_CONFIG_ENV = 'INQUELLO_PROVIDER_DEV_CONFIG';

const KEYS = ['anthropic_base_url', 'ca_path'] as const;
const MAX_FILE_BYTES = 256 * 1024;

export type ProviderDevConfig = { kind: 'default'; target: VerifyTarget } | { kind: 'dev'; target: VerifyTarget } | { kind: 'invalid'; reason: string };

/** Parses the dev config's JSON text; `readFile` reads the CA file. */
export function parseProviderDevConfig(text: string, readFile: (file: string) => string): ProviderDevConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: 'invalid', reason: 'the provider dev config is not JSON' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: 'invalid', reason: 'the provider dev config is not an object' };
  const record = raw as Record<string, unknown>;
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify([...KEYS].sort())) return { kind: 'invalid', reason: 'the provider dev config keys are not the expected ones' };
  const baseUrl = httpsOrigin(record.anthropic_base_url);
  if (!baseUrl) return { kind: 'invalid', reason: 'anthropic_base_url must be an https origin' };
  if (typeof record.ca_path !== 'string' || record.ca_path === '') return { kind: 'invalid', reason: 'ca_path must be a path' };
  let ca: string;
  try {
    ca = readFile(record.ca_path);
  } catch {
    return { kind: 'invalid', reason: 'the CA certificate could not be read' };
  }
  if (ca.length > MAX_FILE_BYTES || !ca.includes('-----BEGIN CERTIFICATE-----')) return { kind: 'invalid', reason: 'ca_path does not hold a PEM certificate' };
  if (ca.includes('PRIVATE KEY')) return { kind: 'invalid', reason: 'ca_path must hold only certificates' };
  return { kind: 'dev', target: { baseUrl, ca } };
}

/** The verification target: the dev config when allowed and set, otherwise Anthropic's API. */
export function loadProviderDevConfig(env: NodeJS.ProcessEnv, allowDev: boolean): ProviderDevConfig {
  const file = env[PROVIDER_DEV_CONFIG_ENV];
  if (!allowDev || file === undefined || file === '') return { kind: 'default', target: { baseUrl: ANTHROPIC_BASE_URL } };
  let text: string;
  try {
    if (fs.statSync(file).size > MAX_FILE_BYTES) return { kind: 'invalid', reason: 'the provider dev config is too large' };
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { kind: 'invalid', reason: 'the provider dev config could not be read' };
  }
  return parseProviderDevConfig(text, (caFile) => {
    if (fs.statSync(caFile).size > MAX_FILE_BYTES) throw new Error('CA file too large');
    return fs.readFileSync(caFile, 'utf8');
  });
}
