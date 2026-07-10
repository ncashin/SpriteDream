export type Scene = Record<string, unknown>;
export type GameObject = Record<string, unknown>;

export const curryScene = (sceneData: Scene) => {
  let sceneObject = structuredClone(sceneData);

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
    sceneObject = structuredClone(newSceneData);
    emit();
  };

  const query = <T>(
    queryFunction: (gameObject: unknown) => gameObject is T,
  ) => {
    return Object.values(sceneObject).filter(queryFunction);
  };

  return {
    // TODO: Remove this getter it's evil cleaner way to handle this
    get sceneObject() {
      return sceneObject;
    },
    subscribe,
    replace,
    query,
  };
};