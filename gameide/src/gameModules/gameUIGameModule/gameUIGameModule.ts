import type { ComponentType } from "react";
import { createGameUI } from "./createGameUI.js";

export const gameUIGameModule =
  (GameUI: ComponentType) =>
  async (input: { rootElement: HTMLElement; dispose: (callback: () => void) => void }) => {
    const mount = await createGameUI(
      input.rootElement,
      GameUI,
    );

    input.dispose(() => {
      mount.dispose();
    });

    return {
      ...input,
      rootElement: mount.rootElement,
    };
  };

