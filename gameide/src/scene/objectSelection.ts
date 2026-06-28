import { invalidateExternalSceneSnapshot } from "./sceneExternalStore.js";
import { GameObject, type Scene } from "./scene.js";

export let selectedObject: GameObject | null = null;
export let selectedObjectKey: PropertyKey | null = null;

function findTopLevelSceneKey(
  scene: Scene,
  target: GameObject,
): PropertyKey | null {
  const live = scene.get() as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(live)) {
    if (Reflect.get(live, key) === target) return key;
  }
  return null;
}

export function selectObject(scene: Scene, object: GameObject): void {
  selectedObject = object;
  selectedObjectKey = findTopLevelSceneKey(scene, object);
  invalidateExternalSceneSnapshot();
}

export function deselectObject(): void {
  selectedObject = null;
  selectedObjectKey = null;
  invalidateExternalSceneSnapshot();
}

export function getSelectedObjectKey(): PropertyKey | null {
  return selectedObjectKey;
}

export function restoreSelectedObjectKey(
  scene: Scene,
  key: PropertyKey | null,
): void {
  if (key === null) {
    deselectObject();
    return;
  }

  const nextSelected = Reflect.get(scene.get(), key);
  if (
    nextSelected &&
    typeof nextSelected === "object" &&
    !Array.isArray(nextSelected)
  ) {
    selectObject(scene, nextSelected as GameObject);
    return;
  }

  deselectObject();
}
