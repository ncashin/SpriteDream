import { invalidateUseSceneSnapshot } from "../editor/useSceneSnapshot.js";

export { saveSceneSnapshot, restoreSceneSnapshot } from "./snapshot.js";
export {
  applyPatch,
  findSceneReceiverPath,
  mergeSceneReflectUpdateIntoPatch,
} from "./patch.js";

export type SceneObject = Record<PropertyKey, unknown>;

export type SceneReflectUpdate = {
  path: PropertyKey[];
  property: PropertyKey;
  previousValue: unknown;
  value: unknown;
};

export const sceneTarget: SceneObject = {};


type SceneSubscriber = (update: SceneReflectUpdate) => void;

const subscribers = new Set<SceneSubscriber>();

function createSceneProxyHandler(path: PropertyKey[]): ProxyHandler<any> {
  return {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (value && typeof value === "object") {
        return new Proxy(value, createSceneProxyHandler([...path, property]));
      }
      return value;
    },
    set(target, property, value, receiver) {
      const previousValue = target[property];
      const result = Reflect.set(target, property, value, receiver);
      subscribers.forEach((callback) => {
        callback({ path, property, previousValue, value });
      });
      invalidateUseSceneSnapshot();
      return result;
    },
  };
}

const scene = new Proxy(sceneTarget, createSceneProxyHandler([]));

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

export const setScene = (data: SceneObject) => {
  for (const key of Object.keys(sceneTarget)) {
    delete sceneTarget[key];
  }
  Object.assign(sceneTarget, data);
  invalidateUseSceneSnapshot();
};