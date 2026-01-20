import { atom, useAtomValue, useSetAtom, useAtom } from "jotai";
import { useEffect, useRef } from "react";
import type { Entity, Component, EntityComponents } from "../ecs/ecs";
import { addDrawCallback, removeDrawCallback } from "../gameloop";
import { useScene } from "./useScene";

// ============================================================================
// Types
// ============================================================================

export interface ECSContextType {
    ecs: {
        ecsInstance: {
            entities: Record<Entity, EntityComponents>;
        };
        getEntity: (entity: Entity) => Record<string, Component>;
        createEntity: (name: string) => Entity;
        destroyEntity: (entity: Entity) => void;
        addComponent: <ComponentType extends Component>(
            entity: Entity,
            component: ComponentType
        ) => void;
        removeComponent: (entity: Entity, component: Component) => void;
        selectEntity: (entity: Entity | null) => void;
        getSelectedEntity: () => Entity | null;
        clearSelection: () => void;
    };
}

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

/** Atom holding the ECS context */
export const ecsContextAtom = atom<ECSContextType | null>(null);

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

/** Hook to read the ECS context */
export function useEditorContext() {
    return useAtomValue(ecsContextAtom);
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

/** Component to initialize ECS context and sync entity state */
export function ECSContextInitializer({ ecsContext }: { ecsContext: ECSContextType | null }) {
    const setEcsContext = useSetAtom(ecsContextAtom);
    const [entityState, setEntityState] = useAtom(entityStateAtom);
    const prevStateRef = useRef<{ entities: Entity[]; selectedEntity: Entity | null }>({
        entities: [],
        selectedEntity: null,
    });

    // Set context
    useEffect(() => {
        setEcsContext(ecsContext);
    }, [ecsContext, setEcsContext]);

    // Sync scene state (for non-entity scene data)
    useScene();

    // Sync entity state from ECS context
    useEffect(() => {
        if (!ecsContext) return;

        const syncEntityState = () => {
            const currentEntities = Object.keys(ecsContext.ecs.ecsInstance.entities);
            const currentEntityComponents = ecsContext.ecs.ecsInstance.entities;
            const currentSelectedEntity = ecsContext.ecs.getSelectedEntity() ?? null;

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
    }, [ecsContext, setEntityState]);

    return null;
}
