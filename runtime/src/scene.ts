export type Scene = Record<string, unknown>;
export type GameObject = Record<string, unknown>;

export const curryScene = (sceneData: Scene) => {
    const sceneObject = structuredClone(sceneData);

    const query = <T>(queryFunction: (gameObject: unknown) => gameObject is T) => {
        // TODO: Implement me dumbass
        return Object.values(sceneObject).filter(queryFunction)
    }

    return {
        sceneObject,
        query
    }
}

export type SceneAPI = ReturnType<typeof curryScene>;