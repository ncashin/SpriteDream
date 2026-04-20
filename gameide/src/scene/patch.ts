import { merge } from "./merge.js";
import type { SceneObject, SceneReflectUpdate } from "./scene.js";

export function applyPatch(
  target: SceneObject,
  patch: Partial<SceneObject>,
): void {
  merge(
    target as Record<PropertyKey, unknown>,
    patch as Record<PropertyKey, unknown>,
  );
}

export function findSceneReceiverPath(
  root: SceneObject,
  receiver: object,
  path: PropertyKey[] = [],
): PropertyKey[] | null {
  const isRootReceiver = root === receiver;
  if (isRootReceiver) {
    return path;
  }

  for (const key of Reflect.ownKeys(root)) {
    if (key === "__proto__") {
      continue;
    }
    const child = Reflect.get(root, key);
    if (child && typeof child === "object") {
      const nextPath = [...path, key];
      const found = findSceneReceiverPath(
        child as SceneObject,
        receiver,
        nextPath,
      );
      if (found !== null) return found;
    }
  }

  return null;
}

function cloneScenePatchValue(value: unknown): unknown {
  const isCloneable = value !== null && typeof value === "object";
  if (!isCloneable) {
    return value;
  }
  return structuredClone(value);
}

export function mergeSceneReflectUpdateIntoPatch(
  patch: SceneObject,
  update: SceneReflectUpdate,
): void {
  let node: SceneObject = patch;
  for (const key of update.path) {
    let next = node[key];
    const shouldCreate =
      !next || typeof next !== "object" || Array.isArray(next);
    if (shouldCreate) {
      next = {};
      node[key] = next;
    }
    node = next as SceneObject;
  }
  node[update.property] = cloneScenePatchValue(update.value);
}
