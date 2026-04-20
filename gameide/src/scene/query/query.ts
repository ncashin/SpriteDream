import { SceneObject } from "../scene";

export function query<T>(
  root: SceneObject,
  predicate: (value: unknown) => value is T,
): T[] {
  const matches: T[] = [];
  const seen = new WeakSet<object>();

  const walk = (node: unknown): void => {
    if (!(node && typeof node === "object")) return;
    if (seen.has(node)) return;
    seen.add(node);
    if (predicate(node)) matches.push(node);
    const record = node as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      walk(record[key]);
    }
  };

  walk(root);
  return matches;
}
