import type { ComponentType } from "react";
import { createGameUI } from "./createGameUI.js";
import { ExampleGameUI } from "./ExampleGameUI.js";

export const gameUIPlugin =
  (GameUI?: ComponentType) =>
  async (input: { rootElement: HTMLElement; dispose: (fn: () => void) => void }) => {
    const mount = await createGameUI(
      input.rootElement,
      GameUI ?? ExampleGameUI,
    );

    input.dispose(() => {
      mount.dispose();
    });

    return {
      ...input,
      rootElement: mount.rootElement,
    };
  };

