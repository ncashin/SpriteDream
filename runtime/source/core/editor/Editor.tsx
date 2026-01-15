import { useState, useRef } from "react";
import { EditorButton } from "./EditorButton";
import { SceneDataModal } from "./SceneDataModal";
import {
  setEditorEnabled,
  setUpdateEnabled,
  isUpdateEnabled,
} from "../gameloop";
import {
  setPersistenceEnabled,
  saveSceneSnapshot,
  restoreSceneFromSnapshot,
} from "../scene/scene";
import { initializeGame } from "../runtimeWrapper";

export function Editor() {
  const [isSceneDataModalOpen, setIsSceneDataModalOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(isUpdateEnabled());
  const runButtonRef = useRef<HTMLButtonElement>(null);

  useState(() => {
    setIsRunning(isUpdateEnabled());
  });

  const handleRunStop = async () => {
    const wasRunning = isUpdateEnabled();

    if (wasRunning) {
      await restoreSceneFromSnapshot();
      setPersistenceEnabled(true);

      setEditorEnabled(true);
      setUpdateEnabled(false);
    } else {
      saveSceneSnapshot();
      setPersistenceEnabled(false);

      setEditorEnabled(false);
      setUpdateEnabled(true);
    }

    initializeGame();
    setIsRunning(!wasRunning);
    runButtonRef.current?.blur();
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "0.5rem",
        right: "0.5rem",
        zIndex: 10000,
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
      }}
    >
      <EditorButton onClick={() => setIsSceneDataModalOpen(true)}>
        Scene Data
      </EditorButton>
      <EditorButton ref={runButtonRef} onClick={handleRunStop}>
        {isRunning ? "Stop" : "Run"}
      </EditorButton>
      <SceneDataModal
        isOpen={isSceneDataModalOpen}
        onClose={() => setIsSceneDataModalOpen(false)}
      />
    </div>
  );
}
