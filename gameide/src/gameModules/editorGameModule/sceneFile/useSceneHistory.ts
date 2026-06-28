import { useSceneHistoryStore } from "./sceneHistoryStore.js";

export function useSceneHistory() {
  const canUndo = useSceneHistoryStore((state) => state.canUndo);
  const canRedo = useSceneHistoryStore((state) => state.canRedo);
  const undo = useSceneHistoryStore((state) => state.undo);
  const redo = useSceneHistoryStore((state) => state.redo);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
  };
}
