/**
 * TypeScript mirrors of the shared-service wire contract
 * (`engine/codex-rs/inquello-protocol`), with strict runtime parsers.
 *
 * Every parser accepts exactly the keys the Rust type serializes (unknown or
 * missing keys reject, like `deny_unknown_fields`), checks each value's shape
 * (UUIDs, canonical decimal-string revisions, RFC 3339 millisecond UTC times)
 * and returns a fresh object. `test/identity-wire.test.ts` parses every JSON
 * fixture under `inquello-protocol/fixtures/` and requires an unchanged round
 * trip, so these mirrors cannot drift from the Rust types unnoticed.
 *
 * Parse errors name only the field path, never a value: a value may be a
 * credential.
 */

export class WireError extends Error {
  override name = 'WireError';
}

type Parser<T> = (value: unknown, path: string) => T;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
const RFC3339_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_U64 = 18_446_744_073_709_551_615n;

const fail = (path: string, what: string): never => {
  throw new WireError(`${path || 'body'}: ${what}`);
};

export const str: Parser<string> = (value, path) => (typeof value === 'string' ? value : fail(path, 'expected a string'));

export const uuid: Parser<string> = (value, path) => {
  const text = str(value, path);
  return UUID.test(text) ? text : fail(path, 'expected a lowercase UUID');
};

/** A revision or command epoch: a canonical unsigned decimal string within u64. */
export const decimal: Parser<string> = (value, path) => {
  const text = str(value, path);
  return DECIMAL.test(text) && BigInt(text) <= MAX_U64 ? text : fail(path, 'expected a canonical decimal string');
};

export const time: Parser<string> = (value, path) => {
  const text = str(value, path);
  return RFC3339_MILLIS.test(text) && !Number.isNaN(Date.parse(text)) ? text : fail(path, 'expected an RFC 3339 UTC time');
};

export const u32: Parser<number> = (value, path) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff ? value : fail(path, 'expected a u32');

export function literal<T extends string>(expected: T): Parser<T> {
  return (value, path) => (value === expected ? expected : fail(path, `expected ${JSON.stringify(expected)}`));
}

export function oneOf<T extends string>(values: readonly T[]): Parser<T> {
  return (value, path) => ((values as readonly unknown[]).includes(value) ? (value as T) : fail(path, 'unexpected value'));
}

export function nullable<T>(inner: Parser<T>): Parser<T | null> {
  return (value, path) => (value === null ? null : inner(value, path));
}

export function array<T>(inner: Parser<T>): Parser<T[]> {
  return (value, path) => (Array.isArray(value) ? value.map((item, index) => inner(item, `${path}[${index}]`)) : fail(path, 'expected an array'));
}

const OPTIONAL = Symbol('optional');
interface Optional<T> {
  [OPTIONAL]: true;
  parse: Parser<T>;
}
/** A key that may be absent (serde `skip_serializing_if = "Option::is_none"`). */
export function optional<T>(parse: Parser<T>): Optional<T> {
  return { [OPTIONAL]: true, parse };
}

type Shape = Record<string, Parser<unknown> | Optional<unknown>>;
type Parsed<S extends Shape> = { [K in keyof S as S[K] extends Optional<unknown> ? never : K]: S[K] extends Parser<infer T> ? T : never } & {
  [K in keyof S as S[K] extends Optional<unknown> ? K : never]?: S[K] extends Optional<infer T> ? T : never;
};

/** An object with exactly these keys (optional ones may be absent). */
export function object<S extends Shape>(shape: S): Parser<Parsed<S>> {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return fail(path, 'expected an object');
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(shape, key)) fail(`${path}.${key}`, 'unknown key');
    }
    const out: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(shape)) {
      const isOptional = typeof spec === 'object' && OPTIONAL in spec;
      if (!Object.hasOwn(record, key)) {
        if (isOptional) continue;
        fail(`${path}.${key}`, 'missing key');
      }
      out[key] = isOptional ? (spec as Optional<unknown>).parse(record[key], `${path}.${key}`) : (spec as Parser<unknown>)(record[key], `${path}.${key}`);
    }
    return out as Parsed<S>;
  };
}

// ---- SC-1 and SC-2 types --------------------------------------------------------

