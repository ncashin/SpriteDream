import { parseSafe } from "remix/data-schema";
import type { InferOutput, Schema } from "remix/data-schema";

export type Trait<output = unknown> = (value: unknown) => output | undefined;

export const traits = new Set<Trait>();

export function defineTrait<schema extends Schema<any, any>>(
  schema: schema,
): Trait<InferOutput<schema>> {
  const trait: Trait<InferOutput<schema>> = (value) => {
    const result = parseSafe(schema, value);
    if (!result.success) return;
    return result.value;
  };
  traits.add(trait);
  return trait;
}
