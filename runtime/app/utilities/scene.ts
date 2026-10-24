import { syncMode } from "../actions/editor/room.tsx";
import { routes } from "../routes.ts";
import { hotkeys } from "./hotkey.ts";
import { isObject } from "./is-object.ts";
import { Mode } from "./mode.ts";

export type ScenePath = string[];
export type SceneNode = { [key in PropertyKey]: any };

export const scene: SceneNode = {};

let sceneName = "Example Scene";

export function currentSceneName() {
  return sceneName;
}

export function fetchScene(name: string): Promise<SceneNode | undefined> {
  return fetch(routes.editor.scene.href({ name })).then(async (response) => {
    if (!response.ok) return;
    const next: unknown = await response.json();
    if (!isObject(next)) return;
    return next;
  });
}

export function loadScene(name = "Example Scene") {
  return fetchScene(name).then((next) => {
    if (!next) return;
    for (const key of Object.keys(scene)) delete scene[key];
    Object.assign(scene, next);
    sceneName = name;
    syncMode(Mode.Edit);
  });
}

export function saveScene() {
  return fetch(routes.editor.saveScene.href({ name: sceneName }), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scene),
  });
}

export function saveSceneHotkey(signal?: AbortSignal) {
  hotkeys(
    {
      "mod+s": (event) => {
        event.preventDefault();
        event.stopPropagation();
        void saveScene();
      },
    },
    { signal, typing: true },
  );
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
    if ("value" in change) parent[key] = revive(change.value);
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
  if (isObject(previous) && isObject(next)) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (!Object.hasOwn(next, key)) patch.push({ path: [...path, key] });
      else if (!Object.hasOwn(previous, key)) patch.push({ path: [...path, key], value: JSON.parse(JSON.stringify(next[key])) });
      else walk(previous[key], next[key], [...path, key], patch);
    }
    return;
  }
  patch.push({ path, value: JSON.parse(JSON.stringify(next) ?? "null") });
}

function revive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(revive);
  if (!isObject(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = revive(child);
  return copy;
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
