import type { RemixNode } from "remix/component";

import type { Collider } from "../physics.ts";
import type { SceneNode } from "../scene.ts";
import { createDrawComponent } from "./draw-component.ts";
import { drawBoundingBox } from "./draw-bounding-box.tsx";
import { createDrawCursor } from "./draw-cursor.ts";
import { type Image, drawImage } from "./draw-image.ts";
import { type Text, drawText } from "./draw-text.ts";
import { type FrameObject, drawFrame } from "./frame.tsx";
import { drawPhysicsCollider } from "./draw-physics-collider.ts";
import { curryViewportEventListeners } from "./viewportEventListeners.ts";
import {
  curryViewportTransforms,
  releaseViewportTransforms,
} from "./viewportTransforms.ts";

export {
  centerOn,
  cursorWorldPoint,
  screenToWorld,
} from "./viewportTransforms.ts";

export type WorldPoint = { x: number; y: number };

export type ViewportOptions = {
  signal?: AbortSignal;
  handleSelection?: (point: WorldPoint) => SceneNode | undefined;
  handleHoverSelectable?: (hovering: boolean) => void;
};

export type ViewportState = {
  matrix: DOMMatrix;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  cursorPoint: WorldPoint;
};

export function viewport(canvas: HTMLCanvasElement, options?: ViewportOptions) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context is unavailable");

  const state: ViewportState = {
    matrix: new DOMMatrix(),
    canvas,
    context,
    cursorPoint: { x: 0, y: 0 },
  };

  const transforms = curryViewportTransforms(state);
  const drawComponent = createDrawComponent(canvas);
  const drawCursor = createDrawCursor(canvas);
  const viewport = {
    state,
    ...transforms,
    drawComponent(key: object, transform: DOMMatrix, node: RemixNode) {
      drawComponent(viewport, key, transform, node);
    },
  };
  curryViewportEventListeners(viewport, options);

  const signal = options?.signal;
  signal?.addEventListener("abort", () => {
    releaseViewportTransforms(transforms);
    drawComponent.dispose();
    drawCursor.dispose();
  });

  function beginDrawing() {
    fitCanvas(state.canvas);
    const context = state.context;

    context.imageSmoothingEnabled = false;
    const ratio = devicePixelRatio();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(
      0,
      0,
      state.canvas.clientWidth,
      state.canvas.clientHeight,
    );

    const matrix = state.matrix;
    context.setTransform(
      matrix.a * ratio,
      matrix.b * ratio,
      matrix.c * ratio,
      matrix.d * ratio,
      matrix.e * ratio,
      matrix.f * ratio,
    );
  }

  return {
    ...viewport,
    beginDrawing,
    drawImage(image: Image) {
      drawImage(viewport, image);
    },
    drawText(text: Text) {
      drawText(viewport, text);
    },
    drawFrame(frame: FrameObject) {
      drawFrame(viewport, frame);
    },
    drawBoundingBox(
      object: SceneNode,
      options?: { color?: string; handles?: boolean },
    ) {
      drawBoundingBox(viewport, object, options);
    },
    drawPhysicsCollider(object: Collider) {
      drawPhysicsCollider(viewport, object);
    },
    drawCursor(point: WorldPoint, color: string) {
      drawCursor(viewport, point, color);
    },
  };
}

function devicePixelRatio() {
  return window.devicePixelRatio || 1;
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  const ratio = devicePixelRatio();
  const bufferWidth = Math.floor(width * ratio);
  const bufferHeight = Math.floor(height * ratio);
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }
}
