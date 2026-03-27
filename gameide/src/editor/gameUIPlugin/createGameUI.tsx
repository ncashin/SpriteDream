import { createRoot } from "react-dom/client";
import { Game } from "./Game.js";
import type { ComponentType } from "react";

export function createGameUI(
  GameUI: ComponentType,
  rootElement: HTMLElement,
): void {
  const overlay = document.createElement("div");
  overlay.id = "gameide-game-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";

  document.body.appendChild(overlay);

  const root = createRoot(overlay);
  root.render(<GameUI />);

  const gameRootContainer = document.getElementById("gameide-gameui-game");
  if (!gameRootContainer) return;

  const currentParent = rootElement.parentElement;
  if (!currentParent) return;

  currentParent.removeChild(rootElement);
  gameRootContainer.appendChild(rootElement);

  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
}

