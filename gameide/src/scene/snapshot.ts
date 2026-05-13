import { invalidateUseSceneSnapshot } from "../hooks/useSceneSnapshot.js";
import { getRawScene, SceneObject, setScene } from "./scene.js";

let sceneSnapshot: SceneObject | undefined = undefined;

export function saveSceneSnapshot() {
  sceneSnapshot = structuredClone(getRawScene());
}

export function restoreSceneSnapshot() {
  if (!sceneSnapshot) return;
  setScene(sceneSnapshot);
}
