import { useSyncExternalStore } from "react";
import useGameContext from "./useGameContext";

export default function useSelectedObjects() {
  const { selectedObjectsStore } = useGameContext();
  const selectedObjects = useSyncExternalStore(
    selectedObjectsStore.subscribe,
    selectedObjectsStore.getSnapshot,
  );

  return { ...selectedObjectsStore, selectedObjects };
}
