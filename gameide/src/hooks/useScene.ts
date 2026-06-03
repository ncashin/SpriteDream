import { useSyncExternalStore, useCallback } from "react";
import { getScene } from "../scene/scene.js";
import type { ScenePath } from "../scene/scene.js";
import { getValueAtPath, setValueAtPath } from "../scene/path.js";
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

export function useScene(path: ScenePath): [unknown, (value: unknown) => void] {
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

  return [value, setValue];
}
