import { Application, Container } from "pixi.js";
import invariant from "tiny-invariant";

import type { Position2D } from "./transform2D";
import { setupEditorViewport } from "./editorViewport";

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
  screenToWorld: (screen: Position2D) => Position2D;
  worldToScreen: (world: Position2D) => Position2D;
};

export type ScreenSize = { width: number; height: number };

export type ViewportOptions = {
  minScale?: number;
  maxScale?: number;
  wheelZoomSpeed?: number;
};

export type Viewport = {
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
  stage.scale.y = -1; // Y-up: flip vertically so +Y is up

  const canvas = application.canvas;
  invariant(
    canvas instanceof HTMLCanvasElement,
    "application.canvas must be an HTMLCanvasElement",
  );

  const state: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };

  const screenToWorld = (screen: Position2D) => {
    const { width, height } = application.screen;
    return {
      x: state.x + (screen.x - width / 2) / state.zoom,
      y: state.y + (height / 2 - screen.y) / state.zoom, // Y-up: screen top = larger world y
    };
  };
  const worldToScreen = (worldPos: Position2D) => {
    const { width, height } = application.screen;
    return {
      x: width / 2 + (worldPos.x - state.x) * state.zoom,
      y: height / 2 - (worldPos.y - state.y) * state.zoom, // Y-up: world y up = smaller screen y
    };
  };

  const viewport: ViewportState = {
    get x() {
      return state.x;
    },
    set x(value: number) {
      state.x = value;
      const { width } = application.screen;
      world.position.x = width / 2 - state.x * state.zoom;
    },

    get y() {
      return state.y;
    },
    set y(value: number) {
      state.y = value;
      const { height } = application.screen;
      world.position.y = height / 2 + state.y * state.zoom;
    },
    
    get zoom() {
      return state.zoom;
    },
    set zoom(value: number) {
      state.zoom = value;
      const { width, height } = application.screen;
      world.position.set(
        width / 2 - state.x * state.zoom,
        height / 2 + state.y * state.zoom,
      );
      world.scale.set(state.zoom, state.zoom);
    },

    screenToWorld,
    worldToScreen,
  };

  const { width, height } = application.screen;
  stage.position.y = height;
  world.position.set(
    width / 2 - state.x * state.zoom,
    height / 2 + state.y * state.zoom,
  );
  world.scale.set(state.zoom, state.zoom);

  const resizeObserver = new ResizeObserver(() => {
    const { width, height } = application.screen;
    stage.position.y = height;
    world.position.set(
      width / 2 - state.x * state.zoom,
      height / 2 + state.y * state.zoom,
    );
    world.scale.set(state.zoom, state.zoom);
  });
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
