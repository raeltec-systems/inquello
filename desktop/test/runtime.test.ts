/**
 * I/O and edge-case matrix (spec 1.2) against a fake Node child that speaks the
 * app-server stdio protocol.
 */
import fs from 'node:fs';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DisconnectedError,
  HandshakeError,
  LineTooLongError,
  NotReadyError,
  OverloadedError,
  QueueFullError,
  RpcResponseError,
  StoppingError,
  VersionMismatchError,
  type AppServerRuntime,
} from '../src/main/runtime';
import { fakeRuntime, removeTempDirs, waitFor, type FakeRuntime } from './helpers';

const live: AppServerRuntime[] = [];

function track(fake: FakeRuntime): FakeRuntime {
  live.push(fake.runtime);
  return fake;
}

afterEach(async () => {
  await Promise.all(live.splice(0).map((runtime) => runtime.stop()));
  removeTempDirs();
});

describe('handshake', () => {
  it('sends initialize, then initialized, and reaches ready over stdio only', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    const result = await fake.runtime.start();

    expect(result.userAgent).toBe('inquello_desktop/0.165.0 (Fake OS; x86_64) fake');
    expect(fake.runtime.state).toBe('ready');
    expect(fake.states).toEqual(['starting', 'initializing', 'ready']);
    expect(fake.argv()).toEqual(['--listen', 'stdio://']);

    await waitFor(() => fake.received().length >= 2, 5_000, 'initialized notification');
    const [initialize, initialized] = fake.received();
    expect(initialize).toEqual({
      id: 1,
      method: 'initialize',
      params: { clientInfo: { name: 'inquello_desktop', title: 'Inquello', version: '0.0.0-test' }, capabilities: null },
    });
    expect(initialized).toEqual({ method: 'initialized' });
    for (const message of fake.received()) expect(message).not.toHaveProperty('jsonrpc');
  });

  it('answers requests once ready', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    await fake.runtime.start();
    await expect(fake.runtime.request('echo', { hello: 'world' })).resolves.toEqual({ hello: 'world' });
    await expect(fake.runtime.request('fail')).rejects.toBeInstanceOf(RpcResponseError);
  });
});

describe('request before ready', () => {
  it('rejects locally while starting or initializing and never forwards it', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal', FAKE_INIT_DELAY_MS: '300' }));
    const starting = fake.runtime.start();
    expect(fake.runtime.state).toBe('starting');
    await expect(fake.runtime.request('echo', { early: 1 })).rejects.toBeInstanceOf(NotReadyError);
    expect(() => fake.runtime.notify('early/notification')).toThrow(NotReadyError);

    await waitFor(() => fake.runtime.state === 'initializing', 5_000, 'initializing');
    await expect(fake.runtime.request('echo', { early: 2 })).rejects.toMatchObject({ code: 'not_ready', state: 'initializing' });

    await starting;
    await waitFor(() => fake.received().length >= 2, 5_000, 'handshake lines');
    expect(fake.received().map((message) => message.method)).toEqual(['initialize', 'initialized']);
  });
});

describe('version mismatch', () => {
  it('fails, stops the runtime and names both versions', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal', FAKE_VERSION: '0.166.0' }));
    const error = await fake.runtime.start().then(
      () => undefined,
      (failure: unknown) => failure,
    );
    expect(error).toBeInstanceOf(VersionMismatchError);
    expect((error as Error).message).toContain('0.166.0');
    expect((error as Error).message).toContain('0.165.0');
    expect(fake.runtime.state).toBe('failed');

    // The runtime stops itself (stdin EOF) without any stop() call.
    await waitFor(() => fake.runtime.exitInfo !== undefined, 5_000, 'self-stop exit');
    expect(fake.sawEof()).toBe(true);
    expect(fake.runtime.exitInfo!.exitCode).toBe(0);
    expect(fake.runtime.state).toBe('failed');
    expect(fake.received().map((message) => message.method)).toEqual(['initialize']);
  });

  it('treats an unparseable userAgent as a mismatch', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal', FAKE_USER_AGENT: 'no version here' }));
    await expect(fake.runtime.start()).rejects.toMatchObject({ code: 'version_mismatch', runtimeVersion: null });
    expect(fake.runtime.state).toBe('failed');
  });
});

