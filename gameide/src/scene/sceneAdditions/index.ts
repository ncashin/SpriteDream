import type { BaseSceneObject } from "../scene.js";
import { query } from "../query/query.js";


export type SceneAddition = (sceneNode: BaseSceneObject) => unknown;

export const sceneAdditions = {
  query(sceneNode: BaseSceneObject) {
    return <T>(predicate: (value: unknown) => value is T) =>
      query(sceneNode, predicate);
  },
  createObject(sceneNode: BaseSceneObject) {
    return (key: PropertyKey, value: unknown) => {
      sceneNode[key] = value;
      return sceneNode[key];
    };
  },
  getObject(sceneNode: BaseSceneObject) {
    return <T>(key: PropertyKey, guard: (value: unknown) => value is T): T | null => {
      const raw = Reflect.get(sceneNode, key);
      return raw != null && guard(raw) ? raw : null;
    };
  },
} satisfies Record<string, SceneAddition>;

export type SceneAdditions = Omit<
  { [K in keyof typeof sceneAdditions]: ReturnType<(typeof sceneAdditions)[K]> },
  "getObject"
> & {
  getObject: <T>(key: PropertyKey, guard: (value: unknown) => value is T) => T | null;
};

export const hasSceneAddition = (
  property: PropertyKey,
): property is keyof typeof sceneAdditions => {
  return typeof property === "string" && property in sceneAdditions;
};

export const getSceneAddition = (property: PropertyKey) => {
  if (!hasSceneAddition(property)) {
    return undefined;
  }

  return sceneAdditions[property];
};
