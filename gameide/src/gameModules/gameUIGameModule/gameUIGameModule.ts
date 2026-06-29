import type { ComponentType } from "react";
import { createGameUI } from "./createGameUI.js";

export default function gameUIGameModule(GameUI: ComponentType) {
  return async (input: { rootElement: HTMLElement; onDispose: (callback: () => void) => void }) => {
    const mount = await createGameUI(
      input.rootElement,
      GameUI,
    );

    input.onDispose(() => {
      mount.dispose();
    });

    return {
      ...input,
      rootElement: mount.rootElement,
    };
  };
}

