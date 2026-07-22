type Scene = Record<string, unknown>;

export const sceneCache = new Map<string, Scene>();

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
