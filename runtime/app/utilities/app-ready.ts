let pending = 0;
let releaseAll = () => {};
let ready = Promise.resolve();

export function holdAppReady(): () => void {
  if (pending === 0) {
    ready = new Promise<void>((resolve) => {
      releaseAll = resolve;
    });
  }
  pending += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending -= 1;
    if (pending === 0) releaseAll();
  };
}

export function appReady(): Promise<void> {
  return ready;
}
