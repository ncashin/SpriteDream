import Atom from "lucide/dist/esm/icons/atom.mjs";
import AppWindow from "lucide/dist/esm/icons/app-window.mjs";
import ImageIcon from "lucide/dist/esm/icons/image.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import Type from "lucide/dist/esm/icons/type.mjs";

import { routes } from "../routes.ts";
import { isObject } from "./is-object.ts";

export type ScenePath = string[];
export type SceneNode = { [key in PropertyKey]: any };

export function createScene(): SceneNode {
  return {
    square: {
      transform: new DOMMatrix().translate(350, 180),
      image: {
        __icon: ImageIcon,
        width: "64",
        height: "64",
        tint: "#f4f4f5ff",
        image: "default.png",
      },
      booleanValue: "true",
      physicsBody: {
        __icon: Atom,
        body: "dynamic",
        density: "1",
        fixedRotation: "false",
        gravity: "9.8",
        velocity: { x: "0", y: "0" },
      },
      collider: {
        __icon: Square,
        width: "64",
        height: "64",
        friction: "0.4",
        restitution: "0.2",
        propagateCollision: "true",
      },
    },
    ground: {
      transform: new DOMMatrix().translate(400, 560),
      image: {
        __icon: ImageIcon,
        width: "720",
        height: "24",
        tint: "#a1a1aaff",
        image: "default.png",
      },
      collider: {
        __icon: Square,
        width: "720",
        height: "24",
        friction: "0.6",
        restitution: "0",
      },
    },
    rectangle: {
      transform: new DOMMatrix().translate(70, 80).rotateSelf(25),
      image: {
        __icon: ImageIcon,
        width: "36",
        height: "36",
        tint: "#d4d4d8ff",
        image: "default.png",
      },
      collider: {
        __icon: Square,
        width: "36",
        height: "36",
        friction: "0.05",
        restitution: "0.4",
      },
      parent: "square",
    },
    panel: {
      transform: new DOMMatrix().translate(560, 160),
      count: "0",
      frame: {
        __icon: AppWindow,
        frameSource: routes.game.panel.href(),
        width: "220",
        height: "120",
      },
      collider: {
        __icon: Square,
        width: "220",
        height: "120",
        friction: "0.4",
        restitution: "0",
      },
    },
    label: {
      transform: new DOMMatrix().translate(400, 40),
      text: {
        __icon: Type,
        value: "Spritedream",
        font: "",
        fontSize: "32",
        color: "#f4f4f5ff",
      },
    },
    key: "property",
    test: { nested: { objects: "hello"}},
  };
}

export const scene = createScene();

export type ScenePatch = { path: ScenePath; value?: unknown }[];

export function applyScenePatch(patch: ScenePatch, root: SceneNode = scene) {
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
  const matrix = (_key: string, item: unknown) =>
    item instanceof DOMMatrix
      ? { __matrix: [item.a, item.b, item.c, item.d, item.e, item.f] }
      : item;
  if (JSON.stringify(previous, matrix) === JSON.stringify(next, matrix)) return;
  if (isRecord(previous) && isRecord(next)) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (!Object.hasOwn(next, key)) patch.push({ path: [...path, key] });
      else if (!Object.hasOwn(previous, key)) patch.push({ path: [...path, key], value: JSON.parse(JSON.stringify(next[key], matrix)) });
      else walk(previous[key], next[key], [...path, key], patch);
    }
    return;
  }
  patch.push({ path, value: JSON.parse(JSON.stringify(next, matrix) ?? "null") });
}

function revive(value: unknown): unknown {
  if (isMatrix(value)) return new DOMMatrix(value.__matrix);
  if (Array.isArray(value)) return value.map(revive);
  if (!isObject(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = revive(child);
  return copy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !(value instanceof DOMMatrix) && !isMatrix(value);
}

function isMatrix(value: unknown): value is { __matrix: [number, number, number, number, number, number] } {
  return isObject(value) && Array.isArray(value.__matrix);
}

let snapshot: SceneNode | undefined;

export function snapshotScene() {
  if (snapshot) return;
  snapshot = structuredClone(scene);
}

export function restoreScene() {
  if (!snapshot) return false;
  for (const key of Object.keys(scene)) delete scene[key];
  Object.assign(scene, structuredClone(snapshot));
  snapshot = undefined;
  return true;
}

export function objectPath(root: object, target: object): string[] | undefined {
  for (const [key, value] of Object.entries(root)) {
    if (value === target) return [key];
    if (!isObject(value) || value instanceof DOMMatrix) continue;
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
  if (!isObject(current) || current instanceof DOMMatrix) return;
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
