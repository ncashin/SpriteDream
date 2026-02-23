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
  viewport?: boolean;
};

export const render2DPlugin = (options?: Render2DPluginOptions): Plugin => (context) => {
  const gameElement = document.getElementById("game");
  invariant(gameElement, "#game element must exist in the DOM");

  const resolution = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const autoDensity = true;

  const application = new Application();
  const pixiApplicationReady = application
    .init({
      resizeTo: gameElement,
      backgroundColor: options?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      resolution,
      autoDensity,
      antialias: true,
    })
    .then(() => {
      gameElement.appendChild(application.canvas);
      return application;
    });

  const pixiWithViewport = pixiApplicationReady.then((app) => {
    const enableViewport = options?.viewport !== false;
    if (enableViewport) {
      const viewport = setupViewport(app);
      return { application: app, world: viewport.world };
    }
    return { application: app, world: app.stage };
  });

  handleSprites(pixiWithViewport, getScene());

  return {
    ...context,
    pixiApplication: application,
    pixiApplicationReady: pixiApplicationReady,
  };
};
