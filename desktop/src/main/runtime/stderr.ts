/**
 * Captures the child's stderr (upstream tracing logs, controlled by `RUST_LOG`).
 *
 * Stderr is never parsed as protocol. Raw bytes go to an append-only log file
 * when one is configured; decoded lines are kept in a bounded ring buffer so
 * disconnect reports can name the last lines the runtime wrote.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';

import type { Logger } from './logger';

export const DEFAULT_STDERR_TAIL_LINES = 200;
/** Longest stderr line kept in the ring buffer; longer lines are truncated. */
export const MAX_STDERR_LINE_CHARS = 4096;
/** Characters held for an unterminated stderr line before it is flushed as-is. */
const MAX_PARTIAL_CHARS = 64 * 1024;

export class StderrCapture {
  private readonly lines: string[] = [];
  private partial = '';
  private readonly logFile: fs.WriteStream | undefined;
  private readonly ended: Promise<void>;

  constructor(
    stream: Readable,
    private readonly options: { tailLines?: number; logFilePath?: string; logger: Logger },
  ) {
    if (options.logFilePath) {
      fs.mkdirSync(path.dirname(options.logFilePath), { recursive: true });
      this.logFile = fs.createWriteStream(options.logFilePath, { flags: 'a' });
      this.logFile.on('error', (error) => options.logger.warn(`app-server stderr log write failed: ${error.message}`));
      this.logFile.write(`\n--- app-server stderr, ${new Date().toISOString()} ---\n`);
    }
    stream.setEncoding('utf8');
    stream.on('data', (chunk: string) => this.handle(chunk));
    this.ended = new Promise((resolve) => {
      const finish = () => {
        this.flushPartial();
        resolve();
      };
      stream.once('end', finish);
      stream.once('close', finish);
      stream.once('error', finish);
    });
  }

  /** The most recent stderr lines, oldest first. */
  tail(): string[] {
    return this.partial ? [...this.lines, truncate(this.partial)].slice(-this.limit) : [...this.lines];
  }

  /** Resolves when stderr reaches end-of-stream, or after `timeoutMs`, whichever is first. */
  async settle(timeoutMs: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([this.ended, new Promise<void>((resolve) => (timer = setTimeout(resolve, timeoutMs)))]);
    clearTimeout(timer);
  }

  close(): void {
    this.logFile?.end();
  }

  private get limit(): number {
    return this.options.tailLines ?? DEFAULT_STDERR_TAIL_LINES;
  }

  private handle(chunk: string): void {
    this.logFile?.write(chunk);
    const parts = (this.partial + chunk).split('\n');
    this.partial = parts.pop() ?? '';
    for (const part of parts) this.push(part);
    if (this.partial.length > MAX_PARTIAL_CHARS) this.flushPartial();
  }

  private flushPartial(): void {
    if (this.partial) this.push(this.partial);
    this.partial = '';
  }

  private push(line: string): void {
    const clean = line.endsWith('\r') ? line.slice(0, -1) : line;
    if (clean.length === 0) return;
    this.lines.push(truncate(clean));
    if (this.lines.length > this.limit) this.lines.splice(0, this.lines.length - this.limit);
  }
}

function truncate(line: string): string {
  return line.length > MAX_STDERR_LINE_CHARS ? `${line.slice(0, MAX_STDERR_LINE_CHARS)}...` : line;
}
