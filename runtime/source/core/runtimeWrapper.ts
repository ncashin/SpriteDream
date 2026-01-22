import "../style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./fileUtilities";
import { setSceneFile, updateSceneWithDiff } from "./scene/scene";
import { initializeEditor, getEditorRoot } from "./editor/editorInitializer";
import {
  resetAllCallbacks,
  setEditorEnabled,
  setUpdateEnabled,
} from "./gameloop";
import type { InitialGameContext } from "./gameContext";
import { isEditorMode } from "./utils";

export type MainFunction = (initialContext: InitialGameContext) => void;

const isDev = import.meta.env?.DEV === true;
const isInIframe = window.parent !== window;

let mainFunction: MainFunction | null = null;
let isInitialized = false;
let hasSceneBeenLoaded = false;

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

const notifyParent = (command: string, data?: Record<string, unknown>) => {
  if (isInIframe) {
    window.parent.postMessage({ command, ...data }, "*");
  }
};

export function runGame() {
  if (!mainFunction) return;

  resetAllCallbacks();

  if (isDev || isEditorMode()) {
    initializeEditor();
    if (!hasSceneBeenLoaded) {
      setEditorEnabled(true);
      // Don't auto-start the game when editor is enabled - user should click Run
      setUpdateEnabled(false);
      hasSceneBeenLoaded = true;
    }
  } else if (!isInitialized) {
    setEditorEnabled(false);
    setUpdateEnabled(true);
    isInitialized = true;
  }

  gameRoot.innerHTML = "";
  mainFunction({
    rootElement: gameRoot,
    editorRootElement: editorRoot,
    editorRoot: getEditorRoot(),
  });
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

// One-time setup
window.addEventListener("message", handleMessage);
notifyParent("runtimeReady");

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    runGame();
  });

  import.meta.hot.on("vite:error", (error) => {
    console.error("HMR Error:", error);
  });
}

if (isDev || isEditorMode()) {
  initializeEditor();
}
