import {
  setEditorEnabled,
  setUpdateEnabled,
  isUpdateEnabled,
} from "../gameloop";
import {
  setPersistenceEnabled,
  saveSceneSnapshot,
  restoreSceneFromSnapshot,
  getScene,
} from "../scene/scene";
import { initializeGame } from "../../runtimeWrapper";

// Editor state that persists across reinitializations
let editorState: {
  sceneSnapshot: any;
  sceneDataModal: HTMLDivElement | null;
  sceneDataTextarea: HTMLTextAreaElement | null;
  refreshInterval: ReturnType<typeof setInterval> | null;
} = {
  sceneSnapshot: null,
  sceneDataModal: null,
  sceneDataTextarea: null,
  refreshInterval: null,
};

function cleanupEditorState() {
  // Close modal if open
  if (editorState.sceneDataModal) {
    const escapeHandler = (editorState.sceneDataModal as any)?._escapeHandler;
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
    }
    editorState.sceneDataModal.remove();
    editorState.sceneDataModal = null;
    editorState.sceneDataTextarea = null;
  }

  // Clear refresh interval
  if (editorState.refreshInterval) {
    clearInterval(editorState.refreshInterval);
    editorState.refreshInterval = null;
  }

  // Don't clear scene snapshot here - it needs to persist across reinitializations
  // The snapshot is only cleared after it's been used to restore the scene
}

function createStyledButton(text: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = text;
  button.style.padding = "0.25rem 0.75rem";
  button.style.fontSize = "0.8125rem";
  button.style.fontWeight = "400";
  button.style.borderRadius = "2px";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.transition = "background-color 0.1s ease-out";
  button.style.backgroundColor = "transparent";
  button.style.color =
    "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))";
  button.style.fontFamily =
    'var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)';
  button.style.outline = "none";
  button.style.boxSizing = "border-box";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.minHeight = "22px";
  button.style.lineHeight = "1.4em";

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "transparent";
  });

  button.addEventListener("mousedown", () => {
    button.style.backgroundColor =
      "var(--vscode-button-activeBackground, rgba(255, 255, 255, 0.15))";
  });

  button.addEventListener("mouseup", () => {
    button.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  button.addEventListener("focus", () => {
    button.style.outline = "1px solid var(--vscode-focusBorder, #007acc)";
    button.style.outlineOffset = "-1px";
  });

  button.addEventListener("blur", () => {
    button.style.outline = "none";
  });

  return button;
}

function createSceneDataModal(): HTMLDivElement {
  const modal = document.createElement("div");
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100vw";
  modal.style.height = "100vh";
  modal.style.backgroundColor = "var(--vscode-editor-background, #1e1e1e)";
  modal.style.zIndex = "20000";
  modal.style.display = "flex";
  modal.style.flexDirection = "column";
  modal.style.fontFamily =
    'var(--vscode-font-family, "Consolas", "Courier New", monospace)';

  // Create header with title and close button
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "0.75rem 1rem";
  header.style.borderBottom =
    "1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2))";
  header.style.backgroundColor =
    "var(--vscode-titleBar-activeBackground, #2d2d30)";

  const title = document.createElement("div");
  title.textContent = "Scene Data";
  title.style.fontSize = "0.8125rem";
  title.style.fontWeight = "600";
  title.style.color = "var(--vscode-foreground, #cccccc)";

  const closeButton = document.createElement("button");
  closeButton.textContent = "✕";
  closeButton.style.background = "transparent";
  closeButton.style.border = "none";
  closeButton.style.color = "var(--vscode-foreground, #cccccc)";
  closeButton.style.cursor = "pointer";
  closeButton.style.fontSize = "1.2rem";
  closeButton.style.padding = "0.25rem 0.5rem";
  closeButton.style.borderRadius = "2px";
  closeButton.style.transition = "background-color 0.1s ease-out";

  closeButton.addEventListener("mouseenter", () => {
    closeButton.style.backgroundColor =
      "var(--vscode-button-hoverBackground, rgba(255, 255, 255, 0.1))";
  });

  closeButton.addEventListener("mouseleave", () => {
    closeButton.style.backgroundColor = "transparent";
  });

  closeButton.addEventListener("click", () => {
    hideSceneDataModal();
  });

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create textarea for scene data
  const textarea = document.createElement("textarea");
  textarea.style.flex = "1";
  textarea.style.width = "100%";
  textarea.style.padding = "1rem";
  textarea.style.margin = "0";
  textarea.style.border = "none";
  textarea.style.outline = "none";
  textarea.style.backgroundColor = "var(--vscode-editor-background, #1e1e1e)";
  textarea.style.color = "var(--vscode-editor-foreground, #d4d4d4)";
  textarea.style.fontSize = "0.875rem";
  textarea.style.fontFamily =
    'var(--vscode-editor-font-family, "Consolas", "Courier New", monospace)';
  textarea.style.lineHeight = "1.5";
  textarea.style.resize = "none";
  textarea.style.overflow = "auto";
  textarea.readOnly = true;
  textarea.spellcheck = false;

  modal.appendChild(header);
  modal.appendChild(textarea);

  // Close on Escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && modal.parentElement) {
      hideSceneDataModal();
    }
  };
  document.addEventListener("keydown", handleEscape);

  // Store reference to cleanup
  (modal as any)._escapeHandler = handleEscape;

  return modal;
}

