import { Application } from "pixi.js";
import { update } from "../gameloop.js";
import { GameIDEMode, getMode } from "../mode.js";
import type { InputContext } from "../inputPlugin.js";

export type Viewport = {
  x: number;
  y: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type ViewportState = Pick<Viewport, "x" | "y">;

export function initializeViewport(
  app: Application,
  input: Pick<InputContext, "getButton" | "getMousePosition">,
): Viewport {
  const state: ViewportState = {
    x: 0,
    y: 0,
  };

  const viewport = new Proxy(state as Viewport, {
    get(target, key, receiver) {
      switch (key) {
        case "width":
          return app.screen.width;
        case "height":
          return app.screen.height;
        case "centerX":
          return app.screen.width / 2 + target.x;
        case "centerY":
          return app.screen.height / 2 + target.y;
        case "left":
          return target.x - app.screen.width / 2;
        case "right":
          return target.x + app.screen.width / 2;
        case "top":
          return target.y - app.screen.height / 2;
        case "bottom":
          return target.y + app.screen.height / 2;
        default:
          return Reflect.get(target, key, receiver);
      }
    },
    set(target, key, value, receiver) {
      if ((key === "x" || key === "y") && typeof value !== "number") return false;
      return Reflect.set(target, key, value, receiver);
    },
  });

  let lastDragPosition: { x: number; y: number } | null = null;
  let wasFireDown = false;

  update(() => {
    if (getMode() !== GameIDEMode.Editor) {
      lastDragPosition = null;
      wasFireDown = false;
      app.stage.position.set(viewport.centerX, viewport.centerY);
      return;
    }

    const dragPosition = input.getMousePosition();
    const isFireDown = input.getButton("Fire");
    if (!isFireDown) {
      lastDragPosition = null;
      wasFireDown = false;
      app.stage.position.set(viewport.centerX, viewport.centerY);
      return;
    }

    if (isFireDown && !wasFireDown) {
      lastDragPosition = dragPosition;
    }

    if (!dragPosition || !lastDragPosition) {
      wasFireDown = isFireDown;
      app.stage.position.set(viewport.centerX, viewport.centerY);
      return;
    }

    const deltaX = dragPosition.x - lastDragPosition.x;
    const deltaY = dragPosition.y - lastDragPosition.y;
    if (deltaX !== 0 || deltaY !== 0) {
      viewport.x += deltaX;
      viewport.y += deltaY;
      lastDragPosition = dragPosition;
    }

    wasFireDown = isFireDown;
    app.stage.position.set(viewport.centerX, viewport.centerY);
  });

  return viewport;
}
