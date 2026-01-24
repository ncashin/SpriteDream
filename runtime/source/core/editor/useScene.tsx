import { useState, useEffect, useRef } from "react";
import { getScene, type SceneData } from "../scene/scene";

export interface SceneState {
    scene: SceneData;
    version: number;
}

export function useScene(): SceneState {
    const [sceneState, setSceneState] = useState<SceneState>({
        scene: {},
        version: 0,
    });
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const syncSceneState = () => {
            const scene = getScene();
            const clonedScene = JSON.parse(JSON.stringify(scene));

            setSceneState((current) => {
                return {
                    scene: clonedScene,
                    version: current.version + 1,
                };
            });

            animationFrameRef.current = requestAnimationFrame(syncSceneState);
        };

        syncSceneState();

        return () => {
            if (animationFrameRef.current !== null) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);

    return sceneState;
}

export function useSceneData(): SceneData {
    const { scene } = useScene();
    return scene;
}
