import type { WorldPoint } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const CURSOR_PATH =
  "M1 1 L1 17 L5.2 13.2 L8.8 20.2 L12 18.6 L8.4 11.6 L14.4 11.6 Z";

export type DrawCursor = {
  (viewport: ViewportWithTransforms, point: WorldPoint, color: string): void;
  dispose(): void;
};

export function createDrawCursor(canvas: HTMLCanvasElement): DrawCursor {
  const parent = canvas.parentElement;
  if (!parent) throw new Error("Canvas has no parent element");

  const layer = canvas.ownerDocument.createElement("div");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.overflow = "hidden";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "2";
  parent.append(layer);

  const cursors: SVGSVGElement[] = [];
  let seen = 0;
  let open = false;
  let disposed = false;

  function cursorAt(index: number) {
    const existing = cursors[index];
    if (existing) return existing;
    const svg = canvas.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "22");
    svg.setAttribute("viewBox", "0 0 16 22");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    const path = canvas.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", CURSOR_PATH);
    path.setAttribute("stroke", "#0a0a0a");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    layer.append(svg);
    cursors[index] = svg;
    return svg;
  }

  function drawCursor(viewport: ViewportWithTransforms, point: WorldPoint, color: string) {
    if (disposed) return;
    if (!open) {
      open = true;
      seen = 0;
      queueMicrotask(() => {
        open = false;
        if (disposed) return;
        for (let index = seen; index < cursors.length; index += 1) {
          const cursor = cursors[index];
          if (cursor) cursor.style.visibility = "hidden";
        }
      });
    }

    const screen = viewport.worldToScreen(point.x, point.y);
    const cursor = cursorAt(seen);
    seen += 1;
    const path = cursor.firstElementChild;
    if (path) path.setAttribute("fill", color);
    cursor.style.visibility = "visible";
    cursor.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
  }

  drawCursor.dispose = () => {
    disposed = true;
    layer.remove();
  };

  return drawCursor;
}
