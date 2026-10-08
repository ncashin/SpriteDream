import type { GameObject } from "./actions/editor/object-tree.tsx";

export const selectedObjects: GameObject[] = [];

export function selectObject(object: GameObject) {
  if (!selectedObjects.includes(object)) selectedObjects.push(object);
}

export function deselectObject(object: GameObject) {
  let index = selectedObjects.indexOf(object);
  if (index !== -1) selectedObjects.splice(index, 1);
}

export function selectObjects(objects: readonly GameObject[]) {
  selectedObjects.length = 0;
  selectedObjects.push(...objects);
}
