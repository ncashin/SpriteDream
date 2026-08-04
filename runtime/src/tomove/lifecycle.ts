export type Update = {
  callback: (deltaTime: number) => void | Promise<void>;
};

export const curryLifecycle = () => {
  let updateListeners: Update[] = [];

  let frameIdentifier: number;
  let lastTime = performance.now();

  const loop = async (time: number) => {
    const deltaTime = (time - lastTime) / 1000;
    lastTime = time;

    for (const { callback } of updateListeners) {
      await callback(deltaTime);
    }

    frameIdentifier = requestAnimationFrame(loop);
  };

  return {
    onUpdate(callback: (deltaTime: number) => void | Promise<void>) {
      updateListeners.push({ callback });

      const index = updateListeners.length - 1;

      return () => {
        updateListeners.splice(index, 1);
      };
    },

    start() {
      if (frameIdentifier) return;

      lastTime = performance.now();
      frameIdentifier = requestAnimationFrame(loop);
    },

    stop() {
      if (!frameIdentifier) return;
      cancelAnimationFrame(frameIdentifier);
    },
  };
};

export type LifecycleAPI = ReturnType<typeof curryLifecycle>;
