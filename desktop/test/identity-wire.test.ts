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
  parseExecutionPolicyView,
  parseLoginTransaction,
  parseMembershipsView,
  parseRefreshRequest,
  parseRevokeFamilyRequest,
  parseRevokeFamilyResponse,
  parseSessionCommandEnvelope,
  parseSessionCredentials,
  parseSessionView,
  parseAcceptInviteResponse,
  parseAccessCheckRequest,
  parseAccessCheckResponse,
  parseRolesView,
  parseWorkspaceCommandEnvelope,
  parseWorkspacePolicy,
  parseWorkspacesView,
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

// ---- Story 1.11 Workspace fixtures (mirrored by Story 1.14) ----------------------

const workspaceFixtures = path.join(fixtures, 'workspace');
const listOf =
  (parse: (value: unknown, path: string) => unknown) =>
  (value: unknown, at: string): unknown => {
    if (!Array.isArray(value)) throw new WireError(`${at} is not an array`);
    return value.map((item, index) => parse(item, `${at}[${index}]`));
  };

const WORKSPACE_PARSERS: Record<string, (value: unknown, path: string) => unknown> = {
  'accept_invite_response.json': parseAcceptInviteResponse,
  'access_check_requests.json': listOf(parseAccessCheckRequest),
  'access_check_response.json': parseAccessCheckResponse,
  'command_envelopes.json': listOf(parseWorkspaceCommandEnvelope),
  'command_response.json': parseCommandResponse,
  'execution_policy_view.json': parseExecutionPolicyView,
  'policy.json': parseWorkspacePolicy,
  'refusals.json': listOf(parseErrorBody),
  'roles_view.json': parseRolesView,
  'workspaces_view.json': parseWorkspacesView,
};

const readWorkspace = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(workspaceFixtures, name), 'utf8'));

describe('Workspace wire mirrors', () => {
  it('cover every Workspace fixture', () => {
    const files = fs.readdirSync(workspaceFixtures).filter((name) => name.endsWith('.json')).sort();
    expect(files).toEqual(Object.keys(WORKSPACE_PARSERS).sort());
  });

  it.each(Object.keys(WORKSPACE_PARSERS))('%s parses and round-trips unchanged', (name) => {
    const value = readWorkspace(name);
    expect(JSON.parse(JSON.stringify(WORKSPACE_PARSERS[name]!(value, '')))).toEqual(value);
  });

  it('accepts a refusal reason only from the fixed set', () => {
    expect(parseErrorBody({ error: { kind: 'denied', message: 'x', reason: 'role_lacks_action' } }, '').error.reason).toBe('role_lacks_action');
    expect(parseErrorBody({ error: { kind: 'denied', message: 'x' } }, '').error.reason).toBeUndefined();
    expect(() => parseErrorBody({ error: { kind: 'denied', message: 'x', reason: 'guest' } }, '')).toThrow(WireError);
  });

  it('refuses an unknown Workspace command and a guest role kind', () => {
    const [envelope] = readWorkspace('command_envelopes.json') as Array<Record<string, unknown>>;
    expect(() => parseWorkspaceCommandEnvelope({ ...envelope, payload: { command: 'create_workspace' } }, '')).toThrow(WireError);
    const roles = readWorkspace('roles_view.json') as { roles: Array<Record<string, unknown>> };
    expect(() => parseRolesView({ ...roles, roles: [{ ...roles.roles[0], kind: 'guest' }] }, '')).toThrow(WireError);
  });
});
