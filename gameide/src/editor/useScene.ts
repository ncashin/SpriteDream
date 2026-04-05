import { useSyncExternalStore, useRef, useCallback, useMemo } from "react";
import {
  getScene,
  queryScene,
  onSceneChange,
  type SceneUpdate,
} from "../scene/scene.js";

function setValueAtPath(path: PropertyKey[], value: unknown): void {
  const s = getScene() as Record<PropertyKey, unknown>;
  if (path.length === 0) return;
  let cur: Record<PropertyKey, unknown> = s;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    let next = cur[key];
    if (next === undefined || next === null || typeof next !== "object") {
      next = {};
      cur[key] = next;
    }
    cur = next as Record<PropertyKey, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

function pathEquals(firstPath: PropertyKey[], secondPath: PropertyKey[]): boolean {
  if (firstPath.length !== secondPath.length) return false;
  return firstPath.every((key, index) => key === secondPath[index]);
}

function pathIsPrefix(prefix: PropertyKey[], fullPath: PropertyKey[]): boolean {
  if (prefix.length > fullPath.length) return false;
  return prefix.every((key, index) => key === fullPath[index]);
}

function updateAffectsPath(changedPath: PropertyKey[], path: PropertyKey[]): boolean {
  return (
    pathEquals(changedPath, path) ||
    pathIsPrefix(changedPath, path) ||
    pathIsPrefix(path, changedPath)
  );
}

function createPathScopedSubscribe(
  pathRef: { current: PropertyKey[] }
): (onStoreChange: () => void) => () => void {
  return (onStoreChange) => {
    return onSceneChange((update: SceneUpdate) => {
      const changedPath = update.path.concat(update.key);
      if (updateAffectsPath(changedPath, pathRef.current)) {
        onStoreChange();
      }
    });
  };
}

export function useScene(path: PropertyKey[]): [unknown, (value: unknown) => void] {
  const pathRef = useRef<PropertyKey[]>([...path]);
  pathRef.current.length = 0;
  pathRef.current.push(...path);

  const getSnapshot = useCallback(() => queryScene(pathRef.current), []);

  const subscribe = useMemo(
    () => createPathScopedSubscribe(pathRef),
    []
  );

  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setValue = useCallback(
    (value: unknown) => setValueAtPath(pathRef.current, value),
    []
  );

  return [value, setValue];
}
