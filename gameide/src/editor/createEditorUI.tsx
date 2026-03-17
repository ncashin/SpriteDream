import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";

export function createEditorUI(
  Editor: ComponentType,
  rootElement: HTMLElement,
): void {
  const overlay = document.createElement("div");
  overlay.id = "gameide-editor-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";

  document.body.appendChild(overlay);

  const root = createRoot(overlay);
  root.render(<Editor />);

  // Defer DOM manipulation until after React has had a chance to mount
  // the editor UI, including the `GameView` container.
  requestAnimationFrame(() => {
    const gameRootContainer = document.getElementById("gameide-game-root");
    if (!gameRootContainer) return;

    const currentParent = rootElement.parentElement;
    if (!currentParent) return;

    currentParent.removeChild(rootElement);
    gameRootContainer.appendChild(rootElement);

    // Ensure the game root fills the viewport area provided by GameView.
    rootElement.style.width = "100%";
    rootElement.style.height = "100%";
  });
}