export const ERROR_KINDS = [
  'unauthenticated',
  'denied',
  'version_conflict',
  'unsupported_contract',
  'incomplete_material',
  'dependency_unavailable',
  'uncertain_outcome',
] as const;
export type ErrorKind = (typeof ERROR_KINDS)[number];

export const parseCapabilities = object({ protocol_major: u32, schema_version: u32, command_epoch: decimal });
export type Capabilities = ReturnType<typeof parseCapabilities>;

export const parseCreateLoginTransactionRequest = object({ issuer: str, client_id: str, redirect_uri: str, device_id: uuid });
export type CreateLoginTransactionRequest = ReturnType<typeof parseCreateLoginTransactionRequest>;

export const parseLoginTransaction = object({
  login_transaction_id: uuid,
  transaction_proof: str,
  nonce: str,
  issuer: str,
  client_id: str,
  redirect_uri: str,
  device_id: uuid,
  expires_at: time,
});
export type LoginTransaction = ReturnType<typeof parseLoginTransaction>;

export const parseBootstrapRequest = object({ login_transaction_id: uuid, transaction_proof: str, redirect_uri: str, id_token: str });
export type BootstrapRequest = ReturnType<typeof parseBootstrapRequest>;

export const parseSessionCredentials = object({
  session_id: uuid,
  principal_id: uuid,
  access_credential: str,
  access_expires_at: time,
  refresh_credential: str,
  refresh_expires_at: time,
  session_expires_at: time,
});
export type SessionCredentials = ReturnType<typeof parseSessionCredentials>;

export const parseAbandonLoginRequest = object({ login_transaction_id: uuid, transaction_proof: str });
export type AbandonLoginRequest = ReturnType<typeof parseAbandonLoginRequest>;

export const parseAbandonLoginResponse = object({ login_transaction_id: uuid, status: literal('abandoned') });
export type AbandonLoginResponse = ReturnType<typeof parseAbandonLoginResponse>;

export const parseRefreshRequest = object({ refresh_credential: str });
export type RefreshRequest = ReturnType<typeof parseRefreshRequest>;

export const parseRevokeFamilyRequest = object({ refresh_credential: optional(str) });
export type RevokeFamilyRequest = ReturnType<typeof parseRevokeFamilyRequest>;

export const parseRevokeFamilyResponse = object({ status: literal('revoked') });
export type RevokeFamilyResponse = ReturnType<typeof parseRevokeFamilyResponse>;

export const parsePrincipalView = object({ principal_id: uuid, revision: decimal, email: nullable(str), display_name: nullable(str) });
export type PrincipalView = ReturnType<typeof parsePrincipalView>;

export const parseSessionView = object({
  session_id: uuid,
  device_id: uuid,
  issuer: str,
  subject: str,
  created_at: time,
  last_authenticated_at: time,
  expires_at: time,
  revoked_at: nullable(time),
  revision: decimal,
  principal: parsePrincipalView,
});
export type SessionView = ReturnType<typeof parseSessionView>;

export const parseMembershipView = object({ workspace_id: uuid, workspace_kind: str, role: str, status: str, revision: decimal });
export const parseMembershipsView = object({ principal_id: uuid, principal_revision: decimal, memberships: array(parseMembershipView) });
export type MembershipsView = ReturnType<typeof parseMembershipsView>;

export const parseLogoutCommand = object({ command: literal('logout'), session_id: uuid });
export const parseSessionCommandEnvelope = object({
  command_epoch: decimal,
  operation_id: str,
  expected_revision: decimal,
  schema_version: u32,
  payload: parseLogoutCommand,
});
export type SessionCommandEnvelope = ReturnType<typeof parseSessionCommandEnvelope>;

export const parseCommandResponse = object({
  operation_id: str,
  resource_id: uuid,
  revision: decimal,
  authorization_epoch: nullable(decimal),
  status: literal('applied'),
  receipt_id: uuid,
});
export type CommandResponse = ReturnType<typeof parseCommandResponse>;

export const parseErrorBody = object({ error: object({ kind: oneOf(ERROR_KINDS), message: str }) });
export type ErrorBody = ReturnType<typeof parseErrorBody>;

/** The protocol major and envelope schema version this desktop speaks. */
export const PROTOCOL_MAJOR = 1;
export const SCHEMA_VERSION = 1;
