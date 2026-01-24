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

export function RunStopButton() {
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const runButtonRef = useRef<HTMLButtonElement>(null);

  const handleRunStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const wasRunning = isUpdateEnabled();

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
    setIsRunning(!wasRunning);
    runButtonRef.current?.blur();
  };

  return (
    <EditorButton ref={runButtonRef} onClick={handleRunStop}>
      {isRunning ? "Stop" : "Run"}
    </EditorButton>
  );
}

