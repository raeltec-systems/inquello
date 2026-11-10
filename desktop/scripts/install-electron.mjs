// Downloads the pinned Electron binary into the configured D: cache.
//
// Electron 45 has no install hook of its own; it downloads lazily on first use,
// into a per-user cache on C:. This script runs as the project's postinstall so
// that `pnpm install` fetches the binary up front, with both the download cache
// and the temporary download directory under `electron_config_cache` (set in
// desktop/.npmrc, which pnpm exposes as npm_config_electron_config_cache).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const cacheRoot = process.env.electron_config_cache || process.env.npm_config_electron_config_cache;
if (!cacheRoot) {
  console.error('install-electron: no Electron cache configured (electron_config_cache in desktop/.npmrc or the environment)');
  process.exit(1);
}

const tempDir = path.join(cacheRoot, 'tmp');
fs.mkdirSync(tempDir, { recursive: true });

const installScript = require.resolve('electron/install.js');
const result = spawnSync(process.execPath, [installScript], {
  stdio: 'inherit',
  env: { ...process.env, electron_config_cache: cacheRoot, TMP: tempDir, TEMP: tempDir, TMPDIR: tempDir },
});
if (result.error) {
  console.error(`install-electron: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
