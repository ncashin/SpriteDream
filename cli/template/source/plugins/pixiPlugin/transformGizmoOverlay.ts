import { Container, Graphics } from "pixi.js";
import {
  getScene,
  onEditorUpdate,
  selectedObject,
  type GameObject,
} from "gameide";
import {
  getTransformGizmoTool,
  subscribeTransformGizmoTool,
} from "../../editor/components/transformGizmoTool.js";
import type {
  PixiViewportInput,
  ViewportController,
} from "./viewport.js";

type Vector2 = {
  x: number;
  y: number;
};

type TransformSnapshot = {
  positionX: number;
  positionY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
};

type MutableTransformObject = GameObject & {
  position?: { __icon?: string; x?: number; y?: number; z?: number };
  rotation?: { __icon?: string; x?: number; y?: number; z?: number };
  scale?: { __icon?: string; x?: number; y?: number; z?: number };
};

type GizmoHandle =
  | "translate-x"
  | "translate-y"
  | "translate-xy"
  | "rotate-z"
  | "scale-x"
  | "scale-y"
  | "scale-uniform";

type DragState = {
  handle: GizmoHandle;
  object: GameObject;
  origin: Vector2;
  startClient: Vector2;
  startTransform: TransformSnapshot;
  startWorld: Vector2;
  startAngle?: number;
};

type RotateDragVisual = {
  startAngle: number;
  currentAngle: number;
};

export type TransformGizmoOverlayOptions = {
  input: PixiViewportInput;
  viewport: ViewportController;
  rootElement: HTMLElement;
  /** Draw above the world layer. */
  zIndex?: number;
};

export type TransformGizmoOverlayController = {
  shouldSuppressViewportGesture: () => boolean;
  unsubscribe: () => void;
};

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function findTopLevelSceneKey(object: GameObject): PropertyKey | undefined {
  const live = getScene().get() as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(live)) {
    if (Reflect.get(live, key) === object) return key;
  }
  return undefined;
}

function readTransform(object: GameObject): TransformSnapshot {
  const transform = object as MutableTransformObject;
  return {
    positionX: finiteNumberOr(transform.position?.x, 0),
    positionY: finiteNumberOr(transform.position?.y, 0),
    rotationZ: finiteNumberOr(transform.rotation?.z, 0),
    scaleX: finiteNumberOr(transform.scale?.x, 1),
    scaleY: finiteNumberOr(transform.scale?.y, 1),
  };
}

function ensurePosition(
  object: GameObject,
): NonNullable<MutableTransformObject["position"]> {
  const transform = object as MutableTransformObject;
  if (!transform.position || typeof transform.position !== "object") {
    transform.position = { __icon: "move-3d", x: 0, y: 0, z: 0 };
  }
  return transform.position;
}

function ensureRotation(
  object: GameObject,
): NonNullable<MutableTransformObject["rotation"]> {
  const transform = object as MutableTransformObject;
  if (!transform.rotation || typeof transform.rotation !== "object") {
    transform.rotation = { __icon: "rotate-3d", x: 0, y: 0, z: 0 };
  }
  return transform.rotation;
}

function ensureScale(
  object: GameObject,
): NonNullable<MutableTransformObject["scale"]> {
  const transform = object as MutableTransformObject;
  if (!transform.scale || typeof transform.scale !== "object") {
    transform.scale = { __icon: "scaling", x: 1, y: 1, z: 1 };
  }
  return transform.scale;
}

