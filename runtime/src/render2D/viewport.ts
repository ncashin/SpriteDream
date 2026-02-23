import { Application, Container } from "pixi.js";

export type ViewportOptions = {
  minScale?: number;
  maxScale?: number;
  wheelZoomSpeed?: number;
};

const DEFAULT_OPTIONS: Required<ViewportOptions> = {
  minScale: 0.1,
  maxScale: 10,
  wheelZoomSpeed: 0.002,
};

export type Viewport = {
  world: Container;
  destroy: () => void;
};

export function setupViewport(
  application: Application,
  options: ViewportOptions = {},
): Viewport {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const world = new Container();
  const stage = application.stage;
  stage.removeChildren();
  stage.addChild(world);

  const canvas = application.canvas as HTMLCanvasElement;
  const { width, height } = application.screen;
  world.position.set(width / 2, height / 2);
  let isDragging = false;
  let lastClientX = 0;
  let lastClientY = 0;

  function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - lastClientX;
    const dy = e.clientY - lastClientY;
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    world.position.x += dx;
    world.position.y += dy;
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const { x: cursorX, y: cursorY } = clientToCanvas(e.clientX, e.clientY);
    const worldX = (cursorX - world.position.x) / world.scale.x;
    const worldY = (cursorY - world.position.y) / world.scale.y;
    const delta = -e.deltaY * opts.wheelZoomSpeed;
    const newScale = Math.min(
      opts.maxScale,
      Math.max(opts.minScale, world.scale.x + delta),
    );
    world.scale.set(newScale, newScale);
    world.position.x = cursorX - worldX * newScale;
    world.position.y = cursorY - worldY * newScale;
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointerleave", handlePointerUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  function destroy() {
    canvas.removeEventListener("pointerdown", handlePointerDown);
    canvas.removeEventListener("pointermove", handlePointerMove);
    canvas.removeEventListener("pointerup", handlePointerUp);
    canvas.removeEventListener("pointerleave", handlePointerUp);
    canvas.removeEventListener("wheel", handleWheel);
    stage.removeChild(world);
    world.destroy({ children: true });
  }

  return { world, destroy };
}
