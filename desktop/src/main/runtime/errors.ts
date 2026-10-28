/** Errors raised by the desktop runtime client. Each carries a stable `code`. */

export type RuntimeErrorCode =
  | 'not_ready'
  | 'queue_full'
  | 'overloaded'
  | 'rpc_error'
  | 'disconnected'
  | 'stopping'
  | 'version_mismatch'
  | 'line_too_long'
  | 'handshake_failed'
  | 'binary_not_found';

export class RuntimeError extends Error {
  constructor(
    readonly code: RuntimeErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** A request was made while the runtime was not `ready`; it was never forwarded. */
export class NotReadyError extends RuntimeError {
  constructor(readonly state: string) {
    super('not_ready', `app-server runtime is not ready (state: ${state}); request not sent`);
  }
}

/** The bounded outbound queue is full because the child is not draining stdin. */
export class QueueFullError extends RuntimeError {
  constructor(readonly limit: number) {
    super('queue_full', `app-server outbound queue is full (${limit} messages waiting for drain); request not sent`);
  }
}

/** JSON-RPC error response returned by the app-server. */
export class RpcResponseError extends RuntimeError {
  constructor(
    readonly method: string,
    readonly rpcCode: number,
    readonly rpcMessage: string,
    readonly data: unknown,
    code: 'rpc_error' | 'overloaded' = 'rpc_error',
  ) {
    super(code, `app-server ${method} failed (${rpcCode}): ${rpcMessage}`);
  }
}

/** The app-server rejected the request with `-32001`. Not retried automatically. */
export class OverloadedError extends RpcResponseError {
  constructor(method: string, rpcMessage: string, data: unknown) {
    super(method, -32001, rpcMessage, data, 'overloaded');
  }
}

export interface ExitDetails {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderrTail: string[];
}

/** The child exited unexpectedly. No restart is attempted. */
export class DisconnectedError extends RuntimeError {
  constructor(readonly details: ExitDetails) {
    super('disconnected', describeExit('app-server exited unexpectedly', details));
  }
}

/** The runtime is stopping; pending and queued work was abandoned. */
export class StoppingError extends RuntimeError {
  constructor() {
    super('stopping', 'app-server runtime is stopping; request abandoned');
  }
}

/** The running app-server does not match the schema the client was generated from. */
export class VersionMismatchError extends RuntimeError {
  constructor(
    readonly schemaVersion: string,
    readonly runtimeVersion: string | null,
    readonly userAgent: string,
  ) {
    super(
      'version_mismatch',
      `app-server runtime version ${runtimeVersion ?? '(unparseable)'} does not match protocol schema version ${schemaVersion} (userAgent: ${JSON.stringify(userAgent)})`,
    );
  }
}

/** A protocol line exceeded the framing limit; the connection cannot be trusted. */
export class LineTooLongError extends RuntimeError {
  constructor(readonly limitBytes: number) {
    super('line_too_long', `app-server stdout line exceeds ${limitBytes} bytes; connection failed`);
  }
}

/** The handshake did not complete (spawn failure, early exit, timeout, bad response). */
export class HandshakeError extends RuntimeError {
  constructor(message: string) {
    super('handshake_failed', message);
  }
}

export class BinaryNotFoundError extends RuntimeError {
  constructor(message: string) {
    super('binary_not_found', message);
  }
}

export function describeExit(prefix: string, details: ExitDetails): string {
  const status = details.signal ? `signal ${details.signal}` : `exit code ${details.exitCode ?? 'unknown'}`;
  const tail = details.stderrTail.length > 0 ? `; last stderr:\n${details.stderrTail.join('\n')}` : '; no stderr output';
  return `${prefix} (${status})${tail}`;
}
