import type { SceneObject, SceneUpdate } from "./scene.js";
import {
  getRootTarget,
  getScene,
  getTarget,
  getValueAtPath,
  subscribeToSceneUpdates,
} from "./scene.js";

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === "object" && value !== null;
}

export type QuerySceneCallback = (object: SceneObject) => boolean;

export type QuerySceneTypeGuard<TObject extends SceneObject = SceneObject> = (
  object: SceneObject
) => object is TObject;

export type QuerySceneCallbackOrGuard<TObject extends SceneObject = SceneObject> =
  | QuerySceneTypeGuard<TObject>
  | QuerySceneCallback;

export interface QuerySceneOptions<TObject extends SceneObject = SceneObject> {
  prefix?: PropertyKey[];
  cacheKey?: string;
  callback?: QuerySceneCallbackOrGuard<TObject>;
}

export type QueryResultEvent<TObject extends SceneObject = SceneObject> = {
  added: TObject[];
  removed: TObject[];
};

export interface SceneQuery {
  objects<TObject extends SceneObject = SceneObject>(
    callbackOrOptions: QuerySceneCallbackOrGuard<TObject> | QuerySceneOptions<TObject>
  ): TObject[];
}

export interface QueryListeners<TObject extends SceneObject = SceneObject> {
  subscribe(
    listener: (result: TObject[], event: QueryResultEvent<TObject>) => void
  ): () => void;
}

export interface SceneWithQuery extends SceneObject {
  query<TObject extends SceneObject = SceneObject>(
    callbackOrOptions: QuerySceneCallbackOrGuard<TObject> | QuerySceneOptions<TObject>
  ): TObject[];
  onQueryChange<TObject extends SceneObject = SceneObject>(
    callbackOrOptions: QuerySceneCallbackOrGuard<TObject> | QuerySceneOptions<TObject>,
    listener: (result: TObject[], event: QueryResultEvent<TObject>) => void
  ): () => void;
}

const defaultCallback: QuerySceneCallback = () => true;

function prefixToKey(prefix: PropertyKey[]): string {
  return prefix.length === 0 ? "" : JSON.stringify(prefix);
}

function pathTouchesPrefix(updatePath: PropertyKey[], prefix: PropertyKey[]): boolean {
  if (prefix.length === 0) return true;
  const minLen = Math.min(updatePath.length, prefix.length);
  for (let i = 0; i < minLen; i++) {
    if (updatePath[i] !== prefix[i]) return false;
  }
  return true;
}

function getSubtree(scene: SceneObject, prefix: PropertyKey[]): SceneObject | null {
  let current: unknown = scene;
  for (const key of prefix) {
    if (current === null || typeof current !== "object") return null;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return isSceneObject(current) ? current : null;
}

function walkSceneRaw(
  rawRoot: SceneObject,
  basePath: PropertyKey[],
  callback: QuerySceneCallback,
  sceneProxy: SceneObject,
  resultPaths: PropertyKey[][],
  visited: WeakSet<object>
): void {
  const stack: { node: SceneObject; path: PropertyKey[] }[] = [
    { node: rawRoot, path: basePath },
  ];
  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    const raw = getTarget(node) ?? node;
    if (visited.has(raw)) continue;
    visited.add(raw);

    if (callback(raw)) {
      resultPaths.push(path);
    }

    const keys = Object.keys(raw);
    for (let i = keys.length - 1; i >= 0; i--) {
      const k = keys[i];
      const value = (raw as Record<PropertyKey, unknown>)[k];
      const rawChild = isSceneObject(value) ? getTarget(value) ?? value : null;
      if (isSceneObject(rawChild)) {
        stack.push({ node: rawChild as SceneObject, path: path.concat(k) });
      }
    }
  }
}

function getProxyAtPath(sceneProxy: SceneObject, path: PropertyKey[]): SceneObject {
  let current: SceneObject = sceneProxy;
  for (const k of path) {
    current = current[k] as SceneObject;
  }
  return current;
}

function runQuery(
  scene: SceneObject,
  prefix: PropertyKey[],
  callback: QuerySceneCallback
): SceneObject[] {
  let rawRoot = getRootTarget();
  if (rawRoot === undefined) {
    rawRoot = getTarget(scene) ?? scene;
  }
  if (!isSceneObject(rawRoot)) return [];
  const rawRootOnly = getTarget(rawRoot) ?? rawRoot;
  const basePath = prefix.length === 0 ? [] : prefix;
  const rawAtPath =
    basePath.length === 0
      ? rawRootOnly
      : getValueAtPath(rawRootOnly as SceneObject, basePath);
  if (!isSceneObject(rawAtPath)) return [];
  const resultPaths: PropertyKey[][] = [];
  const visited = new WeakSet<object>();
  const sceneProxy = getScene();
  walkSceneRaw(
    rawAtPath as SceneObject,
    basePath,
    callback,
    sceneProxy,
    resultPaths,
    visited
  );
  return resultPaths.map((path) => getProxyAtPath(sceneProxy, path));
}

