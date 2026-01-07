import "./style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./core/fileUtilities";
import { setSceneFile } from "./core/scene/scene";
import { initializeEditor } from "./core/editor/editorInitializer";
import { resetAllCallbacks, setEditorEnabled, setUpdateEnabled } from "./core/gameloop";
import { main } from "./main";

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

let firstInitialization = true;
// Initialize editor
export function initializeGame() {
  resetAllCallbacks();
  if (import.meta.env && import.meta.env.DEV) {
    initializeEditor();
  } else  if(firstInitialization) {
    setEditorEnabled(false);
    setUpdateEnabled(true);
    
    firstInitialization = false;
  }

  gameRoot.innerHTML = "";
  main({rootElement: gameRoot, editorRootElement: editorRoot});
}

// Auto-initialize game on startup in production
if (!import.meta.env?.DEV) {
  // In production, initialize immediately with the default scene
  // The scene is imported via Vite's ?raw import in main.ts
  initializeGame();
}

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.data.command === "openScene" && event.data.path) {
    try {
      // Only handle file loading in development mode
      // In production, scene data comes from Vite imports via initializeGameContext
      const isDev = import.meta.env && import.meta.env.DEV;
      let content = event.data.content;
      
      if (content === undefined && isDev) {
        // Only try to read file in development
        content = await readFile(event.data.path);
      } else if (content === undefined) {
        // In production, ignore if no content provided (scene should come from import)
        console.warn("Scene content not provided and not in dev mode, skipping file load");
        return;
      }

      await setSceneFile(event.data.path, content);
      initializeGame();
    } catch (error: any) {
      gameRoot.innerHTML = `<div style="padding: 2rem; color: #ff0000;">${
        error.message || "Failed to load scene file"
      }</div>`;
    }
  } else if (event.data.command === "ping") {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ command: "runtimeReady" }, "*");
    }
  }
});

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    initializeGame();
  });
  
  import.meta.hot.on('vite:afterUpdate', () => {
    initializeGame();
  });
}

