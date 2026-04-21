import type { ComponentType } from "react";
import type { GameIDEPluginContext } from "../../gameIDEPluginContext.js";
import { createGameUI } from "./createGameUI.js";
import { ExampleGameUI } from "./ExampleGameUI.js";

export const gameUIPlugin =
  (GameUI?: ComponentType) =>
  async (input: GameIDEPluginContext) => {
    const rootElement = await createGameUI(
      input.rootElement,
      GameUI ?? ExampleGameUI,
    );

    return { ...input, rootElement };
  };

