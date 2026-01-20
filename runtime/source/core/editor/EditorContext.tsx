import { createContext, useContext } from "react";
import type { Entity, Component } from "../ecs/ecs";

export interface ECSContextType {
    ecs: {
        ecsInstance: {
            entities: Record<string, Record<string, unknown>>;
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

export const EditorContext = createContext<ECSContextType | null>(null);

export function useEditorContext() {
    return useContext(EditorContext);
}

