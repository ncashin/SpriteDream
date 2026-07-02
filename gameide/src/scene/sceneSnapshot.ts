import type { Scene, SceneObject } from "./scene.js";

export function createSceneSnapshot(scene: Scene) {
  let sceneSnapshot: SceneObject | undefined;

  return {
    save() {
      sceneSnapshot = structuredClone(scene.getRaw());
    },
    restore() {
      if (!sceneSnapshot) return;
      scene.replace(sceneSnapshot);
    },
  };
}
