import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentType } from "react";
import { setGameContext, type GameContextType } from "./EditorContext";

let editorRoot: Root | null = null;
let editorContainer: HTMLDivElement | null = null;
let EditorComponent: ComponentType | null = null;

export function setEditorGameContext(context: GameContextType | null) {
  setGameContext(context);
  renderEditor();
}

export function initializeEditor(Editor?: ComponentType) {
  if (Editor) {
    EditorComponent = Editor;
  }

  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.error("Could not find #editor element");
    return;
  }

  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  if (!editorContainer || editorContainer.parentElement !== editor) {
    if (editorContainer) {
      editorContainer.remove();
    }
    editor.innerHTML = "";
    editorContainer = document.createElement("div");
    editorContainer.className = "editor-container";
    editor.appendChild(editorContainer);
    editorRoot = createRoot(editorContainer);
  }

  renderEditor();
}

function renderEditor() {
  if (editorRoot && EditorComponent) {
    editorRoot.render(React.createElement(EditorComponent));
  }
}

export function getEditorRoot(): Root | null {
  return editorRoot;
}