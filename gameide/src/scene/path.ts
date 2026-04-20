/** Read/write nested keys on a scene object (plain records; not proxy-aware). */

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
