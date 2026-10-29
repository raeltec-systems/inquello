import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { AppServerRuntime, type AppServerRuntimeOptions, type Logger, type RuntimeState } from '../src/main/runtime';
import type { OrganiseOperations, PolicyOperations } from '../src/main/security/operations';

export const FAKE_SERVER = path.join(__dirname, 'fixtures', 'fake-app-server.mjs');

export interface RecordingLogger extends Logger {
  messages: string[];
}

export function recordingLogger(): RecordingLogger {
  const messages: string[] = [];
  return {
    messages,
    info: (message) => messages.push(`info: ${message}`),
    warn: (message) => messages.push(`warn: ${message}`),
    error: (message) => messages.push(`error: ${message}`),
  };
}

const createdDirs: string[] = [];

export function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `inquello-test-${prefix}-`));
  createdDirs.push(dir);
  return dir;
}

/** Removes temp dirs created so far; call only after their children have exited. */
export function removeTempDirs(): void {
  for (const dir of createdDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

export interface FakeRuntime {
  runtime: AppServerRuntime;
  logger: RecordingLogger;
  states: RuntimeState[];
  recordPath: string;
  stderrLogPath: string;
  /** Every stdin line the fake received, parsed. */
  received(): Array<Record<string, unknown>>;
  argv(): string[];
  /** True once the fake recorded stdin EOF. */
  sawEof(): boolean;
}

export function fakeRuntime(
  fakeEnv: Record<string, string>,
  overrides: Partial<AppServerRuntimeOptions> = {},
): FakeRuntime {
  const dir = tempDir('fake');
  const recordPath = path.join(dir, 'record.jsonl');
  const stderrLogPath = path.join(dir, 'logs', 'app-server-stderr.log');
  const logger = recordingLogger();
  const runtime = new AppServerRuntime({
    command: process.execPath,
    commandArgsPrefix: [FAKE_SERVER],
    env: { ...process.env, FAKE_RECORD: recordPath, ...fakeEnv },
    clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' },
    schemaStamp: { runtimeVersion: '0.165.0' },
    stderrLogPath,
    stopGraceMs: 2_000,
    handshakeTimeoutMs: 10_000,
    logger,
    ...overrides,
  });
  const states: RuntimeState[] = [];
  runtime.on('state', ({ state }) => states.push(state));
  const entries = () =>
    fs.existsSync(recordPath)
      ? fs
          .readFileSync(recordPath, 'utf8')
          .split('\n')
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>)
      : [];
  return {
    runtime,
    logger,
    states,
    recordPath,
    stderrLogPath,
    received: () =>
      entries()
        .filter((entry) => typeof entry.line === 'string')
        .map((entry) => JSON.parse(entry.line as string) as Record<string, unknown>),
    argv: () => (entries().find((entry) => Array.isArray(entry.argv))?.argv as string[]) ?? [],
    sawEof: () => entries().some((entry) => entry.eof === true),
  };
}

export async function waitFor(predicate: () => boolean, timeoutMs = 5_000, label = 'condition'): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Organise operations for registry tests: each records its call and answers signed out (Story 1.14). */
export function fakeOrganise(calls: string[] = []): OrganiseOperations {
  const signedOut = { ok: false as const, code: 'signed-out' as const, reason: 'Sign in to see your Workspaces and private Tasks.' };
  const record =
    (name: string) =>
    async (...args: unknown[]) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return signedOut;
    };
  return {
    getWorkspaces: async () => {
      calls.push('getWorkspaces');
      return { signedIn: false, sharedService: 'not-configured', workspaces: [], engagementCreation: { enabled: false, reason: signedOut.reason } };
    },
    getTree: record('getTree'),
    createEngagement: record('createEngagement'),
    updateEngagement: record('updateEngagement'),
    createFolder: record('createFolder'),
    createTask: record('createTask'),
    renameTask: record('renameTask'),
    moveTask: record('moveTask'),
    listStates: record('listStates'),
    recordTaskState: record('recordTaskState'),
  };
}

/** A signed-out policy service that records its calls (Story 1.18). */
export function fakePolicy(calls: string[] = []): PolicyOperations {
  const signedOut = { ok: false as const, code: 'signed-out' as const, reason: 'Sign in to see the policy that governs your Tasks.' };
  return {
    settings: async () => {
      calls.push('settings');
      return { signedIn: false, environmentLabel: 'Local device', workspaces: [], capabilities: [], reason: signedOut.reason };
    },
    forTask: async (taskId) => {
      calls.push(`forTask:${JSON.stringify([taskId])}`);
      return signedOut;
    },
    setBroadMode: async (input) => {
      calls.push(`setBroadMode:${JSON.stringify([input])}`);
      return signedOut;
    },
    pendingPermissions: async (taskId) => {
      calls.push(`pendingPermissions:${JSON.stringify([taskId])}`);
      return signedOut;
    },
    decidePermission: async (input) => {
      calls.push(`decidePermission:${JSON.stringify([input])}`);
      return signedOut;
    },
    permissionSettings: async () => {
      calls.push('permissionSettings');
      return { signedIn: false, userRules: null, workspaces: [], reason: signedOut.reason };
    },
    setUserRules: async (input) => {
      calls.push(`setUserRules:${JSON.stringify([input])}`);
      return signedOut;
    },
  };
}
