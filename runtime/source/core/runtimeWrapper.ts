import "../style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./fileUtilities";
import { setSceneFile, updateSceneWithDiff } from "./scene/scene";
import { initializeEditor, getEditorRoot } from "./editor/editorInitializer";
import { resetAllCallbacks } from "./gameloop";
import type { InitialGameContext } from "./gameContext";
import { isEditorMode } from "./utils";
import type { ComponentType } from "react";
import React from "react";
import { createRoot, type Root } from "react-dom/client";

export type MainFunction = (initialContext: InitialGameContext) => void;

const isDev = import.meta.env?.DEV === true;
const isInIframe = window.parent !== window;

let mainFunction: MainFunction | null = null;
let editorInitialized = false;
let gameUIRoot: Root | null = null;
let gameUIContainer: HTMLDivElement | null = null;
let GameUIComponent: ComponentType | null = null;

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

const notifyParent = (command: string, data?: Record<string, unknown>) => {
  if (isInIframe) {
    window.parent.postMessage({ command, ...data }, "*");
  }
};

function initializeGameUI(GameUI?: ComponentType) {
  if (GameUI) {
    GameUIComponent = GameUI;
  }

  if (!GameUIComponent) {
    return;
  }

  // Only render GameUI when NOT in editor mode
  if (isEditorMode()) {
    // Clear GameUI if we're in editor mode
    if (gameUIRoot) {
      gameUIRoot.unmount();
      gameUIRoot = null;
    }
    if (gameUIContainer) {
      gameUIContainer.remove();
      gameUIContainer = null;
    }
    return;
  }

  // Create container for GameUI if it doesn't exist
  if (!gameUIContainer || gameUIContainer.parentElement !== gameRoot) {
    if (gameUIContainer) {
      gameUIContainer.remove();
    }
    gameUIContainer = document.createElement("div");
    gameUIContainer.className = "game-ui-container";
    gameRoot.appendChild(gameUIContainer);
    gameUIRoot = createRoot(gameUIContainer);
  }

  // Render GameUI component
  if (gameUIRoot && GameUIComponent) {
    gameUIRoot.render(React.createElement(GameUIComponent));
  }
}

export function runGame(EditorUI?: ComponentType, GameUI?: ComponentType, forceReset = false) {
  if (!mainFunction) return;

  resetAllCallbacks();

  if ((isDev || isEditorMode()) && !editorInitialized) {
    initializeEditor(EditorUI);
    editorInitialized = true;
  } else if ((isDev || isEditorMode()) && EditorUI) {
    // Re-initialize editor with new component on HMR
    initializeEditor(EditorUI);
  }

  // Initialize GameUI (only renders when not in editor mode)
  initializeGameUI(GameUI);

  if (forceReset) {
    gameRoot.innerHTML = "";
    gameUIContainer = null;
    gameUIRoot = null;
  }

  try {
    mainFunction({
      rootElement: gameRoot,
      editorRootElement: editorRoot,
      editorRoot: getEditorRoot(),
    });
  } catch (error) {
    console.error("Error during game initialization:", error);
    throw error;
  }
}

const handleMessage = async (event: MessageEvent) => {
  const { command, path, content, diff } = event.data;

  switch (command) {
    case "openScene":
      if (!path) break;

      try {
        let fileContent = content;

        if (fileContent === undefined && (isDev || isEditorMode())) {
          fileContent = await readFile(path);
        } else if (fileContent === undefined) {
          return;
        }

        await setSceneFile(path, fileContent);
        runGame();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        gameRoot.innerHTML = `Failed to load scene file: ${errorMessage}`;
        console.error("Failed to load scene file:", error);
      }
      break;

    case "updateScene":
      if (!diff) break;

      try {
        updateSceneWithDiff(diff);
      } catch (error) {
        console.error("Failed to update scene with diff:", error);
      }
      break;

    case "ping":
      notifyParent("runtimeReady");
      break;
  }
};

export function defineMainFunction(fn: MainFunction) {
  mainFunction = fn;
}

window.addEventListener("message", handleMessage);
notifyParent("runtimeReady");