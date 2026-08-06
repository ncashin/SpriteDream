import { Container, type Application, type FederatedPointerEvent } from "pixi.js";
import type { GameContext } from "../tomove/gameide";

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export const handleViewport = (context: GameContext, app: Application) => {
  const { onUpdate, isEditor } = context;
  const viewportContainer = new Container();
  viewportContainer.sortableChildren = true;

  const viewport: Viewport = {
    x: 0,
    y: 0,
    zoom: 1,
  };

  app.stage.addChild(viewportContainer);

  const updateViewport = () => {
    viewportContainer.scale.set(-viewport.zoom);
    viewportContainer.position.set(
      app.screen.width / 2 - viewport.x * viewport.zoom,
      app.screen.height / 2 - viewport.y * viewport.zoom,
    );
  };

  onUpdate(updateViewport);

  if (!isEditor) {
    return {
      viewport,
      viewportContainer,
    };
  }

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };

  const onPointerDown = (event: FederatedPointerEvent) => {
    isDragging = true;
    lastPointer = {
      x: event.global.x,
      y: event.global.y,
    };

    app.canvas.style.cursor = "grabbing";
  };

  const onPointerMove = (event: FederatedPointerEvent) => {
    if (!isDragging) return;

    const dx = event.global.x - lastPointer.x;
    const dy = event.global.y - lastPointer.y;

    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;

    lastPointer = {
      x: event.global.x,
      y: event.global.y,
    };
  };

  const stopDragging = () => {
    isDragging = false;

    app.canvas.style.cursor = "default";
  };

  app.stage.on("pointerdown", onPointerDown);
  app.stage.on("pointermove", onPointerMove);
  app.stage.on("pointerup", stopDragging);
  app.stage.on("pointerupoutside", stopDragging);

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();

    const rect = app.canvas.getBoundingClientRect();

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;

    const oldZoom = viewport.zoom;

    const newZoom = Math.min(5, Math.max(0.1, oldZoom * (1 - event.deltaY * 0.005)));

    if (newZoom === oldZoom) return;

    const worldX = viewport.x + (pointerX - app.screen.width / 2) / oldZoom;

    const worldY = viewport.y + (pointerY - app.screen.height / 2) / oldZoom;

    viewport.zoom = newZoom;

    viewport.x = worldX - (pointerX - app.screen.width / 2) / newZoom;

    viewport.y = worldY - (pointerY - app.screen.height / 2) / newZoom;
  };

  app.canvas.addEventListener("wheel", onWheel, {
    passive: false,
  });

  return {
    viewport,
    viewportContainer,
  };
};
