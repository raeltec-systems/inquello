import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APP_SERVER_OVERRIDE_ENV,
  BinaryNotFoundError,
  VersionMismatchError,
  assertRuntimeMatchesSchema,
  parseRuntimeVersion,
  resolveAppServerBinary,
} from '../src/main/runtime';

describe('parseRuntimeVersion', () => {
  it('reads the version after the originator', () => {
    expect(parseRuntimeVersion('inquello_desktop/0.165.0 (Windows 10.0.26100; x86_64) xterm-256color (inquello_desktop; 0.0.0)')).toBe('0.165.0');
    expect(parseRuntimeVersion('codex_cli_rs/0.166.0-alpha.2 (Mac OS 15; arm64)')).toBe('0.166.0-alpha.2');
  });

  it('returns null when unparseable', () => {
    expect(parseRuntimeVersion('')).toBeNull();
    expect(parseRuntimeVersion('no version here')).toBeNull();
    expect(parseRuntimeVersion('name/v0.165.0 (x)')).toBeNull();
    expect(parseRuntimeVersion('name/0.165 (x)')).toBeNull();
  });
});

describe('assertRuntimeMatchesSchema', () => {
  it('passes on an exact match and names both versions otherwise', () => {
    expect(assertRuntimeMatchesSchema('x/0.165.0 (y)', { runtimeVersion: '0.165.0' })).toBe('0.165.0');
    expect(() => assertRuntimeMatchesSchema('x/0.165.1 (y)', { runtimeVersion: '0.165.0' })).toThrow(/0\.165\.1.*0\.165\.0/);
    expect(() => assertRuntimeMatchesSchema('garbage', { runtimeVersion: '0.165.0' })).toThrow(VersionMismatchError);
  });
});

describe('resolveAppServerBinary', () => {
  const appPath = path.resolve('/repo/desktop');
  const base = { env: {}, isPackaged: false, resourcesPath: path.resolve('/app/resources'), appPath, platform: 'win32' as const };

  it('prefers an absolute override', () => {
    const override = path.resolve('/custom/codex-app-server.exe');
    expect(
      resolveAppServerBinary({ ...base, env: { [APP_SERVER_OVERRIDE_ENV]: override }, exists: (candidate) => candidate === override }),
    ).toEqual({ path: override, source: 'override' });
    expect(() => resolveAppServerBinary({ ...base, env: { [APP_SERVER_OVERRIDE_ENV]: 'relative.exe' }, exists: () => true })).toThrow(
      BinaryNotFoundError,
    );
    expect(() => resolveAppServerBinary({ ...base, env: { [APP_SERVER_OVERRIDE_ENV]: override }, exists: () => false })).toThrow(/missing/);
  });

  it('uses the packaged resources path when packaged', () => {
    const expected = path.join(base.resourcesPath, 'bin', 'codex-app-server.exe');
    expect(resolveAppServerBinary({ ...base, isPackaged: true, exists: (candidate) => candidate === expected })).toEqual({
      path: expected,
      source: 'packaged',
    });
    expect(() => resolveAppServerBinary({ ...base, isPackaged: true, exists: () => false })).toThrow(BinaryNotFoundError);
  });

  it('uses the engine dev build when unpackaged', () => {
    const expected = path.resolve('/repo/engine/codex-rs/target/debug/codex-app-server.exe');
    expect(resolveAppServerBinary({ ...base, exists: (candidate) => candidate === expected })).toEqual({ path: expected, source: 'dev' });
    expect(resolveAppServerBinary({ ...base, platform: 'linux', exists: () => true }).path).toBe(
      path.resolve('/repo/engine/codex-rs/target/debug/codex-app-server'),
    );
    expect(() => resolveAppServerBinary({ ...base, exists: () => false })).toThrow(/cargo build/);
  });
});
