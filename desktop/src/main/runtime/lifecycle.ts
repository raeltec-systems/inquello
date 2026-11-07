/** Serializes runtime ownership transitions, including the initial startup.
 * A failed transition must not poison later shutdown/recovery operations.
 * DataService owns the stopped interval: it alone schedules its restart after
 * the local-data operation completes. This queue does not auto-restart.
 */
export class RuntimeLifecycle {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(transition: () => Promise<T>): Promise<T> {
    const result = this.tail.then(transition, transition);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

// Pure startup guard: inspect environment names only, never credential values.
// Called before main registers readiness/cleanup callbacks.
export function controlledPaidLaunchRequested(environmentNames: readonly string[], argv: readonly string[]): boolean {
  const key = 'INQUELLO_FICTIONAL_PAID_SESSION';
  const matches = environmentNames.filter(name => name.toUpperCase() === key);
  if (matches.length === 0) return false;
  if (matches.length !== 1 || matches[0] !== key) throw new Error('Controlled fictional session environment name is ambiguous');
  if (argv.some(arg => arg === '--smoke' || arg.startsWith('--smoke-'))
      || environmentNames.some(name => /^INQUELLO_(?:SMOKE|QUOTA_FIXTURE|VISUAL_FIXTURE)(?:_|$)/i.test(name))) {
    throw new Error('Controlled fictional session cannot run smoke or recovery fixtures');
  }
  return true;
}
