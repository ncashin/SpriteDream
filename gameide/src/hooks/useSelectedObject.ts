import { useMemo, useSyncExternalStore } from "react";
import { GameObject, getScene, SceneObject } from "../scene/scene.js";
import { selectedObject } from "../scene/objectSelection.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "../scene/sceneExternalStore.js";

function findSceneObjectPath(
  root: SceneObject,
  target: GameObject,
): PropertyKey[] | null {
  const visited = new WeakSet<object>();

  const walk = (node: unknown, path: PropertyKey[]): PropertyKey[] | null => {
    if (node === target) return path;
    if (!node || typeof node !== "object") return null;
    if (visited.has(node)) return null;
    visited.add(node);
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const found = walk(record[key], path.concat(key));
      if (found !== null) return found;
    }
    return null;
  };

  return walk(root, []);
}

export function useSelectedObject(): {
  selectedObject: GameObject | null;
  selectedPath: PropertyKey[] | null;
} {
  const snapshot = useSyncExternalStore(
    subscribeUseSceneSnapshot,
    getUseSceneSnapshot,
    getUseSceneSnapshot,
  );

  const sel = selectedObject;

  const selectedPath = useMemo(() => {
    void snapshot;
    if (!sel) return null;
    return findSceneObjectPath(getScene().get(), sel);
  }, [snapshot, sel]);

  return { selectedObject: sel, selectedPath };
}
