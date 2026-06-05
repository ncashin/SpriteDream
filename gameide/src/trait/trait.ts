import { z, type ZodTypeAny } from "zod";
import { IconSlug } from "../lucide/lucideIconSlug";

export type TraitMetadata = {
  name?: string;
  description?: string;
  icon?: IconSlug;
};

export type TraitDefinitionEntry<S extends ZodTypeAny = ZodTypeAny> =
  TraitMetadata &
    z.infer<S> & {
      schema: S;
      defaults: z.infer<S>;
    };

const traitDefinitions: TraitDefinitionEntry[] = [];

export function getTraitDefinitions(): readonly TraitDefinitionEntry[] {
  return [...traitDefinitions];
}

export const defineTrait = <S extends ZodTypeAny>(
  schema: S,
  metadata: TraitMetadata = {},
): TraitDefinitionEntry<S> => {
  const parsed = schema.safeParse({});
  const defaults = (
    parsed.success ? parsed.data : {}
  ) as z.infer<S>;
  const entry = {
    ...defaults,
    ...metadata,
    schema,
    defaults,
  } as TraitDefinitionEntry<S>;
  traitDefinitions.push(entry);
  return entry;
};

export type TraitIntersection<T extends readonly TraitDefinitionEntry[]> =
  T extends readonly [
    TraitDefinitionEntry<infer S extends ZodTypeAny>,
    ...infer Rest extends readonly TraitDefinitionEntry[],
  ]
    ? Rest extends readonly []
      ? z.infer<S>
      : z.infer<S> & TraitIntersection<Rest>
    : unknown;

function intersectTraitSchemas(
  traits: readonly TraitDefinitionEntry[],
): ZodTypeAny {
  const schemas = traits.map((t) => t.schema);
  if (schemas.length === 0) return z.unknown();
  return schemas
    .slice(1)
    .reduce((acc, s) => z.intersection(acc, s), schemas[0]!);
}

export function implementsTrait<
  const T extends readonly TraitDefinitionEntry[],
>(traits: T): (value: unknown) => value is TraitIntersection<T> & object {
  const schema = intersectTraitSchemas(traits);
  return (value): value is TraitIntersection<T> & object =>
    typeof value === "object" &&
    value !== null &&
    schema.safeParse(value).success;
}
