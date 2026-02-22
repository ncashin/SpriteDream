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

type ObjectDefinition = Record<string, unknown>;

export type DefinedObject = {
  __hash: string;
  __definition: ObjectDefinition;
};

type DefValueWithDefault =
  | TypeSymbol
  | number
  | string
  | boolean
  | ((v: unknown) => boolean & { __default?: unknown });

type RequiredKeys<D extends ObjectDefinition> = {
  [K in keyof D]: K extends `__${string}`
    ? never
    : D[K] extends DefValueWithDefault
      ? D[K] extends number | string | boolean
        ? never
        : D[K] extends (v: unknown) => boolean
          ? never
          : K
      : never;
}[keyof D];

type OptionalKeys<D extends ObjectDefinition> = {
  [K in keyof D]: K extends `__${string}`
    ? never
    : D[K] extends DefValueWithDefault
      ? D[K] extends number | string | boolean
        ? K
        : D[K] extends (v: unknown) => boolean
          ? K
          : never
      : K;
}[keyof D];

type InstantiationValues<D extends ObjectDefinition> = {
  [K in RequiredKeys<D>]: ResolveType<D[K]>;
} & { [K in OptionalKeys<D>]?: ResolveType<D[K]> };

export type Instance<D extends ObjectDefinition> = {
  [K in Exclude<keyof D, `__${string}`>]: ResolveType<D[K]>;
};

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

export function defineObject(
  definition: ObjectDefinition,
): DefinedObject & { __definition: typeof definition } {
  return {
    __hash: hashObject(definition),
    __definition: definition,
  };
}

export function match<T>(value: T) {
    const fn = (comparisonValue: T) => value === comparisonValue;
    (fn as any).__default = value;
    return fn;
  }

export function instantiateObject<D extends ObjectDefinition>(
  definition: DefinedObject & { __definition: D },
  values: InstantiationValues<D>,
): Instance<D> {
  const { __definition } = definition;
  const result: Record<string, unknown> = {};

  for (const [key, defValue] of Object.entries(__definition)) {
    if (key.startsWith("__")) continue;
    const instanceValue = (values as Record<string, unknown>)[key];
    result[key] = resolveValue(defValue, instanceValue);
  }

  return result as Instance<D>;
}