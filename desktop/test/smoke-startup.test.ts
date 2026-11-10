import {expect, it, vi} from 'vitest';
import {observeSyntheticStartup} from '../src/main/smoke-startup';

it.each([
  [20_000, true, true],
  [20_001, false, true],
  [60_000, false, true],
  [60_001, false, false],
])('classifies acceptance observed at %ims against one Send origin', async (elapsed, within20, within60) => {
  const began = 1_234;
  const result = await observeSyntheticStartup(() => 'fixture-task', began, {now: () => began + elapsed});
  expect(result).toEqual({taskId: within60 ? 'fixture-task' : null,
    acceptedWithin20s: within20, acceptedWithin60s: within60, elapsedMs: elapsed});
});

it('rejects a predicate that only finishes observing the Task after the functional deadline', async () => {
  let clock = 59_999;
  const result = await observeSyntheticStartup(() => {clock = 60_001; return 'late-task';}, 0, {now: () => clock});
  expect(result).toEqual({taskId: null, acceptedWithin20s: false, acceptedWithin60s: false, elapsedMs: 60_001});
});

it('bounds the final wait by the original deadline and rejects an overslept observation', async () => {
  let clock = 59_990;
  const read = vi.fn().mockReturnValueOnce(null).mockReturnValue('late-task');
  const pause = vi.fn(async (ms: number) => {clock += ms + 1;});
  const result = await observeSyntheticStartup(read, 0, {now: () => clock, pause});
  expect(pause).toHaveBeenCalledExactlyOnceWith(10);
  expect(result.acceptedWithin60s).toBe(false);
  expect(result.taskId).toBeNull();
});

it('keeps time spent in Send and the performance observation inside the same total budget', async () => {
  let clock = 20_001;
  const read = vi.fn().mockReturnValueOnce(null).mockReturnValue('fixture-task');
  const pause = vi.fn(async () => {clock = 60_000;});
  const result = await observeSyntheticStartup(read, 0, {now: () => clock, pause});
  expect(result).toEqual({taskId: 'fixture-task', acceptedWithin20s: false, acceptedWithin60s: true, elapsedMs: 60_000});
  expect(pause).toHaveBeenCalledExactlyOnceWith(50);
});

it('fails an absent Task at the deadline without scheduling another wait', async () => {
  const pause = vi.fn();
  expect(await observeSyntheticStartup(() => null, 100, {now: () => 60_100, pause})).toEqual({
    taskId: null, acceptedWithin20s: false, acceptedWithin60s: false, elapsedMs: 60_000,
  });
  expect(pause).not.toHaveBeenCalled();
});
