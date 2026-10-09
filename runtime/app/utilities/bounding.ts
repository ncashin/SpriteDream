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
