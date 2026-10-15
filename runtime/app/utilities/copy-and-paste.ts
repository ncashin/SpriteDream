import type { GameObject } from "../actions/editor/object-tree.tsx";
import { center } from "./bounding-box.ts";
import { isObject } from "./is-object.ts";
import { Mode, mode } from "./mode.ts";
import { scene } from "./scene.ts";
import { deselectObject, selectObjects, selectedObjects } from "./selected-objects.ts";
import { transform } from "./viewport/transform.ts";
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
let objectPaste: ReturnType<typeof setTimeout> | undefined;

export function copySelectedObjects() {
  const next: ClipboardEntry[] = [];
  const seen = new Set<GameObject>();
  for (const object of selectedObjects) {
    const owner = findOwner(scene, object);
    if (!owner || seen.has(object)) continue;
    const items = [{ name: owner.name, value: object }, ...childOwners(owner.parent, owner.name)];
    for (const item of items) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      next.push({
        parent: owner.parent,
        name: item.name,
        value: structuredClone(item.value),
      });
    }
  }
  if (next.length === 0) return false;
  clipboard = next;
  pasteCount = 0;
  lastPasteCursor = undefined;
  return true;
}

export function pasteCopiedObjects() {
  if (clipboard.length === 0) return false;
  const pasted: { parent: GameObject; copy: GameObject }[] = [];
  const containers = new Set(clipboard.map((entry) => entry.parent));
  for (const container of containers) {
    if (!isAttached(scene, container)) continue;
    const renamed = new Map<string, string>();
    const copies: GameObject[] = [];
    for (const entry of clipboard) {
      if (entry.parent !== container) continue;
      const copy = structuredClone(entry.value);
      const name = uniqueName(container, entry.name);
      renamed.set(entry.name, name);
      container[name] = copy;
      copies.push(copy);
      pasted.push({ parent: container, copy });
    }
    for (const copy of copies) {
      if (typeof copy.parent === "string" && renamed.has(copy.parent)) {
        copy.parent = renamed.get(copy.parent);
      }
    }
  }
  if (pasted.length === 0) return false;
  moveToCursor(pastedRoots(pasted));
  selectObjects(pasted.map((entry) => entry.copy));
  return true;
}

export function deleteSelectedObjects() {
  const seen = new Set<GameObject>();
  const removals: { parent: GameObject; name: string; value: GameObject }[] = [];
  for (const object of selectedObjects) {
    const owner = findOwner(scene, object);
    if (!owner || seen.has(object)) continue;
    const items = [{ name: owner.name, value: object }, ...childOwners(owner.parent, owner.name)];
    for (const item of items) {
      if (seen.has(item.value)) continue;
      seen.add(item.value);
      removals.push({ parent: owner.parent, ...item });
    }
  }
  if (removals.length === 0) return false;
  for (const item of removals) {
    deselectObject(item.value);
    delete item.parent[item.name];
  }
  return true;
}

export function copyAndPaste(options?: { signal?: AbortSignal }) {
  if (typeof window === "undefined") return;

  const onKeyDown = (event: KeyboardEvent) => {
    if (mode !== Mode.Edit) return;
    if (event.repeat || event.altKey || event.shiftKey) return;
    if (isTyping(event.target)) return;

    const key = event.key.toLowerCase();
    if (key === "delete" || key === "backspace") {
      if (!deleteSelectedObjects()) return;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (!event.metaKey && !event.ctrlKey) return;
    if (key === "c" && copySelectedObjects()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (key === "v") {
      clearTimeout(objectPaste);
      objectPaste = setTimeout(() => {
        objectPaste = undefined;
        pasteCopiedObjects();
      }, 0);
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    if (mode !== Mode.Edit) return;
    if (isTyping(event.target)) return;
    const file = clipboardImage(event.clipboardData);
    if (!file) return;
    clearTimeout(objectPaste);
    objectPaste = undefined;
    event.preventDefault();
    event.stopPropagation();
    void pasteImage(file);
  };

  window.addEventListener("keydown", onKeyDown, { capture: true, signal: options?.signal });
  window.addEventListener("paste", onPaste, { capture: true, signal: options?.signal });
}

function clipboardImage(data: DataTransfer | null) {
  if (!data) return;
  for (const file of data.files) {
    if (file.type.startsWith("image/")) return file;
  }
  for (const item of data.items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
}

async function pasteImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    return;
  }

  const cursor = cursorWorldPoint();
  const object: GameObject = {
    transform: new DOMMatrix().translate(cursor?.x ?? 0, cursor?.y ?? 0),
    image: {
      width: String(image.naturalWidth || 64),
      height: String(image.naturalHeight || 64),
      tint: "#ffffffff",
      image: url,
    },
  };
  const name = uniqueName(scene, "image");
  scene[name] = object;
  selectObjects([object]);
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

function childOwners(container: GameObject, name: string): { name: string; value: GameObject }[] {
  const owned = new Set<string>([name]);
  const children: { name: string; value: GameObject }[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const [key, value] of Object.entries(container)) {
      if (owned.has(key) || !isGameObject(value)) continue;
      if (typeof value.parent !== "string" || !owned.has(value.parent)) continue;
      owned.add(key);
      children.push({ name: key, value });
      added = true;
    }
  }
  return children;
}

function pastedRoots(pasted: { parent: GameObject; copy: GameObject }[]) {
  const copies = new Set(pasted.map((entry) => entry.copy));
  return pasted.flatMap(({ parent, copy }) => {
    const owner = typeof copy.parent === "string" ? parent[copy.parent] : undefined;
    return copies.has(owner as GameObject) ? [] : [copy];
  });
}

function isGameObject(value: unknown): value is GameObject {
  return isObject(value) && !(value instanceof DOMMatrix);
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
  const matrix = transform(object)?.matrix;
  if (!matrix) return;

  const image = isObject(object.image) ? object.image : undefined;
  const width = Number(image?.width);
  const height = Number(image?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return { x: matrix.e, y: matrix.f };
  return center({ transform: matrix, width, height });
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
  const matrix = transform(object)?.matrix;
  if (matrix) {
    matrix.preMultiplySelf(new DOMMatrix().translate(dx, dy));
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
