import type { QuerySceneCallback, QuerySceneOptions, SceneWithQuery } from "./queryScene.js";
import { querySceneObjects } from "./queryScene.js";
import { SCENE_HMR_EVENT_NAME } from "./sceneHMR.js";
import { applyScenePatch, buildPatchFromDiff } from "./scenePatch.js";

export type SceneObject = Record<PropertyKey, unknown>;

export type SceneUpdate =
  | { type: "set"; path: PropertyKey[]; key: PropertyKey; value: unknown }
  | { type: "delete"; path: PropertyKey[]; key: PropertyKey };

type SceneSubscriber = (update: SceneUpdate) => void;

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === "object" && value !== null;
}

const proxyCache = new WeakMap<object, SceneObject>();
const pathCache = new WeakMap<object, PropertyKey[]>();
const targetOfProxy = new WeakMap<SceneObject, SceneObject>();

let subscribers: Set<SceneSubscriber>;
let scene: SceneObject | undefined;
let rootTarget: SceneObject | undefined;
let initialSceneData: SceneObject | undefined;
let loadedSceneSnapshot: Record<string, unknown> | undefined;

if (typeof import.meta !== "undefined" && import.meta.hot) {
  const hotData = import.meta.hot.data as {
    scene?: SceneObject;
    rootTarget?: SceneObject;
    subscribers?: Set<SceneSubscriber>;
    loadedSceneSnapshot?: Record<string, unknown>;
  };
  subscribers = hotData.subscribers ?? new Set();
  if (hotData.scene) scene = hotData.scene;
  if (hotData.rootTarget) rootTarget = hotData.rootTarget;
  if (hotData.loadedSceneSnapshot) loadedSceneSnapshot = hotData.loadedSceneSnapshot;
  import.meta.hot.on(SCENE_HMR_EVENT_NAME, (payload: { path: string; sceneData: Record<string, unknown> }) => {
    const root = rootTarget ?? hotData.rootTarget;
    if (!root) return;
    const snapshot = loadedSceneSnapshot ?? hotData.loadedSceneSnapshot ?? {};
    const patch = buildPatchFromDiff(snapshot, payload.sceneData);
    applyScenePatch(root, patch);
    loadedSceneSnapshot = payload.sceneData;
    hotData.loadedSceneSnapshot = loadedSceneSnapshot;
  });
  import.meta.hot.dispose(() => {
    hotData.scene = scene;
    hotData.rootTarget = rootTarget;
    hotData.subscribers = subscribers;
    hotData.loadedSceneSnapshot = loadedSceneSnapshot;
  });
} else {
  subscribers = new Set();
}

function notifySubscribers(update: SceneUpdate): void {
  subscribers.forEach((fn) => {
    try {
      fn(update);
    } catch (err) {
      console.error("[scene] subscriber error:", err);
    }
  });
}

function createProxy(target: SceneObject, path: PropertyKey[] = []): SceneObject {
  const cached = proxyCache.get(target);
  if (cached) return cached;

  pathCache.set(target, path);

  const proxy: SceneObject = new Proxy(target, {
    get(obj, key: PropertyKey) {
      if (key === "query") {
        const path = pathCache.get(obj) ?? [];
        return (callbackOrOptions: QuerySceneCallback | QuerySceneOptions) => {
          const opts =
            typeof callbackOrOptions === "function"
              ? { prefix: path, callback: callbackOrOptions }
              : { ...callbackOrOptions, prefix: path };
          return querySceneObjects(getScene(), opts);
        };
      }

      const value = obj[key];

      if (value === undefined) {
        const child: SceneObject = {};
        obj[key] = child;
        const childPath = path.concat(key);
        pathCache.set(child, childPath);
        return createProxy(child, childPath);
      }

      if (isSceneObject(value)) {
        const childPath = path.concat(key);
        if (!pathCache.has(value)) pathCache.set(value, childPath);
        return createProxy(value, childPath);
      }

      return value;
    },

    set(obj, key: PropertyKey, value: unknown) {
      const prev = obj[key];
      if (prev === value) return true;
      obj[key] = value;
      const targetPath = pathCache.get(obj);
      if (targetPath !== undefined) {
        notifySubscribers({
          type: "set",
          path: targetPath,
          key,
          value,
        });
      }
      return true;
    },

    deleteProperty(obj, key: PropertyKey) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) return true;
      delete obj[key];
      const targetPath = pathCache.get(obj);
      if (targetPath !== undefined) {
        notifySubscribers({
          type: "delete",
          path: targetPath,
          key,
        });
      }
      return true;
    },
  });

  proxyCache.set(target, proxy);
  targetOfProxy.set(proxy, target);
  return proxy;
}

