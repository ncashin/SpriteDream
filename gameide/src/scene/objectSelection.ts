import { invalidateExternalSceneSnapshot } from "./sceneExternalStore.js";
import { GameObject } from "./scene.js";

export let selectedObject: GameObject | null = null;

export function selectObject(object: GameObject): void {
  selectedObject = object;
  invalidateExternalSceneSnapshot();
}

export function deselectObject(): void {
  selectedObject = null;
  invalidateExternalSceneSnapshot();
}
