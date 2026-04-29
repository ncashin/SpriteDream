const callbacks: (() => void)[] = [];

export function dispose(fn: () => void): void {
  callbacks.push(fn);
}

export function runScheduledDisposes(): void {
  while (callbacks.length > 0) {
    const callback = callbacks.pop();
    callback?.();
  }
}
