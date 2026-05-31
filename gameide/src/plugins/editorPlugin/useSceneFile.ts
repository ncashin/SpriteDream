import { useCallback } from "react";
import { GameIDEMode, getMode, setMode } from "../../lifecycle/mode.js";
import { useSceneFileStore } from "../../scene/sceneFileStore.js";

export function useSceneFile() {
  const activeScenePath = useSceneFileStore((state) => state.activeScenePath);
  const scenes = useSceneFileStore((state) => state.scenes);
  const setActiveScenePath = useSceneFileStore(
    (state) => state.setActiveScenePath,
  );

  const switchScene = useCallback(
    (relativePath: string) => {
      if (!relativePath || relativePath === activeScenePath) return;

      if (getMode() === GameIDEMode.Game) {
        setMode(GameIDEMode.Editor);
      }

      setActiveScenePath(relativePath);
    },
    [activeScenePath, setActiveScenePath],
  );

  return {
    scenes,
    activeScenePath,
    switchScene,
  };
}