export function getTarget(obj: SceneObject): SceneObject | undefined {
  return targetOfProxy.get(obj);
}

export function setInitialScene(data: SceneObject | undefined): void {
  initialSceneData = data;
}

export function getScene(): SceneWithQuery {
  if (!scene) {
    const base = initialSceneData ?? {};
    initialSceneData = undefined;
    rootTarget = base;
    loadedSceneSnapshot = structuredClone(base) as Record<string, unknown>;
    if (typeof import.meta !== "undefined" && import.meta.hot) {
      (import.meta.hot.data as { loadedSceneSnapshot?: Record<string, unknown> }).loadedSceneSnapshot =
        loadedSceneSnapshot;
    }
    scene = createProxy(base, []) as SceneWithQuery;
  }

  return scene as SceneWithQuery;
}

export function subscribeToSceneUpdates(callback: SceneSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getRootTarget(): SceneObject | undefined {
  return rootTarget;
}

export function queryScene(path: PropertyKey[]): unknown {
  const root = rootTarget ?? initialSceneData ?? {};
  return getValueAtPath(root as SceneObject, path);
}

export function getValueAtPath(
  obj: SceneObject,
  path: PropertyKey[]
): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function copyInto(target: SceneObject, source: SceneObject): void {
  for (const key of Object.keys(target)) {
    delete target[key];
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isSceneObject(value)) {
      const child: SceneObject = {};
      target[key] = child;
      copyInto(child, value as SceneObject);
    } else {
      target[key] = value;
    }
  }
}

function copyIntoPreservingRefs(target: SceneObject, source: SceneObject): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    if (isSceneObject(value)) {
      const existing = target[key];
      if (isSceneObject(existing)) {
        copyIntoPreservingRefs(existing, value as SceneObject);
      } else {
        const child: SceneObject = {};
        target[key] = child;
        copyInto(child, value as SceneObject);
      }
    } else {
      target[key] = value;
    }
  }
}

export function replaceScene(data: SceneObject | undefined): void {
  const base = (data ?? {}) as SceneObject;
  if (rootTarget) {
    copyInto(rootTarget, base);
  } else {
    rootTarget = {};
    copyInto(rootTarget, base);
    scene = createProxy(rootTarget, []);
  }
}

export function restoreSceneSnapshot(data: SceneObject): void {
  if (!rootTarget) {
    replaceScene(data);
    return;
  }
  copyIntoPreservingRefs(rootTarget, data);
}

export function setSceneAtPath(path: PropertyKey[], value: unknown): void {
  const s = getScene() as Record<PropertyKey, unknown>;
  if (path.length === 0) return;
  let cur: Record<PropertyKey, unknown> = s;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    let next = cur[key];
    if (next === undefined || next === null || typeof next !== "object") {
      next = {};
      cur[key] = next;
    }
    cur = next as Record<PropertyKey, unknown>;
  }
  cur[path[path.length - 1]] = value;
}

/** Delete the key at path through the scene proxy so subscribers are notified. */
export function deleteSceneAtPath(path: PropertyKey[]): void {
  const s = getScene() as Record<PropertyKey, unknown>;
  if (path.length === 0) return;
  let cur: Record<PropertyKey, unknown> = s;
  for (let i = 0; i < path.length - 1; i++) {
    const next = cur[path[i]];
    if (next === undefined || next === null || typeof next !== "object") return;
    cur = next as Record<PropertyKey, unknown>;
  }
  delete cur[path[path.length - 1]];
}
