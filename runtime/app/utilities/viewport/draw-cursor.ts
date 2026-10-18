import { blobColor, blobPath } from "../../actions/editor/blobs.tsx";
import type { WorldPoint } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const CURSOR_PATH =
  "M1 1 L1 17 L5.2 13.2 L8.8 20.2 L12 18.6 L8.4 11.6 L14.4 11.6 Z";

const svgNS = "http://www.w3.org/2000/svg";

export type DrawCursor = {
  (viewport: ViewportWithTransforms, point: WorldPoint, id: string): void;
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
    const svg = canvas.ownerDocument.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "36");
    svg.setAttribute("height", "28");
    svg.setAttribute("viewBox", "0 0 36 28");
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    const path = canvas.ownerDocument.createElementNS(svgNS, "path");
    path.setAttribute("d", CURSOR_PATH);
    path.setAttribute("fill", "#f4f4f5");
    path.setAttribute("stroke", "#0a0a0a");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-linejoin", "round");
    const face = canvas.ownerDocument.createElementNS(svgNS, "g");
    face.setAttribute("transform", "translate(16 8) scale(0.14)");
    const blob = canvas.ownerDocument.createElementNS(svgNS, "path");
    blob.setAttribute("stroke", "black");
    blob.setAttribute("stroke-width", "4");
    blob.setAttribute("stroke-linejoin", "round");
    const leftEye = canvas.ownerDocument.createElementNS(svgNS, "path");
    leftEye.setAttribute(
      "d",
      "M19 112C28.4 112 36 104.4 36 95C36 85.6 28.4 78 19 78C9.6 78 2 85.6 2 95C2 104.4 9.6 112 19 112Z",
    );
    leftEye.setAttribute("fill", "#D9D9D9");
    leftEye.setAttribute("stroke", "black");
    leftEye.setAttribute("stroke-width", "4");
    const rightEye = canvas.ownerDocument.createElementNS(svgNS, "path");
    rightEye.setAttribute(
      "d",
      "M82 112C91.4 112 99 104.4 99 95C99 85.6 91.4 78 82 78C72.6 78 65 85.6 65 95C65 104.4 72.6 112 82 112Z",
    );
    rightEye.setAttribute("fill", "#D9D9D9");
    rightEye.setAttribute("stroke", "black");
    rightEye.setAttribute("stroke-width", "4");
    face.append(blob, leftEye, rightEye);
    svg.append(path, face);
    layer.append(svg);
    cursors[index] = svg;
    return svg;
  }

  function drawCursor(viewport: ViewportWithTransforms, point: WorldPoint, id: string) {
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
    const blob = cursor.querySelector("g path");
    if (blob) {
      blob.setAttribute("d", blobPath(id));
      blob.setAttribute("fill", blobColor(id));
    }
    cursor.style.visibility = "visible";
    cursor.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
  }

  drawCursor.dispose = () => {
    disposed = true;
    layer.remove();
  };

  return drawCursor;
}
