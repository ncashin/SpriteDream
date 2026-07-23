export type Scene = Record<string, unknown>;

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

export const query =
  <T>(predicate: (value: unknown) => value is T) =>
  (scene: Scene) =>
    Object.values(scene).filter(predicate);

export type SceneAPI = ReturnType<typeof curryScene>;
