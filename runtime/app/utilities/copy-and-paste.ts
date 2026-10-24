import { center } from "./bounding-box.ts";
import { hotkeys, isTyping } from "./hotkey.ts";
import { isObject } from "./is-object.ts";
import { Mode, mode } from "./mode.ts";
import { scene, type SceneNode } from "./scene.ts";
import { deselectObject, selectObjects, selectedObjects } from "./selected-objects.ts";
import { createMatrix, transform } from "./viewport/transform.ts";
import { cursorWorldPoint, type WorldPoint } from "./viewport/viewport.ts";

const PASTE_STEP = 32;
const OBJECT_CLIPBOARD = "spritedream/objects\n";

type ClipboardEntry = {
  parent: SceneNode;
  name: string;
  value: SceneNode;
};

let clipboard: ClipboardEntry[] = [];
let pasteCount = 0;
let lastPasteCursor: WorldPoint | undefined;
let objectPaste: ReturnType<typeof setTimeout> | undefined;

export function copySelectedObjects() {
  const next: ClipboardEntry[] = [];
  const seen = new Set<SceneNode>();
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
  const pasted: { parent: SceneNode; copy: SceneNode }[] = [];
  const containers = new Set(clipboard.map((entry) => entry.parent));
  for (const container of containers) {
    if (!isAttached(scene, container)) continue;
    const renamed = new Map<string, string>();
    const copies: SceneNode[] = [];
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
  const seen = new Set<SceneNode>();
  const removals: { parent: SceneNode; name: string; value: SceneNode }[] = [];
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

export type ClipboardContent =
  | { type: "objects"; objects: SceneNode[] }
  | { type: "image"; file: File }
  | { type: "text"; text: string };

type ClipboardHandler = (content: ClipboardContent, event: ClipboardEvent) => void;

export function createCopyAndPaste(options: {
  signal?: AbortSignal;
  onCopy?: ClipboardHandler;
  onPaste?: ClipboardHandler;
} = {}) {
  if (typeof window === "undefined") return;

  let copiedByShortcut = false;

  hotkeys(
    {
      "delete, backspace": (event) => {
        if (!deleteSelectedObjects()) return;
        event.preventDefault();
        event.stopPropagation();
      },
      "mod+c": () => {
        copiedByShortcut = copySelectedObjects();
      },
      "mod+v": () => {
        clearTimeout(objectPaste);
        objectPaste = setTimeout(() => {
          objectPaste = undefined;
          if (clipboard.length === 0 || mode !== Mode.Edit) return;
          const content: ClipboardContent = { type: "objects", objects: copiedObjects() };
          if (!options.onPaste) {
            pasteCopiedObjects();
            return;
          }
          options.onPaste(content, new ClipboardEvent("paste"));
        }, 0);
      },
    },
    { signal: options.signal, when: () => mode === Mode.Edit },
  );

  const handle = (handler: ClipboardHandler | undefined, event: ClipboardEvent) => {
    if (isTyping(event.target)) return;
    const content = clipboardContent(event.clipboardData);
    if (!content) return;
    handler?.(content, event);
  };

  window.addEventListener(
    "copy",
    (event) => {
      if (isTyping(event.target) || mode !== Mode.Edit) return;
      const copied = copiedByShortcut;
      copiedByShortcut = false;
      if (copied || copySelectedObjects()) {
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData?.setData("text/plain", encodeObjects(clipboard));
        options.onCopy?.({ type: "objects", objects: copiedObjects() }, event);
        return;
      }
      handle(options.onCopy, event);
    },
    { capture: true, signal: options.signal },
  );

  window.addEventListener(
    "paste",
    (event) => {
      if (isTyping(event.target) || mode !== Mode.Edit) return;
      const content = clipboardContent(event.clipboardData);
      if (!content || !options.onPaste) return;
      event.preventDefault();
      event.stopPropagation();
      clearTimeout(objectPaste);
      objectPaste = undefined;
      options.onPaste(content, event);
    },
    { capture: true, signal: options.signal },
  );
}

function copiedObjects() {
  return clipboard.map((entry) => entry.value);
}

function encodeObjects(entries: ClipboardEntry[]) {
  return OBJECT_CLIPBOARD + JSON.stringify(entries.map((entry) => entry.value));
}

function decodeObjects(text: string): SceneNode[] | undefined {
  if (!text.startsWith(OBJECT_CLIPBOARD)) return;
  try {
    const value = JSON.parse(text.slice(OBJECT_CLIPBOARD.length));
    if (!Array.isArray(value) || !value.every(isObject)) return;
    return value;
  } catch {
    return;
  }
}

function clipboardContent(data: DataTransfer | null): ClipboardContent | undefined {
  if (!data) return;
  const file = clipboardImage(data);
  if (file) return { type: "image", file };
  const text = data.getData("text/plain");
  const objects = text ? decodeObjects(text) : undefined;
  if (objects) return { type: "objects", objects };
  if (text) return { type: "text", text };
}

function clipboardImage(data: DataTransfer) {
  for (const file of data.files) {
    if (file.type.startsWith("image/")) return file;
  }
  for (const item of data.items) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
}

export async function pasteImage(file: File) {
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
  const object: SceneNode = {
    transform: createMatrix(),
    image: {
      width: String(image.naturalWidth || 64),
      height: String(image.naturalHeight || 64),
      tint: "#ffffffff",
      image: url,
    },
  };
  const placed = transform(object);
  if (placed && cursor) {
    placed.matrix.e = cursor.x;
    placed.matrix.f = cursor.y;
  }
  const name = uniqueName(scene, "image");
  scene[name] = object;
  selectObjects([object]);
}

export function pasteText(text: string) {
  const cursor = cursorWorldPoint();
  const object: SceneNode = {
    transform: createMatrix(),
    text: {
      value: text,
      font: "",
      fontWeight: 400,
      fontSize: 24,
      color: "#f4f4f5ff",
    },
  };
  const placed = transform(object);
  if (placed && cursor) {
    placed.matrix.e = cursor.x;
    placed.matrix.f = cursor.y;
  }
  const name = uniqueName(scene, "text");
  scene[name] = object;
  selectObjects([object]);
}

function findOwner(
  root: SceneNode,
  target: SceneNode,
): { parent: SceneNode; name: string } | undefined {
  for (const [name, value] of Object.entries(root)) {
    if (value === target) return { parent: root, name };
    if (isObject(value)) {
      const found = findOwner(value, target);
      if (found) return found;
    }
  }
}

function childOwners(container: SceneNode, name: string): { name: string; value: SceneNode }[] {
  const owned = new Set<string>([name]);
  const children: { name: string; value: SceneNode }[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const [key, value] of Object.entries(container)) {
      if (owned.has(key) || !isSceneNode(value)) continue;
      if (typeof value.parent !== "string" || !owned.has(value.parent)) continue;
      owned.add(key);
      children.push({ name: key, value });
      added = true;
    }
  }
  return children;
}

function isSceneNode(value: unknown): value is SceneNode {
  return isObject(value);
}

function pastedRoots(pasted: { parent: SceneNode; copy: SceneNode }[]) {
  const copies = new Set(pasted.map((entry) => entry.copy));
  return pasted.flatMap(({ parent, copy }) => {
    const owner = typeof copy.parent === "string" ? parent[copy.parent] : undefined;
    return copies.has(owner as SceneNode) ? [] : [copy];
  });
}

function isAttached(root: SceneNode, target: SceneNode): boolean {
  if (root === target) return true;
  for (const value of Object.values(root)) {
    if (!isObject(value)) continue;
    if (isAttached(value, target)) return true;
  }
  return false;
}

function moveToCursor(objects: SceneNode[]) {
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

function placementPoint(object: SceneNode): WorldPoint | undefined {
  const own = pointOf(object);
  if (own) return own;

  const points: WorldPoint[] = [];
  for (const value of Object.values(object)) {
    if (isObject(value)) collectPoints(value, points);
  }
  return averagePoint(points);
}

function collectPoints(object: SceneNode, points: WorldPoint[]) {
  const own = pointOf(object);
  if (own) {
    points.push(own);
    return;
  }
  for (const value of Object.values(object)) {
    if (isObject(value)) collectPoints(value, points);
  }
}

function pointOf(object: SceneNode): WorldPoint | undefined {
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

function translateObject(object: SceneNode, dx: number, dy: number) {
  const matrix = transform(object)?.matrix;
  if (matrix) {
    matrix.preMultiplySelf(new DOMMatrix().translate(dx, dy));
    return;
  }
  for (const value of Object.values(object)) {
    if (isObject(value)) translateObject(value, dx, dy);
  }
}

function uniqueName(parent: SceneNode, name: string) {
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
