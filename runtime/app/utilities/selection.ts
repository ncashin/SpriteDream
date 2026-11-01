import type { SceneNode } from "./scene.ts";

export type Selection = {
  selected: Set<SceneNode>;
  selectObject(object: SceneNode): void;
  deselectObject(object: SceneNode): void;
  selectObjects(objects: Iterable<SceneNode>): void;
};

export function currySelection(): Selection {
  const selected = new Set<SceneNode>();
  return {
    selected,
    selectObject(object) {
      selected.add(object);
    },
    deselectObject(object) {
      selected.delete(object);
    },
    selectObjects(objects) {
      selected.clear();
      for (const object of objects) selected.add(object);
    },
  };
}
