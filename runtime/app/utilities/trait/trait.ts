import { parseSafe } from "remix/data-schema";
import type { InferOutput, Schema } from "remix/data-schema";

import { isObject } from "../is-object.ts";

export type Trait<output = unknown> = (value: unknown) => output | undefined;

export const traits = new Set<Trait>();

export function defineTrait<schema extends Schema<any, any>>(
  schema: schema,
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
  traits.add(trait);
  return trait;
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
