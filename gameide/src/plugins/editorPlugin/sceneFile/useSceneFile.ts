import { useCallback } from "react";
import { GameIDEMode, getMode, setMode } from "../../../lifecycle/mode.js";
import { useSceneFileStore } from "./sceneFileStore.js";

export function useSceneFile() {
  const activeScenePath = useSceneFileStore((state) => state.activeScenePath);
  const scenes = useSceneFileStore((state) => state.scenes);
  const dirty = useSceneFileStore((state) => state.dirty);
  const saving = useSceneFileStore((state) => state.saving);
  const setActiveScenePath = useSceneFileStore((state) => state.setActiveScenePath);
  const requestSave = useSceneFileStore((state) => state.requestSave);

  const switchScene = useCallback(
    (relativePath: string) => {
      if (!relativePath || relativePath === activeScenePath) return;

      if (dirty) {
        const discard = window.confirm(
          "Discard unsaved changes and switch scene?",
        );
        if (!discard) return;
      }

      if (getMode() === GameIDEMode.Game) {
        setMode(GameIDEMode.Editor);
      }

      setActiveScenePath(relativePath);
    },
    [activeScenePath, dirty, setActiveScenePath],
  );

  return {
    scenes,
    activeScenePath,
    dirty,
    saving,
    switchScene,
    save: requestSave,
  };
}
