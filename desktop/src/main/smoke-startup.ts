/** Observe UI acceptance against one origin, including time spent in Send.
 * A delayed timer or predicate must never turn a late observation into a pass.
 * Kept self-contained because the smoke probe runs it in the renderer world.
 */
export async function observeSyntheticStartup(
  readTaskId: () => string | null,
  began: number,
  {now = () => performance.now(), pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))}: {
    now?: () => number; pause?: (ms: number) => Promise<void>;
  } = {},
): Promise<{taskId: string | null; acceptedWithin20s: boolean; acceptedWithin60s: boolean; elapsedMs: number}> {
  for (;;) {
    const taskId = readTaskId();
    const elapsedMs = now() - began;
    const acceptedWithin60s = taskId !== null && elapsedMs <= 60_000;
    if (taskId !== null || elapsedMs >= 60_000) {
      return {taskId: acceptedWithin60s ? taskId : null,
        acceptedWithin20s: acceptedWithin60s && elapsedMs <= 20_000,
        acceptedWithin60s, elapsedMs};
    }
    await pause(Math.min(50, 60_000 - elapsedMs));
  }
}
