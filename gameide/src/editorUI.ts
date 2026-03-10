import { GameIDEMode, getMode, setMode, onModeChange } from "./mode.js";

export function createEditorUI(): void {
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
  `;

  const runButton = document.createElement("button");
  runButton.type = "button";
  runButton.style.cssText = `
    position: absolute;
    bottom: 16px;
    right: 16px;
    pointer-events: auto;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  `;

  function updateLabel(): void {
    runButton.textContent = getMode() === GameIDEMode.Game ? "Stop" : "Run";
  }

  runButton.addEventListener("click", () => {
    setMode(getMode() === GameIDEMode.Game ? GameIDEMode.Editor : GameIDEMode.Game);
  });

  onModeChange(updateLabel);
  updateLabel();
  overlay.appendChild(runButton);
  document.body.appendChild(overlay);
}
