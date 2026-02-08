import { useState, useEffect } from "react";
import type { Entity, EntityComponents } from "../ecs/ecs";
import type { curryECSInstance } from "../ecs/ecs";
import { addDrawCallback, removeDrawCallback, addEditorUpdateCallback, removeEditorCallback } from "../gameloop";
import { useGameContext } from "./useGameContext.tsx";

export interface EntityState {
    entities: Entity[];
    selectedEntity: Entity | null;
    entityComponents: Record<Entity, EntityComponents>;
    version: number;
}

/**
 * Main hook for synchronizing ECS state with React components.
 * 
 * This hook:
 * - Subscribes to the game loop to sync ECS state every frame
 * - Updates React state every frame to trigger rerenders
 * - Handles cleanup on unmount
 * 
 * @returns Entity state with entities, selectedEntity, entityComponents, and version
 */
export function useECS(): EntityState {
    const [entityState, setEntityState] = useState<EntityState>({
        entities: [],
        selectedEntity: null,
        entityComponents: {},
        version: 0,
    });

    const gameContext = useGameContext();
    const ecs = (gameContext?.ecs as ReturnType<typeof curryECSInstance> | undefined);

    useEffect(() => {
        if (!ecs) {
            // Reset state when ECS is not available
            setEntityState({
                entities: [],
                selectedEntity: null,
                entityComponents: {},
                version: 0,
            });
            return;
        }

        const syncEntityState = () => {
            const allEntities = (Object.keys(ecs.ecsInstance.entities) as Entity[])
                .filter((entity) => ecs.ecsInstance.entities[entity] !== undefined && ecs.ecsInstance.entities[entity] !== null);
            const selectedEntity = ecs.getSelectedEntity() ?? null;

            const entityComponents: Record<Entity, EntityComponents> = {};
            for (const entity of allEntities) {
                const entityData = ecs.getEntity(entity);
                entityComponents[entity] = entityData ?? {};
            }

            // Always update every frame to trigger rerenders
            setEntityState((current) => ({
                entities: allEntities,
                selectedEntity,
                entityComponents,
                version: current.version + 1,
            }));
        };

        // Coalesce duplicate callbacks within the same tick (draw + editor update).
        let syncScheduled = false;
        const scheduleSync = () => {
            if (syncScheduled) return;
            syncScheduled = true;
            queueMicrotask(() => {
                syncScheduled = false;
                syncEntityState();
            });
        };

        // Initial sync
        syncEntityState();

        // Subscribe to draw callbacks for continuous sync every frame.
        // Also subscribe to editor update callbacks to keep editor UI in sync
        // even when draw callbacks are disabled.
        const drawCallbackId = addDrawCallback(scheduleSync);
        const editorCallbackId = addEditorUpdateCallback(scheduleSync);

        return () => {
            removeDrawCallback(drawCallbackId);
            if (editorCallbackId !== -1) {
                removeEditorCallback(editorCallbackId);
            }
        };
    }, [ecs]);

    return entityState;
}

/**
 * Hook to get list of all entities
 */
export function useSceneEntities(): Entity[] {
    const { entities } = useECS();
    return entities;
}

/**
 * Hook to get currently selected entity
 */
export function useSelectedEntity(): Entity | null {
    const { selectedEntity } = useECS();
    return selectedEntity;
}

/**
 * Hook to get all entity components
 */
export function useEntityComponents(): Record<Entity, EntityComponents> {
    const { entityComponents } = useECS();
    return entityComponents;
}

/**
 * Hook to get data for a specific entity
 */
export function useEntityData(entity: Entity | null): EntityComponents {
    const { entityComponents } = useECS();
    return entity ? entityComponents[entity] ?? {} : {};
}

/**
 * Hook to check if an entity is valid (exists in the scene)
 */
export function useIsEntityValid(entity: Entity | null): boolean {
    const { entities } = useECS();
    return entity !== null && entities.includes(entity);
}

