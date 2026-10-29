/**
 * Request/response client for the app-server stdio protocol.
 *
 * Wire shapes follow `app-server-protocol/src/rpc.rs`: request `{id, method, params?}`,
 * notification `{method, params?}`, response `{id, result}`, error
 * `{id, error: {code, message, data?}}`. There is no `jsonrpc` field in either
 * direction.
 *
 * Backpressure: when `write()` returns false, further messages wait in a bounded
 * queue until `drain`. A full queue rejects new requests and notifications.
 * Responses to server requests bypass the bound so that no server request is
 * ever left unanswered.
 */
import type { Readable, Writable } from 'node:stream';

import { LineTooLongError, OverloadedError, QueueFullError, RpcResponseError } from './errors';
import { encodeLine, LineDecoder, MAX_LINE_BYTES } from './framing';
import type { Logger } from './logger';

export const OVERLOADED_ERROR_CODE = -32001;
export const METHOD_NOT_FOUND_ERROR_CODE = -32601;
export const DEFAULT_MAX_QUEUED_MESSAGES = 1024;

export type RequestId = number | string;

export interface ServerNotificationMessage {
  method: string;
  params?: unknown;
}

export interface RpcConnectionOptions {
  logger: Logger;
  /** Outbound messages allowed to wait for `drain` before new requests are rejected. */
  maxQueuedMessages?: number;
  /** Framing limit for inbound lines. */
  maxLineBytes?: number;
  onNotification?: (notification: ServerNotificationMessage) => void;
  /**
   * Answers a server-initiated request with a result; returning `undefined`
   * (or throwing) answers it as unsupported (Story 1.19: escalations).
   */
  onServerRequest?: (method: string, params: unknown) => unknown | Promise<unknown>;
  /** Called once when the inbound stream can no longer be trusted (e.g. oversized line). */
  onFatal: (error: Error) => void;
}

interface PendingRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface QueuedLine {
  line: string;
  requestId?: number;
}

const MAX_LOGGED_LINE_CHARS = 200;

export class ConnectionClosedError extends Error {
  constructor(method: string) {
    super(`app-server connection is closed; ${method} not sent`);
    this.name = 'ConnectionClosedError';
  }
}

