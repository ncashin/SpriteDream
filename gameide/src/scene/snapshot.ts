import { getRawScene, type SceneObject, setScene } from "./scene.js";

let sceneSnapshot: SceneObject | undefined = undefined;

export function saveSceneSnapshot() {
  sceneSnapshot = structuredClone(getRawScene());
}

export function restoreSceneSnapshot() {
  if (!sceneSnapshot) return;
  setScene(sceneSnapshot);
}

export function patchSceneSnapshot(data: SceneObject) {
  sceneSnapshot = structuredClone(data ?? {});
}
