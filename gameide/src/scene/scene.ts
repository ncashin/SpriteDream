import { invalidateUseSceneSnapshot } from "./sceneExternalStore.js";

export type GameObject = Record<PropertyKey, unknown>;
export type SceneObject = Record<PropertyKey, unknown>;

export type ScenePath = PropertyKey[];

export type SceneListener = (
  object: Record<PropertyKey, unknown>,
  property: ScenePath,
  value: unknown,
) => void;

const isNestedRecord = (value: unknown): value is GameObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function createSceneProxy<T extends object = GameObject>(
  target: T,
  scenePath?: ScenePath,
  onChange?: SceneListener,
  proxyCache: WeakMap<object, unknown> = new WeakMap(),
): T {
  const cached = proxyCache.get(target);
  if (cached !== undefined) {
    return cached as T;
  }

  const trail = scenePath ?? [];
  const proxy = new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver);

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const child = value;
        return createSceneProxy(
          child,
          [...trail, property],
          onChange,
          proxyCache,
        );
      }

      return value;
    },
    set(object, property, value, receiver) {
      const ok = Reflect.set(object, property, value, receiver);
      if (ok && onChange) {
        onChange(object as GameObject, [...trail, property], value);
      }
      return ok;
    },
    deleteProperty(object, property) {
      const ok = Reflect.deleteProperty(object, property);
      if (ok && onChange) {
        onChange(object as GameObject, [...trail, property], undefined);
      }
      return ok;
    },
    has(object, property) {
      return Reflect.has(object, property);
    },
    ownKeys(object) {
      return Reflect.ownKeys(object);
    },
    getOwnPropertyDescriptor(object, property) {
      return Object.getOwnPropertyDescriptor(object, property);
    },
  });
  proxyCache.set(target as object, proxy);
  return proxy;
}

export const curryScene = (rawScene: SceneObject) => {
  const listeners: SceneListener[] = [];
  const scene = createSceneProxy(rawScene, [], (object, property, value) => {
    invalidateUseSceneSnapshot();
    listeners.forEach((listener) => listener(object, property, value));
  });

  const getRaw = () => {
    return rawScene;
  };
  const get = () => {
    return scene;
  };

  const onChange = (callback: SceneListener) => {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  };

  const createObject = <T extends GameObject = GameObject>(
    key: PropertyKey,
    gameObject: T,
  ): T => {
    scene[key] = structuredClone(gameObject);
    return scene[key] as T;
  };
  const destroyObject = (key: PropertyKey) => {
    delete scene[key];
  };

  const getObject = <T extends GameObject = GameObject>(
    key: PropertyKey,
    typeGuard?: (obj: unknown) => obj is T,
  ): T | undefined => {
    if (!typeGuard) {
      return scene[key] as T | undefined;
    }
    const object = scene[key];
    if (!object) return undefined;
    if (typeGuard(object)) return object;
    return undefined;
  };

  const query = <T>(
    queryFunction: (gameObject: unknown) => gameObject is T,
  ): T[] => {
    return Object.values(scene).filter(queryFunction) as T[];
  };

  const deleteAtPath = (root: GameObject, path: PropertyKey[]) => {
    if (path.length === 0) return;
    let node: GameObject = root;
    for (let i = 0; i < path.length - 1; i++) {
      const next = Reflect.get(node, path[i]);
      if (!isNestedRecord(next)) return;
      node = next;
    }
    Reflect.deleteProperty(node, path[path.length - 1]);
  };

  const setAtPath = (root: GameObject, path: PropertyKey[], value: unknown) => {
    if (path.length === 0) return;
    let node: GameObject = root;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      let next = Reflect.get(node, key);
      if (!isNestedRecord(next)) {
        next = {};
        Reflect.set(node, key, next);
      }
      node = next as GameObject;
    }
    Reflect.set(node, path[path.length - 1], value);
  };

  /** Apply a partial scene update without replacing intermediate objects. */
  const applyPatch = (patch: Partial<SceneObject>) => {
    const walk = (data: GameObject, path: PropertyKey[]) => {
      for (const key of Reflect.ownKeys(data)) {
        const value = Reflect.get(data, key);
        const nextPath = [...path, key];
        if (value === undefined) {
          deleteAtPath(scene as GameObject, nextPath);
          continue;
        }
        if (isNestedRecord(value)) {
          walk(value, nextPath);
          continue;
        }
        setAtPath(scene as GameObject, nextPath, value);
      }
    };
    walk(patch as GameObject, []);
  };

  const replace = (data: SceneObject) => {
    const snapshot = structuredClone(data ?? {});
    for (const key of Reflect.ownKeys(rawScene)) {
      Reflect.deleteProperty(scene, key);
    }
    applyPatch(snapshot);
  };

  return {
    getRaw,
    get,

    onChange,

    createObject,
    destroyObject,

    getObject,

    query,

    applyPatch,
    replace,
  };
};

export type Scene = ReturnType<typeof curryScene>;

let rawScene = {};
export const getRawScene = () => {
  return rawScene;
};

let scene = curryScene(rawScene);
export const getScene = () => {
  return scene;
};
export const setScene = (newScene: SceneObject) => {
  scene.replace(newScene);
};
