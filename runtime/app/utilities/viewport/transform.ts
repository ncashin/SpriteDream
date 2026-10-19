import GitFork from "lucide/dist/esm/icons/git-fork.mjs";
import { defaulted, string } from "remix/data-schema";

import { isObject } from "../is-object.ts";
import { scene, type SceneNode } from "../scene.ts";
import { defineTrait } from "../trait/trait.ts";

type TransformRoot = { [name: string]: unknown };

export type Vector3 = { x: number; y: number; z: number };

export type Vector2 = { x: number; y: number };

export type Transform = {
  readonly matrix: DOMMatrix;
  position: Vector3;
  rotation: number;
  scale: Vector2;
};

export const parentTrait = defineTrait("Parent", GitFork, defaulted(string(), ""));

const fields = [
  "m11",
  "m12",
  "m13",
  "m14",
  "m21",
  "m22",
  "m23",
  "m24",
  "m31",
  "m32",
  "m33",
  "m34",
  "m41",
  "m42",
  "m43",
  "m44",
] as const;

const views = new WeakMap<SceneNode, Transform>();

const components = new Set<string>([...fields, "a", "b", "c", "d", "e", "f"]);

export function createMatrix() {
  return "matrix(1, 0, 0, 1, 0, 0)";
}

export function isMatrix(value: unknown): value is string {
  return typeof value === "string" && (value.startsWith("matrix(") || value.startsWith("matrix3d("));
}

export function transform(object: SceneNode): Transform | undefined {
  if (!isMatrix(object.transform)) return;
  return view(object);
}

export function parentObject(object: SceneNode, root: TransformRoot = scene): SceneNode | undefined {
  const name = parentName(object);
  if (!name) return;
  const parent = sceneNode(root[name]);
  if (!parent || parent === object) return;

  const seen = new Set<SceneNode>([object, parent]);
  let current = parent;
  while (true) {
    const nextName = parentName(current);
    if (!nextName) return parent;
    const next = sceneNode(root[nextName]);
    if (!next || next === current) return parent;
    if (seen.has(next)) return;
    seen.add(next);
    current = next;
  }
}

export function applyTransform(context: CanvasRenderingContext2D, matrix: DOMMatrix) {
  context.setTransform(context.getTransform().multiply(matrix));
}

function view(object: SceneNode): Transform {
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

function setScale(object: SceneNode, scaleX: number, scaleY: number) {
  if (!finite(scaleX) || !finite(scaleY)) return;
  const world = compose(object);
  applyLinear(world, decompose(world).rotation, scaleX, scaleY);
  writeLocal(object, world);
}

function compose(object: SceneNode): DOMMatrix {
  const stored = object.transform;
  const local = isMatrix(stored) ? new DOMMatrix(stored) : new DOMMatrix();
  const parent = parentObject(object);
  if (!parent) return local;
  return compose(parent).multiply(local);
}

export function setObjectParent(object: SceneNode, parent: string | undefined) {
  const world = isMatrix(object.transform) ? compose(object) : undefined;
  if (parent) object.parent = parent;
  else delete object.parent;
  if (world) writeLocal(object, world);
}

function writeLocal(object: SceneNode, world: DOMMatrix) {
  if (!isMatrix(object.transform)) return;
  const parent = parentObject(object);
  if (!parent) {
    object.transform = world.toString();
    return;
  }
  const inverse = inverseMatrix(compose(parent));
  if (!inverse) return;
  const next = inverse.multiply(world);
  if (!isFiniteMatrix(next)) return;
  object.transform = next.toString();
}

function parentName(object: SceneNode): string | undefined {
  const parent = parentTrait(object)?.parent;
  if (!parent) return;
  return parent;
}

function sceneNode(value: unknown): SceneNode | undefined {
  if (!isObject(value)) return;
  return value;
}

function writeMatrix(target: DOMMatrix, source: DOMMatrix) {
  for (const key of fields) target[key] = source[key];
}

function snapshot(matrix: DOMMatrix) {
  return fields.map((key) => matrix[key]);
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

function inverseMatrix(matrix: DOMMatrix): DOMMatrix | undefined {
  if (!isFiniteMatrix(matrix)) return;
  const inverse = matrix.inverse();
  if (!isFiniteMatrix(inverse)) return;
  return inverse;
}

function isFiniteMatrix(matrix: DOMMatrix) {
  return fields.every((key) => Number.isFinite(matrix[key]));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
