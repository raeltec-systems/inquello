#!/usr/bin/env node
/**
 * Regenerates desktop/test/fixtures/engagement/ (the synthetic engagement folder
 * and its answer key) by running scripts/engagement-fixtures.py inside the
 * Inquello-Engine guest, which holds the document tools. The script travels on
 * stdin and the files come back as JSON on stdout; no drive is mounted. All
 * content is fictional. Run from desktop/: node scripts/generate-engagement-fixtures.cjs
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const desktop = path.resolve(__dirname, '..');
const target = path.join(desktop, 'test', 'fixtures', 'engagement');
const script = fs.readFileSync(path.join(__dirname, 'engagement-fixtures.py'));
const wsl = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe');
const result = spawnSync(wsl, ['--distribution', 'Inquello-Engine', '--user', 'inquello', '--cd', '/', '--exec', '/usr/bin/env', '-i',
  'PATH=/usr/bin:/bin', 'LANG=C.UTF-8', 'HOME=/tmp', '/usr/bin/python3', '-I', '-'], { input: script, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  throw new Error(`fixture generation failed (exit ${result.status})`);
}
const { files, key } = JSON.parse(result.stdout.toString('utf8'));
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.join(target, 'folder'), { recursive: true });
for (const [name, data] of Object.entries(files)) fs.writeFileSync(path.join(target, 'folder', name), Buffer.from(data, 'base64'));
fs.writeFileSync(path.join(target, 'answer-key.json'), `${JSON.stringify(key, null, 2)}\n`);
process.stdout.write(`wrote ${Object.keys(files).length} files and the answer key to ${path.relative(desktop, target)}\n`);
