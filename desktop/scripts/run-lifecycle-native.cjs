#!/usr/bin/env node
// Native synthetic integration only. A zero-test target is a failure, never proof.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const scenarios = ['steer', 'stop_resume', 'restart', 'revoke_before_resume', 'revoke_during_resume', 'missing_linkage', 'peer_private', 'cross_company', 'crash', 'unknown_turn', 'source_reference', 'steer_lost_ack', 'stop_pending_steer', 'warm_policy_change', 'progress_continuity', 'stop_provider_unavailable', 'progress_cache', 'stop_inflight_steer'];
const required = ['responses', 'messages'].flatMap(provider => scenarios.map(scenario => `${provider}_lifecycle_${scenario}`));
function verifySelection(output) {
  const selected = new Set(output.split(/\r?\n/).filter(line => line.endsWith(': test')).map(line => line.slice(0, -6)));
  const missing = required.filter(name => !selected.has(name));
  if (missing.length) throw new Error(`Required retained-child lifecycle tests not selected (${selected.size} found): ${missing.join(', ')}`);
  return selected;
}
function main() {
  if (!['linux', 'win32'].includes(process.platform)) throw new Error('Run this acceptance gate on supported Linux or Windows; no zero-test substitute.');
  const cwd = path.resolve(__dirname, '../../engine/codex-rs');
  const run = (args, env = process.env) => {
    const result = spawnSync('cargo', args, { cwd, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`cargo ${args.join(' ')} failed (${result.status})`);
    return result.stdout;
  };
  // Build the child with the exact same fixture feature, never a release/live binary.
  run(['build', '-p', 'codex-app-server', '--bin', 'codex-app-server', '--features', 'inference-fixtures']);
  const metadata = JSON.parse(run(['metadata', '--format-version', '1', '--no-deps']));
  const binary = path.join(metadata.target_directory, 'debug', `codex-app-server${process.platform === 'win32' ? '.exe' : ''}`);
  const args = ['test', '-p', 'codex-app-server', '--features', 'inference-fixtures', '--test', 'inquello_authorization_runtime', 'lifecycle_'];
  const selected = verifySelection(run([...args, '--', '--list']));
  const output = run([...args, '--', '--test-threads=1'], { ...process.env, INQUELLO_FIXTURE_APP_SERVER_BIN: binary });
  const results = [...output.matchAll(/test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored;/g)];
  if (!results.some(match => Number(match[1]) === selected.size && Number(match[2]) === 0 && Number(match[3]) === 0)) {
    throw new Error(`Expected ${selected.size} executed passing lifecycle cases; skipped/empty/incomplete runs do not satisfy this gate.`);
  }
}
module.exports = { verifySelection, required };
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
