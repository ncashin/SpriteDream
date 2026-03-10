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
    top: 1rem;
    right: 1rem;
    pointer-events: auto;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid var(--vscode-button-border, transparent);
    border-radius: 0.25rem;
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
    font-family: var(--vscode-font-family, inherit);
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
