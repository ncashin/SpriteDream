import type { ViewportState, WorldPoint } from "./viewport.ts";

const WHEEL_ZOOM = 0.002;

export type ViewportWithTransforms = {
  state: ViewportState;
} & ViewportTransforms;

type ViewportTransforms = {
  centerOn(point: WorldPoint): void;
  cursorWorldPoint(): WorldPoint;
  screenToWorld(clientX: number, clientY: number): WorldPoint;
  worldToScreen(x: number, y: number): WorldPoint;
  worldToScreenMatrix(transform: DOMMatrix): DOMMatrix;
  panBy(screenDx: number, screenDy: number): void;
  zoomAt(screenX: number, screenY: number, nextZoom: number): void;
  zoomFromWheel(clientX: number, clientY: number, deltaY: number, deltaMode?: number): void;
};

let bound: ViewportTransforms | undefined;

export function curryViewportTransforms(viewportState: ViewportState): ViewportTransforms {
  function canvasPoint(clientX: number, clientY: number) {
    const rect = viewportState.canvas.getBoundingClientRect();
    return new DOMPoint(clientX - rect.left, clientY - rect.top);
  }

  const transforms: ViewportTransforms = {
    centerOn(point) {
      const rect = viewportState.canvas.getBoundingClientRect();
      const current = viewportState.matrix.transformPoint(new DOMPoint(point.x, point.y));
      viewportState.matrix.preMultiplySelf(
        new DOMMatrix().translate(rect.width / 2 - current.x, rect.height / 2 - current.y),
      );
    },
    cursorWorldPoint() {
      return viewportState.cursorPoint;
    },
    screenToWorld(clientX, clientY) {
      const point = viewportState.matrix.inverse().transformPoint(canvasPoint(clientX, clientY));
      return { x: point.x, y: point.y };
    },
    worldToScreen(x, y) {
      const point = viewportState.matrix.transformPoint(new DOMPoint(x, y));
      return { x: point.x, y: point.y };
    },
    worldToScreenMatrix(transform) {
      return viewportState.matrix.multiply(transform);
    },
    panBy(screenDx, screenDy) {
      viewportState.matrix.preMultiplySelf(new DOMMatrix().translate(screenDx, screenDy));
    },
    zoomAt(screenX, screenY, nextZoom) {
      const zoom = viewportState.matrix.a;
      if (zoom === 0) return;
      const factor = nextZoom / zoom;
      viewportState.matrix.preMultiplySelf(
        new DOMMatrix()
          .translate(screenX, screenY)
          .scale(factor, factor)
          .translate(-screenX, -screenY),
      );
    },
    zoomFromWheel(clientX, clientY, deltaY, deltaMode = 0) {
      const local = canvasPoint(clientX, clientY);
      const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
      transforms.zoomAt(
        local.x,
        local.y,
        viewportState.matrix.a * Math.exp(-pixels * WHEEL_ZOOM),
      );
    },
  };
  bound = transforms;
  return transforms;
}

export function releaseViewportTransforms(transforms: ViewportTransforms) {
  if (bound === transforms) bound = undefined;
}

export function centerOn(point: WorldPoint) {
  bound?.centerOn(point);
}

export function cursorWorldPoint(): WorldPoint | undefined {
  return bound?.cursorWorldPoint();
}

export function screenToWorld(clientX: number, clientY: number): WorldPoint | undefined {
  return bound?.screenToWorld(clientX, clientY);
}
