import { isObject } from "./is-object.ts";

export type ScenePath = string[];
export type SceneNode = { [key in PropertyKey]: any };

export const scene: SceneNode = {};

let sceneName = "Example Scene";

export function currentSceneName() {
  return sceneName;
}

export type ScenePatch = { path: ScenePath; value?: unknown }[];


export function applyScenePatch(patch: ScenePatch, root: SceneNode) {
  for (const change of patch) {
    let parent: unknown = root;
    for (let index = 0; index < change.path.length - 1; index++) {
      if (!isObject(parent)) {
        parent = undefined;
        break;
      }
      parent = parent[change.path[index]];
    }
    const key = change.path[change.path.length - 1];
    if (!isObject(parent) || key === undefined) continue;
    if ("value" in change) parent[key] = structuredClone(change.value);
    else delete parent[key];
  }
}

export function diffScene(previous: unknown, next: unknown): ScenePatch {
  const patch: ScenePatch = [];
  walk(previous, next, [], patch);
  return patch;
}

function walk(previous: unknown, next: unknown, path: ScenePath, patch: ScenePatch) {
  if (JSON.stringify(previous) === JSON.stringify(next)) return;

  if (!isObject(previous) || !isObject(next)) {
    patch.push({ path, value: structuredClone(next) });
    return;
  }

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    const childPath = [...path, key];
    if (!Object.hasOwn(next, key)) {
      patch.push({ path: childPath });
    } else if (!Object.hasOwn(previous, key)) {
      patch.push({ path: childPath, value: structuredClone(next[key]) });
    } else {
      walk(previous[key], next[key], childPath, patch);
    }
  }
}

export function objectPath(root: object, target: object): string[] | undefined {
  for (const [key, value] of Object.entries(root)) {
    if (value === target) return [key];
    if (!isObject(value)) continue;
    const nested = objectPath(value, target);
    if (nested) return [key, ...nested];
  }
}

export function objectAt(root: object, path: readonly string[]): Record<string, unknown> | undefined {
  let current: unknown = root;
  for (const key of path) {
    if (!isObject(current)) return;
    current = current[key];
  }
  if (!isObject(current)) return;
  return current;
}

export function filterScene<Result>(
  scene: SceneNode,
  check: (value: SceneNode) => Result,
): NonNullable<Result>[] {
  return Object.values(scene)
    .map(check)
    .filter((node): node is NonNullable<Result> => node != null);
}
