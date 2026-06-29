import { invalidateExternalSceneSnapshot } from "./sceneExternalStore.js";
import { deleteValueAtPath, setValueAtPath } from "./path.js";

export type GameObject = Record<PropertyKey, unknown>;
export type SceneObject = Record<PropertyKey, unknown>;

export type ScenePath = PropertyKey[];

/** JSON-safe patch sentinel; applyPatch deletes the key instead of storing this value. */
export const SCENE_PATCH_DELETED = "__gameide_scene_patch_deleted__";

export type SceneListener = (
  object: Record<PropertyKey, unknown>,
  property: ScenePath,
  value: unknown,
) => void;

const isNestedRecord = (value: unknown): value is GameObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

const sceneProxyTargets = new WeakMap<object, object>();

function unwrapSceneProxy<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  return (sceneProxyTargets.get(value) ?? value) as T;
}

export function isScenePatchDeletion(value: unknown): boolean {
  return value === SCENE_PATCH_DELETED;
}

/** Build a minimal patch from `previous` to `next` for applyPatch. */
export function diffScenePatch(
  previous: SceneObject,
  next: SceneObject,
): Partial<SceneObject> {
  const patch: SceneObject = {};

  for (const key of Reflect.ownKeys(previous)) {
    if (!Reflect.has(next, key)) Reflect.set(patch, key, SCENE_PATCH_DELETED);
  }

  for (const key of Reflect.ownKeys(next)) {
    const before = Reflect.get(previous, key);
    const after = Reflect.get(next, key);

    if (isNestedRecord(before) && isNestedRecord(after)) {
      const child = diffScenePatch(before, after);
      if (Reflect.ownKeys(child).length > 0) Reflect.set(patch, key, child);
      continue;
    }

    if (Object.is(before, after)) continue;

    Reflect.set(patch, key, after);
  }

  return patch;
}

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
    set(object, property, value) {
      const nextValue = unwrapSceneProxy(value);
      const ok = Reflect.set(object, property, nextValue);
      if (ok && onChange) {
        onChange(object as GameObject, [...trail, property], nextValue);
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
  sceneProxyTargets.set(proxy, target);
  return proxy;
}

export const curryScene = (rawScene: SceneObject) => {
  const listeners: SceneListener[] = [];
  const scene = createSceneProxy(rawScene, [], (object, property, value) => {
    invalidateExternalSceneSnapshot();
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

  /** Apply a partial scene update without replacing objects */
  const applyPatch = (patch: Partial<SceneObject>) => {
    const walk = (data: GameObject, path: PropertyKey[]) => {
      for (const key of Reflect.ownKeys(data)) {
        const value = Reflect.get(data, key);
        const nextPath = [...path, key];
        if (isScenePatchDeletion(value)) {
          deleteValueAtPath(scene as GameObject, nextPath);
          continue;
        }
        if (isNestedRecord(value)) {
          walk(value, nextPath);
          continue;
        }
        setValueAtPath(scene as GameObject, nextPath, value);
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
