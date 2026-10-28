/**
 * Runs the real `codex-app-server` from the engine build with a temporary
 * CODEX_HOME: handshake, version check against the schema stamp, clean stop.
 * No login, credentials or model calls are involved.
 */
import fs from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import schemaStamp from '../src/protocol/schema-stamp.json';
import { AppServerRuntime, NotReadyError, resolveAppServerBinary } from '../src/main/runtime';
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
});
