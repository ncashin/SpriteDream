import invariant from "tiny-invariant";
import {
  type DefinedObject,
  type Instance,
  matchesDefinition,
} from "./objectDefinition";

export type Scene = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type RawChange =
  | { type: "created"; path: string; object: unknown }
  | { type: "destroyed"; path: string; deletedObject: unknown }
  | {
      type: "propertyUpdated";
      path: string;
      containingObject: unknown;
      property: string;
      newValue: unknown;
      oldValue: unknown;
    };

interface ObjectMeta {
  forwardIndex: Map<string, Set<string>>;
  reverseIndex: Map<string, Set<string>>;
  results: Map<string, Record<string, unknown>>;
  listeners: Map<string, Set<(change: RawChange) => void>>;
  definitions: Map<string, DefinedObject>;
  indexed: Set<string>;
}

const objectMeta = new WeakMap<Record<string, unknown>, ObjectMeta>();
const objectParent = new WeakMap<
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
      definitions: new Map(),
      indexed: new Set(),
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

function registerDefinition(
  meta: ObjectMeta,
  definition: DefinedObject,
) {
  if (!meta.definitions.has(definition.__hash)) {
    meta.definitions.set(definition.__hash, definition);
    meta.forwardIndex.set(definition.__hash, new Set());
  }
}

function fullIndex(
  target: Record<string, unknown>,
  definition: DefinedObject,
) {
  const meta = getMeta(target);
  const hash = definition.__hash;

  for (const key of Object.keys(target)) {
    if (matchesDefinition(definition, target[key])) {
      meta.forwardIndex.get(hash)!.add(key);
      if (!meta.reverseIndex.has(key)) {
        meta.reverseIndex.set(key, new Set());
      }
      meta.reverseIndex.get(key)!.add(hash);
    }
  }

  meta.indexed.add(hash);
}

function evaluateKey(
  target: Record<string, unknown>,
  key: string,
) {
  const meta = getMeta(target);
  const value = target[key];

  for (const [hash, definition] of meta.definitions) {
    if (!meta.indexed.has(hash)) continue;

    const matches = matchesDefinition(definition, value);
    const indexed = meta.reverseIndex.get(key)?.has(hash);

    if (matches && !indexed) {
      meta.forwardIndex.get(hash)!.add(key);
      if (!meta.reverseIndex.has(key)) {
        meta.reverseIndex.set(key, new Set());
      }
      meta.reverseIndex.get(key)!.add(hash);
      meta.results.delete(hash);
    }

    if (!matches && indexed) {
      meta.forwardIndex.get(hash)?.delete(key);
      meta.reverseIndex.get(key)?.delete(hash);
      meta.results.delete(hash);
    }
  }
}

function removeKey(meta: ObjectMeta, key: string) {
  const hashes = meta.reverseIndex.get(key);
  if (!hashes) return;
  for (const hash of hashes) {
    meta.forwardIndex.get(hash)?.delete(key);
    meta.results.delete(hash);
  }
  meta.reverseIndex.delete(key);
}

function query<D extends DefinedObject>(
  target: Record<string, unknown>,
  definition: D,
): Record<string, Instance<D["__definition"]>> {
  const meta = getMeta(target);
  registerDefinition(meta, definition);

  const hash = definition.__hash;

  if (!meta.indexed.has(hash)) {
    fullIndex(target, definition);
  }

  const cached = meta.results.get(hash);
  if (cached) {
    return cached as Record<string, Instance<D["__definition"]>>;
  }

  const result: Record<string, Instance<D["__definition"]>> = {};
  const keys = meta.forwardIndex.get(hash);

  if (keys) {
    for (const key of keys) {
      if (key in target) {
        result[key] =
          target[key] as Instance<D["__definition"]>;
      }
    }
  }

  meta.results.set(hash, result);
  return result;
}

