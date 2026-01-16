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

export type MainFunction = (initialContext: InitialGameContext) => void;

const isDev = import.meta.env?.DEV === true;
const isInIframe = window.parent !== window;

let initializeGameFunction: (() => void) | null = null;

export const initializeGame = () => {
  if (initializeGameFunction) {
    initializeGameFunction();
  }
};

const notifyParent = (command: string, data?: Record<string, unknown>) => {
  if (isInIframe) {
    window.parent.postMessage({ command, ...data }, "*");
  }
};

const handleMessage = async (
  event: MessageEvent,
  gameRoot: HTMLDivElement,
  initializeGame: () => void
) => {
  const { command, path, content, diff } = event.data;

  switch (command) {
    case "openScene":
      if (!path) break;

      try {
        let fileContent = content;

        if (fileContent === undefined && isDev) {
          fileContent = await readFile(path);
        } else if (fileContent === undefined) {
          return;
        }

        await setSceneFile(path, fileContent);
        initializeGame();
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

    default:
      break;
  }
};

export const defineMainFunction = (mainFunction: MainFunction) => {
  const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
  const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

  let isFirstInitialization = true;
  let hasSceneBeenLoaded = false;

  const initializeGame = () => {
    resetAllCallbacks();

    if (isDev) {
      initializeEditor();
      if (!hasSceneBeenLoaded) {
        setEditorEnabled(true);
        setUpdateEnabled(false);
        hasSceneBeenLoaded = true;
      }
    } else if (isFirstInitialization) {
      setEditorEnabled(false);
      setUpdateEnabled(true);
      isFirstInitialization = false;
    }

    gameRoot.innerHTML = "";
    mainFunction({
      rootElement: gameRoot,
      editorRootElement: editorRoot,
      editorRoot: getEditorRoot(),
    });
  };

  if (!isDev) {
    initializeGame();
  } else {
    initializeEditor();
  }

  window.addEventListener("message", (event: MessageEvent) => {
    handleMessage(event, gameRoot, initializeGame);
  });

  notifyParent("runtimeReady");

  if (import.meta.hot) {
    import.meta.hot.on("vite:afterUpdate", () => {
      initializeGame();
    });

    import.meta.hot.on("vite:error", (error) => {
      console.error("HMR Error:", error);
    });
  }

  initializeGameFunction = initializeGame;

  return {
    initializeGame,
  };
};
