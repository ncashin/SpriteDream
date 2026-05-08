import { invalidateUseSceneSnapshot } from "../hooks/useSceneSnapshot.js";
import { deselectObject } from "./objectSelection.js";
import {
  getSceneAddition,
  sceneAdditions,
} from "./sceneAdditions/sceneAdditions.js";

export { saveSceneSnapshot, restoreSceneSnapshot } from "./snapshot.js";
export {
  applyPatch,
  findSceneReceiverPath,
  mergeSceneReflectUpdateIntoPatch,
} from "./patch.js";

export interface SceneNodeVirtualProperties {}

export type BaseSceneObject = Record<PropertyKey, unknown>;
export type SceneGraphObject = BaseSceneObject & SceneNodeVirtualProperties;
export type SceneObject = SceneGraphObject & {
  [K in keyof typeof sceneAdditions]: ReturnType<(typeof sceneAdditions)[K]>;
};

export type SceneReflectUpdate = {
  path: PropertyKey[];
  property: PropertyKey;
  previousValue: unknown;
  value: unknown;
};

export const sceneTarget: BaseSceneObject = {};

type SceneSubscriber = (update: SceneReflectUpdate) => void;

const subscribers = new Set<SceneSubscriber>();

const nestedProxyCache = new WeakMap<object, Map<string, BaseSceneObject>>();

function cacheKeyForNestedPath(segments: PropertyKey[]): string {
  let key = "";
  for (let i = 0; i < segments.length; i++) {
    if (i > 0) key += "\u0000";
    key += String(segments[i]);
  }
  return key;
}

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
        const childPath = [...path, property];
        const segmentKey = cacheKeyForNestedPath(childPath);
        let byPath = nestedProxyCache.get(value);
        if (!byPath) {
          byPath = new Map();
          nestedProxyCache.set(value, byPath);
        }
        let cached = byPath.get(segmentKey);
        if (!cached) {
          cached = new Proxy(value, createSceneProxyHandler(childPath));
          byPath.set(segmentKey, cached);
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
  deselectObject();
  for (const key of Object.keys(sceneTarget)) {
    delete sceneTarget[key];
  }
  Object.assign(sceneTarget, data);
  invalidateUseSceneSnapshot();
};