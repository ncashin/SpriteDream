export type Scene = Record<string, unknown>;
export type GameObject = Record<string, unknown>;

export const curryScene = (sceneData: Scene) => {
  let object = structuredClone(sceneData);

  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const replace = (newSceneData: Scene) => {
    object = structuredClone(newSceneData);
    emit();
  };

  const query = <T>(
    queryFunction: (gameObject: unknown) => gameObject is T,
  ) => {
    return Object.values(object).filter(queryFunction);
  };

  return {
    object,

    subscribe,
    replace,
    query,
  };
};

export type SceneAPI = ReturnType<typeof curryScene>;
