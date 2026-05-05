import { useSyncExternalStore, useCallback, useMemo } from "react";
import { getScene, setScene } from "../scene/scene.js";
import type { BaseSceneObject } from "../scene/scene.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "./useSceneSnapshot.js";

export { invalidateUseSceneSnapshot } from "./useSceneSnapshot.js";

export function useScene(): [BaseSceneObject, (data: BaseSceneObject) => void] {
  const subscribe = useMemo(
    () => (onStoreChange: () => void) => subscribeUseSceneSnapshot(onStoreChange),
    [],
  );

  const snapshot = useSyncExternalStore(subscribe, getUseSceneSnapshot, getUseSceneSnapshot);
  void snapshot;

  const value = getScene();

  const setValue = useCallback((data: BaseSceneObject) => setScene(data), []);

  return [value, setValue];
}
