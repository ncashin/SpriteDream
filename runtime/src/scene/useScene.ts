import { useSyncExternalStore } from "react";
import { getScene } from "./scene";

export function useScene() {
  const scene = getScene();

  const subscribe = (callback: () => void) => {
    return scene.subscribe(() => callback());
  };

  const getSnapshot = () => getScene();

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}