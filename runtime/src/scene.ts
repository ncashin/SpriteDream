export type Scene = Record<string, unknown>;

type Listener = () => void;
type Dependency = [object, PropertyKey];
type SceneExtensions = Record<PropertyKey, unknown>;

export const curryScene = (sceneData: Scene) => {
  const scene = structuredClone(sceneData);

  const proxyCache = new WeakMap<object, object>();
  const listeners = new WeakMap<object, Map<PropertyKey, Set<Listener>>>();
  const extensions: SceneExtensions = {};

  let trackedDependencies: Dependency[] | null = null;

  const track = (target: object, key: PropertyKey) => {
    trackedDependencies?.push([target, key]);
  };

  const emit = (target: object, key: PropertyKey) => {
    listeners
      .get(target)
      ?.get(key)
      ?.forEach((listener) => listener());
  };

  const subscribe = (listener: Listener, dependencies: Dependency[]) => {
    for (const [target, key] of dependencies) {
      let objectListeners = listeners.get(target);

      if (!objectListeners) {
        objectListeners = new Map();
        listeners.set(target, objectListeners);
      }

      let propertyListeners = objectListeners.get(key);

      if (!propertyListeners) {
        propertyListeners = new Set();
        objectListeners.set(key, propertyListeners);
      }

      propertyListeners.add(listener);
    }

    return () => {
      for (const [target, key] of dependencies) {
        listeners.get(target)?.get(key)?.delete(listener);
      }
    };
  };

  const createProxy = <TObject extends object>(target: TObject): TObject => {
    const cached = proxyCache.get(target);

    if (cached) {
      return cached as TObject;
    }

    const proxy = new Proxy(target, {
      get(target, key, receiver) {
        if (key in extensions) {
          return extensions[key];
        }

        track(target, key);

        const value = Reflect.get(target, key, receiver);

        return value && typeof value === "object" ? createProxy(value) : value;
      },

      set(target, key, value, receiver) {
        if (key in extensions) {
          extensions[key] = value;
          return true;
        }

        const changed = !Object.is(Reflect.get(target, key, receiver), value);

        const success = Reflect.set(target, key, value, receiver);

        if (success && changed) {
          emit(target, key);
        }

        return success;
      },
    });

    proxyCache.set(target, proxy);

    return proxy;
  };

  const sceneProxy = createProxy(scene);

  const select = <T>(selector: (scene: Scene) => T) => {
    const dependencies: Dependency[] = [];

    trackedDependencies = dependencies;

    try {
      return {
        value: selector(sceneProxy),
        dependencies,
      };
    } finally {
      trackedDependencies = null;
    }
  };

  const query = <T>(predicate: (value: unknown) => value is T) =>
    Object.values(sceneProxy).filter(predicate);

  const replace = (value: Scene) => {
    for (const key of Object.keys(scene)) {
      delete scene[key];
    }

    Object.assign(scene, value);
  };

  const addExtensions = <TExtensions>(additions: TExtensions) => {
    Object.assign(extensions, additions);

    return sceneProxy as Scene & TExtensions;
  };

  return addExtensions({
    subscribe,
    select,
    query,
    replace,
    addExtensions,
  });
};

export type SceneAPI = ReturnType<typeof curryScene>;
