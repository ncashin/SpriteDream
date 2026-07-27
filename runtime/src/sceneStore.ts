import type { SerializableObject } from "./scene";

export class SceneStore {
  readonly scene: SerializableObject;

  private version = 0;
  private listeners = new Set<() => void>();

  constructor(scene: SerializableObject) {
    this.scene = scene;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.version;

  tick() {
    this.version++;

    for (const listener of this.listeners) {
      listener();
    }
  }
}
