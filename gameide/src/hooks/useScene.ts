import { useSyncExternalStore, useCallback } from "react";
import { getScene } from "../scene/scene.js";
import type { ScenePath } from "../scene/scene.js";
import {
  deleteValueAtPath,
  getRecordAtPath,
  getValueAtPath,
  renameKeyAtPath,
  setValueAtPath,
  uniqueChildKey,
} from "../scene/path.js";
import {
  getExternalSceneSnapshot,
  subscribeExternalSceneSnapshot,
} from "../scene/sceneExternalStore.js";

function pathKey(path: ScenePath): string {
  return path.map(String).join("\0");
}

function pathFromKey(key: string): ScenePath {
  return key === "" ? [] : key.split("\0");
}

export function useScene(path: ScenePath): {
  value: unknown;
  setValue: (value: unknown) => void;
  deleteValue: () => void;
  renameKey: (newKey: PropertyKey) => boolean;
  addChild: (childValue: unknown) => void;
} {
  const key = pathKey(path);

  const snapshot = useSyncExternalStore(
    subscribeExternalSceneSnapshot,
    getExternalSceneSnapshot,
    getExternalSceneSnapshot,
  );
  void snapshot;

  const root = getScene().get();
  const value = path.length === 0 ? root : getValueAtPath(root, path);

  const setValue = useCallback((next: unknown) => {
    setValueAtPath(getScene().get(), pathFromKey(key), next);
  }, [key]);

  const deleteValue = useCallback(() => {
    deleteValueAtPath(getScene().get(), pathFromKey(key));
  }, [key]);

  const renameKey = useCallback((newKey: PropertyKey) => {
    return renameKeyAtPath(getScene().get(), pathFromKey(key), newKey);
  }, [key]);

  const addChild = useCallback((childValue: unknown) => {
    const root = getScene().get() as Record<PropertyKey, unknown>;
    const parentPath = pathFromKey(key);
    const container =
      parentPath.length === 0 ? root : getRecordAtPath(root, parentPath);
    if (!container) return;

    const base =
      childValue !== null &&
      typeof childValue === "object" &&
      !Array.isArray(childValue)
        ? "object"
        : "property";
    container[uniqueChildKey(container, base)] = childValue;
  }, [key]);

  return { value, setValue, deleteValue, renameKey, addChild };
}
