import "./style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./core/fileUtilities";
import { setSceneFile } from "./core/scene/sceneFileHandler";
import { initializeEditor } from "./core/editor/editorInitializer";
import { resetAllCallbacks, setEditorEnabled, setUpdateEnabled } from "./core/gameloop";
import { main } from "./main";

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

let firstInitialization = true;
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

if (!import.meta.env?.DEV) {
  initializeGame();
}

window.addEventListener("message", async (event: MessageEvent) => {
  const { command, path, content } = event.data;
  switch (command) {
    case "openScene":
      if (path) {
        try {
          const isDev = import.meta.env && import.meta.env.DEV;
          let fileContent = content;
          
          if (fileContent === undefined && isDev) {
            fileContent = await readFile(path);
          } else if (fileContent === undefined) {
            return;
          }

          await setSceneFile(path, fileContent);
          initializeGame();
        } catch (error: any) {
          gameRoot.innerHTML = `<div style="padding: 2rem; color: #ff0000;">${
            error.message || "Failed to load scene file"
          }</div>`;
        }
      }
      break;
    case "ping":
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ command: "runtimeReady" }, "*");
      }
      break;
    default:
      // Ignore unknown commands
      break;
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

