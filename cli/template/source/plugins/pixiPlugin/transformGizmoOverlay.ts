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
};

export type TransformGizmoOverlayOptions = {
  input: PixiViewportInput;
  viewport: ViewportController;
  /** Draw above selection outlines. */
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

function screenPixelsToWorldUnits(stage: Container, pixels: number): number {
  const viewportScale = Math.max(Math.abs(stage.scale.x), 1e-6);
  return pixels / viewportScale;
}

function stageScalePixelsPerWorldUnit(stage: Container): number {
  return Math.max(Math.abs(stage.scale.x), 1e-6);
}

function clampScale(value: number): number {
  return Math.max(0.01, value);
}

function angleDeltaRadians(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function drawAxisLine(
  graphics: Graphics,
  axis: "x" | "y",
  color: number,
  length: number,
  strokeWidth: number,
): void {
  const x2 = axis === "x" ? length : 0;
  const y2 = axis === "y" ? length : 0;
  graphics
    .moveTo(0, 0)
    .lineTo(x2, y2)
    .stroke({ width: strokeWidth, color, alpha: 1, pixelLine: true });
}

function drawArrowHead(
  graphics: Graphics,
  axis: "x" | "y",
  color: number,
  length: number,
  size: number,
): void {
  if (axis === "x") {
    graphics
      .poly([length, 0, length - size, size * 0.55, length - size, -size * 0.55])
      .fill({ color, alpha: 1 });
    return;
  }

  graphics
    .poly([0, length, size * 0.55, length - size, -size * 0.55, length - size])
    .fill({ color, alpha: 1 });
}

function drawSquareHandle(
  graphics: Graphics,
  centerX: number,
  centerY: number,
  size: number,
  color: number,
  strokeWidth: number,
): void {
  graphics
    .rect(centerX - size / 2, centerY - size / 2, size, size)
    .fill({ color, alpha: 0.92 })
    .stroke({ width: strokeWidth, color: 0xffffff, alpha: 0.9, pixelLine: true });
}

function drawCornerHandle(
  graphics: Graphics,
  size: number,
  color: number,
  strokeWidth: number,
): void {
  graphics
    .rect(0, 0, size, size)
    .fill({ color, alpha: 0.78 })
    .stroke({ width: strokeWidth, color: 0xffffff, alpha: 0.95, pixelLine: true });
}

function drawTranslateGizmo(graphics: Graphics, unit: (pixels: number) => number): void {
  const axisLength = unit(68);
  const arrowSize = unit(12);
  const cornerSize = unit(24);
  const lineWidth = unit(3);

  drawAxisLine(graphics, "x", 0xff5252, axisLength, lineWidth);
  drawAxisLine(graphics, "y", 0x39d353, axisLength, lineWidth);
  drawArrowHead(graphics, "x", 0xff5252, axisLength, arrowSize);
  drawArrowHead(graphics, "y", 0x39d353, axisLength, arrowSize);
  drawCornerHandle(graphics, cornerSize, 0xf2cc60, unit(1.5));
  graphics.circle(0, 0, unit(4)).fill({ color: 0xffffff, alpha: 0.95 });
}

function drawRotateGizmo(graphics: Graphics, unit: (pixels: number) => number): void {
  const radius = unit(46);
  const handleRadius = unit(5);
  const strokeWidth = unit(3);

  graphics
    .circle(0, 0, radius)
    .stroke({ width: strokeWidth, color: 0x4da3ff, alpha: 1, pixelLine: true });
  graphics.circle(radius, 0, handleRadius).fill({ color: 0x4da3ff, alpha: 1 });
  graphics
    .moveTo(0, 0)
    .lineTo(radius, 0)
    .stroke({ width: unit(1), color: 0x4da3ff, alpha: 0.35, pixelLine: true });
}

function drawScaleGizmo(graphics: Graphics, unit: (pixels: number) => number): void {
  const axisLength = unit(60);
  const handleSize = unit(12);
  const cornerSize = unit(24);
  const lineWidth = unit(3);

  drawAxisLine(graphics, "x", 0xff5252, axisLength, lineWidth);
  drawAxisLine(graphics, "y", 0x39d353, axisLength, lineWidth);
  drawSquareHandle(graphics, axisLength, 0, handleSize, 0xff5252, unit(1.5));
  drawSquareHandle(graphics, 0, axisLength, handleSize, 0x39d353, unit(1.5));
  drawCornerHandle(graphics, cornerSize, 0xc084fc, unit(1.5));
  graphics.circle(0, 0, unit(4)).fill({ color: 0xffffff, alpha: 0.95 });
}

function getPointerWorld(
  input: PixiViewportInput,
  viewport: ViewportController,
): Vector2 | null {
  const pointer = input.mouse.position;
  return pointer ? viewport.screenToWorld(pointer.x, pointer.y) : null;
}

function getPointerLocalPixels(
  object: GameObject,
  input: PixiViewportInput,
  viewport: ViewportController,
  stage: Container,
): Vector2 | null {
  const world = getPointerWorld(input, viewport);
  if (!world) return null;
  const t = readTransform(object);
  const pixelsPerWorldUnit = stageScalePixelsPerWorldUnit(stage);
  return {
    x: (world.x - t.positionX) * pixelsPerWorldUnit,
    y: (world.y - t.positionY) * pixelsPerWorldUnit,
  };
}

function hitTestSelectedGizmo(
  input: PixiViewportInput,
  viewport: ViewportController,
  stage: Container,
): GizmoHandle | null {
  const sel = selectedObject;
  if (!sel || findTopLevelSceneKey(sel) === undefined) return null;

  const local = getPointerLocalPixels(sel, input, viewport, stage);
  if (!local) return null;

  const x = local.x;
  const y = local.y;
  const tool = getTransformGizmoTool();

  if (tool === "translate") {
    if (x >= 0 && x <= 28 && y >= 0 && y <= 28) return "translate-xy";
    if (x >= 0 && x <= 76 && Math.abs(y) <= 10) return "translate-x";
    if (y >= 0 && y <= 76 && Math.abs(x) <= 10) return "translate-y";
    return null;
  }

  if (tool === "rotate") {
    const distance = Math.hypot(x, y);
    return Math.abs(distance - 46) <= 10 ? "rotate-z" : null;
  }

  if (x >= 0 && x <= 28 && y >= 0 && y <= 28) return "scale-uniform";
  if (x >= 0 && x <= 70 && Math.abs(y) <= 10) return "scale-x";
  if (y >= 0 && y <= 70 && Math.abs(x) <= 10) return "scale-y";
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
  return {
    handle,
    object,
    origin: { x: startTransform.positionX, y: startTransform.positionY },
    startClient: { x: pointer.x, y: pointer.y },
    startTransform,
    startWorld,
  };
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

export function transformGizmoOverlay(
  stage: Container,
  options: TransformGizmoOverlayOptions,
): TransformGizmoOverlayController {
  const { input, viewport } = options;
  const zIndex = options.zIndex ?? 10_002;
  const scene = getScene();
  let dragState: DragState | null = null;

  const root = new Container();
  root.label = "gameide:transform-gizmo-overlay";
  root.eventMode = "none";
  root.zIndex = zIndex;

  const gizmo = new Graphics();
  gizmo.eventMode = "none";
  root.addChild(gizmo);
  stage.addChild(root);

  function sync(): void {
    gizmo.clear();
    const sel = selectedObject;
    if (!sel || findTopLevelSceneKey(sel) === undefined) {
      root.visible = false;
      return;
    }

    const t = readTransform(sel);
    root.position.set(t.positionX, t.positionY);
    root.rotation = 0;
    root.scale.set(1, 1);
    root.visible = true;

    const unit = (pixels: number) => screenPixelsToWorldUnits(stage, pixels);
    switch (getTransformGizmoTool()) {
      case "translate":
        drawTranslateGizmo(gizmo, unit);
        break;
      case "rotate":
        drawRotateGizmo(gizmo, unit);
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
      const handle = hitTestSelectedGizmo(input, viewport, stage);
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
    return hitTestSelectedGizmo(input, viewport, stage) !== null;
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
