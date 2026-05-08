import { useMemo, useSyncExternalStore } from "react";
import { findSceneObjectPath } from "../scene/path.js";
import type { BaseSceneObject } from "../scene/scene.js";
import { getScene } from "../scene/scene.js";
import { selectedObject } from "../scene/objectSelection.js";
import {
  getUseSceneSnapshot,
  subscribeUseSceneSnapshot,
} from "./useSceneSnapshot.js";

/** Scene-tree selection: viewport picks set {@link selectedObject}; path is resolved against the live scene. */
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
