import { invalidateUseSceneSnapshot } from "../hooks/useSceneSnapshot.js";
import type { BaseSceneObject } from "./scene.js";
import { sceneTarget } from "./scene.js";

let sceneSnapshot: BaseSceneObject | undefined = undefined;

export function saveSceneSnapshot() {
  sceneSnapshot = structuredClone(sceneTarget);
}

export function restoreSceneSnapshot() {
  if (!sceneSnapshot) return;
  const next = structuredClone(sceneSnapshot);
  for (const key of Object.keys(sceneTarget)) {
    delete sceneTarget[key];
  }
  Object.assign(sceneTarget, next);
  invalidateUseSceneSnapshot();
}
