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

import { controlledPaidLaunchRequested } from '../src/main/runtime/lifecycle';

describe('controlled paid startup isolation', () => {
  const key = 'INQUELLO_FICTIONAL_PAID_SESSION';
  it('leaves ordinary no-flag startup and smoke unchanged', () => {
    expect(controlledPaidLaunchRequested([], [])).toBe(false);
    expect(controlledPaidLaunchRequested(['INQUELLO_SMOKE_SEED'], ['--smoke'])).toBe(false);
    expect(controlledPaidLaunchRequested([key], [])).toBe(true);
  });
  it.each(['--smoke', '--smoke-navigation', '--smoke-quota', '--smoke-visual', '--smoke-future'])(
    'rejects %s before startup cleanup', flag => {
      expect(() => controlledPaidLaunchRequested([key], [flag])).toThrow(/cannot run smoke/);
    },
  );
  it.each(['INQUELLO_SMOKE_SEED', 'INQUELLO_QUOTA_FIXTURE', 'INQUELLO_VISUAL_FIXTURE'])(
    'rejects inherited fixture control %s', name => {
      expect(() => controlledPaidLaunchRequested([key, name], [])).toThrow(/cannot run smoke/);
    },
  );
  it('rejects aliases and duplicate casing without reading values', () => {
    expect(() => controlledPaidLaunchRequested([key.toLowerCase()], [])).toThrow(/ambiguous/);
    expect(() => controlledPaidLaunchRequested([key, key.toLowerCase()], [])).toThrow(/ambiguous/);
  });
});