type CacheEntry = {
  prefix: PropertyKey[];
  results: SceneObject[];
};

const queryCache = new Map<string, CacheEntry>();
let sceneUnsubscribe: (() => void) | undefined;

function ensureSceneSubscription(): void {
  if (sceneUnsubscribe) return;
  sceneUnsubscribe = subscribeToSceneUpdates((update: SceneUpdate) => {
    const updatePath = [...update.path, update.key];
    for (const [key, entry] of queryCache.entries()) {
      if (pathTouchesPrefix(updatePath, entry.prefix)) {
        queryCache.delete(key);
        notifyQueryListeners(key);
      }
    }
  });
}

function getCacheKey(options: QuerySceneOptions): string {
  if (options.cacheKey !== undefined) return options.cacheKey;
  return prefixToKey(options.prefix ?? []);
}

function notifyQueryListeners(cacheKey: string): void {
  const listeners = queryListeners.get(cacheKey);
  if (!listeners?.size) return;
  const scene = getScene();
  for (const sub of listeners) {
    const next = runQuery(scene, sub.prefix, sub.callback);
    const added = next.filter((o) => !sub.previousSet.has(o));
    const removed = [...sub.previousSet].filter((o) => !next.includes(o));
    sub.previousSet = new Set(next);
    sub.previousResult = next;
    try {
      sub.listener(next, { added, removed });
    } catch (err) {
      console.error("[queryScene] listener error:", err);
    }
  }
}

type QueryListener = (
  result: SceneObject[],
  event: { added: SceneObject[]; removed: SceneObject[] }
) => void;

type QuerySubscription = {
  prefix: PropertyKey[];
  callback: QuerySceneCallback;
  previousResult: SceneObject[];
  previousSet: Set<SceneObject>;
  listener: QueryListener;
};

const queryListeners = new Map<string, Set<QuerySubscription>>();

export function subscribeToQuery<TObject extends SceneObject = SceneObject>(
  options: {
    prefix?: PropertyKey[];
    cacheKey?: string;
    callback?: QuerySceneCallbackOrGuard<TObject>;
  },
  listener: (result: TObject[], event: QueryResultEvent<TObject>) => void
): () => void {
  const prefix = options.prefix ?? [];
  const cacheKey = getCacheKey(options);
  const callback = options.callback ?? defaultCallback;

  ensureSceneSubscription();

  const scene = getScene();
  const initial = runQuery(scene, prefix, callback);

  queryCache.set(cacheKey, { prefix, results: initial });

  const sub: QuerySubscription = {
    prefix,
    callback,
    previousResult: initial,
    previousSet: new Set(initial),
    listener: listener as QueryListener,
  };

  let set = queryListeners.get(cacheKey);
  if (!set) {
    set = new Set();
    queryListeners.set(cacheKey, set);
  }
  set.add(sub);

  try {
    listener(initial as TObject[], { added: [], removed: [] });
  } catch (err) {
    console.error("[queryScene] listener error:", err);
  }

  return () => {
    set!.delete(sub);
    if (set!.size === 0) queryListeners.delete(cacheKey);
  };
}

export function getSceneQuery(): SceneQuery {
  return {
    objects<TObject extends SceneObject = SceneObject>(
      callbackOrOptions:
        | QuerySceneCallbackOrGuard<TObject>
        | QuerySceneOptions<TObject>
    ): TObject[] {
      return querySceneObjects(getScene(), callbackOrOptions);
    },
  };
}

export function createQueryListeners<TObject extends SceneObject = SceneObject>(
  options: {
    prefix?: PropertyKey[];
    cacheKey?: string;
    callback?: QuerySceneCallbackOrGuard<TObject>;
  }
): QueryListeners<TObject> {
  return {
    subscribe(listener) {
      return subscribeToQuery(options, listener);
    },
  };
}

export function querySceneObjects<TObject extends SceneObject = SceneObject>(
  scene: SceneObject,
  callbackOrOptions:
    | QuerySceneCallbackOrGuard<TObject>
    | QuerySceneOptions<TObject>
): TObject[] {
  const isOptions =
    typeof callbackOrOptions === "object" &&
    callbackOrOptions !== null &&
    ("prefix" in callbackOrOptions ||
      "cacheKey" in callbackOrOptions ||
      "callback" in callbackOrOptions);

  if (!isOptions) {
    const callback = callbackOrOptions as QuerySceneCallback;
    return runQuery(scene, [], callback) as TObject[];
  }

  const options = callbackOrOptions as QuerySceneOptions;
  const prefix = options.prefix ?? [];
  const callback = options.callback ?? defaultCallback;
  const cacheKey = getCacheKey(options);

  ensureSceneSubscription();

  const entry = queryCache.get(cacheKey);
  if (entry) {
    return entry.results as TObject[];
  }

  const results = runQuery(scene, prefix, callback);
  queryCache.set(cacheKey, { prefix, results });
  return results as TObject[];
}