function notify(
  meta: ObjectMeta,
  key: string,
  change: RawChange,
) {
  const hashes = meta.reverseIndex.get(key);
  if (!hashes) return;
  for (const hash of hashes) {
    meta.results.delete(hash);
    const handlers = meta.listeners.get(hash);
    if (!handlers) continue;
    for (const handler of handlers) {
      handler(change);
    }
  }
}

function bubble(
  target: Record<string, unknown>,
  property: string,
  newValue: unknown,
  oldValue: unknown,
) {
  const relation = objectParent.get(target);
  if (!relation) return;

  const { parent, key } = relation;
  const parentMeta = objectMeta.get(parent);
  if (!parentMeta) return;

  evaluateKey(parent, key);

  const hashes = parentMeta.reverseIndex.get(key);
  if (hashes) {
    for (const hash of hashes) {
      parentMeta.results.delete(hash);
      const handlers = parentMeta.listeners.get(hash);
      if (!handlers) continue;
      for (const handler of handlers) {
        handler({
          type: "propertyUpdated",
          path: getPath(parent, key),
          containingObject: parent[key],
          property,
          newValue,
          oldValue,
        });
      }
    }
  }

  bubble(parent, property, newValue, oldValue);
}

function onQueryChange<D extends DefinedObject>(
  target: Record<string, unknown>,
  definition: D,
  handler: (change: RawChange) => void,
): () => void {
  const meta = getMeta(target);
  registerDefinition(meta, definition);
  query(target, definition);

  const hash = definition.__hash;

  if (!meta.listeners.has(hash)) {
    meta.listeners.set(hash, new Set());
  }

  meta.listeners.get(hash)!.add(handler);

  return () => {
    meta.listeners.get(hash)?.delete(handler);
  };
}

function createDeepProxy(
  targetObject: unknown,
  parentRef?: { parent: Record<string, unknown>; key: string },
): unknown {
  if (!isObject(targetObject)) return targetObject;

  if (parentRef) {
    objectParent.set(targetObject, parentRef);
  }

  return new Proxy(targetObject, {
    get(object, property, receiver) {
      if (typeof property === "symbol") {
        return Reflect.get(object, property, receiver);
      }

      if (property === "__isProxy") return true;

      switch (property) {
        case "query":
          return <D extends DefinedObject>(definition: D) =>
            query(object, definition);
        case "onQueryChange":
          return <D extends DefinedObject>(
            definition: D,
            handler: (change: RawChange) => void,
          ) => onQueryChange(object, definition, handler);
      }

      if (property in object) {
        const val = object[property];
        if (!isObject(val)) return val;
        if ((val as Record<string, unknown>).__isProxy) return val;
        const proxy = createDeepProxy(val, {
          parent: object,
          key: property as string,
        });
        object[property] = proxy as Record<string, unknown>;
        return proxy;
      }

      return undefined;
    },

    set(object, property, value) {
      invariant(typeof property === "string");

      const oldValue = object[property];

      const wrapped = isObject(value)
        ? createDeepProxy(value, { parent: object, key: property })
        : value;

      object[property] = wrapped as Record<string, unknown>;

      const meta = objectMeta.get(object);
      if (meta) {
        evaluateKey(object, property);

        if (oldValue === undefined) {
          notify(meta, property, {
            type: "created",
            path: getPath(object, property),
            object: value,
          });
        } else {
          notify(meta, property, {
            type: "propertyUpdated",
            path: getPath(object, property),
            containingObject: object,
            property,
            newValue: value,
            oldValue,
          });
        }

        bubble(object, property, value, oldValue);
      }

      return true;
    },

    deleteProperty(object, property) {
      invariant(typeof property === "string");

      const deletedObject = object[property];

      if (!Reflect.deleteProperty(object, property)) {
        return false;
      }

      const meta = objectMeta.get(object);
      if (meta) {
        removeKey(meta, property);
        notify(meta, property, {
          type: "destroyed",
          path: getPath(object, property),
          deletedObject,
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