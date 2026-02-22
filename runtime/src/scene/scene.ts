import invariant from "tiny-invariant";

export type Scene = Record<string, unknown>;

function isObject(value: any): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const sceneObject: Scene = {};

function createDeepProxy(targetObject: any) {
  if (!isObject(targetObject)) {
    return targetObject;
  }

  return new Proxy(targetObject, {
    get(object, property, receiver) {
      if (typeof property === "symbol" || property === "__isProxy") {
        return Reflect.get(object, property, receiver);
      }

      if (property in object) {
        const propertyValue = object[property];

        if (!isObject(propertyValue)) return propertyValue;

        if (propertyValue.__isProxy) return propertyValue;

        const proxyObject = createDeepProxy(propertyValue);

        object[property] = proxyObject;

        return proxyObject;
      }

      object[property] = {};
      return createDeepProxy(object[property]);
    },

    set(object, property, value) {
      invariant(typeof property === "string");

      object[property] = isObject(value) ? createDeepProxy(value) : value;

      return true;
    },

    deleteProperty(object, property) {
      return Reflect.deleteProperty(object, property);
    },

    has(object, property) {
      return Reflect.has(object, property);
    },
  });
}

const scene: Scene = createDeepProxy(sceneObject);

export const getScene = () => scene;
