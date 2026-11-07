/** Windows cache/temp routing. Durable profiles and keyring identities keep
 * their existing paths; newly generated browser data lives only on D:. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensurePrivateDirectory } from './private-paths';
import { assertDStoragePath } from './wsl';

export interface DesktopStorage {
  cache: string;
  session: string;
  temp: string;
  crashDumps: string;
  logs: string;
}

export function desktopStoragePaths(userData: string): DesktopStorage {
  if (!path.win32.isAbsolute(userData)) throw new Error('An absolute desktop profile is required');
  const profile = createHash('sha256').update(path.win32.normalize(userData).toLowerCase()).digest('hex');
  const cache = path.win32.join('D:\\Inquello\\cache\\desktop', profile);
  return {
    cache,
    session: path.win32.join(cache, 'session'),
    temp: path.win32.join(cache, 'temp'),
    crashDumps: path.win32.join(cache, 'crash-dumps'),
    logs: path.win32.join('D:\\Inquello\\logs\\desktop', profile),
  };
}

/** Reject redirected ancestors before creating any directory. Existing profile
 * data is not moved or deleted by this setup. A missing D: is an error. */
function assertLocation(target: string): void {
  assertDStoragePath(target);
  let candidate = path.win32.resolve(target);
  while (true) {
    try {
      const stat = fs.lstatSync(candidate);
      if (!stat.isDirectory() || stat.isSymbolicLink()
        || fs.realpathSync.native(candidate).toLowerCase() !== candidate.toLowerCase()) {
        throw new Error('Desktop storage cannot use redirected paths');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || path.win32.dirname(candidate) === candidate) throw error;
    }
    const parent = path.win32.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
}

export interface DesktopPathApp {
  setPath(name: 'sessionData' | 'temp' | 'crashDumps', value: string): void;
  setAppLogsPath(value: string): void;
}

/** Must run before Electron ready/session creation. No C-drive fallback. */
export function configureDesktopStorage(app: DesktopPathApp, userData: string): DesktopStorage {
  if (process.platform !== 'win32') throw new Error('Windows storage setup required');
  const storage = desktopStoragePaths(userData);
  const directories = [...new Set([storage.cache, storage.session, storage.temp, storage.crashDumps, storage.logs])];
  for (const directory of directories) assertLocation(directory);
  for (const directory of directories) ensurePrivateDirectory(directory);
  for (const directory of directories) assertLocation(directory);
  process.env.TEMP = storage.temp;
  process.env.TMP = storage.temp;
  process.env.TMPDIR = storage.temp;
  app.setPath('temp', storage.temp);
  app.setPath('sessionData', storage.session);
  app.setPath('crashDumps', storage.crashDumps);
  app.setAppLogsPath(storage.logs);
  return storage;
}
