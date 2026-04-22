import type { BaseSceneObject } from "../scene.js";
import { query } from "../query/query.js";


export type SceneAddition = (sceneNode: BaseSceneObject) => unknown;

export const sceneAdditions = {
  query(sceneNode: BaseSceneObject) {
    return <T>(predicate: (value: unknown) => value is T) =>
      query(sceneNode, predicate);
  },
} satisfies Record<string, SceneAddition>;

export type SceneAdditions = {
  [K in keyof typeof sceneAdditions]: ReturnType<(typeof sceneAdditions)[K]>;
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
