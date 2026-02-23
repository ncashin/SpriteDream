import { Application } from "pixi.js";
import invariant from "tiny-invariant";

import type { Plugin } from "../runtime/plugin";
import { getScene } from "../scene/scene";
import { handleSprites } from "./sprite";

export const render2DPlugin = (): Plugin => (context) => {
  const gameElement = document.getElementById("game");
  invariant(gameElement, "#game element must exist in the DOM");

  const application = new Application();
  const pixiApplicationReady = application
    .init({
      resizeTo: gameElement,
      backgroundColor: 0x1099bb,
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
