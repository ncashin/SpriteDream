import "../style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./fileUtilities";
import { setSceneFile, updateSceneWithDiff } from "./scene/scene";
import { initializeEditor, getEditorRoot } from "./editor/editorInitializer";
import { resetAllCallbacks } from "./gameloop";
import type { InitialGameContext } from "./gameContext";
import { isEditorMode } from "./utils";

export type MainFunction = (initialContext: InitialGameContext) => void;

const isDev = import.meta.env?.DEV === true;
const isInIframe = window.parent !== window;

let mainFunction: MainFunction | null = null;
let editorInitialized = false;

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

const notifyParent = (command: string, data?: Record<string, unknown>) => {
  if (isInIframe) {
    window.parent.postMessage({ command, ...data }, "*");
  }
};

export function runGame(forceReset = false) {
  if (!mainFunction) return;

  resetAllCallbacks();

  if ((isDev || isEditorMode()) && !editorInitialized) {
    initializeEditor();
    editorInitialized = true;
  }

  if (forceReset) {
    gameRoot.innerHTML = "";
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