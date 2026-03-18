export const $number = Symbol("number");
export const $string = Symbol("string");
export const $boolean = Symbol("boolean");

type TypeToken = typeof $number | typeof $string | typeof $boolean;
type SchemaPrimitive = TypeToken | number | string | boolean;

export type SchemaObject = {
  readonly [key: string]: SchemaValue;
};

export type SchemaValue = SchemaPrimitive | SchemaObject;

type SchemaValueToType<V> = V extends typeof $number
  ? number
  : V extends typeof $string
    ? string
    : V extends typeof $boolean
      ? boolean
      : V extends number
        ? number
        : V extends string
          ? string
          : V extends boolean
            ? boolean
            : V extends SchemaObject
              ? SchemaToType<V>
              : never;

export type SchemaToType<S extends SchemaObject> = {
  -readonly [K in keyof S]: SchemaValueToType<S[K]>;
};

export type ObjectMetadata = {
  name?: string;
  description?: string;
};

type SchemaInput = SchemaObject | readonly [SchemaObject, ...SchemaObject[]];

type MergeSchemaTuple<T extends readonly [SchemaObject, ...SchemaObject[]]> = T extends readonly [
  infer First extends SchemaObject,
  ...infer Rest extends readonly [SchemaObject, ...SchemaObject[]]
]
  ? First & MergeSchemaTuple<Rest>
  : T extends readonly [infer Only extends SchemaObject]
    ? Only
    : never;

function isSchemaObject(value: unknown): value is SchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createObjectGuard<S extends SchemaObject>(schema: S) {
  return function guard(value: unknown): value is SchemaToType<S> {
    if (!isSchemaObject(value)) return false;
    const o = value as Record<string, unknown>;
    for (const key of Object.keys(schema)) {
      const constraint = schema[key];
      const actual = o[key];
      if (constraint === $number) {
        if (typeof actual !== "number" || !Number.isFinite(actual)) return false;
      } else if (constraint === $string) {
        if (typeof actual !== "string") return false;
      } else if (constraint === $boolean) {
        if (typeof actual !== "boolean") return false;
      } else if (isSchemaObject(constraint)) {
        if (!createObjectGuard(constraint)(actual)) return false;
      } else {
        if (typeof actual !== typeof constraint) return false;
      }
    }
    return true;
  };
}

const EDITOR_DEFINITIONS: Array<{
  name?: string;
  description?: string;
  schema: SchemaObject;
}> = [];

export function getDefinedObjectsForEditor(): Array<{
  name?: string;
  description?: string;
  schema: SchemaObject;
}> {
  return [...EDITOR_DEFINITIONS];
}

function mergeSchemas(schemas: readonly [SchemaObject, ...SchemaObject[]]): SchemaObject {
  const out: Record<string, SchemaValue> = {};
  for (const schema of schemas) {
    for (const [key, value] of Object.entries(schema)) {
      out[key] = value;
    }
  }
  return out;
}

export function defineObject<
  S extends SchemaObject,
  M extends ObjectMetadata = ObjectMetadata,
>(schema: S, metadata?: M): S;
export function defineObject<
  S extends readonly [SchemaObject, ...SchemaObject[]],
  M extends ObjectMetadata = ObjectMetadata,
>(schema: S, metadata?: M): MergeSchemaTuple<S>;
export function defineObject<
  S extends SchemaInput,
  M extends ObjectMetadata = ObjectMetadata,
>(schema: S, metadata?: M): SchemaObject {
  const resolvedSchema: SchemaObject = Array.isArray(schema)
    ? mergeSchemas(schema as readonly [SchemaObject, ...SchemaObject[]])
    : (schema as SchemaObject);
  const def: { name?: string; description?: string; schema: SchemaObject } = {
    ...(metadata ?? {}),
    schema: resolvedSchema,
  };
  EDITOR_DEFINITIONS.push(def);
  return resolvedSchema;
}
