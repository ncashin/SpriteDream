import type { SceneObject } from "./scene.js";
import { getSceneRaw, getTarget } from "./scene.js";

function isSceneObject(value: unknown): value is SceneObject {
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
  rawRoot: SceneObject,
  basePath: PropertyKey[],
  predicate: (raw: SceneObject) => boolean,
  resultPaths: PropertyKey[][],
  visited: WeakSet<object>,
): void {
  const stack: { node: SceneObject; path: PropertyKey[] }[] = [
    { node: rawRoot, path: basePath },
  ];
  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    const raw = getTarget(node) ?? node;
    if (visited.has(raw)) continue;
    visited.add(raw);

    if (predicate(raw)) {
      resultPaths.push(path);
    }

    const keys = Object.keys(raw);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const value = (raw as Record<PropertyKey, unknown>)[k];
      const rawChild = isSceneObject(value) ? getTarget(value) ?? value : null;
      if (isSceneObject(rawChild)) {
        stack.push({ node: rawChild as SceneObject, path: path.concat(k) });
      }
    }
  }
}

export function collectSceneObjects<T extends SceneObject>(
  scene: SceneObject,
  predicate: (object: SceneObject) => object is T,
): T[];
export function collectSceneObjects(
  scene: SceneObject,
  predicate: (object: SceneObject) => boolean,
): SceneObject[];
export function collectSceneObjects(
  scene: SceneObject,
  predicate: (object: SceneObject) => boolean,
): SceneObject[] {
  let rawRoot = getSceneRaw();
  if (rawRoot === undefined) {
    rawRoot = getTarget(scene) ?? scene;
  }
  if (!isSceneObject(rawRoot)) return [];
  const rawRootOnly = getTarget(rawRoot) ?? rawRoot;
  const resultPaths: PropertyKey[][] = [];
  const visited = new WeakSet<object>();
  walkSceneRawCollect(rawRootOnly as SceneObject, [], predicate, resultPaths, visited);
  return resultPaths.map((path) => getProxyAtPath(scene, path));
}
