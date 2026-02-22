import invariant from "tiny-invariant";
import {
  type DefinedObject,
  type Instance,
  resolveDefinition,
} from "./objectDefinition";

export type Scene = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Paths<T, Depth extends number[] = []> = Depth["length"] extends 4
  ? never
  : {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? K | `${K}.${Paths<T[K], [...Depth, 0]>}`
        : K;
    }[keyof T & string];

type ValueAtPath<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? ValueAtPath<T[K], Rest>
    : unknown
  : P extends keyof T
  ? T[P]
  : unknown;

export type ChangeCreated<T> = {
  type: "created";
  path: string;
  value: T;
};

export type ChangeDestroyed<T> = {
  type: "destroyed";
  path: string;
  previous: T;
};

export type ChangePropertyUpdated<T> = {
  [P in Paths<T>]: {
    type: "propertyUpdated";
    path: string;
    value: T;
    property: P;
    propertyValue: ValueAtPath<T, P>;
    previousPropertyValue: ValueAtPath<T, P>;
  };
}[Paths<T>];

export type Change<T> =
  | ChangeCreated<T>
  | ChangeDestroyed<T>
  | ChangePropertyUpdated<T>;

export type QueryChangeHandler<T> = (change: Change<T>) => void;

interface ObjectMeta {
  forwardIndex: Map<string, Set<string>>;
  reverseIndex: Map<string, Set<string>>;
  results: Map<string, Record<string, unknown>>;
  listeners: Map<string, Set<QueryChangeHandler<unknown>>>;
}

const objectMeta = new WeakMap<Record<string, unknown>, ObjectMeta>();
const objectParent = new WeakMap
  Record<string, unknown>,
  { parent: Record<string, unknown>; key: string }
>();

function getMeta(target: Record<string, unknown>): ObjectMeta {
  let meta = objectMeta.get(target);
  if (!meta) {
    meta = {
      forwardIndex: new Map(),
      reverseIndex: new Map(),
      results: new Map(),
      listeners: new Map(),
    };
    objectMeta.set(target, meta);
  }
  return meta;
}

function getPath(target: Record<string, unknown>, key: string): string {
  const parts: string[] = [key];
  let current = target;
  while (true) {
    const relation = objectParent.get(current);
    if (!relation) break;
    parts.unshift(relation.key);
    current = relation.parent;
  }
  return parts.join(".");
}

function indexObject(
  target: Record<string, unknown>,
  key: string,
  hash: string,
): void {
  const { forwardIndex, reverseIndex } = getMeta(target);
  if (!forwardIndex.has(hash)) forwardIndex.set(hash, new Set());
  forwardIndex.get(hash)!.add(key);
  if (!reverseIndex.has(key)) reverseIndex.set(key, new Set());
  reverseIndex.get(key)!.add(hash);
}

function invalidateResults(meta: ObjectMeta, key: string): void {
  const hashes = meta.reverseIndex.get(key);
  if (!hashes) return;
  for (const hash of hashes) meta.results.delete(hash);
}

function notifyListeners(
  meta: ObjectMeta,
  hash: string,
  change: Change<unknown>,
): void {
  const handlers = meta.listeners.get(hash);
  if (!handlers) return;
  for (const handler of handlers) handler(change);
}

function emitForKey(
  target: Record<string, unknown>,
  meta: ObjectMeta,
  key: string,
  change: Change<unknown>,
): void {
  const hashes = meta.reverseIndex.get(key);
  if (!hashes) return;
  invalidateResults(meta, key);
  for (const hash of hashes) notifyListeners(meta, hash, change);
}

function bubbleToParent(
  target: Record<string, unknown>,
  property: string,
  propertyValue: unknown,
  previousPropertyValue: unknown,
): void {
  const relation = objectParent.get(target);
  if (!relation) return;

  const { parent, key: parentKey } = relation;
  const parentMeta = objectMeta.get(parent);
  if (!parentMeta) return;

  const hashes = parentMeta.reverseIndex.get(parentKey);
  if (hashes) {
    invalidateResults(parentMeta, parentKey);
    const value = parent[parentKey];
    const path = getPath(parent, parentKey);
    const change: Change<unknown> = {
      type: "propertyUpdated",
      path,
      value,
      property,
      propertyValue,
      previousPropertyValue,
    };
    for (const hash of hashes) notifyListeners(parentMeta, hash, change);
  }

  bubbleToParent(parent, property, propertyValue, previousPropertyValue);
}

