import { PassThrough, Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { OverloadedError, QueueFullError, RpcConnection, RpcResponseError, StoppingError } from '../src/main/runtime';
import { recordingLogger } from './helpers';

/** A writable whose writes complete immediately, or (hold) only when the test releases them. */
class HeldWritable extends Writable {
  readonly written: string[] = [];
  private held: Array<() => void> = [];

  constructor(
    highWaterMark: number,
    private readonly hold: boolean,
  ) {
    super({ highWaterMark, decodeStrings: false });
  }

  override _write(chunk: string | Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.written.push(chunk.toString());
    if (this.hold) this.held.push(() => callback());
    else callback();
  }

  release(): void {
    const held = this.held;
    this.held = [];
    for (const done of held) done();
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

function connection(options: { maxQueuedMessages?: number; highWaterMark?: number; hold?: boolean } = {}) {
  const input = new PassThrough();
  const output = new HeldWritable(options.highWaterMark ?? 1024 * 1024, options.hold ?? false);
  const logger = recordingLogger();
  const notifications: Array<{ method: string; params?: unknown }> = [];
  const fatal: Error[] = [];
  const rpc = new RpcConnection(input, output, {
    logger,
    maxQueuedMessages: options.maxQueuedMessages,
    maxLineBytes: 256,
    onNotification: (notification) => notifications.push(notification),
    onFatal: (error) => fatal.push(error),
  });
  const reply = async (message: unknown) => {
    input.write(`${JSON.stringify(message)}\n`);
    await tick();
  };
  const sent = () => output.written.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { rpc, input, output, logger, notifications, fatal, reply, sent };
}

describe('RpcConnection', () => {
  it('sends requests without a jsonrpc field and resolves responses by id', async () => {
    const { rpc, reply, sent } = connection();
    const first = rpc.request('a/method', { x: 1 });
    const second = rpc.request('b/method');
    expect(sent()).toEqual([
      { id: 1, method: 'a/method', params: { x: 1 } },
      { id: 2, method: 'b/method' },
    ]);
    await reply({ id: 2, result: 'two' });
    await reply({ id: 1, result: { one: true } });
    await expect(first).resolves.toEqual({ one: true });
    await expect(second).resolves.toBe('two');
    expect(rpc.pendingCount).toBe(0);
  });

  it('maps -32001 to an overload error and other codes to response errors, without retrying', async () => {
    const { rpc, reply, output } = connection();
    const overloaded = rpc.request('busy');
    const failed = rpc.request('broken');
    overloaded.catch(() => {});
    failed.catch(() => {});
    await reply({ id: 1, error: { code: -32001, message: 'Server overloaded; retry later.' } });
    await reply({ id: 2, error: { code: -32602, message: 'bad params', data: { field: 'x' } } });
    await expect(overloaded).rejects.toBeInstanceOf(OverloadedError);
    await expect(failed).rejects.toMatchObject({ rpcCode: -32602, data: { field: 'x' } });
    await expect(failed).rejects.toBeInstanceOf(RpcResponseError);
    expect(output.written).toHaveLength(2);
  });

  it('answers server requests with -32601 and delivers notifications', async () => {
    const { reply, sent, notifications } = connection();
    await reply({ id: 'srv-7', method: 'item/fileChange/requestApproval', params: {} });
    await reply({ method: 'thread/started', params: { id: 't' } });
    expect(sent()).toEqual([
      { id: 'srv-7', error: { code: -32601, message: 'Inquello desktop does not handle server request item/fileChange/requestApproval' } },
    ]);
    expect(notifications).toEqual([{ method: 'thread/started', params: { id: 't' } }]);
  });

  it('logs and skips invalid JSON lines', async () => {
    const { rpc, input, reply, logger } = connection();
    const request = rpc.request('m');
    input.write('not json\n[1,2]\n');
    await reply({ id: 1, result: 'ok' });
    await expect(request).resolves.toBe('ok');
    expect(logger.messages.filter((message) => message.startsWith('warn: skipping'))).toHaveLength(2);
  });

  it('reports an oversized line as fatal and stops reading', async () => {
    const { input, fatal, notifications } = connection();
    input.write(`${'x'.repeat(300)}\n`);
    input.write(`${JSON.stringify({ method: 'late' })}\n`);
    await tick();
    expect(fatal).toHaveLength(1);
    expect(fatal[0]).toMatchObject({ code: 'line_too_long' });
    expect(notifications).toEqual([]);
  });

  it('waits for drain when write returns false and bounds the queue', async () => {
    const { rpc, output, reply } = connection({ maxQueuedMessages: 2, highWaterMark: 1, hold: true });
    const first = rpc.request('one'); // written; write() returns false
    const second = rpc.request('two'); // queued
    const third = rpc.request('three'); // queued
    await expect(rpc.request('four')).rejects.toBeInstanceOf(QueueFullError);
    expect(() => rpc.notify('note')).toThrow(QueueFullError);
    expect(output.written.map((line) => JSON.parse(line).method)).toEqual(['one']);
    expect(rpc.queuedCount).toBe(2);

    // Responses to server requests bypass the bound.
    await reply({ id: 'srv', method: 'x/requestApproval' });
    expect(rpc.queuedCount).toBe(3);

    for (let round = 0; round < 4; round += 1) {
      output.release(); // completes the write in flight; drain then writes the next queued line
      await tick();
    }
    expect(output.written.map((line) => JSON.parse(line).method ?? JSON.parse(line).id)).toEqual(['one', 'two', 'three', 'srv']);
    expect(rpc.queuedCount).toBe(0);

    await reply({ id: 1, result: 1 });
    await reply({ id: 2, result: 2 });
    await reply({ id: 3, result: 3 });
    await expect(Promise.all([first, second, third])).resolves.toEqual([1, 2, 3]);
  });

  it('discards queued requests and closes with a reason', async () => {
    const { rpc } = connection({ highWaterMark: 1, hold: true });
    const written = rpc.request('written');
    const queued = rpc.request('queued');
    written.catch(() => {});
    rpc.discardQueued(new StoppingError());
    await expect(queued).rejects.toBeInstanceOf(StoppingError);
    rpc.close(new Error('closed'));
    await expect(written).rejects.toThrow('closed');
    await expect(rpc.request('after')).rejects.toThrow('connection is closed');
  });
});

describe('private input request correlation',()=>{
 it('passes exact native request IDs to mediation and redacts handler failures',async()=>{
  const input=new PassThrough(),output=new HeldWritable(1024*1024,false),logger=recordingLogger();
  const seen:(string|number)[]=[];
  new RpcConnection(input,output,{logger,onFatal:()=>{},onServerRequest:(_method,_params,id)=>{seen.push(id);throw new Error('PRIVATE QUESTION');},onNotification:()=>{throw new Error('PRIVATE NOTIFICATION');}});
  input.write(JSON.stringify({id:'001',method:'item/tool/requestUserInput',params:{}})+'\n');
  input.write(JSON.stringify({id:1,method:'item/tool/requestUserInput',params:{}})+'\n');
  input.write(JSON.stringify({method:'item/completed',params:{}})+'\n');await tick();
  expect(seen).toEqual(['001',1]);expect(JSON.stringify(logger)).not.toContain('PRIVATE');
  expect(output.written.map(v=>JSON.parse(v).id)).toEqual(['001',1]);
 });
});
