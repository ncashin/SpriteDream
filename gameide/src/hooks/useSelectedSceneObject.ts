import { useMemo, useSyncExternalStore } from "react";
import { GameObject } from "../scene/scene.js";
import { selectedObject, selectedObjectKey } from "../scene/objectSelection.js";
import {
  getExternalSceneSnapshot,
  subscribeExternalSceneSnapshot,
} from "../scene/sceneExternalStore.js";

export function useSelectedSceneObject(): {
  selectedObject: GameObject | null;
  selectedPath: PropertyKey[] | null;
} {
  const snapshot = useSyncExternalStore(
    subscribeExternalSceneSnapshot,
    getExternalSceneSnapshot,
    getExternalSceneSnapshot,
  );

  const selected = selectedObject;

  const selectedPath = useMemo(() => {
    void snapshot;
    return selectedObjectKey === null ? null : [selectedObjectKey];
  }, [snapshot]);

  return { selectedObject: selected, selectedPath };
}
