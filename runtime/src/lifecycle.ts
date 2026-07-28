export const curryLifecycle = () => {
  const updateListeners = new Set<(deltaTime: number) => void>();

  let running = false;
  let frameIdentifier: number;
  let lastTime = performance.now();

  const loop = async (time: number) => {
    if (!running) return;

    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    for (const listener of updateListeners) {
      await listener(deltaTime);
    }

    frameIdentifier = requestAnimationFrame(loop);
  };

  return {
    onUpdate(listener: (deltaTime: number) => void | Promise<void>) {
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
      if (!frameIdentifier) return;
      running = false;
      cancelAnimationFrame(frameIdentifier);
    },
  };
};
