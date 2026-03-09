import type { SceneObject } from "./scene.js";

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === "object" && value !== null;
}

export type QuerySceneCallback = (object: SceneObject) => boolean;

export function querySceneObjects(
  scene: SceneObject,
  callback: QuerySceneCallback
): SceneObject[] {
  const results: SceneObject[] = [];
  const visited = new WeakSet<object>();

  function walk(object: SceneObject): void {
    if (visited.has(object)) return;
    visited.add(object);

    if (callback(object)) {
      results.push(object);
    }

    for (const key of Object.keys(object)) {
      const value = object[key];
      if (isSceneObject(value)) {
        walk(value);
      }
    }
  }

  walk(scene);
  return results;
}
