import type { GameObject } from "../../actions/editor/object-tree.tsx";
import { selectObjects } from "../selected-objects.ts";
import { isWheelPassthrough } from "./draw-bounding-box.tsx";
import type { ViewportOptions } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const CLICK_SLOP = 4;

export function curryViewportEvents(
  viewportWithTransforms: ViewportWithTransforms,
  options?: ViewportOptions,
) {
  const signal = options?.signal;
  const canvas = viewportWithTransforms.state.canvas;
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
    const object = options?.handleSelection?.(
      viewportWithTransforms.screenToWorld(event.clientX, event.clientY),
    );
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
    const object = drag.object;
    const moved = drag.moved;
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
    const object = options?.handleSelection?.(
      viewportWithTransforms.screenToWorld(event.clientX, event.clientY),
    );
    options?.handleHoverSelectable?.(object !== undefined);
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

  canvas.addEventListener("pointerdown", onPointerDown, { signal });
  canvas.addEventListener("pointermove", onPointerMove, { signal });
  canvas.addEventListener("pointerup", onPointerUp, { signal });
  canvas.addEventListener("pointercancel", onPointerCancel, { signal });
  canvas.addEventListener("pointerleave", onPointerLeave, { signal });
  const wheelSurface = canvas.parentElement ?? canvas;
  wheelSurface.addEventListener("wheel", onWheel, { passive: false, signal });
  wheelSurface.addEventListener("pointerdown", trackCursor, { signal });
  wheelSurface.addEventListener("pointermove", trackCursor, { signal });
}
