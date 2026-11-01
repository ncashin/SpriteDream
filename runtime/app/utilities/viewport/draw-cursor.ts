import { blobBody, blobColor, blinkPhase, blinkScale, clampGaze, cursorEye, cursorEyeLeft, cursorEyeRight, gazePivot, gazePivotBack } from "../../actions/editor/ui/blobs.tsx";

const LABEL = "ncashin";
const LABEL_SAMPLES = 24;
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
  (point: { x: number; y: number }, id: string): void;
  frame(): void;
  dispose(): void;
};

export function createDrawCursor(parent: HTMLElement): DrawCursor {
  const layer = parent.ownerDocument.createElement("div");
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
    const holder = parent.ownerDocument.createElement("div");
    holder.style.position = "absolute";
    holder.style.left = "0";
    holder.style.top = "0";
    holder.style.overflow = "visible";
    holder.style.pointerEvents = "none";
    holder.style.transformOrigin = "0 0";
    const arrow = parent.ownerDocument.createElement("img");
    arrow.src = "/cursors/default.svg";
    arrow.alt = "";
    arrow.draggable = false;
    arrow.width = 13;
    arrow.height = 18;
    arrow.style.display = "block";
    arrow.style.pointerEvents = "none";
    const face = parent.ownerDocument.createElementNS(svgNS, "svg");
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
    const body = parent.ownerDocument.createElementNS(svgNS, "path");
    body.dataset.blob = "";
    body.setAttribute("fill", "#fff");
    const gaze = parent.ownerDocument.createElementNS(svgNS, "g");
    gaze.dataset.gaze = "";
    for (const shift of [cursorEyeLeft, cursorEyeRight]) {
      const eye = parent.ownerDocument.createElementNS(svgNS, "image");
      eye.dataset.eye = "";
      eye.setAttribute("href", "/faces/eyes/circle.svg");
      eye.setAttribute("x", "-8");
      eye.setAttribute("y", "-8");
      eye.setAttribute("width", "16");
      eye.setAttribute("height", "16");
      eye.setAttribute("transform", shift);
      gaze.append(eye);
    }
    face.append(body, gaze);
    const label = parent.ownerDocument.createElementNS(svgNS, "svg");
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
    const defs = parent.ownerDocument.createElementNS(svgNS, "defs");
    const gradient = parent.ownerDocument.createElementNS(svgNS, "linearGradient");
    gradient.id = gradientId;
    gradient.setAttribute("gradientUnits", "userSpaceOnUse");
    for (let stop = 0; stop < LABEL_SAMPLES; stop += 1) {
      const node = parent.ownerDocument.createElementNS(svgNS, "stop");
      node.setAttribute("offset", "0");
      node.setAttribute("stop-color", "#fff");
      gradient.append(node);
    }
    defs.append(gradient);
    const text = parent.ownerDocument.createElementNS(svgNS, "text");
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

  function frame() {
    if (disposed || open) return;
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

  function drawCursor(screen: { x: number; y: number }, id: string) {
    if (disposed) return;
    frame();

    const cursor = cursorAt(seen);
    seen += 1;
    const body = cursor.querySelector("[data-blob]");
    if (body && cursor.dataset.person !== id) {
      cursor.dataset.person = id;
      const shape = blobBody(id);
      body.setAttribute("d", shape);
      body.setAttribute("fill", blobColor(id));
      cursor.dataset.phase = String(blinkPhase(id));
      const eye = cursorEye(id);
      for (const node of cursor.querySelectorAll("[data-eye]")) node.setAttribute("href", eye);
    }
    const previousX = Number(cursor.dataset.x ?? screen.x);
    const previousY = Number(cursor.dataset.y ?? screen.y);
    cursor.dataset.x = String(screen.x);
    cursor.dataset.y = String(screen.y);
    let aimX = Number(cursor.dataset.aimX ?? 0);
    let aimY = Number(cursor.dataset.aimY ?? 0);
    let driftX = Number(cursor.dataset.driftX ?? 0);
    let driftY = Number(cursor.dataset.driftY ?? 0);
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
    cursor.style.visibility = "visible";
    cursor.style.transform = `translate(${screen.x}px, ${screen.y}px) scale(${CURSOR_SCALE})`;
  }

  drawCursor.frame = frame;
  drawCursor.dispose = () => {
    disposed = true;
    layer.remove();
  };

  return drawCursor;
}
