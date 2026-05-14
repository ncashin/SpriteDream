import { useSyncExternalStore, useCallback, useMemo } from "react";
import { getScene, setScene } from "../scene/scene.js";
import type { SceneObject } from "../scene/scene.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "../scene/sceneExternalStore.js";

export function useScene(): [SceneObject, (data: SceneObject) => void] {
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => subscribeUseSceneSnapshot(onStoreChange),
    [],
  );

  const snapshot = useSyncExternalStore(subscribe, getUseSceneSnapshot, getUseSceneSnapshot);
  void snapshot;

  const value = getScene().get();

  const setValue = useCallback((data: SceneObject) => setScene(data), []);

  return [value, setValue];
}
