import { useContext, useRef, useSyncExternalStore } from "react";
import invariant from "tiny-invariant";
import { SceneContext } from "./SceneProvider";
import type { Scene } from "../scene";

export default function useScene<T = Scene>(
  selector?: (scene: Scene) => T,
) {
  const scene = useContext(SceneContext);

  invariant(
    scene,
    "useScene must be used within SceneProvider",
  );

  const selected = useRef(
    selector
      ? scene.select(selector)
      : {
          value: scene.object as T,
          dependencies: [],
        },
  );


  return useSyncExternalStore(
    (listener) =>
      scene.subscribe(
        listener,
        selected.current.dependencies,
      ),

    () => selected.current.value,
  );
}