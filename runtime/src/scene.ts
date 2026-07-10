export type Scene = Record<string, unknown>;
export type GameObject = Record<string, unknown>;

type Listener = () => void;

type Dependency = {
  target: object;
  key: PropertyKey;
};

const objectIds = new WeakMap<object, number>();
let nextObjectId = 0;

const getObjectId = (object: object) => {
  let id = objectIds.get(object);

  if (!id) {
    id = ++nextObjectId;
    objectIds.set(object, id);
  }

  return id;
};

export const curryScene = (sceneData: Scene) => {
  const object = structuredClone(sceneData);

  const listeners = new Map<string, Set<Listener>>();
  const proxyCache = new WeakMap<object, unknown>();

  let tracking: Dependency[] | null = null;


  const getKey = (
    target: object,
    key: PropertyKey,
  ) => {
    return `${getObjectId(target)}:${String(key)}`;
  };


  const track = (
    target: object,
    key: PropertyKey,
  ) => {
    if (!tracking) {
      return;
    }

    tracking.push({
      target,
      key,
    });
  };


  const emit = (
    target: object,
    key: PropertyKey,
  ) => {
    listeners
      .get(getKey(target, key))
      ?.forEach(listener => listener());
  };


  const createProxy = <T extends object>(
    target: T,
  ): T => {
    const cached = proxyCache.get(target);

    if (cached) {
      return cached as T;
    }


    const proxy = new Proxy(target, {
      get(target, key, receiver) {
        track(target, key);

        const value = Reflect.get(
          target,
          key,
          receiver,
        );

        if (
          typeof value === "object" &&
          value !== null
        ) {
          return createProxy(value);
        }

        return value;
      },


      set(target, key, value, receiver) {
        const previous = Reflect.get(
          target,
          key,
          receiver,
        );

        if (Object.is(previous, value)) {
          return true;
        }

        const result = Reflect.set(
          target,
          key,
          value,
          receiver,
        );

        emit(target, key);

        return result;
      },


      deleteProperty(target, key) {
        const result = Reflect.deleteProperty(
          target,
          key,
        );

        emit(target, key);

        return result;
      },
    });


    proxyCache.set(target, proxy);

    return proxy;
  };


  const proxy = createProxy(object);


  const subscribe = (
    listener: Listener,
    dependencies: Dependency[],
  ) => {
    for (const dependency of dependencies) {
      const key = getKey(
        dependency.target,
        dependency.key,
      );

      let set = listeners.get(key);

      if (!set) {
        set = new Set();
        listeners.set(key, set);
      }

      set.add(listener);
    }


    return () => {
      for (const dependency of dependencies) {
        listeners
          .get(
            getKey(
              dependency.target,
              dependency.key,
            ),
          )
          ?.delete(listener);
      }
    };
  };


  const select = <T>(
    selector: (scene: Scene) => T,
  ) => {
    tracking = [];

    const value = selector(proxy);

    const dependencies = tracking;

    tracking = null;

    return {
      value,
      dependencies,
    };
  };


  const replace = (
    newSceneData: Scene,
  ) => {
    for (const key of Object.keys(object)) {
      delete object[key];
    }

    Object.assign(
      object,
      structuredClone(newSceneData),
    );
  };


  const query = <T>(
    queryFunction: (
      gameObject: unknown,
    ) => gameObject is T,
  ) => {
    return Object.values(proxy).filter(queryFunction);
  };


  return {
    object: proxy,

    select,
    subscribe,

    replace,
    query,
  };
};


export type SceneAPI = ReturnType<typeof curryScene>;