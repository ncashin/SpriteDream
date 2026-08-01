export type Update = {
  scope?: string;
  callback: (deltaTime: number) => void | Promise<void>;
};

export type Dispose = {
  scope?: string;
  callback: () => void | Promise<void>;
};

export const curryLifecycle = () => {
  let scope: string;
  let updateListeners: Update[] = [];

  let disposeListeners: Dispose[] = [];

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
      updateListeners.push({ scope, callback });

      const index = updateListeners.length - 1;

      return () => {
        updateListeners.splice(index, 1);
      };
    },

    onDispose(callback: () => void | Promise<void>) {
      disposeListeners.push({ scope, callback });

      const index = disposeListeners.length - 1;

      return () => {
        disposeListeners.splice(index, 1);
      };
    },

    setScope(newScope: string) {
      scope = newScope;
    },
    async cleanupCallbacksByScope(scopeRemoved: string) {
      updateListeners = updateListeners.filter((listener) => listener.scope !== scopeRemoved);

      const listenersToDispose = disposeListeners.filter(
        (listener) => listener.scope === scopeRemoved,
      );

      for (const { callback } of listenersToDispose) {
        await callback();
      }

      disposeListeners = disposeListeners.filter((listener) => listener.scope !== scopeRemoved);
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
