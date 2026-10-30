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
