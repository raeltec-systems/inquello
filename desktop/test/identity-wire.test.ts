/**
 * The desktop's TypeScript mirrors of `inquello-protocol` against the Rust
 * crate's JSON conformance fixtures: every fixture has a parser here, parses,
 * and round-trips unchanged. A drift in either direction fails this test.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WireError,
  parseAbandonLoginRequest,
  parseAbandonLoginResponse,
  parseBootstrapRequest,
  parseCapabilities,
  parseCommandResponse,
  parseCreateLoginTransactionRequest,
  parseErrorBody,
  parseLoginTransaction,
  parseMembershipsView,
  parseRefreshRequest,
  parseRevokeFamilyRequest,
  parseRevokeFamilyResponse,
  parseSessionCommandEnvelope,
  parseSessionCredentials,
  parseSessionView,
} from '../src/main/identity/wire';

const fixtures = path.resolve(__dirname, '..', '..', 'engine', 'codex-rs', 'inquello-protocol', 'fixtures');

const PARSERS: Record<string, (value: unknown, path: string) => unknown> = {
  'abandon_login_request.json': parseAbandonLoginRequest,
  'abandon_login_response.json': parseAbandonLoginResponse,
  'bootstrap_request.json': parseBootstrapRequest,
  'capabilities.json': parseCapabilities,
  'command_envelope_logout.json': parseSessionCommandEnvelope,
  'command_response.json': parseCommandResponse,
  'errors.json': (value, at) => {
    if (!Array.isArray(value)) throw new WireError('errors.json is not an array');
    return value.map((item, index) => parseErrorBody(item, `${at}[${index}]`));
  },
  'login_transaction.json': parseLoginTransaction,
  'login_transaction_request.json': parseCreateLoginTransactionRequest,
  'memberships_view.json': parseMembershipsView,
  'refresh_request.json': parseRefreshRequest,
  'revoke_family_request.json': parseRevokeFamilyRequest,
  'revoke_family_request_bearer.json': parseRevokeFamilyRequest,
  'revoke_family_response.json': parseRevokeFamilyResponse,
  'session_credentials.json': parseSessionCredentials,
  'session_view.json': parseSessionView,
};

const read = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));

describe('wire mirrors', () => {
  it('cover every protocol fixture', () => {
    const files = fs.readdirSync(fixtures).filter((name) => name.endsWith('.json')).sort();
    expect(files).toEqual(Object.keys(PARSERS).sort());
  });

  it.each(Object.keys(PARSERS))('%s parses and round-trips unchanged', (name) => {
    const value = read(name);
    const parsed = PARSERS[name]!(value, '');
    expect(JSON.parse(JSON.stringify(parsed))).toEqual(value);
  });

  // The revoke-family request's only key is optional, so it is covered below.
  it.each(Object.keys(PARSERS).filter((name) => !['errors.json', 'revoke_family_request.json', 'revoke_family_request_bearer.json'].includes(name)))(
    '%s rejects an unknown key and a missing key',
    (name) => {
      const value = read(name) as Record<string, unknown>;
      expect(() => PARSERS[name]!({ ...value, extra: 1 }, '')).toThrow(WireError);
      const [first] = Object.keys(value);
      const missing = { ...value };
      delete missing[first!];
      expect(() => PARSERS[name]!(missing, '')).toThrow(WireError);
    },
  );

  it('accepts the revoke-family request with or without its optional key, and nothing else', () => {
    expect(parseRevokeFamilyRequest({}, '')).toEqual({});
    expect(() => parseRevokeFamilyRequest({ refresh_credential: 1 }, '')).toThrow(WireError);
    expect(() => parseRevokeFamilyRequest({ access_credential: 'x' }, '')).toThrow(WireError);
  });

  it('checks value shapes and never echoes a value in the error', () => {
    const credentials = read('session_credentials.json') as Record<string, unknown>;
    const bad = { ...credentials, access_expires_at: '2026-10-28 12:15' };
    expect(() => parseSessionCredentials(bad, '')).toThrow(/access_expires_at/);
    const secretValue = { ...credentials, session_id: 'iqa_SECRET-not-a-uuid' };
    try {
      parseSessionCredentials(secretValue, '');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('SECRET');
    }
    const capabilities = read('capabilities.json') as Record<string, unknown>;
    for (const epoch of ['01', '-1', '1.0', '', 1, '18446744073709551616']) {
      expect(() => parseCapabilities({ ...capabilities, command_epoch: epoch }, '')).toThrow(WireError);
    }
    expect(() => parseErrorBody({ error: { kind: 'teapot', message: 'x' } }, '')).toThrow(WireError);
  });
});