function clientToCanvas(
  rootElement: HTMLElement,
  clientX: number,
  clientY: number,
): Vector2 {
  const rect = rootElement.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function clampScale(value: number): number {
  return Math.max(0.01, value);
}

function angleDeltaRadians(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

const GIZMO_LAYOUT = {
  gap: 0,
  axisLength: 100,
  axisHitSlop: 14,
  endCapSize: 18,
  cornerSize: 36,
  rotate: {
    ringHitSlop: 24,
    handleHitSlop: 12,
  },
  lineWidth: 4,
} as const;

function gizmoOuterReach(): number {
  const { axisLength, endCapSize } = GIZMO_LAYOUT;
  return axisLength + endCapSize * 0.6;
}

function arrowHeadSpan(endCapSize: number): number {
  return endCapSize * 0.7;
}

function hitTestSquareHandle(
  localX: number,
  localY: number,
  centerX: number,
  centerY: number,
  visualSize: number,
  hitPadding: number,
): boolean {
  const half = visualSize / 2 + hitPadding;
  return (
    Math.abs(localX - centerX) <= half && Math.abs(localY - centerY) <= half
  );
}

function hitTestRotateGizmo(localX: number, localY: number): boolean {
  const { endCapSize, rotate } = GIZMO_LAYOUT;
  const radius = gizmoOuterReach();
  const idleHandle = worldAngleToScreenPoint(0, radius);

  if (
    hitTestSquareHandle(
      localX,
      localY,
      idleHandle.x,
      idleHandle.y,
      arrowHeadSpan(endCapSize),
      rotate.handleHitSlop,
    )
  ) {
    return true;
  }

  const distance = Math.hypot(localX, localY);
  return Math.abs(distance - radius) <= rotate.ringHitSlop;
}

function drawRotateRing(
  graphics: Graphics,
  radius: number,
  color: string,
  alpha: number,
): void {
  graphics
    .circle(0, 0, radius)
    .stroke({
      width: GIZMO_LAYOUT.lineWidth,
      color,
      alpha,
      pixelLine: true,
    });
}

function drawAxisShaft(
  graphics: Graphics,
  axis: "x" | "y",
  color: string,
  gap: number,
  length: number,
): void {
  if (axis === "x") {
    graphics
      .moveTo(gap, 0)
      .lineTo(gap + length, 0)
      .stroke({
        width: GIZMO_LAYOUT.lineWidth,
        color,
        alpha: 1,
        pixelLine: true,
      });
    return;
  }

  graphics
    .moveTo(0, -gap)
    .lineTo(0, -(gap + length))
    .stroke({
      width: GIZMO_LAYOUT.lineWidth,
      color,
      alpha: 1,
      pixelLine: true,
    });
}

function drawArrowHead(
  graphics: Graphics,
  axis: "x" | "y",
  color: string,
  gap: number,
  length: number,
  arrowSize: number,
): void {
  if (axis === "x") {
    const shaftEnd = gap + length;
    const tip = shaftEnd + arrowSize * 0.6;
    graphics
      .poly([
        tip,
        0,
        shaftEnd,
        -arrowSize * 0.35,
        shaftEnd,
        arrowSize * 0.35,
      ])
      .fill({ color, alpha: 1 });
    return;
  }

  const shaftEnd = -(gap + length);
  const tip = shaftEnd - arrowSize * 0.6;
  graphics
    .poly([
      0,
      tip,
      -arrowSize * 0.35,
      shaftEnd,
      arrowSize * 0.35,
      shaftEnd,
    ])
    .fill({ color, alpha: 1 });
}

function drawAxisWithArrow(
  graphics: Graphics,
  axis: "x" | "y",
  color: string,
  gap: number,
  length: number,
  arrowSize: number,
): void {
  drawAxisShaft(graphics, axis, color, gap, length);
  drawArrowHead(graphics, axis, color, gap, length, arrowSize);
}

function drawSquareHandle(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  color: string,
): void {
  graphics
    .rect(centerX - size / 2, centerY - size / 2, size, size)
    .fill({ color, alpha: 1 });
}

function drawCornerHandle(
  graphics: Graphics,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  graphics
    .rect(x, y - size, size, size)
    .fill({ color, alpha: 0.78 })
    .stroke({
      width: GIZMO_LAYOUT.lineWidth,
      color,
      alpha: 0.95,
      pixelLine: true,
    });
}

function drawTranslateGizmo(graphics: Graphics, unit: (pixels: number) => number): void {
  const style = getComputedStyle(document.documentElement);
  const red = style.getPropertyValue("--color-red").trim();
  const green = style.getPropertyValue("--color-green").trim();
  const highlight = style.getPropertyValue("--color-highlight").trim();
  const { gap, axisLength, endCapSize, cornerSize } = GIZMO_LAYOUT;
  const offset = unit(gap);
  const length = unit(axisLength);
  const arrow = unit(endCapSize);
  const corner = unit(cornerSize);

  drawAxisWithArrow(graphics, "x", red, offset, length, arrow);
  drawAxisWithArrow(graphics, "y", green, offset, length, arrow);
  drawCornerHandle(graphics, offset, -offset, corner, highlight);
}

function worldAngleToScreenPoint(angle: number, radius: number): Vector2 {
  return {
    x: Math.cos(angle) * radius,
    y: -Math.sin(angle) * radius,
  };
}

function worldAnglesToCanvasAngles(
  startAngle: number,
  endAngle: number,
): { canvasStart: number; canvasEnd: number; delta: number } {
  const delta = angleDeltaRadians(startAngle, endAngle);
  const canvasStart = -startAngle;
  return { canvasStart, canvasEnd: canvasStart - delta, delta };
}

function forEachCanvasArcPoint(
  canvasStart: number,
  canvasEnd: number,
  radius: number,
  visit: (x: number, y: number, index: number) => void,
): void {
  const delta = canvasEnd - canvasStart;
  const steps = Math.max(10, Math.ceil(Math.abs(delta) * radius * 0.35));
  const step = delta / steps;

  for (let i = 0; i <= steps; i++) {
    const angle = canvasStart + step * i;
    visit(Math.cos(angle) * radius, Math.sin(angle) * radius, i);
  }
}

function drawRotateArc(
  graphics: Graphics,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: string,
): void {
  const { canvasStart, canvasEnd, delta } = worldAnglesToCanvasAngles(
    startAngle,
    endAngle,
  );
  if (Math.abs(delta) < 0.001) return;

  forEachCanvasArcPoint(canvasStart, canvasEnd, radius, (x, y, index) => {
    if (index === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  });

  graphics.stroke({
    width: GIZMO_LAYOUT.lineWidth,
    color,
    alpha: 0.75,
    pixelLine: true,
  });
}

function drawRotateGizmo(
  graphics: Graphics,
  unit: (pixels: number) => number,
  dragVisual: RotateDragVisual | null,
): void {
  const blue = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-blue")
    .trim();
  const { endCapSize } = GIZMO_LAYOUT;
  const ringRadius = unit(gizmoOuterReach());
  const handleSize = unit(arrowHeadSpan(endCapSize));

  drawRotateRing(graphics, ringRadius, blue, dragVisual ? 0.5 : 1);

  if (dragVisual) {
    drawRotateArc(
      graphics,
      ringRadius,
      dragVisual.startAngle,
      dragVisual.currentAngle,
      blue,
    );

    const currentPoint = worldAngleToScreenPoint(
      dragVisual.currentAngle,
      ringRadius,
    );
    drawSquareHandle(
      graphics,
      currentPoint.x,
      currentPoint.y,
      handleSize,
      blue,
    );
    return;
  }

  const idleHandle = worldAngleToScreenPoint(0, ringRadius);
  drawSquareHandle(graphics, idleHandle.x, idleHandle.y, handleSize, blue);
}

function drawScaleGizmo(graphics: Graphics, unit: (pixels: number) => number): void {
  const style = getComputedStyle(document.documentElement);
  const red = style.getPropertyValue("--color-red").trim();
  const green = style.getPropertyValue("--color-green").trim();
  const highlight = style.getPropertyValue("--color-highlight").trim();
  const { gap, axisLength, endCapSize, cornerSize } = GIZMO_LAYOUT;
  const offset = unit(gap);
  const length = unit(axisLength);
  const handle = unit(arrowHeadSpan(endCapSize));
  const corner = unit(cornerSize);

  drawAxisShaft(graphics, "x", red, offset, length);
  drawAxisShaft(graphics, "y", green, offset, length);
  drawSquareHandle(graphics, offset + length, 0, handle, red);
  drawSquareHandle(graphics, 0, -(offset + length), handle, green);
  drawCornerHandle(graphics, offset, -offset, corner, highlight);
}

function getPointerWorld(
  input: PixiViewportInput,
  viewport: ViewportController,
): Vector2 | null {
  const pointer = input.mouse.position;
  return pointer ? viewport.screenToWorld(pointer.x, pointer.y) : null;
}

function getPointerGizmoLocal(
  object: GameObject,
  input: PixiViewportInput,
  viewport: ViewportController,
  rootElement: HTMLElement,
): Vector2 | null {
  const pointer = input.mouse.position;
  if (!pointer) return null;

  const t = readTransform(object);
  const center = viewport.worldToScreen(t.positionX, t.positionY);
  const canvas = clientToCanvas(rootElement, pointer.x, pointer.y);
  return {
    x: canvas.x - center.screenX,
    y: canvas.y - center.screenY,
  };
}

function hitTestSelectedGizmo(
  input: PixiViewportInput,
  viewport: ViewportController,
  rootElement: HTMLElement,
): GizmoHandle | null {
  const sel = selectedObject;
  if (!sel || findTopLevelSceneKey(sel) === undefined) return null;

  const local = getPointerGizmoLocal(sel, input, viewport, rootElement);
  if (!local) return null;

  const x = local.x;
  const y = local.y;
  const tool = getTransformGizmoTool();

  if (tool === "translate") {
    const { gap, axisLength, endCapSize, axisHitSlop, cornerSize } = GIZMO_LAYOUT;
    const reach = gap + axisLength + endCapSize;
    if (
      x >= gap &&
      x <= gap + cornerSize &&
      y <= -gap &&
      y >= -(gap + cornerSize)
    ) {
      return "translate-xy";
    }
    if (x >= gap && x <= reach && Math.abs(y) <= axisHitSlop) return "translate-x";
    if (y <= -gap && y >= -reach && Math.abs(x) <= axisHitSlop) return "translate-y";
    return null;
  }

  if (tool === "rotate") {
    return hitTestRotateGizmo(x, y) ? "rotate-z" : null;
  }

  const { gap, axisLength, endCapSize, axisHitSlop, cornerSize } = GIZMO_LAYOUT;
  const reach = gap + axisLength + endCapSize;
  const xHandleCenter = gap + axisLength;
  const yHandleCenter = -(gap + axisLength);
  const handleSpan = arrowHeadSpan(endCapSize);
  if (hitTestSquareHandle(x, y, xHandleCenter, 0, handleSpan, axisHitSlop)) {
    return "scale-x";
  }
  if (hitTestSquareHandle(x, y, 0, yHandleCenter, handleSpan, axisHitSlop)) {
    return "scale-y";
  }
  if (
    x >= gap &&
    x <= gap + cornerSize &&
    y <= -gap &&
    y >= -(gap + cornerSize)
  ) {
    return "scale-uniform";
  }
  if (x >= gap && x <= reach && Math.abs(y) <= axisHitSlop) return "scale-x";
  if (y <= -gap && y >= -reach && Math.abs(x) <= axisHitSlop) return "scale-y";
  return null;
}

function beginDrag(
  handle: GizmoHandle,
  object: GameObject,
  input: PixiViewportInput,
  viewport: ViewportController,
): DragState | null {
  const pointer = input.mouse.position;
  const startWorld = getPointerWorld(input, viewport);
  if (!pointer || !startWorld) return null;

  const startTransform = readTransform(object);
  const drag: DragState = {
    handle,
    object,
    origin: { x: startTransform.positionX, y: startTransform.positionY },
    startClient: { x: pointer.x, y: pointer.y },
    startTransform,
    startWorld,
  };

  if (handle === "rotate-z") {
    drag.startAngle = Math.atan2(
      startWorld.y - drag.origin.y,
      startWorld.x - drag.origin.x,
    );
  }

  return drag;
}

function applyTranslateDrag(drag: DragState, currentWorld: Vector2): void {
  const position = ensurePosition(drag.object);
  const dx = currentWorld.x - drag.startWorld.x;
  const dy = currentWorld.y - drag.startWorld.y;

  if (drag.handle === "translate-x" || drag.handle === "translate-xy") {
    position.x = drag.startTransform.positionX + dx;
  }
  if (drag.handle === "translate-y" || drag.handle === "translate-xy") {
    position.y = drag.startTransform.positionY + dy;
  }
}

function applyRotateDrag(drag: DragState, currentWorld: Vector2): void {
  const startAngle = Math.atan2(
    drag.startWorld.y - drag.origin.y,
    drag.startWorld.x - drag.origin.x,
  );
  const currentAngle = Math.atan2(
    currentWorld.y - drag.origin.y,
    currentWorld.x - drag.origin.x,
  );
  ensureRotation(drag.object).z =
    drag.startTransform.rotationZ + angleDeltaRadians(startAngle, currentAngle);
}

function applyScaleDrag(drag: DragState, currentClient: Vector2): void {
  const dx = currentClient.x - drag.startClient.x;
  const dyUp = drag.startClient.y - currentClient.y;
  const scale = ensureScale(drag.object);

  if (drag.handle === "scale-x") {
    scale.x = clampScale(drag.startTransform.scaleX + dx / 80);
    return;
  }

  if (drag.handle === "scale-y") {
    scale.y = clampScale(drag.startTransform.scaleY + dyUp / 80);
    return;
  }

  const factor = clampScale(1 + (dx + dyUp) / 160);
  scale.x = clampScale(drag.startTransform.scaleX * factor);
  scale.y = clampScale(drag.startTransform.scaleY * factor);
}

function applyDrag(
  drag: DragState,
  input: PixiViewportInput,
  viewport: ViewportController,
): void {
  const pointer = input.mouse.position;
  const currentWorld = getPointerWorld(input, viewport);
  if (!pointer || !currentWorld) return;

  if (
    drag.handle === "translate-x" ||
    drag.handle === "translate-y" ||
    drag.handle === "translate-xy"
  ) {
    applyTranslateDrag(drag, currentWorld);
    return;
  }

  if (drag.handle === "rotate-z") {
    applyRotateDrag(drag, currentWorld);
    return;
  }

  applyScaleDrag(drag, pointer);
}

function getRotateDragVisual(
  drag: DragState,
  input: PixiViewportInput,
  viewport: ViewportController,
): RotateDragVisual | null {
  if (drag.handle !== "rotate-z" || drag.startAngle === undefined) return null;

  const currentWorld = getPointerWorld(input, viewport);
  if (!currentWorld) return null;

  return {
    startAngle: drag.startAngle,
    currentAngle: Math.atan2(
      currentWorld.y - drag.origin.y,
      currentWorld.x - drag.origin.x,
    ),
  };
}

export function transformGizmoOverlay(
  screenStage: Container,
  options: TransformGizmoOverlayOptions,
): TransformGizmoOverlayController {
  const { input, viewport, rootElement } = options;
  const zIndex = options.zIndex ?? 10_002;
  const scene = getScene();
  let dragState: DragState | null = null;

  const root = new Container();
  root.label = "gameide:transform-gizmo-overlay";
  root.eventMode = "none";
  root.zIndex = zIndex;

  const gizmo = new Graphics({ roundPixels: true });
  gizmo.eventMode = "none";
  root.addChild(gizmo);
  screenStage.addChild(root);

  function sync(): void {
    gizmo.clear();
    const sel = selectedObject;
    if (!sel || findTopLevelSceneKey(sel) === undefined) {
      root.visible = false;
      return;
    }

    const t = readTransform(sel);
    const screen = viewport.worldToScreen(t.positionX, t.positionY);
    root.position.set(Math.round(screen.screenX), Math.round(screen.screenY));
    root.rotation = 0;
    root.scale.set(1, 1);
    root.visible = true;

    const unit = (pixels: number) => pixels;
    const rotateDragVisual =
      dragState?.handle === "rotate-z"
        ? getRotateDragVisual(dragState, input, viewport)
        : null;
    switch (getTransformGizmoTool()) {
      case "translate":
        drawTranslateGizmo(gizmo, unit);
        break;
      case "rotate":
        drawRotateGizmo(gizmo, unit, rotateDragVisual);
        break;
      case "scale":
        drawScaleGizmo(gizmo, unit);
        break;
    }
  }

  function updateInteraction(): void {
    if (dragState && input.buttons.Click.held) {
      applyDrag(dragState, input, viewport);
    }

    if (input.buttons.Click.pressed && input.mouse.position) {
      const sel = selectedObject;
      const handle = hitTestSelectedGizmo(input, viewport, rootElement);
      if (sel && handle) {
        dragState = beginDrag(handle, sel, input, viewport);
      }
    }

    if (input.buttons.Click.released) {
      dragState = null;
    }

    sync();
  }

  function shouldSuppressViewportGesture(): boolean {
    if (dragState) return true;
    if (!input.mouse.position) return false;
    if (!input.buttons.Click.pressed && !input.buttons.Click.held) return false;
    return hitTestSelectedGizmo(input, viewport, rootElement) !== null;
  }

  sync();

  const unsubTool = subscribeTransformGizmoTool(sync);
  const unsubScene = scene.onChange((_target, mutationPathTrail) => {
    const anchoredRootKey = mutationPathTrail[0];
    if (anchoredRootKey === undefined) return;
    const sel = selectedObject;
    if (!sel) return;
    if (findTopLevelSceneKey(sel) !== anchoredRootKey) return;
    sync();
  });
  const unsubEditorFrame = onEditorUpdate(updateInteraction);

  return {
    shouldSuppressViewportGesture,
    unsubscribe: () => {
      unsubTool();
      unsubScene();
      unsubEditorFrame();
      root.destroy({ children: true });
    },
  };
}
