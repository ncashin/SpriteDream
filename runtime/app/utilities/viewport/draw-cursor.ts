import { blobColor, blobPath, ink, leftEye, rightEye, smile } from "../../actions/editor/blobs.tsx";
import type { WorldPoint } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const CURSOR_PATH = "M0 0 L0 17 L4 13 L7 20 L10 19 L7 12 L13 12 Z";
const LABEL = "ncashin";
const LABEL_X = 16;
const LABEL_Y = 10;
const FACE_WIDTH = 18;
const FACE_HEIGHT = 18;
const CURSOR_SCALE = 0.8;

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

  const cursors: HTMLDivElement[] = [];
  let seen = 0;
  let open = false;
  let disposed = false;

  function cursorAt(index: number) {
    const existing = cursors[index];
    if (existing) return existing;
    const holder = canvas.ownerDocument.createElement("div");
    holder.style.position = "absolute";
    holder.style.left = "0";
    holder.style.top = "0";
    holder.style.overflow = "visible";
    holder.style.pointerEvents = "none";
    holder.style.transformOrigin = "0 0";
    const svg = canvas.ownerDocument.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "13");
    svg.setAttribute("height", "18");
    svg.setAttribute("viewBox", "-1.5 -1.5 16 23");
    svg.style.display = "block";
    svg.style.overflow = "visible";
    svg.style.pointerEvents = "none";
    const path = canvas.ownerDocument.createElementNS(svgNS, "path");
    path.setAttribute("d", CURSOR_PATH);
    path.setAttribute("fill", "#000");
    path.setAttribute("stroke", "#fff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "miter");
    path.setAttribute("stroke-miterlimit", "10");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    path.setAttribute("paint-order", "stroke fill");
    svg.append(path);
    const face = canvas.ownerDocument.createElementNS(svgNS, "svg");
    face.setAttribute("viewBox", "0 0 64 64");
    face.setAttribute("width", String(FACE_WIDTH));
    face.setAttribute("height", String(FACE_HEIGHT));
    face.style.position = "absolute";
    face.style.left = `${LABEL_X / CURSOR_SCALE}px`;
    face.style.top = `${(LABEL_Y - 2) / CURSOR_SCALE}px`;
    face.style.overflow = "visible";
    face.style.pointerEvents = "none";
    face.style.transformOrigin = "0 0";
    face.style.transform = `scale(${1 / CURSOR_SCALE})`;
    const body = canvas.ownerDocument.createElementNS(svgNS, "path");
    body.dataset.blob = "";
    body.setAttribute("fill", "#fff");
    for (const eye of [leftEye, rightEye]) {
      const pupil = canvas.ownerDocument.createElementNS(svgNS, "path");
      pupil.setAttribute("d", eye);
      pupil.setAttribute("fill", ink);
      face.append(pupil);
    }
    const mouth = canvas.ownerDocument.createElementNS(svgNS, "path");
    mouth.setAttribute("d", smile);
    mouth.setAttribute("fill", "none");
    mouth.setAttribute("stroke", ink);
    mouth.setAttribute("stroke-width", "7");
    mouth.setAttribute("stroke-linecap", "round");
    face.append(mouth);
    face.prepend(body);
    const label = canvas.ownerDocument.createElementNS(svgNS, "svg");
    label.setAttribute("width", "72");
    label.setAttribute("height", "16");
    label.style.position = "absolute";
    label.style.left = `${(LABEL_X + FACE_WIDTH + 4) / CURSOR_SCALE}px`;
    label.style.top = `${LABEL_Y / CURSOR_SCALE}px`;
    label.style.overflow = "visible";
    label.style.pointerEvents = "none";
    label.style.transformOrigin = "0 0";
    label.style.transform = `scale(${1 / CURSOR_SCALE})`;
    const gradientId = `cursor-label-${index}`;
    const defs = canvas.ownerDocument.createElementNS(svgNS, "defs");
    const gradient = canvas.ownerDocument.createElementNS(svgNS, "linearGradient");
    gradient.id = gradientId;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    for (let stop = 0; stop < LABEL_SAMPLES; stop += 1) {
      const node = canvas.ownerDocument.createElementNS(svgNS, "stop");
      node.setAttribute("offset", "0");
      node.setAttribute("stop-color", "#fff");
      gradient.append(node);
    }
    defs.append(gradient);
    const text = canvas.ownerDocument.createElementNS(svgNS, "text");
    text.textContent = LABEL;
    text.setAttribute("x", "0");
    text.setAttribute("y", "12");
    text.setAttribute("fill", `url(#${gradientId})`);
    text.setAttribute("font-size", "12");
    text.setAttribute("font-family", "sans-serif");
    label.append(defs, text);
    holder.append(svg, face, label);
    layer.append(holder);
    cursors[index] = holder;
    return holder;
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
    const body = cursor.querySelector("[data-blob]");
    if (body && cursor.dataset.person !== id) {
      cursor.dataset.person = id;
      body.setAttribute("d", blobPath(id));
      body.setAttribute("fill", blobColor(id));
    }
    const text = cursor.querySelector("text");
    const labelX = screen.x + LABEL_X + FACE_WIDTH + 4;
    if (text) contrastLabel(canvas, text, labelX, screen.y + LABEL_Y);
    cursor.style.visibility = "visible";
    cursor.style.transform = `translate(${screen.x}px, ${screen.y}px) scale(${CURSOR_SCALE})`;
  }

  drawCursor.dispose = () => {
    disposed = true;
    layer.remove();
  };

  return drawCursor;
}

