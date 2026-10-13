import type { GameObject } from "../../actions/editor/object-tree.tsx";
import { isObject } from "../is-object.ts";
import { scene } from "../scene.ts";

type TransformRoot = { [name: string]: unknown };

export type Vector3 = { x: number; y: number; z: number };

export type Vector2 = { x: number; y: number };

export type Transform = {
  readonly matrix: DOMMatrix;
  position: Vector3;
  rotation: number;
  scale: Vector2;
};

const views = new WeakMap<GameObject, Transform>();

const components = new Set([
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "m11",
  "m12",
  "m21",
  "m22",
  "m41",
  "m42",
  "m43",
]);

export function transform(object: GameObject): Transform | undefined {
  const local = object.transform;
  if (!(local instanceof DOMMatrix)) return;
  return view(object);
}

export function parentObject(object: GameObject, root: TransformRoot = scene): GameObject | undefined {
  const name = parentName(object);
  if (!name) return;
  const parent = gameObject(root[name]);
  if (!parent || parent === object) return;

  const seen = new Set<GameObject>([object, parent]);
  let current = parent;
  while (true) {
    const nextName = parentName(current);
    if (!nextName) return parent;
    const next = gameObject(root[nextName]);
    if (!next || next === current) return parent;
    if (seen.has(next)) return;
    seen.add(next);
    current = next;
  }
}

export function applyTransform(context: CanvasRenderingContext2D, matrix: DOMMatrix) {
  context.setTransform(context.getTransform().multiply(matrix));
}

function view(object: GameObject): Transform {
  const cached = views.get(object);
  if (cached) return cached;

  const scratch = new DOMMatrix();
  const matrix = new Proxy(scratch, {
    get(_target, prop, receiver) {
      writeMatrix(scratch, compose(object));
      if (typeof prop === "string" && components.has(prop)) return scratch[prop as "a"];
      const value = Reflect.get(scratch, prop, scratch);
      if (typeof value !== "function") return value;
      return (...args: unknown[]) => {
        writeMatrix(scratch, compose(object));
        const before = snapshot(scratch);
        const result = value.apply(scratch, args);
        if (!same(before, scratch)) writeLocal(object, scratch);
        return result === scratch ? receiver : result;
      };
    },
    set(_target, prop, value) {
      writeMatrix(scratch, compose(object));
      Reflect.set(scratch, prop, value, scratch);
      writeLocal(object, scratch);
      return true;
    },
  }) as DOMMatrix;

  const position: Vector3 = {
    get x() {
      return matrix.e;
    },
    set x(value: number) {
      matrix.e = value;
    },
    get y() {
      return matrix.f;
    },
    set y(value: number) {
      matrix.f = value;
    },
    get z() {
      return matrix.m43;
    },
    set z(value: number) {
      matrix.m43 = value;
    },
  };

  const scale: Vector2 = {
    get x() {
      return decompose(matrix).scaleX;
    },
    set x(value: number) {
      const current = decompose(matrix);
      setScale(object, value, current.scaleY);
    },
    get y() {
      return decompose(matrix).scaleY;
    },
    set y(value: number) {
      const current = decompose(matrix);
      setScale(object, current.scaleX, value);
    },
  };

  const placement: Transform = {
    matrix,
    get position() {
      return position;
    },
    set position(value: Vector3) {
      if (!isObject(value)) return;
      const world = compose(object);
      if (finite(value.x)) world.e = value.x;
      if (finite(value.y)) world.f = value.y;
      if (finite(value.z)) world.m43 = value.z;
      writeLocal(object, world);
    },
    get rotation() {
      return decompose(matrix).rotation;
    },
    set rotation(value: number) {
      if (!finite(value)) return;
      const world = compose(object);
      const current = decompose(world);
      applyLinear(world, value, current.scaleX, current.scaleY);
      writeLocal(object, world);
    },
    get scale() {
      return scale;
    },
    set scale(value: Vector2) {
      if (!isObject(value)) return;
      const current = decompose(matrix);
      setScale(
        object,
        finite(value.x) ? value.x : current.scaleX,
        finite(value.y) ? value.y : current.scaleY,
      );
    },
  };

  views.set(object, placement);
  return placement;
}

function setScale(object: GameObject, scaleX: number, scaleY: number) {
  if (!finite(scaleX) || !finite(scaleY)) return;
  const world = compose(object);
  applyLinear(world, decompose(world).rotation, scaleX, scaleY);
  writeLocal(object, world);
}

function compose(object: GameObject): DOMMatrix {
  const local = object.transform instanceof DOMMatrix ? copyMatrix(object.transform) : new DOMMatrix();
  const parent = parentObject(object);
  if (!parent) return local;
  return compose(parent).multiply(local);
}

function writeLocal(object: GameObject, world: DOMMatrix) {
  const local = object.transform;
  if (!(local instanceof DOMMatrix)) return;
  const parent = parentObject(object);
  if (!parent) {
    writeMatrix(local, world);
    return;
  }
  const inverse = invert2D(compose(parent));
  if (!inverse) return;
  const next = inverse.multiply(world);
  if (!isFiniteMatrix(next)) return;
  writeMatrix(local, next);
}

function parentName(object: GameObject): string | undefined {
  const parent = object.parent;
  if (typeof parent !== "string" || parent === "") return;
  return parent;
}

function gameObject(value: unknown): GameObject | undefined {
  if (!isObject(value) || value instanceof DOMMatrix) return;
  return value;
}

function copyMatrix(matrix: DOMMatrix) {
  const copy = new DOMMatrix();
  writeMatrix(copy, matrix);
  return copy;
}

function writeMatrix(target: DOMMatrix, source: DOMMatrix) {
  target.a = source.a;
  target.b = source.b;
  target.c = source.c;
  target.d = source.d;
  target.e = source.e;
  target.f = source.f;
  target.m43 = source.m43;
}

function snapshot(matrix: DOMMatrix) {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f, matrix.m43];
}

function same(before: number[], matrix: DOMMatrix) {
  const next = snapshot(matrix);
  return before.every((value, index) => value === next[index]);
}

function decompose(matrix: DOMMatrix) {
  const scaleX = Math.hypot(matrix.a, matrix.b);
  const scaleYAbs = Math.hypot(matrix.c, matrix.d);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  const scaleY = determinant < 0 ? -scaleYAbs : scaleYAbs;
  let rotation = 0;
  if (scaleX > 1e-8) rotation = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
  else if (scaleYAbs > 1e-8) rotation = (Math.atan2(-matrix.c, matrix.d) * 180) / Math.PI;
  return { rotation, scaleX, scaleY };
}

function applyLinear(matrix: DOMMatrix, rotation: number, scaleX: number, scaleY: number) {
  const linear = new DOMMatrix().rotateSelf(rotation).scale(scaleX, scaleY);
  matrix.a = linear.a;
  matrix.b = linear.b;
  matrix.c = linear.c;
  matrix.d = linear.d;
}

function invert2D(matrix: DOMMatrix): DOMMatrix | undefined {
  const { a, b, c, d, e, f } = matrix;
  const det = a * d - c * b;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-8) return;
  const inverse = new DOMMatrix();
  inverse.a = d / det;
  inverse.b = -b / det;
  inverse.c = -c / det;
  inverse.d = a / det;
  inverse.e = (c * f - d * e) / det;
  inverse.f = (b * e - a * f) / det;
  inverse.m43 = -matrix.m43;
  return inverse;
}

function isFiniteMatrix(matrix: DOMMatrix) {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f, matrix.m43].every(Number.isFinite);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
