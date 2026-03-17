import type { ComponentType } from "react";
import { createGameUI } from "./createGameUI.js";
import { ExampleGameUI } from "./ExampleGameUI.js";

export const gameUIPlugin =
  (GameUI?: ComponentType) =>
  (input: { rootElement: HTMLElement }) => {
    const { rootElement } = input;
    createGameUI(GameUI ?? ExampleGameUI, rootElement);

    return input;
  };

