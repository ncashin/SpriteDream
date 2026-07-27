import { useSyncExternalStore } from "react";
import type { SerializableObject } from "../scene";
import useGameContext from "./useGameContext";

export default function useScene(): SerializableObject {
  const { sceneStore } = useGameContext();
  useSyncExternalStore(sceneStore.subscribe, sceneStore.getSnapshot);
  return sceneStore.scene;
}
