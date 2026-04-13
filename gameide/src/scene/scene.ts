import { getValueAtPath } from "./scenePath.js";
import { SCENE_HMR_EVENT_NAME } from "./sceneHMR.js";
import { applyScenePatch, buildScenePatchFromDiff } from "./scenePatch.js";
import { querySubtree } from "./query.js";

export type SceneObjectData = Record<PropertyKey, unknown>;

export type SceneObject = SceneObjectData & {
  createObject(name: PropertyKey, object: SceneObjectData): SceneObject;
  query<T extends SceneObjectData>(
    predicate: (object: SceneObjectData) => object is T,
  ): (SceneObject & T)[];
  query(predicate: (object: SceneObjectData) => boolean): SceneObject[];
};

export type SceneUpdate =
  | { type: "set"; path: PropertyKey[]; key: PropertyKey; value: unknown }
  | { type: "delete"; path: PropertyKey[]; key: PropertyKey; oldValue: unknown };

type SceneSubscriber = (update: SceneUpdate) => void;

function isSceneObjectData(value: unknown): value is SceneObjectData {
  return typeof value === "object" && value !== null;
}

const proxyCache = new WeakMap<object, SceneObject>();
const pathCache = new WeakMap<object, PropertyKey[]>();
const targetOfProxy = new WeakMap<SceneObject, SceneObjectData>();

let subscribers: Set<SceneSubscriber>;
let scene: SceneObject | undefined;
let rootTarget: SceneObjectData | undefined;
let initialSceneData: SceneObjectData | undefined;
let loadedSceneSnapshot: Record<string, unknown> | undefined;
let savedSceneSnapshot: SceneObjectData | undefined;

if (typeof import.meta !== "undefined" && import.meta.hot) {
  const hotData = import.meta.hot.data as {
    scene?: SceneObject;
    rootTarget?: SceneObjectData;
    subscribers?: Set<SceneSubscriber>;
    loadedSceneSnapshot?: Record<string, unknown>;
    savedSceneSnapshot?: SceneObjectData;
  };
  subscribers = hotData.subscribers ?? new Set();
  if (hotData.scene) scene = hotData.scene;
  if (hotData.rootTarget) rootTarget = hotData.rootTarget;
  if (hotData.loadedSceneSnapshot) loadedSceneSnapshot = hotData.loadedSceneSnapshot;
  if (hotData.savedSceneSnapshot) savedSceneSnapshot = hotData.savedSceneSnapshot;
  import.meta.hot.on(SCENE_HMR_EVENT_NAME, (payload: { path: string; sceneData: Record<string, unknown> }) => {
    const root = rootTarget ?? hotData.rootTarget;
    if (!root) return;
    const snapshot = loadedSceneSnapshot ?? hotData.loadedSceneSnapshot ?? {};
    const patch = buildScenePatchFromDiff(snapshot, payload.sceneData);
    applyScenePatch(root, patch);
    if (savedSceneSnapshot) {
      applyScenePatch(savedSceneSnapshot, patch);
    }
    loadedSceneSnapshot = payload.sceneData;
    hotData.loadedSceneSnapshot = loadedSceneSnapshot;
    hotData.savedSceneSnapshot = savedSceneSnapshot;
  });
  import.meta.hot.dispose(() => {
    hotData.scene = scene;
    hotData.rootTarget = rootTarget;
    hotData.subscribers = subscribers;
    hotData.loadedSceneSnapshot = loadedSceneSnapshot;
    hotData.savedSceneSnapshot = savedSceneSnapshot;
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

function unwrapSceneTarget(obj: SceneObject | SceneObjectData): SceneObjectData {
  return targetOfProxy.get(obj as SceneObject) ?? (obj as SceneObjectData);
}

export function getSceneObjectPath(
  o: SceneObject | SceneObjectData,
): PropertyKey[] | undefined {
  const raw = unwrapSceneTarget(o);
  return pathCache.get(raw);
}

function toPlainSceneTree(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== "object") return value;
  const raw = unwrapSceneTarget(value as SceneObject | SceneObjectData);
  if (seen.has(raw)) {
    throw new Error("[scene] createObject: cyclic object graph");
  }
  seen.add(raw);
  if (Array.isArray(raw)) {
    return raw.map((item) => toPlainSceneTree(item, seen));
  }
  const out: SceneObjectData = {};
  for (const k of Reflect.ownKeys(raw)) {
    out[k as PropertyKey] = toPlainSceneTree(raw[k as PropertyKey], seen);
  }
  return out;
}

/** Eagerly wrap every nested scene object with proxies (sets pathCache via createProxy) and return the root proxy. */
function ensureSubtreeProxies(
  node: SceneObject | SceneObjectData,
  nodePath: PropertyKey[],
): SceneObject {
  const raw = unwrapSceneTarget(node);
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const v = raw[i];
      if (isSceneObjectData(v)) {
        ensureSubtreeProxies(v as SceneObjectData, nodePath.concat(i));
      }
    }
  } else {
    for (const k of Reflect.ownKeys(raw)) {
      const v = raw[k as PropertyKey];
      if (isSceneObjectData(v)) {
        ensureSubtreeProxies(v as SceneObjectData, nodePath.concat(k));
      }
    }
  }
  return createProxy(raw, nodePath);
}

