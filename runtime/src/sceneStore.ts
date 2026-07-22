import type { Scene } from "./scene";

export class SceneStore {
  readonly scene: Scene;

  private version = 0;
  private listeners = new Set<() => void>();

  constructor(scene: Scene) {
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
