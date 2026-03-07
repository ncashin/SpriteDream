type SceneObject = Record<PropertyKey, unknown>;

function isSceneObject(value: unknown): value is SceneObject {
  return typeof value === "object" && value !== null;
}

const proxyCache = new WeakMap<object, SceneObject>();

function createProxy(target: SceneObject): SceneObject {
  const cached = proxyCache.get(target);
  if (cached) return cached;

  const proxy: SceneObject = new Proxy(target, {
    get(obj, key: PropertyKey) {
      const value = obj[key];

      if (value === undefined) {
        const child: SceneObject = {};
        obj[key] = child;
        return createProxy(child);
      }

      if (isSceneObject(value)) return createProxy(value);

      return value;
    },

    set(obj, key: PropertyKey, value: unknown) {
      obj[key] = value;
      return true;
    },

    deleteProperty(obj, key: PropertyKey) {
      delete obj[key];
      return true;
    }
  });

  proxyCache.set(target, proxy);
  return proxy;
}

let scene: SceneObject | undefined;

export function getScene(): SceneObject {
  if (!scene) {
    scene = createProxy({});
  }

  return scene;
}