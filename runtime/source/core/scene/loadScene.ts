const rawScenes = import.meta.glob("../../../scenes/*.scene", {
    as: "raw",
    eager: true,
});

const sceneNameToPath = {
    default: "../../../scenes/default.scene",
    fireball: "../../../scenes/fireball.scene",
} as const;

export type SceneName = keyof typeof sceneNameToPath;

export function loadScene(name: SceneName): string {
    const scene = rawScenes[sceneNameToPath[name]];
    if (!scene) {
        throw new Error(`Scene "${name}" not found`);
    }
    return scene;
}

export function loadSceneIfExists(name: string): string | null {
    if (!(name in sceneNameToPath)) {
        return null;
    }
    return loadScene(name as SceneName);
}

