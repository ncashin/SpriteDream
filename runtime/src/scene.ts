import { deselectObjects } from "./selectedObject";

export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type Serializable = Primitive | SerializableObject | Serializable[];
export type SerializableObject = { [key: string]: Serializable };

export const curryScene = (sceneData: SerializableObject) => {
  const scene = structuredClone(sceneData);
  return scene;
};

export const setScene = (scene: SerializableObject, newScene: SerializableObject) => {
  const clone = structuredClone(newScene);

  Object.keys(scene).forEach((key) => {
    delete scene[key];
  });

  Object.assign(scene, clone);

  deselectObjects();
};

export const isSerializableObject = (value: Serializable): value is SerializableObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const patchScene = (scene: SerializableObject, patch: SerializableObject) => {
  for (const [key, value] of Object.entries(structuredClone(patch))) {
    const current = scene[key];

    if (!isSerializableObject(value) || !isSerializableObject(current)) {
      scene[key] = value;
      continue;
    }

    patchScene(current, value);
  }
};

export const diffScene = (
  oldScene: SerializableObject,
  newScene: SerializableObject,
): SerializableObject => {
  const patch: SerializableObject = {};

  for (const [key, value] of Object.entries(newScene)) {
    const oldValue = oldScene[key];

    if (!isSerializableObject(value) || !isSerializableObject(oldValue)) {
      if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
        patch[key] = value;
      }

      continue;
    }

    const nested = diffScene(oldValue, value);

    if (Object.keys(nested).length) {
      patch[key] = nested;
    }
  }

  return patch;
};

export const query =
  <T extends Serializable>(predicate: (value: Serializable) => value is T) =>
  (scene: SerializableObject): T[] =>
    Object.values(scene).filter(predicate);

export type SceneAPI = ReturnType<typeof curryScene>;
