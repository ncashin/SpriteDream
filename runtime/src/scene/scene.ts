import invariant from "tiny-invariant";
import {
  type DefinedObject,
  type Instance,
  type NestedPaths,
  type ObjectDefinition,
  type PathValue,
  matchesDefinition,
} from "./objectDefinition";

export type Scene = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const PROXY_TARGET = Symbol.for("scene.proxyTarget");

export type RawChange =
  | { type: "created"; path: string; object: unknown }
  | { type: "destroyed"; path: string; deletedObject: unknown }
  | {
      type: "propertyUpdated";
      path: string;
      segmentKey: string;
      containingObject: unknown;
      property: string;
      newValue: unknown;
      oldValue: unknown;
    };

/** Change type inferred from definition instance I; propertyUpdated is discriminated by segmentKey. */
export type QueryChange<I> =
  | { type: "created"; path: string; object: I }
  | { type: "destroyed"; path: string; deletedObject: I }
  | {
      [K in NestedPaths<I>]: {
        type: "propertyUpdated";
        path: string;
        segmentKey: K;
        property: string;
        containingObject: unknown;
        newValue: PathValue<I, K>;
        oldValue: unknown;
      };
    }[NestedPaths<I>];

function segmentKeyFromPath(path: string, property: string): string {
  const dot = path.indexOf(".");
  const segment = dot >= 0 ? path.slice(dot + 1) : "";
  return segment ? `${segment}.${property}` : property;
}

interface ObjectMeta {
  forwardIndex: Map<string, Set<string>>;
  reverseIndex: Map<string, Set<string>>;
  results: Map<string, Record<string, unknown>>;
  listeners: Map<string, Set<(change: RawChange) => void>>;
  definitions: Map<string, DefinedObject>;
  indexed: Set<string>;
  anyChangeListeners: Set<(change: RawChange) => void>;
}

const objectMeta = new WeakMap<Record<string, unknown>, ObjectMeta>();
const objectParent = new WeakMap<
  Record<string, unknown>,
  { parent: Record<string, unknown>; key: string }
>();

const pendingChanges: { meta: ObjectMeta; hash: string; change: RawChange }[] = [];
let flushScheduled = false;

function scheduleFlush(meta: ObjectMeta, hash: string, change: RawChange) {
  pendingChanges.push({ meta, hash, change });
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    const snapshot = pendingChanges.splice(0, pendingChanges.length);
    for (const { meta, hash, change } of snapshot) {
      const handlers = meta.listeners.get(hash);
      if (!handlers) continue;
      for (const handler of handlers) handler(change);
    }
  });
}

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
      anyChangeListeners: new Set(),
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

function getRoot(target: Record<string, unknown>): Record<string, unknown> {
  let current = target;
  while (true) {
    const relation = objectParent.get(current);
    if (!relation) return current;
    current = relation.parent;
  }
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
      const result = meta.results.get(hash);
      if (result) result[key] = value as Record<string, unknown>;
    }
    if (!matches && indexed) {
      meta.forwardIndex.get(hash)?.delete(key);
      meta.reverseIndex.get(key)?.delete(hash);
      const result = meta.results.get(hash);
      if (result) delete result[key];
    }
  }
}

function removeKey(meta: ObjectMeta, key: string) {
  const hashes = meta.reverseIndex.get(key);
  if (!hashes) return;
  for (const hash of hashes) {
    meta.forwardIndex.get(hash)?.delete(key);
    const result = meta.results.get(hash);
    if (result) delete result[key];
  }
  meta.reverseIndex.delete(key);
}

function query<D extends ObjectDefinition>(
  target: Record<string, unknown>,
  definition: { __hash: string; __definition: D },
): Record<string, Instance<D>> {
  const meta = getMeta(target);
  registerDefinition(meta, definition);
  const hash = definition.__hash;
  if (!meta.indexed.has(hash)) {
    fullIndex(target, definition);
  }
  const cached = meta.results.get(hash);
  if (cached) {
    return cached as Record<string, Instance<D>>;
  }
  const result: Record<string, Instance<D>> = {} as Record<string, Instance<D>>;
  const keys = meta.forwardIndex.get(hash);
  if (keys) {
    for (const key of keys) {
      if (key in target) {
        result[key] = target[key] as Instance<D>;
      }
    }
  }
  meta.results.set(hash, result);
  return result;
}

