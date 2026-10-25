import { isWheelPassthrough } from "./draw-bounding-box.tsx";
import type { ViewportOptions } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const CLICK_SLOP = 4;

export function curryViewportEventListeners(
  viewportWithTransforms: ViewportWithTransforms,
  options?: ViewportOptions,
) {
  const canvas = viewportWithTransforms.state.canvas;
  let drag: {
    id: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
    moved: boolean;
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
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: event.clientX,
      originY: event.clientY,
      moved: false,
    };
  }

  function onPointerMove(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) {
      if (onCanvasSurface(event)) updateHover(event);
      return;
    }
    if (!drag.moved) {
      const dx = event.clientX - drag.originX;
      const dy = event.clientY - drag.originY;
      if (dx * dx + dy * dy <= CLICK_SLOP * CLICK_SLOP) return;
      drag.moved = true;
      canvas.style.cursor = "grabbing";
    }
    viewportWithTransforms.panBy(event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
  }

  function onPointerUp(event: PointerEvent) {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    canvas.style.cursor = "";
    if (!moved) {
      options?.onWorldClick?.(
        viewportWithTransforms.screenToWorld(event.clientX, event.clientY),
      );
    }
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
    canvas.style.cursor = "";
  }

  function updateHover(event: PointerEvent) {
    if (drag) return;
    options?.onWorldHover?.(
      viewportWithTransforms.screenToWorld(event.clientX, event.clientY),
    );
  }

  function onWheel(event: WheelEvent) {
    if (event.target !== canvas && !isWheelPassthrough(event.target)) return;
    event.preventDefault();
    viewportWithTransforms.zoomFromWheel(
      event.clientX,
      event.clientY,
      event.deltaY,
      event.deltaMode,
    );
  }

  function trackCursor(event: PointerEvent) {
    viewportWithTransforms.state.cursorPoint = viewportWithTransforms.screenToWorld(
      event.clientX,
      event.clientY,
    );
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerLeave);
  const wheelSurface = canvas.parentElement ?? canvas;
  wheelSurface.addEventListener("wheel", onWheel, { passive: false });
  wheelSurface.addEventListener("pointerdown", trackCursor);
  wheelSurface.addEventListener("pointermove", trackCursor);

  return () => {
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerCancel);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    wheelSurface.removeEventListener("wheel", onWheel);
    wheelSurface.removeEventListener("pointerdown", trackCursor);
    wheelSurface.removeEventListener("pointermove", trackCursor);
  };
}
