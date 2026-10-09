import type { GameObject } from "../actions/editor/object-tree.tsx";
import { center } from "./bounding.ts";
import { isObject } from "./is-object.ts";
import { Mode, mode } from "./mode.ts";
import { scene } from "./scene.ts";
import { selectObjects, selectedObjects } from "./selected-objects.ts";
import { cursorWorldPoint, type WorldPoint } from "./viewport/viewport.ts";

const PASTE_STEP = 32;

type ClipboardEntry = {
  parent: GameObject;
  name: string;
  value: GameObject;
};

let clipboard: ClipboardEntry[] = [];
let pasteCount = 0;
let lastPasteCursor: WorldPoint | undefined;

export function copySelectedObjects() {
  const next: ClipboardEntry[] = [];
  for (const object of selectedObjects) {
    const owner = findOwner(scene, object);
    if (!owner) continue;
    next.push({ parent: owner.parent, name: owner.name, value: structuredClone(object) });
  }
  if (next.length === 0) return false;
  clipboard = next;
  pasteCount = 0;
  lastPasteCursor = undefined;
  return true;
}

export function pasteCopiedObjects() {
  if (clipboard.length === 0) return false;
  const pasted: GameObject[] = [];
  for (const entry of clipboard) {
    if (!isAttached(scene, entry.parent)) continue;
    const copy = structuredClone(entry.value);
    const name = uniqueName(entry.parent, entry.name);
    entry.parent[name] = copy;
    pasted.push(copy);
  }
  if (pasted.length === 0) return false;
  moveToCursor(pasted);
  selectObjects(pasted);
  return true;
}

export function copyAndPaste(options?: { signal?: AbortSignal }) {
  if (typeof window === "undefined") return;

  const onKeyDown = (event: KeyboardEvent) => {
    if (mode !== Mode.Edit) return;
    if (event.repeat || event.altKey || event.shiftKey) return;
    if (!event.metaKey && !event.ctrlKey) return;
    if (isTyping(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === "c" && copySelectedObjects()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (key === "v" && pasteCopiedObjects()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  window.addEventListener("keydown", onKeyDown, { capture: true, signal: options?.signal });
}

function findOwner(
  root: GameObject,
  target: GameObject,
): { parent: GameObject; name: string } | undefined {
  for (const [name, value] of Object.entries(root)) {
    if (value === target) return { parent: root, name };
    if (isObject(value) && !(value instanceof DOMMatrix)) {
      const found = findOwner(value, target);
      if (found) return found;
    }
  }
}

function isAttached(root: GameObject, target: GameObject): boolean {
  if (root === target) return true;
  for (const value of Object.values(root)) {
    if (!isObject(value) || value instanceof DOMMatrix) continue;
    if (isAttached(value, target)) return true;
  }
  return false;
}

function moveToCursor(objects: GameObject[]) {
  const cursor = cursorWorldPoint();
  const anchor = averagePoint(objects.flatMap((object) => {
    const point = placementPoint(object);
    return point ? [point] : [];
  }));
  if (!cursor || !anchor) {
    pasteCount += 1;
    const distance = PASTE_STEP * pasteCount;
    for (const object of objects) translateObject(object, distance, distance);
    lastPasteCursor = undefined;
    return;
  }

  const same =
    lastPasteCursor !== undefined &&
    lastPasteCursor.x === cursor.x &&
    lastPasteCursor.y === cursor.y;
  pasteCount = same ? pasteCount + 1 : 0;
  lastPasteCursor = { x: cursor.x, y: cursor.y };
  const step = PASTE_STEP * pasteCount;
  for (const object of objects) {
    translateObject(object, cursor.x - anchor.x + step, cursor.y - anchor.y + step);
  }
}

function placementPoint(object: GameObject): WorldPoint | undefined {
  const own = pointOf(object);
  if (own) return own;

  const points: WorldPoint[] = [];
  for (const value of Object.values(object)) {
    if (isObject(value) && !(value instanceof DOMMatrix)) collectPoints(value, points);
  }
  return averagePoint(points);
}

function collectPoints(object: GameObject, points: WorldPoint[]) {
  const own = pointOf(object);
  if (own) {
    points.push(own);
    return;
  }
  for (const value of Object.values(object)) {
    if (isObject(value) && !(value instanceof DOMMatrix)) collectPoints(value, points);
  }
}

function pointOf(object: GameObject): WorldPoint | undefined {
  const transform = object.transform;
  if (!(transform instanceof DOMMatrix)) return;

  const width = Number(object.width);
  const height = Number(object.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return { x: transform.e, y: transform.f };
  return center({ transform, width, height });
}

function averagePoint(points: WorldPoint[]): WorldPoint | undefined {
  if (points.length === 0) return;
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function translateObject(object: GameObject, dx: number, dy: number) {
  const transform = object.transform;
  if (transform instanceof DOMMatrix) {
    transform.e += dx;
    transform.f += dy;
    return;
  }
  for (const value of Object.values(object)) {
    if (isObject(value) && !(value instanceof DOMMatrix)) translateObject(value, dx, dy);
  }
}

function uniqueName(parent: GameObject, name: string) {
  if (!Object.hasOwn(parent, name)) return name;
  const base = name.replace(/\d+$/, "");
  let index = 2;
  let next = `${base}${index}`;
  while (Object.hasOwn(parent, next)) {
    index += 1;
    next = `${base}${index}`;
  }
  return next;
}

function isTyping(target: EventTarget | null) {
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}
