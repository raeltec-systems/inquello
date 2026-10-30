import { describe, expect, it } from 'vitest';
import { RuntimeLifecycle } from '../src/main/runtime/lifecycle';

describe('runtime lifecycle ownership', () => {
  it('waits for initial startup before stopping, without scheduling an automatic restart', async () => {
    const lifecycle = new RuntimeLifecycle();
    const events: string[] = [];
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const start = lifecycle.run(async () => { events.push('starting'); await gate; events.push('ready'); });
    const stop = lifecycle.run(async () => { events.push('stopped'); });
    await Promise.resolve();
    expect(events).toEqual(['starting']);
    finish();
    await Promise.all([start, stop]);
    expect(events).toEqual(['starting', 'ready', 'stopped']);
    await Promise.resolve();
    expect(events).toHaveLength(3);
  });

  it('still performs shutdown when startup failed', async () => {
    const lifecycle = new RuntimeLifecycle();
    const start = lifecycle.run(async () => { throw new Error('handshake failed'); });
    const stop = lifecycle.run(async () => 'stopped');
    await expect(start).rejects.toThrow('handshake failed');
    await expect(stop).resolves.toBe('stopped');
  });
});
