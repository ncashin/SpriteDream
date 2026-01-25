import { useState, useRef } from "react";
import { EditorButton } from "./EditorButton";
import {
  setEditorUpdateEnabled,
  setUpdateEnabled,
  isUpdateEnabled,
} from "../gameloop";
import {
  setPersistenceEnabled,
  saveSceneSnapshot,
  restoreSceneFromSnapshot,
} from "../scene/scene";
import { runGame } from "../runtimeWrapper";
import { getDefaultStore } from "jotai";
import { gameContextAtom } from "./useGameContext";

export function RunStopButton() {
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const runButtonRef = useRef<HTMLButtonElement>(null);

  const handleRunStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const wasRunning = isUpdateEnabled();

    const gameContext = getDefaultStore().get(gameContextAtom);
    const ecs = gameContext?.ecs;

    // Save the selected entity before snapshot operations
    const selectedEntity = ecs?.getSelectedEntity?.() ?? null;

    if (wasRunning) {
      await restoreSceneFromSnapshot();
      setPersistenceEnabled(true);
      setEditorUpdateEnabled(true);
      setUpdateEnabled(false);

      // Restore the selected entity after restoring snapshot
      if (ecs && selectedEntity !== null) {
        // Verify the entity still exists before selecting it
        const allEntities = Object.keys(ecs.ecsInstance?.entities || {});
        if (allEntities.includes(selectedEntity)) {
          ecs.selectEntity(selectedEntity);
        }
      }
    } else {
      saveSceneSnapshot();
      setPersistenceEnabled(false);
      setEditorUpdateEnabled(false);
      setUpdateEnabled(true);
    }

    runGame();
    setIsRunning(!wasRunning);
    runButtonRef.current?.blur();
  };

  return (
    <EditorButton ref={runButtonRef} onClick={handleRunStop}>
      {isRunning ? "Stop" : "Run"}
    </EditorButton>
  );
}

