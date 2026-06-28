import { useCallback } from "react";
import { GameIDEMode, getMode, setMode } from "../../../lifecycle/mode.js";
import { useSceneFileStore } from "./sceneFileStore.js";

export function useSceneFile() {
  const activeScenePath = useSceneFileStore((state) => state.activeScenePath);
  const isUntitled = useSceneFileStore((state) => state.isUntitled);
  const scenes = useSceneFileStore((state) => state.scenes);
  const dirty = useSceneFileStore((state) => state.dirty);
  const switchSceneAction = useSceneFileStore((state) => state.switchScene);
  const save = useSceneFileStore((state) => state.save);
  const createScene = useSceneFileStore((state) => state.createScene);

  const switchScene = useCallback(
    async (relativePath: string) => {
      if (!relativePath) return;
      if (!isUntitled && relativePath === activeScenePath) return;

      if (dirty) {
        const shouldDiscardChanges = window.confirm(
          "Discard unsaved changes and switch scene?",
        );
        if (!shouldDiscardChanges) return;
      }

      if (getMode() === GameIDEMode.Game) {
        setMode(GameIDEMode.Editor);
      }

      await switchSceneAction(relativePath);
    },
    [activeScenePath, dirty, isUntitled, switchSceneAction],
  );

  return {
    scenes,
    activeScenePath,
    isUntitled,
    dirty,
    switchScene,
    createScene,
    save,
  };
}
