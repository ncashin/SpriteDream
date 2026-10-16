import type { SceneNode } from "./scene.ts";

export const selectedObjects = new Set<SceneNode>();

export function selectObject(object: SceneNode) {
  selectedObjects.add(object);
}

export function deselectObject(object: SceneNode) {
  selectedObjects.delete(object);
}

export function selectObjects(objects: Iterable<SceneNode>) {
  selectedObjects.clear();
  for (const object of objects) selectedObjects.add(object);
}
