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

type PropertyName<name extends string> = name extends `${infer First} ${infer Rest}`
  ? `${Lowercase<First>}${Capitalize<PropertyName<Rest>>}`
  : Lowercase<name>;

const stored = new WeakMap<Trait, { property: string; schema: Schema<any, any> }>();

export function defineTrait<name extends string, schema extends Schema<any, any>>(
  name: name,
  icon: IconNode,
  schema: schema,
): Trait<{ [K in PropertyName<name>]: InferOutput<schema> }> {
  const property = propertyName(name);
  const trait: Trait<{ [K in PropertyName<name>]: InferOutput<schema> }> = (value) => {
    if (!isObject(value)) return;
    const child = value[property];
    const result = parseSafe(schema, child);
    if (!result.success) return;
    if (isObject(child) && isObject(result.value)) writeParsed(child, result.value);
    const next = value[property];
    if (isObject(next) && next.__icon === undefined) next.__icon = icon;
    return value as { [K in PropertyName<name>]: InferOutput<schema> };
  };
  stored.set(trait, { property, schema });
  traits.add({ name, icon, trait });
  return trait;
}

export function applyTrait<output>(
  trait: Trait<output>,
  object: Record<string, unknown>,
): output | undefined {
  const entry = stored.get(trait as Trait);
  if (entry) {
    const defaults = parseSafe(entry.schema, {});
    if (defaults.success && isObject(defaults.value)) {
      const current = object[entry.property];
      if (!isObject(current)) object[entry.property] = { ...defaults.value };
      else {
        for (const field of Object.keys(defaults.value)) {
          if (!Object.hasOwn(current, field)) current[field] = defaults.value[field];
        }
      }
    } else if (defaults.success && object[entry.property] === undefined) {
      object[entry.property] = defaults.value;
    }
  }

  return trait(object);
}

function propertyName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function writeParsed(target: Record<string, unknown>, parsed: Record<string, unknown>) {
  for (const field of Object.keys(parsed)) {
    const next = parsed[field];
    const current = target[field];
    if (isObject(current) && isObject(next)) {
      writeParsed(current, next);
      continue;
    }
    target[field] = next;
  }
}
