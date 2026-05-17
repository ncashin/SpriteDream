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

  const applyNested = (target: GameObject, data: GameObject) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        Reflect.deleteProperty(target, key);
        continue;
      }
      if (!isNestedRecord(value)) {
        Reflect.set(target, key, value);
        continue;
      }
      Reflect.set(target, key, {});
      const child = Reflect.get(target, key);
      if (!isNestedRecord(child)) continue;
      applyNested(child, value);
    }
  };

  const applyPatch = (patch: Partial<SceneObject>) => {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        Reflect.deleteProperty(scene, key);
        continue;
      }
      if (!isNestedRecord(value)) {
        Reflect.set(scene, key, value);
        continue;
      }
      Reflect.set(scene, key, {});
      const child = Reflect.get(scene, key);
      if (!isNestedRecord(child)) continue;
      applyNested(child, value);
    }
  };

  const replace = (data: SceneObject) => {
    const keys = Reflect.ownKeys(rawScene);
    for (const key of keys) {
      delete scene[key];
    }
    applyPatch(structuredClone(data));
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
