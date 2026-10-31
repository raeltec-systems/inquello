/**
 * Owns one `codex-app-server` child over stdio.
 *
 * Lifecycle: `stopped` (not started) -> `starting` (spawned) -> `initializing`
 * (`initialize` sent) -> `ready` (`initialized` sent, version checked). From
 * `ready`: `stopping` -> `stopped` on request, or `disconnected` if the child
 * exits on its own. Any handshake, framing or version failure ends in `failed`
 * and stops the child. There is no automatic restart.
 *
 * Shutdown follows upstream: stdin EOF is the only shutdown signal the stdio
 * transport honours, and Windows has no upstream teardown deadline, so the
 * client bounds it with a grace period and then kills the child.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter, once } from 'node:events';

import type { ClientInfo } from '../../protocol/generated/ClientInfo';
import type { InitializeParams } from '../../protocol/generated/InitializeParams';
import type { InitializeResponse } from '../../protocol/generated/InitializeResponse';
import {
  DisconnectedError,
  HandshakeError,
  NotReadyError,
  StoppingError,
  describeExit,
  type ExitDetails,
} from './errors';
import { silentLogger, type Logger } from './logger';
import { RpcConnection, type ServerNotificationMessage } from './rpc';
import { StderrCapture } from './stderr';
import { assertRuntimeMatchesSchema, type SchemaStamp } from './version';

export type RuntimeState = 'starting' | 'initializing' | 'ready' | 'stopping' | 'stopped' | 'disconnected' | 'failed';

/** The only transport this client ever requests. */
export const STDIO_LISTEN_ARGS: readonly string[] = ['--listen', 'stdio://'];

export const DEFAULT_STOP_GRACE_MS = 10_000;
export const DEFAULT_HANDSHAKE_TIMEOUT_MS = 30_000;
/** How long to wait for stderr to finish after exit before reporting its tail. */
const STDERR_SETTLE_MS = 250;

export interface ExitInfo extends ExitDetails {
  /** True when the child was killed after the stop grace period. */
  killed: boolean;
}

export interface StateChange {
  state: RuntimeState;
  error?: Error;
}

export interface AppServerRuntimeOptions {
  /** Path to the app-server binary (or, in tests, an interpreter). */
  command: string;
  /** Arguments placed before the transport arguments; used by tests to run a script. */
  commandArgsPrefix?: readonly string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  clientInfo: ClientInfo;
  schemaStamp: Pick<SchemaStamp, 'runtimeVersion'>;
  stderrLogPath?: string;
  stderrTailLines?: number;
  stopGraceMs?: number;
  handshakeTimeoutMs?: number;
  maxQueuedMessages?: number;
  maxLineBytes?: number;
  logger?: Logger;
  onNotification?: (notification: ServerNotificationMessage) => void;
  /** Answers a server-initiated request; `undefined` leaves it unsupported (Story 1.19 escalations). */
  onServerRequest?: (method: string, params: unknown, id: number | string) => unknown;
}

export class AppServerRuntime extends EventEmitter<{ state: [StateChange] }> {
  private currentState: RuntimeState = 'stopped';
  private started = false;
  private child: ChildProcessWithoutNullStreams | undefined;
  private rpc: RpcConnection | undefined;
  private stderr: StderrCapture | undefined;
  private exitSeen = false;
  private killed = false;
  private exitHandled: Promise<ExitInfo> | undefined;
  private terminating: Promise<ExitInfo> | undefined;
  private failureError: Error | undefined;
  private disconnectError: DisconnectedError | undefined;
  private exit: ExitInfo | undefined;
  private initializeResult: InitializeResponse | undefined;
  private readonly logger: Logger;

  constructor(private readonly options: AppServerRuntimeOptions) {
    super();
    this.logger = options.logger ?? silentLogger;
  }

  get state(): RuntimeState {
    return this.currentState;
  }

  /** Why the runtime is `failed`, if it is. */
  get failure(): Error | undefined {
    return this.failureError;
  }

  /** Exit code and stderr tail, if the runtime is `disconnected`. */
  get disconnect(): DisconnectedError | undefined {
    return this.disconnectError;
  }

  get exitInfo(): ExitInfo | undefined {
    return this.exit;
  }

