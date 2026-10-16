import type { IconNode } from "lucide";
import Atom from "lucide/dist/esm/icons/atom.mjs";
import AppWindow from "lucide/dist/esm/icons/app-window.mjs";
import ImageIcon from "lucide/dist/esm/icons/image.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import Type from "lucide/dist/esm/icons/type.mjs";

import { routes } from "../routes.ts";
import { isObject } from "./is-object.ts";

export type SceneNode = string | DOMMatrix | IconNode | { [name: string]: SceneNode };

export function createScene(): { [name: string]: SceneNode } {
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

export type ScenePatch = { path: string[]; value?: unknown }[];

let before = plain(scene);

export function takeScenePatch(): ScenePatch {
  const after = plain(scene);
  const patch: ScenePatch = [];
  diff(before, after, [], patch);
  before = after;
  return patch;
}

export function applyScenePatch(patch: ScenePatch) {
  for (const change of patch) {
    let parent: unknown = scene;
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
  before = plain(scene);
}

function diff(previous: unknown, next: unknown, path: string[], patch: ScenePatch) {
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  if (isRecord(previous) && isRecord(next)) {
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (!Object.hasOwn(next, key)) patch.push({ path: [...path, key] });
      else if (!Object.hasOwn(previous, key)) patch.push({ path: [...path, key], value: next[key] });
      else diff(previous[key], next[key], [...path, key], patch);
    }
    return;
  }
  patch.push({ path, value: next });
}

function plain(value: unknown): unknown {
  if (value instanceof DOMMatrix) return { __matrix: [value.a, value.b, value.c, value.d, value.e, value.f] };
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.map(plain);
  if (!isObject(value)) return;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const next = plain(child);
    if (next !== undefined) copy[key] = next;
  }
  return copy;
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
  return isObject(value) && !isMatrix(value);
}

function isMatrix(value: unknown): value is { __matrix: [number, number, number, number, number, number] } {
  return isObject(value) && Array.isArray(value.__matrix);
}

let snapshot: { [name: string]: SceneNode } | undefined;

export function snapshotScene() {
  snapshot = cloneData(scene) as { [name: string]: SceneNode };
}

export function restoreScene() {
  if (!snapshot) return;
  for (const key of Object.keys(scene)) delete scene[key];
  Object.assign(scene, cloneData(snapshot));
}

function cloneData(value: unknown): unknown {
  if (typeof value === "function") return value;
  if (value instanceof DOMMatrix) return DOMMatrix.fromMatrix(value);
  if (Array.isArray(value)) return value.map(cloneData);
  if (!isObject(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) copy[key] = cloneData(child);
  return copy;
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
  scene: { [name: string]: SceneNode },
  check: (value: SceneNode) => Result,
): NonNullable<Result>[] {
  return Object.values(scene)
    .map(check)
    .filter((node): node is NonNullable<Result> => node != null);
}
