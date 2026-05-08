import { useMemo, useSyncExternalStore } from "react";
import { findSceneObjectPath } from "../scene/path.js";
import type { BaseSceneObject } from "../scene/scene.js";
import { getScene } from "../scene/scene.js";
import { selectedObject } from "../scene/objectSelection.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "./useSceneSnapshot.js";

export function useSelectedObject(): {
  selectedObject: BaseSceneObject | null;
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
    return findSceneObjectPath(getScene(), sel);
  }, [snapshot, sel]);

  return { selectedObject: sel, selectedPath };
}
