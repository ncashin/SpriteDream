import { useContext, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import { SceneContext } from "./SceneProvider";
import type { Scene, SceneAPI } from "../scene";

export default function useScene<T = SceneAPI>(selector?: (scene: Scene) => T) {
  const scene = useContext(SceneContext);
  invariant(scene, "useScene must be used within SceneProvider");

  return useSyncExternalStore(scene.subscribe, () =>
    selector ? selector(scene) : scene,
  );
}
