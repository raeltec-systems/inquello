/**
 * Runs the real `codex-app-server` from the engine build with a temporary
 * CODEX_HOME: handshake, version check against the schema stamp, clean stop.
 * No login, credentials or model calls are involved.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { AppServerRuntime, NotReadyError, resolveAppServerBinary, runtimeChildEnv } from '../src/main/runtime';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const desktop = path.resolve(__dirname, '..');
const binary = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: desktop });
const codexHome = tempDir('codex-home');

afterAll(() => removeTempDirs());

describe('real app-server over stdio', () => {
  it('completes the handshake, passes the version check and exits 0 on stop', async () => {
    const env: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: codexHome };
    const logger = recordingLogger();
    const runtime = new AppServerRuntime({
      command: binary.path,
      env,
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(codexHome, 'inquello-logs', 'app-server-stderr.log'),
      logger,
    });

    try {
      const starting = runtime.start();
      await expect(runtime.request('thread/list')).rejects.toBeInstanceOf(NotReadyError);
      const result = await starting;

      expect(runtime.state).toBe('ready');
      expect(result.userAgent).toMatch(new RegExp(`^inquello_desktop/${schemaStamp.runtimeVersion.replace(/\./g, '\\.')} `));
      expect(fs.realpathSync.native(result.codexHome).toLowerCase()).toBe(fs.realpathSync.native(codexHome).toLowerCase());

      const exit = await runtime.stop();
      expect(exit).toMatchObject({ exitCode: 0, killed: false });
      expect(runtime.state).toBe('stopped');
    } finally {
      await runtime.stop();
    }
  }, 60_000);

  it('still passes the version check when a host originator override has spaces', async () => {
    // Reproduces a desktop started from a Codex Desktop session on Windows: the
    // runtime then reports "Codex Desktop/<version> ...". The desktop strips the
    // variable (runtimeChildEnv); the parser must still read the version.
    const home = tempDir('codex-home-override');
    const env: NodeJS.ProcessEnv = { ...process.env, CODEX_HOME: home, CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'Codex Desktop' };
    const runtime = new AppServerRuntime({
      command: binary.path,
      env,
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(home, 'inquello-logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
    });
    try {
      const result = await runtime.start();
      expect(result.userAgent.startsWith('Codex Desktop/')).toBe(true);
      expect(runtime.state).toBe('ready');
    } finally {
      await runtime.stop();
    }
  }, 60_000);

  it('identifies as inquello_desktop once runtimeChildEnv strips the override', async () => {
    const home = tempDir('codex-home-stripped');
    const env = runtimeChildEnv(
      { ...process.env, CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'Codex Desktop' },
      { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', codexHome: home },
    );
    const runtime = new AppServerRuntime({
      command: binary.path,
      env,
      clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
      schemaStamp,
      stderrLogPath: path.join(home, 'inquello-logs', 'app-server-stderr.log'),
      logger: recordingLogger(),
    });
    try {
      const result = await runtime.start();
      expect(result.userAgent.startsWith('inquello_desktop/')).toBe(true);
    } finally {
      await runtime.stop();
    }
  }, 60_000);
});
