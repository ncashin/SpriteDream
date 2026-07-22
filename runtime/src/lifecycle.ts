export const curryLifecycle = () => {
  const updateListeners = new Set<(deltaTime: number) => void>();

  let running = false;
  let frameIdentifier = 0;
  let lastTime = performance.now();

  const loop = (time: number) => {
    if (!running) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    for (const listener of updateListeners) {
      listener(deltaTime);
    }

    frameIdentifier = requestAnimationFrame(loop);
  };

  return {
    onUpdate(listener: (deltaTime: number) => void) {
      updateListeners.add(listener);

      return () => {
        updateListeners.delete(listener);
      };
    },

    start() {
      if (running) return;

      running = true;
      lastTime = performance.now();
      frameIdentifier = requestAnimationFrame(loop);
    },

    stop() {
      running = false;
      cancelAnimationFrame(frameIdentifier);
    },
  };
};
