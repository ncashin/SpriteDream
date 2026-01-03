/**
 * Vector type: a 2D vector represented as [x, y]
 */
export type Vector = [number, number];

/**
 * Creates a new vector from x and y components
 */
export const create = (x: number, y: number): Vector => [x, y];

/**
 * Creates a zero vector [0, 0]
 */
export const zero = (): Vector => [0, 0];

/**
 * Creates a vector with both components set to 1 [1, 1]
 */
export const one = (): Vector => [1, 1];

/**
 * Creates a copy of a vector
 */
export const clone = (v: Vector): Vector => [v[0], v[1]];

/**
 * Adds two vectors: v1 + v2
 */
export const add = (v1: Vector, v2: Vector): Vector => [
  v1[0] + v2[0],
  v1[1] + v2[1],
];

/**
 * Subtracts v2 from v1: v1 - v2
 */
export const sub = (v1: Vector, v2: Vector): Vector => [
  v1[0] - v2[0],
  v1[1] - v2[1],
];

/**
 * Multiplies a vector by a scalar: v * scalar
 */
export const scale = (v: Vector, scalar: number): Vector => [
  v[0] * scalar,
  v[1] * scalar,
];

/**
 * Calculates the dot product of two vectors
 */
export const dot = (v1: Vector, v2: Vector): number =>
  v1[0] * v2[0] + v1[1] * v2[1];

/**
 * Calculates the length (magnitude) of a vector
 */
export const length = (v: Vector): number =>
  Math.sqrt(v[0] * v[0] + v[1] * v[1]);

/**
 * Calculates the squared length of a vector (faster, avoids sqrt)
 */
export const lengthSquared = (v: Vector): number =>
  v[0] * v[0] + v[1] * v[1];

/**
 * Normalizes a vector (returns a unit vector in the same direction)
 * Returns [0, 0] if the vector has zero length
 */
export const normalize = (v: Vector): Vector => {
  const len = length(v);
  if (len === 0) return [0, 0];
  return [v[0] / len, v[1] / len];
};

/**
 * Calculates the distance between two vectors
 */
export const distance = (v1: Vector, v2: Vector): number =>
  length(sub(v1, v2));

/**
 * Calculates the squared distance between two vectors (faster, avoids sqrt)
 */
export const distanceSquared = (v1: Vector, v2: Vector): number =>
  lengthSquared(sub(v1, v2));

/**
 * Negates a vector: -v
 */
export const negate = (v: Vector): Vector => [-v[0], -v[1]];

/**
 * Multiplies two vectors component-wise: [v1.x * v2.x, v1.y * v2.y]
 */
export const multiply = (v1: Vector, v2: Vector): Vector => [
  v1[0] * v2[0],
  v1[1] * v2[1],
];

/**
 * Divides v1 by v2 component-wise: [v1.x / v2.x, v1.y / v2.y]
 */
export const divide = (v1: Vector, v2: Vector): Vector => [
  v1[0] / v2[0],
  v1[1] / v2[1],
];

/**
 * Rotates a vector by an angle (in radians)
 */
export const rotate = (v: Vector, angle: number): Vector => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    v[0] * cos - v[1] * sin,
    v[0] * sin + v[1] * cos,
  ];
};

/**
 * Calculates the angle of a vector in radians
 */
export const angle = (v: Vector): number => Math.atan2(v[1], v[0]);

/**
 * Linearly interpolates between two vectors
 * t should be between 0 and 1
 */
export const lerp = (v1: Vector, v2: Vector, t: number): Vector => [
  v1[0] + (v2[0] - v1[0]) * t,
  v1[1] + (v2[1] - v1[1]) * t,
];

/**
 * Checks if two vectors are approximately equal (within epsilon)
 */
export const equals = (v1: Vector, v2: Vector, epsilon: number = 0.0001): boolean => {
  return Math.abs(v1[0] - v2[0]) < epsilon && Math.abs(v1[1] - v2[1]) < epsilon;
};

