import type { GameObject, Scene } from "./scene.js";

export type SceneObjectExtensionHandler<
  Args extends unknown[] = unknown[],
  Return = unknown,
> = (self: GameObject, ...args: Args) => Return;

export type SceneObjectExtensionMap = Record<
  string,
  SceneObjectExtensionHandler<any, any>
>;

export type BoundSceneObjectExtensions<
  E extends SceneObjectExtensionMap,
> = {
  [K in keyof E]: E[K] extends SceneObjectExtensionHandler<
    infer Args,
    infer Return
  >
    ? (...args: Args) => Return
    : never;
};

export type GameObjectWithExtensions<
  T extends GameObject,
  E extends SceneObjectExtensionMap,
> = T & BoundSceneObjectExtensions<E>;

export type SceneWithExtensions<
  E extends SceneObjectExtensionMap = SceneObjectExtensionMap,
> = Omit<Scene, "createObject" | "getObject" | "query"> & {
  createObject: <T extends GameObject = GameObject>(
    key: PropertyKey,
    gameObject: T,
  ) => GameObjectWithExtensions<T, E>;
  getObject: <T extends GameObject = GameObject>(
    key: PropertyKey,
    typeGuard?: (object: unknown) => object is T,
  ) => GameObjectWithExtensions<T, E> | undefined;
  query: <T extends GameObject>(
    queryFunction: (gameObject: unknown) => gameObject is T,
  ) => GameObjectWithExtensions<T, E>[];
};

const boundExtensionCache = new WeakMap<object, object>();

function bindGameObjectExtensions<
  T extends GameObject,
  E extends SceneObjectExtensionMap,
>(object: T, extensions: E): GameObjectWithExtensions<T, E> {
  const cached = boundExtensionCache.get(object);
  if (cached) return cached as GameObjectWithExtensions<T, E>;

  const bound = new Proxy(object, {
    get(target, property, receiver) {
      const handler = Reflect.get(extensions, property);
      if (typeof handler === "function") {
        return (...args: unknown[]) => handler(target, ...args);
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      return Reflect.set(target, property, value, receiver);
    },
    deleteProperty(target, property) {
      return Reflect.deleteProperty(target, property);
    },
    has(target, property) {
      if (Reflect.has(target, property)) return true;
      return Reflect.has(extensions, property);
    },
    ownKeys(target) {
      const keys = new Set(Reflect.ownKeys(target));
      for (const key of Reflect.ownKeys(extensions)) keys.add(key);
      return [...keys];
    },
    getOwnPropertyDescriptor(target, property) {
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      if (descriptor) return descriptor;
      if (Reflect.has(extensions, property)) {
        return {
          configurable: true,
          enumerable: false,
          writable: false,
        };
      }
      return undefined;
    },
  });

  boundExtensionCache.set(object, bound);
  return bound as GameObjectWithExtensions<T, E>;
}

export function augmentScene<E extends SceneObjectExtensionMap>(
  scene: Scene,
  extensions: E,
): SceneWithExtensions<E> {
  const bind = <T extends GameObject>(object: T) =>
    bindGameObjectExtensions(object, extensions);

  return {
    ...scene,
    createObject(key, gameObject) {
      return bind(scene.createObject(key, gameObject));
    },
    getObject(key, typeGuard) {
      const object = scene.getObject(key, typeGuard);
      return object ? bind(object) : undefined;
    },
    query<T extends GameObject>(
      queryFunction: (gameObject: unknown) => gameObject is T,
    ) {
      return scene.query(queryFunction).map((object) => bind(object));
    },
  };
}
