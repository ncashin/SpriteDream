import type { BaseSceneObject } from "./scene.js";

export function getValueAtPath(
  root: Record<PropertyKey, unknown>,
  path: PropertyKey[],
): unknown {
  let node: unknown = root;
  for (const key of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  return node;
}

export function setValueAtPath(
  root: Record<PropertyKey, unknown>,
  path: PropertyKey[],
  value: unknown,
): void {
  if (path.length === 0) return;
  if (value === undefined) {
    deleteValueAtPath(root, path);
    return;
  }
  let node: Record<PropertyKey, unknown> = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    let next = node[key];
    const needsObject =
      next === undefined ||
      next === null ||
      typeof next !== "object" ||
      Array.isArray(next);
    if (needsObject) {
      next = {};
      node[key] = next;
    }
    node = next as Record<PropertyKey, unknown>;
  }
  node[path[path.length - 1]] = value;
}

export function deleteValueAtPath(
  root: Record<PropertyKey, unknown>,
  path: PropertyKey[],
): void {
  if (path.length === 0) return;
  let node: Record<PropertyKey, unknown> = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const next = node[key];
    if (next === null || typeof next !== "object") return;
    node = next as Record<PropertyKey, unknown>;
  }
  Reflect.deleteProperty(node, path[path.length - 1]);
}

export function setChildKeyOrder(
  parent: Record<PropertyKey, unknown>,
  orderedKeys: string[],
): void {
  const p = parent as Record<string, unknown>;
  const pairs: [string, unknown][] = [];
  for (const k of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(p, k)) pairs.push([k, p[k]]);
  }
  for (const k of Object.keys(p)) {
    Reflect.deleteProperty(p, k);
  }
  for (const [k, v] of pairs) {
    p[k] = v;
  }
}

export function pathStartsWith(prefix: PropertyKey[], path: PropertyKey[]): boolean {
  if (prefix.length > path.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (prefix[i] !== path[i]) return false;
  }
  return true;
}

export function pathsEqual(a: PropertyKey[], b: PropertyKey[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** DFS from `root` using reference equality (matches proxied scene nodes). */
export function findSceneObjectPath(
  root: BaseSceneObject,
  target: BaseSceneObject,
): PropertyKey[] | null {
  const visited = new WeakSet<object>();

  const walk = (node: unknown, path: PropertyKey[]): PropertyKey[] | null => {
    if (node === target) return path;
    if (!node || typeof node !== "object") return null;
    if (visited.has(node)) return null;
    visited.add(node);
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const found = walk(record[key], path.concat(key));
      if (found !== null) return found;
    }
    return null;
  };

  return walk(root, []);
}

export function getRecordAtPath(
  root: Record<PropertyKey, unknown>,
  path: PropertyKey[],
): Record<PropertyKey, unknown> | undefined {
  const v = path.length === 0 ? root : getValueAtPath(root, path);
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<PropertyKey, unknown>;
  }
  return undefined;
}

export function uniqueChildKey(parent: Record<PropertyKey, unknown>, base: string): string {
  if (!(base in parent)) return base;
  let i = 2;
  while (`${base}_${i}` in parent) i++;
  return `${base}_${i}`;
}

export function reorderKeyAmongSiblings(
  root: Record<PropertyKey, unknown>,
  parentPath: PropertyKey[],
  draggedKey: string,
  referenceKey: string,
  side: "before" | "after",
): void {
  const parent = parentPath.length === 0 ? root : getRecordAtPath(root, parentPath);
  if (!parent) return;
  const keys = Object.keys(parent as object).filter((k) => k !== draggedKey);
  const refIdx = keys.indexOf(referenceKey);
  if (refIdx === -1) return;
  const insertAt = side === "before" ? refIdx : refIdx + 1;
  keys.splice(insertAt, 0, draggedKey);
  setChildKeyOrder(parent, keys);
}

export function reparentKey(
  root: Record<PropertyKey, unknown>,
  fromPath: PropertyKey[],
  newParentPath: PropertyKey[],
): void {
  if (fromPath.length === 0) return;
  if (pathsEqual(fromPath, newParentPath)) return;
  if (
    pathStartsWith(fromPath, newParentPath) &&
    newParentPath.length > fromPath.length
  ) {
    return;
  }

  const fromKey = String(fromPath[fromPath.length - 1]);
  const val = getValueAtPath(root, fromPath);
  if (val === undefined) return;

  deleteValueAtPath(root, fromPath);

  const newParent = newParentPath.length === 0 ? root : getRecordAtPath(root, newParentPath);
  if (!newParent) return;
  newParent[uniqueChildKey(newParent, fromKey)] = val;
}

/** Move `fromPath` into `containerPath` as a new child (append). */
export function reparentIntoObject(
  root: Record<PropertyKey, unknown>,
  fromPath: PropertyKey[],
  containerPath: PropertyKey[],
): void {
  if (fromPath.length === 0) return;
  if (pathsEqual(fromPath, containerPath)) return;
  if (
    pathStartsWith(fromPath, containerPath) &&
    containerPath.length > fromPath.length
  ) {
    return;
  }

  const fromKey = String(fromPath[fromPath.length - 1]);
  const val = getValueAtPath(root, fromPath);
  if (val === undefined) return;

  deleteValueAtPath(root, fromPath);

  const container = getRecordAtPath(root, containerPath);
  if (!container) return;
  container[uniqueChildKey(container, fromKey)] = val;
}

export function reparentAndPlaceBeside(
  root: Record<PropertyKey, unknown>,
  fromPath: PropertyKey[],
  targetPath: PropertyKey[],
  side: "before" | "after",
): void {
  if (fromPath.length === 0 || targetPath.length === 0) return;
  const targetParentPath = targetPath.slice(0, -1);
  if (
    pathStartsWith(fromPath, targetParentPath) &&
    targetParentPath.length > fromPath.length
  ) {
    return;
  }

  const refKey = String(targetPath[targetPath.length - 1]);
  const dragParentPath = fromPath.slice(0, -1);
  const dragKey = String(fromPath[fromPath.length - 1]);

  if (pathsEqual(dragParentPath, targetParentPath)) {
    reorderKeyAmongSiblings(root, dragParentPath, dragKey, refKey, side);
    return;
  }

  const val = getValueAtPath(root, fromPath);
  if (val === undefined) return;
  deleteValueAtPath(root, fromPath);

  const parent =
    targetParentPath.length === 0 ? root : getRecordAtPath(root, targetParentPath);
  if (!parent) return;
  const nextKey = uniqueChildKey(parent, dragKey);
  parent[nextKey] = val;
  reorderKeyAmongSiblings(root, targetParentPath, nextKey, refKey, side);
}
