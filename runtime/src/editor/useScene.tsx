import { useContext, useRef, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import type { Scene, SceneAPI } from "../scene";
import { SceneContext } from "./SceneProvider";

export default function useScene<T = SceneAPI>(selector?: (scene: Scene) => T) {
  const scene = useContext(SceneContext);

  invariant(scene, "useScene must be used within SceneProvider");

  const selected = useRef(
    selector
      ? scene.select(selector)
      : {
          value: scene as T,
          dependencies: [],
        },
  );

  return useSyncExternalStore(
    (listener) =>
      scene.subscribe(() => {
        if (selector) {
          selected.current = scene.select(selector);
        }

        listener();
      }, selected.current.dependencies),

    () => selected.current.value,
  );
}
