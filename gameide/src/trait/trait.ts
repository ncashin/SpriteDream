export const $number = Symbol("number");
export const $string = Symbol("string");
export const $boolean = Symbol("boolean");

type TypeToken = typeof $number | typeof $string | typeof $boolean;
type SchemaPrimitive = TypeToken | number | string | boolean;

export type SchemaObject = {
  readonly [key: string]: SchemaValue;
};

export type SchemaValue = SchemaPrimitive | SchemaObject;

export type TraitMetadata = {
  name?: string;
  description?: string;
  icon?: string;
};

type TraitInputItem = SchemaObject | TraitHandle<object>;
type TraitInput = TraitInputItem | readonly [TraitInputItem, ...TraitInputItem[]];

type InferSchemaValue<T extends SchemaValue> =
  T extends typeof $number
    ? number
    : T extends typeof $string
      ? string
      : T extends typeof $boolean
        ? boolean
      : T extends number
          ? number
          : T extends string
              ? string
              : T extends boolean
                  ? boolean
          : T extends SchemaObject
            ? InferSchemaObject<T>
            : never;

type InferSchemaObject<T extends SchemaObject> = {
  [K in keyof T]: InferSchemaValue<T[K]>;
};

type InferTraitInputItem<T extends TraitInputItem> = T extends TraitHandle<infer Handle>
  ? Handle
  : T extends SchemaObject
    ? InferSchemaObject<T>
    : never;

type TraitInputToObject<T extends TraitInput> = T extends readonly [
  infer First extends TraitInputItem,
  ...infer Rest extends TraitInputItem[],
]
  ? InferTraitInputItem<First> & InferTraitInputItem<Rest[number]>
  : T extends TraitInputItem
    ? InferTraitInputItem<T>
    : never;

export type TraitHandle<T extends object> = {
  readonly __gameideTraitType?: T;
};

function isSchemaObject(value: unknown): value is SchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const traitGuards = new WeakMap<object, (value: unknown) => boolean>();

function isRegisteredTraitHandle(value: unknown): value is TraitHandle<object> {
  return isSchemaObject(value) && traitGuards.has(value);
}

function compilePropertyCheck(constraint: SchemaValue): (actual: unknown) => boolean {
  if (constraint === $number) {
    return (actual) => typeof actual === "number" && Number.isFinite(actual);
  }
  if (constraint === $string) {
    return (actual) => typeof actual === "string";
  }
  if (constraint === $boolean) {
    return (actual) => typeof actual === "boolean";
  }
  if (isSchemaObject(constraint)) {
    const nestedGuard = createTraitGuard(constraint);
    return (actual) => nestedGuard(actual);
  }
  if (typeof constraint === "number") {
    // Primitive literals in trait schemas are treated as typed defaults.
    return (actual) => typeof actual === "number" && Number.isFinite(actual);
  }
  if (typeof constraint === "string") {
    return (actual) => typeof actual === "string";
  }
  if (typeof constraint === "boolean") {
    return (actual) => typeof actual === "boolean";
  }
  return () => false;
}

export function createTraitGuard(schema: SchemaObject) {
  const checks = Object.entries(schema).map(([key, constraint]) => ({
    key,
    check: compilePropertyCheck(constraint),
  }));

  return function guard(value: unknown): boolean {
    if (!isSchemaObject(value)) return false;
    const o = value as Record<string, unknown>;
    for (const { key, check } of checks) {
      if (!check(o[key])) return false;
    }
    return true;
  };
}

const EDITOR_DEFINITIONS: Array<{
  name?: string;
  description?: string;
  icon?: string;
  schema: SchemaObject;
}> = [];

export function getDefinedTraitsForEditor(): Array<{
  name?: string;
  description?: string;
  icon?: string;
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

function resolveSchemaObject(input: TraitInputItem): SchemaObject {
  if (isSchemaObject(input)) return input;
  throw new Error("GameIDE: trait schema input must be an object or trait handle");
}

function isTraitInputArray(
  input: TraitInput,
): input is readonly [TraitInputItem, ...TraitInputItem[]] {
  return Array.isArray(input);
}

function resolveSchemaInput(input: TraitInput): SchemaObject {
  if (isTraitInputArray(input)) {
    const schemas = input.map(resolveSchemaObject) as [SchemaObject, ...SchemaObject[]];
    return mergeSchemas(schemas);
  }
  return resolveSchemaObject(input);
}

export function defineTrait<TInput extends TraitInput>(
  schema: TInput,
  metadata?: TraitMetadata,
): TraitHandle<TraitInputToObject<TInput>> {
  const resolvedSchema = resolveSchemaInput(schema);
  const handle = resolvedSchema as TraitHandle<TraitInputToObject<TInput>>;
  traitGuards.set(handle, createTraitGuard(resolvedSchema));
  const definition = {
    ...(metadata ?? {}),
    schema: resolvedSchema,
  };
  EDITOR_DEFINITIONS.push(definition);
  return handle;
}

type TraitPredicate<T> = (value: unknown) => value is T;

export function implementsTrait<TInput extends TraitInput>(
  t: TInput,
): TraitPredicate<TraitInputToObject<TInput>> {
  if (!Array.isArray(t) && isRegisteredTraitHandle(t)) {
    const guard = traitGuards.get(t);
    if (!guard) {
      throw new Error("GameIDE: trait guard not registered");
    }
    return (candidate: unknown): candidate is TraitInputToObject<TInput> => guard(candidate);
  }

  const guard = createTraitGuard(resolveSchemaInput(t));
  return (candidate: unknown): candidate is TraitInputToObject<TInput> => guard(candidate);
}
