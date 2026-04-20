import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";

/**
 * Mounts game UI as a layer inside `parentRoot` (typically the GameView host).
 * Returns the same `parentRoot` so the canvas can still attach there (prepend in main).
 */
export function createGameUI(
  parentRoot: HTMLElement,
  GameUI: ComponentType,
): Promise<HTMLElement> {
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:absolute;inset:0;pointer-events:none;z-index:1";

  parentRoot.style.position = "relative";
  parentRoot.appendChild(layer);

  const root = createRoot(layer);

  flushSync(() => {
    root.render(<GameUI />);
  });

  return Promise.resolve(parentRoot);
}
