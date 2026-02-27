import hashObject from "object-hash";
import {
  type TypeSymbol,
  type TypeSymbolMap,
  isTypeSymbol,
} from "./typeSymbol";

type ResolveType<T> = T extends TypeSymbol
  ? TypeSymbolMap[T]
  : T extends number
    ? number
    : T extends string
      ? string
      : T extends boolean
        ? boolean
        : T extends (v: infer V) => boolean
          ? V
          : T extends Record<string, unknown>
            ? { [K in keyof T]: ResolveType<T[K]> }
            : T;

export type ObjectDefinition = Record<string, unknown>;

export type DefinedObject = {
  __hash: string;
  __definition: ObjectDefinition;
};

/** Instance values are optional overrides merged on top of definition defaults. */
type DeepPartial<T> = T extends Record<string, unknown>
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

type InstantiationValues<D extends ObjectDefinition> = DeepPartial<{
  [K in Exclude<keyof D, `__${string}`>]: ResolveType<D[K]>;
}>;

export type Instance<T> = T extends { __definition: infer D }
  ? D extends ObjectDefinition
    ? { [K in Exclude<keyof D, `__${string}`>]: ResolveType<D[K]> }
    : never
  : T extends ObjectDefinition
    ? { [K in Exclude<keyof T, `__${string}`>]: ResolveType<T[K]> }
    : never;

/** All segment keys for property updates (e.g. "transform2D" | "transform2D.x" | "sprite.width") */
export type NestedPaths<I> = I extends object
  ?
    | keyof I
    | {
        [K in keyof I]: K extends string
          ? I[K] extends object
            ? NestedPaths<I[K]> extends infer N
              ? N extends string
                ? `${K}.${N}`
                : never
              : never
            : never
          : never;
      }[keyof I]
  : never;

/** Value type at path P within I (e.g. PathValue<SpriteInstance, "transform2D.x"> => number) */
export type PathValue<I, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof I
    ? PathValue<I[K], Rest>
    : never
  : P extends keyof I
    ? I[P]
    : never;

function isMatchFunction(value: unknown): value is (v: unknown) => boolean {
  return typeof value === "function";
}

function resolveValue(
    definitionValue: unknown,
    instanceValue: unknown,
  ): unknown {
    if (
      definitionValue !== null &&
      typeof definitionValue === "object" &&
      !Array.isArray(definitionValue)
    ) {
      const nested = definitionValue as Record<string, unknown>;
      const nestedOverrides = (instanceValue ?? {}) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(nested).map(([k, v]) => [
          k,
          resolveValue(v, nestedOverrides[k]),
        ]),
      );
    }
  
    if (instanceValue !== undefined) return instanceValue;
    if (isTypeSymbol(definitionValue)) return undefined;
    if (typeof definitionValue === "function" && "__default" in definitionValue) {
      return (definitionValue as any).__default;
    }
    if (isMatchFunction(definitionValue)) return undefined;
    if (
      typeof definitionValue === "number" ||
      typeof definitionValue === "string" ||
      typeof definitionValue === "boolean"
    ) {
      return definitionValue;
    }
    return definitionValue;
  }

function matchesValue(definitionValue: unknown, instanceValue: unknown): boolean {
  if (isTypeSymbol(definitionValue)) {
    return true;
  }

  if (isMatchFunction(definitionValue)) {
    return definitionValue(instanceValue);
  }

  if (typeof definitionValue === "number") {
    return instanceValue === undefined || typeof instanceValue === "number";
  }
  if (typeof definitionValue === "string") {
    return instanceValue === undefined || typeof instanceValue === "string";
  }
  if (typeof definitionValue === "boolean") {
    return instanceValue === undefined || typeof instanceValue === "boolean";
  }

  if (
    definitionValue !== null &&
    typeof definitionValue === "object" &&
    !Array.isArray(definitionValue)
  ) {
    if (
      instanceValue === null ||
      typeof instanceValue !== "object" ||
      Array.isArray(instanceValue)
    ) {
      return false;
    }
    const nested = definitionValue as Record<string, unknown>;
    const instanceObj = instanceValue as Record<string, unknown>;
    return Object.entries(nested).every(([k, v]) =>
      matchesValue(v, instanceObj[k]),
    );
  }

  return instanceValue === definitionValue;
}

