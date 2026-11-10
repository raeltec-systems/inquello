/**
 * Static checks for AC 1.2.1 (schema stamp integrity) and AC 1.2.2 (stdio only,
 * upstream wording recorded, no production eligibility).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { STDIO_LISTEN_ARGS } from '../src/main/runtime';

const desktop = path.resolve(__dirname, '..');

function listFiles(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

describe('protocol schema stamp', () => {
  const stamp = JSON.parse(fs.readFileSync(path.join(desktop, 'src/protocol/schema-stamp.json'), 'utf8'));
  const generated = path.join(desktop, 'src/protocol/generated');

  it('records the runtime version and fork tree hash', () => {
    expect(stamp.runtimeVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(stamp.forkTreeHash).toMatch(/^[0-9a-f]{40}$/);
    const forkTree = execFileSync('git', ['rev-parse', 'HEAD:engine'], { cwd: path.resolve(desktop, '..'), encoding: 'utf8' }).trim();
    expect(stamp.forkTreeHash).toBe(forkTree);
    expect(stamp.experimentalApi).toBe(false);
  });

  it('matches the generated files byte for byte', () => {
    const files = listFiles(generated);
    const hash = createHash('sha256');
    for (const file of files) {
      hash.update(`${file}\0`);
      // Raw bytes, exactly as the generator hashes them (.gitattributes keeps them LF).
      hash.update(fs.readFileSync(path.join(generated, file)));
      hash.update('\0');
    }
    expect(files.length).toBe(stamp.fileCount);
    expect(hash.digest('hex')).toBe(stamp.contentSha256);
  });
});

describe('transport evidence', () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(desktop, 'transport-evidence.json'), 'utf8'));

  it('enables stdio only and claims no production eligibility', () => {
    const enabled = (evidence.transports as Array<{ id: string; enabled: boolean }>).filter((transport) => transport.enabled);
    expect(enabled.map((transport) => transport.id)).toEqual(['stdio']);
    expect(evidence.transports.map((transport: { id: string }) => transport.id).sort()).toEqual(['stdio', 'unix', 'websocket']);
    expect(evidence.productionEligibility).toBe(false);
    expect(evidence.runtime.launchArguments).toEqual([...STDIO_LISTEN_ARGS]);
  });

  it('records the upstream experimental wording with citations', () => {
    const wording = evidence.upstreamWording as Array<{ source: string; quote?: string; summary?: string }>;
    expect(wording.some((entry) => entry.source.startsWith('https://') && /experimental/.test(entry.quote ?? ''))).toBe(true);
    expect(wording.some((entry) => entry.source === 'engine/codex-rs/cli/src/main.rs:176')).toBe(true);
    for (const entry of wording) expect(entry.quote ?? entry.summary).toBeTruthy();
  });

  it('has no WebSocket or unix listener code path in the desktop sources', () => {
    const sources = listFiles(path.join(desktop, 'src/main')).map((file) => fs.readFileSync(path.join(desktop, 'src/main', file), 'utf8'));
    for (const source of sources) {
      expect(source).not.toMatch(/ws:\/\/|wss:\/\/|unix:\/\/|--ws-|WebSocket/);
    }
    expect(STDIO_LISTEN_ARGS).toEqual(['--listen', 'stdio://']);
  });
});
