import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";

export function createEditorUI(Editor: ComponentType): void {
  const overlay = document.createElement("div");
  overlay.id = "gameide-editor-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.pointerEvents = "none";

  document.body.appendChild(overlay);

  const root = createRoot(overlay);
  root.render(<Editor />);
}
