import type { ContextExtension, InitialGameContext } from "../gameContext";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { ViewportDebugUI } from "./ViewportDebugUI";
import { addStartCallback } from "../initialization";
import { resetViewport } from "./viewport";

let viewportDebugRoot: Root | null = null;
let viewportDebugContainer: HTMLDivElement | null = null;

export function viewportDebugPlugin<T extends InitialGameContext>(
  context: T
): ContextExtension<T, {}> {
  addStartCallback(() => {
    resetViewport();
  });
  if (
    !(
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.DEV
    )
  ) {
    return context;
  }

  if (
    !viewportDebugContainer ||
    viewportDebugContainer.parentElement !== context.editorRootElement
  ) {
    if (viewportDebugContainer) {
      viewportDebugContainer.remove();
    }
    viewportDebugContainer = document.createElement("div");
    context.editorRootElement.appendChild(viewportDebugContainer);
    viewportDebugRoot = createRoot(viewportDebugContainer);
  }

  if (viewportDebugRoot) {
    viewportDebugRoot.render(React.createElement(ViewportDebugUI));
  }

  return context;
}
