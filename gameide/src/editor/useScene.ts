import { useSyncExternalStore, useRef, useCallback, useMemo } from "react";
import {
  getScene,
  getSceneValueAtPath,
  onSceneChange,
  type SceneUpdate,
} from "../scene/scene.js";
import {
  appendKeyToPath,
  pathUpdateAffectsPath,
  setValueAtPathInObject,
} from "../scene/scenePath.js";

function createPathScopedSubscribe(
  pathRef: { current: PropertyKey[] }
): (onStoreChange: () => void) => () => void {
  return (onStoreChange) => {
    return onSceneChange((update: SceneUpdate) => {
      const changedPath = appendKeyToPath(update.path, update.key);
      if (pathUpdateAffectsPath(changedPath, pathRef.current)) {
        onStoreChange();
      }
    });
  };
}

export function useScene(path: PropertyKey[]): [unknown, (value: unknown) => void] {
  const pathRef = useRef<PropertyKey[]>([...path]);
  pathRef.current.length = 0;
  pathRef.current.push(...path);

  const getSnapshot = useCallback(() => getSceneValueAtPath(pathRef.current), []);

  const subscribe = useMemo(
    () => createPathScopedSubscribe(pathRef),
    []
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (value: unknown) =>
      setValueAtPathInObject(getScene() as Record<PropertyKey, unknown>, pathRef.current, value),
    []
  );

  return [value, setValue];
}
