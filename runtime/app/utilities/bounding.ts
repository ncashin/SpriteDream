import { defaultViewport } from "./viewport/viewport.ts";

export type Point = { x: number; y: number };

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function center(bounds: Bounds): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}

export function drawBoundingBox(context: CanvasRenderingContext2D, bounds: Bounds) {
  const origin = center(bounds);
  const x = -bounds.width / 2;
  const y = -bounds.height / 2;
  context.save();
  context.translate(origin.x, origin.y);
  context.rotate(radians(bounds.rotation));
  context.strokeStyle = "#7dd3fc";
  context.lineWidth = 1.5 / defaultViewport.zoom;
  context.strokeRect(x, y, bounds.width, bounds.height);
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
  const origin = center(bounds);
  const anchor = {
    x: -direction.x * bounds.width / 2,
    y: -direction.y * bounds.height / 2,
  };
  const anchorWorld = add(origin, rotate(anchor, bounds.rotation));
  const local = rotate(
    { x: point.x - anchorWorld.x, y: point.y - anchorWorld.y },
    -bounds.rotation,
  );
  const width = direction.x === 0 ? bounds.width : Math.max(MIN_SIZE, direction.x * local.x);
  const height = direction.y === 0 ? bounds.height : Math.max(MIN_SIZE, direction.y * local.y);
  const next = add(
    anchorWorld,
    rotate({ x: direction.x * width / 2, y: direction.y * height / 2 }, bounds.rotation),
  );
  bounds.x = next.x - width / 2;
  bounds.y = next.y - height / 2;
  bounds.width = width;
  bounds.height = height;
}

function add(point: Point, delta: Point): Point {
  return { x: point.x + delta.x, y: point.y + delta.y };
}

function rotate(point: Point, degrees: number): Point {
  const angle = radians(degrees);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function contains(bounds: Bounds, point: Point) {
  const origin = center(bounds);
  const angle = -radians(bounds.rotation);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (
    localX >= -bounds.width / 2 &&
    localY >= -bounds.height / 2 &&
    localX < bounds.width / 2 &&
    localY < bounds.height / 2
  );
}
