import { defaultViewport } from "./viewport/viewport.ts";
import { applyTransform } from "./viewport/transform.ts";

export type Point = { x: number; y: number };

export type Bounds = {
  transform: DOMMatrix;
  width: number;
  height: number;
};

export function center(bounds: Bounds): Point {
  const point = bounds.transform.transformPoint(new DOMPoint(bounds.width / 2, bounds.height / 2));
  return { x: point.x, y: point.y };
}

export function drawBoundingBox(context: CanvasRenderingContext2D, bounds: Bounds) {
  context.save();
  applyTransform(context, bounds.transform);
  context.strokeStyle = "#7dd3fc";
  context.lineWidth = 1.5 / defaultViewport.zoom;
  context.strokeRect(0, 0, bounds.width, bounds.height);
  context.restore();
}

const MIN_SIZE = 1;

const resizeDirections = {
  north: { x: 0, y: -1 },
  northEast: { x: 1, y: -1 },
  east: { x: 1, y: 0 },
  southEast: { x: 1, y: 1 },
  south: { x: 0, y: 1 },
  southWest: { x: -1, y: 1 },
  west: { x: -1, y: 0 },
  northWest: { x: -1, y: -1 },
} as const;

export type ResizeHandle = keyof typeof resizeDirections;

export function resizeBoundingBox(bounds: Bounds, handle: ResizeHandle, point: Point) {
  const direction = resizeDirections[handle];
  const anchor = anchorPoint(bounds, direction);
  const anchorWorld = bounds.transform.transformPoint(new DOMPoint(anchor.x, anchor.y));
  const local = bounds.transform.inverse().transformPoint(new DOMPoint(point.x, point.y));
  const width =
    direction.x === 0
      ? bounds.width
      : Math.max(MIN_SIZE, direction.x > 0 ? local.x : bounds.width - local.x);
  const height =
    direction.y === 0
      ? bounds.height
      : Math.max(MIN_SIZE, direction.y > 0 ? local.y : bounds.height - local.y);
  const nextAnchor = anchorPoint({ width, height }, direction);
  const shiftedX = bounds.transform.a * nextAnchor.x + bounds.transform.c * nextAnchor.y;
  const shiftedY = bounds.transform.b * nextAnchor.x + bounds.transform.d * nextAnchor.y;
  bounds.transform.e = anchorWorld.x - shiftedX;
  bounds.transform.f = anchorWorld.y - shiftedY;
  bounds.width = width;
  bounds.height = height;
}

function anchorPoint(
  bounds: { width: number; height: number },
  direction: { x: number; y: number },
): Point {
  return {
    x: direction.x > 0 ? 0 : direction.x < 0 ? bounds.width : bounds.width / 2,
    y: direction.y > 0 ? 0 : direction.y < 0 ? bounds.height : bounds.height / 2,
  };
}

export function contains(bounds: Bounds, point: Point) {
  const local = bounds.transform.inverse().transformPoint(new DOMPoint(point.x, point.y));
  return local.x >= 0 && local.y >= 0 && local.x < bounds.width && local.y < bounds.height;
}
