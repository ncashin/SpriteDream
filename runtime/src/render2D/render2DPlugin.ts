import { Application } from "pixi.js";
import invariant from "tiny-invariant";

import type { Plugin } from "../runtime/plugin";
import { getScene } from "../scene/scene";
import { handleSprites } from "./sprite";
import { setupViewport } from "./viewport";

/** Hex color matching CSS --color-dark-bg-2 (base-950) */
const DEFAULT_BACKGROUND_COLOR = 0x1c1b1a;

export type Render2DPluginOptions = {
  backgroundColor?: number;
};

export const render2DPlugin = (options?: Render2DPluginOptions): Plugin =>
  async (context) => {
    const gameElement = document.getElementById("game");
    invariant(gameElement, "#game element must exist in the DOM");

    const resolution = typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const autoDensity = true;

    const application = new Application();
    
   await application.init({
      resizeTo: gameElement,
      backgroundColor: options?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      resolution,
      autoDensity,
      antialias: true,
    })

    gameElement.appendChild(application.canvas);
    const resizeObserver = new ResizeObserver(() => application.resize());
    resizeObserver.observe(gameElement);

    const viewport = setupViewport(application);

    handleSprites(
      Promise.resolve({ application, world: viewport.world }),
      getScene(),
    );

    return {
      ...context,
      pixiApplication: application,
      viewport,
    };
  };
