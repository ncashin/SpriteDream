import { Application, Container } from "pixi.js";

import type { GameContext, Plugin } from "../runtime/plugin";
import { getScene } from "../scene/scene";
import { setupEditorViewport } from "./editorViewport";
import { handleSprites } from "./sprite";
import type { ViewportState } from "./viewport";
import { setupViewport } from "./viewport";
import { editorStart } from "../runtime/gameloop";

/** Hex color matching CSS --color-dark-bg-2 (base-950) */
const DEFAULT_BACKGROUND_COLOR = 0x1c1b1a;

export type Render2DPluginOptions = {
  backgroundColor?: number;
};

export type Render2DContext = GameContext & {
  application: Application;
  viewport: ViewportState;
  world: Container;
};

export const render2DPlugin =
  (options?: Render2DPluginOptions): Plugin<Render2DContext> =>
  async (context) => {
    const { __gameRoot } = context;
    const resolution =
      typeof window !== "undefined" ? window.devicePixelRatio : 1;
    const autoDensity = true;

    const application = new Application();

    await application.init({
      resizeTo: __gameRoot,
      backgroundColor: options?.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
      resolution,
      autoDensity,
      antialias: true,
    });

    __gameRoot.appendChild(application.canvas);
    const resizeObserver = new ResizeObserver(() => application.resize());
    resizeObserver.observe(__gameRoot);

    const { viewport, world } = setupViewport(application);

    editorStart(() => {
      setupEditorViewport(application, viewport);
    });

    const scene = getScene();
    handleSprites({ application, world }, scene);

    return {
      ...context,
      application,
      viewport,
      world,
    };
  };
