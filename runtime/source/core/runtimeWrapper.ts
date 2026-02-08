import "../style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./fileUtilities";
import { flushSceneSave, setSceneFile, updateSceneWithDiff } from "./scene/scene";
import { initializeEditor, getEditorRoot } from "./editor/editorInitializer";
import { resetAllCallbacks, setDrawEnabled, setEditorUpdateEnabled, setUpdateEnabled } from "./gameloop";
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

function getGameRoot(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#gameRoot");
  if (!element) throw new Error("#gameRoot element not found");
  return element;
}

function getGameUIRootElement(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#gameUI");
  if (!element) throw new Error("#gameUI element not found");
  return element;
}

function getEditorRootElement(): HTMLDivElement {
  const element = document.querySelector<HTMLDivElement>("#editor");
  if (!element) throw new Error("#editor element not found");
  return element;
}

const gameRoot = getGameRoot();
const gameUIRootElement = getGameUIRootElement();

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

  // Create container for GameUI if it doesn't exist
  // GameUI now renders in its own root (gameUI) even when in editor mode
  if (!gameUIContainer || gameUIContainer.parentElement !== gameUIRootElement) {
    if (gameUIContainer) {
      gameUIContainer.remove();
    }
    gameUIContainer = document.createElement("div");
    gameUIContainer.className = "game-ui-container";
    gameUIRootElement.appendChild(gameUIContainer);
    gameUIRoot = createRoot(gameUIContainer);
  }

  // Update pointer events based on editor mode
  // In editor mode, GameUI should not capture pointer events
  const inEditorMode = isEditorMode();
  if (inEditorMode) {
    gameUIContainer.classList.add("editor-mode");
  } else {
    gameUIContainer.classList.remove("editor-mode");
  }

  // Always re-render GameUI component to ensure it's up to date
  if (gameUIRoot && GameUIComponent) {
    gameUIRoot.render(React.createElement(GameUIComponent));
  }
}

export function runGame(EditorUI?: ComponentType, GameUI?: ComponentType, forceReset = false) {
  resetAllCallbacks();
  // Ensure rendering is enabled for both editor and runtime embeds.
  setDrawEnabled(true);

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

  if (!mainFunction) return;

  try {
    mainFunction({
      rootElement: getGameRoot(),
      editorRootElement: getEditorRootElement(),
      editorRoot: getEditorRoot(),
    });
  } catch (error) {
    console.error("Error during game initialization:", error);
    throw error;
  }
}

const handleMessage = async (event: MessageEvent) => {
  const { command, path, content, diff, running } = event.data;

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
    case "setRunning":
      if (typeof running !== "boolean") break;
      setUpdateEnabled(running);
      setDrawEnabled(true);
      if (isEditorMode()) {
        setEditorUpdateEnabled(!running);
      }
      notifyParent("runtimeRunningState", { running });
      break;
  }
};

export function defineMainFunction(fn: MainFunction) {
  mainFunction = fn;
}

window.addEventListener("message", handleMessage);

if (isInIframe) {
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      e.stopPropagation();
      void flushSceneSave().finally(() => {
        notifyParent("save");
      });
    }
  });
}

notifyParent("runtimeReady");