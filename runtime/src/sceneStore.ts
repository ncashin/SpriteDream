import type { SerializableObject } from "./scene";

export type SceneStore = ReturnType<typeof createSceneStore>;

export function createSceneStore(scene: SerializableObject) {
  let version = 0;
  const listeners = new Set<() => void>();

  return {
    scene,

    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return version;
    },

    tick() {
      version++;

      for (const listener of listeners) {
        listener();
      }
    },
  };
}
