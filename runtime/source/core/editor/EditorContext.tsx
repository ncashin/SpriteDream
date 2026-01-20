import { atom, useAtomValue, useSetAtom, getDefaultStore } from "jotai";
import { useEffect, useRef } from "react";
import type { Entity, EntityComponents } from "../ecs/ecs";
import { addDrawCallback, removeDrawCallback } from "../gameloop";
import { useScene } from "./useScene";

// ============================================================================
// Types
// ============================================================================

/** The full game context - dynamically built from plugins */
export type GameContextType = Record<string, unknown>;

export interface EntityState {
    /** All entity IDs */
    entities: Entity[];
    /** Currently selected entity */
    selectedEntity: Entity | null;
    /** Entity components by entity ID */
    entityComponents: Record<Entity, EntityComponents>;
    /** Version counter for forcing updates */
    version: number;
}

// ============================================================================
// Atoms
// ============================================================================

/** Atom holding the full game context */
export const gameContextAtom = atom<GameContextType | null>(null);

/** Setter for external code to update the game context */
export function setGameContext(context: GameContextType | null) {
    getDefaultStore().set(gameContextAtom, context);
}

/** Atom holding entity state */
export const entityStateAtom = atom<EntityState>({
    entities: [],
    selectedEntity: null,
    entityComponents: {},
    version: 0,
});

/** Derived atom for entity list */
export const entitiesAtom = atom((get) => get(entityStateAtom).entities);

/** Derived atom for selected entity */
export const selectedEntityAtom = atom((get) => get(entityStateAtom).selectedEntity);

/** Derived atom for entity components map */
export const entityComponentsAtom = atom((get) => get(entityStateAtom).entityComponents);

// ============================================================================
// Hooks
// ============================================================================

/** Hook to read the full game context */
export function useGameContext() {
    return useAtomValue(gameContextAtom);
}

/** Hook for reading entities list only (optimized - won't re-render on selection change) */
export function useSceneEntities() {
    return useAtomValue(entitiesAtom);
}

/** Hook for reading selected entity only */
export function useSelectedEntity() {
    return useAtomValue(selectedEntityAtom);
}

/** Hook for reading entity components map */
export function useEntityComponents() {
    return useAtomValue(entityComponentsAtom);
}

/** Hook to get components for a specific entity */
export function useEntityData(entity: Entity | null) {
    const entityComponents = useAtomValue(entityComponentsAtom);
    return entity ? entityComponents[entity] ?? {} : {};
}

/** Hook to check if an entity exists */
export function useIsEntityValid(entity: Entity | null) {
    const entities = useAtomValue(entitiesAtom);
    return entity !== null && entities.includes(entity);
}

// ============================================================================
// Components
// ============================================================================

/** Component to sync entity state from the game context */
export function EntityStateSynchronizer() {
    const gameContext = useAtomValue(gameContextAtom);
    const setEntityState = useSetAtom(entityStateAtom);
    const prevStateRef = useRef<{ entities: Entity[]; selectedEntity: Entity | null }>({
        entities: [],
        selectedEntity: null,
    });

    // Sync scene state (for non-entity scene data)
    useScene();

    // Sync entity state from game context
    useEffect(() => {
        const ecs = gameContext?.ecs as any;
        if (!ecs) return;

        const syncEntityState = () => {
            const currentEntities = Object.keys(ecs.ecsInstance.entities);
            const currentEntityComponents = ecs.ecsInstance.entities;
            const currentSelectedEntity = ecs.getSelectedEntity() ?? null;

            // Check if anything changed to avoid unnecessary updates
            const prev = prevStateRef.current;
            const entitiesChanged =
                prev.entities.length !== currentEntities.length ||
                !prev.entities.every((e, i) => e === currentEntities[i]);
            const selectionChanged = prev.selectedEntity !== currentSelectedEntity;

            if (entitiesChanged || selectionChanged) {
                prevStateRef.current = {
                    entities: currentEntities,
                    selectedEntity: currentSelectedEntity,
                };

                setEntityState((current) => ({
                    entities: currentEntities,
                    selectedEntity: currentSelectedEntity,
                    entityComponents: currentEntityComponents,
                    version: current.version + 1,
                }));
            }
        };

        // Initial sync
        syncEntityState();

        // Subscribe to draw callbacks for continuous sync
        const callbackId = addDrawCallback(syncEntityState);

        return () => {
            removeDrawCallback(callbackId);
        };
    }, [gameContext, setEntityState]);

    return null;
}
