import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "./Editor";

let editorRoot: Root | null = null;
let editorContainer: HTMLDivElement | null = null;

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.error("Could not find #editor element");
    return;
  }

  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  // Create container and root only once and reuse them
  if (!editorContainer || editorContainer.parentElement !== editor) {
    if (editorContainer) {
      editorContainer.remove();
    }
    editor.innerHTML = "";
    editorContainer = document.createElement("div");
    editor.appendChild(editorContainer);
    editorRoot = createRoot(editorContainer);
  }

  if (editorRoot) {
    editorRoot.render(React.createElement(Editor));
  }
}

export function getEditorRoot(): Root | null {
  return editorRoot;
}
