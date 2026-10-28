/**
 * Newline-delimited JSON framing for the app-server stdio transport.
 *
 * Upstream reads one JSON message per `\n`-terminated line and writes the same.
 * Lines are split on raw bytes before UTF-8 decoding so multi-byte characters
 * split across chunks decode correctly. A trailing `\r` is tolerated.
 */
import { LineTooLongError } from './errors';

/** Largest accepted protocol line, excluding the newline. Larger lines fail the connection. */
export const MAX_LINE_BYTES = 64 * 1024 * 1024;

const NEWLINE = 0x0a;
const CARRIAGE_RETURN = 0x0d;

export class LineDecoder {
  private chunks: Buffer[] = [];
  private buffered = 0;

  constructor(private readonly maxLineBytes: number = MAX_LINE_BYTES) {}

  /** Bytes held for an incomplete line. */
  get bufferedBytes(): number {
    return this.buffered;
  }

  /**
   * Feeds a chunk and returns every complete, non-empty line it finishes.
   * Throws {@link LineTooLongError} as soon as a line is known to exceed the limit.
   */
  push(chunk: Buffer): string[] {
    const lines: string[] = [];
    let start = 0;
    for (;;) {
      const newline = chunk.indexOf(NEWLINE, start);
      if (newline === -1) break;
      const piece = chunk.subarray(start, newline);
      this.ensureWithinLimit(piece.length);
      let line = this.buffered > 0 ? Buffer.concat([...this.chunks, piece]) : piece;
      this.chunks = [];
      this.buffered = 0;
      if (line.length > 0 && line[line.length - 1] === CARRIAGE_RETURN) line = line.subarray(0, line.length - 1);
      if (line.length > 0) lines.push(line.toString('utf8'));
      start = newline + 1;
    }
    if (start < chunk.length) {
      const rest = chunk.subarray(start);
      this.ensureWithinLimit(rest.length);
      this.chunks.push(rest);
      this.buffered += rest.length;
    }
    return lines;
  }

  private ensureWithinLimit(additional: number): void {
    if (this.buffered + additional > this.maxLineBytes) {
      this.chunks = [];
      this.buffered = 0;
      throw new LineTooLongError(this.maxLineBytes);
    }
  }
}

/** Serialises one outbound message as a single protocol line. */
export function encodeLine(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}