  get handshake(): InitializeResponse | undefined {
    return this.initializeResult;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  stderrTail(): string[] {
    return this.stderr?.tail() ?? [];
  }

  /** Spawns the child and completes the handshake. Rejects (state `failed`) on any failure. */
  async start(): Promise<InitializeResponse> {
    if (this.started) throw new Error('app-server runtime was already started; create a new runtime instead');
    this.started = true;
    this.setState('starting');

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(this.options.command, [...(this.options.commandArgsPrefix ?? []), ...STDIO_LISTEN_ARGS], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: this.options.env ?? process.env,
        cwd: this.options.cwd,
        windowsHide: true,
      });
    } catch (error) {
      const failure = new HandshakeError(`failed to spawn app-server ${this.options.command}: ${(error as Error).message}`);
      this.fail(failure);
      throw failure;
    }
    this.child = child;
    this.exitHandled = new Promise((resolve) => {
      child.once('exit', (code, signal) => {
        this.exitSeen = true;
        // Decide the outcome from the state at exit, not after the stderr settle delay.
        resolve(this.handleExit(code, signal, this.currentState));
      });
    });

    let rpc: RpcConnection;
    try {
      this.stderr = new StderrCapture(child.stderr, {
        tailLines: this.options.stderrTailLines,
        logFilePath: this.options.stderrLogPath,
        logger: this.logger,
      });
      rpc = new RpcConnection(child.stdout, child.stdin, {
        logger: this.logger,
        maxQueuedMessages: this.options.maxQueuedMessages,
        maxLineBytes: this.options.maxLineBytes,
        onNotification: this.options.onNotification,
        onServerRequest: this.options.onServerRequest,
        onFatal: (error) => this.fail(error),
      });
      this.rpc = rpc;
      child.stdout.on('error', (error) => this.logger.warn(`app-server stdout error: ${error.message}`));
    } catch (error) {
      // Goes through fail() so the already-spawned child is stopped.
      const failure = new HandshakeError(`failed to attach to app-server: ${(error as Error).message}`);
      this.fail(failure);
      throw failure;
    }

