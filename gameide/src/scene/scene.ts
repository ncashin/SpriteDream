export type GameObject = Record<PropertyKey, unknown>;
export type SceneObject = Record<PropertyKey, GameObject>;
export type ScenePath = PropertyKey[];
export type SceneListener = (
  object: Record<PropertyKey, unknown>,
  property: ScenePath,
  receiver: any,
) => void;

const isNestedRecord = (value: unknown): value is GameObject =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function createSceneProxy<T extends object = GameObject>(
  target: T,
  scenePath?: ScenePath,
  onChange?: (object: T, property: ScenePath, receiver: any) => void,
): T {
  return new Proxy(target, {
    get(object, property, receiver) {
      const value = Reflect.get(object, property, receiver);

      if (onChange) {
        onChange(object, [...(scenePath ?? []), property], receiver);
      }

      // Recursively create proxies for nested objects
      if (value && typeof value === "object" && !(value instanceof Proxy)) {
        return createSceneProxy(value, [...(scenePath ?? []), property]);
      }

      return value;
    },
    set(object, property, value, receiver) {
      return Reflect.set(object, property, value, receiver);
    },
    deleteProperty(object, property) {
      return Reflect.deleteProperty(object, property);
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
}

export const curryScene = (rawScene: Record<PropertyKey, GameObject>) => {
  const listeners: SceneListener[] = [];
  const scene = createSceneProxy(rawScene, [], (object, property, receiver) => {
    listeners.forEach((listener) => listener(object, property, receiver));
  });

  const onChange = (callback: SceneListener) => {
    listeners.push(callback);
  };

  const createObject = (key: PropertyKey, gameObject: GameObject) => {
    scene[key] = gameObject;
    return scene[key];
  };
  const destroyObject = (key: PropertyKey) => {
    delete scene[key];
  };

  const getObject = (key: PropertyKey) => {
    return scene[key];
  };

  const query = (queryFunction: (gameObject: GameObject) => boolean) => {
    return Object.values(scene).filter(queryFunction);
  };
  const onQueryChange = (callback: (gameObject: GameObject) => boolean) => {
    return Object.values(scene).filter(callback);
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

  return {
    onChange,

    createObject,
    destroyObject,

    getObject,

    query,
    onQueryChange,

    applyPatch,
  };
};

let rawScene = {};

export const getRawScene = () => {
  return rawScene;
};

let scene = curryScene(rawScene);

export const getScene = () => {
  return scene;
};
export const setScene = (newScene: SceneObject) => {
  rawScene = newScene;
  scene = curryScene(newScene);
};
