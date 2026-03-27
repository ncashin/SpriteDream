import { Application } from "pixi.js";
import { definePlugin } from "../plugin.js";
import { initializeColliderDebugRendering } from "./colliderDebug.js";
import { initializeGridRendering } from "./grid.js";
import { initializeSpriteRendering } from "./sprite.js";
import { initializeViewport } from "./viewport.js";
import type { InputContext } from "../inputPlugin.js";

export type Render2DPluginRequiredContext = {
  rootElement: HTMLElement;
  input: Pick<InputContext, "getButton" | "getMousePosition">;
};
export type Render2DPluginOptions = {};

export const renderPlugin2D = definePlugin(
  (_options?: Render2DPluginOptions) =>
    async (inputContext: Render2DPluginRequiredContext) => {
      const rootElement = inputContext.rootElement;
      const app = new Application();

      await app.init({
        resizeTo: rootElement,
        resolution: window?.devicePixelRatio,
        autoDensity: true,
        antialias: true,
      });

      const viewport = initializeViewport(app, inputContext.input);
      rootElement.appendChild(app.canvas);
      initializeGridRendering(app, viewport);
      initializeSpriteRendering(app);
      initializeColliderDebugRendering(app);

      return {
        ...inputContext,
        render2D: {
          app,
          canvasElement: app.canvas,
          viewport,
        },
      };
    },
);

