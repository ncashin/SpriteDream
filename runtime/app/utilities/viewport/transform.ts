import type { GameObject } from "../../actions/editor/object-tree.tsx";
import { isObject } from "../is-object.ts";
import { scene } from "../scene.ts";

type TransformRoot = { [name: string]: unknown };

const views = new WeakMap<GameObject, DOMMatrix>();

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
]);

export function transform(object: GameObject): DOMMatrix | undefined {
  const local = object.transform;
  if (!(local instanceof DOMMatrix)) return;
  if (!parentObject(object)) return local;
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

function view(object: GameObject): DOMMatrix {
  const cached = views.get(object);
  if (cached) return cached;

  const scratch = new DOMMatrix();
  const proxy = new Proxy(scratch, {
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

  views.set(object, proxy);
  return proxy;
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
}

function snapshot(matrix: DOMMatrix) {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f];
}

function same(before: number[], matrix: DOMMatrix) {
  const next = snapshot(matrix);
  return before.every((value, index) => value === next[index]);
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
  return inverse;
}

function isFiniteMatrix(matrix: DOMMatrix) {
  return [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite);
}
