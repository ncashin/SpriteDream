import { blobBody, blobColor, blinkPhase, blinkScale, clampGaze, cursorEyeLeft, cursorEyeRight, cursorSymbol, GAZE_LOOK, gazePivot, gazePivotBack, ink } from "../../actions/editor/blobs.tsx";
import type { WorldPoint } from "./viewport.ts";
import type { ViewportWithTransforms } from "./viewportTransforms.ts";

const LABEL = "ncashin";
const LABEL_X = 16;
const LABEL_Y = 10;
const LABEL_HEIGHT = 16;
const FACE_WIDTH = 22;
const FACE_HEIGHT = 22;
const FACE_TOP = LABEL_Y - 2;
const LABEL_TOP = FACE_TOP + (FACE_HEIGHT - LABEL_HEIGHT) / 2;
const CURSOR_SCALE = 0.8;
const GAZE_MOVE = 18;

const svgNS = "http://www.w3.org/2000/svg";

export type DrawCursor = {
  (viewport: ViewportWithTransforms, point: WorldPoint, id: string, look?: WorldPoint): void;
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
    const arrow = canvas.ownerDocument.createElement("img");
    arrow.src = "/cursors/default.svg";
    arrow.alt = "";
    arrow.draggable = false;
    arrow.width = 13;
    arrow.height = 18;
    arrow.style.display = "block";
    arrow.style.pointerEvents = "none";
    const face = canvas.ownerDocument.createElementNS(svgNS, "svg");
    face.dataset.face = "";
    face.setAttribute("viewBox", "0 0 100 100");
    face.setAttribute("width", String(FACE_WIDTH));
    face.setAttribute("height", String(FACE_HEIGHT));
    face.style.position = "absolute";
    face.style.left = `${LABEL_X / CURSOR_SCALE}px`;
    face.style.top = `${FACE_TOP / CURSOR_SCALE}px`;
    face.style.overflow = "visible";
    face.style.pointerEvents = "none";
    face.style.transformOrigin = "50% 50%";
    face.style.transform = `scale(${1 / CURSOR_SCALE})`;
    const body = canvas.ownerDocument.createElementNS(svgNS, "path");
    body.dataset.blob = "";
    body.setAttribute("fill", "#fff");
    const gaze = canvas.ownerDocument.createElementNS(svgNS, "g");
    gaze.dataset.gaze = "";
    for (const shift of [cursorEyeLeft, cursorEyeRight]) {
      const eye = canvas.ownerDocument.createElementNS(svgNS, "path");
      eye.dataset.eye = "";
      eye.setAttribute("fill", ink);
      eye.setAttribute("fill-rule", "evenodd");
      eye.setAttribute("transform", shift);
      gaze.append(eye);
    }
    face.append(body, gaze);
    const label = canvas.ownerDocument.createElementNS(svgNS, "svg");
    label.setAttribute("width", "72");
    label.setAttribute("height", String(LABEL_HEIGHT));
    label.style.position = "absolute";
    label.style.left = `${(LABEL_X + FACE_WIDTH + 4) / CURSOR_SCALE}px`;
    label.style.top = `${LABEL_TOP / CURSOR_SCALE}px`;
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
    text.setAttribute("y", String(LABEL_HEIGHT / 2));
    text.setAttribute("dominant-baseline", "central");
    text.setAttribute("fill", `url(#${gradientId})`);
    text.setAttribute("font-size", "12");
    text.setAttribute("font-family", "sans-serif");
    label.append(defs, text);
    holder.append(arrow, face, label);
    layer.append(holder);
    cursors[index] = holder;
    return holder;
  }

  function drawCursor(viewport: ViewportWithTransforms, point: WorldPoint, id: string, look?: WorldPoint) {
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
      const shape = blobBody(id);
      body.setAttribute("d", shape);
      body.setAttribute("fill", blobColor(id));
      cursor.dataset.phase = String(blinkPhase(id));
      const symbol = cursorSymbol(id);
      for (const eye of cursor.querySelectorAll("[data-eye]")) eye.setAttribute("d", symbol);
    }
    const previousX = Number(cursor.dataset.x ?? screen.x);
    const previousY = Number(cursor.dataset.y ?? screen.y);
    cursor.dataset.x = String(screen.x);
    cursor.dataset.y = String(screen.y);
    let aimX = Number(cursor.dataset.aimX ?? 0);
    let aimY = Number(cursor.dataset.aimY ?? 0);
    let driftX = Number(cursor.dataset.driftX ?? 0);
    let driftY = Number(cursor.dataset.driftY ?? 0);
    if (look) {
      const target = viewport.worldToScreen(look.x, look.y);
      const faceX = screen.x + LABEL_X + (FACE_WIDTH / 2) * CURSOR_SCALE;
      const faceY = screen.y + FACE_TOP + (FACE_HEIGHT / 2) * CURSOR_SCALE;
      const aim = clampGaze(target.x - faceX, target.y - faceY, GAZE_LOOK);
      driftX = aim.x;
      driftY = aim.y;
    } else {
      const movedX = screen.x - previousX;
      const movedY = screen.y - previousY;
      if (Math.hypot(movedX, movedY) >= 0.5) {
        const aim = clampGaze(movedX, movedY, GAZE_MOVE);
        driftX = aim.x;
        driftY = aim.y;
      } else {
        driftX *= 0.994;
        driftY *= 0.994;
      }
    }
    const follow = driftY < aimY ? 0.28 : 0.08;
    aimX += (driftX - aimX) * follow;
    aimY += (driftY - aimY) * follow;
    cursor.dataset.driftX = String(driftX);
    cursor.dataset.driftY = String(driftY);
    cursor.dataset.aimX = String(aimX);
    cursor.dataset.aimY = String(aimY);
    const time = performance.now() / 1000;
    const phase = Number(cursor.dataset.phase ?? 0);
    const gaze = cursor.querySelector("[data-gaze]");
    if (gaze) {
      const blink = blinkScale(time, phase);
      gaze.setAttribute(
        "transform",
        `translate(${aimX.toFixed(2)} ${aimY.toFixed(2)}) ${gazePivot} scale(1 ${blink}) ${gazePivotBack}`,
      );
    }
    const text = cursor.querySelector("text");
    const labelX = screen.x + LABEL_X + FACE_WIDTH + 4;
    if (text) contrastLabel(canvas, text, labelX, screen.y + LABEL_TOP);
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
