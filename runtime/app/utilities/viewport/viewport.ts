import type { GameObject } from "../../actions/editor/object-tree.tsx";
import { selectObjects } from "../selected-objects.ts";

export type Viewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorldPoint = { x: number; y: number };

type ViewportOptions = {
  signal?: AbortSignal;
  handleSelection?: (point: WorldPoint) => GameObject | undefined;
  handleHoverSelectable?: (hovering: boolean) => void;
};

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const WHEEL_ZOOM = 0.002;
const CLICK_SLOP = 4;

export function createViewport(): Viewport {
  return { x: 0, y: 0, zoom: 1 };
}

export const defaultViewport = createViewport();

export function screenToWorld(viewport: Viewport, x: number, y: number) {
  return {
    x: x / viewport.zoom + viewport.x,
    y: y / viewport.zoom + viewport.y,
  };
}

export function worldToScreen(viewport: Viewport, x: number, y: number) {
  return {
    x: (x - viewport.x) * viewport.zoom,
    y: (y - viewport.y) * viewport.zoom,
  };
}

export function worldToScreenMatrix(viewport: Viewport, transform: DOMMatrix) {
  let zoom = viewport.zoom;
  return new DOMMatrix()
    .translate(-viewport.x * zoom, -viewport.y * zoom)
    .scale(zoom, zoom)
    .multiply(transform);
}

export function panBy(viewport: Viewport, screenDx: number, screenDy: number) {
  viewport.x -= screenDx / viewport.zoom;
  viewport.y -= screenDy / viewport.zoom;
}

export function zoomAt(viewport: Viewport, screenX: number, screenY: number, nextZoom: number) {
  let anchor = screenToWorld(viewport, screenX, screenY);
  viewport.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  viewport.x = anchor.x - screenX / viewport.zoom;
  viewport.y = anchor.y - screenY / viewport.zoom;
}

export function zoomFromWheel(
  viewport: Viewport,
  screenX: number,
  screenY: number,
  deltaY: number,
  deltaMode = 0,
) {
  let pixels = deltaY;
  if (deltaMode === 1) pixels *= 16;
  else if (deltaMode === 2) pixels *= 400;
  zoomAt(viewport, screenX, screenY, viewport.zoom * Math.exp(-pixels * WHEEL_ZOOM));
}

export function viewport(canvas: HTMLCanvasElement, options?: ViewportOptions) {
  let signal = options?.signal;
  let drag: {
    id: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
    object: GameObject | undefined;
  } | null = null;

  function onCanvasSurface(event: Event) {
    return event.target === canvas;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !onCanvasSurface(event)) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is only available for an active pointer.
    }
    let object = options?.handleSelection?.(pointerWorld(canvas, event));
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
      object,
    };
    if (object === undefined) canvas.style.cursor = "grabbing";
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) {
      if (onCanvasSurface(event)) updateHover(event);
      return;
    }
    if (!drag.moved) {
      let dx = event.clientX - drag.originX;
      let dy = event.clientY - drag.originY;
      if (dx * dx + dy * dy <= CLICK_SLOP * CLICK_SLOP) return;
      drag.moved = true;
      canvas.style.cursor = "grabbing";
    }
    panBy(defaultViewport, event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  function onPointerUp(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    let object = drag.object;
    let moved = drag.moved;
    drag = null;
    canvas.style.cursor = "";
    if (!moved) selectObjects(object === undefined ? [] : [object]);
    updateHover(event);
  }

  function onPointerCancel(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    canvas.style.cursor = "";
    updateHover(event);
  }

  function onPointerLeave() {
    if (drag) return;
    options?.handleHoverSelectable?.(false);
  }

  function updateHover(event: PointerEvent) {
    if (drag) return;
    let object = options?.handleSelection?.(pointerWorld(canvas, event));
    options?.handleHoverSelectable?.(object !== undefined);
  }

  function onWheel(event: WheelEvent) {
    if (!onCanvasSurface(event)) return;
    event.preventDefault();
    let rect = canvas.getBoundingClientRect();
    zoomFromWheel(
      defaultViewport,
      event.clientX - rect.left,
      event.clientY - rect.top,
      event.deltaY,
      event.deltaMode,
    );
  }

  canvas.addEventListener("pointerdown", onPointerDown, { signal });
  canvas.addEventListener("pointermove", onPointerMove, { signal });
  canvas.addEventListener("pointerup", onPointerUp, { signal });
  canvas.addEventListener("pointercancel", onPointerCancel, { signal });
  canvas.addEventListener("pointerleave", onPointerLeave, { signal });
  canvas.addEventListener("wheel", onWheel, { passive: false, signal });

  return {
    get context() {
      fitCanvas(canvas);
      let context = canvas.getContext("2d");
      if (!context) throw new Error("2D canvas context is unavailable");

      context.imageSmoothingEnabled = false;
      let ratio = devicePixelRatio();
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

      let scale = ratio * defaultViewport.zoom;
      context.setTransform(
        scale,
        0,
        0,
        scale,
        -defaultViewport.x * scale,
        -defaultViewport.y * scale,
      );
      return context;
    },
  };
}

function devicePixelRatio() {
  return window.devicePixelRatio || 1;
}

function fitCanvas(canvas: HTMLCanvasElement) {
  let rect = canvas.getBoundingClientRect();
  let width = Math.max(1, Math.floor(rect.width));
  let height = Math.max(1, Math.floor(rect.height));
  let ratio = devicePixelRatio();
  let bufferWidth = Math.floor(width * ratio);
  let bufferHeight = Math.floor(height * ratio);
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }
}

function pointerWorld(canvas: HTMLCanvasElement, event: PointerEvent) {
  let rect = canvas.getBoundingClientRect();
  return screenToWorld(defaultViewport, event.clientX - rect.left, event.clientY - rect.top);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
