import { Application } from "pixi.js";
import type { GameContext } from "../initialization";
import { handleSprites } from "./sprite";

export const pixiPlugin = () => async (context: GameContext) => {
  const { rootElement } = context;

  const app = new Application();

  await app.init({
    antialias: true,
    resizeTo: rootElement,
    background: 0x222222,
  });

  rootElement.append(app.canvas);

  handleSprites(context, app);

  return context;
};