function notify(
  meta: ObjectMeta,
  target: Record<string, unknown>,
  key: string,
  change: RawChange,
  hashesOverride?: Set<string>,
) {
  for (const handler of meta.anyChangeListeners) {
    handler(change);
  }
  const hashes = hashesOverride ?? meta.reverseIndex.get(key);
  if (!hashes) return;
  for (const hash of hashes) {
    const result = meta.results.get(hash);
    if (result) {
      if (change.type === "created") {
        result[key] = target[key] as Record<string, unknown>;
      } else if (change.type === "destroyed") {
        delete result[key];
      } else {
        const definition = meta.definitions.get(hash);
        if (definition && matchesDefinition(definition, target[key])) {
          result[key] = target[key] as Record<string, unknown>;
        } else {
          const deletedObject = result[key];
          delete result[key];
          scheduleFlush(meta, hash, {
            type: "destroyed",
            path: change.path,
            deletedObject,
          });
          continue;
        }
      }
    }
    scheduleFlush(meta, hash, change);
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
  getMeta(parent);
  evaluateKey(parent, key);
  const path = getPath(parent, key);
  const change: RawChange = {
    type: "propertyUpdated",
    path,
    segmentKey: segmentKeyFromPath(path, property),
    containingObject: parent[key],
    property,
    newValue,
    oldValue,
  };
  const parentMeta = objectMeta.get(parent)!;
  notify(parentMeta, parent, key, change);
  const root = getRoot(parent);
  if (root !== parent) {
    const rootMeta = objectMeta.get(root);
    const rootKey = path.split(".")[0];
    if (rootMeta?.forwardIndex && rootKey) {
      for (const [hash, keys] of rootMeta.forwardIndex) {
        if (keys.has(rootKey)) scheduleFlush(rootMeta, hash, change);
      }
    }
  }
  bubble(parent, property, newValue, oldValue);
}

function onQueryChange<D extends ObjectDefinition>(
  target: Record<string, unknown>,
  definition: { __hash: string; __definition: D },
  handler: (change: QueryChange<Instance<D>>) => void,
): () => void {
  const meta = getMeta(target);
  registerDefinition(meta, definition);
  query(target, definition);
  const hash = definition.__hash;
  if (!meta.listeners.has(hash)) {
    meta.listeners.set(hash, new Set());
  }
  meta.listeners.get(hash)!.add(handler as (change: RawChange) => void);
  return () => {
    meta.listeners.get(hash)?.delete(handler as (change: RawChange) => void);
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
  const proxy = new Proxy(targetObject, {
    get(object, property, receiver) {
      if (typeof property === "symbol") {
        return Reflect.get(object, property, receiver);
      }
      if (property === "__isProxy") return true;
      switch (property) {
        case "query":
          return <D extends ObjectDefinition>(
            definition: { __hash: string; __definition: D },
          ) => query(object, definition);
        case "onQueryChange":
          return <D extends ObjectDefinition>(
            definition: { __hash: string; __definition: D },
            handler: (change: QueryChange<Instance<D>>) => void,
          ) => onQueryChange(object, definition, handler);
        case "subscribe":
          return (handler: (change: RawChange) => void) => {
            const meta = getMeta(object);
            meta.anyChangeListeners.add(handler);
            return () => meta.anyChangeListeners.delete(handler);
          };
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
      if (typeof property !== "string") {
        (object as Record<string | symbol, unknown>)[property] = value;
        return true;
      }
      const oldValue = object[property];
      if (
        isObject(value) &&
        (value as Record<string, unknown>).__isProxy === true &&
        (value as Record<symbol, unknown>)[PROXY_TARGET] === oldValue
      ) {
        object[property] = value as Record<string, unknown>;
        return true;
      }
      object[property] = value as Record<string, unknown>;
      const meta = objectMeta.get(object);
      if (meta) {
        evaluateKey(object, property);
        if (oldValue === undefined) {
          notify(meta, object, property, {
            type: "created",
            path: getPath(object, property),
            object: value,
          });
        } else {
          const path = getPath(object, property);
          notify(meta, object, property, {
            type: "propertyUpdated",
            path,
            segmentKey: segmentKeyFromPath(path, property),
            containingObject: object,
            property,
            newValue: value,
            oldValue,
          });
        }
        bubble(object, property, value, oldValue);
      } else if (objectParent.get(object)) {
        bubble(object, property, value, oldValue);
      }
      return true;
    },
    deleteProperty(object, property) {
      invariant(typeof property === "string");
      const deletedObject = object[property];
      const meta = objectMeta.get(object);
      const hadHashes = meta ? new Set(meta.reverseIndex.get(property)) : undefined;
      if (!Reflect.deleteProperty(object, property)) {
        return false;
      }
      if (meta && hadHashes?.size) {
        removeKey(meta, property);
        notify(meta, object, property, {
          type: "destroyed",
          path: getPath(object, property),
          deletedObject,
        }, hadHashes);
      }
      return true;
    },
    has(object, property) {
      return Reflect.has(object, property);
    },
  });
  (proxy as Record<symbol, unknown>)[PROXY_TARGET] = targetObject;
  return proxy;
}

const sceneObject: Scene = {};
const scene = createDeepProxy(sceneObject);

/** Scene type with typed query and onQueryChange inferred from definition. */
export type SceneWithAPI = Record<string, unknown> & {
  query<D extends ObjectDefinition>(
    definition: { __hash: string; __definition: D },
  ): Record<string, Instance<D>>;
  onQueryChange<D extends ObjectDefinition>(
    definition: { __hash: string; __definition: D },
    handler: (change: QueryChange<Instance<D>>) => void,
  ): () => void;
  subscribe(handler: (change: RawChange) => void): () => void;
};

export const getScene = (): SceneWithAPI => scene as SceneWithAPI;
