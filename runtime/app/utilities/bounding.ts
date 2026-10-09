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

const MIN_AXIS = 1e-4;

export const resizeDirections = {
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

export function moveBoundingBox(bounds: Bounds, translation: Point) {
  bounds.transform.e = translation.x;
  bounds.transform.f = translation.y;
}

export function resizeBoundingBox(bounds: Bounds, handle: ResizeHandle, point: Point) {
  const direction = resizeDirections[handle];
  const anchor = anchorPoint(bounds, direction);
  const anchorWorld = bounds.transform.transformPoint(new DOMPoint(anchor.x, anchor.y));
  const offsetX = point.x - anchorWorld.x;
  const offsetY = point.y - anchorWorld.y;
  let { a, b, c, d } = bounds.transform;

  if (direction.x !== 0 && bounds.width !== 0) {
    const next = scaledAxis(a, b, direction.x * bounds.width, offsetX, offsetY, d, -c);
    a = next.x;
    b = next.y;
  }
  if (direction.y !== 0 && bounds.height !== 0) {
    const next = scaledAxis(c, d, direction.y * bounds.height, offsetX, offsetY, -b, a);
    c = next.x;
    d = next.y;
  }

  bounds.transform.a = a;
  bounds.transform.b = b;
  bounds.transform.c = c;
  bounds.transform.d = d;
  bounds.transform.e = anchorWorld.x - (a * anchor.x + c * anchor.y);
  bounds.transform.f = anchorWorld.y - (b * anchor.x + d * anchor.y);
}

function scaledAxis(
  axisX: number,
  axisY: number,
  span: number,
  offsetX: number,
  offsetY: number,
  fallbackX: number,
  fallbackY: number,
) {
  const unit = unitAxis(axisX, axisY, fallbackX, fallbackY);
  let magnitude = (offsetX * unit.x + offsetY * unit.y) / span;
  if (!Number.isFinite(magnitude) || Math.abs(magnitude) < MIN_AXIS) {
    magnitude = (Math.sign(magnitude) || 1) * MIN_AXIS;
  }
  return { x: unit.x * magnitude, y: unit.y * magnitude };
}

function unitAxis(x: number, y: number, fallbackX: number, fallbackY: number) {
  const length = Math.hypot(x, y);
  if (length >= 1e-8) return { x: x / length, y: y / length };
  const fallback = Math.hypot(fallbackX, fallbackY);
  if (fallback >= 1e-8) return { x: fallbackX / fallback, y: fallbackY / fallback };
  return { x: 1, y: 0 };
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
