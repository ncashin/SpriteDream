/** LIFO stack of teardown callbacks for the current game bootstrap round. */

const callbacks: (() => void)[] = [];

/** Register a callback to run before the next plugin round / mode bootstrap. */
export function dispose(fn: () => void): void {
  callbacks.push(fn);
}

/** Runs all registered callbacks (last registered first), then clears the stack. */
export function runScheduledDisposes(): void {
  while (callbacks.length > 0) {
    const fn = callbacks.pop();
    fn?.();
  }
}
