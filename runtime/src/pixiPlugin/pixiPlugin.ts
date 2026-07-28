import { Application } from "pixi.js";
import type { GameContext } from "../initialization";

export const pixiPlugin = async () => async (context: GameContext) => {
  const { rootElement } = context;

  const app = new Application();

  await app.init({
    antialias: true,
    resolution: window.devicePixelRatio,
    autoDensity: true,
    resizeTo: rootElement,
  });

  rootElement.appendChild(app.canvas);

  return context;
};
