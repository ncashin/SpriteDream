import hashObject from "hash-object";
import { type TypeSymbol, type TypeSymbolMap, isTypeSymbol } from "./typeSymbol";

type ResolveType<T> =
  T extends TypeSymbol ? TypeSymbolMap[T] :
  T extends (v: infer V) => boolean ? V :
  T extends Record<string, unknown> ? { [K in keyof T]: ResolveType<T[K]> } :
  T;

type ObjectDefinition = Record<string, unknown>;

type DefinedObject = {
  __hash: string;
  __definition: ObjectDefinition;
};

type RequiredKeys<D extends ObjectDefinition> = {
  [K in keyof D]: K extends `__${string}` ? never :
    D[K] extends TypeSymbol ? K : never;
}[keyof D];

type OptionalKeys<D extends ObjectDefinition> = {
  [K in keyof D]: K extends `__${string}` ? never :
    D[K] extends TypeSymbol ? never : K;
}[keyof D];

type InstantiationValues<D extends ObjectDefinition> =
  { [K in RequiredKeys<D>]: ResolveType<D[K]> } &
  { [K in OptionalKeys<D>]?: ResolveType<D[K]> };

type Instance<D extends ObjectDefinition> = {
  [K in Exclude<keyof D, `__${string}`>]: ResolveType<D[K]>
};

function isMatchFunction(value: unknown): value is (v: unknown) => boolean {
  return typeof value === "function";
}

function resolveValue(definitionValue: unknown, instanceValue: unknown): unknown {
  if (
    definitionValue !== null &&
    typeof definitionValue === "object" &&
    !Array.isArray(definitionValue)
  ) {
    const nested = definitionValue as Record<string, unknown>;
    const nestedOverrides = (instanceValue ?? {}) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(nested).map(([k, v]) => [k, resolveValue(v, nestedOverrides[k])])
    );
  }

  if (instanceValue !== undefined) return instanceValue;
  if (isTypeSymbol(definitionValue)) return undefined;
  if (isMatchFunction(definitionValue)) return definitionValue;

  return definitionValue;
}

export function defineObject(definition: ObjectDefinition): DefinedObject & { __definition: typeof definition } {
  return {
    __hash: hashObject(definition),
    __definition: definition,
  };
}

export function match<T>(value: T) {
  return (comparisonValue: T) => value === comparisonValue;
}

export function instantiateObject<D extends ObjectDefinition>(
  definition: DefinedObject & { __definition: D },
  values: InstantiationValues<D>
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