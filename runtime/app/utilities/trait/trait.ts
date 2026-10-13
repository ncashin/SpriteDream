import type { IconNode } from "lucide";
import { parseSafe } from "remix/data-schema";
import type { InferOutput, Schema } from "remix/data-schema";

import { isObject } from "../is-object.ts";

export type Trait<output = unknown> = (value: unknown) => output | undefined;

export type TraitEntry = {
  name: string;
  icon: IconNode;
  trait: Trait;
};

export const traits = new Set<TraitEntry>();

const initials = new WeakMap<Trait, () => Record<string, unknown>>();

export function defineTrait<schema extends Schema<any, any>>(
  name: string,
  icon: IconNode,
  schema: schema,
  create?: () => Record<string, unknown>,
): Trait<InferOutput<schema>> {
  const trait: Trait<InferOutput<schema>> = (value) => {
    const result = parseSafe(schema, value);
    if (!result.success) return;
    if (isObject(value) && isObject(result.value)) {
      writeParsed(value, result.value);
      return value as InferOutput<schema>;
    }
    return result.value;
  };
  if (create) initials.set(trait, create);
  traits.add({ name, icon, trait });
  return trait;
}

export function applyTrait<output>(
  trait: Trait<output>,
  object: Record<string, unknown>,
): output | undefined {
  const value: Record<string, unknown> = { ...object };
  const created = initials.get(trait as Trait)?.() ?? trait({});
  if (isObject(created)) {
    for (const key of Object.keys(created)) {
      if (!Object.hasOwn(value, key)) value[key] = created[key];
    }
  }

  const applied = trait(value);
  if (!isObject(applied)) return;
  writeParsed(object, applied);
  return object as output;
}

function writeParsed(target: Record<string, unknown>, parsed: Record<string, unknown>) {
  for (const key of Object.keys(parsed)) {
    const next = parsed[key];
    const current = target[key];
    if (isObject(current) && isObject(next)) {
      writeParsed(current, next);
      continue;
    }
    target[key] = next;
  }
}
