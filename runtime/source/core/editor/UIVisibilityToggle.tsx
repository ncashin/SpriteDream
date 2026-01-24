import { useState, useEffect } from "react";
import { EditorButton } from "./EditorButton";
import {
  isGameUIVisible,
  isEditorUIVisible,
  setGameUIVisible,
  setEditorUIVisible,
  subscribeToVisibilityChanges,
} from "./uiVisibility";

export function UIVisibilityToggle() {
  const [gameUIVisible, setGameUIVisibleState] = useState(isGameUIVisible());
  const [editorUIVisible, setEditorUIVisibleState] = useState(isEditorUIVisible());

  useEffect(() => {
    const unsubscribe = subscribeToVisibilityChanges(() => {
      setGameUIVisibleState(isGameUIVisible());
      setEditorUIVisibleState(isEditorUIVisible());
    });
    return unsubscribe;
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: "8px",
        right: "8px",
        display: "flex",
        gap: "4px",
        zIndex: 10000,
      }}
    >
      <EditorButton onClick={() => setGameUIVisible(!gameUIVisible)}>
        {gameUIVisible ? "Hide Game UI" : "Show Game UI"}
      </EditorButton>
      <EditorButton onClick={() => setEditorUIVisible(!editorUIVisible)}>
        {editorUIVisible ? "Hide Editor UI" : "Show Editor UI"}
      </EditorButton>
    </div>
  );
}

