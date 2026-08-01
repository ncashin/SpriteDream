import { createSceneStore } from "./sceneStore";

export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type Serializable = Primitive | SerializableObject | Serializable[];
export type SerializableObject = { [key: string]: Serializable };

export const setScene = (scene: SerializableObject, newScene: SerializableObject) => {
  const clone = structuredClone(newScene);

  Object.keys(scene).forEach((key) => {
    delete scene[key];
  });

  Object.assign(scene, clone);
};

export const isSerializableObject = (value: Serializable): value is SerializableObject =>
  !!value && typeof value === "object";

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

export const mapScene =
  <T>(mapper: (key: string, value: Serializable) => T | undefined) =>
  (scene: SerializableObject): T[] =>
    Object.entries(scene).flatMap(([key, value]) => {
      const result = mapper(key, value);
      return result ? [result] : [];
    });

export const query =
  <T extends Serializable>(
    scene: SerializableObject,
    predicate: (key: string, value: Serializable) => value is T,
  ): [string, T][] =>
    Object.entries(scene).flatMap(([key, value]) =>
      predicate(key, value) ? [[key, value]] : [],
    );

export const find =
  <T extends Serializable>(predicate: (value: Serializable) => value is T) =>
  (scene: SerializableObject): string | undefined =>
    Object.keys(scene).find((key) => predicate(scene[key]));

export type CurrySceneOptions = {
  onSetScene?: (scene: SerializableObject) => void;
};

export const curryScene = (
  sceneData: SerializableObject,
  { onSetScene }: CurrySceneOptions,
) => {
  const scene = structuredClone(sceneData);
  const sceneStore = createSceneStore(scene);

  return {
    scene,
    sceneStore,

    setScene: (newScene: SerializableObject) => {
      setScene(scene, newScene);
      onSetScene?.(scene);
    },

    patchScene: (patch: SerializableObject) => {
      patchScene(scene, patch);
    },

    diffScene: (newScene: SerializableObject) => {
      return diffScene(scene, newScene);
    },

    queryScene:
      <TValue extends Serializable>(
        predicate: (key: string, value: Serializable) => value is TValue,
      ) =>
        query(scene, predicate),
  };
};

export type SceneAPI = ReturnType<typeof curryScene>;