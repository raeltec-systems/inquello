import { describe, expect, it } from 'vitest';

import { encodeLine, LineDecoder, LineTooLongError, MAX_LINE_BYTES } from '../src/main/runtime';

describe('LineDecoder', () => {
  it('splits lines across chunks and skips empty lines', () => {
    const decoder = new LineDecoder();
    expect(decoder.push(Buffer.from('{"a":1}\n{"b"'))).toEqual(['{"a":1}']);
    expect(decoder.bufferedBytes).toBe(4);
    expect(decoder.push(Buffer.from(':2}\n\n\r\n{"c":3}\r\n'))).toEqual(['{"b":2}', '{"c":3}']);
    expect(decoder.bufferedBytes).toBe(0);
  });

  it('decodes UTF-8 characters split across chunks', () => {
    const bytes = Buffer.from('{"t":"héllo €"}\n');
    const decoder = new LineDecoder();
    const out: string[] = [];
    for (let index = 0; index < bytes.length; index += 1) out.push(...decoder.push(bytes.subarray(index, index + 1)));
    expect(out).toEqual(['{"t":"héllo €"}']);
  });

  it('accepts a line exactly at the limit and rejects one byte more', () => {
    expect(new LineDecoder(4).push(Buffer.from('abcd\n'))).toEqual(['abcd']);
    expect(() => new LineDecoder(4).push(Buffer.from('abcde\n'))).toThrow(LineTooLongError);
    const decoder = new LineDecoder(4);
    decoder.push(Buffer.from('abc'));
    expect(() => decoder.push(Buffer.from('de'))).toThrow(LineTooLongError);
  });

  it('defaults to a 64 MiB limit', () => {
    expect(MAX_LINE_BYTES).toBe(64 * 1024 * 1024);
    const decoder = new LineDecoder();
    const chunk = Buffer.alloc(MAX_LINE_BYTES, 0x61);
    expect(decoder.push(chunk)).toEqual([]);
    expect(() => decoder.push(Buffer.from('a'))).toThrow(LineTooLongError);
  });
});

describe('encodeLine', () => {
  it('writes one JSON object per line with no jsonrpc field', () => {
    expect(encodeLine({ id: 1, method: 'initialize' })).toBe('{"id":1,"method":"initialize"}\n');
  });
});
