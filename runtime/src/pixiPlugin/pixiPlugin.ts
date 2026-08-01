import { Application, Container, FederatedPointerEvent } from "pixi.js";
import type { GameContext } from "../initialization";
import { handleSprites } from "./sprite";

export type Viewport = { x: number; y: number; zoom: number };

export const pixiPlugin = (options: {}) => async (context: GameContext) => {
  const { rootElement, onUpdate, onDispose } = context;

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

  const updateViewport = () => {
    viewportContainer.scale.set(-viewport.zoom);
    viewportContainer.position.set(
      app.screen.width / 2 - viewport.x * viewport.zoom,
      app.screen.height / 2 - viewport.y * viewport.zoom,
    );
  };

  onUpdate(updateViewport);

  /* TEMP PAN CODE */
  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;

  let isDragging = false;
  let lastPointer = { x: 0, y: 0 };

  const onPointerDown = (event: FederatedPointerEvent) => {
    isDragging = true;
    lastPointer = { x: event.global.x, y: event.global.y };
  };

  const onPointerMove = (event: FederatedPointerEvent) => {
    if (!isDragging) return;

    const dx = event.global.x - lastPointer.x;
    const dy = event.global.y - lastPointer.y;

    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;

    lastPointer = { x: event.global.x, y: event.global.y };
  };

  const stopDragging = () => {
    isDragging = false;
  };

  app.stage.on("pointerdown", onPointerDown);
  app.stage.on("pointermove", onPointerMove);
  app.stage.on("pointerup", stopDragging);
  app.stage.on("pointerupoutside", stopDragging);

  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5;
  const ZOOM_SPEED = 0.005;

  const onWheel = (event: WheelEvent) => {
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
  };

  app.canvas.addEventListener("wheel", onWheel, { passive: false });

  handleSprites(context, viewportContainer);

  onDispose(() => {
    if (app.canvas.parentElement === rootElement) {
      rootElement.removeChild(app.canvas);
    }

    app.destroy(true, {
      children: true,
      texture: true,
    });
  });

  if (import.meta.hot) {
    import.meta.hot.accept((newModule) => {
      if (!newModule?.pixiPlugin) return;
      context.__run.rerun(newModule.pixiPlugin(options));
    });
  }

  return { ...context, viewport };
};
