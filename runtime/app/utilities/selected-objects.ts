import type { GameObject } from "../actions/editor/object-tree.tsx";

export const selectedObjects = new Set<GameObject>();

export function selectObject(object: GameObject) {
  selectedObjects.add(object);
}

export function deselectObject(object: GameObject) {
  selectedObjects.delete(object);
}

export function selectObjects(objects: Iterable<GameObject>) {
  selectedObjects.clear();
  for (const object of objects) selectedObjects.add(object);
}