describe('slow writer', () => {
  it('waits for drain behind a bounded queue and rejects requests when it is full', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'slowReader' }, { maxQueuedMessages: 2 }));
    await fake.runtime.start();

    // The fake stops reading stdin for 1.5 s, so the pipe and Node's buffer fill up.
    const payload = 'x'.repeat(256 * 1024);
    const results: Array<Promise<unknown>> = [];
    let rejected = 0;
    for (let index = 0; index < 40; index += 1) {
      results.push(
        fake.runtime.request('echo', { index, payload }).catch((error: unknown) => {
          if (error instanceof QueueFullError) rejected += 1;
          else throw error;
          return 'rejected';
        }),
      );
    }
    const settled = await Promise.all(results);
    expect(rejected).toBeGreaterThan(0);
    const accepted = settled.filter((value) => value !== 'rejected') as Array<{ index: number }>;
    expect(accepted.length).toBeGreaterThan(0);
    // Accepted requests were written in order once stdin drained.
    const indexes = accepted.map((value) => value.index);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    await expect(fake.runtime.request('echo', 'after')).resolves.toBe('after');
  });
});

describe('overloaded', () => {
  it('rejects the pending request with an overload error and does not retry', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    await fake.runtime.start();
    const error = await fake.runtime.request('overload').catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(OverloadedError);
    expect(error).toMatchObject({ code: 'overloaded', rpcCode: -32001, method: 'overload' });
    await fake.runtime.request('echo', 'barrier');
    expect(fake.received().filter((message) => message.method === 'overload')).toHaveLength(1);
  });
});

describe('bad and oversized lines', () => {
  it('logs and skips invalid JSON, then keeps working', async () => {
    const notifications: string[] = [];
    const fake = track(
      fakeRuntime({ FAKE_MODE: 'badJson' }, { onNotification: (notification) => notifications.push(notification.method) }),
    );
    await fake.runtime.start();
    await waitFor(() => notifications.includes('fake/afterBadJson'), 5_000, 'notification after bad JSON');
    expect(fake.runtime.state).toBe('ready');
    expect(fake.logger.messages.some((message) => message.includes('skipping invalid JSON line'))).toBe(true);
    await expect(fake.runtime.request('echo', 1)).resolves.toBe(1);
  });

  it('fails the connection and stops the runtime on an oversized line', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'oversize', FAKE_OVERSIZE_BYTES: '8192' }, { maxLineBytes: 1024 }));
    await fake.runtime.start();
    await waitFor(() => fake.runtime.state === 'failed', 5_000, 'failed');
    expect(fake.runtime.failure).toBeInstanceOf(LineTooLongError);
    await expect(fake.runtime.request('echo', 1)).rejects.toBeInstanceOf(NotReadyError);
    // The runtime stops itself (stdin EOF) without any stop() call.
    await waitFor(() => fake.runtime.exitInfo !== undefined, 5_000, 'self-stop exit');
    expect(fake.sawEof()).toBe(true);
    expect(fake.runtime.exitInfo!.exitCode).toBe(0);
    expect(fake.runtime.state).toBe('failed');
  });
});

describe('server request', () => {
  it('answers with -32601 so it is never left unanswered', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'serverRequest' }));
    await fake.runtime.start();
    await waitFor(() => fake.received().some((message) => message.id === 'srv-1'), 5_000, 'server request reply');
    const reply = await fake.runtime.request('getServerRequestReply');
    expect(reply).toEqual({
      id: 'srv-1',
      error: { code: -32601, message: 'Inquello desktop does not handle server request item/commandExecution/requestApproval' },
    });
  });
});

