import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { ComponentType, Ref } from "react";

export type EditorWithGameViewReference = ComponentType<{
  gameViewRef?: Ref<HTMLDivElement>;
}>;

export type EditorUIMount = {
  gameViewRoot: HTMLDivElement;
  dispose: () => void;
};

export function createEditorUI(
  parentRoot: HTMLElement,
  Editor: EditorWithGameViewReference,
): Promise<EditorUIMount> {
  return new Promise((resolve) => {
    let settled = false;
    const root = createRoot(parentRoot);
    const gameViewRef = (element: HTMLDivElement | null) => {
      if (element && !settled) {
        settled = true;
        resolve({
          gameViewRoot: element,
          dispose: () => {
            root.unmount();
          },
        });
      }
    };

    flushSync(() => {
      root.render(<Editor gameViewRef={gameViewRef} />);
    });
  });
}
