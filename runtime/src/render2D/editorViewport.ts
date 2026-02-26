import { Application } from "pixi.js";
import invariant from "tiny-invariant";

import type { ViewportState } from "./viewport";

export type EditorViewportOptions = {
  minScale?: number;
  maxScale?: number;
  wheelZoomSpeed?: number;
};

const DEFAULT_OPTIONS: Required<EditorViewportOptions> = {
  minScale: 0.1,
  maxScale: 10,
  wheelZoomSpeed: 0.002,
};

export function setupEditorViewport(
  application: Application,
  viewport: ViewportState,
  options: EditorViewportOptions = {},
): { destroy: () => void } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const canvas = application.canvas;
  invariant(canvas instanceof HTMLCanvasElement, "application.canvas must be an HTMLCanvasElement");

  let isDragging = false;
  let lastClientX = 0;
  let lastClientY = 0;

  function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const { width: screenW, height: screenH } = application.screen;
    const scaleX = screenW / rect.width;
    const scaleY = screenH / rect.height;
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
    viewport.x -= dx / viewport.zoom;
    viewport.y -= dy / viewport.zoom;
  }

  function handlePointerUp(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = false;
    canvas.releasePointerCapture(e.pointerId);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const screenSize = application.screen;
    const { x: cursorX, y: cursorY } = clientToCanvas(e.clientX, e.clientY);
    const worldUnderCursor = viewport.screenToWorld({ x: cursorX, y: cursorY });
    const delta = -e.deltaY * opts.wheelZoomSpeed;
    const newZoom = Math.min(
      opts.maxScale,
      Math.max(opts.minScale, viewport.zoom + delta),
    );
    const zoomChanged = newZoom !== viewport.zoom;
    if (zoomChanged) {
      viewport.x = worldUnderCursor.x - (cursorX - screenSize.width / 2) / newZoom;
      viewport.y = worldUnderCursor.y - (cursorY - screenSize.height / 2) / newZoom;
      viewport.zoom = newZoom;
    }
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
  }

  return { destroy };
}
