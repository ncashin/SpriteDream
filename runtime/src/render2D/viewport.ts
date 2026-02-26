import { Application, Container } from "pixi.js";
import invariant from "tiny-invariant";

import { setupEditorViewport } from "./editorViewport";

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type ViewportOptions = {
  minScale?: number;
  maxScale?: number;
  wheelZoomSpeed?: number;
};

export type Viewport = {
  /** Viewport state: (x, y) is the world position at canvas center, zoom is scale */
  viewport: ViewportState;
  world: Container;
  destroy: () => void;
};

export function setupViewport(
  application: Application,
  options: ViewportOptions = {},
): Viewport {
  const world = new Container();
  const stage = application.stage;
  stage.removeChildren();
  stage.addChild(world);

  const canvas = application.canvas;
  invariant(canvas instanceof HTMLCanvasElement, "application.canvas must be an HTMLCanvasElement");

  const state: ViewportState = { x: 0, y: 0, zoom: 1 };

  function applyViewport() {
    const { width, height } = application.screen;
    world.position.set(width / 2 - state.x * state.zoom, height / 2 - state.y * state.zoom);
    world.scale.set(state.zoom, state.zoom);
  }

  const viewport = new Proxy(state, {
    set(target, key, value) {
      if (typeof key === "string" && key in target) {
        target[key as keyof ViewportState] = value as number;
        applyViewport();
      }
      return true;
    },
  }) as ViewportState;

  applyViewport();
  const resizeObserver = new ResizeObserver(applyViewport);
  resizeObserver.observe(canvas);

  const editorViewport = setupEditorViewport(application, viewport, options);

  function destroy() {
    editorViewport.destroy();
    resizeObserver.disconnect();
    stage.removeChild(world);
    world.destroy({ children: true });
  }

  return { viewport, world, destroy };
}
