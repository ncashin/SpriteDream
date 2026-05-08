import type { BaseSceneObject } from "./scene.js";
import { invalidateUseSceneSnapshot } from "../hooks/useSceneSnapshot.js";

export let selectedObject: BaseSceneObject | null = null;

export function selectObject(object: BaseSceneObject): void {
  selectedObject = object;
  invalidateUseSceneSnapshot();
}

export function deselectObject(): void {
  selectedObject = null;
  invalidateUseSceneSnapshot();
}
