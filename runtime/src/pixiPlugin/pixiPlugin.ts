import { Application } from "pixi.js";
import type { GameContext } from "../tomove/gameide";
import { handleParentHierarchy } from "./handleParentHierarchy";
import { handleSelectedObjects } from "./selectedObject";
import { handleSprites } from "./sprite";
import { handleViewport } from "./viewport";

export type Viewport = { x: number; y: number; zoom: number };

export const pixiPlugin = (_options: {}) => async (context: GameContext) => {
  const { rootElement, deselectObjects } = context;

  const app = new Application();

  await app.init({
    antialias: true,
    resizeTo: rootElement,
    background: 0x222222,
  });

  app.stage.on("pointerdown", () => {
    deselectObjects();
  });

  rootElement.append(app.canvas);

  const { viewport, viewportContainer } = handleViewport(context, app);
  const hierarchy = handleParentHierarchy(context, viewportContainer);
  handleSelectedObjects(context, hierarchy);
  handleSprites(context, hierarchy);

  return { ...context, viewport };
};
