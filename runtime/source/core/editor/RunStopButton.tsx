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
import { useGameContext, gameContextAtom, getDefaultStore } from "./useGameContext";

export function RunStopButton() {
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const gameContext = useGameContext();
  const ecs = gameContext?.ecs as any;

  const handleRunStop = async () => {
    const wasRunning = isUpdateEnabled();

    // Save the currently selected entity before running
    const selectedEntity = ecs?.getSelectedEntity?.() ?? null;

    if (wasRunning) {
      await restoreSceneFromSnapshot();
      setPersistenceEnabled(true);
      setEditorUpdateEnabled(true);
      setUpdateEnabled(false);
    } else {
      saveSceneSnapshot();
      setPersistenceEnabled(false);
      setEditorUpdateEnabled(false);
      setUpdateEnabled(true);
    }

    runGame();

    // Restore the selected entity after the new context is created
    // The context is updated synchronously during runGame, so we can access it immediately
    setTimeout(() => {
      const store = getDefaultStore();
      const newGameContext = store.get(gameContextAtom);
      const newEcs = newGameContext?.ecs as any;
      if (newEcs && selectedEntity !== null) {
        // Verify the entity still exists before selecting it
        const entityExists = newEcs.getEntity?.(selectedEntity) !== undefined;
        if (entityExists) {
          newEcs.selectEntity?.(selectedEntity);
        }
      }
    }, 0);

    setIsRunning(!wasRunning);
    runButtonRef.current?.blur();
  };

  return (
    <EditorButton ref={runButtonRef} onClick={handleRunStop}>
      {isRunning ? "Stop" : "Run"}
    </EditorButton>
  );
}

