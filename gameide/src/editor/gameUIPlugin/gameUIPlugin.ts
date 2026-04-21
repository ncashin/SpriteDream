import type { ComponentType } from "react";
import { createGameUI } from "./createGameUI.js";
import { ExampleGameUI } from "./ExampleGameUI.js";

export const gameUIPlugin =
  (GameUI?: ComponentType) =>
  async (input: { rootElement: HTMLElement }) => {
    const rootElement = await createGameUI(
      input.rootElement,
      GameUI ?? ExampleGameUI,
    );

    return { ...input, rootElement };
  };

