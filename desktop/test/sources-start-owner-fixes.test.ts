/**
 * Story 2.1 fixes reported by the owner on 2026-11-12 in a development-mode window:
 * the first Send with attached material on a new profile, and the agent's instruction
 * travelling as the runtime's developer instruction instead of inside the person's message.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { AGENT_MATERIAL_INSTRUCTION, AppServerRuntime, resolveAppServerBinary, RUNTIME_AGENT_INSTRUCTION_ARGS, RUNTIME_OWNED_CONFIG_ARGS, runtimeChildEnv, writeRuntimeConfig } from '../src/main/runtime';
import { WslTasks } from '../src/main/runtime/wsl-tasks';
import { AGENT_MATERIAL_DISCLOSURE } from '../src/renderer/Shell/sources-bridge';
import schemaStamp from '../src/protocol/schema-stamp.json';
import { recordingLogger, removeTempDirs, tempDir } from './helpers';

const created: string[] = [];
afterAll(() => { for (const dir of created) fs.rmSync(dir, { recursive: true, force: true }); removeTempDirs(); });

describe('first Send with attached material on a new profile', () => {
  // Before the fix the scope lookup resolved the Task-folders root's real path and threw ENOENT,
  // so main reported "The attached material could not be prepared for the Task folder".
  it.skipIf(process.platform !== 'win32')('creates the private Task-folders root instead of failing to resolve it', () => {
    const taskParent = path.join(tempDir('fresh-profile'), 'tasks');
    expect(fs.existsSync(taskParent)).toBe(false);
    const principal = randomUUID();
    const tasks = new WslTasks(taskParent, principal);
    created.push(tasks.storage);
    expect(fs.statSync(taskParent).isDirectory()).toBe(true);
    expect(tasks.scope).toMatch(/^[0-9a-f]{64}$/);
    // Once the root exists, the same root and principal keep the same scope; another principal gets its own.
    expect(new WslTasks(taskParent, principal).scope).toBe(tasks.scope);
    const other = new WslTasks(taskParent, randomUUID());
    created.push(other.storage);
    expect(other.scope).not.toBe(tasks.scope);
  });
});

describe('the agent instruction for attached material', () => {
  it('is a developer instruction passed after the owned runtime config, and the person is told about it', () => {
    expect(RUNTIME_AGENT_INSTRUCTION_ARGS).toEqual(['-c', `developer_instructions=${JSON.stringify(AGENT_MATERIAL_INSTRUCTION)}`]);
    expect(AGENT_MATERIAL_INSTRUCTION).toContain('attached/');
    expect(AGENT_MATERIAL_INSTRUCTION).toContain('skills/inquello-evidence/SKILL.md');
    expect(AGENT_MATERIAL_INSTRUCTION).not.toMatch(/["\\\n]/);
    expect(RUNTIME_OWNED_CONFIG_ARGS.join(' ')).not.toContain('developer_instructions');
    expect(AGENT_MATERIAL_DISCLOSURE).toBe('The agent is told where the attached material is and how to read and cite it.');
  });

  const binary = resolveAppServerBinary({ env: process.env, isPackaged: false, resourcesPath: '', appPath: path.resolve(__dirname, '..') });
  it.skipIf(!fs.existsSync(binary.path))('reaches the real runtime\'s effective configuration', async () => {
    const root = tempDir('agent-instruction');
    const home = path.join(root, 'runtime');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(path.join(root, 'private'), { recursive: true });
    writeRuntimeConfig(home);
    const runtime = new AppServerRuntime({
      command: binary.path,
      commandArgsPrefix: [...RUNTIME_OWNED_CONFIG_ARGS, ...RUNTIME_AGENT_INSTRUCTION_ARGS],
      env: runtimeChildEnv(process.env, { serviceConfigEnv: 'INQUELLO_SERVICE_CONFIG', codexHome: home, workingStore: path.join(root, 'private', 'working.sqlite') }),
      clientInfo: { name: 'inquello_desktop', title: 'agent instruction', version: '0.0.0-test' },
      schemaStamp, logger: recordingLogger(), stderrLogPath: path.join(root, 'stderr.log'),
    });
    try {
      await runtime.start();
      const read = await runtime.request<{ config: Record<string, unknown> }>('config/read', { includeLayers: false });
      expect(read.config.developer_instructions).toBe(AGENT_MATERIAL_INSTRUCTION);
    } finally {
      await runtime.stop();
    }
  }, 120_000);
});
