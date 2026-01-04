import "./style.css";
import { readFile } from "./core/fileUtilities";
import { setSceneFile } from "./core/scene/scene";
import { initializeEditor } from "./core/editor/editor";
import { resetAllCallbacks } from "./core/gameloop";
import { main } from "./main";

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;

// Initialize editor

export function initializeGame() {
  // Reset all update and draw callbacks before reinitializing
  resetAllCallbacks();
  
  initializeEditor();

  gameRoot.innerHTML = "";
  main({rootElement: gameRoot});
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
  }
});