    const timeoutMs = this.options.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS;
    const timer = setTimeout(
      () => this.fail(new HandshakeError(`app-server handshake did not complete within ${timeoutMs} ms`)),
      timeoutMs,
    );
    try {
      const spawned = once(child, 'spawn');
      // Keep a permanent listener so late errors (e.g. a failed kill) never crash the main process.
      child.on('error', (error) => this.logger.warn(`app-server process error: ${error.message}`));
      try {
        await spawned;
      } catch (error) {
        throw new HandshakeError(`failed to spawn app-server ${this.options.command}: ${(error as Error).message}`);
      }
      // A stop() or handshake timeout may have landed while spawning; never overwrite it.
      if (this.currentState !== 'starting' || this.exitSeen) throw this.failureError ?? new StoppingError();
      this.setState('initializing');
      const params: InitializeParams = { clientInfo: this.options.clientInfo, capabilities: null };
      const result = await rpc.request<InitializeResponse>('initialize', params);
      if (typeof result !== 'object' || result === null || typeof result.userAgent !== 'string') {
        throw new HandshakeError(`app-server initialize result has no userAgent: ${JSON.stringify(result)}`);
      }
      assertRuntimeMatchesSchema(result.userAgent, this.options.schemaStamp);
      this.assertStillInitializing();
      rpc.notify('initialized');
      this.initializeResult = result;
      this.setState('ready');
      return result;
    } catch (error) {
      this.fail(error as Error);
      throw this.failureError ?? error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Sends a request. Rejected locally, never forwarded, unless the runtime is `ready`. */
  /** Main-only, dedicated bounded credential channel. */
  privateRouteAuth(params: unknown): Promise<unknown> {
    if (this.state !== 'ready' || !this.rpc) return Promise.reject(new Error('Private route handoff unavailable'));
    const rpc = this.rpc;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void this.stop().finally(() => reject(new Error('Private route handoff timed out; runtime stopped')));
      }, 5_000);
      rpc.privateRouteAuth(params).then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); reject(new Error('Private route handoff refused')); });
    });
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.currentState !== 'ready' || this.exitSeen || !this.rpc) {
      return Promise.reject(new NotReadyError(this.notReadyState()));
    }
    return this.rpc.request<T>(method, params);
  }

  /** Sends a notification. Throws locally unless the runtime is `ready`. */
  notify(method: string, params?: unknown): void {
    if (this.currentState !== 'ready' || this.exitSeen || !this.rpc) throw new NotReadyError(this.notReadyState());
    this.rpc.notify(method, params);
  }

  /** The state to report while rejecting; the child may have exited before its state change lands. */
  private notReadyState(): string {
    return this.exitSeen && this.exit === undefined ? `${this.currentState}, child exited` : this.currentState;
  }

  /**
   * Closes stdin and waits for the child to exit, killing it after the grace
   * period. Safe to call in any state; resolves with how the child ended.
   */
  async stop(): Promise<ExitInfo> {
    const child = this.child;
    if (!child || child.pid === undefined) {
      if (this.currentState !== 'failed') this.setState('stopped');
      return this.exit ?? { exitCode: null, signal: null, killed: false, stderrTail: [] };
    }
    if (this.exit) return this.exit;
    // Exited but not yet reported: the exit handler decides the outcome; just wait for it.
    if (this.exitSeen && this.exitHandled) return this.exitHandled;
    if (this.currentState !== 'failed' && this.currentState !== 'stopping') {
      this.setState('stopping');
      this.rpc?.discardQueued(new StoppingError());
    }
    return this.terminate();
  }

  private assertStillInitializing(): void {
    if (this.currentState !== 'initializing' || this.exitSeen) {
      throw this.failureError ?? new HandshakeError(`app-server handshake interrupted (state: ${this.currentState})`);
    }
  }

  private fail(error: Error): void {
    const state = this.currentState;
    if (state === 'failed' || state === 'stopped' || state === 'disconnected') return;
    if (state === 'stopping') {
      // Already shutting down on request; a late failure does not change the outcome.
      this.rpc?.close(error);
      return;
    }
    this.failureError = error;
    this.logger.error(error.message);
    this.setState('failed', error);
    this.rpc?.close(error);
    void this.terminate();
  }

  private terminate(): Promise<ExitInfo> {
    this.terminating ??= (async () => {
      const child = this.child;
      if (!child || child.pid === undefined || !this.exitHandled) {
        return { exitCode: null, signal: null, killed: false, stderrTail: this.stderrTail() };
      }
      if (!this.exitSeen) {
        child.stdin.end();
        const graceMs = this.options.stopGraceMs ?? DEFAULT_STOP_GRACE_MS;
        const timer = setTimeout(() => {
          if (this.exitSeen) return;
          this.killed = true;
          this.logger.warn(`app-server did not exit within ${graceMs} ms of stdin EOF; killing it`);
          child.kill();
        }, graceMs);
        try {
          return await this.exitHandled;
        } finally {
          clearTimeout(timer);
        }
      }
      return this.exitHandled;
    })();
    return this.terminating;
  }

  private async handleExit(
    exitCode: number | null,
    signal: NodeJS.Signals | null,
    stateAtExit: RuntimeState,
  ): Promise<ExitInfo> {
    await this.stderr?.settle(STDERR_SETTLE_MS);
    const info: ExitInfo = { exitCode, signal, killed: this.killed, stderrTail: this.stderrTail() };
    this.exit = info;
    this.stderr?.close();
    // A failure recorded during the settle delay (e.g. handshake timeout) stands.
    const outcomeState = this.currentState === 'failed' ? 'failed' : stateAtExit;
    switch (outcomeState) {
      case 'ready': {
        const error = new DisconnectedError(info);
        this.disconnectError = error;
        this.logger.error(error.message);
        this.rpc?.close(error);
        this.setState('disconnected', error);
        break;
      }
      case 'starting':
      case 'initializing':
        this.fail(new HandshakeError(describeExit('app-server exited during the handshake', info)));
        break;
      case 'stopping':
        this.rpc?.close(new StoppingError());
        this.setState('stopped');
        break;
      default:
        break;
    }
    return info;
  }

  private setState(state: RuntimeState, error?: Error): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.logger.info(`app-server runtime state: ${state}`);
    try {
      this.emit('state', error ? { state, error } : { state });
    } catch (listenerError) {
      // A faulty listener must not break the transition or the stdout handler that triggered it.
      this.logger.error(`runtime state listener threw: ${(listenerError as Error).message}`);
    }
  }
}
