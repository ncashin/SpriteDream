export type Vector = [number, number];

export const create = (x: number, y: number): Vector => [x, y];

export const zero = (): Vector => [0, 0];

export const one = (): Vector => [1, 1];

export const clone = (v: Vector): Vector => [v[0], v[1]];

export const add = (v1: Vector, v2: Vector): Vector => [
  v1[0] + v2[0],
  v1[1] + v2[1],
];

export const sub = (v1: Vector, v2: Vector): Vector => [
  v1[0] - v2[0],
  v1[1] - v2[1],
];

export const scale = (v: Vector, scalar: number): Vector => [
  v[0] * scalar,
  v[1] * scalar,
];

export const dot = (v1: Vector, v2: Vector): number =>
  v1[0] * v2[0] + v1[1] * v2[1];

export const length = (v: Vector): number =>
  Math.sqrt(v[0] * v[0] + v[1] * v[1]);

export const lengthSquared = (v: Vector): number =>
  v[0] * v[0] + v[1] * v[1];

export const normalize = (v: Vector): Vector => {
  const len = length(v);
  if (len === 0) return [0, 0];
  return [v[0] / len, v[1] / len];
};

export const distance = (v1: Vector, v2: Vector): number =>
  length(sub(v1, v2));

export const distanceSquared = (v1: Vector, v2: Vector): number =>
  lengthSquared(sub(v1, v2));

export const negate = (v: Vector): Vector => [-v[0], -v[1]];

export const multiply = (v1: Vector, v2: Vector): Vector => [
  v1[0] * v2[0],
  v1[1] * v2[1],
];

export const divide = (v1: Vector, v2: Vector): Vector => [
  v1[0] / v2[0],
  v1[1] / v2[1],
];

export const rotate = (v: Vector, angle: number): Vector => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    v[0] * cos - v[1] * sin,
    v[0] * sin + v[1] * cos,
  ];
};

export const angle = (v: Vector): number => Math.atan2(v[1], v[0]);

export const lerp = (v1: Vector, v2: Vector, t: number): Vector => [
  v1[0] + (v2[0] - v1[0]) * t,
  v1[1] + (v2[1] - v1[1]) * t,
];

export const equals = (v1: Vector, v2: Vector, epsilon: number = 0.0001): boolean => {
  return Math.abs(v1[0] - v2[0]) < epsilon && Math.abs(v1[1] - v2[1]) < epsilon;
};

