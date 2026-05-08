import type { BaseSceneObject, SceneNodeVirtualProperties } from "../scene.js";
import { query } from "../query/query.js";

const coreSceneAdditions = {
  query(sceneNode: BaseSceneObject) {
    return <T>(predicate: (value: unknown) => value is T) =>
      query(sceneNode, predicate);
  },
  createObject(sceneNode: BaseSceneObject) {
    return <T>(key: PropertyKey, value: T): T & SceneNodeVirtualProperties => {
      const stored =
        value !== null && typeof value === "object"
          ? structuredClone(value)
          : value;
      sceneNode[key] = stored as BaseSceneObject[PropertyKey];
      return sceneNode[key] as T & SceneNodeVirtualProperties;
    };
  },
  getObject(sceneNode: BaseSceneObject) {
    return <T>(key: PropertyKey, guard: (value: unknown) => value is T): T | null => {
      const raw = Reflect.get(sceneNode, key);
      return raw != null && guard(raw) ? raw : null;
    };
  },
};

const sceneAdditionRegistry = new Map<
  PropertyKey,
  (sceneNode: BaseSceneObject) => unknown
>(
  Object.entries(coreSceneAdditions).map(([k, v]) => [k, v]),
);

export const sceneAdditions = coreSceneAdditions;

export function registerSceneAddition(
  key: PropertyKey,
  addition: (sceneNode: BaseSceneObject) => unknown,
): void {
  if (sceneAdditionRegistry.has(key)) {
    throw new Error(`Scene addition "${String(key)}" is already registered`);
  }
  sceneAdditionRegistry.set(key, addition);
}

export const hasSceneAddition = (property: PropertyKey): boolean => {
  return sceneAdditionRegistry.has(property);
};

export const getSceneAddition = (property: PropertyKey) => {
  return sceneAdditionRegistry.get(property);
};
