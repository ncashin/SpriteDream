import "./style.css";
import "@vscode/codicons/dist/codicon.css";
import { readFile } from "./core/fileUtilities";
import { setSceneFile } from "./core/scene/scene";
import { initializeEditor } from "./core/editor/editorInitializer";
import { resetAllCallbacks } from "./core/gameloop";
import { main } from "./main";

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;
const editorRoot = document.querySelector<HTMLDivElement>("#editor")!;

// Initialize editor
export function initializeGame() {
  resetAllCallbacks();
  initializeEditor();
  gameRoot.innerHTML = "";
  main({rootElement: gameRoot, editorRootElement: editorRoot});
}

window.addEventListener("message", async (event: MessageEvent) => {
  if (event.data.command === "openScene" && event.data.path) {
    try {
      const content =
        event.data.content !== undefined
          ? event.data.content
          : await readFile(event.data.path);

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

