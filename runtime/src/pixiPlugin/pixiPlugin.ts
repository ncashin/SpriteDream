import { Application } from "pixi.js";
import type { GameContext } from "../initialization";
import { handleParentHierarchy } from "./handleParentHierarchy";
import { handleSelectedObjects } from "./selectedObject";
import { handleSprites } from "./sprite";
import { handleViewport } from "./viewport";

export type Viewport = { x: number; y: number; zoom: number };

export const pixiPlugin = (options: {}) => async (context: GameContext) => {
  const { rootElement, onDispose, selectedObjectsStore } = context;

  const app = new Application();

  await app.init({
    antialias: true,
    resizeTo: rootElement,
    background: 0x222222,
  });

  rootElement.append(app.canvas);

  const { viewport, viewportContainer } = handleViewport(context, app);
  const hierarchy = handleParentHierarchy(context, viewportContainer);
  handleSelectedObjects(context, hierarchy);
  handleSprites(context, hierarchy);

  app.stage.on("pointerdown", () => {
    selectedObjectsStore.deselectObjects();
  });

  onDispose(() => {
    if (app.canvas.parentElement === rootElement) {
      rootElement.removeChild(app.canvas);
    }

    app.destroy(true, {
      children: true,
      texture: true,
    });
  });

  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      if (!newModule?.pixiPlugin) return;
      context.__run.rerun(newModule.pixiPlugin(options));
    });
  }

  return { ...context, viewport };
};