function updateSceneDataContent() {
  if (!editorState.sceneDataTextarea) return;

  try {
    const scene = getScene();
    const sceneJson = JSON.stringify(scene, null, 2);
    editorState.sceneDataTextarea.value = sceneJson;
  } catch (error) {
    editorState.sceneDataTextarea.value = `Error displaying scene data: ${error}`;
  }
}

function showSceneDataModal() {
  if (editorState.sceneDataModal) {
    // Already open, just update content
    updateSceneDataContent();
    return;
  }

  editorState.sceneDataModal = createSceneDataModal();
  editorState.sceneDataTextarea =
    editorState.sceneDataModal.querySelector("textarea")!;
  document.body.appendChild(editorState.sceneDataModal);

  // Update content immediately
  updateSceneDataContent();

  // Refresh content periodically to keep it up to date
  editorState.refreshInterval = setInterval(() => {
    updateSceneDataContent();
  }, 500);
}

function hideSceneDataModal() {
  if (editorState.sceneDataModal) {
    // Remove escape handler
    const escapeHandler = (editorState.sceneDataModal as any)?._escapeHandler;
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
    }

    editorState.sceneDataModal.remove();
    editorState.sceneDataModal = null;
    editorState.sceneDataTextarea = null;
  }

  if (editorState.refreshInterval) {
    clearInterval(editorState.refreshInterval);
    editorState.refreshInterval = null;
  }
}

export function initializeEditor() {
  const editor = document.querySelector<HTMLDivElement>("#editor");
  if (!editor) {
    console.error("Could not find #editor element");
    return;
  }

  // Clean up any existing state before reinitializing
  cleanupEditorState();

  // Clear editor content
  editor.innerHTML = "";

  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.position = "absolute";
  buttonContainer.style.top = "0.5rem";
  buttonContainer.style.right = "0.5rem";
  buttonContainer.style.zIndex = "10000";
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "0.5rem";
  buttonContainer.style.alignItems = "center";

  // Create run button
  const runButton = createStyledButton("Run");
  const updateButtonText = () => {
    runButton.textContent = isUpdateEnabled() ? "Stop" : "Run";
  };
  updateButtonText();

  runButton.addEventListener("click", async () => {
    const isRunning = isUpdateEnabled();
    if (isRunning) {
      // Stop: restore from snapshot
      setEditorEnabled(true);
      setUpdateEnabled(false);

      if (editorState.sceneSnapshot !== null) {
        await restoreSceneFromSnapshot(editorState.sceneSnapshot);
        editorState.sceneSnapshot = null;
      } else {
        console.warn("No scene snapshot to restore from");
      }
      setPersistenceEnabled(true);
      initializeGame();
    } else {
      // Start: save snapshot
      editorState.sceneSnapshot = saveSceneSnapshot();
      setEditorEnabled(false);
      setUpdateEnabled(true);
      setPersistenceEnabled(false);
      initializeGame();
    }
    updateButtonText();
    runButton.blur();
  });

  // Create show scene data button
  const showSceneDataButton = createStyledButton("Show Scene Data");
  showSceneDataButton.addEventListener("click", () => {
    showSceneDataModal();
  });

  // Ensure editor has relative positioning for absolute children
  if (getComputedStyle(editor).position === "static") {
    editor.style.position = "relative";
  }

  // Add buttons to container
  buttonContainer.appendChild(showSceneDataButton);
  buttonContainer.appendChild(runButton);

  // Add button container to editor
  editor.appendChild(buttonContainer);
}
