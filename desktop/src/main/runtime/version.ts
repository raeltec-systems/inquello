/**
 * Runtime/schema version check.
 *
 * The schema version comes from `src/protocol/schema-stamp.json`, written by
 * `pnpm generate:protocol`. The runtime version is parsed from the
 * `initialize` result's `userAgent`, which upstream formats as
 * `<originator>/<version> (<os>; <arch>) ...`. Anything unparseable counts as
 * a mismatch.
 */
import { VersionMismatchError } from './errors';

export interface SchemaStamp {
  runtimeVersion: string;
  forkTreeHash: string;
  generator: string;
  experimentalApi: boolean;
  fileCount: number;
  contentSha256: string;
}

const USER_AGENT_VERSION = /^[^\s/]+\/(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)(?=\s|$)/;

export function parseRuntimeVersion(userAgent: string): string | null {
  const match = USER_AGENT_VERSION.exec(userAgent.trim());
  return match?.[1] ?? null;
}

/** Throws {@link VersionMismatchError} unless the runtime exactly matches the schema stamp. */
export function assertRuntimeMatchesSchema(userAgent: string, stamp: Pick<SchemaStamp, 'runtimeVersion'>): string {
  const runtimeVersion = parseRuntimeVersion(userAgent);
  if (runtimeVersion === null || runtimeVersion !== stamp.runtimeVersion) {
    throw new VersionMismatchError(stamp.runtimeVersion, runtimeVersion, userAgent);
  }
  return runtimeVersion;
}
