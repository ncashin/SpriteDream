import { invalidateUseSceneSnapshot } from "./sceneExternalStore.js";
import { GameObject } from "./scene.js";

export let selectedObject: GameObject | null = null;

export function selectObject(object: GameObject): void {
  selectedObject = object;
  invalidateUseSceneSnapshot();
}

export function deselectObject(): void {
  selectedObject = null;
  invalidateUseSceneSnapshot();
}
