export const $number = Symbol("number");
export const $string = Symbol("string");
export const $boolean = Symbol("boolean");

type TypeToken = typeof $number | typeof $string | typeof $boolean;

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
            : never;

export type SchemaToType<S extends Record<string, TypeToken | number | string | boolean>> = {
  -readonly [K in keyof S]: SchemaValueToType<S[K]>;
};

export type ObjectMetadata = {
  name?: string;
  description?: string;
};

export type DefinedObject<
  S extends Record<string, TypeToken | number | string | boolean>,
  M extends ObjectMetadata = ObjectMetadata,
> = {
  schema: S;
  guard: (value: unknown) => value is SchemaToType<S>;
} & M;

function buildGuard(schema: Record<string, TypeToken | number | string | boolean>) {
  return function guard(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) return false;
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
  schema: Record<string, string | number | boolean>;
}> = [];

function serializeSchemaForEditor(schema: Record<string, TypeToken | number | string | boolean>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (v === $number) out[k] = "$number";
    else if (v === $string) out[k] = "$string";
    else if (v === $boolean) out[k] = "$boolean";
    else out[k] = v as number | string | boolean;
  }
  return out;
}

export function getDefinedObjectsForEditor(): Array<{
  name?: string;
  description?: string;
  schema: Record<string, string | number | boolean>;
}> {
  return [...EDITOR_DEFINITIONS];
}

export function defineObject<
  S extends Record<string, TypeToken | number | string | boolean>,
  M extends ObjectMetadata = ObjectMetadata,
>(schema: S, metadata?: M): DefinedObject<S, M> {
  const def = {
    ...(metadata ?? {}),
    schema: serializeSchemaForEditor(schema),
  };
  EDITOR_DEFINITIONS.push(def);
  return {
    ...(metadata ?? {}),
    schema,
    guard: buildGuard(schema) as (value: unknown) => value is SchemaToType<S>,
  } as DefinedObject<S, M>;
}
