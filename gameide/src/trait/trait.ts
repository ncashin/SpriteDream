import { z, type ZodTypeAny } from "zod";

export type TraitDefinitionEntry<S extends ZodTypeAny = ZodTypeAny> = {
  name: string;
  schema: S;
  defaults: Record<string, unknown>;
};

const traitDefinitions: TraitDefinitionEntry[] = [];

export function getTraitDefinitions(): readonly TraitDefinitionEntry[] {
  return [...traitDefinitions];
}

export const defineTrait = <S extends ZodTypeAny>(
  name: string,
  schema: S,
): TraitDefinitionEntry<S> => {
  const parsed = schema.safeParse({});
  const defaults = parsed.success ? (parsed.data as Record<string, unknown>) : {};
  const entry = {
    name,
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

function unwrapObjectSchema(schema: ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  if (schema instanceof z.ZodObject) return schema;
  if (schema instanceof z.ZodEffects) {
    return unwrapObjectSchema(schema._def.schema);
  }
  return null;
}

function hasTraitKeys(value: object, schema: ZodTypeAny): boolean {
  const objectSchema = unwrapObjectSchema(schema);
  if (!objectSchema) return true;

  for (const [key, fieldSchema] of Object.entries(objectSchema.shape)) {
    const field = fieldSchema as ZodTypeAny;
    if (field instanceof z.ZodOptional) continue;
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
  }

  return true;
}

export function implementsTrait<
  const T extends readonly TraitDefinitionEntry[],
>(
  object: unknown,
  traits: T,
): object is TraitIntersection<T> & object {
  if (typeof object !== "object" || object === null) return false;
  const schema = intersectTraitSchemas(traits);
  for (const trait of traits) {
    if (!hasTraitKeys(object, trait.schema)) return false;
  }
  return schema.safeParse(object).success;
}
