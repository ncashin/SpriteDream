import { invalidateUseSceneSnapshot } from "../editor/useSceneSnapshot.js";
import { getSceneAddition } from "./sceneAdditions/index.js";
import type { SceneAdditions } from "./sceneAdditions/index.js";

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

function createSceneProxyHandler(path: PropertyKey[]): ProxyHandler<BaseSceneObject> {
  return {
    get(target, property, receiver) {
      const sceneAddition = getSceneAddition(property);
      if (sceneAddition) {
        return sceneAddition(receiver);
      }

      const value = Reflect.get(target, property, receiver);
      if (value && typeof value === "object") {
        return new Proxy(value, createSceneProxyHandler([...path, property]));
      }
      return value;
    },
    set(target, property, value, receiver) {
      if (value === undefined) {
        return Reflect.deleteProperty(receiver as object, property);
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

const scene = new Proxy(sceneTarget, createSceneProxyHandler([])) as SceneObject;

export function subscribeToScene(callback: SceneSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export const getScene = () => {
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