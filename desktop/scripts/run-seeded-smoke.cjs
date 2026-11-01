/** Real Electron + synthetic HTTPS topology. No provider calls or installs.
 * Build the desktop and test-issuer topology first. The quota probe also needs
 * the debug inference-fixtures app-server (INQUELLO_APP_SERVER may select it).
 * The explicit fixture policy permits export by the synthetic administrator;
 * the shipped sample/production policy is never changed.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const desktop = path.resolve(__dirname, '..');
const root = path.dirname(desktop);
const suffix = process.platform === 'win32' ? '.exe' : '';
const navigationOnly = process.argv.includes('--navigation');
if (process.platform === 'win32' && !/^D:[\\/]/i.test(os.tmpdir())) throw new Error('Set TEMP and TMP to D: before this smoke run');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inquello-seeded-smoke-'));
const seed = path.join(dir, 'seed.json');
const config = path.join(dir, 'config.json');
const policyFile = path.join(dir, 'fictional-policy.json');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'engine/codex-rs/inquello-protocol/fixtures/workspace/policy.json'), 'utf8'));
policy.roles.find(role => role.id === 'audit_lead').actions.push('export');
fs.writeFileSync(policyFile, JSON.stringify(policy));
const topology = spawn(process.env.INQUELLO_DEV_TOPOLOGY_BIN ?? path.join(root, `engine/codex-rs/target/debug/inquello-dev-topology${suffix}`),
  ['--exit-on-stdin-eof', '--seed-workspace', 'Synthetic recovery audit', '--seed-out', seed, '--seed-policy', policyFile],
  { env: process.env, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
let launched = false;
const startup = setTimeout(() => { topology.kill(); process.exitCode = 1; }, 60_000);
topology.on('error', error => { clearTimeout(startup); console.error(error.message); process.exitCode = 1; });
topology.on('exit', code => { if (!launched) { clearTimeout(startup); console.error(`Topology exited before smoke: ${code}`); process.exitCode = 1; } });
readline.createInterface({ input: topology.stdout }).once('line', line => {
  clearTimeout(startup);
  launched = true;
  fs.writeFileSync(config, line);
  const output = path.join(dir, 'smoke.stdout.log');
  const out = fs.openSync(output, 'w');
  const err = fs.openSync(path.join(dir, 'smoke.stderr.log'), 'w');
  console.log(`Smoke logs: ${dir}`);
  const electron = spawn(path.join(desktop, `node_modules/electron/dist/electron${suffix}`), ['.', navigationOnly ? '--smoke-navigation' : '--smoke'],
    { cwd: desktop, env: { ...process.env, INQUELLO_SERVICE_CONFIG: config, INQUELLO_SMOKE_SEED: seed }, stdio: ['ignore', out, err], windowsHide: true });
  const deadline = setTimeout(() => electron.kill(), 600_000);
  electron.on('error', error => { console.error(error.message); topology.stdin.end(); process.exitCode = 1; });
  electron.on('exit', code => {
    clearTimeout(deadline);
    fs.closeSync(out); fs.closeSync(err); topology.stdin.end();
    const reports = fs.readFileSync(output, 'utf8').split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const required = navigationOnly ? ['saved-navigation', 'shell-layout'] : ['renderer-privileges', 'design', 'identity', 'data', 'providers', 'organise', 'states', 'shell-layout', 'composer', 'start-surface', 'policy', 'tool-bounds', 'permissions', 'capabilities', 'routes', 'environments'];
    const missing = required.filter(event => !reports.some(report => report.event === event && report.ok === true));
    console.log(JSON.stringify({ exitCode: code, required: required.length, missingOrFailed: missing }));
    process.exitCode = code === 0 && missing.length === 0 && reports.some(report => report.event === 'handshake' && report.versionCheck === 'passed') ? 0 : 1;
  });
});
