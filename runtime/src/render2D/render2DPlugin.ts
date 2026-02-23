import { Application } from "pixi.js";
import invariant from "tiny-invariant";

import type { Plugin } from "../runtime/plugin";
import { getScene } from "../scene/scene";
import { handleSprites } from "./sprite";

/** Hex color matching CSS --color-dark-bg-2 (base-950) */
const DEFAULT_BACKGROUND_COLOR = 0x1c1b1a;

export type Render2DPluginOptions = {
  backgroundColor?: number;
};

export const render2DPlugin = (options?: Render2DPluginOptions): Plugin => (context) => {
  const gameElement = document.getElementById("game");
  invariant(gameElement, "#game element must exist in the DOM");

  const application = new Application();
  const pixiApplicationReady = application
    .init({
      resizeTo: gameElement,
      backgroundColor: options?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    })
    .then(() => {
      gameElement.appendChild(application.canvas);
      return application;
    });

  handleSprites(pixiApplicationReady, getScene());

  return {
    ...context,
    pixiApplication: application,
    pixiApplicationReady: pixiApplicationReady,
  };
};
