import {
  Application,
  Container,
  type ApplicationOptions,
} from "pixi.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import { pixiSprites } from "./sprite.js";
import {
  type ViewportController,
  pixiViewport,
} from "./viewport.js";

export type PixiPluginOptions = {
  initOptions?: Omit<Partial<ApplicationOptions>, "resizeTo">;
};

export type Viewport = ViewportController;

export type PixiPluginAPI = {
  app: Application;
  world: Container;
  viewport: Viewport;
};

type PixiPluginContext = {
  rootElement: HTMLElement;
  dispose: (fn: () => void) => void;
};

export type PixiPluginInputContext = PixiPluginContext & {
  input: {
    buttons: {
      Click: { held: boolean; pressed: boolean; released: boolean };
    };
    mouse: {
      position: { x: number; y: number } | null;
      wheel: { x: number; y: number };
    };
  };
};

export function pixiPlugin(
  options: PixiPluginOptions = {},
): Plugin<PixiPluginInputContext, { pixi: PixiPluginAPI }> {
  return async (context) => {
    const rootElement = context.rootElement;
    rootElement.style.position = "absolute";
    rootElement.style.inset = "0";
    rootElement.style.width = "100%";
    rootElement.style.height = "100%";
    rootElement.style.overflow = "hidden";

    const app = new Application();
    await app.init({
      resizeTo: rootElement,
      autoDensity: true,
      antialias: true,
      preference: "webgl",
      ...options.initOptions,
    });

    rootElement.appendChild(app.canvas);

    const world = new Container();
    world.sortableChildren = true;
    app.stage.addChild(world);

    const input = context.input;

    const { viewport, unsubscribe: unsubscribePixiViewport } = pixiViewport({
      world,
      app,
      rootElement,
      input,
    });

    const { unsubscribe: unsubscribePixiSprites } = pixiSprites(world);

    context.dispose(() => {
      unsubscribePixiViewport();
      unsubscribePixiSprites();
      app.destroy(true, true);
    });

    return {
      ...context,
      pixi: {
        app,
        world,
        viewport,
      },
    };
  };
}
