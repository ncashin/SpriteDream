import type { SceneObject, SceneObjectData } from "./scene.js";
import { getSceneRaw, getTarget } from "./scene.js";

function isSceneObjectData(value: unknown): value is SceneObjectData {
  return typeof value === "object" && value !== null;
}

function getProxyAtPath(sceneProxy: SceneObject, path: PropertyKey[]): SceneObject {
  let current: SceneObject = sceneProxy;
  for (const k of path) {
    current = current[k] as SceneObject;
  }
  return current;
}

function walkSceneRawCollect(
  rawRoot: SceneObjectData,
  basePath: PropertyKey[],
  predicate: (raw: SceneObjectData) => boolean,
  resultPaths: PropertyKey[][],
  visited: WeakSet<object>,
): void {
  const stack: { node: SceneObjectData; path: PropertyKey[] }[] = [
    { node: rawRoot, path: basePath },
  ];
  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    const raw = (getTarget(node as SceneObject) ?? node) as SceneObjectData;
    if (visited.has(raw)) continue;
    visited.add(raw);

    if (predicate(raw)) {
      resultPaths.push(path);
    }

    const keys = Object.keys(raw);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const value = (raw as Record<PropertyKey, unknown>)[k];
      const rawChild = isSceneObjectData(value)
        ? ((getTarget(value as SceneObject) ?? value) as SceneObjectData)
        : null;
      if (isSceneObjectData(rawChild)) {
        stack.push({ node: rawChild, path: path.concat(k) });
      }
    }
  }
}

/** Depth-first query within a subtree; `basePath` is this node’s path from the scene root. */
export function querySubtree<T extends SceneObjectData>(
  rootProxy: SceneObject,
  from: SceneObjectData,
  basePath: PropertyKey[],
  predicate: (object: SceneObjectData) => object is T,
): (SceneObject & T)[];
export function querySubtree(
  rootProxy: SceneObject,
  from: SceneObjectData,
  basePath: PropertyKey[],
  predicate: (object: SceneObjectData) => boolean,
): SceneObject[];
export function querySubtree(
  rootProxy: SceneObject,
  from: SceneObjectData,
  basePath: PropertyKey[],
  predicate: (object: SceneObjectData) => boolean,
): SceneObject[] {
  const rawFrom = (getTarget(from as SceneObject) ?? from) as SceneObjectData;
  if (!isSceneObjectData(rawFrom)) return [];
  const resultPaths: PropertyKey[][] = [];
  const visited = new WeakSet<object>();
  walkSceneRawCollect(rawFrom, basePath, predicate, resultPaths, visited);
  return resultPaths.map((path) => getProxyAtPath(rootProxy, path));
}

export function queryObject<T extends SceneObjectData>(
  scene: SceneObject,
  predicate: (object: SceneObjectData) => object is T,
): (SceneObject & T)[];
export function queryObject(
  scene: SceneObject,
  predicate: (object: SceneObjectData) => boolean,
): SceneObject[];
export function queryObject(
  scene: SceneObject,
  predicate: (object: SceneObjectData) => boolean,
): SceneObject[] {
  let rawRoot = getSceneRaw();
  if (rawRoot === undefined) {
    rawRoot = (getTarget(scene) ?? scene) as SceneObjectData;
  }
  if (!isSceneObjectData(rawRoot)) return [];
  const rawRootOnly = (getTarget(rawRoot as SceneObject) ?? rawRoot) as SceneObjectData;
  return querySubtree(scene, rawRootOnly, [], predicate);
}
