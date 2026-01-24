import { useState, useEffect } from "react";
import { getScene, type SceneData } from "../scene/scene";
import { addDrawCallback, removeDrawCallback } from "../gameloop";

// ============================================================================
// Types
// ============================================================================

export interface SceneState {
    /** Raw scene data */
    scene: SceneData;
    /** Version counter for forcing updates */
    version: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for synchronizing scene state with React components.
 * 
 * This hook:
 * - Subscribes to the game loop to sync scene state every frame
 * - Updates React state every frame to trigger rerenders
 * - Handles cleanup on unmount
 * 
 * @returns Scene state with scene data and version
 */
export function useScene(): any {
    const [sceneState, setSceneState] = useState<any>({
        scene: {},
        version: 0,
    });

    useEffect(() => {
        const syncSceneState = () => {
            const scene = getScene();

            // Always update every frame to trigger rerenders
            setSceneState((current: any) => ({
                scene,
                version: current.version + 1,
            }));
        };

        // Initial sync
        syncSceneState();

        // Subscribe to draw callbacks for continuous sync every frame
        const callbackId = addDrawCallback(syncSceneState);

        return () => {
            removeDrawCallback(callbackId);
        };
    }, []);

    return sceneState;
}

/**
 * Hook to get raw scene data
 */
export function useSceneData(): SceneData {
    const { scene } = useScene();
    return scene;
}
