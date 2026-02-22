import { useSyncExternalStore } from "react";
import { getScene } from "./scene";

export function useSceneStore() {
  const scene = getScene();

  const subscribe = (callback: () => void) => {
    return scene.onQueryChange({}, callback);
  };

  const getSnapshot = () => getScene();

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}