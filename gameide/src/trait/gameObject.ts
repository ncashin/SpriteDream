import type { TraitInputItem, TraitTupleToIntersection } from "./trait.js";
import { isTraitHandle } from "./trait.js";

export type GameObjectParts<T extends readonly TraitInputItem[]> = T extends readonly []
  ? Record<string, never>
  : T extends readonly [TraitInputItem, ...TraitInputItem[]]
    ? TraitTupleToIntersection<T>
    : never;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clonePlainBranch(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value) as Record<string, unknown>;
}

function mergeDeepInto(target: Record<string, unknown>, source: object): void {
  for (const [key, value] of Object.entries(source)) {
    const prev = target[key];
    if (
      isPlainRecord(prev) &&
      isPlainRecord(value) &&
      !isTraitHandle(prev) &&
      !isTraitHandle(value)
    ) {
      mergeDeepInto(prev, value);
    } else {
      if (isPlainRecord(value) && !isTraitHandle(value)) {
        target[key] = clonePlainBranch(value);
      } else {
        target[key] = value;
      }
    }
  }
}

export function gameObject<const T extends readonly TraitInputItem[]>(
  parts: T,
): GameObjectParts<T> {
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    mergeDeepInto(out, part as object);
  }
  return out as GameObjectParts<T>;
}
