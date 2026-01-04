import "./style.css";
import { readFile } from "../core/fileUtilities";
import { setSceneFile } from "../core/scene";
import { initializeEditor } from "../core/editor/editor";
import { main } from "./entrypoint";

const gameRoot = document.querySelector<HTMLDivElement>("#gameRoot")!;

// Initialize editor
initializeEditor();

function initializeGame() {
  gameRoot.innerHTML = "";
  main(gameRoot);
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