export function matchesDefinition<D extends ObjectDefinition>(
  definition: DefinedObject & { __definition: D },
  value: unknown,
): value is Instance<D> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  for (const [key, defValue] of Object.entries(definition.__definition)) {
    if (key.startsWith("__")) continue;
    if (!matchesValue(defValue, obj[key])) return false;
  }

  return true;
}

export function resolveDefinition<D extends ObjectDefinition>(
  definition: DefinedObject & { __definition: D },
  values: InstantiationValues<D>,
): Instance<D> {
  const result: Record<string, unknown> = {};

  for (const [key, defValue] of Object.entries(definition.__definition)) {
    if (key.startsWith("__")) continue;
    const instanceValue = (values as Record<string, unknown>)[key];
    result[key] = resolveValue(defValue, instanceValue);
  }

  return result as Instance<D>;
}

type DefinitionInput =
  | DefinedObject
  | ObjectDefinition;

/** Extract definition shape from a single input (DefinedObject or plain definition). */
type ExtractDefinition<T> = T extends { __definition: infer D } ? D : T;

/** Inferred definition type from a tuple of inputs (intersection of all definitions). */
type DefinitionsFromTuple<Tuple extends readonly DefinitionInput[]> =
  Tuple extends readonly [infer First, ...infer Rest]
    ? Rest extends readonly DefinitionInput[]
      ? ExtractDefinition<First> & DefinitionsFromTuple<Rest>
      : ExtractDefinition<First>
    : {};

function getDefinition(input: DefinitionInput): ObjectDefinition {
  return "__definition" in input
    ? (input as DefinedObject).__definition
    : input;
}

function mergeDefinitions(items: DefinitionInput[]): ObjectDefinition {
  const result: ObjectDefinition = {};
  for (const item of items) {
    const def = getDefinition(item);
    for (const [key, value] of Object.entries(def)) {
      result[key] = value;
    }
  }
  return result;
}

export function defineObject<const T extends readonly DefinitionInput[]>(
  definition: T,
): { __hash: string; __definition: DefinitionsFromTuple<T> };
export function defineObject<D extends ObjectDefinition>(
  definition: D,
): { __hash: string; __definition: D };
export function defineObject(
  definition: ObjectDefinition | DefinitionInput[],
): { __hash: string; __definition: ObjectDefinition } {
  const resolved =
    Array.isArray(definition) ? mergeDefinitions(definition) : definition;
  return {
    __hash: hashObject(resolved),
    __definition: resolved as ObjectDefinition,
  };
}

export function match<T>(value: T) {
    const fn = (comparisonValue: T) => value === comparisonValue;
    (fn as any).__default = value;
    return fn;
  }

export function instantiateObject<const T extends readonly DefinitionInput[]>(
  definitions: T,
  values: Record<string, unknown>,
): Instance<DefinitionsFromTuple<T>>;
export function instantiateObject<D extends ObjectDefinition>(
  definition: DefinedObject & { __definition: D },
  values?: InstantiationValues<D>,
): Instance<D>;
export function instantiateObject<D extends ObjectDefinition>(
  definition:
    | (DefinedObject & { __definition: D })
    | DefinitionInput[],
  values: InstantiationValues<D> = {} as InstantiationValues<D>,
): Instance<D> {
  const __definition: ObjectDefinition = Array.isArray(definition)
    ? mergeDefinitions(definition as DefinitionInput[])
    : (definition as DefinedObject & { __definition: D }).__definition;
  const result: Record<string, unknown> = {};
  const valuesRecord = values as Record<string, unknown>;

  for (const [key, defValue] of Object.entries(__definition)) {
    if (key.startsWith("__")) {
      result[key] = valuesRecord[key] ?? defValue;
      continue;
    }
    result[key] = resolveValue(defValue, valuesRecord[key]);
  }

  return result as Instance<D>;
}