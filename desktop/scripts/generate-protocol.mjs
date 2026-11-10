// Regenerates the app-server protocol bindings from the engine build and stamps them.
//
// Output:
//   src/protocol/generated/   `codex app-server generate-ts` output, unmodified
//   src/protocol/schema-stamp.json   runtime version + fork tree hash + content hash
//
// The stamp is what the desktop client compares against the running app-server's
// version during the handshake (it refuses a mismatch). The output is fully
// deterministic: no timestamps, sorted hashing, LF line endings.
//
// Binaries default to the dev build in engine/codex-rs/target/debug. Override with
// INQUELLO_CODEX_CLI (the `codex` CLI that has `app-server generate-ts`) and
// INQUELLO_APP_SERVER (the `codex-app-server` binary the desktop runs).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(desktopDir, '..');
const exe = process.platform === 'win32' ? '.exe' : '';
const devTargetDir = path.join(repoRoot, 'engine', 'codex-rs', 'target', 'debug');
const codexCli = process.env.INQUELLO_CODEX_CLI || path.join(devTargetDir, `codex${exe}`);
const appServer = process.env.INQUELLO_APP_SERVER || path.join(devTargetDir, `codex-app-server${exe}`);

const protocolDir = path.join(desktopDir, 'src', 'protocol');
const generatedDir = path.join(protocolDir, 'generated');
const stagingDir = path.join(protocolDir, 'generated.staging');
const stampPath = path.join(protocolDir, 'schema-stamp.json');

function fail(message) {
  console.error(`generate:protocol: ${message}`);
  process.exit(1);
}

function run(file, args, options = {}) {
  return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
}

function binaryVersion(binary, expectedName) {
  if (!fs.existsSync(binary)) fail(`binary not found: ${binary} (build engine/codex-rs first, see FORK-CUT.md)`);
  const output = run(binary, ['--version']);
  const match = /^(\S+) (\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/.exec(output);
  if (!match || match[1] !== expectedName) fail(`unexpected --version output from ${binary}: ${JSON.stringify(output)}`);
  return match[2];
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

// 1. Identify the engine tree. A dirty engine/ would make the tree hash lie, so refuse.
const forkStatus = run('git', ['status', '--porcelain', '--', 'engine'], { cwd: repoRoot });
if (forkStatus !== '') fail(`engine/ has uncommitted changes; restore them first (e.g. git checkout -- engine/codex-rs/Cargo.lock):\n${forkStatus}`);
const forkTreeHash = run('git', ['rev-parse', 'HEAD:engine'], { cwd: repoRoot });

// 2. The generator and the runtime must come from the same version.
const cliVersion = binaryVersion(codexCli, 'codex-cli');
const runtimeVersion = binaryVersion(appServer, 'codex-app-server');
if (cliVersion !== runtimeVersion) {
  fail(`generator version ${cliVersion} (${codexCli}) differs from runtime version ${runtimeVersion} (${appServer})`);
}

// 3. Generate into a staging directory, then swap it in.
fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(stagingDir, { recursive: true });
try {
  run(codexCli, ['app-server', 'generate-ts', '--out', stagingDir]);
} catch (error) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fail(`generate-ts failed: ${error.stderr || error.message}`);
}
const files = listFiles(stagingDir);
if (!files.includes('index.ts') || !files.includes('InitializeResponse.ts')) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
  fail('generate-ts output is missing index.ts or InitializeResponse.ts');
}
fs.rmSync(generatedDir, { recursive: true, force: true });
fs.renameSync(stagingDir, generatedDir);

// 4. Stamp: what generated this schema, plus a content hash to detect hand edits.
const hash = createHash('sha256');
for (const file of files) {
  hash.update(`${file}\0`);
  hash.update(fs.readFileSync(path.join(generatedDir, file)));
  hash.update('\0');
}
const stamp = {
  runtimeVersion,
  forkTreeHash,
  generator: 'codex app-server generate-ts',
  experimentalApi: false,
  fileCount: files.length,
  contentSha256: hash.digest('hex'),
};
fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
console.log(`generate:protocol: ${files.length} files for codex-app-server ${runtimeVersion} (fork tree ${forkTreeHash})`);
