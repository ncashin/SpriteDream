import { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { GameContext } from "../initialization";
import { handleSprites } from "./sprite";

export type Viewport = { x: number; y: number; zoom: number };

export const pixiPlugin = () => async (context: GameContext) => {
  const { rootElement, onUpdate } = context;

  const app = new Application();

  await app.init({
    antialias: true,
    resizeTo: rootElement,
    background: 0x222222,
  });

  rootElement.append(app.canvas);

  const viewportContainer = new Container();
  app.stage.addChild(viewportContainer);

  const viewport: Viewport = { x: 0, y: 0, zoom: 1 };
  onUpdate(() => {
    viewportContainer.scale.set(-viewport.zoom);
    viewportContainer.position.set(
      app.screen.width / 2 - viewport.x * viewport.zoom,
      app.screen.height / 2 - viewport.y * viewport.zoom,
    );
  });

  /* TEMP PAN CODE */
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };

  app.stage.on("pointerdown", (event: FederatedPointerEvent) => {
    isDragging = true;
    lastPointer = { x: event.global.x, y: event.global.y };
  });

  app.stage.on("pointermove", (event: FederatedPointerEvent) => {
    if (!isDragging) return;

    const dx = event.global.x - lastPointer.x;
    const dy = event.global.y - lastPointer.y;

    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;

    lastPointer = { x: event.global.x, y: event.global.y };
  });

  const stopDragging = () => {
    isDragging = false;
  };
  app.stage.on("pointerup", stopDragging);
  app.stage.on("pointerupoutside", stopDragging);

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_SPEED = 0.005;
  app.canvas.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      event.preventDefault();

      const rect = app.canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      const oldZoom = viewport.zoom;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, oldZoom * (1 - event.deltaY * ZOOM_SPEED)),
      );

      if (newZoom === oldZoom) return;

      const worldX = viewport.x + (pointerX - app.screen.width / 2) / oldZoom;
      const worldY = viewport.y + (pointerY - app.screen.height / 2) / oldZoom;

      viewport.zoom = newZoom;

      viewport.x = worldX - (pointerX - app.screen.width / 2) / newZoom;
      viewport.y = worldY - (pointerY - app.screen.height / 2) / newZoom;
    },
    { passive: false },
  );

  handleSprites(context, viewportContainer);

  return { ...context, viewport };
};
