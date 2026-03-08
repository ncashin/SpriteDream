type SceneObject = Record<PropertyKey, unknown>;

export type SceneUpdate =
  | { type: "set"; path: PropertyKey[]; key: PropertyKey; value: unknown }
  | { type: "delete"; path: PropertyKey[]; key: PropertyKey };

type SceneSubscriber = (update: SceneUpdate) => void;

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === "object" && value !== null;
}

const proxyCache = new WeakMap<object, SceneObject>();
const pathCache = new WeakMap<object, PropertyKey[]>();

let subscribers: Set<SceneSubscriber>;
let scene: SceneObject | undefined;
let rootTarget: SceneObject | undefined;
let initialSceneData: SceneObject | undefined;

if (typeof import.meta !== "undefined" && import.meta.hot) {
  const hotData = import.meta.hot.data as {
    scene?: SceneObject;
    rootTarget?: SceneObject;
    subscribers?: Set<SceneSubscriber>;
  };
  subscribers = hotData.subscribers ?? new Set();
  if (hotData.scene) scene = hotData.scene;
  if (hotData.rootTarget) rootTarget = hotData.rootTarget;
  import.meta.hot.dispose(() => {
    hotData.scene = scene;
    hotData.rootTarget = rootTarget;
    hotData.subscribers = subscribers;
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
  return proxy;
}

export function setInitialScene(data: SceneObject | undefined): void {
  initialSceneData = data;
}

export function getScene(): SceneObject {
  if (!scene) {
    const base = initialSceneData ?? {};
    initialSceneData = undefined;
    rootTarget = base;
    scene = createProxy(base, []);
  }

  return scene;
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
