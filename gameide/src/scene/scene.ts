import { invalidateUseSceneSnapshot } from "../hooks/useSceneSnapshot.js";
import { getSceneAddition } from "./sceneAdditions/sceneAdditions.js";
import type { SceneAdditions } from "./sceneAdditions/sceneAdditions.js";

export { saveSceneSnapshot, restoreSceneSnapshot } from "./snapshot.js";
export {
  applyPatch,
  findSceneReceiverPath,
  mergeSceneReflectUpdateIntoPatch,
} from "./patch.js";

export type BaseSceneObject = Record<PropertyKey, unknown>;
export type SceneObject = BaseSceneObject & SceneAdditions;

export type SceneReflectUpdate = {
  path: PropertyKey[];
  property: PropertyKey;
  previousValue: unknown;
  value: unknown;
};

export const sceneTarget: BaseSceneObject = {};


type SceneSubscriber = (update: SceneReflectUpdate) => void;

const subscribers = new Set<SceneSubscriber>();

const objectProxyCache = new WeakMap<object, BaseSceneObject>();

function isNestedSceneRecord(value: unknown): value is BaseSceneObject {
  return value !== null && typeof value === "object";
}

function createSceneProxyHandler(path: PropertyKey[]): ProxyHandler<BaseSceneObject> {
  return {
    get(target, property, receiver) {
      const sceneAddition = getSceneAddition(property);
      if (sceneAddition) {
        return sceneAddition(receiver);
      }

      const value = Reflect.get(target, property, receiver);
      if (isNestedSceneRecord(value)) {
        let cached = objectProxyCache.get(value);
        if (!cached) {
          cached = new Proxy(value, createSceneProxyHandler([...path, property]));
          objectProxyCache.set(value, cached);
        }
        return cached;
      }
      return value;
    },
    set(target, property, value, receiver) {
      if (value === undefined || value === null) {
        return Reflect.deleteProperty(receiver, property);
      }
      const previousValue = target[property];
      const result = Reflect.set(target, property, value, receiver);
      subscribers.forEach((callback) => {
        callback({ path, property, previousValue, value });
      });
      invalidateUseSceneSnapshot();
      return result;
    },
    deleteProperty(target, property) {
      const previousValue = target[property];
      const result = Reflect.deleteProperty(target, property);
      if (result) {
        subscribers.forEach((callback) => {
          callback({ path, property, previousValue, value: undefined });
        });
        invalidateUseSceneSnapshot();
      }
      return result;
    },
  };
}

const scene = new Proxy(sceneTarget, createSceneProxyHandler([]));

function assertRootSceneProxy(root: BaseSceneObject): asserts root is SceneObject {
  if (root !== scene) {
    throw new Error("expected root scene proxy");
  }
}

export function subscribeToScene(callback: SceneSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export const getScene = (): SceneObject => {
  assertRootSceneProxy(scene);
  return scene;
};

export const getRawScene = () => {
  return sceneTarget;
};

export const setScene = (data: BaseSceneObject) => {
  for (const key of Object.keys(sceneTarget)) {
    delete sceneTarget[key];
  }
  Object.assign(sceneTarget, data);
  invalidateUseSceneSnapshot();
};