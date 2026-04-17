import { useSyncExternalStore, useCallback, useMemo } from "react";
import { getScene, setScene } from "../scene/scene.js";
import type { SceneObject, SceneObjectData } from "../scene/scene.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "./useSceneSnapshot.js";

export { invalidateUseSceneSnapshot } from "./useSceneSnapshot.js";

export function useScene(): [SceneObject, (data: SceneObjectData | undefined) => void] {
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => subscribeUseSceneSnapshot(onStoreChange),
    [],
  );

  const snapshot = useSyncExternalStore(subscribe, getUseSceneSnapshot, getUseSceneSnapshot);
  void snapshot;

  const value = getScene();

  const setValue = useCallback((data: SceneObjectData | undefined) => setScene(data), []);

  return [value, setValue];
}
