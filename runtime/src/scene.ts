import { deselectObjects } from "./selectedObject";

export type Scene = Record<PropertyKey, unknown>;

export type GameObject = Record<PropertyKey, unknown>;
export const curryScene = (sceneData: Scene) => {
  const scene = structuredClone(sceneData);
  return scene;
};

export const setScene = (scene: Scene, newScene: Scene) => {
  const clone = structuredClone(newScene);

  Object.keys(scene).forEach((key) => {
    delete scene[key];
  });

  Object.assign(scene, clone);

  deselectObjects();
};

export const patchScene = (scene: Scene, patch: Scene) => {
  for (const [key, value] of Object.entries(structuredClone(patch))) {
    const current = scene[key];

    if (
      !value ||
      !(typeof value === "object") ||
      Array.isArray(value) ||
      !current ||
      !(typeof current === "object")
    ) {
      scene[key] = value;
      continue;
    }

    patchScene(current, value);
  }
};

export const diffScene = (oldScene: Scene, newScene: Scene): Scene => {
  const patch: Scene = {};

  for (const [key, value] of Object.entries(newScene)) {
    const oldValue = oldScene[key];

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      oldValue &&
      typeof oldValue === "object" &&
      !Array.isArray(oldValue)
    ) {
      const nested = diffScene(oldValue as Scene, value as Scene);

      if (Object.keys(nested).length) {
        patch[key] = nested;
      }

      continue;
    }

    if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
      patch[key] = value;
    }
  }

  return patch;
};

export const query =
  <T>(predicate: (value: unknown) => value is T) =>
  (scene: Scene) =>
    Object.values(scene).filter(predicate);

export type SceneAPI = ReturnType<typeof curryScene>;