function createProxy(target: SceneObjectData, path: PropertyKey[] = []): SceneObject {
  target = unwrapSceneTarget(target);
  const cached = proxyCache.get(target);
  if (cached) return cached;

  pathCache.set(target, path);

  const proxy = new Proxy(target, {
    get(obj, key: PropertyKey) {
      obj = unwrapSceneTarget(obj);

      if (key === "createObject") {
        return (name: PropertyKey, object: SceneObjectData): SceneObject => {
          const parent = unwrapSceneTarget(obj);
          const plain = toPlainSceneTree(object) as SceneObjectData;
          parent[name] = plain;
          const childPath = path.concat(name);
          const wrapped = ensureSubtreeProxies(plain, childPath);
          const parentPath = pathCache.get(parent);
          if (parentPath !== undefined) {
            notifySubscribers({
              type: "set",
              path: parentPath,
              key: name,
              value: plain,
            });
          }
          return wrapped;
        };
      }

      if (key === "query") {
        const basePath = pathCache.get(obj) ?? [];
        const queryFn: SceneObject["query"] = (
          predicate: (object: SceneObjectData) => boolean,
        ) => querySubtree(getScene(), obj, basePath, predicate);
        return queryFn;
      }

      const value = obj[key];

      if (value === undefined && key === "toJSON") {
        return undefined;
      }

      if (value === undefined) {
        const child: SceneObjectData = {};
        obj[key] = child;
        const childPath = path.concat(key);
        pathCache.set(child, childPath);
        return createProxy(child, childPath);
      }

      if (isSceneObjectData(value)) {
        const raw = unwrapSceneTarget(value as SceneObject | SceneObjectData);
        const childPath = path.concat(key);
        if (!pathCache.has(raw)) pathCache.set(raw, childPath);
        return createProxy(raw, childPath);
      }

      return value;
    },

    set(obj, key: PropertyKey, value: unknown) {
      obj = unwrapSceneTarget(obj);
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
      obj = unwrapSceneTarget(obj);
      if (!Object.prototype.hasOwnProperty.call(obj, key)) return true;
      const oldValue = obj[key];
      delete obj[key];
      const targetPath = pathCache.get(obj);
      if (targetPath !== undefined) {
        notifySubscribers({
          type: "delete",
          path: targetPath,
          key,
          oldValue,
        });
      }
      return true;
    },
  });

  proxyCache.set(target, proxy as SceneObject);
  targetOfProxy.set(proxy as SceneObject, target);
  return proxy as SceneObject;
}

export function getTarget(obj: SceneObject): SceneObjectData | undefined {
  return targetOfProxy.get(obj);
}

export function setScene(data: SceneObjectData | undefined): void {
  if (rootTarget) {
    const next = (data ?? {}) as SceneObjectData;
    const patch = buildScenePatchFromDiff(
      rootTarget as Record<string, unknown>,
      next as Record<string, unknown>,
    );
    applyScenePatch(rootTarget as Record<string, unknown>, patch);
  } else {
    initialSceneData = data;
  }
}

export function getScene(): SceneObject {
  if (!scene) {
    const base = initialSceneData ?? {};
    initialSceneData = undefined;
    rootTarget = base;
    loadedSceneSnapshot = structuredClone(base) as Record<string, unknown>;
    if (typeof import.meta !== "undefined" && import.meta.hot) {
      (import.meta.hot.data as { loadedSceneSnapshot?: Record<string, unknown> }).loadedSceneSnapshot =
        loadedSceneSnapshot;
    }
    scene = createProxy(base, []);
  }

  return scene;
}

export function onSceneChange(callback: SceneSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function getSceneRaw(): SceneObjectData | undefined {
  return rootTarget;
}

const emptySceneRoot: SceneObjectData = {};

export function getSceneValueAtPath(path: PropertyKey[]): unknown {
  const root = rootTarget ?? initialSceneData ?? emptySceneRoot;
  return getValueAtPath(root as SceneObjectData, path);
}

export function saveSceneSnapshot(): void {
  savedSceneSnapshot = structuredClone(getSceneRaw() ?? {}) as SceneObjectData;
  if (typeof import.meta !== "undefined" && import.meta.hot) {
    (import.meta.hot.data as { savedSceneSnapshot?: SceneObjectData }).savedSceneSnapshot =
      savedSceneSnapshot;
  }
}

export function restoreSceneSnapshot(): void {
  if (!savedSceneSnapshot) return;
  const data = savedSceneSnapshot;
  savedSceneSnapshot = undefined;
  if (typeof import.meta !== "undefined" && import.meta.hot) {
    (import.meta.hot.data as { savedSceneSnapshot?: SceneObjectData }).savedSceneSnapshot =
      undefined;
  }
  if (!rootTarget) {
    setScene(data);
    return;
  }
  const patch = buildScenePatchFromDiff(
    rootTarget as Record<string, unknown>,
    data as Record<string, unknown>,
  );
  applyScenePatch(rootTarget as Record<string, unknown>, patch);
}
