import { useSyncExternalStore } from "react";
import { getScene } from "./scene";

let cachedSnapshot: { scene: ReturnType<typeof getScene>; version: number } = {
  scene: getScene(),
  version: 0,
};

export function useScene() {
  const subscribe = (callback: () => void) => {
    return getScene().subscribe(() => {
      cachedSnapshot = {
        scene: getScene(),
        version: cachedSnapshot.version + 1,
      };
      callback();
    });
  };

  const getSnapshot = () => cachedSnapshot;

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snapshot.scene;
}