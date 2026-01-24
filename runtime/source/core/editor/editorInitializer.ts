import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "./Editor";
import { setGameContext, type GameContextType } from "./EditorContext";

let editorRoot: Root | null = null;
let editorContainer: HTMLDivElement | null = null;
let isInitialized = false;

export function setEditorGameContext(context: GameContextType | null) {
  setGameContext(context);
  renderEditor();
}

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.error("Could not find #editor element");
    return;
  }

  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  // Only reinitialize if not already initialized or if container was removed
  if (!isInitialized || !editorContainer || editorContainer.parentElement !== editor) {
    if (editorContainer && editorContainer.parentElement) {
      editorContainer.remove();
    }
    editor.innerHTML = "";
    editorContainer = document.createElement("div");
    editorContainer.className = "editor-container";
    editor.appendChild(editorContainer);
    editorRoot = createRoot(editorContainer);
    isInitialized = true;
  }

  renderEditor();
}

function renderEditor() {
  if (editorRoot) {
    editorRoot.render(React.createElement(Editor));
  }
}

export function getEditorRoot(): Root | null {
  return editorRoot;
}
