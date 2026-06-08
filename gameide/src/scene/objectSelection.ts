import { invalidateExternalSceneSnapshot } from "./sceneExternalStore.js";
import { GameObject, getScene } from "./scene.js";

export let selectedObject: GameObject | null = null;
export let selectedObjectKey: PropertyKey | null = null;

function findTopLevelSceneKey(
  target: GameObject,
): PropertyKey | null {
  const live = getScene().get() as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(live)) {
    if (Reflect.get(live, key) === target) return key;
  }
  return null;
}

export function selectObject(object: GameObject): void {
  selectedObject = object;
  selectedObjectKey = findTopLevelSceneKey(object);
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

export function restoreSelectedObjectKey(key: PropertyKey | null): void {
  if (key === null) {
    deselectObject();
    return;
  }

  const nextSelected = Reflect.get(getScene().get(), key);
  if (
    nextSelected &&
    typeof nextSelected === "object" &&
    !Array.isArray(nextSelected)
  ) {
    selectObject(nextSelected as GameObject);
    return;
  }

  deselectObject();
}
