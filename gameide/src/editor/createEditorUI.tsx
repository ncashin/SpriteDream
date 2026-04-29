import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ComponentType, Ref } from "react";

export type EditorWithGameViewReference = ComponentType<{
  gameViewRef?: Ref<HTMLDivElement>;
}>;

/**
 * Mounts the editor into `parentRoot` and resolves with the GameView host element
 * (where the game surface should attach).
 */
export function createEditorUI(
  parentRoot: HTMLElement,
  Editor: EditorWithGameViewReference,
): Promise<HTMLDivElement> {
  return new Promise((resolve) => {
    let settled = false;
    const gameViewRef = (el: HTMLDivElement | null) => {
      if (el && !settled) {
        settled = true;
        resolve(el);
      }
    };

    const root = createRoot(parentRoot);

    flushSync(() => {
      root.render(<Editor gameViewRef={gameViewRef} />);
    });
  });
}