const LABEL_SAMPLES = 24;
const PAGE = { r: 28, g: 28, b: 30 };

function contrastLabel(canvas: HTMLCanvasElement, text: SVGTextElement, x: number, y: number) {
  const gradient = text.ownerSVGElement?.querySelector("linearGradient");
  if (!gradient) return;
  const box = text.getBBox();
  const width = Math.max(box.width, 1);
  gradient.setAttribute("x1", String(box.x));
  gradient.setAttribute("x2", String(box.x + width));
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("y2", "0");
  const stops = gradient.children;
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    if (!(stop instanceof SVGStopElement)) continue;
    const across = stops.length === 1 ? 0 : index / (stops.length - 1);
    const column = Math.max(1, width / stops.length);
    const luminance = luminanceAt(canvas, x + box.x + width * across, y + box.y, column, box.height);
    const shade = Math.round(255 * (1 - smooth(luminance)));
    const color = `rgb(${shade} ${shade} ${shade})`;
    stop.setAttribute("offset", String(across));
    stop.setAttribute("stop-color", color);
  }
}

function smooth(luminance: number) {
  const t = Math.min(1, Math.max(0, (luminance - 0.28) / 0.34));
  return t * t * (3 - 2 * t);
}

function luminanceAt(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number) {
  const context = canvas.getContext("2d");
  if (!context) return 0;
  const ratio = window.devicePixelRatio || 1;
  const sx = Math.max(0, Math.floor(x * ratio));
  const sy = Math.max(0, Math.floor(y * ratio));
  const sw = Math.min(canvas.width - sx, Math.max(1, Math.ceil(Math.max(width, 1) * ratio)));
  const sh = Math.min(canvas.height - sy, Math.max(1, Math.ceil(Math.max(height, 1) * ratio)));
  if (sw <= 0 || sh <= 0) return 0;
  const pixels = context.getImageData(sx, sy, sw, sh).data;
  let light = 0;
  let count = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const alpha = (pixels[index + 3] ?? 0) / 255;
    const red = (pixels[index] ?? 0) * alpha + PAGE.r * (1 - alpha);
    const green = (pixels[index + 1] ?? 0) * alpha + PAGE.g * (1 - alpha);
    const blue = (pixels[index + 2] ?? 0) * alpha + PAGE.b * (1 - alpha);
    light += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    count += 1;
  }
  return count === 0 ? 0 : light / count;
}
