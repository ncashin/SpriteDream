import { useContext, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import type { SerializableObject } from "../scene";
import { SceneContext } from "./SceneProvider";

export default function useScene(): SerializableObject;
export default function useScene<T>(selector?: (scene: SerializableObject) => T): T | SerializableObject {
  const store = useContext(SceneContext);

  invariant(store, "useScene must be used inside SceneProvider");

  useSyncExternalStore(store.subscribe, store.getSnapshot);

  return selector ? selector(store.scene) : store.scene;
}
