import { useContext, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import { SceneContext } from "./SceneProvider";
import type { Scene } from "./scene";

export default function useSceneObject<T = Scene>(
  selector?: (scene: Scene) => T,
) {
  const scene = useContext(SceneContext);
  invariant(scene, "useScene must be used within a SceneProvider");

  return useSyncExternalStore(scene.subscribe, () =>
    selector ? selector(scene.sceneObject) : scene.sceneObject,
  );
}
