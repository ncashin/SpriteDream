import type { TraitInputItem, TraitTupleToIntersection } from "./trait.js";

export type GameObjectParts<T extends readonly TraitInputItem[]> = T extends readonly []
  ? Record<string, never>
  : T extends readonly [TraitInputItem, ...TraitInputItem[]]
    ? TraitTupleToIntersection<T>
    : never;

/**
 * Shallow-merges trait handles and/or plain schema objects in order. Later parts override
 * earlier ones for duplicate top-level keys (same semantics as `{ ...a, ...b }`).
 */
export function gameObject<const T extends readonly TraitInputItem[]>(
  parts: T,
): GameObjectParts<T> {
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    Object.assign(out, part as object);
  }
  return out as GameObjectParts<T>;
}
