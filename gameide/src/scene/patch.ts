import { merge } from "./merge.js";
import type { BaseSceneObject, SceneReflectUpdate } from "./scene.js";

export function applyPatch(
  target: BaseSceneObject,
  patch: Partial<BaseSceneObject>,
): void {
  merge(
    target as Record<PropertyKey, unknown>,
    patch as Record<PropertyKey, unknown>,
  );
}

export function findSceneReceiverPath(
  root: BaseSceneObject,
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
        child as BaseSceneObject,
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

export function buildScenePatchFromDiff(
  fromObject: Record<string, unknown>,
  toObject: Record<string, unknown>,
): Record<string, unknown> {
  const patchObject: Record<string, unknown> = {};
  const allKeys: Set<string> = new Set([
    ...Object.keys(fromObject),
    ...Object.keys(toObject),
  ]);
  for (const key of allKeys) {
    const keyExistsInToObject = Object.prototype.hasOwnProperty.call(toObject, key);
    const keyExistsInFromObject = Object.prototype.hasOwnProperty.call(fromObject, key);

    if (!keyExistsInToObject) {
      patchObject[key] = undefined;
      continue;
    }
    if (!keyExistsInFromObject) {
      patchObject[key] = cloneScenePatchValue(toObject[key]);
      continue;
    }
    const fromValue = fromObject[key];
    const toValue = toObject[key];
    if (
      fromValue !== null &&
      typeof fromValue === "object" &&
      toValue !== null &&
      typeof toValue === "object"
    ) {
      const nestedPatch = buildScenePatchFromDiff(
        fromValue as Record<string, unknown>,
        toValue as Record<string, unknown>,
      );
      if (Object.keys(nestedPatch).length > 0) patchObject[key] = nestedPatch;
      continue;
    }
    if (fromValue !== toValue) patchObject[key] = cloneScenePatchValue(toValue);
  }
  return patchObject;
}

export function mergeSceneReflectUpdateIntoPatch(
  patch: BaseSceneObject,
  update: SceneReflectUpdate,
): void {
  let node: BaseSceneObject = patch;
  for (const key of update.path) {
    let next = node[key];
    const shouldCreate =
      !next || typeof next !== "object" || Array.isArray(next);
    if (shouldCreate) {
      next = {};
      node[key] = next;
    }
    node = next as BaseSceneObject;
  }
  if (update.value === undefined) {
    Reflect.deleteProperty(node, update.property);
    return;
  }
  node[update.property] = cloneScenePatchValue(update.value);
}
