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
let isHMRUpdate = false;
let editorInitialized = false;

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

const notifyParent = (command: string, data?: Record<string, unknown>) => {
  if (isInIframe) {
    window.parent.postMessage({ command, ...data }, "*");
  }
};

export function runGame() {
  if (!mainFunction) return;

  // Always reset callbacks - the main function might have changed during HMR
  // and we need to re-register callbacks. Scene state is preserved separately.
  resetAllCallbacks();

  // During HMR, preserve the running state - don't change updateEnabled/editorEnabled
  if (!isHMRUpdate) {
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
  } else {
    // During HMR, just ensure editor is initialized if needed
    if (isDev || isEditorMode()) {
      initializeEditor();
    }
  }

  // During HMR, preserve existing canvas elements if possible
  // Only clear if we're doing a full reinitialization (not HMR)
  if (!isHMRUpdate) {
    gameRoot.innerHTML = "";
  } else {
    // For HMR, try to preserve canvas elements
    // Remove only non-canvas children to preserve rendering context
    const children = Array.from(gameRoot.children);
    for (const child of children) {
      if (child.tagName !== "CANVAS") {
        child.remove();
      }
    }
  }

  try {
    mainFunction({
      rootElement: gameRoot,
      editorRootElement: editorRoot,
      editorRoot: getEditorRoot(),
    });
  } catch (error) {
    console.error("Error during game initialization:", error);
    // If initialization fails during HMR, mark it as a full reinit next time
    if (isHMRUpdate) {
      isHMRUpdate = false;
    }
    throw error;
  }

  // Reset HMR flag after update
  isHMRUpdate = false;
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
  // Preserve scene data during HMR
  // Note: import.meta.hot.data is automatically initialized by Vite

  // Accept HMR updates for this module
  import.meta.hot.accept((newModule) => {
    // Module updated - preserve state and reinitialize only if needed
    if (newModule) {
      // Mark as HMR update to preserve DOM elements
      isHMRUpdate = true;
      // Re-run game with preserved scene data
      runGame();
    }
  });

  // Handle HMR updates from other modules
  import.meta.hot.on("vite:afterUpdate", () => {
    // Only re-run if main function is defined
    if (mainFunction) {
      // Mark as HMR update to preserve DOM elements
      isHMRUpdate = true;
      runGame();
    }
  });

  import.meta.hot.on("vite:error", (error) => {
    console.error("HMR Error:", error);
  });

  // Preserve state on dispose
  import.meta.hot.dispose((data) => {
    if (data) {
      // Store state that should be preserved
      data.hasSceneBeenLoaded = hasSceneBeenLoaded;
      data.isInitialized = isInitialized;
      data.editorInitialized = editorInitialized;
    }
    // Mark that next update is HMR
    isHMRUpdate = true;
  });

  // Restore state on reload
  const hotData = import.meta.hot.data;
  if (hotData) {
    hasSceneBeenLoaded = hotData.hasSceneBeenLoaded ?? false;
    isInitialized = hotData.isInitialized ?? false;
    editorInitialized = hotData.editorInitialized ?? false;
  }
}

if (isDev || isEditorMode()) {
  // Initialize editor only if not already initialized
  if (!editorInitialized) {
    initializeEditor();
    editorInitialized = true;
  }
}