describe('unexpected exit', () => {
  it('rejects pending requests and reports exit code and recent stderr, without restarting', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'exitAfterInit' }));
    await fake.runtime.start();
    const pending = fake.runtime.request('hang').catch((error: unknown) => error);

    const error = await pending;
    expect(error).toBeInstanceOf(DisconnectedError);
    expect(fake.runtime.state).toBe('disconnected');
    const disconnect = fake.runtime.disconnect!;
    expect(disconnect.details.exitCode).toBe(3);
    expect(disconnect.details.stderrTail).toEqual(['ERROR codex_app_server: fatal one', 'ERROR codex_app_server: fatal two']);
    expect(disconnect.message).toContain('exit code 3');
    expect(disconnect.message).toContain('fatal two');

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(fake.states.filter((state) => state === 'starting')).toHaveLength(1);
    expect(fake.runtime.state).toBe('disconnected');
    await expect(fake.runtime.request('echo', 1)).rejects.toBeInstanceOf(NotReadyError);
  });

  it('fails the handshake when the child exits before ready', async () => {
    const fake = track(
      fakeRuntime({ FAKE_MODE: 'normal' }, { command: process.execPath, commandArgsPrefix: ['-e', 'console.error("boom"); process.exit(7)', '--'] }),
    );
    const error = await fake.runtime.start().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(HandshakeError);
    expect((error as Error).message).toContain('exit code 7');
    expect((error as Error).message).toContain('boom');
    expect(fake.runtime.state).toBe('failed');
  });

  it('fails a handshake that exceeds its timeout and stops the child itself', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal', FAKE_INIT_DELAY_MS: '2000' }, { handshakeTimeoutMs: 200 }));
    const error = await fake.runtime.start().catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(HandshakeError);
    expect((error as Error).message).toContain('did not complete within 200 ms');
    expect(fake.runtime.state).toBe('failed');
    await waitFor(() => fake.runtime.exitInfo !== undefined, 5_000, 'self-stop exit');
    expect(fake.sawEof()).toBe(true);
    expect(fake.runtime.state).toBe('failed');
  });

  it('fails the handshake when the binary cannot be spawned', async () => {
    const fake = track(fakeRuntime({}, { command: 'D:/definitely/missing/codex-app-server.exe', commandArgsPrefix: [] }));
    await expect(fake.runtime.start()).rejects.toBeInstanceOf(HandshakeError);
    expect(fake.runtime.state).toBe('failed');
  });
});

describe('graceful stop', () => {
  it('ends stopped, not failed, when stop() lands before start() settles', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    const starting = fake.runtime.start().catch((failure: unknown) => failure);
    expect(fake.runtime.state).toBe('starting');
    const exit = await fake.runtime.stop();
    expect(await starting).toBeInstanceOf(StoppingError);
    expect(exit).toMatchObject({ exitCode: 0, killed: false });
    expect(fake.runtime.state).toBe('stopped');
    expect(fake.states).not.toContain('failed');
    expect(fake.received()).toEqual([]);
  });

  it('closes stdin and awaits a clean exit', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    await fake.runtime.start();
    const exit = await fake.runtime.stop();
    expect(exit).toMatchObject({ exitCode: 0, signal: null, killed: false });
    expect(fake.runtime.state).toBe('stopped');
    expect(fake.states).toEqual(['starting', 'initializing', 'ready', 'stopping', 'stopped']);
    await expect(fake.runtime.request('echo', 1)).rejects.toBeInstanceOf(NotReadyError);
  });

  it('kills the child after the grace period when it ignores EOF', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'ignoreEof' }, { stopGraceMs: 500 }));
    await fake.runtime.start();
    const started = Date.now();
    const exit = await fake.runtime.stop();
    expect(exit.killed).toBe(true);
    expect(exit.exitCode === 0).toBe(false);
    expect(Date.now() - started).toBeGreaterThanOrEqual(450);
    expect(fake.runtime.state).toBe('stopped');
  });

  it('rejects requests still pending when the child exits during stop', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'normal' }));
    await fake.runtime.start();
    const pending = fake.runtime.request('hang').catch((error: unknown) => error);
    await fake.runtime.stop();
    expect(await pending).toMatchObject({ code: 'stopping' });
  });
});

describe('stderr noise', () => {
  it('captures stderr to a bounded buffer and a log file and never parses it', async () => {
    const fake = track(fakeRuntime({ FAKE_MODE: 'stderrNoise', FAKE_INIT_DELAY_MS: '200' }, { stderrTailLines: 2 }));
    const result = await fake.runtime.start();
    expect(result.userAgent).toContain('/0.165.0 ');
    expect(fake.runtime.state).toBe('ready');

    await fake.runtime.stop();
    const tail = fake.runtime.exitInfo!.stderrTail;
    expect(tail).toHaveLength(2);
    expect(tail).toEqual(['INFO codex_app_server: starting up', 'fake: stdin closed, exiting']);
    await waitFor(() => fs.existsSync(fake.stderrLogPath) && fs.readFileSync(fake.stderrLogPath, 'utf8').includes('exiting'));
    const log = fs.readFileSync(fake.stderrLogPath, 'utf8');
    expect(log).toContain('evil/9.9.9');
    expect(log).toContain('INFO codex_app_server: starting up');
  });
});
