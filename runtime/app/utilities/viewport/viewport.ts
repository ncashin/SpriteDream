import type { RemixNode } from "remix/component";

import type { GameObject } from "../../actions/editor/object-tree.tsx";
import { drawBoundingBox as paintBoundingBox } from "./draw-bounding-box.tsx";
import { createDrawComponent } from "./draw-component.ts";
import { type Image, drawImage as paintImage } from "./draw-image.ts";
import { curryViewportEvents } from "./viewportEvents.ts";
import {
  curryViewportTransforms,
  releaseViewportTransforms,
} from "./viewportTransforms.ts";

export { centerOn, cursorWorldPoint, screenToWorld } from "./viewportTransforms.ts";

export type WorldPoint = { x: number; y: number };

export type ViewportOptions = {
  signal?: AbortSignal;
  handleSelection?: (point: WorldPoint) => GameObject | undefined;
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

  const viewportTransforms = curryViewportTransforms(state);
  curryViewportEvents(state, viewportTransforms, options);

  const signal = options?.signal;
  const paintComponent = createDrawComponent(canvas);
  signal?.addEventListener("abort", () => {
    releaseViewportTransforms(viewportTransforms);
    paintComponent.dispose();
  });

  function beginDrawing() {
    fitCanvas(state.canvas);
    const context = state.context;

    context.imageSmoothingEnabled = false;
    const ratio = devicePixelRatio();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, state.canvas.clientWidth, state.canvas.clientHeight);

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

  return Object.assign(state, {
    beginDrawing,
    drawImage(sprite: Image) {
      paintImage(state.context, sprite);
    },
    drawComponent(transform: DOMMatrix, node: RemixNode) {
      paintComponent(viewportTransforms.worldToScreenMatrix(transform), node);
    },
    drawBoundingBox(sprite: Image) {
      paintBoundingBox(
        (frame, node) => {
          paintComponent(viewportTransforms.worldToScreenMatrix(frame), node);
        },
        sprite,
      );
    },
  });
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
