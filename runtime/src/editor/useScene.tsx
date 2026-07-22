import { useContext, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import type { Scene } from "../scene";
import { SceneContext } from "./SceneProvider";

export default function useScene(): Scene;
export default function useScene<T>(selector?: (scene: Scene) => T): T | Scene {
  const store = useContext(SceneContext);

  invariant(store, "useScene must be used inside SceneProvider");

  useSyncExternalStore(store.subscribe, store.getSnapshot);

  return selector ? selector(store.scene) : store.scene;
}