function query<D extends DefinedObject>(
  target: Record<string, unknown>,
  definition: D,
): Record<string, Instance<D["__definition"]>> {
  const meta = getMeta(target);
  const cached = meta.results.get(definition.__hash);
  if (cached) return cached as Record<string, Instance<D["__definition"]>>;

  const keys = meta.forwardIndex.get(definition.__hash);
  if (!keys) return {};

  const result: Record<string, Instance<D["__definition"]>> = {};
  for (const key of keys) {
    if (key in target) result[key] = target[key] as Instance<D["__definition"]>;
  }

  meta.results.set(definition.__hash, result);
  return result;
}

function onQueryChange<D extends DefinedObject>(
  target: Record<string, unknown>,
  definition: D,
  handler: QueryChangeHandler<Instance<D["__definition"]>>,
): () => void {
  const meta = getMeta(target);
  let handlers = meta.listeners.get(definition.__hash);
  if (!handlers) {
    handlers = new Set();
    meta.listeners.set(definition.__hash, handlers);
  }
  handlers.add(handler as QueryChangeHandler<unknown>);

  return () => {
    meta.listeners
      .get(definition.__hash)
      ?.delete(handler as QueryChangeHandler<unknown>);
  };
}

function createObject<D extends DefinedObject>(
  target: Record<string, unknown>,
  key: string,
  definition: D,
  values: Record<string, unknown>,
): Instance<D["__definition"]> {
  const instance = resolveDefinition(definition, values);
  target[key] = instance;
  indexObject(target, key, definition.__hash);
  const meta = getMeta(target);
  invalidateResults(meta, key);
  const path = getPath(target, key);
  emitForKey(target, meta, key, { type: "created", path, value: instance });
  return instance as Instance<D["__definition"]>;
}

function createDeepProxy(
  targetObject: unknown,
  parentRef?: { parent: Record<string, unknown>; key: string },
): unknown {
  if (!isObject(targetObject)) return targetObject;
  if (parentRef) objectParent.set(targetObject, parentRef);

  return new Proxy(targetObject, {
    get(object, property, receiver) {
      if (typeof property === "symbol")
        return Reflect.get(object, property, receiver);
      if (property === "__isProxy") return true;

      switch (property) {
        case "query":
          return <D extends DefinedObject>(definition: D) =>
            query<D>(object, definition);
        case "onQueryChange":
          return <D extends DefinedObject>(
            definition: D,
            handler: QueryChangeHandler<Instance<D["__definition"]>>,
          ) => onQueryChange<D>(object, definition, handler);
        case "createObject":
          return <D extends DefinedObject>(
            key: string,
            definition: D,
            values: Record<string, unknown>,
          ) => createObject<D>(object, key, definition, values);
      }

      if (property in object) {
        const val = object[property];
        if (!isObject(val)) return val;
        if ((val as Record<string, unknown>).__isProxy) return val;
        const proxy = createDeepProxy(val, { parent: object, key: property });
        object[property] = proxy as Record<string, unknown>;
        return proxy;
      }

      const empty: Record<string, unknown> = {};
      object[property] = empty;
      return createDeepProxy(empty, { parent: object, key: property });
    },

    set(object, property, value) {
      invariant(typeof property === "string");
      const previous = object[property];
      const wrapped = isObject(value)
        ? createDeepProxy(value, { parent: object, key: property })
        : value;
      object[property] = wrapped as Record<string, unknown>;
      const meta = objectMeta.get(object);
      if (meta) {
        const path = getPath(object, property);
        emitForKey(object, meta, property, {
          type: "propertyUpdated",
          path,
          value: wrapped,
          property,
          propertyValue: value,
          previousPropertyValue: previous,
        });
        bubbleToParent(object, property, value, previous);
      }
      return true;
    },

    deleteProperty(object, property) {
      invariant(typeof property === "string");
      const previous = object[property];
      if (!Reflect.deleteProperty(object, property)) return false;
      const meta = objectMeta.get(object);
      if (meta) {
        const path = getPath(object, property);
        emitForKey(object, meta, property, {
          type: "destroyed",
          path,
          previous,
        });
      }
      return true;
    },

    has(object, property) {
      return Reflect.has(object, property);
    },
  });
}

const sceneObject: Scene = {};
const scene = createDeepProxy(sceneObject);

export const getScene = () => scene;