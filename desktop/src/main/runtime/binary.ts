/**
 * Locates the `codex-app-server` binary.
 *
 * Order: `INQUELLO_APP_SERVER` override, then the packaged copy under
 * `process.resourcesPath/bin`, then (unpackaged) the fork's dev build in
 * `fork/codex-rs/target/debug`. Installer building is out of scope here; the
 * packaged path is what a later packaging step must populate.
 */
import fs from 'node:fs';
import path from 'node:path';

import { BinaryNotFoundError } from './errors';

export const APP_SERVER_OVERRIDE_ENV = 'INQUELLO_APP_SERVER';

export type BinarySource = 'override' | 'packaged' | 'dev';

export interface ResolvedBinary {
  path: string;
  source: BinarySource;
}

export interface ResolveBinaryOptions {
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  /** Electron `process.resourcesPath`. */
  resourcesPath: string;
  /** Electron `app.getAppPath()`; in development this is the `desktop/` directory. */
  appPath: string;
  platform?: NodeJS.Platform;
  exists?: (candidate: string) => boolean;
}

export function appServerBinaryName(platform: NodeJS.Platform = process.platform): string {
  return platform === 'win32' ? 'codex-app-server.exe' : 'codex-app-server';
}

export function resolveAppServerBinary(options: ResolveBinaryOptions): ResolvedBinary {
  const exists = options.exists ?? ((candidate: string) => fs.existsSync(candidate));
  const name = appServerBinaryName(options.platform);

  const override = options.env[APP_SERVER_OVERRIDE_ENV]?.trim();
  if (override) {
    if (!path.isAbsolute(override)) {
      throw new BinaryNotFoundError(`${APP_SERVER_OVERRIDE_ENV} must be an absolute path, got ${JSON.stringify(override)}`);
    }
    if (!exists(override)) throw new BinaryNotFoundError(`${APP_SERVER_OVERRIDE_ENV} points to a missing file: ${override}`);
    return { path: override, source: 'override' };
  }

  if (options.isPackaged) {
    const packaged = path.join(options.resourcesPath, 'bin', name);
    if (!exists(packaged)) throw new BinaryNotFoundError(`packaged app-server binary is missing: ${packaged}`);
    return { path: packaged, source: 'packaged' };
  }

  const dev = path.resolve(options.appPath, '..', 'fork', 'codex-rs', 'target', 'debug', name);
  if (!exists(dev)) {
    throw new BinaryNotFoundError(
      `dev app-server binary is missing: ${dev} (build it with cargo build -j 4 -p codex-app-server, see FORK-CUT.md, or set ${APP_SERVER_OVERRIDE_ENV})`,
    );
  }
  return { path: dev, source: 'dev' };
}
