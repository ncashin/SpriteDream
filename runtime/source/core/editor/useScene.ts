import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
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
// Atoms
// ============================================================================

/** Base atom holding the scene state */
export const sceneStateAtom = atom<SceneState>({
    scene: {},
    version: 0,
});

/** Write-only atom to trigger scene refresh */
export const refreshSceneAtom = atom(null, (get, set) => {
    const current = get(sceneStateAtom);
    set(sceneStateAtom, { ...current, version: current.version + 1 });
});

// ============================================================================
// Hook
// ============================================================================

/**
 * Main hook for synchronizing scene state with React components.
 * 
 * This hook:
 * - Subscribes to the game loop to sync scene state
 * - Provides reactive access to the raw scene data
 * - Handles cleanup on unmount
 * 
 * @returns Scene state and utilities
 */
export function useScene() {
    const [sceneState, setSceneState] = useAtom(sceneStateAtom);

    useEffect(() => {
        const syncSceneState = () => {
            const scene = getScene();

            // Simple version bump to trigger sync
            setSceneState((current) => ({
                scene,
                version: current.version + 1,
            }));
        };

        // Initial sync
        syncSceneState();

        // Subscribe to draw callbacks for continuous sync
        const callbackId = addDrawCallback(syncSceneState);

        return () => {
            removeDrawCallback(callbackId);
        };
    }, [setSceneState]);

    return sceneState;
}

/**
 * Hook to get raw scene data
 */
export function useSceneData() {
    return useAtomValue(sceneStateAtom).scene;
}

/**
 * Hook to manually trigger a scene refresh
 */
export function useRefreshScene() {
    return useSetAtom(refreshSceneAtom);
}