export class RpcConnection {
  private nextId = 1;
  private readonly pending = new Map<RequestId, PendingRequest>();
  private readonly queue: QueuedLine[] = [];
  private waitingForDrain = false;
  private closed = false;
  private readonly decoder: LineDecoder;
  private readonly maxQueuedMessages: number;
  private readonly onData = (chunk: Buffer) => this.handleChunk(chunk);
  private readonly onDrain = () => this.flush();

  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
    private readonly options: RpcConnectionOptions,
  ) {
    this.decoder = new LineDecoder(options.maxLineBytes ?? MAX_LINE_BYTES);
    this.maxQueuedMessages = options.maxQueuedMessages ?? DEFAULT_MAX_QUEUED_MESSAGES;
    input.on('data', this.onData);
    // Write errors (EPIPE when the child dies) surface through the process exit path.
    output.on('error', (error) => options.logger.warn(`app-server stdin error: ${error.message}`));
  }

  get pendingCount(): number {
    return this.pending.size;
  }

  get queuedCount(): number {
    return this.queue.length;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new ConnectionClosedError(method));
    const id = this.nextId++;
    const message: { id: number; method: string; params?: unknown } = { id, method };
    if (params !== undefined) message.params = params;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { method, resolve: resolve as (result: unknown) => void, reject });
      try {
        this.send({ line: encodeLine(message), requestId: id }, false);
      } catch (error) {
        this.pending.delete(id);
        reject(error as Error);
      }
    });
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) throw new ConnectionClosedError(method);
    const message: { method: string; params?: unknown } = { method };
    if (params !== undefined) message.params = params;
    this.send({ line: encodeLine(message) }, false);
  }

  /** Rejects queued (not yet written) requests and drops every queued line. */
  discardQueued(reason: Error): void {
    for (const entry of this.queue.splice(0)) {
      if (entry.requestId !== undefined) this.rejectPending(entry.requestId, reason);
    }
  }

  /** Stops reading and rejects everything outstanding. Idempotent. */
  close(reason: Error): void {
    if (this.closed) return;
    this.closed = true;
    this.input.off('data', this.onData);
    this.output.off('drain', this.onDrain);
    this.queue.length = 0;
    const pending = [...this.pending.values()];
    this.pending.clear();
    for (const entry of pending) entry.reject(reason);
  }

  private send(entry: QueuedLine, bypassLimit: boolean): void {
    if (this.waitingForDrain || this.queue.length > 0) {
      if (!bypassLimit && this.queue.length >= this.maxQueuedMessages) throw new QueueFullError(this.maxQueuedMessages);
      this.queue.push(entry);
      return;
    }
    this.write(entry.line);
  }

  private write(line: string): void {
    if (!this.output.write(line)) {
      this.waitingForDrain = true;
      this.output.once('drain', this.onDrain);
    }
  }

  private flush(): void {
    this.waitingForDrain = false;
    if (this.closed) return;
    while (this.queue.length > 0 && !this.waitingForDrain) {
      const entry = this.queue.shift()!;
      this.write(entry.line);
    }
  }

  private handleChunk(chunk: Buffer): void {
    if (this.closed) return;
    let lines: string[];
    try {
      lines = this.decoder.push(chunk);
    } catch (error) {
      if (error instanceof LineTooLongError) {
        this.input.off('data', this.onData);
        this.options.onFatal(error);
        return;
      }
      throw error;
    }
    for (const line of lines) {
      if (this.closed) return;
      this.handleLine(line);
    }
  }

  private handleLine(line: string): void {
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.options.logger.warn(`skipping invalid JSON line from app-server (${line.length} chars): ${preview(line)}`);
      return;
    }
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      this.options.logger.warn(`skipping non-object message from app-server: ${preview(line)}`);
      return;
    }
    const record = message as Record<string, unknown>;
    const id = record.id;
    const hasId = typeof id === 'number' || typeof id === 'string';
    const method = typeof record.method === 'string' ? record.method : undefined;

    if (hasId && method !== undefined) {
      this.answerServerRequest(id, method, record.params);
    } else if (method !== undefined) {
      try {
        this.options.onNotification?.({ method, params: record.params });
      } catch (error) {
        // Keep processing the rest of the chunk; a faulty handler must not break the stream.
        this.options.logger.error(`notification handler for ${method} threw: ${(error as Error).message}`);
      }
    } else if (hasId && 'result' in record) {
      this.settle(id, (entry) => entry.resolve(record.result));
    } else if (hasId && isErrorBody(record.error)) {
      const body = record.error;
      this.settle(id, (entry) => {
        entry.reject(
          body.code === OVERLOADED_ERROR_CODE
            ? new OverloadedError(entry.method, body.message, body.data)
            : new RpcResponseError(entry.method, body.code, body.message, body.data),
        );
      });
    } else {
      this.options.logger.warn(`skipping unrecognised message from app-server: ${preview(line)}`);
    }
  }

  /**
   * Answers a server-initiated request through `onServerRequest`, or as
   * unsupported so none is left waiting. A handler may answer later with a
   * promise (Story 1.20: a permission request waits for the person); a
   * rejected or empty answer is sent as unsupported.
   */
  private answerServerRequest(id: RequestId, method: string, params: unknown): void {
    let result: unknown;
    try {
      result = this.options.onServerRequest?.(method, params);
    } catch (error) {
      this.options.logger.error(`server request handler for ${method} threw: ${(error as Error).message}`);
      result = undefined;
    }
    if (result instanceof Promise) {
      const answer = (value: unknown) => {
        try {
          this.sendServerAnswer(id, method, value);
        } catch (error) {
          this.options.logger.warn(`the answer to ${method} could not be sent (${(error as Error).message})`);
        }
      };
      result.then(answer, (error: unknown) => {
        this.options.logger.error(`server request handler for ${method} failed: ${(error as Error).message}`);
        answer(undefined);
      });
      return;
    }
    this.sendServerAnswer(id, method, result);
  }

  private sendServerAnswer(id: RequestId, method: string, result: unknown): void {
    if (result !== undefined) {
      this.send({ line: encodeLine({ id, result }) }, true);
      return;
    }
    this.options.logger.warn(`answering unsupported server request ${JSON.stringify(method)} with ${METHOD_NOT_FOUND_ERROR_CODE}`);
    const response = {
      id,
      error: { code: METHOD_NOT_FOUND_ERROR_CODE, message: `Inquello desktop does not handle server request ${method}` },
    };
    this.send({ line: encodeLine(response) }, true);
  }

  private settle(id: RequestId, action: (entry: PendingRequest) => void): void {
    const entry = this.pending.get(id);
    if (!entry) {
      this.options.logger.warn(`ignoring response for unknown request id ${JSON.stringify(id)}`);
      return;
    }
    this.pending.delete(id);
    action(entry);
  }

  private rejectPending(id: RequestId, reason: Error): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    entry.reject(reason);
  }
}

function isErrorBody(value: unknown): value is { code: number; message: string; data?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as Record<string, unknown>;
  return typeof body.code === 'number' && typeof body.message === 'string';
}

function preview(line: string): string {
  return line.length > MAX_LOGGED_LINE_CHARS ? `${line.slice(0, MAX_LOGGED_LINE_CHARS)}...` : line;
}
